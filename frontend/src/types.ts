export type RunStatus = "queued" | "running" | "paused" | "completed" | "failed";

export type PipelineStage =
  | "DOWNLOAD"
  | "TRANSCRIBE"
  | "IDENTIFY_CLIPS"
  | "EXTRACT_CLIPS"
  | "REMOVE_SILENCE"
  | "GENERATE_CAPTIONS"
  | "COMPOSE_REEL";

export type StageStatus = "pending" | "in_progress" | "completed" | "failed" | "skipped";

// Caption styling types
export type CaptionPresetId =
  | "bold-box"
  | "clean-cinema"
  | "minimal-subtle"
  | "karaoke-pop"
  | "headline-top";

export type CaptionFontId =
  | "inter"
  | "roboto"
  | "poppins"
  | "bebas-neue"
  | "oswald"
  | "playfair"
  | "jetbrains-mono";

export type CaptionPosition = "top" | "middle" | "bottom" | "custom";

export type SplitScreenMode = "auto" | "never" | "always";

export type AspectPreset = "9:16" | "1:1" | "16:9";

export type TextCaseMode = "uppercase" | "lowercase" | "title-case" | "as-is";

export interface CaptionStyleConfig {
  presetId: CaptionPresetId;
  fontId: CaptionFontId;
  fontSizePx: number;
  activeColor: string;
  inactiveColor: string;
  textCase: TextCaseMode;
  position: CaptionPosition;
  customYPercent: number | null;
  maxWordsPerGroup: number;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  boxRadiusPx: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidthPx: number;
}

export interface OutputOptions {
  aspectPreset: AspectPreset;
  clipSpeed: number;
  splitScreenMode: SplitScreenMode;
}

export interface ClipSelectionOptions {
  maxClips: number;
}

export interface ResolvedJobOptions {
  captions: CaptionStyleConfig;
  output: OutputOptions;
  clipSelection: ClipSelectionOptions;
}

export interface JobOptions {
  captions?: Partial<CaptionStyleConfig>;
  output?: Partial<OutputOptions>;
  clipSelection?: Partial<ClipSelectionOptions>;
}

// Validation ranges
export interface ValidationRanges {
  fontSizePx: { min: number; max: number };
  maxWordsPerGroup: { min: number; max: number };
  boxOpacity: { min: number; max: number };
  boxRadiusPx: { min: number; max: number };
  strokeWidthPx: { min: number; max: number };
  customYPercent: { min: number; max: number };
  clipSpeed: { min: number; max: number };
  maxClips: { min: number; max: number };
}

export interface PipelineRun {
  id: string;
  videoUrl: string;
  videoId: string;
  videoTitle: string;
  createdAt: string;
  updatedAt: string;
  currentStage: PipelineStage;
  status: RunStatus;
}

export interface StageResult {
  stage: PipelineStage;
  status: StageStatus;
  startedAt: string;
  completedAt: string | null;
  artifactPaths: string[];
  data: unknown;
  error: string | null;
}

export interface ClipProgressSnapshot {
  clipId: string;
  clipIndex: number;
  currentStage: PipelineStage;
  status: string;
  artifactPaths: Record<string, string>;
  updatedAt: string;
}

export interface ClipCandidate {
  id: string;
  title: string;
  hookLine: string;
  startTime: number;
  endTime: number;
  duration: number;
  reasoning: string;
  viralScore: number;
  tags: string[];
}

export interface AppSummary {
  stats: {
    totalRuns: number;
    queuedRuns: number;
    runningRuns: number;
    completedRuns: number;
    failedRuns: number;
  };
  recentRuns: PipelineRun[];
  readyOutputs: ReadyOutput[];
  queueHealth: QueueHealth;
  workerHealth: WorkerHealth;
}

export interface ReadyOutput {
  runId: string;
  videoTitle: string;
  clipId: string;
  clipTitle: string;
  hookLine: string;
  duration: number;
  finalReelPath: string;
  createdAt: string;
  // Real clip metadata from pipeline
  startTime?: number;
  endTime?: number;
  transcript?: string;
  viralityScore?: number;
}

export interface QueueHealth {
  queuedCount: number;
  runningCount: number;
  hasQueuedWithoutWorker: boolean;
}

export interface WorkerHealth {
  connected: boolean;
  mode: "local" | "cloud";
}

export interface CreateJobRequest {
  videoUrl: string;
  options?: JobOptions;
}

export interface CreateJobResponse {
  runId: string;
  status: RunStatus;
}

export interface RunDetail {
  run: PipelineRun;
  stages: StageResult[];
  clipProgress: ClipProgressSnapshot[];
  finalReels: string[];
  clips?: ClipCandidate[];
  jobOptions?: ResolvedJobOptions;
}

export interface LibraryGroup {
  videoId: string;
  videoTitle: string;
  clipCount: number;
  clips: LibraryClip[];
}

export interface LibraryClip {
  clipId: string;
  title: string;
  hookLine: string;
  duration: number;
  finalReelPath: string;
  createdAt: string;
}

export interface QueueStatus {
  queuedCount: number;
  runningCount: number;
  workerMode: "local" | "cloud";
  workerConnected: boolean;
  recentFailures: QueueFailure[];
}

export interface QueueFailure {
  runId: string;
  error: string;
  failedAt: string;
}

// Capabilities for UI dropdowns
export interface Capabilities {
  captionPresets: CaptionPresetId[];
  fonts: CaptionFontId[];
  positions: CaptionPosition[];
  splitScreenModes: SplitScreenMode[];
  aspectPresets: AspectPreset[];
  textCases: TextCaseMode[];
}

// New settings format with creator defaults
export interface Settings {
  creatorDefaults: ResolvedJobOptions;
  capabilities: Capabilities;
  validation: ValidationRanges;
  environment: {
    appMode: "local" | "cloud";
    checkpointBackend: string;
    queueBackend: string;
    artifactBackend: string;
  };
}

export interface SystemHealth {
  status: "healthy" | "degraded" | "unhealthy";
  checks: {
    checkpoint: boolean;
    queue: boolean;
    geminiApi: boolean;
    worker: boolean;
    dependencies: boolean;
    ffmpeg: boolean;
    ytDlp: boolean;
    python3: boolean;
    zip: boolean;
    whisperCli: boolean;
  };
  message?: string;
}
