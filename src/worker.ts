import { loadConfig, validateCloudConfig } from "./config";
import { createProviders } from "./providers/factory";
import { PipelineOrchestrator } from "./pipeline/orchestrator";
import { createLogger } from "./utils/logger";

const log = createLogger("worker");

interface WorkerConfig {
  concurrency: number;
  pollIntervalMs: number;
}

async function checkBinary(name: string, args: string[] = ["--version"]): Promise<boolean> {
  try {
    const proc = Bun.spawn([name, ...args], { stdout: "pipe", stderr: "pipe" });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

async function runPreflightChecks(): Promise<void> {
  log.info("Running preflight checks...");

  const requiredBinaries = [
    { name: "ffmpeg", args: ["-version"] },
    { name: "yt-dlp", args: ["--version"] },
    { name: "python3", args: ["--version"] },
    { name: "whisper-cli", args: ["-h"] },
  ];

  const missing: string[] = [];
  for (const { name, args } of requiredBinaries) {
    const exists = await checkBinary(name, args);
    if (!exists) {
      missing.push(name);
    } else {
      log.info(`✓ ${name} found`);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required binaries: ${missing.join(", ")}`);
  }

  log.info("All preflight checks passed");
}

async function processJob(
  runId: string,
  orchestrator: PipelineOrchestrator,
  providers: Awaited<ReturnType<typeof createProviders>>
): Promise<boolean> {
  try {
    await orchestrator.runQueuedRun(runId);
    await providers.queue.ack(runId);
    log.info(`Successfully processed run: ${runId}`);
    return true;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    log.error(`Failed to process run ${runId}: ${errorMessage}`);
    await providers.queue.release(runId, errorMessage);
    return false;
  }
}

async function workerLoop(
  workerConfig: WorkerConfig,
  orchestrator: PipelineOrchestrator,
  providers: Awaited<ReturnType<typeof createProviders>>
): Promise<void> {
  let activeJobs = 0;

  while (true) {
    if (activeJobs >= workerConfig.concurrency) {
      await new Promise((resolve) => setTimeout(resolve, workerConfig.pollIntervalMs));
      continue;
    }

    const message = await providers.queue.claimNext();

    if (!message) {
      log.debug("No jobs available, polling...");
      await new Promise((resolve) => setTimeout(resolve, workerConfig.pollIntervalMs));
      continue;
    }

    log.info(`Claimed run: ${message.runId} (attempt ${message.attempts + 1})`);
    activeJobs++;

    // Process job concurrently
    void processJob(message.runId, orchestrator, providers).then(() => {
      activeJobs--;
    });
  }
}

async function main(): Promise<void> {
  log.info("Starting Clipity worker...");

  const config = loadConfig();

  // Validate cloud config if in cloud mode
  if (config.appMode === "cloud") {
    validateCloudConfig(config);
  }

  // Run preflight checks only in local mode (skip for cloud/worker mode)
  if (config.appMode === "local") {
    await runPreflightChecks();
  }

  const providers = await createProviders(config);

  const orchestrator = new PipelineOrchestrator(config, providers.checkpoint, providers.artifact);

  const workerConfig: WorkerConfig = {
    concurrency: config.workerConcurrency,
    pollIntervalMs: config.workerPollIntervalMs,
  };

  log.info(`Worker configuration:`);
  log.info(`  - Mode: ${config.appMode}`);
  log.info(`  - Concurrency: ${workerConfig.concurrency}`);
  log.info(`  - Poll interval: ${workerConfig.pollIntervalMs}ms`);
  log.info(`  - Checkpoint backend: ${config.checkpointBackend}`);
  log.info(`  - Queue backend: ${config.queueBackend}`);
  log.info(`  - Artifact backend: ${config.artifactBackend}`);

  // Handle graceful shutdown
  let shuttingDown = false;
  process.on("SIGINT", () => {
    if (shuttingDown) {
      log.info("Force exiting...");
      process.exit(1);
    }
    shuttingDown = true;
    log.info("Shutting down worker (press Ctrl+C again to force)...");
  });

  process.on("SIGTERM", () => {
    shuttingDown = true;
    log.info("Received SIGTERM, shutting down...");
  });

  try {
    await workerLoop(workerConfig, orchestrator, providers);
  } catch (err) {
    log.error(`Worker loop error: ${err}`);
    throw err;
  } finally {
    providers.checkpoint.close();
    await providers.queue.close();
  }
}

main().catch((err) => {
  log.error(`Worker failed: ${err}`);
  process.exit(1);
});
