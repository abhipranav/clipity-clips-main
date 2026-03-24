import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { basename, join } from "path";
import type { ProviderSet } from "../providers/factory";
import { loadConfig } from "../config";
import type { PipelineRun, StageResult, ClipProgressSnapshot } from "../pipeline/types";
import type { CheckpointStore } from "../providers/checkpoint";
import type { QueueProvider } from "../providers/queue";
import type { SettingsStore } from "../providers/settings";
import { createLogger } from "../utils/logger";
import type { JobOptions, ResolvedJobOptions } from "../job-options/types";
import {
  resolveJobOptions,
  SUPPORTED_CAPTION_PRESETS,
  SUPPORTED_FONTS,
  SUPPORTED_POSITIONS,
  SUPPORTED_SPLIT_SCREEN_MODES,
  SUPPORTED_ASPECT_PRESETS,
  SUPPORTED_TEXT_CASES,
  VALIDATION,
  isValidHexColor,
  isValidCaptionFontId,
  isValidCaptionPresetId,
  isValidCaptionPosition,
  isValidSplitScreenMode,
  isValidAspectPreset,
  isValidTextCase,
} from "../job-options/types";

const log = createLogger("api");
const workerHeartbeatWindowMs = 2 * 60 * 1000;

let providers: ProviderSet | null = null;

// Called by server.ts to inject providers after they're created
export function setProviders(p: ProviderSet): void {
  providers = p;
}

function getProviders(): ProviderSet {
  if (!providers) {
    throw new Error("Providers not initialized. Call setProviders() first.");
  }
  return providers;
}

async function checkBinary(name: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    const proc = Bun.spawn([name, ...args], { stdout: "ignore", stderr: "ignore" });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

function hasRecentWorkerActivity(runs: PipelineRun[]): boolean {
  const cutoff = Date.now() - workerHeartbeatWindowMs;
  return runs.some((run) => {
    if (run.status !== "running") {
      return false;
    }
    const updatedAt = new Date(run.updatedAt).getTime();
    return Number.isFinite(updatedAt) && updatedAt >= cutoff;
  });
}

async function getDependencyHealth(): Promise<{
  ffmpeg: boolean;
  ytDlp: boolean;
  python3: boolean;
  zip: boolean;
  whisperCli: boolean;
}> {
  const [ffmpeg, ytDlp, python3, zip, whisperCli] = await Promise.all([
    checkBinary("ffmpeg", ["-version"]),
    checkBinary("yt-dlp", ["--version"]),
    checkBinary("python3", ["--version"]),
    checkBinary("zip", ["-v"]),
    checkBinary("whisper-cli", ["-h"]),
  ]);

  return { ffmpeg, ytDlp, python3, zip, whisperCli };
}

async function resolveExistingFinalReelPath(
  finalReelPath: string | undefined,
  videoId: string,
  clipIndex: number,
): Promise<string | null> {
  if (!finalReelPath) {
    return null;
  }

  const directFile = Bun.file(finalReelPath);
  if (await directFile.exists()) {
    return finalReelPath;
  }

  const outputDir = join(process.cwd(), "output", videoId);
  const dir = Bun.file(outputDir);
  if (!(await dir.exists())) {
    return finalReelPath;
  }

  const files = await Array.fromAsync(dir.values());
  const candidates = files
    .map((file) => file.name)
    .filter((name) => name.toLowerCase().endsWith(".mp4"))
    .sort((a, b) => a.localeCompare(b));

  return candidates[clipIndex] ? join("output", videoId, candidates[clipIndex]) : finalReelPath;
}

// GET /api/app-summary
export async function getAppSummary(): Promise<Response> {
  try {
    const { checkpoint, queue } = getProviders();
    const runs = await checkpoint.listRuns();
    
    // Calculate stats
    const stats = {
      totalRuns: runs.length,
      queuedRuns: runs.filter((r) => r.status === "queued").length,
      runningRuns: runs.filter((r) => r.status === "running").length,
      completedRuns: runs.filter((r) => r.status === "completed").length,
      failedRuns: runs.filter((r) => r.status === "failed").length,
    };

    // Get recent runs (last 10)
    const recentRuns = runs
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 10);

    // Get ready outputs from completed runs
    const readyOutputs = [];
    const completedRuns = runs.filter((r) => r.status === "completed").slice(0, 5);
    
    for (const run of completedRuns) {
      const clipProgress = await checkpoint.getClipProgressList(run.id);
      for (const clip of clipProgress) {
        const finalReelPath = await resolveExistingFinalReelPath(
          clip.artifactPaths.finalReelPath,
          run.videoId,
          clip.clipIndex,
        );
        if (finalReelPath) {
          readyOutputs.push({
            runId: run.id,
            videoTitle: run.videoTitle || run.videoId,
            clipId: clip.clipId,
            clipTitle: `Clip ${clip.clipIndex + 1}`,
            hookLine: clip.artifactPaths.hookText || "Extracted short-form clip",
            duration: clip.artifactPaths.duration ? Math.round(Number(clip.artifactPaths.duration)) : 15,
            finalReelPath,
            createdAt: clip.updatedAt,
          });
        }
      }
    }

    // Queue status (counts)
    const queueStatus = {
      queuedCount: stats.queuedRuns,
      runningCount: stats.runningRuns,
      hasQueuedWithoutWorker: stats.queuedRuns > 0,
    };

    // Check queue provider health for real status
    const queueHealthCheck = await queue.healthCheck();
    const queueHealthy = queueHealthCheck.healthy;
    const config = loadConfig();
    const workerConnected = queueHealthy && (stats.runningRuns > 0 || stats.queuedRuns === 0 || hasRecentWorkerActivity(runs));
    const workerHealth = {
      connected: workerConnected,
      mode: config.appMode,
    };

    return jsonResponse({
      stats,
      recentRuns,
      readyOutputs: readyOutputs.slice(0, 8),
      queueHealth: queueStatus,
      workerHealth,
    });
  } catch (err) {
    log.error(`Failed to get app summary: ${err}`);
    return errorResponse("Failed to get app summary", 500);
  }
}

