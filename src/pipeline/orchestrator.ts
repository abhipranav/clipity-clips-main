import { createLogger } from "../utils/logger";
import { runDir, ensureDir } from "../utils/fs";
import { PipelineStage, StageStatus } from "./types";
import type { Config } from "../config";
import type { VideoMetadata, Transcript, ClipCandidate, ClipArtifacts } from "./types";
import type { ResolvedJobOptions } from "../job-options/types";
import { Downloader } from "../modules/downloader";
import { Transcriber } from "../modules/transcriber";
import { ClipIdentifier } from "../modules/clip-identifier";
import { VideoProcessor } from "../modules/video-processor";
import { CaptionGenerator } from "../modules/caption-generator";
import { join } from "path";
import type { CheckpointStore } from "../providers/checkpoint";
import type { ArtifactStore } from "../providers/artifact";

const log = createLogger("orchestrator");

class Semaphore {
  private count: number;
  private queue: Array<() => void> = [];

  constructor(max: number) {
    this.count = max;
  }

  async acquire(): Promise<void> {
    if (this.count > 0) {
      this.count--;
      return;
    }
    return new Promise((resolve) => this.queue.push(resolve));
  }

  release(): void {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    } else {
      this.count++;
    }
  }
}

export class PipelineOrchestrator {
  private checkpoint: CheckpointStore;
  private artifactStore: ArtifactStore;
  private config: Config;
  private downloader: Downloader;
  private transcriber = new Transcriber();
  private clipIdentifier: ClipIdentifier;
  private videoProcessor = new VideoProcessor();
  private captionGenerator = new CaptionGenerator();

  constructor(config: Config, checkpoint: CheckpointStore, artifactStore: ArtifactStore) {
    this.config = config;
    this.checkpoint = checkpoint;
    this.artifactStore = artifactStore;
    this.downloader = new Downloader(config);
    this.clipIdentifier = new ClipIdentifier(config);
  }

  async run(videoUrl: string, _fromStage?: PipelineStage): Promise<string> {
    const videoId = this.extractVideoId(videoUrl);
    // Create immediate run without job options (uses defaults)
    const run = await this.checkpoint.createImmediateRun(videoUrl, videoId, "");
    const dir = runDir(this.config.paths.data, run.id);

    log.info(`Pipeline started: ${run.id}`);
    log.info(`Video: ${videoUrl}`);

    // Get job options for this run
    const jobOptions = await this.checkpoint.getRunJobOptions(run.id);
    if (!jobOptions) {
      throw new Error("Failed to get job options for run");
    }

    try {
      const metadata = await this.stageDownload(run.id, videoUrl, dir);
      const transcript = await this.stageTranscribe(run.id, metadata, dir);
      let clips = await this.stageIdentifyClips(run.id, transcript, metadata, dir);
      if (jobOptions.clipSelection.maxClips > 0) {
        clips = clips.slice(0, jobOptions.clipSelection.maxClips);
        log.info(`Limiting to ${clips.length} clips (maxClips=${jobOptions.clipSelection.maxClips})`);
      }
      await this.processClips(run.id, clips, metadata, dir, jobOptions);
      await this.checkpoint.markRunCompleted(run.id);
      log.info(`Pipeline completed: ${run.id}`);
    } catch (err) {
      log.error(`Pipeline failed: ${err}`);
      await this.checkpoint.markRunFailed(run.id);
      throw err;
    }

    return run.id;
  }

  async resume(runId: string): Promise<void> {
    const run = await this.checkpoint.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);

    // Get job options for this run
    const jobOptions = await this.checkpoint.getRunJobOptions(runId);
    if (!jobOptions) {
      throw new Error(`Failed to get job options for run ${runId}`);
    }

    log.info(`Resuming pipeline: ${runId}`);
    const dir = runDir(this.config.paths.data, runId);

