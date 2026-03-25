import type { UserStore } from "./store";
import { hashPassword, verifyPassword } from "./store";
import type { AuthService } from "./service";
import { createLogger } from "../utils/logger";
import { TierGate } from "./gate";
import type { User } from "./types";
import { createAuthHandler, unauthorizedResponse, forbiddenResponse } from "./middleware";

const log = createLogger("auth-routes");

export function createAuthRoutes(authService: AuthService, userStore: UserStore) {
  const authenticate = createAuthHandler(authService, userStore);

  // POST /api/auth/signup
  async function signup(req: Request): Promise<Response> {
    try {
      const body = await req.json() as { email?: string; password?: string };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return new Response(
          JSON.stringify({ error: "Invalid email format" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Validate password strength
      if (password.length < 8) {
        return new Response(
          JSON.stringify({ error: "Password must be at least 8 characters" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Check if user already exists
      const existingUser = await userStore.getUserByEmail(email);
      if (existingUser) {
        return new Response(
          JSON.stringify({ error: "User already exists" }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }

      // Hash password and create user
      const passwordHash = await hashPassword(password);
      const user = await userStore.createUser(email, passwordHash);

      // Generate tokens
      const { accessToken, refreshToken } = authService.generateTokens(user);

      // Set session cookie for web
      const cookie = `session=${accessToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`;

      log.info(`User created: ${email} (${user.id})`);

      return new Response(
        JSON.stringify({
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
        }),
        {
          status: 201,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        }
      );
    } catch (err) {
      log.error(`Signup error: ${err}`);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // POST /api/auth/login
  async function login(req: Request): Promise<Response> {
    try {
      const body = await req.json() as { email?: string; password?: string };
      const { email, password } = body;

      if (!email || !password) {
        return new Response(
          JSON.stringify({ error: "Email and password required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const user = await userStore.getUserByEmail(email);
      if (!user || !user.passwordHash) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return new Response(
          JSON.stringify({ error: "Invalid credentials" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const { accessToken, refreshToken } = authService.generateTokens(user);
      const cookie = `session=${accessToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`;

      log.info(`User logged in: ${email} (${user.id})`);

      return new Response(
        JSON.stringify({
          user: sanitizeUser(user),
          accessToken,
          refreshToken,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        }
      );
    } catch (err) {
      log.error(`Login error: ${err}`);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // POST /api/auth/logout
  async function logout(_req: Request): Promise<Response> {
    const cookie = "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict";

    return new Response(
      JSON.stringify({ message: "Logged out" }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Set-Cookie": cookie,
        },
      }
    );
  }

  // GET /api/auth/me
  async function me(req: Request): Promise<Response> {
    const user = await authenticate(req);
    if (!user) {
      return unauthorizedResponse();
    }

    // Reset usage if needed
    const month = new Date().toISOString().slice(0, 7);
    const gate = TierGate.forUser(user);
    const usage = await userStore.getOrCreateUserUsage(user.id, month, gate.getMaxClipsPerMonth());

    return new Response(
      JSON.stringify({
        user: sanitizeUser(user),
        usage: {
          clipsCreated: usage.clipsCreated,
          clipsLimit: usage.clipsLimit,
          month: usage.month,
        },
        features: gate.features,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // POST /api/auth/refresh
  async function refresh(req: Request): Promise<Response> {
    try {
      const body = await req.json() as { refreshToken?: string };
      const { refreshToken } = body;

      if (!refreshToken) {
        return new Response(
          JSON.stringify({ error: "Refresh token required" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await authService.refreshAccessToken(refreshToken);
      if (!result) {
        return new Response(
          JSON.stringify({ error: "Invalid refresh token" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const { accessToken, user } = result;
      const cookie = `session=${accessToken}; HttpOnly; Path=/; Max-Age=${7 * 24 * 60 * 60}; SameSite=Strict`;

      return new Response(
        JSON.stringify({ accessToken, user: sanitizeUser(user) }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": cookie,
          },
        }
      );
    } catch (err) {
      log.error(`Refresh error: ${err}`);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }

  // GET /api/auth/api-keys
  async function listApiKeys(req: Request): Promise<Response> {
    const user = await authenticate(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const gate = TierGate.forUser(user);
    if (!gate.canUseApiAccess()) {
      return forbiddenResponse("API access requires Pro tier");
    }

    const keys = await userStore.listApiKeys(user.id);
    return new Response(
      JSON.stringify({
        keys: keys.map(k => ({
          id: k.id,
          name: k.name,
          prefix: k.keyPrefix,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  // POST /api/auth/api-keys
  async function createApiKey(req: Request): Promise<Response> {
    const user = await authenticate(req);
    if (!user) {
      return unauthorizedResponse();
    }

    const gate = TierGate.forUser(user);
    if (!gate.canUseApiAccess()) {
      return forbiddenResponse("API access requires Pro tier");
    }

    const body = await req.json() as { name?: string };
    const name = body.name || "API Key";

    const { apiKey, keyData } = await userStore.createApiKey(user.id, name);

    // Return the full key only once on creation
    return new Response(
      JSON.stringify({
        apiKey,
        key: {
          id: keyData.id,
          name: keyData.name,
          prefix: keyData.keyPrefix,
          createdAt: keyData.createdAt,
        },
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  }

  // DELETE /api/auth/api-keys/:id
  async function revokeApiKey(req: Request, keyId: string): Promise<Response> {
    const user = await authenticate(req);
    if (!user) {
      return unauthorizedResponse();
    }

    await userStore.revokeApiKey(keyId);

    return new Response(
      JSON.stringify({ message: "API key revoked" }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  return {
    signup,
    login,
    logout,
    me,
    refresh,
    listApiKeys,
    createApiKey,
    revokeApiKey,
  };
}

// Sanitize user object for API responses (remove sensitive fields)
function sanitizeUser(user: User): Omit<User, "passwordHash"> {
  const { passwordHash: _passwordHash, ...sanitized } = user;
  return sanitized;
}
