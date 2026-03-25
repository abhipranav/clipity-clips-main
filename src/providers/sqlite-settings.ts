import { Database } from "bun:sqlite";
import type { SettingsStore } from "./settings";
import type { ResolvedJobOptions } from "../job-options/types";
import { DEFAULT_RESOLVED_OPTIONS } from "../job-options/types";

interface SettingsRow {
  id: string;
  defaults_json: string;
  updated_at: string;
}

export class SqliteSettingsStore implements SettingsStore {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'global',
        defaults_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);

    // Ensure the global row exists
    const existing = this.db.prepare("SELECT id FROM app_settings WHERE id = 'global'").get();
    if (!existing) {
      const now = new Date().toISOString();
      this.db.prepare(
        "INSERT INTO app_settings (id, defaults_json, updated_at) VALUES (?, ?, ?)"
      ).run("global", JSON.stringify(DEFAULT_RESOLVED_OPTIONS), now);
    }
  }

  async getDefaults(): Promise<ResolvedJobOptions> {
    const row = this.db
      .prepare("SELECT defaults_json FROM app_settings WHERE id = 'global'")
      .get() as SettingsRow | undefined;

    if (!row) {
      return DEFAULT_RESOLVED_OPTIONS;
    }

    try {
      const parsed = JSON.parse(row.defaults_json) as ResolvedJobOptions;
      return this.mergeWithDefaults(parsed);
    } catch {
      return DEFAULT_RESOLVED_OPTIONS;
    }
  }

  async saveDefaults(defaults: ResolvedJobOptions): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare(
        "INSERT OR REPLACE INTO app_settings (id, defaults_json, updated_at) VALUES (?, ?, ?)"
      )
      .run("global", JSON.stringify(defaults), now);
  }

  async close(): Promise<void> {
    this.db.close();
  }

  // Merge with defaults to ensure all fields are present (handles schema evolution)
  private mergeWithDefaults(parsed: Partial<ResolvedJobOptions>): ResolvedJobOptions {
    return {
      captions: {
        ...DEFAULT_RESOLVED_OPTIONS.captions,
        ...parsed.captions,
      },
      output: {
        ...DEFAULT_RESOLVED_OPTIONS.output,
        ...parsed.output,
      },
      clipSelection: {
        ...DEFAULT_RESOLVED_OPTIONS.clipSelection,
        ...parsed.clipSelection,
      },
    };
  }
}
