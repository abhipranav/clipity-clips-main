import { Database } from "bun:sqlite";
import { PipelineStage, StageStatus, type PipelineRun, type StageResult, type ClipProgressSnapshot } from "../pipeline/types";
import type { CheckpointStore } from "./checkpoint";
import type { ResolvedJobOptions } from "../job-options/types";
import { DEFAULT_RESOLVED_OPTIONS } from "../job-options/types";

interface ClipProgressRow {
  id: string;
  run_id: string;
  clip_index: number;
  current_stage: string;
  status: string;
  artifact_paths: string;
  updated_at: string;
}

export class SqliteCheckpointStore implements CheckpointStore {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS pipeline_runs (
        id TEXT PRIMARY KEY,
        video_url TEXT NOT NULL,
        video_id TEXT NOT NULL,
        video_title TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'queued',
        current_stage TEXT NOT NULL DEFAULT 'DOWNLOAD',
        job_options_json TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stage_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        status TEXT NOT NULL,
        artifact_paths TEXT NOT NULL DEFAULT '[]',
        data TEXT NOT NULL DEFAULT '{}',
        error TEXT,
        started_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id),
        UNIQUE(run_id, stage)
      );

      CREATE TABLE IF NOT EXISTS clip_progress (
        id TEXT PRIMARY KEY,
        run_id TEXT NOT NULL,
        clip_index INTEGER NOT NULL,
        current_stage TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        artifact_paths TEXT NOT NULL DEFAULT '{}',
        updated_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
      );

      -- Queue table for local SQLite queue implementation
      CREATE TABLE IF NOT EXISTS queued_runs (
        run_id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'queued',
        attempts INTEGER NOT NULL DEFAULT 0,
        available_at TEXT NOT NULL,
        claimed_at TEXT,
        last_error TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (run_id) REFERENCES pipeline_runs(id)
      );
    `);
  }

  async createQueuedRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const jobOptionsJson = jobOptions ? JSON.stringify(jobOptions) : null;
    this.db
      .prepare(
        `INSERT INTO pipeline_runs (id, video_url, video_id, video_title, status, current_stage, job_options_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'queued', 'DOWNLOAD', ?, ?, ?)`,
      )
      .run(id, videoUrl, videoId, videoTitle, jobOptionsJson, now, now);
    return {
      id,
      videoUrl,
      videoId,
      videoTitle,
      createdAt: now,
      updatedAt: now,
      currentStage: PipelineStage.DOWNLOAD,
      status: "queued",
    };
  }

  async createImmediateRun(videoUrl: string, videoId: string, videoTitle: string, jobOptions?: ResolvedJobOptions): Promise<PipelineRun> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const jobOptionsJson = jobOptions ? JSON.stringify(jobOptions) : null;
    this.db
      .prepare(
        `INSERT INTO pipeline_runs (id, video_url, video_id, video_title, status, current_stage, job_options_json, created_at, updated_at) VALUES (?, ?, ?, ?, 'running', 'DOWNLOAD', ?, ?, ?)`,
      )
      .run(id, videoUrl, videoId, videoTitle, jobOptionsJson, now, now);
    return {
      id,
      videoUrl,
      videoId,
      videoTitle,
      createdAt: now,
      updatedAt: now,
      currentStage: PipelineStage.DOWNLOAD,
      status: "running",
    };
  }

  async markRunRunning(runId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE pipeline_runs SET status = 'running', updated_at = ? WHERE id = ?")
      .run(now, runId);
  }

  async markRunCompleted(runId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE pipeline_runs SET status = 'completed', updated_at = ? WHERE id = ?")
      .run(now, runId);
  }

  async markRunFailed(runId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE pipeline_runs SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(now, runId);
  }

  async getRun(runId: string): Promise<PipelineRun | null> {
    const row = this.db.prepare("SELECT * FROM pipeline_runs WHERE id = ?").get(runId) as any;
    if (!row) return null;
    return {
      id: row.id,
      videoUrl: row.video_url,
      videoId: row.video_id,
      videoTitle: row.video_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentStage: row.current_stage as PipelineStage,
      status: row.status,
    };
  }

  async getRunJobOptions(runId: string): Promise<ResolvedJobOptions | null> {
    const row = this.db.prepare("SELECT job_options_json FROM pipeline_runs WHERE id = ?").get(runId) as { job_options_json: string | null } | undefined;
    if (!row?.job_options_json) {
      return null;
    }
    try {
      return JSON.parse(row.job_options_json) as ResolvedJobOptions;
    } catch {
      return null;
    }
  }

  async listRuns(): Promise<PipelineRun[]> {
    const rows = this.db
      .prepare("SELECT * FROM pipeline_runs ORDER BY created_at DESC")
      .all() as any[];
    return rows.map((row) => ({
      id: row.id,
      videoUrl: row.video_url,
      videoId: row.video_id,
      videoTitle: row.video_title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentStage: row.current_stage as PipelineStage,
      status: row.status,
    }));
  }

  async startStage(runId: string, stage: PipelineStage): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO stage_results (run_id, stage, status, started_at) VALUES (?, ?, 'in_progress', ?)`,
      )
      .run(runId, stage, now);
    this.db
      .prepare("UPDATE pipeline_runs SET current_stage = ?, updated_at = ? WHERE id = ?")
      .run(stage, now, runId);
  }

  async completeStage(runId: string, stage: PipelineStage, artifactPaths: string[], data: unknown): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE stage_results SET status = 'completed', artifact_paths = ?, data = ?, completed_at = ? WHERE run_id = ? AND stage = ?`,
      )
      .run(JSON.stringify(artifactPaths), JSON.stringify(data), now, runId, stage);
    this.db.prepare("UPDATE pipeline_runs SET updated_at = ? WHERE id = ?").run(now, runId);
  }

  async failStage(runId: string, stage: PipelineStage, error: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE stage_results SET status = 'failed', error = ?, completed_at = ? WHERE run_id = ? AND stage = ?`,
      )
      .run(error, now, runId, stage);
    this.db
      .prepare("UPDATE pipeline_runs SET status = 'failed', updated_at = ? WHERE id = ?")
      .run(now, runId);
  }

  async getStageResult<T = unknown>(runId: string, stage: PipelineStage): Promise<StageResult<T> | null> {
    const row = this.db
      .prepare("SELECT * FROM stage_results WHERE run_id = ? AND stage = ?")
      .get(runId, stage) as any;
    if (!row) return null;
    return {
      stage: row.stage as PipelineStage,
      status: row.status as StageStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      artifactPaths: JSON.parse(row.artifact_paths),
      data: JSON.parse(row.data) as T,
      error: row.error,
    };
  }

  async getStageResults(runId: string): Promise<StageResult[]> {
    const rows = this.db
      .prepare("SELECT * FROM stage_results WHERE run_id = ? ORDER BY id ASC")
      .all(runId) as Array<{
      stage: string;
      status: string;
      started_at: string;
      completed_at: string | null;
      artifact_paths: string;
      data: string;
      error: string | null;
    }>;

    return rows.map((row) => ({
      stage: row.stage as PipelineStage,
      status: row.status as StageStatus,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      artifactPaths: JSON.parse(row.artifact_paths) as string[],
      data: JSON.parse(row.data) as unknown,
      error: row.error,
    }));
  }

  async getLastCompletedStage(runId: string): Promise<PipelineStage | null> {
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
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO clip_progress (id, run_id, clip_index, current_stage, status, artifact_paths, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(clipId, runId, clipIndex, stage, status, JSON.stringify(artifactPaths), now);
  }

  async getClipProgress(
    runId: string,
    clipId: string,
  ): Promise<{ stage: PipelineStage; status: string; artifactPaths: Record<string, string> } | null> {
    const row = this.db
      .prepare("SELECT * FROM clip_progress WHERE id = ? AND run_id = ?")
      .get(clipId, runId) as any;
    if (!row) return null;
    return {
      stage: row.current_stage as PipelineStage,
      status: row.status,
      artifactPaths: JSON.parse(row.artifact_paths),
    };
  }

  async getClipProgressList(runId: string): Promise<ClipProgressSnapshot[]> {
    const rows = this.db
      .prepare("SELECT * FROM clip_progress WHERE run_id = ? ORDER BY clip_index ASC")
      .all(runId) as ClipProgressRow[];

    return rows.map((row) => ({
      clipId: row.id,
      clipIndex: row.clip_index,
      currentStage: row.current_stage as PipelineStage,
      status: row.status,
      artifactPaths: JSON.parse(row.artifact_paths) as Record<string, string>,
      updatedAt: row.updated_at,
    }));
  }

  async getCompletedClipIds(runId: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT id FROM clip_progress WHERE run_id = ? AND status = 'completed'")
      .all(runId) as any[];
    return rows.map((r) => r.id);
  }

  async getIncompleteClipIds(runId: string): Promise<string[]> {
    const rows = this.db
      .prepare("SELECT id FROM clip_progress WHERE run_id = ? AND status != 'completed'")
      .all(runId) as any[];
    return rows.map((r) => r.id);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
