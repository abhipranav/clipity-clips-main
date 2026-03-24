import type { PipelineRun, StageResult, ClipProgressSnapshot } from "../pipeline/types";

interface DashboardStats {
  totalRuns: number;
  queuedRuns: number;
  runningRuns: number;
  completedRuns: number;
  failedRuns: number;
}

interface JobQueueSnapshot {
  activeRunIds: string[];
  queuedJobs: number;
  hasQueuedWithoutWorker?: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function badgeClass(status: string): string {
  switch (status) {
    case "completed":
      return "success";
    case "failed":
      return "danger";
    case "running":
    case "in_progress":
      return "warn";
    default:
      return "muted";
  }
}

function layout(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root {
        --bg: #f7efe4;
        --surface: rgba(255, 252, 247, 0.86);
        --surface-strong: #fffaf1;
        --text: #1f1b18;
        --muted: #6d6256;
        --accent: #ff6b35;
        --accent-2: #125b50;
        --line: rgba(31, 27, 24, 0.12);
        --success: #1f7a4d;
        --warn: #9b6b00;
        --danger: #a12727;
        --shadow: 0 20px 60px rgba(73, 52, 34, 0.12);
      }

      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Georgia", "Times New Roman", serif;
        color: var(--text);
        background:
          radial-gradient(circle at top left, rgba(255, 107, 53, 0.18), transparent 26%),
          radial-gradient(circle at top right, rgba(18, 91, 80, 0.16), transparent 24%),
          linear-gradient(180deg, #fff7ec 0%, var(--bg) 100%);
      }

      a { color: inherit; }

      .shell {
        max-width: 1180px;
        margin: 0 auto;
        padding: 36px 20px 64px;
      }

      .hero {
        display: grid;
        gap: 24px;
        padding: 28px;
        border: 1px solid var(--line);
        border-radius: 28px;
        background: linear-gradient(145deg, rgba(255, 250, 241, 0.95), rgba(255, 244, 230, 0.88));
        box-shadow: var(--shadow);
      }

      .nav {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        align-items: center;
        flex-wrap: wrap;
      }

      .eyebrow {
        letter-spacing: 0.18em;
        text-transform: uppercase;
        font-size: 12px;
        color: var(--accent-2);
        font-weight: 700;
      }

      h1, h2, h3, p { margin: 0; }

      .hero-copy {
        display: grid;
        gap: 14px;
        max-width: 720px;
      }

      .hero-copy h1 {
        font-size: clamp(36px, 5vw, 62px);
        line-height: 0.95;
      }

      .hero-copy p {
        font-size: 18px;
        line-height: 1.55;
        color: var(--muted);
      }

      .grid {
        display: grid;
        gap: 20px;
        margin-top: 24px;
      }

      .stats {
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--line);
        border-radius: 22px;
        padding: 22px;
        box-shadow: var(--shadow);
        backdrop-filter: blur(10px);
      }

      .stat-value {
        font-size: 34px;
        font-weight: 700;
        margin-top: 8px;
      }

      .stack {
        display: grid;
        gap: 16px;
      }

      form {
        display: grid;
        gap: 14px;
      }

      label {
        display: grid;
        gap: 8px;
        font-weight: 700;
      }

      input {
        width: 100%;
        padding: 14px 16px;
        border-radius: 14px;
        border: 1px solid var(--line);
        background: rgba(255, 255, 255, 0.82);
        font: inherit;
        color: var(--text);
      }

      button {
        border: 0;
        border-radius: 999px;
        padding: 14px 18px;
        font: inherit;
        font-weight: 700;
        color: white;
        background: linear-gradient(135deg, var(--accent), #f04f78);
        cursor: pointer;
      }

      .button-link {
        text-decoration: none;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        border-radius: 999px;
        background: rgba(18, 91, 80, 0.1);
      }

      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 14px;
      }

      th, td {
        text-align: left;
        padding: 14px 10px;
        border-bottom: 1px solid var(--line);
        vertical-align: top;
      }

