# Infra-First Dual-Mode SaaS Foundation Brief for Kimi

## Summary

Implement the next phase of this repo as an **infra-first SaaS foundation** that preserves the existing **local CLI pipeline** while adding a clean path to **AWS-hosted web + worker execution**.

This is not the auth/billing phase. The goal is to make the app structurally ready for real deployment without breaking the current developer workflow.

### Primary goals

- Keep existing local commands working: `pipeline`, `batch`, `resume`, `status`, `clean`
- Preserve Bun as the runtime
- Keep the existing pipeline engine largely intact
- Refactor the new web layer so it **queues runs** instead of executing the pipeline inline
- Add a separate worker process
- Support two modes without forked logic:
  - `local`: SQLite checkpoint store + local filesystem artifacts + local persistent queue
  - `cloud`: Postgres checkpoint store + S3 artifacts + SQS queue
- Preserve current UX for local experimentation
- Make cloud mode safe for AWS deployment and future auth/billing

### Non-goals for this pass

- No auth
- No Stripe/billing
- No multi-user permissions
- No browser-based editor
- No full cloud resume/re-hydration across different workers beyond what is practical in this pass
- No rewrite to Node/Next/Express

---

## Current Repo Facts To Respect

- The repo is Bun + TypeScript
- The existing pipeline already works via CLI and is centered around:
  - CLI entrypoint
  - orchestrator
  - checkpoint tracking
  - downloader / transcriber / clip identifier / video processor / caption generator
- There is already a lightweight `src/web/` browser shell added in the repo
- That browser shell currently runs the pipeline inline and must be refactored into a proper queued model
- The current downloader assumes local Chrome cookies; that must become configurable because it is not valid for AWS workers

Do not replace the pipeline engine just to make cloud mode possible. Add seams around it.

---

## Architecture Decisions

### 1. Runtime Modes

Introduce a dual-mode architecture with explicit provider selection.

Use these env vars:

- `APP_MODE=local|cloud` with default `local`
- `CHECKPOINT_BACKEND=sqlite|postgres`
- `QUEUE_BACKEND=sqlite|sqs`
- `ARTIFACT_BACKEND=local|s3`

Default behavior:
- If only `APP_MODE` is set:
  - `local` => `sqlite` checkpoint, `sqlite` queue, `local` artifacts
  - `cloud` => `postgres` checkpoint, `sqs` queue, `s3` artifacts
- Specific backend env vars override `APP_MODE` defaults

### 2. Preserve Local CLI Behavior

Keep current commands behaving as they do now:
- `pipeline` runs immediately in-process
- `batch` runs immediately in-process
- `resume` works as it currently does
- `status` and `clean` continue to work

Do not force queue/worker usage onto the CLI.

### 3. SaaS/Web Behavior

Web requests must not execute the pipeline inline anymore.

New browser job flow:
1. User submits a YouTube URL
2. Web app creates a queued run record immediately
3. Web app enqueues the run ID
4. Worker claims the run and executes it
5. Web reads progress from the checkpoint store

This means the **run ID becomes the canonical queued job identifier**. Do not introduce a separate top-level “job” entity unless absolutely required.

### 4. Run Status Model

Extend run status to include:

- `queued`
- `running`
- `completed`
- `failed`
- keep `paused` only if already used meaningfully; otherwise leave supported but do not build new behavior around it

When a run is created by the web app, initial status must be `queued`.

When a worker starts processing a queued run, status becomes `running`.

### 5. Provider Abstractions

Add three provider interfaces:

#### Checkpoint Store
Back the existing run/stage/clip progress model.

Methods should cover:
- create queued run
- create immediate run
- mark run running/completed/failed
- get run
- list runs
- start/complete/fail stage
- get stage result(s)
- update clip progress
- list clip progress
- get completed clip IDs

Implementations:
- `SqliteCheckpointStore` using the existing SQLite schema as the base
- `PostgresCheckpointStore` mirroring the same logical schema

#### Queue Provider
Queue run IDs for workers.

Methods:
- enqueue `runId`
- claim next queued run
- ack success
- nack / release on failure
- optionally heartbeat/visibility extension if needed

Implementations:
- `SqliteQueueProvider`
- `SqsQueueProvider`

#### Artifact Store
Publish and resolve artifact references.

Methods:
- publish local file -> artifact reference
- optionally publish text/json artifacts
- resolve artifact reference for web access
- optionally download artifact for rehydration later