// POST /api/jobs
export async function createJob(request: Request): Promise<Response> {
  try {
    const { checkpoint, queue, settings } = getProviders();
    const body = await request.json() as { videoUrl?: string; options?: JobOptions };
    
    const videoUrl = body.videoUrl?.trim();
    if (!videoUrl) {
      return errorResponse("Missing videoUrl", 400);
    }

    // Validate YouTube URL
    const videoIdMatch = videoUrl.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    const videoId = videoIdMatch?.[1] ?? "";
    
    if (!videoId) {
      return errorResponse("Invalid YouTube URL", 400);
    }

    // Validate job options if provided
    if (body.options) {
      const validationError = validateJobOptions(body.options);
      if (validationError) {
        return errorResponse(validationError, 400);
      }
    }

    // Get global defaults and merge with per-job overrides
    const globalDefaults = await settings.getDefaults();
    const resolvedOptions = resolveJobOptions(globalDefaults, body.options);

    // Create queued run with resolved options
    const run = await checkpoint.createQueuedRun(videoUrl, videoId, "", resolvedOptions);
    await queue.enqueue(run.id);

    log.info(`Created job: ${run.id} for ${videoUrl}`);

    return jsonResponse({ runId: run.id, status: run.status });
  } catch (err) {
    log.error(`Failed to create job: ${err}`);
    return errorResponse("Failed to create job", 500);
  }
}

// GET /api/runs
export async function listRuns(): Promise<Response> {
  try {
    const { checkpoint } = getProviders();
    const runs = await checkpoint.listRuns();
    
    // Sort by updatedAt desc
    const sortedRuns = runs.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );

    return jsonResponse(sortedRuns);
  } catch (err) {
    log.error(`Failed to list runs: ${err}`);
    return errorResponse("Failed to list runs", 500);
  }
}

// GET /api/runs/:runId
export async function getRun(runId: string): Promise<Response> {
  try {
    const { checkpoint } = getProviders();
    const run = await checkpoint.getRun(runId);
    
    if (!run) {
      return errorResponse("Run not found", 404);
    }

    const stageResults = await checkpoint.getStageResults(runId);
    const clipProgressRaw = await checkpoint.getClipProgressList(runId);
    const clipProgress = await Promise.all(
      clipProgressRaw.map(async (clip) => ({
        ...clip,
        artifactPaths: {
          ...clip.artifactPaths,
          finalReelPath: await resolveExistingFinalReelPath(
            clip.artifactPaths.finalReelPath,
            run.videoId,
            clip.clipIndex,
          ) ?? undefined,
        },
      })),
    );
    const finalReels = clipProgress
      .map((clip) => clip.artifactPaths.finalReelPath)
      .filter((path): path is string => Boolean(path));
    
    // Get resolved job options used for this run
    const jobOptions = await checkpoint.getRunJobOptions(runId);

    return jsonResponse({
      run,
      stages: stageResults,
      clipProgress,
      finalReels,
      jobOptions,
    });
  } catch (err) {
    log.error(`Failed to get run: ${err}`);
    return errorResponse("Failed to get run", 500);
  }
}