      th {
        color: var(--muted);
        font-size: 12px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .badge {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        border-radius: 999px;
        padding: 6px 10px;
        font-size: 12px;
        font-weight: 700;
        background: rgba(31, 27, 24, 0.08);
      }

      .badge.success { color: var(--success); background: rgba(31, 122, 77, 0.1); }
      .badge.warn { color: var(--warn); background: rgba(155, 107, 0, 0.12); }
      .badge.danger { color: var(--danger); background: rgba(161, 39, 39, 0.1); }
      .badge.muted { color: var(--muted); }

      .meta {
        color: var(--muted);
        font-size: 14px;
        line-height: 1.5;
      }

      .mono {
        font-family: "SFMono-Regular", "Menlo", monospace;
        font-size: 13px;
      }

      .columns {
        grid-template-columns: 1.1fr 0.9fr;
      }

      .inline-list {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }

      .notice {
        padding: 14px 16px;
        border-radius: 16px;
        background: rgba(18, 91, 80, 0.08);
        color: var(--accent-2);
      }

      ul {
        margin: 0;
        padding-left: 18px;
      }

      @media (max-width: 900px) {
        .columns { grid-template-columns: 1fr; }
        .hero-copy h1 { line-height: 1.02; }
      }
    </style>
  </head>
  <body>
    <main class="shell">${body}</main>
  </body>
</html>`;

  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

export function renderDashboard(params: {
  runs: PipelineRun[];
  stats: DashboardStats;
  queue: JobQueueSnapshot;
  appUrl: string;
}): Response {
  const rows =
    params.runs.length === 0
      ? `<tr><td colspan="6">No runs yet. Drop a YouTube URL below and let the machine cook.</td></tr>`
      : params.runs
          .map(
            (run) => `<tr>
          <td><a href="/runs/${escapeHtml(run.id)}" class="mono">${escapeHtml(run.id.slice(0, 8))}</a></td>
          <td>${escapeHtml(run.videoTitle || run.videoId)}</td>
          <td><span class="badge ${badgeClass(run.status)}">${escapeHtml(run.status)}</span></td>
          <td>${escapeHtml(run.currentStage)}</td>
          <td class="meta">${escapeHtml(formatDate(run.updatedAt))}</td>
          <td class="meta">${escapeHtml(run.videoUrl)}</td>
        </tr>`,
          )
          .join("");

  return layout(
    "Clipity SaaS MVP",
    `
      <section class="hero">
        <div class="nav">
          <div>
            <div class="eyebrow">Clipity Studio</div>
          </div>
          <div class="inline-list">
            <a class="button-link" href="${escapeHtml(params.appUrl)}">Refresh dashboard</a>
          </div>
        </div>
        <div class="hero-copy">
          <h1>Turn long videos into branded shorts with your existing pipeline.</h1>
          <p>This is the first SaaS layer: submit jobs, watch progress, inspect outputs, and prove the workflow in a browser before we add auth, billing, uploads, and team review.</p>
        </div>
      </section>

      <section class="grid stats">
        <article class="card"><div class="eyebrow">Total runs</div><div class="stat-value">${params.stats.totalRuns}</div></article>
        <article class="card"><div class="eyebrow">Queued</div><div class="stat-value">${params.stats.queuedRuns}</div></article>
        <article class="card"><div class="eyebrow">Running now</div><div class="stat-value">${params.stats.runningRuns}</div></article>
        <article class="card"><div class="eyebrow">Completed</div><div class="stat-value">${params.stats.completedRuns}</div></article>
        <article class="card"><div class="eyebrow">Failed</div><div class="stat-value">${params.stats.failedRuns}</div></article>
      </section>

      <section class="grid columns">
        <article class="card stack">
          <div>
            <div class="eyebrow">New job</div>
            <h2>Queue a source video</h2>
          </div>
          <form method="post" action="/jobs">
            <label>
              YouTube URL
              <input type="url" name="videoUrl" placeholder="https://www.youtube.com/watch?v=..." required />
            </label>
            <button type="submit">Start pipeline job</button>
          </form>
          <div class="notice meta">The current MVP uses the existing orchestrator and checkpoint DB, so submitted jobs immediately become first-class pipeline runs.</div>
        </article>

        <article class="card stack">
          <div>
            <div class="eyebrow">Queue health</div>
            <h2>Background worker snapshot</h2>
          </div>
          <div class="meta">Active runs: ${params.queue.activeRunIds.length}</div>
          <div class="meta">Queued jobs: ${params.queue.queuedJobs}</div>
          ${params.queue.hasQueuedWithoutWorker ? `<div class="notice" style="background:rgba(155,107,0,0.12);color:var(--warn)">⚠️ Jobs are queued but no worker is running. Start the worker with <code>bun run worker</code></div>` : ""}
          <div class="meta mono">${escapeHtml(params.queue.activeRunIds.join(", ") || "none")}</div>
          <div class="meta">Jobs are processed by the worker. The web server only creates queued runs.</div>
        </article>
      </section>

      <section class="grid">
        <article class="card stack">
          <div>
            <div class="eyebrow">Runs</div>
            <h2>Recent pipeline activity</h2>
          </div>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>Run</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Stage</th>
                  <th>Updated</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>
        </article>
      </section>
    `,
  );
}

export function renderRunDetail(params: {
  run: PipelineRun;
  stageResults: StageResult[];
  clipProgress: ClipProgressSnapshot[];
  finalReels: string[];
}): Response {
  const stageRows =
    params.stageResults.length === 0
      ? `<tr><td colspan="5">No stage data yet.</td></tr>`
      : params.stageResults
          .map(
            (stage) => `<tr>
          <td>${escapeHtml(stage.stage)}</td>
          <td><span class="badge ${badgeClass(stage.status)}">${escapeHtml(stage.status)}</span></td>
          <td class="meta">${escapeHtml(formatDate(stage.startedAt))}</td>
          <td class="meta">${escapeHtml(stage.completedAt ? formatDate(stage.completedAt) : "In progress")}</td>
          <td class="meta">${escapeHtml(stage.error ?? "")}</td>
        </tr>`,
          )
          .join("");

  const clipRows =
    params.clipProgress.length === 0
      ? `<tr><td colspan="5">Clip work has not started yet.</td></tr>`
      : params.clipProgress
          .map(
            (clip) => `<tr>
          <td class="mono">${escapeHtml(clip.clipId.slice(0, 8))}</td>
          <td>${clip.clipIndex + 1}</td>
          <td>${escapeHtml(clip.currentStage)}</td>
          <td><span class="badge ${badgeClass(clip.status)}">${escapeHtml(clip.status)}</span></td>
          <td class="meta">${escapeHtml(formatDate(clip.updatedAt))}</td>
        </tr>`,
          )
          .join("");

  const reelList =
    params.finalReels.length === 0
      ? `<p class="meta">No final reels available yet.</p>`
      : `<ul>${params.finalReels
          .map(
            (filePath) =>
              `<li><a class="mono" href="/artifacts/${encodeURIComponent(filePath)}">${escapeHtml(filePath)}</a></li>`,
          )
          .join("")}</ul>`;

  return layout(
    `Run ${params.run.id}`,
    `
      <section class="hero">
        <div class="nav">
          <a class="button-link" href="/">Back to dashboard</a>
          <span class="badge ${badgeClass(params.run.status)}">${escapeHtml(params.run.status)}</span>
        </div>
        <div class="hero-copy">
          <div class="eyebrow">Run detail</div>
          <h1>${escapeHtml(params.run.videoTitle || params.run.videoId)}</h1>
          <p>${escapeHtml(params.run.videoUrl)}</p>
        </div>
        <div class="inline-list">
          <span class="badge muted">Stage: ${escapeHtml(params.run.currentStage)}</span>
          <span class="badge muted">Created: ${escapeHtml(formatDate(params.run.createdAt))}</span>
          <span class="badge muted">Updated: ${escapeHtml(formatDate(params.run.updatedAt))}</span>
        </div>
      </section>

      <section class="grid columns">
        <article class="card stack">
          <div>
            <div class="eyebrow">Global stages</div>
            <h2>Pipeline timeline</h2>
          </div>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Started</th>
                  <th>Completed</th>
                  <th>Error</th>
                </tr>
              </thead>
              <tbody>${stageRows}</tbody>
            </table>
          </div>
        </article>

        <article class="card stack">
          <div>
            <div class="eyebrow">Outputs</div>
            <h2>Rendered reels</h2>
          </div>
          ${reelList}
        </article>
      </section>

      <section class="grid">
        <article class="card stack">
          <div>
            <div class="eyebrow">Clip jobs</div>
            <h2>Per-clip progress</h2>
          </div>
          <div style="overflow:auto">
            <table>
              <thead>
                <tr>
                  <th>Clip</th>
                  <th>#</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>${clipRows}</tbody>
            </table>
          </div>
        </article>
      </section>
    `,
  );
}

export function renderNotFound(message: string): Response {
  return layout(
    "Not found",
    `<section class="hero"><div class="hero-copy"><div class="eyebrow">404</div><h1>That page wandered off.</h1><p>${escapeHtml(message)}</p><a class="button-link" href="/">Go home</a></div></section>`,
  );
}
