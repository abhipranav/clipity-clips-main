import { createLogger } from "../utils/logger";
import {
  runFfmpeg,
  detectSilence,
  secondsToFfmpegTimestamp,
  getVideoDuration,
} from "../utils/ffmpeg";
import { fileExists, ensureDir } from "../utils/fs";
import type { Config } from "../config";
import type { ClipCandidate } from "../pipeline/types";
import type { ResolvedJobOptions } from "../job-options/types";
import { getAspectDimensions, SUPPORTED_BRAINROT_TYPES } from "../job-options/types";
import { join, dirname } from "path";
import { readdirSync, existsSync } from "fs";

const log = createLogger("video-processor");

export interface SpeechRange {
  start: number;
  end: number;
}

export class VideoProcessor {
  private buildEncodeArgs(config?: Config): string[] {
    const threads = config?.ffmpegThreads;
    const preset = config?.ffmpegPreset ?? "medium";
    const crf = config?.ffmpegCrf ?? 18;
    const threadArgs = threads && threads > 0 ? ["-threads", String(threads)] : [];

    return [...threadArgs, "-c:v", "libx264", "-preset", preset, "-crf", String(crf)];
  }

  async extractClip(
    videoPath: string,
    clip: ClipCandidate,
    outputDir: string,
    config?: Config,
  ): Promise<string> {
    const outputPath = join(outputDir, `${clip.id}_raw.mp4`);

    if (await fileExists(outputPath)) {
      log.info(`Clip already extracted: ${clip.title}`);
      return outputPath;
    }

    log.info(`Extracting clip: "${clip.title}" (${clip.startTime}s - ${clip.endTime}s)`);
    await runFfmpeg([
      "-i",
      videoPath,
      "-ss",
      secondsToFfmpegTimestamp(clip.startTime),
      "-to",
      secondsToFfmpegTimestamp(clip.endTime),
      ...this.buildEncodeArgs(config),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-y",
      outputPath,
    ]);

    return outputPath;
  }

  async removeSilence(
    clipPath: string,
    outputPath: string,
    config: Config,
  ): Promise<{ path: string; speechRanges: SpeechRange[] | null }> {
    if (await fileExists(outputPath)) {
      log.info("Silence-removed clip already exists");
      return { path: outputPath, speechRanges: null };
    }

    log.info("Detecting silence...");
    const silenceRanges = await detectSilence(
      clipPath,
      config.silenceThresholdDb,
      config.silenceMinDuration,
      config.ffmpegThreads,
    );

    if (silenceRanges.length === 0) {
      log.info("No significant silence detected, copying as-is");
      await Bun.write(outputPath, Bun.file(clipPath));
      return { path: outputPath, speechRanges: null };
    }

    const clipDuration = await getVideoDuration(clipPath);
    const speechRanges = this.invertRanges(silenceRanges, clipDuration, 0.05);

    if (speechRanges.length === 0) {
      log.warn("No speech ranges found, keeping original");
      await Bun.write(outputPath, Bun.file(clipPath));
      return { path: outputPath, speechRanges: null };
    }

    const totalSpeech = speechRanges.reduce((sum, r) => sum + (r.end - r.start), 0);
    if (totalSpeech < 10) {
      log.warn(`Too short after silence removal (${totalSpeech.toFixed(1)}s), keeping original`);
      await Bun.write(outputPath, Bun.file(clipPath));
      return { path: outputPath, speechRanges: null };
    }

    log.info(
      `Removing ${silenceRanges.length} silence gaps (keeping ${totalSpeech.toFixed(1)}s of ${clipDuration.toFixed(1)}s)`,
    );

    // Use trim/atrim + concat to preserve A/V sync (select/aselect causes drift)
    const filterParts: string[] = [];
    const concatInputs: string[] = [];
    for (let i = 0; i < speechRanges.length; i++) {
      const r = speechRanges[i];
      filterParts.push(
        `[0:v]trim=${r.start.toFixed(3)}:${r.end.toFixed(3)},setpts=PTS-STARTPTS[v${i}];`,
      );
      filterParts.push(
        `[0:a]atrim=${r.start.toFixed(3)}:${r.end.toFixed(3)},asetpts=PTS-STARTPTS[a${i}];`,
      );
      concatInputs.push(`[v${i}][a${i}]`);
    }
    const filterComplex =
      filterParts.join("") +
      `${concatInputs.join("")}concat=n=${speechRanges.length}:v=1:a=1[outv][outa]`;

    await runFfmpeg([
      "-i",
      clipPath,
      "-filter_complex",
      filterComplex,
      "-map",
      "[outv]",
      "-map",
      "[outa]",
      ...this.buildEncodeArgs(config),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-y",
      outputPath,
    ]);

    return { path: outputPath, speechRanges };
  }