// GET /api/library
export async function getLibrary(): Promise<Response> {
  try {
    const { checkpoint } = getProviders();
    const runs = await checkpoint.listRuns();
    const completedRuns = runs.filter((r) => r.status === "completed");

    // Group by video
    const groups = new Map<string, { videoId: string; videoTitle: string; clips: unknown[] }>();

    for (const run of completedRuns) {
      const clipProgress = await checkpoint.getClipProgressList(run.id);
      
      if (!groups.has(run.videoId)) {
        groups.set(run.videoId, {
          videoId: run.videoId,
          videoTitle: run.videoTitle || run.videoId,
          clips: [],
        });
      }

      const group = groups.get(run.videoId)!;
      
      for (const clip of clipProgress) {
        const finalReelPath = await resolveExistingFinalReelPath(
          clip.artifactPaths.finalReelPath,
          run.videoId,
          clip.clipIndex,
        );
        if (finalReelPath) {
          group.clips.push({
            clipId: clip.clipId,
            title: `Clip ${clip.clipIndex + 1}`,
            hookLine: clip.artifactPaths.hookText || "Extracted short-form clip",
            duration: clip.artifactPaths.duration ? Math.round(Number(clip.artifactPaths.duration)) : 15,
            finalReelPath,
            createdAt: clip.updatedAt,
          });
        }
      }
    }

    const library = Array.from(groups.values()).map((group) => ({
      ...group,
      clipCount: group.clips.length,
    }));

    return jsonResponse(library);
  } catch (err) {
    log.error(`Failed to get library: ${err}`);
    return errorResponse("Failed to get library", 500);
  }
}

// GET /api/library/:videoId/download
export async function downloadLibraryGroup(videoId: string): Promise<Response> {
  let tempDirPath: string | null = null;

  try {
    const { checkpoint, artifact } = getProviders();
    const normalizedVideoId = videoId.trim();

    if (!normalizedVideoId) {
      return errorResponse("Missing videoId", 400);
    }

    const runs = await checkpoint.listRuns();
    const completedRuns = runs.filter(
      (run) => run.status === "completed" && run.videoId === normalizedVideoId,
    );

    const finalReelRefs: string[] = [];
    for (const run of completedRuns) {
      const clipProgress = await checkpoint.getClipProgressList(run.id);
      for (const clip of clipProgress) {
        const finalReelPath = clip.artifactPaths.finalReelPath;
        if (finalReelPath) {
          finalReelRefs.push(finalReelPath);
        }
      }
    }

    if (finalReelRefs.length === 0) {
      return errorResponse("No final reels found for this video", 404);
    }

    tempDirPath = await mkdtemp(join(tmpdir(), "clipity-library-"));
    const downloadedPaths: string[] = [];

    for (let index = 0; index < finalReelRefs.length; index++) {
      const ref = finalReelRefs[index];
      const baseName = basename(ref).replace(/[^a-zA-Z0-9._-]/g, "_") || `clip-${index + 1}.mp4`;
      const localPath = join(tempDirPath, `${String(index + 1).padStart(2, "0")}-${baseName}`);
      await artifact.download(ref, localPath);
      downloadedPaths.push(localPath);
    }

    const zipName = `${normalizedVideoId}-clips.zip`;
    const zipPath = join(tempDirPath, zipName);
    const zipProc = Bun.spawn(["zip", "-j", zipPath, ...downloadedPaths], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const exitCode = await zipProc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(zipProc.stderr).text();
      log.error(`Failed to create ZIP archive: ${stderr}`);
      return errorResponse("Failed to create ZIP archive. Ensure 'zip' is installed on the server.", 500);
    }

    const zipFile = Bun.file(zipPath);
    const zipBuffer = await zipFile.arrayBuffer();

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${zipName}"`,
      },
    });
  } catch (err) {
    log.error(`Failed to download library group: ${err}`);
    return errorResponse("Failed to prepare download", 500);
  } finally {
    if (tempDirPath) {
      await rm(tempDirPath, { recursive: true, force: true });
    }
  }
}

// GET /api/queue
export async function getQueue(): Promise<Response> {
  try {
    const { checkpoint, queue } = getProviders();
    const config = loadConfig();
    
    const runs = await checkpoint.listRuns();
    const queuedCount = runs.filter((r) => r.status === "queued").length;
    const runningCount = runs.filter((r) => r.status === "running").length;

    // Get recent failures (failed runs from last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentFailures = runs
      .filter((r) => r.status === "failed" && new Date(r.updatedAt) > oneDayAgo)
      .slice(0, 10)
      .map((r) => ({
        runId: r.id,
        error: "Processing failed",
        failedAt: r.updatedAt,
      }));

    const queueHealthCheck = await queue.healthCheck();
    const workerConnected = queueHealthCheck.healthy && (runningCount > 0 || queuedCount === 0 || hasRecentWorkerActivity(runs));

    return jsonResponse({
      queuedCount,
      runningCount,
      workerMode: config.appMode,
      workerConnected,
      recentFailures,
    });
  } catch (err) {
    log.error(`Failed to get queue: ${err}`);
    return errorResponse("Failed to get queue", 500);
  }
}

