export interface QueueMessage {
  runId: string;
  attempts: number;
}

export interface QueueProvider {
  enqueue(runId: string): Promise<void>;
  claimNext(): Promise<QueueMessage | null>;
  ack(runId: string): Promise<void>;
  release(runId: string, error?: string): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<{ healthy: boolean; message?: string }>;
}
