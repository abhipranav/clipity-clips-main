import type { User, TierFeatures } from "./types";
import { TIER_FEATURES } from "./types";
import type { UserTier } from "../config";

export class TierGate {
  private user: User;

  constructor(user: User) {
    this.user = user;
  }

  static forUser(user: User): TierGate {
    return new TierGate(user);
  }

  get tier(): UserTier {
    // Check if tier has expired
    if (this.user.tier === "pro" && this.user.tierExpiresAt) {
      const expiresAt = new Date(this.user.tierExpiresAt);
      if (expiresAt < new Date()) {
        return "free";
      }
    }
    return this.user.tier;
  }

  get features(): TierFeatures {
    return TIER_FEATURES[this.tier];
  }

  canUseCustomCaptions(): boolean {
    return this.features.customCaptions;
  }

  canUseBatchProcessing(): boolean {
    return this.features.batchProcessing;
  }

  canUseApiAccess(): boolean {
    return this.features.apiAccess;
  }

  canUseDirectPublish(): boolean {
    return this.features.directPublish;
  }

  canUseAiSuggestions(): boolean {
    return this.features.aiSuggestions;
  }

  canRemoveWatermark(): boolean {
    return this.features.watermarkRemoval;
  }

  hasPriorityQueue(): boolean {
    return this.features.priorityQueue;
  }

  hasExtendedStorage(): boolean {
    return this.features.extendedStorage;
  }

  hasClipAnalytics(): boolean {
    return this.features.clipAnalytics;
  }

  getMaxBatchSize(): number {
    return this.features.maxBatchSize;
  }

  getMaxClipsPerMonth(): number {
    return this.features.maxClipsPerMonth;
  }

  checkOrThrow(feature: keyof TierFeatures): void {
    const value = this.features[feature];
    if (!value || (typeof value === "number" && value === 0)) {
      throw new TierAccessError(feature, this.tier);
    }
  }

  checkBatchSize(requestedSize: number): number {
    const maxSize = this.getMaxBatchSize();
    if (requestedSize > maxSize) {
      throw new TierAccessError(`batch size ${requestedSize} exceeds max ${maxSize}`, this.tier);
    }
    return requestedSize;
  }
}

export class TierAccessError extends Error {
  public readonly feature: string;
  public readonly currentTier: UserTier;
  public readonly requiredTier: UserTier;

  constructor(feature: string, currentTier: UserTier) {
    super(`Feature '${feature}' requires Pro tier. Current tier: ${currentTier}`);
    this.feature = feature;
    this.currentTier = currentTier;
    this.requiredTier = "pro";
    this.name = "TierAccessError";
  }
}

export class UsageLimitError extends Error {
  public readonly limit: number;
  public readonly current: number;

  constructor(limit: number, current: number) {
    super(`Usage limit exceeded: ${current}/${limit} clips this month. Upgrade to Pro for unlimited clips.`);
    this.limit = limit;
    this.current = current;
    this.name = "UsageLimitError";
  }
}