// GET /api/settings
export async function getSettings(): Promise<Response> {
  try {
    const { settings } = getProviders();
    const config = loadConfig();
    
    // Get creator defaults from settings store
    const defaults = await settings.getDefaults();

    return jsonResponse({
      creatorDefaults: defaults,
      capabilities: {
        captionPresets: SUPPORTED_CAPTION_PRESETS,
        fonts: SUPPORTED_FONTS,
        positions: SUPPORTED_POSITIONS,
        splitScreenModes: SUPPORTED_SPLIT_SCREEN_MODES,
        aspectPresets: SUPPORTED_ASPECT_PRESETS,
        textCases: SUPPORTED_TEXT_CASES,
      },
      validation: VALIDATION,
      environment: {
        appMode: config.appMode,
        checkpointBackend: config.checkpointBackend,
        queueBackend: config.queueBackend,
        artifactBackend: config.artifactBackend,
      },
    });
  } catch (err) {
    log.error(`Failed to get settings: ${err}`);
    return errorResponse("Failed to get settings", 500);
  }
}

// PUT /api/settings
export async function updateSettings(request: Request): Promise<Response> {
  try {
    const { settings } = getProviders();
    const body = await request.json() as { defaults?: Partial<ResolvedJobOptions> };

    if (!body.defaults) {
      return errorResponse("Missing defaults", 400);
    }

    // Validate the provided defaults
    const validationError = validateResolvedJobOptions(body.defaults);
    if (validationError) {
      return errorResponse(validationError, 400);
    }

    // Get current defaults and merge with updates
    const currentDefaults = await settings.getDefaults();
    const updatedDefaults: ResolvedJobOptions = {
      captions: { ...currentDefaults.captions, ...body.defaults.captions },
      output: { ...currentDefaults.output, ...body.defaults.output },
      clipSelection: { ...currentDefaults.clipSelection, ...body.defaults.clipSelection },
    };

    await settings.saveDefaults(updatedDefaults);
    log.info("Updated creator defaults");

    return jsonResponse({ success: true, defaults: updatedDefaults });
  } catch (err) {
    log.error(`Failed to update settings: ${err}`);
    return errorResponse("Failed to update settings", 500);
  }
}

// GET /api/system/health
export async function getSystemHealth(): Promise<Response> {
  try {
    const { checkpoint, queue } = getProviders();
    const config = loadConfig();
    const runs = await checkpoint.listRuns();

    // Check checkpoint
    const checkpointHealthy = await checkpoint.getRun("health-check").then(() => true).catch(() => false);
    
    // Check queue provider health for real status
    const queueHealthCheck = await queue.healthCheck();
    const queueHealthy = queueHealthCheck.healthy;

    // Check Gemini API
    const geminiHealthy = !!config.geminiApiKey;
    const dependencyHealth = await getDependencyHealth();
    const dependenciesHealthy = Object.values(dependencyHealth).every(Boolean);
    const workerHealthy = queueHealthy && (runs.filter((run) => run.status === "queued").length === 0 || hasRecentWorkerActivity(runs));

    const allHealthy = checkpointHealthy && queueHealthy && geminiHealthy && dependenciesHealthy && workerHealthy;

    return jsonResponse({
      status: allHealthy ? "healthy" : "degraded",
      checks: {
        checkpoint: checkpointHealthy,
        queue: queueHealthy,
        geminiApi: geminiHealthy,
        worker: workerHealthy,
        dependencies: dependenciesHealthy,
        ffmpeg: dependencyHealth.ffmpeg,
        ytDlp: dependencyHealth.ytDlp,
        python3: dependencyHealth.python3,
        zip: dependencyHealth.zip,
        whisperCli: dependencyHealth.whisperCli,
      },
      message: allHealthy ? undefined : "Some services are experiencing issues",
    });
  } catch (err) {
    log.error(`Failed to get health: ${err}`);
    return jsonResponse({
      status: "unhealthy",
      checks: {
        checkpoint: false,
        queue: false,
        geminiApi: false,
        worker: false,
        dependencies: false,
        ffmpeg: false,
        ytDlp: false,
        python3: false,
        zip: false,
        whisperCli: false,
      },
      message: "Health check failed",
    });
  }
}

