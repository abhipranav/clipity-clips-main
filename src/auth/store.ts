import { Database } from "bun:sqlite";
import { createHash, randomBytes } from "crypto";
import type { User, ApiKey, OAuthToken, OAuthProvider, UserUsage } from "./types";
import type { UserTier } from "../config";

export interface UserStore {
  // User management
  createUser(email: string, passwordHash: string | null): Promise<User>;
  getUserById(id: string): Promise<User | null>;
  getUserByEmail(email: string): Promise<User | null>;
  updateUserTier(userId: string, tier: UserTier, expiresAt: string | null): Promise<void>;
  verifyEmail(userId: string): Promise<void>;
  updatePassword(userId: string, passwordHash: string): Promise<void>;

  // API key management
  createApiKey(userId: string, name: string): Promise<{ apiKey: string; keyData: ApiKey }>;
  getApiKeyByHash(keyHash: string): Promise<(ApiKey & { user: User }) | null>;
  listApiKeys(userId: string): Promise<ApiKey[]>;
  revokeApiKey(keyId: string): Promise<void>;
  updateApiKeyLastUsed(keyId: string): Promise<void>;

  // OAuth tokens
  saveOAuthToken(
    userId: string,
    provider: OAuthProvider,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
    scope: string,
  ): Promise<OAuthToken>;
  getOAuthToken(userId: string, provider: OAuthProvider): Promise<OAuthToken | null>;
  deleteOAuthToken(userId: string, provider: OAuthProvider): Promise<void>;

  // Usage tracking
  getOrCreateUserUsage(userId: string, month: string, clipsLimit: number): Promise<UserUsage>;
  incrementClipUsage(userId: string, month: string): Promise<number>;
  resetUsageIfNeeded(userId: string, clipsLimit: number): Promise<UserUsage>;

  // Lifecycle
  close(): Promise<void>;
}

