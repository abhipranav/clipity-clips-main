import type { Config } from "../config";
import type { CheckpointStore } from "./checkpoint";
import type { QueueProvider } from "./queue";
import type { ArtifactStore } from "./artifact";
import type { SettingsStore } from "./settings";
import { SqliteCheckpointStore } from "./sqlite-checkpoint";
import { SqliteQueueProvider } from "./sqlite-queue";
import { SqliteSettingsStore } from "./sqlite-settings";
import { LocalArtifactStore } from "./local-artifact";

export interface ProviderSet {
  checkpoint: CheckpointStore;
  queue: QueueProvider;
  artifact: ArtifactStore;
  settings: SettingsStore;
}

export async function createProviders(config: Config): Promise<ProviderSet> {
  const checkpoint = await createCheckpointStore(config);
  const queue = await createQueueProvider(config);
  const artifact = createArtifactStore(config);
  const settings = await createSettingsStore(config);
  return { checkpoint, queue, artifact, settings };
}

async function createCheckpointStore(config: Config): Promise<CheckpointStore> {
  switch (config.checkpointBackend) {
    case "sqlite":
      return new SqliteCheckpointStore(config.paths.checkpointDb);
    case "postgres": {
      if (!config.databaseUrl) {
        throw new Error("DATABASE_URL is required for Postgres checkpoint store");
      }
      // Dynamic import to avoid loading postgres module in local mode
      const { PostgresCheckpointStore } = await import("./postgres-checkpoint");
      return new PostgresCheckpointStore(config.databaseUrl);
    }
    default:
      throw new Error(`Unknown checkpoint backend: ${config.checkpointBackend}`);
  }
}

async function createQueueProvider(config: Config): Promise<QueueProvider> {
  switch (config.queueBackend) {
    case "sqlite":
      return new SqliteQueueProvider(config.paths.checkpointDb);
    case "sqs": {
      if (!config.awsRegion || !config.sqsQueueUrl) {
        throw new Error("AWS_REGION and SQS_QUEUE_URL are required for SQS queue provider");
      }
      // Dynamic import to avoid loading AWS SDK in local mode
      const { SqsQueueProvider } = await import("./sqs-queue");
      return new SqsQueueProvider(config.awsRegion, config.sqsQueueUrl);
    }
    default:
      throw new Error(`Unknown queue backend: ${config.queueBackend}`);
  }
}

function createArtifactStore(config: Config): ArtifactStore {
  switch (config.artifactBackend) {
    case "local":
      return new LocalArtifactStore();
    case "s3": {
      if (!config.awsRegion || !config.s3Bucket) {
        throw new Error("AWS_REGION and S3_BUCKET are required for S3 artifact store");
      }
      // Dynamic import to avoid loading AWS SDK in local mode
      const { S3ArtifactStore } = require("./s3-artifact");
      return new S3ArtifactStore(config.awsRegion, config.s3Bucket);
    }
    default:
      throw new Error(`Unknown artifact backend: ${config.artifactBackend}`);
  }
}

async function createSettingsStore(config: Config): Promise<SettingsStore> {
  // Settings are always stored in the checkpoint database (SQLite or Postgres)
  switch (config.checkpointBackend) {
    case "sqlite":
      return new SqliteSettingsStore(config.paths.checkpointDb);
    case "postgres": {
      if (!config.databaseUrl) {
        throw new Error("DATABASE_URL is required for Postgres settings store");
      }
      // Dynamic import to avoid loading postgres module in local mode
      const { PostgresSettingsStore } = await import("./postgres-settings");
      return new PostgresSettingsStore(config.databaseUrl);
    }
    default:
      throw new Error(`Unknown checkpoint backend: ${config.checkpointBackend}`);
  }
}
