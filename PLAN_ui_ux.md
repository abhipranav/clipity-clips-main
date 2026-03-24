# Premium App-First UI/UX Plan for Clipity

## Summary

Build a **premium React app shell** on top of the Bun backend for a **solo-creator-first**, **cinematic editorial** product experience. The app should feel like a polished media control room for turning long videos into short-form clips, not a generic admin dashboard. The signed-in product is the focus; no marketing-site work in this pass.

Design intent:
- Make the product feel fast, trustworthy, and premium even when the underlying jobs are slow.
- Turn the current plain dashboard into a visually rich workflow: input, queue, progress, clip review, outputs, and settings.
- Do not silently invent unsupported backend actions. If a control is future-facing, render it intentionally as disabled or “coming next,” not fake-functional.

Locked decisions:
- Frontend: React + TypeScript app shell
- Runtime split: Bun backend serves API + static app; React owns the interactive UI
- Audience: solo creators first
- Scope: product app only
- Visual direction: cinematic editorial
- Backend compatibility rule: only current-backed actions are live; future actions can appear as explicit stubs

## Product Experience Blueprint

### Core product story
- The product should feel like “drop a source in, watch the machine work, approve the best cuts, ship fast.”
- The dominant emotional goals are: confidence, momentum, clarity, and craft.
- The UI should reduce anxiety around queueing and rendering by always showing what is happening now, what is next, and what is ready.

### Primary app routes
- `/` becomes the premium home dashboard
- `/new` is the dedicated create-job flow
- `/runs` is the full run library with filtering and search
- `/runs/:runId` is the run detail and clip review view
- `/library` is the exported outputs/artifacts view
- `/queue` is the ops-lite queue and worker health page
- `/settings` is workflow defaults and system configuration
- Unknown routes should fall back to the React app and show an in-app not-found screen, not a raw server message

### Core user flows
1. First-time user flow
- Empty-state dashboard with a high-confidence hero, sample URL prompt, and three-step setup checklist
- “Paste a YouTube URL” is the dominant first action
- Show a lightweight “how this works” strip: ingest, identify, cut, caption, export

2. Create-job flow
- Large source-input field with paste-first behavior
- Instant client-side URL validation
- Inline source preview card after paste with extracted video ID/title placeholder
- Compact advanced panel with clearly separated sections:
  - live now: source URL
  - coming next: caption preset, split-screen mode, clip limit override, speed preset
- Primary CTA: “Queue Job”
- Secondary CTA: “Paste Example URL”

3. Dashboard flow
- Top summary strip: queued, running, ready, failed
- Main area: recent runs and “ready to review” outputs
- Right rail or upper-right cluster: queue health, worker status, processing tips
- Always show the next best action: queue first job, review a completed run, retry a failed run, or open settings

4. Run review flow
- A run detail page must feel like an editing bay, not a debug page
- Top section: video identity, run status, timeline progress, and main actions
- Mid section: global stage timeline plus execution notes
- Bottom section: clip cards with title, hook line, score, artifact actions, and processing state
- Clip cards should support selection, quick scan, and “what’s done vs still cooking” at a glance

5. Outputs flow
- Library view groups finished clips by source video
- Cards emphasize thumbnail, title, duration, created time, and primary actions
- Primary actions: open, download, copy title, copy hook
- Secondary actions can stay hidden in overflow

### UX principles
- One dominant action per screen
- Show queue reality without exposing raw backend complexity
- Always separate “system status” from “creative output”
- Use progressive disclosure: summary first, details on demand
- Empty, loading, failed, queued, processing, partial-complete, and fully-complete states must all be first-class

## Visual Design System

### Brand direction
- Tone: premium studio, editorial media desk, warm but sharp
- Avoid generic SaaS blue/purple aesthetics
- Default theme is light with cinematic warmth; use dark accents selectively for depth
- Do not implement full dark mode in this pass; instead use “theater” sections on run/output surfaces for media emphasis

### Typography
- Display/headlines: `Fraunces`
- UI/body: `Manrope`
- Monospace: `IBM Plex Mono`
- Headline style: bold, compressed line-height, high contrast
- Status/meta text: small uppercase labels with generous letter spacing
- Avoid Inter, Roboto, Arial, and generic system-stack feel

### Color system
- Base background: warm ivory / bone
- Primary surface: translucent cream or light stone
- Primary text: deep graphite
- Accent 1: copper / ember orange
- Accent 2: deep forest green
- Caution: muted amber
- Error: rich brick red
- Media accent use should come from actual thumbnail colors where possible, but UI chrome remains grounded and restrained

### Layout language
- Large editorial headers
- Rounded but not toy-like surfaces
- Film-strip style rows and card clusters for outputs
- Strong spacing rhythm with visible hierarchy
- Desktop-first layouts with graceful single-column collapse on tablet/mobile

### Motion language
- Use Framer Motion
- Motion must communicate state, not just decorate
- Required motion patterns:
  - staggered dashboard card entrances
  - gentle count-up on metric cards
  - page transition crossfade + slight vertical travel
  - queue/progress shimmer for in-progress rows
  - clip card selection emphasis
  - preview panel open/close motion
- Avoid excessive springiness, bounce, or novelty animations

### Component set
- App shell with left rail, top bar, content canvas
- Metric cards
- Status badges and pills
- URL input composer
- Run cards
- Clip cards
- Stage timeline
- Empty-state blocks
- Activity log strip
- Artifact action bar
- Filter chips
- Command/search input
- Inline alerts
- Right-side detail drawer for run or clip metadata on large screens

## Frontend Architecture and API Contract