Implementations:
- `LocalArtifactStore`
- `S3ArtifactStore`

Artifact references:
- local mode: absolute local file path
- cloud mode: `s3://bucket/key`

Do not store signed URLs in the checkpoint DB. Store stable artifact references and derive access URLs when serving them.

---

## Implementation Changes

### A. Checkpoint Refactor

Refactor the current checkpoint logic into a backend-agnostic store.

Requirements:
- Preserve current table semantics:
  - pipeline runs
  - stage results
  - clip progress
- Add support for `queued` status
- Add whatever minimal queue-related metadata is needed for local mode only

Use one logical schema across SQLite and Postgres.

For local SQLite queueing, add a queue table such as:
- `queued_runs`
  - `run_id`
  - `status` (`queued`, `claimed`)
  - `attempts`
  - `available_at`
  - `claimed_at`
  - `last_error`
  - `created_at`

The web app writes to this table in local mode. The worker polls it.

### B. Orchestrator Changes

Do not rewrite the pipeline stages.

Add a worker-safe entrypoint such as:
- `runQueuedRun(runId: string): Promise<void>`

Behavior:
- load existing queued run from checkpoint store
- mark it `running`
- execute the same pipeline logic currently used by `run(videoUrl)`
- use the existing run ID instead of creating a fresh one
- preserve per-stage and per-clip checkpoint updates

Keep the current immediate `run(videoUrl)` path for CLI use.

### C. Web Server Changes

Refactor the existing web server so it becomes:
- dashboard + HTML views
- job submission
- artifact access
- no in-process pipeline execution

Routes:
- `GET /` dashboard
- `POST /jobs` create queued run and enqueue it
- `GET /runs/:runId` run detail
- `GET /artifacts/:encodedRef` artifact access

Dashboard must show:
- queued count
- running count
- completed count
- failed count
- recent runs
- a clear note when no worker is running or jobs are stuck queued if that is detectable

Run detail must show:
- run summary
- global stage timeline
- per-clip progress
- artifact links

Artifact serving behavior:
- local artifact ref => stream file from disk
- S3 artifact ref => generate a short-lived signed URL and redirect, or stream via server if simpler
- keep this behavior behind the artifact store abstraction

### D. Worker Process

Add a dedicated worker entrypoint:
- `bun run worker`

Worker behavior:
- select queue provider from config
- poll/claim queued runs
- process one run at a time by default
- update checkpoint status on success/failure
- leave clip-level parallelism to existing `MAX_PARALLEL_CLIPS`

Add env vars:
- `WORKER_CONCURRENCY`, default `1`
- `WORKER_POLL_INTERVAL_MS`, default `2000`
- `WORKER_TEMP_DIR`
  - local default: `./data/worker-tmp`
  - cloud default: `/tmp/clipity`

Initial implementation should prioritize stability over throughput.

### E. Artifact Publishing Strategy

Processing still happens on the worker’s local disk.

After a stage writes an artifact locally:
- publish the artifact through the artifact store
- checkpoint store records the returned artifact reference
- local mode returns the same absolute path
- cloud mode uploads to S3 and stores `s3://...`

For this pass:
- final reels must be published to the artifact store
- transcript SRT and clips JSON should also be published
- clip intermediate artifacts may be published if easy, but do not overcomplicate the first pass

Important constraint:
- Do not break current local resume semantics
- In cloud mode, do not promise full cross-worker artifact rehydration unless it is explicitly implemented
- If full remote resume is not implemented in this pass, document it clearly:
  - local resume remains fully supported
  - cloud queued runs are supported
  - cloud retries may restart work rather than resuming from remote stage artifacts

### F. Downloader / Cookies Changes

The current downloader must stop hardcoding `--cookies-from-browser chrome`.

Add config:
- `YTDLP_USE_BROWSER_COOKIES=true|false`
- `YTDLP_BROWSER=chrome` default for local only
- `YTDLP_COOKIES_FILE` optional absolute path

Rules:
- local default:
  - use browser cookies if `YTDLP_USE_BROWSER_COOKIES` is unset
- cloud default:
  - do not use browser cookies
  - use `YTDLP_COOKIES_FILE` if provided
  - otherwise run without cookie args

Build yt-dlp cookie arguments in one helper function and use it for both metadata fetch and download.

### G. Config and Startup Validation

Extend config validation to include all new env vars.