export class SqliteUserStore implements UserStore {
  private db: Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { create: true });
    this.db.exec("PRAGMA journal_mode = WAL");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      -- Users table
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        tier TEXT NOT NULL DEFAULT 'free',
        tier_expires_at TEXT,
        email_verified INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- API keys table
      CREATE TABLE IF NOT EXISTS api_keys (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        key_hash TEXT UNIQUE NOT NULL,
        key_prefix TEXT NOT NULL,
        name TEXT NOT NULL,
        last_used_at TEXT,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      -- OAuth tokens table
      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        access_token TEXT NOT NULL,
        refresh_token TEXT,
        expires_at TEXT,
        scope TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, provider)
      );

      -- User usage tracking
      CREATE TABLE IF NOT EXISTS user_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        month TEXT NOT NULL,
        clips_created INTEGER NOT NULL DEFAULT 0,
        clips_limit INTEGER NOT NULL,
        last_reset_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id),
        UNIQUE(user_id, month)
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
      CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_tokens_user ON oauth_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_user_usage_user_month ON user_usage(user_id, month);
    `);
  }

  async createUser(email: string, passwordHash: string | null): Promise<User> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO users (id, email, password_hash, tier, tier_expires_at, email_verified, created_at, updated_at)
         VALUES (?, ?, ?, 'free', NULL, 0, ?, ?)`,
      )
      .run(id, email, passwordHash, now, now);

    return {
      id,
      email,
      passwordHash,
      tier: "free",
      tierExpiresAt: null,
      emailVerified: false,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getUserById(id: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as
      | (Omit<User, "emailVerified"> & { email_verified: number })
      | null;
    if (!row) return null;

    return {
      ...row,
      emailVerified: Boolean(row.email_verified),
    };
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = this.db.prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | (Omit<User, "emailVerified"> & { email_verified: number })
      | null;
    if (!row) return null;

    return {
      ...row,
      emailVerified: Boolean(row.email_verified),
    };
  }

  async updateUserTier(userId: string, tier: UserTier, expiresAt: string | null): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE users SET tier = ?, tier_expires_at = ?, updated_at = ? WHERE id = ?")
      .run(tier, expiresAt, now, userId);
  }

  async verifyEmail(userId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE users SET email_verified = 1, updated_at = ? WHERE id = ?")
      .run(now, userId);
  }

  async updatePassword(userId: string, passwordHash: string): Promise<void> {
    const now = new Date().toISOString();
    this.db
      .prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?")
      .run(passwordHash, now, userId);
  }

  async createApiKey(userId: string, name: string): Promise<{ apiKey: string; keyData: ApiKey }> {
    const id = crypto.randomUUID();
    const apiKey = `clip_${randomBytes(32).toString("hex")}`;
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyPrefix = apiKey.slice(0, 12);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, name, last_used_at, created_at, revoked_at)
         VALUES (?, ?, ?, ?, ?, NULL, ?, NULL)`,
      )
      .run(id, userId, keyHash, keyPrefix, name, now);

    return {
      apiKey,
      keyData: {
        id,
        userId,
        keyHash,
        keyPrefix,
        name,
        lastUsedAt: null,
        createdAt: now,
        revokedAt: null,
      },
    };
  }

  async getApiKeyByHash(keyHash: string): Promise<(ApiKey & { user: User }) | null> {
    const row = this.db
      .prepare(
        `SELECT k.*, u.id as user_id, u.email, u.password_hash, u.tier, u.tier_expires_at,
                u.email_verified, u.created_at as user_created_at, u.updated_at as user_updated_at
         FROM api_keys k
         JOIN users u ON k.user_id = u.id
         WHERE k.key_hash = ? AND k.revoked_at IS NULL`,
      )
      .get(keyHash) as
      | ((Omit<ApiKey, "lastUsedAt" | "revokedAt"> & Omit<User, "emailVerified"> & { email_verified: number; last_used_at: string | null; revoked_at: string | null; user_created_at: string; user_updated_at: string }))
      | null;

    if (!row) return null;

    const user: User = {
      id: row.userId,
      email: row.email,
      passwordHash: row.passwordHash,
      tier: row.tier as UserTier,
      tierExpiresAt: row.tierExpiresAt,
      emailVerified: Boolean(row.email_verified),
      createdAt: row.user_created_at,
      updatedAt: row.user_updated_at,
    };

    return {
      id: row.id,
      userId: row.userId,
      keyHash: row.keyHash,
      keyPrefix: row.keyPrefix,
      name: row.name,
      lastUsedAt: row.last_used_at,
      createdAt: row.createdAt,
      revokedAt: row.revoked_at,
      user,
    };
  }

  async listApiKeys(userId: string): Promise<ApiKey[]> {
    const rows = this.db
      .prepare("SELECT * FROM api_keys WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at DESC")
      .all(userId) as Array<Omit<ApiKey, "lastUsedAt" | "revokedAt"> & { last_used_at: string | null; revoked_at: string | null }>;

    return rows.map((row) => ({
      ...row,
      lastUsedAt: row.last_used_at,
      revokedAt: row.revoked_at,
    }));
  }

  async revokeApiKey(keyId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(now, keyId);
  }

  async updateApiKeyLastUsed(keyId: string): Promise<void> {
    const now = new Date().toISOString();
    this.db.prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(now, keyId);
  }

  async saveOAuthToken(
    userId: string,
    provider: OAuthProvider,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
    scope: string,
  ): Promise<OAuthToken> {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO oauth_tokens (id, user_id, provider, access_token, refresh_token, expires_at, scope, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, provider) DO UPDATE SET
         access_token = excluded.access_token,
         refresh_token = excluded.refresh_token,
         expires_at = excluded.expires_at,
         scope = excluded.scope,
         updated_at = excluded.updated_at`,
      )
      .run(id, userId, provider, accessToken, refreshToken, expiresAt, scope, now, now);

    return {
      id,
      userId,
      provider,
      accessToken,
      refreshToken,
      expiresAt,
      scope,
      createdAt: now,
      updatedAt: now,
    };
  }

  async getOAuthToken(userId: string, provider: OAuthProvider): Promise<OAuthToken | null> {
    const row = this.db
      .prepare("SELECT * FROM oauth_tokens WHERE user_id = ? AND provider = ?")
      .get(userId, provider) as OAuthToken | null;
    return row;
  }

  async deleteOAuthToken(userId: string, provider: OAuthProvider): Promise<void> {
    this.db.prepare("DELETE FROM oauth_tokens WHERE user_id = ? AND provider = ?").run(userId, provider);
  }

  async getOrCreateUserUsage(userId: string, month: string, clipsLimit: number): Promise<UserUsage> {
    const row = this.db
      .prepare("SELECT * FROM user_usage WHERE user_id = ? AND month = ?")
      .get(userId, month) as UserUsage | null;

    if (row) return row;

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT INTO user_usage (id, user_id, month, clips_created, clips_limit, last_reset_at)
         VALUES (?, ?, ?, 0, ?, ?)`,
      )
      .run(id, userId, month, clipsLimit, now);

    return {
      id,
      userId,
      month,
      clipsCreated: 0,
      clipsLimit,
      lastResetAt: now,
    };
  }

  async incrementClipUsage(userId: string, month: string): Promise<number> {
    this.db
      .prepare("UPDATE user_usage SET clips_created = clips_created + 1 WHERE user_id = ? AND month = ?")
      .run(userId, month);

    const row = this.db
      .prepare("SELECT clips_created FROM user_usage WHERE user_id = ? AND month = ?")
      .get(userId, month) as { clips_created: number };

    return row.clips_created;
  }

  async resetUsageIfNeeded(userId: string, clipsLimit: number): Promise<UserUsage> {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const usage = await this.getOrCreateUserUsage(userId, currentMonth, clipsLimit);

    if (usage.month !== currentMonth) {
      return this.getOrCreateUserUsage(userId, currentMonth, clipsLimit);
    }

    return usage;
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

// Hash password helper
export function hashPassword(password: string): Promise<string> {
  return Bun.password.hash(password, {
    algorithm: "bcrypt",
    cost: 10,
  });
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return Bun.password.verify(password, hash);
}
