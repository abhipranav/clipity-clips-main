import { createSigner, createVerifier } from "fast-jwt";
import type { User, AuthTokenPayload } from "./types";
import type { UserStore } from "./store";
import type { Config } from "../config";

const ACCESS_TOKEN_EXPIRY = 15 * 60; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days

export class AuthService {
  private config: Config;
  private userStore: UserStore;
  private signAccess: (payload: any) => string;
  private signRefresh: (payload: any) => string;
  private verifyAccess: (token: string) => any;
  private verifyRefresh: (token: string) => any;

  constructor(config: Config, userStore: UserStore) {
    this.config = config;
    this.userStore = userStore;

    const secret = config.geminiApiKey; // Use API key as JWT secret (temporary)

    this.signAccess = createSigner({
      key: secret,
      expiresIn: ACCESS_TOKEN_EXPIRY * 1000,
    }) as any;

    this.signRefresh = createSigner({
      key: secret,
      expiresIn: REFRESH_TOKEN_EXPIRY * 1000,
    }) as any;

    this.verifyAccess = createVerifier({
      key: secret,
      cache: true,
    }) as any;

    this.verifyRefresh = createVerifier({
      key: secret,
      cache: true,
    }) as any;
  }

  generateTokens(user: User): { accessToken: string; refreshToken: string } {
    const payload = {
      userId: user.id,
      email: user.email,
      tier: user.tier,
    };

    return {
      accessToken: this.signAccess(payload),
      refreshToken: this.signRefresh({ ...payload, type: "refresh" }),
    };
  }

  verifyAccessToken(token: string): AuthTokenPayload {
    return this.verifyAccess(token) as AuthTokenPayload;
  }

  verifyRefreshToken(token: string): AuthTokenPayload & { type: string } {
    return this.verifyRefresh(token) as AuthTokenPayload & { type: string };
  }

  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; user: User } | null> {
    try {
      const payload = this.verifyRefreshToken(refreshToken);
      if (payload.type !== "refresh") return null;

      const user = await this.userStore.getUserById(payload.userId);
      if (!user) return null;

      const accessToken = this.signAccess({
        userId: user.id,
        email: user.email,
        tier: user.tier,
      });

      return { accessToken, user };
    } catch {
      return null;
    }
  }

  async authenticateWithApiKey(apiKey: string): Promise<User | null> {
    const { createHash } = await import("crypto");
    const keyHash = createHash("sha256").update(apiKey).digest("hex");

    const keyData = await this.userStore.getApiKeyByHash(keyHash);
    if (!keyData) return null;

    await this.userStore.updateApiKeyLastUsed(keyData.id);
    return keyData.user;
  }
}