Add startup preflight checks:
- web server:
  - validate config only
- worker:
  - validate config
  - confirm presence of required binaries for the current mode:
    - `ffmpeg`
    - `yt-dlp`
    - `python3`
    - `whisper-cli`
  - if cloud mode uses S3/SQS, validate AWS env presence before polling

Do not make the web server require FFmpeg to boot if the worker owns processing.

### H. Scripts / Commands

Add:
- `bun run web`
- `bun run worker`

Optional if simple:
- `bun run dev:saas`
  - starts web + worker locally for convenience

Keep existing commands untouched.

---

## Public Interfaces / Types / Config Changes

### New / Updated status types

Update run status union to include:
- `queued`
- `running`
- `completed`
- `failed`
- `paused` only if still retained

### New config/env surface

Required in cloud mode:
- `DATABASE_URL`
- `AWS_REGION`
- `S3_BUCKET`
- `SQS_QUEUE_URL`

Useful defaults:
- `APP_MODE=local`
- `PORT=3000`
- `WORKER_CONCURRENCY=1`
- `WORKER_POLL_INTERVAL_MS=2000`
- `WORKER_TEMP_DIR`
- `YTDLP_USE_BROWSER_COOKIES`
- `YTDLP_BROWSER`
- `YTDLP_COOKIES_FILE`

### New module boundaries

Create or refactor toward these subsystem boundaries:

- config selection
- checkpoint store
- queue provider
- artifact store
- worker runtime
- web runtime

Do not scatter `if (APP_MODE === "...")` checks throughout business logic. Keep mode switching concentrated in provider construction.

---

## Testing and Acceptance Criteria

## Unit tests

Add tests for:
- config mode selection and default backend derivation
- downloader cookie argument selection
- SQLite queue enqueue/claim/ack behavior
- artifact ref parsing for local paths vs `s3://...`
- checkpoint store status transitions, including `queued`

## Integration tests (local mode only)

Add at least one end-to-end local-mode flow:
1. submit a queued run through the web/app layer
2. local worker claims it
3. run transitions `queued -> running -> completed`
4. dashboard and run detail reflect progress
5. final artifact link resolves

If a full web POST integration is too heavy, test at the service layer with the same code paths the web route uses.

## Regression tests

Ensure existing tests still pass or are updated only where status enum expansion requires it.

Add explicit checks that:
- CLI `pipeline` still executes immediately without queue
- CLI `status` can display queued runs
- local resume behavior still works

## Cloud provider tests

Do not use live AWS in automated tests.

Mock S3/SQS interactions and verify:
- correct message shapes
- correct artifact key generation
- correct signed URL or redirect behavior

---

## Acceptance Definition

This implementation is complete when all of the following are true:

1. Local CLI commands behave the same as before.
2. `bun run web` starts a browser UI that creates queued runs instead of running jobs inline.
3. `bun run worker` processes queued runs in local mode using a persistent local queue.
4. Local mode preserves current filesystem-based behavior and remains the best dev path.
5. Cloud mode can be configured with Postgres + S3 + SQS without changing pipeline logic.
6. Downloader cookie behavior is configurable and no longer assumes Chrome exists.
7. The web dashboard reads run progress from the checkpoint store, not in-memory process state.
8. Artifact serving works for local refs and has a clear resolution path for S3 refs.
9. The implementation does not remove or break the current CLI pipeline workflow.

---

## Implementation Order

Implement in this order:

1. Config surface and provider factory
2. Checkpoint store abstraction
3. Queue provider abstraction with SQLite local implementation
4. Orchestrator support for queued existing runs
5. Refactor web server to queue runs instead of executing inline
6. Add worker runtime for local mode
7. Add artifact store abstraction with local implementation
8. Add Postgres checkpoint store
9. Add S3 artifact store
10. Add SQS queue provider
11. Add downloader cookie config + startup validation
12. Add docs and tests

Do not start with AWS providers first. Get local dual-process mode correct before cloud providers.

---

## Assumptions and Defaults

- Bun remains the runtime
- Keep the current repo structure and coding style
- Preserve current pipeline modules as much as possible
- The existing web files are a starting point, not throwaway work
- Local mode is the primary developer experience
- Cloud mode is infra-ready in this pass, not fully polished SaaS
- Full auth/billing is intentionally deferred
- Full cross-worker remote artifact resume may be deferred if it adds too much complexity; if deferred, document it explicitly and do not fake it