  async composeReel(
    clipPath: string,
    config: Config,
    outputPath: string,
    jobOptions: ResolvedJobOptions,
    clip: ClipCandidate,
    captionOverlayPath?: string | null,
  ): Promise<string> {
    ensureDir(dirname(outputPath));

    if (await fileExists(outputPath)) {
      log.info("Reel already composed");
      return outputPath;
    }

    const splitMode = jobOptions.output.splitScreenMode;
    const brainrotType = jobOptions.output.brainrotType;

    // Resolve brainrot video path using the new private method
    let brainrotPath: string | null = null;
    try {
      brainrotPath = await this.resolveBrainrotVideo(jobOptions);
    } catch (error) {
      log.warn(`Could not resolve brainrot video: ${error instanceof Error ? error.message : "unknown error"}`);
      // If brainrot cannot be resolved, proceed without split-screen
    }

    // Determine if we should use split-screen based on mode and availability
    let useSplitScreen = false;
    if (splitMode === "never") {
      useSplitScreen = false;
    } else if (splitMode === "always") {
      if (!brainrotPath) {
        throw new Error(`Split-screen mode is 'always' but no supporting footage (${brainrotType}) is available`);
      }
      useSplitScreen = true;
    } else {
      // auto: use split-screen if assets available
      useSplitScreen = !!brainrotPath;
    }

    if (!useSplitScreen) {
      log.info("Creating single-video reel (split-screen disabled or no assets)");
      return this.composeSingleReel(clipPath, config, outputPath, jobOptions, clip, captionOverlayPath);
    }

    // brainrotPath is guaranteed to be not null here if useSplitScreen is true
    const brainrotDuration = await getVideoDuration(brainrotPath!);
    const clipDuration = await getVideoDuration(clipPath);

    const speed = jobOptions.output.clipSpeed;
    const effectiveClipDuration = clipDuration / speed;
    const maxOffset = Math.max(0, brainrotDuration - effectiveClipDuration);
    const brainrotOffset = Math.random() * maxOffset;

    // Derive dimensions from aspect preset
    const { width: w, height: h } = getAspectDimensions(jobOptions.output.aspectPreset);

    log.info(`Composing split-screen reel (${speed}x speed, ${w}x${h})...`);

    const halfHeight = Math.floor(h / 2);
    const hasCaptions = captionOverlayPath && (await fileExists(captionOverlayPath));

    let filterComplex =
      `[0:v]fps=30,scale=${w}:${halfHeight}:force_original_aspect_ratio=increase,crop=${w}:${halfHeight}[top];` +
      `[1:v]fps=30,setpts=PTS/${speed},scale=${w}:${halfHeight}:force_original_aspect_ratio=increase,crop=${w}:${halfHeight}[bottom];` +
      `[1:a]atempo=${speed}[afast];` +
      `[top][bottom]vstack=inputs=2[bg]`;

    if (hasCaptions) {
      filterComplex +=
        `;[2:v]fps=30,scale=${w}:${h},colorkey=0x00FF00:0.3:0.1[captions];` + `[bg][captions]overlay=0:0:format=auto[out]`;
    } else {
      filterComplex += `;[bg]copy[out]`;
    }

    const inputs = [
      "-ss",
      secondsToFfmpegTimestamp(brainrotOffset),
      "-i",
      brainrotPath!, // Use the resolved brainrotPath
      "-i",
      clipPath,
    ];

    if (hasCaptions) {
      inputs.push("-i", captionOverlayPath!);
    }

    await runFfmpeg([
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "[afast]",
      ...this.buildEncodeArgs(config),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-r",
      "30",
      "-shortest",
      "-y",
      outputPath,
    ]);

    log.info(`Reel composed: ${outputPath}`);
    return outputPath;
  }

