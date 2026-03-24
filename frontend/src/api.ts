import type {
  AppSummary,
  CreateJobRequest,
  CreateJobResponse,
  LibraryGroup,
  PipelineRun,
  QueueStatus,
  RunDetail,
  Settings,
  SystemHealth,
  ResolvedJobOptions,
} from "@/types";

const API_BASE = "/api";

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || `HTTP ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const api = {
  // App summary
  getAppSummary: (): Promise<AppSummary> =>
    fetchJson(`${API_BASE}/app-summary`),

  // Jobs
  createJob: (data: CreateJobRequest): Promise<CreateJobResponse> =>
    fetchJson(`${API_BASE}/jobs`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Runs
  listRuns: (): Promise<PipelineRun[]> =>
    fetchJson(`${API_BASE}/runs`),

  getRun: (runId: string): Promise<RunDetail> =>
    fetchJson(`${API_BASE}/runs/${runId}`),

  // Library
  getLibrary: (): Promise<LibraryGroup[]> =>
    fetchJson(`${API_BASE}/library`),

  // Queue
  getQueue: (): Promise<QueueStatus> =>
    fetchJson(`${API_BASE}/queue`),

  // Settings
  getSettings: (): Promise<Settings> =>
    fetchJson(`${API_BASE}/settings`),

  updateSettings: (defaults: Partial<ResolvedJobOptions>): Promise<{ success: boolean; defaults: ResolvedJobOptions }> =>
    fetchJson(`${API_BASE}/settings`, {
      method: "PUT",
      body: JSON.stringify({ defaults }),
    }),

  // System health
  getSystemHealth: (): Promise<SystemHealth> =>
    fetchJson(`${API_BASE}/system/health`),
};