// Helper functions
function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ error: message }, status);
}

// Validation helpers
function validateJobOptions(options: JobOptions): string | null {
  if (options.captions) {
    const c = options.captions;
    if (c.presetId !== undefined && !isValidCaptionPresetId(c.presetId)) {
      return `Invalid caption preset: ${c.presetId}`;
    }
    if (c.fontId !== undefined && !isValidCaptionFontId(c.fontId)) {
      return `Invalid font: ${c.fontId}`;
    }
    if (c.activeColor !== undefined && !isValidHexColor(c.activeColor)) {
      return `Invalid active color: ${c.activeColor}. Must be hex format #RRGGBB`;
    }
    if (c.inactiveColor !== undefined && !isValidHexColor(c.inactiveColor)) {
      return `Invalid inactive color: ${c.inactiveColor}. Must be hex format #RRGGBB`;
    }
    if (c.textCase !== undefined && !isValidTextCase(c.textCase)) {
      return `Invalid text case: ${c.textCase}`;
    }
    if (c.position !== undefined && !isValidCaptionPosition(c.position)) {
      return `Invalid position: ${c.position}`;
    }
    if (c.fontSizePx !== undefined && (c.fontSizePx < VALIDATION.fontSizePx.min || c.fontSizePx > VALIDATION.fontSizePx.max)) {
      return `Invalid fontSizePx: ${c.fontSizePx}. Must be between ${VALIDATION.fontSizePx.min} and ${VALIDATION.fontSizePx.max}`;
    }
    if (c.maxWordsPerGroup !== undefined && (c.maxWordsPerGroup < VALIDATION.maxWordsPerGroup.min || c.maxWordsPerGroup > VALIDATION.maxWordsPerGroup.max)) {
      return `Invalid maxWordsPerGroup: ${c.maxWordsPerGroup}. Must be between ${VALIDATION.maxWordsPerGroup.min} and ${VALIDATION.maxWordsPerGroup.max}`;
    }
    if (c.boxOpacity !== undefined && (c.boxOpacity < VALIDATION.boxOpacity.min || c.boxOpacity > VALIDATION.boxOpacity.max)) {
      return `Invalid boxOpacity: ${c.boxOpacity}. Must be between ${VALIDATION.boxOpacity.min} and ${VALIDATION.boxOpacity.max}`;
    }
    if (c.boxRadiusPx !== undefined && (c.boxRadiusPx < VALIDATION.boxRadiusPx.min || c.boxRadiusPx > VALIDATION.boxRadiusPx.max)) {
      return `Invalid boxRadiusPx: ${c.boxRadiusPx}. Must be between ${VALIDATION.boxRadiusPx.min} and ${VALIDATION.boxRadiusPx.max}`;
    }
    if (c.strokeWidthPx !== undefined && (c.strokeWidthPx < VALIDATION.strokeWidthPx.min || c.strokeWidthPx > VALIDATION.strokeWidthPx.max)) {
      return `Invalid strokeWidthPx: ${c.strokeWidthPx}. Must be between ${VALIDATION.strokeWidthPx.min} and ${VALIDATION.strokeWidthPx.max}`;
    }
  }

  if (options.output) {
    const o = options.output;
    if (o.aspectPreset !== undefined && !isValidAspectPreset(o.aspectPreset)) {
      return `Invalid aspect preset: ${o.aspectPreset}`;
    }
    if (o.splitScreenMode !== undefined && !isValidSplitScreenMode(o.splitScreenMode)) {
      return `Invalid split screen mode: ${o.splitScreenMode}`;
    }
    if (o.clipSpeed !== undefined && (o.clipSpeed < VALIDATION.clipSpeed.min || o.clipSpeed > VALIDATION.clipSpeed.max)) {
      return `Invalid clipSpeed: ${o.clipSpeed}. Must be between ${VALIDATION.clipSpeed.min} and ${VALIDATION.clipSpeed.max}`;
    }
  }

  if (options.clipSelection) {
    const cs = options.clipSelection;
    if (cs.maxClips !== undefined && (cs.maxClips < VALIDATION.maxClips.min || cs.maxClips > VALIDATION.maxClips.max)) {
      return `Invalid maxClips: ${cs.maxClips}. Must be between ${VALIDATION.maxClips.min} and ${VALIDATION.maxClips.max}`;
    }
  }

  return null;
}

function validateResolvedJobOptions(options: Partial<ResolvedJobOptions>): string | null {
  // Same validation as JobOptions but with stricter checks
  return validateJobOptions(options as JobOptions);
}
