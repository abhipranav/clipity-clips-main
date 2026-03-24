import postgres from "postgres";
import { PipelineStage, StageStatus, type PipelineRun, type StageResult, type ClipProgressSnapshot } from "../pipeline/types";
import type { CheckpointStore } from "./checkpoint";
import type { ResolvedJobOptions } from "../job-options/types";

// Use postgres sql function for connections
type Sql = ReturnType<typeof postgres>;

interface PipelineRunRow {
  id: string;
  video_url: string;
  video_id: string;
  video_title: string;
  status: string;
  current_stage: string;
  job_options_json: string | null;
  created_at: string;
  updated_at: string;
}

interface StageResultRow {
  stage: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  artifact_paths: string;
  data: string;
  error: string | null;
}

interface ClipProgressRow {
  id: string;
  run_id: string;
  clip_index: number;
  current_stage: string;
  status: string;
  artifact_paths: string;
  updated_at: string;
}

export class PostgresCheckpointStore implements CheckpointStore {
  private sql: Sql;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 10 });
    this.ready = this.migrate();
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private async migrate(): Promise<void> {
    // Pipeline runs table
    await this.sql`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY,
        video_url TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued',
        current_stage TEXT NOT NULL DEFAULT 'DOWNLOAD',
        job_options_json TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `;

    // Stage results table
    await this.sql`
      CREATE TABLE IF NOT EXISTS stage_results (
        id SERIAL PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        artifact_paths TEXT NOT NULL DEFAULT '[]',
        data TEXT NOT NULL DEFAULT '{}',
        error TEXT,
        started_at TIMESTAMP NOT NULL,
        completed_at TIMESTAMP,
        UNIQUE(run_id, stage)
      )
    `;

    // Clip progress table
    await this.sql`
      CREATE TABLE IF NOT EXISTS clip_progress (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        clip_index INTEGER NOT NULL,
        current_stage TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        artifact_paths TEXT NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP NOT NULL
      )
    `;

    // Queue table for Postgres queue implementation
    await this.sql`
      CREATE TABLE IF NOT EXISTS queued_runs (
        run_id TEXT PRIMARY KEY REFERENCES pipeline_runs(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TIMESTAMP NOT NULL,
        claimed_at TIMESTAMP,
        last_error TEXT,
        created_at TIMESTAMP NOT NULL
      )
    `;

    // Indexes
    await this.sql`CREATE INDEX IF NOT EXISTS idx_runs_status ON pipeline_runs(status)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_runs_created ON pipeline_runs(created_at DESC)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_stage_results_run ON stage_results(run_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_clip_progress_run ON clip_progress(run_id)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_queued_runs_status ON queued_runs(status)`;
    await this.sql`CREATE INDEX IF NOT EXISTS idx_queued_runs_available ON queued_runs(available_at)`;
  }

  private now(): string {
    return new Date().toISOString();
  }

  async createQueuedRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun> {
    await this.ensureReady();
    const id = crypto.randomUUID();
    const now = this.now();
    const jobOptionsJson = jobOptions ? JSON.stringify(jobOptions) : null;

    await this.sql`
      INSERT INTO pipeline_runs (id, video_url, video_id, video_title, status, current_stage, job_options_json, created_at, updated_at)
      VALUES (${id}, ${videoUrl}, ${videoId}, ${videoTitle}, 'queued', 'DOWNLOAD', ${jobOptionsJson}, ${now}, ${now})
    `;

    return {
      id,
      videoUrl,
      videoId,
      videoTitle,
      status: "queued",
      currentStage: PipelineStage.DOWNLOAD,
      createdAt: now,
      updatedAt: now,
    };
  }

  async createImmediateRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun> {
    await this.ensureReady();
    const id = crypto.randomUUID();
    const now = this.now();
    const jobOptionsJson = jobOptions ? JSON.stringify(jobOptions) : null;

    await this.sql`
      INSERT INTO pipeline_runs (id, video_url, video_id, video_title, status, current_stage, job_options_json, created_at, updated_at)
      VALUES (${id}, ${videoUrl}, ${videoId}, ${videoTitle}, 'running', 'DOWNLOAD', ${jobOptionsJson}, ${now}, ${now})
    `;

    return {
      id,
      videoUrl,
      videoId,
      videoTitle,
      status: "running",
      currentStage: PipelineStage.DOWNLOAD,
      createdAt: now,
      updatedAt: now,
    };
  }

  async markRunRunning(runId: string): Promise<void> {
    await this.ensureReady();
    await this.sql`
      UPDATE pipeline_runs SET status = 'running', updated_at = ${this.now()} WHERE id = ${runId}
    `;
  }

  async markRunCompleted(runId: string): Promise<void> {
    await this.ensureReady();
    await this.sql`
      UPDATE pipeline_runs SET status = 'completed', updated_at = ${this.now()} WHERE id = ${runId}
    `;
  }

  async markRunFailed(runId: string): Promise<void> {
    await this.ensureReady();
    await this.sql`
      UPDATE pipeline_runs SET status = 'failed', updated_at = ${this.now()} WHERE id = ${runId}
    `;
  }

  async getRun(runId: string): Promise<PipelineRun | null> {
    await this.ensureReady();
    const result = await this.sql<PipelineRunRow[]>`
      SELECT * FROM pipeline_runs WHERE id = ${runId}
    `;
    return result.length > 0 ? this.rowToRun(result[0]) : null;
  }

  async getRunJobOptions(runId: string): Promise<ResolvedJobOptions | null> {
    await this.ensureReady();
    const result = await this.sql<{ job_options_json: string | null }[]>`
      SELECT job_options_json FROM pipeline_runs WHERE id = ${runId}
    `;
    if (result.length === 0 || !result[0].job_options_json) {
      return null;
    }
    try {
      return JSON.parse(result[0].job_options_json) as ResolvedJobOptions;
    } catch {
      return null;
    }
  }

  async listRuns(): Promise<PipelineRun[]> {
    await this.ensureReady();
    const result = await this.sql<PipelineRunRow[]>`
      SELECT * FROM pipeline_runs ORDER BY created_at DESC
    `;
    return result.map((r) => this.rowToRun(r));
  }

  private rowToRun(row: PipelineRunRow): PipelineRun {
    return {
      id: row.id,
      videoUrl: row.video_url,
      videoId: row.video_id,
      videoTitle: row.video_title,
      status: row.status as PipelineRun["status"],
      currentStage: row.current_stage as PipelineStage,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async startStage(runId: string, stage: PipelineStage): Promise<void> {
    await this.ensureReady();
    const now = this.now();
    await this.sql`
      INSERT INTO stage_results (run_id, stage, status, started_at)
      VALUES (${runId}, ${stage}, 'in_progress', ${now})
      ON CONFLICT (run_id, stage) DO UPDATE SET status = 'in_progress', started_at = ${now}, completed_at = NULL
    `;
    await this.sql`
      UPDATE pipeline_runs SET current_stage = ${stage}, updated_at = ${now} WHERE id = ${runId}
    `;
  }

  async completeStage(runId: string, stage: PipelineStage, artifactPaths: string[], data: unknown): Promise<void> {
    await this.ensureReady();
    const now = this.now();
    await this.sql`
      UPDATE stage_results 
      SET status = 'completed', artifact_paths = ${JSON.stringify(artifactPaths)}, data = ${JSON.stringify(data)}, completed_at = ${now}
      WHERE run_id = ${runId} AND stage = ${stage}
    `;
    await this.sql`
      UPDATE pipeline_runs SET updated_at = ${now} WHERE id = ${runId}
    `;
  }

  async failStage(runId: string, stage: PipelineStage, error: string): Promise<void> {
    await this.ensureReady();
    const now = this.now();
    await this.sql`
      UPDATE stage_results 
      SET status = 'failed', error = ${error}, completed_at = ${now}
      WHERE run_id = ${runId} AND stage = ${stage}
    `;
    await this.sql`
      UPDATE pipeline_runs SET status = 'failed', updated_at = ${now} WHERE id = ${runId}
    `;
  }

  async getStageResult<T = unknown>(runId: string, stage: PipelineStage): Promise<StageResult<T> | null> {
    await this.ensureReady();
    const result = await this.sql<StageResultRow[]>`
      SELECT * FROM stage_results WHERE run_id = ${runId} AND stage = ${stage}
    `;
    if (result.length === 0) return null;
    return this.rowToStageResult(result[0]) as StageResult<T>;
  }

  async getStageResults(runId: string): Promise<StageResult[]> {
    await this.ensureReady();
    const result = await this.sql<StageResultRow[]>`
      SELECT * FROM stage_results WHERE run_id = ${runId} ORDER BY id ASC
    `;
    return result.map((r) => this.rowToStageResult(r));
  }

  private rowToStageResult(row: StageResultRow): StageResult {
    return {
      stage: row.stage as PipelineStage,
      status: row.status as StageStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      artifactPaths: JSON.parse(row.artifact_paths),
      data: JSON.parse(row.data),
      error: row.error,
    };
  }

  async getLastCompletedStage(runId: string): Promise<PipelineStage | null> {
    await this.ensureReady();
    const stages = Object.values(PipelineStage);
    for (let i = stages.length - 1; i >= 0; i--) {
      const result = await this.getStageResult(runId, stages[i]);
      if (result?.status === StageStatus.COMPLETED) return stages[i];
    }
    return null;
  }

  async updateClipProgress(
    runId: string,
    clipId: string,
    clipIndex: number,
    stage: PipelineStage,
    status: string,
    artifactPaths: Record<string, string>,
  ): Promise<void> {
    await this.ensureReady();
    const now = this.now();
    await this.sql`
      INSERT INTO clip_progress (id, run_id, clip_index, current_stage, status, artifact_paths, updated_at)
      VALUES (${clipId}, ${runId}, ${clipIndex}, ${stage}, ${status}, ${JSON.stringify(artifactPaths)}, ${now})
      ON CONFLICT (id) DO UPDATE SET 
        current_stage = ${stage}, status = ${status}, artifact_paths = ${JSON.stringify(artifactPaths)}, updated_at = ${now}
    `;
  }

  async getClipProgress(
    runId: string,
    clipId: string,
  ): Promise<{ stage: PipelineStage; status: string; artifactPaths: Record<string, string> } | null> {
    await this.ensureReady();
    const result = await this.sql<ClipProgressRow[]>`
      SELECT * FROM clip_progress WHERE id = ${clipId} AND run_id = ${runId}
    `;
    if (result.length === 0) return null;
    const row = result[0];
    return {
      stage: row.current_stage as PipelineStage,
      status: row.status,
      artifactPaths: JSON.parse(row.artifact_paths),
    };
  }

  async getClipProgressList(runId: string): Promise<ClipProgressSnapshot[]> {
    await this.ensureReady();
    const result = await this.sql<ClipProgressRow[]>`
      SELECT * FROM clip_progress WHERE run_id = ${runId} ORDER BY clip_index ASC
    `;
    return result.map((row) => ({
      clipId: row.id,
      clipIndex: row.clip_index,
      currentStage: row.current_stage as PipelineStage,
      status: row.status,
      artifactPaths: JSON.parse(row.artifact_paths),
      updatedAt: row.updated_at,
    }));
  }

  async getCompletedClipIds(runId: string): Promise<string[]> {
    await this.ensureReady();
    const result = await this.sql<{ id: string }[]>`
      SELECT id FROM clip_progress WHERE run_id = ${runId} AND status = 'completed'
    `;
    return result.map((r) => r.id);
  }

  async getIncompleteClipIds(runId: string): Promise<string[]> {
    await this.ensureReady();
    const result = await this.sql<{ id: string }[]>`
      SELECT id FROM clip_progress WHERE run_id = ${runId} AND status != 'completed'
    `;
    return result.map((r) => r.id);
  }

  async close(): Promise<void> {
    await this.sql.end();
  }
}
