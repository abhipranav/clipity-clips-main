import postgres from "postgres";
import type { SettingsStore } from "./settings";
import type { ResolvedJobOptions } from "../job-options/types";
import { DEFAULT_RESOLVED_OPTIONS } from "../job-options/types";

type Sql = ReturnType<typeof postgres>;

interface SettingsRow {
  id: string;
  defaults_json: string;
  updated_at: string;
}

export class PostgresSettingsStore implements SettingsStore {
  private sql: Sql;
  private ready: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 5 });
    this.ready = this.migrate();
  }

  private async ensureReady(): Promise<void> {
    await this.ready;
  }

  private async migrate(): Promise<void> {
    await this.sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY DEFAULT 'global',
        defaults_json TEXT NOT NULL,
        updated_at TIMESTAMP NOT NULL
      )
    `;

    // Ensure the global row exists
    const existing = await this.sql<{ id: string }[]>`
      SELECT id FROM app_settings WHERE id = 'global'
    `;
    if (existing.length === 0) {
      const now = new Date().toISOString();
      await this.sql`
        INSERT INTO app_settings (id, defaults_json, updated_at)
        VALUES ('global', ${JSON.stringify(DEFAULT_RESOLVED_OPTIONS)}, ${now})
      `;
    }
  }

  async getDefaults(): Promise<ResolvedJobOptions> {
    await this.ensureReady();
    const result = await this.sql<SettingsRow[]>`
      SELECT defaults_json FROM app_settings WHERE id = 'global'
    `;

    if (result.length === 0) {
      return DEFAULT_RESOLVED_OPTIONS;
    }

    try {
      const parsed = JSON.parse(result[0].defaults_json) as ResolvedJobOptions;
      return this.mergeWithDefaults(parsed);
    } catch {
      return DEFAULT_RESOLVED_OPTIONS;
    }
  }

  async saveDefaults(defaults: ResolvedJobOptions): Promise<void> {
    await this.ensureReady();
    const now = new Date().toISOString();
    await this.sql`
      INSERT INTO app_settings (id, defaults_json, updated_at)
      VALUES ('global', ${JSON.stringify(defaults)}, ${now})
      ON CONFLICT (id) DO UPDATE SET
        defaults_json = ${JSON.stringify(defaults)},
        updated_at = ${now}
    `;
  }

  async close(): Promise<void> {
    await this.sql.end();
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
