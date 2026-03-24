import type { PipelineStage, StageResult, PipelineRun, ClipProgressSnapshot } from "../pipeline/types";
import type { ResolvedJobOptions } from "../job-options/types";

export interface CheckpointStore {
  // Run management
  createQueuedRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun>;
  createImmediateRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun>;
  markRunRunning(runId: string): Promise<void>;
  markRunCompleted(runId: string): Promise<void>;
  markRunFailed(runId: string): Promise<void>;
  getRun(runId: string): Promise<PipelineRun | null>;
  listRuns(): Promise<PipelineRun[]>;
  getRunJobOptions(runId: string): Promise<ResolvedJobOptions | null>;

  // Stage management
  startStage(runId: string, stage: PipelineStage): Promise<void>;
  completeStage(runId: string, stage: PipelineStage, artifactPaths: string[], data: unknown): Promise<void>;
  failStage(runId: string, stage: PipelineStage, error: string): Promise<void>;
  getStageResult<T = unknown>(runId: string, stage: PipelineStage): Promise<StageResult<T> | null>;
  getStageResults(runId: string): Promise<StageResult[]>;
  getLastCompletedStage(runId: string): Promise<PipelineStage | null>;

  // Clip progress
  updateClipProgress(
    runId: string,
    clipId: string,
    clipIndex: number,
    stage: PipelineStage,
    status: string,
    artifactPaths: Record<string, string>,
  ): Promise<void>;
  getClipProgress(
    runId: string,
    clipId: string,
  ): Promise<{ stage: PipelineStage; status: string; artifactPaths: Record<string, string> } | null>;
  getClipProgressList(runId: string): Promise<ClipProgressSnapshot[]>;
  getCompletedClipIds(runId: string): Promise<string[]>;
  getIncompleteClipIds(runId: string): Promise<string[]>;

  // Lifecycle
  close(): Promise<void>;
}
