import { join } from "path";

import type { Config } from "../config";
import type { VideoMetadata } from "../pipeline/types";
import { ensureDir } from "../utils/fs";
import { createLogger } from "../utils/logger";

const log = createLogger("downloader");

interface YtDlpProfile {
  name: string;
  extractorArgs: string[];
  format: string;
}

interface YtDlpRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function isLikelyYouTubeBotCheck(stderr: string): boolean {
  const normalized = stderr.toLowerCase();
  return normalized.includes("sign in to confirm you're not a bot") || normalized.includes("precondition check failed");
}

export class Downloader {
  private config: Config;

  constructor(config?: Config) {
    // Provide defaults for backwards compatibility
    this.config = config ?? {
      ytdlpUseBrowserCookies: false,
      ytdlpBrowser: "chrome",
      ytdlpCookiesFile: undefined,
      ytdlpRetryAttempts: 6,
      ytdlpRetryBaseDelayMs: 1500,
      ytdlpUseIpv4: true,
      ytdlpProxyUrls: undefined,
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

  private parseProxyList(): string[] {
    const raw = this.config.ytdlpProxyUrls?.trim();
    if (!raw) {
      return [];
    }

    return raw
      .split(",")
      .map((proxy) => proxy.trim())
      .filter((proxy) => proxy.length > 0);
  }

  private buildTransportArgs(attemptIndex: number): string[] {
    const args: string[] = [
      "--retries",
      "4",
      "--extractor-retries",
      "4",
      "--fragment-retries",
      "4",
      "--socket-timeout",
      "20",
      "--sleep-requests",
      "1",
    ];

    if (this.config.ytdlpUseIpv4) {
      args.push("--force-ipv4");
    }

    const proxies = this.parseProxyList();
    if (proxies.length > 0) {
      const proxy = proxies[attemptIndex % proxies.length];
      args.push("--proxy", proxy);
      log.info(`Using yt-dlp proxy ${proxy} (attempt ${attemptIndex + 1})`);
    }

    return args;
  }

  private buildProfiles(): YtDlpProfile[] {
    return [
      {
        name: "default",
        extractorArgs: [],
        format: "bestvideo[height<=1080]+bestaudio/best[height<=1080]",
      },
      {
        name: "android",
        extractorArgs: ["--extractor-args", "youtube:player_client=android"],
        format: "best[height<=1080]/best",
      },
      {
        name: "web_safari",
        extractorArgs: ["--extractor-args", "youtube:player_client=web_safari"],
        format: "best[height<=1080]/best",
      },
      {
        name: "tv_embedded",
        extractorArgs: ["--extractor-args", "youtube:player_client=tv_embedded"],
        format: "best[height<=1080]/best",
      },
    ];
  }

  private async runYtDlp(args: string[]): Promise<YtDlpRunResult> {
    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    return { exitCode, stdout, stderr };
  }

  private async runWithFallback(
    purpose: string,
    buildArgs: (profile: YtDlpProfile, attemptIndex: number) => string[],
  ): Promise<YtDlpRunResult> {
    const profiles = this.buildProfiles();
    const maxAttempts = this.config.ytdlpRetryAttempts;
    const baseDelay = this.config.ytdlpRetryBaseDelayMs;

    let lastResult: YtDlpRunResult | null = null;

    for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
      const profile = profiles[attemptIndex % profiles.length];
      const args = buildArgs(profile, attemptIndex);

      log.info(`yt-dlp ${purpose} attempt ${attemptIndex + 1}/${maxAttempts} (${profile.name})`);
      const result = await this.runYtDlp(args);

      if (result.exitCode === 0) {
        return result;
      }

      lastResult = result;
      const stderrTail = result.stderr.trim().split("\n").slice(-4).join(" | ");
      log.warn(`yt-dlp ${purpose} failed (${profile.name}): ${stderrTail || `exit ${result.exitCode}`}`);

      if (attemptIndex < maxAttempts - 1) {
        const backoffMs = baseDelay * (attemptIndex + 1);
        await Bun.sleep(backoffMs);
      }
    }

    if (!lastResult) {
      throw new Error(`yt-dlp ${purpose} failed before running any attempts`);
    }

    if (isLikelyYouTubeBotCheck(lastResult.stderr)) {
      throw new Error(
        `yt-dlp ${purpose} blocked by YouTube bot checks after ${maxAttempts} attempts. Configure YTDLP_PROXY_URLS (recommended) or enable cookies as fallback. Last error: ${lastResult.stderr}`,
      );
    }

    throw new Error(`yt-dlp ${purpose} failed after ${maxAttempts} attempts: ${lastResult.stderr}`);
  }

  async download(videoUrl: string, outputDir: string): Promise<VideoMetadata> {
    ensureDir(outputDir);
    log.info(`Fetching metadata for ${videoUrl}`);

    const cookieArgs = this.buildCookieArgs();
    const metaResult = await this.runWithFallback("metadata", (profile, attemptIndex) => [
      "yt-dlp",
      ...cookieArgs,
      ...this.buildTransportArgs(attemptIndex),
      ...profile.extractorArgs,
      "--dump-json",
      "--no-download",
      "--no-playlist",
      videoUrl,
    ]);

    const metaJson = metaResult.stdout;

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

    await this.runWithFallback("download", (profile, attemptIndex) => [
      "yt-dlp",
      ...cookieArgs,
      ...this.buildTransportArgs(attemptIndex),
      ...profile.extractorArgs,
      "-f",
      profile.format,
      "--remux-video",
      "mp4",
      "-o",
      outputPath,
      "--no-playlist",
      videoUrl,
    ]);

    if (!(await Bun.file(outputPath).exists())) {
      throw new Error(`Download completed but file not found: ${outputPath}`);
    }

    log.info(`Downloaded: ${outputPath}`);
    return { videoId, title, duration, uploadDate, filePath: outputPath };
  }

  async listChannelVideos(channelUrl: string, limit?: number): Promise<string[]> {
    log.info(`Fetching video list from channel: ${channelUrl}`);
    const cookieArgs = this.buildCookieArgs();
    const result = await this.runWithFallback("playlist", (profile, attemptIndex) => {
      const args = [
        "yt-dlp",
        ...cookieArgs,
        ...this.buildTransportArgs(attemptIndex),
        ...profile.extractorArgs,
        "--flat-playlist",
        "--dump-json",
        "--no-download",
      ];
      if (limit) {
        args.push("--playlist-end", String(limit));
      }
      args.push(channelUrl);
      return args;
    });

    const stdout = result.stdout;

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
