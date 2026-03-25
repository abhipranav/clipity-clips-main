// Auth module exports
export * from "./types";
export * from "./store";
export * from "./service";
export * from "./gate";
export * from "./routes";

// Export middleware functions explicitly to avoid naming conflicts
export { createAuthHandler, unauthorizedResponse, forbiddenResponse, requireAuth } from "./middleware";
