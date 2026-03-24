import type { ResolvedJobOptions, AppSettings } from "../job-options/types";

export interface SettingsStore {
  getDefaults(): Promise<ResolvedJobOptions>;
  saveDefaults(defaults: ResolvedJobOptions): Promise<void>;
  close(): Promise<void>;
}