  private async composeSingleReel(
    clipPath: string,
    config: Config,
    outputPath: string,
    jobOptions: ResolvedJobOptions,
    clip: ClipCandidate,
    captionOverlayPath?: string | null,
  ): Promise<string> {
    // Derive dimensions from aspect preset
    const { width: w, height: h } = getAspectDimensions(jobOptions.output.aspectPreset);
    const speed = jobOptions.output.clipSpeed;
    const hasCaptions = captionOverlayPath && (await fileExists(captionOverlayPath));

    let filterComplex =
      `[0:v]fps=30,setpts=PTS/${speed},scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}[base];` +
      `[0:a]atempo=${speed}[afast]`;

    let currentOverlayOut = "[base]";
    let inputIdx = 1;
    const inputs = ["-i", clipPath];

    // B-Roll overlays have been deprecated in favor of unified split-screen output

    if (hasCaptions) {
      inputs.push("-i", captionOverlayPath!);
      filterComplex +=
        `;[${inputIdx}:v]fps=30,scale=${w}:${h},colorkey=0x00FF00:0.3:0.1[captions];` +
        `${currentOverlayOut}[captions]overlay=0:0:format=auto[out]`;
    } else {
      filterComplex += `;${currentOverlayOut}copy[out]`;
    }

    await runFfmpeg([
      ...inputs,
      "-filter_complex",
      filterComplex,
      "-map",
      "[out]",
      "-map",
      "[afast]",
      ...this.buildEncodeArgs(config),
      "-c:a",
      "aac",
      "-b:a",
      "192k",
      "-r",
      "30",
      "-y",
      outputPath,
    ]);

    return outputPath;
  }

  private invertRanges(
    silenceRanges: Array<{ start: number; end: number }>,
    totalDuration: number,
    buffer: number,
  ): Array<{ start: number; end: number }> {
    const sorted = [...silenceRanges].sort((a, b) => a.start - b.start);
    const speech: Array<{ start: number; end: number }> = [];
    let cursor = 0;

    for (const silence of sorted) {
      const speechStart = cursor;
      const speechEnd = Math.max(cursor, silence.start - buffer);
      if (speechEnd - speechStart > 0.05) {
        speech.push({ start: Math.max(0, speechStart), end: speechEnd });
      }
      cursor = silence.end + buffer;
    }

    if (cursor < totalDuration) {
      speech.push({ start: cursor, end: totalDuration });
    }

    return speech;
  }

  private async resolveBrainrotVideo(jobOptions: ResolvedJobOptions): Promise<string> {
    const type = jobOptions.output.brainrotType;
    if (type === "none") return "";
    
    let typePath = join(process.cwd(), "assets", "brainrot", type);
    if (!existsSync(typePath)) {
      typePath = join(process.cwd(), "assets", "broll", type);
    }

    if (type === "random") {
      const types = SUPPORTED_BRAINROT_TYPES.filter(t => t !== "random" && t !== "none");
      const randomType = types[Math.floor(Math.random() * types.length)];
      
      let randomTypePath = join(process.cwd(), "assets", "brainrot", randomType);
      if (!existsSync(randomTypePath)) {
        randomTypePath = join(process.cwd(), "assets", "broll", randomType);
      }
      return this.getRandomVideoFromDir(randomTypePath);
    }
    
    const specifiedIdx = jobOptions.output.brainrotClipIdx;
    
    if (specifiedIdx && specifiedIdx !== "random") {
      const exactPath = join(typePath, `clip_${specifiedIdx}.mp4`);
      if (existsSync(exactPath)) return exactPath;
    }
    
    return this.getRandomVideoFromDir(typePath);
  }

  private async getRandomVideoFromDir(dirPath: string): Promise<string> {
    if (!existsSync(dirPath)) {
      throw new Error(`Asset directory not found: ${dirPath}`);
    }
    const files = readdirSync(dirPath);
    const videos = files.filter(f => f.startsWith("clip_") && (f.endsWith(".mp4") || f.endsWith(".webm") || f.endsWith(".mkv")));
    
    if (videos.length === 0) {
      throw new Error(`No videos found in asset directory: ${dirPath}`);
    }
    return join(dirPath, videos[Math.floor(Math.random() * videos.length)]);
  }
}
