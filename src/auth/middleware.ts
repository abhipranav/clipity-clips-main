import type { User } from "./types";
import type { AuthService } from "./service";
import type { UserStore } from "./store";
import { createLogger } from "../utils/logger";

const log = createLogger("auth-middleware");

export interface AuthenticatedRequest {
  user: User;
}

export function createAuthHandler(authService: AuthService, userStore: UserStore) {
  return async function authenticate(req: Request): Promise<User | null> {
    try {
      // Check for Bearer token in Authorization header
      const authHeader = req.headers.get("Authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        try {
          const payload = authService.verifyAccessToken(token);
          const user = await userStore.getUserById(payload.userId);
          if (user) {
            return user;
          }
        } catch (err) {
          log.debug(`Token verification failed: ${err}`);
        }
      }

      // Check for API key
      const apiKey = req.headers.get("X-API-Key");
      if (apiKey) {
        const user = await authService.authenticateWithApiKey(apiKey);
        if (user) {
          return user;
        }
      }

      // Check for session cookie (web app)
      const cookieHeader = req.headers.get("Cookie");
      const sessionToken = cookieHeader?.match(/session=([^;]+)/)?.[1];
      if (sessionToken) {
        try {
          const payload = authService.verifyAccessToken(sessionToken);
          const user = await userStore.getUserById(payload.userId);
          if (user) {
            return user;
          }
        } catch (err) {
          log.debug(`Session verification failed: ${err}`);
        }
      }

      return null;
    } catch (err) {
      log.error(`Auth handler error: ${err}`);
      return null;
    }
  };
}

// Create a 401 unauthorized response
export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized" }),
    {
      status: 401,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Create a 403 forbidden response for tier access
export function forbiddenResponse(message: string): Response {
  return new Response(
    JSON.stringify({ error: "Forbidden", message }),
    {
      status: 403,
      headers: { "Content-Type": "application/json" },
    }
  );
}

// Helper to wrap API handlers with auth requirement
export function requireAuth<T extends (req: Request, user: User, ...args: unknown[]) => Promise<Response>>(
  authenticate: (req: Request) => Promise<User | null>,
  handler: T
): (req: Request, ...args: unknown[]) => Promise<Response> {
  return async (req: Request, ...args: unknown[]): Promise<Response> => {
    const user = await authenticate(req);
    if (!user) {
      return unauthorizedResponse();
    }
    return handler(req, user, ...args);
  };
}
