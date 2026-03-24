import { createLogger } from "../utils/logger";
import { ensureDir } from "../utils/fs";
import { join } from "path";
import type { VideoMetadata } from "../pipeline/types";
import type { Config } from "../config";

const log = createLogger("downloader");

export class Downloader {
  private config: Config;

  constructor(config?: Config) {
    // Provide defaults for backwards compatibility
    this.config = config ?? {
      ytdlpUseBrowserCookies: false,
      ytdlpBrowser: "chrome",
      ytdlpCookiesFile: undefined,
    } as Config;
  }

  private buildCookieArgs(): string[] {
    const args: string[] = [];

    // Only use browser cookies if explicitly enabled
    if (this.config.ytdlpUseBrowserCookies) {
      args.push("--cookies-from-browser", this.config.ytdlpBrowser);
    }

    // Use cookies file if provided (takes precedence)
    if (this.config.ytdlpCookiesFile) {
      args.push("--cookies", this.config.ytdlpCookiesFile);
    }

    return args;
  }

  async download(videoUrl: string, outputDir: string): Promise<VideoMetadata> {
    ensureDir(outputDir);
    log.info(`Fetching metadata for ${videoUrl}`);

    const cookieArgs = this.buildCookieArgs();
    const metaArgs = ["yt-dlp", ...cookieArgs, "--dump-json", "--no-download", videoUrl];

    const metaProc = Bun.spawn(metaArgs, {
      stdout: "pipe",
      stderr: "pipe",
    });
    const metaJson = await new Response(metaProc.stdout).text();
    const metaErr = await new Response(metaProc.stderr).text();
    const metaExit = await metaProc.exited;
    if (metaExit !== 0) throw new Error(`yt-dlp metadata failed: ${metaErr}`);

    const meta = JSON.parse(metaJson);
    const videoId = meta.id as string;
    const title = (meta.title as string) || "untitled";
    const duration = (meta.duration as number) || 0;
    const uploadDate = (meta.upload_date as string) || "";

    const outputPath = join(outputDir, `${videoId}.mp4`);

    if (await Bun.file(outputPath).exists()) {
      log.info(`Video already downloaded: ${outputPath}`);
      return { videoId, title, duration, uploadDate, filePath: outputPath };
    }

    log.info(`Downloading: ${title} (${Math.round(duration / 60)} min)`);

    const dlArgs = [
      "yt-dlp",
      ...cookieArgs,
      "-f",
      "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      "--remux-video",
      "mp4",
      "-o",
      outputPath,
      "--no-playlist",
      videoUrl,
    ];

    const dlProc = Bun.spawn(dlArgs, {
      stdout: "inherit",
      stderr: "inherit",
    });
    const dlExit = await dlProc.exited;
    if (dlExit !== 0) throw new Error(`yt-dlp download failed with exit code ${dlExit}`);

    if (!(await Bun.file(outputPath).exists())) {
      throw new Error(`Download completed but file not found: ${outputPath}`);
    }

    log.info(`Downloaded: ${outputPath}`);
    return { videoId, title, duration, uploadDate, filePath: outputPath };
  }

  async listChannelVideos(channelUrl: string, limit?: number): Promise<string[]> {
    log.info(`Fetching video list from channel: ${channelUrl}`);
    const cookieArgs = this.buildCookieArgs();
    const args = ["yt-dlp", ...cookieArgs, "--flat-playlist", "--dump-json", "--no-download"];
    if (limit) args.push("--playlist-end", String(limit));
    args.push(channelUrl);

    const proc = Bun.spawn(args, { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;

    const urls: string[] = [];
    for (const line of stdout.trim().split("\n")) {
      if (!line) continue;
      try {
        const entry = JSON.parse(line) as { id?: string; url?: string };
        const id = entry.id || entry.url;
        if (id) urls.push(`https://www.youtube.com/watch?v=${id}`);
      } catch {
        // skip malformed lines
      }
    }

    log.info(`Found ${urls.length} videos`);
    return urls;
  }
}
