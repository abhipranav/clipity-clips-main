import type { ResolvedJobOptions } from "../job-options/types";

export interface SettingsStore {
  getDefaults(): Promise<ResolvedJobOptions>;
  saveDefaults(defaults: ResolvedJobOptions): Promise<void>;
  close(): Promise<void>;
}