    try {
      let metadata: VideoMetadata;
      const dlResult = await this.checkpoint.getStageResult<VideoMetadata>(runId, PipelineStage.DOWNLOAD);
      if (dlResult?.status === StageStatus.COMPLETED) {
        metadata = dlResult.data;
        log.info("Skipping DOWNLOAD (completed)");
      } else {
        metadata = await this.stageDownload(runId, run.videoUrl, dir);
      }

      let transcript: Transcript;
      const txResult = await this.checkpoint.getStageResult<Transcript>(runId, PipelineStage.TRANSCRIBE);
      if (txResult?.status === StageStatus.COMPLETED) {
        transcript = txResult.data;
        log.info("Skipping TRANSCRIBE (completed)");
      } else {
        transcript = await this.stageTranscribe(runId, metadata, dir);
      }

      let clips: ClipCandidate[];
      const idResult = await this.checkpoint.getStageResult<ClipCandidate[]>(
        runId,
        PipelineStage.IDENTIFY_CLIPS,
      );
      if (idResult?.status === StageStatus.COMPLETED) {
        clips = idResult.data;
        log.info("Skipping IDENTIFY_CLIPS (completed)");
      } else {
        clips = await this.stageIdentifyClips(runId, transcript, metadata, dir);
      }

      const completedIds = new Set(await this.checkpoint.getCompletedClipIds(runId));
      const remainingClips = clips.filter((c) => !completedIds.has(c.id));

      if (remainingClips.length === 0) {
        log.info("All clips already processed");
      } else {
        log.info(`Resuming ${remainingClips.length}/${clips.length} clips`);
        await this.processClips(runId, remainingClips, metadata, dir, jobOptions);
      }

      await this.checkpoint.markRunCompleted(runId);
      log.info(`Pipeline resumed and completed: ${runId}`);
    } catch (err) {
      log.error(`Resume failed: ${err}`);
      await this.checkpoint.markRunFailed(runId);
      throw err;
    }
  }

  async runQueuedRun(runId: string): Promise<void> {
    const run = await this.checkpoint.getRun(runId);
    if (!run) throw new Error(`Run not found: ${runId}`);
    if (run.status !== "queued") throw new Error(`Run ${runId} is not queued (status: ${run.status})`);

    // Get job options for this run
    const jobOptions = await this.checkpoint.getRunJobOptions(runId);
    if (!jobOptions) {
      throw new Error(`Failed to get job options for run ${runId}`);
    }

    const dir = runDir(this.config.paths.data, runId);

    log.info(`Worker processing queued run: ${runId}`);
    await this.checkpoint.markRunRunning(runId);

    try {
      const metadata = await this.stageDownload(runId, run.videoUrl, dir);
      const transcript = await this.stageTranscribe(runId, metadata, dir);
      let clips = await this.stageIdentifyClips(runId, transcript, metadata, dir);
      if (jobOptions.clipSelection.maxClips > 0) {
        clips = clips.slice(0, jobOptions.clipSelection.maxClips);
        log.info(`Limiting to ${clips.length} clips (maxClips=${jobOptions.clipSelection.maxClips})`);
      }
      await this.processClips(runId, clips, metadata, dir, jobOptions);
      await this.checkpoint.markRunCompleted(runId);
      log.info(`Queued run completed: ${runId}`);
    } catch (err) {
      log.error(`Queued run failed: ${err}`);
      await this.checkpoint.markRunFailed(runId);
      throw err;
    }
  }

  private async stageDownload(
    runId: string,
    videoUrl: string,
    dir: string,
  ): Promise<VideoMetadata> {
    await this.checkpoint.startStage(runId, PipelineStage.DOWNLOAD);
    const downloadDir = join(dir, "downloads");
    const metadata = await this.downloader.download(videoUrl, downloadDir);
    await this.checkpoint.completeStage(runId, PipelineStage.DOWNLOAD, [metadata.filePath], metadata);
    return metadata;
  }

  private async stageTranscribe(
    runId: string,
    metadata: VideoMetadata,
    dir: string,
  ): Promise<Transcript> {
    await this.checkpoint.startStage(runId, PipelineStage.TRANSCRIBE);
    const transcriptDir = join(dir, "transcripts");
    const transcript = await this.transcriber.transcribe(metadata, transcriptDir, this.config);
    await this.checkpoint.completeStage(
      runId,
      PipelineStage.TRANSCRIBE,
      [transcript.srtPath ?? ""],
      transcript,
    );
    return transcript;
  }

  private async stageIdentifyClips(
    runId: string,
    transcript: Transcript,
    metadata: VideoMetadata,
    dir: string,
  ): Promise<ClipCandidate[]> {
    await this.checkpoint.startStage(runId, PipelineStage.IDENTIFY_CLIPS);
    const clips = await this.clipIdentifier.identify(transcript, metadata);
    const clipsPath = join(dir, "clips.json");
    await Bun.write(clipsPath, JSON.stringify(clips, null, 2));
    await this.checkpoint.completeStage(runId, PipelineStage.IDENTIFY_CLIPS, [clipsPath], clips);
    log.info(`Identified ${clips.length} clips`);
    return clips;
  }

  private async processClips(
    runId: string,
    clips: ClipCandidate[],
    metadata: VideoMetadata,
    dir: string,
    jobOptions: ResolvedJobOptions,
  ): Promise<void> {
    const semaphore = new Semaphore(this.config.maxParallelClips);
    const outputDir = join(this.config.paths.output, metadata.videoId);
    ensureDir(outputDir);

    await this.captionGenerator.warmup();

    log.info(`Processing ${clips.length} clips (parallel: ${this.config.maxParallelClips})`);

    const results = await Promise.allSettled(
      clips.map(async (clip, index) => {
        await semaphore.acquire();
        try {
          log.info(`[${index + 1}/${clips.length}] Processing: "${clip.title}"`);
          await this.processOneClip(runId, clip, index, metadata, dir, outputDir, jobOptions);
          log.info(`[${index + 1}/${clips.length}] Completed: "${clip.title}"`);
        } finally {
          semaphore.release();
        }
      }),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      log.warn(`${failed.length}/${clips.length} clips failed`);
      for (const f of failed) {
        if (f.status === "rejected") log.error(`  ${f.reason}`);
      }
    }

    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    log.info(`${succeeded}/${clips.length} clips processed successfully`);
  }

  private async processOneClip(
    runId: string,
    clip: ClipCandidate,
    clipIndex: number,
    metadata: VideoMetadata,
    dir: string,
    outputDir: string,
    jobOptions: ResolvedJobOptions,
  ): Promise<ClipArtifacts> {
    const artifacts: Partial<ClipArtifacts> = { clipId: clip.id };
    const progress = await this.checkpoint.getClipProgress(runId, clip.id);

    // Extract
    if (progress?.artifactPaths?.extractedVideoPath) {
      artifacts.extractedVideoPath = progress.artifactPaths.extractedVideoPath;
    } else {
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.EXTRACT_CLIPS,
        "in_progress",
        {},
      );
      artifacts.extractedVideoPath = await this.videoProcessor.extractClip(
        metadata.filePath,
        clip,
        join(dir, "clips"),
        this.config,
      );
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.EXTRACT_CLIPS,
        "completed",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
        },
      );
    }

    // Remove silence
    if (progress?.artifactPaths?.silenceRemovedPath) {
      artifacts.silenceRemovedPath = progress.artifactPaths.silenceRemovedPath;
    } else {
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.REMOVE_SILENCE,
        "in_progress",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
        },
      );
      const desilencedPath = join(dir, "desilenced", `${clip.id}_clean.mp4`);
      const result = await this.videoProcessor.removeSilence(
        artifacts.extractedVideoPath,
        desilencedPath,
        this.config,
      );
      artifacts.silenceRemovedPath = result.path;
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.REMOVE_SILENCE,
        "completed",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
          silenceRemovedPath: artifacts.silenceRemovedPath,
        },
      );
    }

    // Generate captions
    if (progress?.artifactPaths?.captionOverlayPath) {
      artifacts.captionOverlayPath = progress.artifactPaths.captionOverlayPath;
    } else {
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.GENERATE_CAPTIONS,
        "in_progress",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
          silenceRemovedPath: artifacts.silenceRemovedPath,
        },
      );

      const overlayPath = join(dir, "captions", `${clip.id}_captions.webm`);
      artifacts.captionOverlayPath = await this.captionGenerator.generate(
        artifacts.silenceRemovedPath,
        overlayPath,
        this.config,
        jobOptions,
      );

      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.GENERATE_CAPTIONS,
        "completed",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
          silenceRemovedPath: artifacts.silenceRemovedPath,
          captionOverlayPath: artifacts.captionOverlayPath,
        },
      );
    }

    // Compose reel
    if (progress?.artifactPaths?.finalReelPath) {
      artifacts.finalReelPath = progress.artifactPaths.finalReelPath;
    } else {
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.COMPOSE_REEL,
        "in_progress",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
          silenceRemovedPath: artifacts.silenceRemovedPath,
          captionOverlayPath: artifacts.captionOverlayPath,
        },
      );
      const reelPath = join(outputDir, `${clip.id}_reel.mp4`);
      const localReelPath = await this.videoProcessor.composeReel(
        artifacts.silenceRemovedPath,
        this.config,
        reelPath,
        jobOptions,
        clip,
        artifacts.captionOverlayPath,
      );
      const artifactKey =
        this.config.artifactBackend === "local"
          ? join(this.config.paths.output, metadata.videoId, `${clip.id}_reel.mp4`)
          : `${metadata.videoId}/${clip.id}_reel.mp4`;
      // Publish to artifact store (S3 in cloud mode, local in local mode)
      const artifact = await this.artifactStore.publish(localReelPath, {
        key: artifactKey,
      });
      artifacts.finalReelPath = artifact.ref;
      log.info(`Published reel to: ${artifacts.finalReelPath}`);
      await this.checkpoint.updateClipProgress(
        runId,
        clip.id,
        clipIndex,
        PipelineStage.COMPOSE_REEL,
        "completed",
        {
          extractedVideoPath: artifacts.extractedVideoPath,
          silenceRemovedPath: artifacts.silenceRemovedPath,
          captionOverlayPath: artifacts.captionOverlayPath,
          finalReelPath: artifacts.finalReelPath,
        },
      );
    }

    return artifacts as ClipArtifacts;
  }

  private extractVideoId(url: string): string {
    const match = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? url.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 32);
  }
}
