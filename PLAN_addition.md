# Dual-Mode SaaS Foundation Implementation Plan

## Summary

This plan is **handoff-ready** for implementation. Build an infra-first SaaS foundation that keeps the current CLI pipeline working unchanged while refactoring the browser layer into a proper **queued web + worker architecture**.

Locked decisions:
- Bun remains the runtime
- Local mode is the primary dev path
- Web creates queued runs; workers execute them
- Cloud mode uses provider abstractions, not separate business logic
- **Cloud resume in this pass = retry from scratch**
  - local resume remains fully supported
  - cloud retries may restart work instead of rehydrating artifacts across workers

## Key Changes

### Runtime and provider model
- Add explicit provider-backed config for:
  - checkpoint store: `sqlite | postgres`
  - queue: `sqlite | sqs`
  - artifacts: `local | s3`
- Support `APP_MODE=local|cloud` with derived defaults:
  - local => sqlite checkpoint, sqlite queue, local artifacts
  - cloud => postgres checkpoint, sqs queue, s3 artifacts
- Use `bun:sqlite` for local persistence, `postgres` for Postgres access, and AWS SDK v3 clients for S3/SQS.

### Run lifecycle and status model
- Extend run status to include `queued`.
- Web job flow:
  1. create queued run immediately
  2. enqueue the **run ID**
  3. worker claims the run
  4. worker marks run `running`
  5. pipeline updates stages/clip progress
  6. run ends as `completed` or `failed`
- Keep CLI behavior unchanged:
  - `pipeline`, `batch`, `resume`, `status`, `clean` still execute as they do today
  - CLI does not depend on queue or worker mode

### Pipeline and persistence refactor
- Refactor current checkpoint logic behind a `CheckpointStore` interface that preserves current semantics:
  - pipeline runs
  - stage results
  - clip progress
  - completed clip lookup
- Implement:
  - `SqliteCheckpointStore`
  - `PostgresCheckpointStore`
- Add a queue abstraction with:
  - `enqueue(runId)`
  - `claimNext()`
  - `ack(runId)`
  - `release(runId, error?)`
- Implement:
  - `SqliteQueueProvider` with a persistent `queued_runs` table
  - `SqsQueueProvider` using run IDs as message payloads
- Add a worker-safe orchestrator entrypoint like `runQueuedRun(runId)` that reuses the existing pipeline logic without creating a new run.

### Artifact and downloader behavior
- Add an `ArtifactStore` abstraction:
  - local mode returns absolute filesystem paths
  - cloud mode uploads to S3 and stores `s3://bucket/key`
- Publish at minimum:
  - transcript SRT
  - `clips.json`
  - final reels
- For web artifact access:
  - local refs are streamed from disk
  - S3 refs resolve to short-lived signed URLs via redirect
- Do not implement full cross-worker artifact rehydration in this pass.
- Remove hardcoded `--cookies-from-browser chrome` usage from downloader.
- Add config:
  - `YTDLP_USE_BROWSER_COOKIES`
  - `YTDLP_BROWSER`
  - `YTDLP_COOKIES_FILE`
- Defaults:
  - local mode: browser cookies on by default
  - cloud mode: browser cookies off by default; use cookie file only if provided

### Web and worker runtimes
- Refactor the current web app so it only:
  - renders dashboard/detail views
  - creates queued runs
  - serves artifact links
  - reads progress from the checkpoint store
- Add `bun run worker` that:
  - polls the configured queue
  - processes one run at a time by default
  - uses current clip-level concurrency for inner work only
- Add worker startup preflight for required binaries:
  - `ffmpeg`
  - `yt-dlp`
  - `python3`
  - `whisper-cli`
- Web startup validates config only and does not require media binaries.

## Public Interfaces and Defaults

- New run statuses: `queued | running | completed | failed | paused`
- New env vars:
  - `APP_MODE`
  - `CHECKPOINT_BACKEND`
  - `QUEUE_BACKEND`
  - `ARTIFACT_BACKEND`
  - `DATABASE_URL` for cloud
  - `AWS_REGION`
  - `S3_BUCKET`
  - `SQS_QUEUE_URL`
  - `WORKER_CONCURRENCY` default `1`
  - `WORKER_POLL_INTERVAL_MS` default `2000`
  - `WORKER_TEMP_DIR`
  - `YTDLP_USE_BROWSER_COOKIES`
  - `YTDLP_BROWSER`
  - `YTDLP_COOKIES_FILE`
- Keep mode branching concentrated in provider construction; do not scatter `APP_MODE` checks through business logic.

## Test Plan

- Unit tests:
  - config backend derivation from `APP_MODE`
  - downloader cookie arg selection
  - sqlite queue enqueue/claim/ack/release
  - checkpoint store status transitions including `queued`
  - artifact reference parsing for local paths and `s3://` refs
- Local integration tests:
  - create queued run through the same service path the web route uses
  - local worker claims run and transitions `queued -> running -> completed`
  - dashboard/run detail read progress from checkpoint store
  - final artifact links resolve
- Regression checks:
  - current CLI commands still behave immediately and locally
  - `status` can display queued runs
  - local resume still works
- Cloud provider tests:
  - mock S3/SQS clients only
  - verify S3 key generation, SQS message shape, and signed URL redirects
- Known explicit non-goal for tests in this pass:
  - no full cross-worker cloud resume coverage, because cloud retries restart from scratch by design

## Assumptions

- Existing `src/web/` code is refactored, not thrown away
- Existing pipeline modules remain the core engine
- Postgres and AWS support are infra-ready in this pass, not production-polished
- Auth, billing, multi-user ownership, and in-browser editing are deferred
- Cloud retries are supported; cloud resume-from-artifact is deferred by choice, not by accident
