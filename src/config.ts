import { z } from "zod";

export type AppMode = "local" | "cloud";
export type CheckpointBackend = "sqlite" | "postgres";
export type QueueBackend = "sqlite" | "sqs";
export type ArtifactBackend = "local" | "s3";
export type UserTier = "free" | "pro";

const configSchema = z.object({
  // Core settings
  geminiApiKey: z.string().min(1),
  whisperModel: z.enum(["tiny", "base", "small", "medium", "large"]).default("base"),
  maxParallelClips: z.coerce.number().int().min(1).max(10).default(3),
  silenceThresholdDb: z.coerce.number().default(-35),
  silenceMinDuration: z.coerce.number().default(0.8),
  outputWidth: z.coerce.number().default(1080),
  outputHeight: z.coerce.number().default(1920),
  clipSpeed: z.coerce.number().min(1).max(2).default(1.2),
  maxClips: z.coerce.number().int().min(0).default(0),
  preferYouTubeTranscripts: z.coerce.boolean().default(true),
  captionAnimate: z.coerce.boolean().default(true),

  // Mode and provider settings
  appMode: z.enum(["local", "cloud"]).default("local"),
  checkpointBackend: z.enum(["sqlite", "postgres"]).optional(),
  queueBackend: z.enum(["sqlite", "sqs"]).optional(),
  artifactBackend: z.enum(["local", "s3"]).optional(),

  // Cloud provider settings
  databaseUrl: z.string().optional(),
  awsRegion: z.string().optional(),
  s3Bucket: z.string().optional(),
  sqsQueueUrl: z.string().optional(),

  // Worker settings
  workerConcurrency: z.coerce.number().int().min(1).default(1),
  workerPollIntervalMs: z.coerce.number().int().min(100).default(2000),
  workerTempDir: z.string().optional(),

  // Downloader cookie settings
  ytdlpUseBrowserCookies: z.coerce.boolean().optional(),
  ytdlpBrowser: z.string().default("chrome"),
  ytdlpCookiesFile: z.string().optional(),
  ytdlpRetryAttempts: z.coerce.number().int().min(1).max(12).default(6),
  ytdlpRetryBaseDelayMs: z.coerce.number().int().min(100).max(60000).default(1500),
  ytdlpUseIpv4: z.coerce.boolean().default(true),
  ytdlpProxyUrls: z.string().optional(),

  // Paths
  paths: z
    .object({
      data: z.string().default("./data"),
      output: z.string().default("./output"),
      assets: z.string().default("./assets"),
      brainrotAssets: z.string().default("./assets/brainrot"),
      brollAssets: z.string().default("./assets/broll"),
      checkpointDb: z.string().default("./data/checkpoints.db"),
    })
    .default({}),

  // Web server settings
  port: z.coerce.number().int().default(3000),
  appUrl: z.string().default("http://localhost:3000"),

  // Auth settings
  jwtSecret: z.string().optional(),
  defaultUserTier: z.enum(["free", "pro"]).default("free"),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const rawConfig = {
    geminiApiKey: Bun.env.GEMINI_API_KEY,
    whisperModel: Bun.env.WHISPER_MODEL,
    maxParallelClips: Bun.env.MAX_PARALLEL_CLIPS,
    silenceThresholdDb: Bun.env.SILENCE_THRESHOLD_DB,
    silenceMinDuration: Bun.env.SILENCE_MIN_DURATION,
    outputWidth: Bun.env.OUTPUT_WIDTH,
    outputHeight: Bun.env.OUTPUT_HEIGHT,
    clipSpeed: Bun.env.CLIP_SPEED,
    maxClips: Bun.env.MAX_CLIPS,
    preferYouTubeTranscripts: Bun.env.PREFER_YOUTUBE_TRANSCRIPTS,
    captionAnimate: Bun.env.CAPTION_ANIMATE,

    appMode: Bun.env.APP_MODE,
    checkpointBackend: Bun.env.CHECKPOINT_BACKEND,
    queueBackend: Bun.env.QUEUE_BACKEND,
    artifactBackend: Bun.env.ARTIFACT_BACKEND,

    databaseUrl: Bun.env.DATABASE_URL,
    awsRegion: Bun.env.AWS_REGION,
    s3Bucket: Bun.env.S3_BUCKET,
    sqsQueueUrl: Bun.env.SQS_QUEUE_URL,

    workerConcurrency: Bun.env.WORKER_CONCURRENCY,
    workerPollIntervalMs: Bun.env.WORKER_POLL_INTERVAL_MS,
    workerTempDir: Bun.env.WORKER_TEMP_DIR,

    ytdlpUseBrowserCookies: Bun.env.YTDLP_USE_BROWSER_COOKIES,
    ytdlpBrowser: Bun.env.YTDLP_BROWSER,
    ytdlpCookiesFile: Bun.env.YTDLP_COOKIES_FILE,
    ytdlpRetryAttempts: Bun.env.YTDLP_RETRY_ATTEMPTS,
    ytdlpRetryBaseDelayMs: Bun.env.YTDLP_RETRY_BASE_DELAY_MS,
    ytdlpUseIpv4: Bun.env.YTDLP_USE_IPV4,
    ytdlpProxyUrls: Bun.env.YTDLP_PROXY_URLS,

    paths: {},
    port: Bun.env.PORT,
    appUrl: Bun.env.APP_URL,

    jwtSecret: Bun.env.JWT_SECRET,
    defaultUserTier: Bun.env.DEFAULT_USER_TIER,
  };

  const config = configSchema.parse(rawConfig);

  // Derive backend defaults from appMode if not explicitly set
  const finalConfig = {
    ...config,
    checkpointBackend: config.checkpointBackend ?? (config.appMode === "cloud" ? "postgres" : "sqlite"),
    queueBackend: config.queueBackend ?? (config.appMode === "cloud" ? "sqs" : "sqlite"),
    artifactBackend: config.artifactBackend ?? (config.appMode === "cloud" ? "s3" : "local"),
    workerTempDir: config.workerTempDir ?? (config.appMode === "cloud" ? "/tmp/clipity" : "./data/worker-tmp"),
    // Local mode defaults to browser cookies if not explicitly set
    ytdlpUseBrowserCookies: config.ytdlpUseBrowserCookies ?? (config.appMode === "local"),
  };

  return finalConfig;
}

export function validateCloudConfig(config: Config): void {
  if (config.appMode === "cloud") {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL is required in cloud mode");
    }
    if (!config.awsRegion) {
      throw new Error("AWS_REGION is required in cloud mode");
    }
    if (!config.s3Bucket) {
      throw new Error("S3_BUCKET is required in cloud mode");
    }
    if (!config.sqsQueueUrl) {
      throw new Error("SQS_QUEUE_URL is required in cloud mode");
    }
  }
}
