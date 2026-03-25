#!/usr/bin/env bun
import { spawn } from "child_process";
import { join } from "path";
import { mkdir } from "fs/promises";
import { existsSync, readdirSync } from "fs";

const YTDLP_BIN = "yt-dlp";
const FFMPEG_BIN = "ffmpeg";
const FFPROBE_BIN = "ffprobe";

// Define the exact queries to fetch 7 distinct videos for each category via yt-dlp search engine
const SEARCH_MAP: Record<string, Record<string, string>> = {
  brainrot: {
    "gta-parkour": "ytsearch15:gta 5 parkour gameplay no commentary copyright free",
    "minecraft-parkour": "ytsearch15:minecraft parkour gameplay no background music copyright free",
    "subway-surfers": "ytsearch15:subway surfers gameplay background copy right free",
    "satisfying": "ytsearch15:satisfying kinetic sand paint mixing no voice no copyright",
  },
  broll: {
    "finance": "ytsearch15:stock market chart trading finance b-roll footage copyright free",
    "tech": "ytsearch15:technology abstract server coding computer hackers b-roll video free",
    "nature": "ytsearch15:4k nature drone footage ocean forest mountains stock footage",
  }
};

async function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`\n> ${command} ${args.join(" ")}`);
    const proc = spawn(command, args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on("error", reject);
  });
}


function formatTimestamp(seconds: number): string {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${secs
    .toFixed(3)
    .padStart(6, "0")}`;
}

async function getDurationSeconds(videoPath: string): Promise<number | null> {
  return new Promise((resolve) => {
    const args = [
      "-v", "error",
      "-show_entries", "format=duration",
      "-of", "default=noprint_wrappers=1:nokey=1",
      videoPath,
    ];

    let output = "";
    const proc = spawn(FFPROBE_BIN, args, { stdio: ["ignore", "pipe", "ignore"] });
    proc.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code !== 0) {
        resolve(null);
        return;
      }

      const duration = Number.parseFloat(output.trim());
      resolve(Number.isFinite(duration) ? duration : null);
    });
    proc.on("error", () => resolve(null));
  });
}

async function extractThumbnail(videoPath: string, outPath: string, offsetSeconds: number = 5) {
  const args = [
    "-ss", formatTimestamp(offsetSeconds),
    "-i", videoPath,
    "-vframes", "1",
    "-update", "1",
    "-q:v", "2",
    "-vf", "scale=400:400:force_original_aspect_ratio=increase,crop=400:400", // Standardized square thumbnails
    "-y",
    outPath
  ];
  await runCommand(FFMPEG_BIN, args);
  console.log(`✅ Extracted thumbnail: ${outPath}`);
}

import { rm } from "fs/promises";

async function downloadCategoryOutputs(baseDir: string, type: string, category: string, query: string) {
  const outDir = join(baseDir, "assets", type, category);
  if (existsSync(outDir)) {
    await rm(outDir, { recursive: true, force: true });
  }
  await mkdir(outDir, { recursive: true });

  console.log(`\n=== Populating ${type}/${category} ===`);
  console.log(`Searching: ${query}`);
  
  const sourcePattern = join(outDir, `source_%(autonumber)s.%(ext)s`);
  
  const args = [
    "-i", // Ignore errors to skip blocked/bot-locked videos without crashing
    "--no-warnings",
    "--force-ipv4",
    "-f", "bestvideo[ext=mp4][height<=1080]+bestaudio[ext=m4a]/best[ext=mp4][height<=1080]/best",
    "--merge-output-format", "mp4",
    "-S", "vcodec:h264,res,acodec:m4a",
    "--download-sections", "*00:00:00-00:03:00",
    "--concurrent-fragments", "4",
    "-o", sourcePattern,
    "--no-playlist",
    query
  ];

  try {
    await runCommand(YTDLP_BIN, args);
  } catch (err) {
    console.error(`Failed to download ${category}:`, err);
    return;
  }

  // Iterate over all successfully downloaded source videos and slice them from 1:30 to 2:30
  const files = readdirSync(outDir).filter(f => f.startsWith("source_") && (f.endsWith(".mp4") || f.endsWith(".mkv") || f.endsWith(".webm")));
  files.sort();

  if (files.length === 0) {
    console.warn(`No videos downloaded for ${category}.`);
    return;
  }

  console.log(`\n🔪 Slicing exactly 1 minute variation clips for ${category}...`);
  let clipIndex = 1;
  for (const sourceFile of files) {
    const sourceVideo = join(outDir, sourceFile);
    const sourceDuration = await getDurationSeconds(sourceVideo);

    if (!sourceDuration || sourceDuration < 8) {
      console.warn(`Skipping ${sourceFile} in ${category}: video too short or unreadable.`);
      await rm(sourceVideo, { force: true });
      continue;
    }

    const clipDuration = Math.min(60, Math.max(8, Math.floor(sourceDuration - 1)));
    const maxStart = Math.max(0, sourceDuration - clipDuration - 0.25);
    const startSeconds = Math.min(90, maxStart);

    const clipName = join(outDir, `clip_${clipIndex}.mp4`);
    
    // -ss 00:01:30 to start at 1m30s
    // -t 60 for 60 seconds duration
    const sliceArgs = [
      "-ss", formatTimestamp(startSeconds),
      "-i", sourceVideo,
      "-t", String(clipDuration),
      "-c", "copy",
      clipName
    ];

    try {
      await runCommand(FFMPEG_BIN, sliceArgs);
      console.log(`✅ Sliced ${clipName} successfully.`);
      
      // Generate thumbnail directly for this distinct clip
      const thumbPath = join(outDir, `thumb_${clipIndex}.jpg`);
      const thumbnailOffset = Math.min(5, Math.max(0.5, clipDuration / 2));
      await extractThumbnail(clipName, thumbPath, thumbnailOffset);
      
      // Save the first clip's thumbnail as the primary poster for the whole category 
      if (clipIndex === 1) {
        await Bun.write(join(outDir, "thumbnail.jpg"), Bun.file(thumbPath));
      }
      
      // Delete the 3-minute source video to save disk space
      await rm(sourceVideo, { force: true });
      clipIndex++;
    } catch (err) {
      console.error(`Failed to slice/thumbnail ${sourceFile} in ${category}:`, err);
    }
  }
}

async function main() {
  console.log("Starting Advanced Auto-Asset Downloader...");
  const baseDir = process.cwd();

  // Optionally clean the current assets directory so we have a perfectly clean 7-video slate?
  // We'll just overwrite/add, but ideally it should be empty. We leave that to the user if they want to 'rm -rf assets/'.

  for (const [type, categories] of Object.entries(SEARCH_MAP)) {
    for (const [category, query] of Object.entries(categories)) {
      await downloadCategoryOutputs(baseDir, type, category, query);
    }
  }

  console.log("\n🎬 Assets download & thumbnail generation complete! Your library is ready for preview grids.");
}

main().catch(console.error);
