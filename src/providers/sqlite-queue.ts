import { Database } from "bun:sqlite";
import type { QueueProvider, QueueMessage } from "./queue";

interface QueuedRunRow {
  run_id: string;
  status: string;
  attempts: number;
  available_at: string;
  claimed_at: string | null;
  last_error: string | null;
  created_at: string;
}

export class SqliteQueueProvider implements QueueProvider {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
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

      CREATE INDEX IF NOT EXISTS idx_queued_runs_status ON queued_runs(status);
      CREATE INDEX IF NOT EXISTS idx_queued_runs_available ON queued_runs(available_at);
    `);
  }

  async enqueue(runId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO queued_runs (run_id, status, attempts, available_at, created_at) VALUES (?, 'queued', 0, ?, ?)`
      )
      .run(runId, now, now);
  }

  async claimNext(): Promise<QueueMessage | null> {
    const now = new Date().toISOString();

    // Find next available queued run
    const row = this.db
      .prepare(
        `SELECT * FROM queued_runs 
         WHERE status = 'queued' AND available_at <= ? 
         ORDER BY created_at ASC LIMIT 1`
      )
      .get(now) as QueuedRunRow | undefined;

    if (!row) return null;

    // Mark as claimed
    this.db
      .prepare(
        `UPDATE queued_runs SET status = 'claimed', claimed_at = ? WHERE run_id = ?`
      )
      .run(now, row.run_id);

    return {
      runId: row.run_id,
      attempts: row.attempts,
    };
  }

  async ack(runId: string): Promise<void> {
    this.db.prepare(`DELETE FROM queued_runs WHERE run_id = ?`).run(runId);
  }

  async release(runId: string, error?: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE queued_runs 
         SET status = 'queued', 
             attempts = attempts + 1, 
             available_at = ?,
             last_error = ?,
             claimed_at = NULL 
         WHERE run_id = ?`
      )
      .run(now, error ?? null, runId);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  async healthCheck(): Promise<{ healthy: boolean; message?: string }> {
    try {
      // Check if database is accessible
      this.db.prepare("SELECT 1").get();
      return { healthy: true };
    } catch (err) {
      return { healthy: false, message: `Database error: ${err}` };
    }
  }
}
