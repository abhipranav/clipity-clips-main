import type { UserTier } from "../config";

export interface User {
  id: string;
  email: string;
  passwordHash: string | null;
  tier: UserTier;
  tierExpiresAt: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKey {
  id: string;
  userId: string;
  keyHash: string;
  keyPrefix: string;
  name: string;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface OAuthToken {
  id: string;
  userId: string;
  provider: OAuthProvider;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: string | null;
  scope: string;
  createdAt: string;
  updatedAt: string;
}

export type OAuthProvider = "google" | "youtube" | "tiktok" | "instagram" | "twitter";

export interface UserUsage {
  id: string;
  userId: string;
  month: string;
  clipsCreated: number;
  clipsLimit: number;
  lastResetAt: string;
}

export interface AuthenticatedRequest {
  user: User;
  apiKey?: ApiKey;
}

// Feature flags per tier
export interface TierFeatures {
  maxClipsPerMonth: number;
  maxBatchSize: number;
  customCaptions: boolean;
  batchProcessing: boolean;
  apiAccess: boolean;
  directPublish: boolean;
  aiSuggestions: boolean;
  watermarkRemoval: boolean;
  priorityQueue: boolean;
  extendedStorage: boolean;
  clipAnalytics: boolean;
}

export const TIER_FEATURES: Record<UserTier, TierFeatures> = {
  free: {
    maxClipsPerMonth: 5,
    maxBatchSize: 1,
    customCaptions: false,
    batchProcessing: false,
    apiAccess: false,
    directPublish: false,
    aiSuggestions: false,
    watermarkRemoval: false,
    priorityQueue: false,
    extendedStorage: false,
    clipAnalytics: false,
  },
  pro: {
    maxClipsPerMonth: Infinity,
    maxBatchSize: 10,
    customCaptions: true,
    batchProcessing: true,
    apiAccess: true,
    directPublish: true,
    aiSuggestions: true,
    watermarkRemoval: true,
    priorityQueue: true,
    extendedStorage: true,
    clipAnalytics: true,
  },
};

// Auth token payload
export interface AuthTokenPayload {
  userId: string;
  email: string;
  tier: UserTier;
  iat: number;
  exp: number;
}