### Frontend stack
- React + TypeScript
- Vite for the app build
- React Router for route handling
- TanStack Query for server state
- Framer Motion for motion
- CSS variables plus modular stylesheet strategy or Tailwind only if Kimi can keep a strong custom design language; do not produce generic utility-styled UI
- Keep Bun as the backend/API server

### Backend serving model
- Bun serves `/api/*` JSON endpoints
- Bun serves the built React app assets
- Non-API app routes return the React shell for client routing
- Keep existing server responsibilities for queueing and artifact access, but move UI rendering out of HTML-string generation

### Required API shapes
- `GET /api/app-summary`
  - returns counts, queue state, recent runs, ready outputs, worker health summary
- `POST /api/jobs`
  - accepts `{ videoUrl: string }`
  - returns `{ runId, status }`
- `GET /api/runs`
  - returns list items with status, stage, title, source URL, timestamps, clip counts if derivable
- `GET /api/runs/:runId`
  - returns run core, global stages, clip progress, artifacts, and warnings
- `GET /api/library`
  - returns grouped completed outputs
- `GET /api/queue`
  - returns queued count, running count, worker/config summary, retry-from-scratch note
- `GET /api/settings`
  - returns current env-backed settings that are safe to display
- `GET /api/system/health`
  - returns backend/provider health suitable for the UI status banner

### Backend compatibility rules
- Only functional controls should submit mutating requests
- Advanced controls that are not wired yet must be visually present only if explicitly disabled
- Do not create phantom APIs just to satisfy the design
- If queue retry or clip-level actions are not implemented yet, render them as disabled with explanatory copy

## Screen-by-Screen UX Spec

### Home dashboard
- Hero section with headline, short product promise, and primary CTA to queue a job
- Metrics row for queued, running, ready, failed
- “Ready to review” section above generic recent runs
- Recent runs list with richer cards or compact table toggle
- Queue health card that calls out whether a worker is connected or jobs are waiting
- Helpful empty state when there are no runs
- On small screens, queue health moves below the main content, not above the CTA

### New job page
- Large centered composer
- Inline validation for malformed URLs
- After paste, show a source preview block
- Show a compact “what happens next” timeline under the input
- Advanced options accordion with disabled controls for future per-run customization
- Success state routes user directly to the new run detail page, not just back to dashboard

### Runs index
- Search by title/URL/run ID
- Filter chips for queued, running, completed, failed
- Sort options: newest, oldest, status, recently updated
- Density toggle: cards on desktop by default, table optional for power users
- Bulk actions are out of scope for now; do not imply them unless disabled

### Run detail page
- Header: source title, URL, run ID, status, stage, created/updated
- Main media panel placeholder or artifact preview area
- Stage timeline with strong visual treatment and explicit current stage
- Clip review grid beneath timeline
- Each clip card contains:
  - title
  - hook line
  - status pill
  - stage or completion state
  - artifact actions
  - concise meta row
- Right-side details drawer on desktop for selected clip
- On mobile, selected clip opens a bottom sheet instead

### Library page
- Group by source video
- Lead card per source with count of completed clips
- Child clip cards with preview-first emphasis
- Strong “download all outputs” affordance can be present only if backend supports it; otherwise hide it entirely

### Queue page
- Treat this as “ops lite,” not an engineering console
- Show worker state, provider mode, queue counts, and recent failures
- Explain retry-from-scratch behavior for cloud mode in plain language
- Keep technical strings secondary and collapsible

### Settings page
- Organize into:
  - workflow defaults
  - processing defaults
  - environment/provider summary
  - downloader auth/cookie mode
- Unsafe secrets should never be rendered directly
- For env-backed values, show current mode and whether a setting is set, not raw secret material

## Implementation Phasing for Kimi

### Phase 1
- Replace server-rendered HTML UI with React app shell
- Build app layout, dashboard, new job page, runs list, run detail, queue, settings
- Wire only existing working APIs and states
- Ship polished loading, empty, and error states

### Phase 2
- Add richer run detail interactions and clip selection drawer
- Add library page and grouped outputs view
- Add subtle motion system and page transitions
- Improve queue health communication and system banners

### Phase 3
- Add future-facing disabled controls for per-run options, presets, and review actions
- Add keyboard shortcuts, quick search, and power-user density controls
- Refine responsive behavior and animation polish

## Test Plan

### Functional scenarios
- Queue a valid YouTube URL from the new job page
- See the run appear immediately in dashboard and runs list
- Open a run detail page during queued, running, failed, and completed states
- Open artifact links from completed clips
- Navigate all app routes without full-page server-render regressions

### UX state coverage
- empty dashboard
- invalid URL entry
- no worker connected
- queued with no progress yet
- run partially complete
- run fully complete
- failed run
- no outputs in library
- settings with unset optional values

### Visual and interaction checks
- desktop at 1440px+
- laptop at 1280px
- tablet at 768px
- mobile at 390px
- keyboard focus visibility on all interactive controls
- motion reduced correctly when `prefers-reduced-motion` is enabled
- color contrast remains accessible on warm surfaces and accent pills

### Acceptance criteria
- The app looks like a premium creator product, not a plain admin panel
- The first-run dashboard makes it obvious what to do next
- The queue and processing experience feel trustworthy and comprehensible
- Run detail pages make completed output feel valuable and shareable
- Future features are hinted intentionally without pretending to work

## Assumptions

- No marketing site work in this pass
- No auth or billing work in this pass
- Bun backend remains in place and powers the React app via JSON APIs
- Existing backend limitations are respected; unsupported actions are disabled, not faked
- The design should favor clarity and polish over raw information density, since the initial audience is solo creators rather than operations teams
