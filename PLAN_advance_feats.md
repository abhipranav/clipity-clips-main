# Creator Controls Plan: Captions, Output Presets, and High-Value Quick Wins

## Summary

Add a **high-impact quick-win creator controls bundle** built around **global defaults + per-job overrides** and a **curated preset + advanced basics** styling model.

This plan is intentionally scoped to the features that are both:
- common and useful in short-form clip apps
- realistic to ship on top of the current pipeline without turning the product into a full editor

### Ship-now feature bundle

#### Caption customization
- Caption preset picker
- Font family picker from a curated local font set
- Active word color
- Inactive word color
- Font size control
- Caption position: `top | middle | bottom | custom Y`
- Text case: `source | uppercase`
- Background box: on/off, color, opacity, radius
- Stroke/outline: on/off, color, width
- Words-per-group control

#### Output / layout controls
- Split-screen mode: `auto | always | never`
- Aspect preset: `9:16 | 1:1 | 16:9`
- Clip speed override
- Caption animation on/off

#### Clip selection controls
- Max clips override per run

#### UX improvements tied to these controls
- Settings page for global creator defaults
- New Job page advanced panel for per-run overrides
- Live caption preview card in the frontend
- Run detail page shows the resolved settings used for that run

### Defer for later
- Custom font upload
- Drag-and-drop caption editor
- Manual word timing edits
- Timeline-based clip trimming UI
- Per-word style editing
- Template marketplace / sharing
- Multi-track overlays and stickers

### Difficulty guide
- Easy: preset picker, font picker, active/inactive colors, split-screen mode, max clips, clip speed, caption animation
- Medium: box/stroke controls, custom Y positioning, aspect presets, global default persistence, resolved per-job settings
- Hard: font uploads, true WYSIWYG caption editor, manual timing, timeline editing

---

## Key Changes

### 1. Data model and settings resolution

Create one canonical `JobOptions` model and use it everywhere.

#### New shared types
Add:
- `CaptionPresetId`
- `CaptionFontId`
- `CaptionPosition`
- `SplitScreenMode`
- `AspectPreset`
- `CaptionStyleConfig`
- `OutputOptions`
- `ClipSelectionOptions`
- `JobOptions`
- `ResolvedJobOptions`

#### Exact option shape
Use this structure:

```ts
type CaptionPresetId =
  | "bold-box"
  | "clean-cinema"
  | "minimal-subtle"
  | "karaoke-pop"
  | "headline-top";

type CaptionFontId =
  | "anton"
  | "bebas-neue"
  | "montserrat"
  | "poppins"
  | "archivo-black";

type CaptionPosition = "top" | "middle" | "bottom" | "custom";
type SplitScreenMode = "auto" | "always" | "never";
type AspectPreset = "9:16" | "1:1" | "16:9";
type TextCaseMode = "source" | "uppercase";

interface CaptionStyleConfig {
  presetId: CaptionPresetId;
  fontId: CaptionFontId;
  fontSizePx: number;
  activeColor: string;
  inactiveColor: string;
  textCase: TextCaseMode;
  position: CaptionPosition;
  customYPercent: number | null;
  maxWordsPerGroup: number;
  boxEnabled: boolean;
  boxColor: string;
  boxOpacity: number;
  boxRadiusPx: number;
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidthPx: number;
}

interface OutputOptions {
  aspectPreset: AspectPreset;
  splitScreenMode: SplitScreenMode;
  clipSpeed: number;
  captionAnimate: boolean;
}

interface ClipSelectionOptions {
  maxClips: number;
}

interface ResolvedJobOptions {
  captions: CaptionStyleConfig;
  output: OutputOptions;
  clipSelection: ClipSelectionOptions;
}
```

#### Defaults
Use these defaults:
- preset: `bold-box`
- font: `anton`
- fontSizePx: `52`
- activeColor: `#FFD700`
- inactiveColor: `#FFFFFF`
- textCase: `uppercase`
- position: `middle`
- customYPercent: `null`
- maxWordsPerGroup: `6`
- boxEnabled: `true`
- boxColor: `#000000`
- boxOpacity: `1`
- boxRadiusPx: `8`
- strokeEnabled: `true`
- strokeColor: `#000000`
- strokeWidthPx: `3`
- aspectPreset: `9:16`
- splitScreenMode: `auto`
- clipSpeed: current config default
- captionAnimate: current config default
- maxClips: current config default

#### Persistence model
Because there is no auth yet:
- store one workspace-level settings record in the backend as global defaults
- store the **resolved** job options on each run at creation time

Do not store only overrides for runs. Store the fully resolved options used for that run so:
- rerenders are deterministic
- run detail can show the real applied settings
- future global-default changes do not retroactively alter older runs

#### Schema changes
Add:
- a new `app_settings` table or equivalent provider-backed settings store
- a `job_options_json` field on pipeline runs

Use JSON text storage in SQLite and JSON/text in Postgres.

### 2. Backend settings and job creation APIs

Extend the backend so the frontend can both render controls and save them safely.

#### New/updated API behavior
- `GET /api/settings`
  - return:
    - current global defaults
    - supported preset list
    - supported font list
    - supported aspect presets
    - supported split-screen modes
    - allowed ranges for numeric controls
- `PUT /api/settings`
  - save validated workspace-level defaults
- `POST /api/jobs`
  - accept:
    ```json
    {
      "videoUrl": "...",
      "options": {
        "captions": { ...partial overrides... },
        "output": { ...partial overrides... },
        "clipSelection": { ...partial overrides... }
      }
    }
    ```
  - backend merges global defaults + per-job overrides
  - backend stores `resolvedJobOptions` in the run row before queueing
- `GET /api/runs/:runId`
  - include `jobOptions`
  - include real clip metadata when available

#### Validation rules
- colors must be hex strings
- `fontSizePx`: 32–88
- `customYPercent`: 5–95 or null
- `maxWordsPerGroup`: 2–10
- `boxOpacity`: 0–1
- `boxRadiusPx`: 0–32
- `strokeWidthPx`: 0–8
- `clipSpeed`: 1.0–2.0
- `maxClips`: 0–30, where `0` means unlimited

### 3. Pipeline and rendering integration

#### Caption overlay
Refactor the Remotion caption overlay to consume `CaptionStyleConfig` instead of hardcoded constants.

Change:
- hardcoded font family
- hardcoded active/inactive colors
- hardcoded box background
- hardcoded stroke
- hardcoded center positioning
- hardcoded uppercase
- hardcoded words-per-group

Implementation requirements:
- use local bundled font files for render reliability
- do not depend on Google Fonts/network during Remotion rendering
- create a small font registry mapping `CaptionFontId -> font family + local asset`
- pass `captions` config into the Remotion composition props

#### Caption grouping
Move `WORDS_PER_GROUP` out of the generator constant and into resolved job options.

#### Output aspect preset
Resolve `aspectPreset` into output width/height:
- `9:16` => `1080x1920`
- `1:1` => `1080x1080`
- `16:9` => `1920x1080`

Do not remove env-based width/height support; env remains the global fallback.
For job-based runs, resolved aspect preset wins.

#### Split-screen behavior
Refactor the video processor so:
- `auto` => current behavior
- `always` => require split-screen even if it means failing with a clear error when no supporting asset exists
- `never` => always render single-video full-frame mode

#### Max clips and speed
Use resolved job options rather than raw env config when processing that run.

### 4. Frontend UX

#### Settings page
Add a new creator-settings section with:
- caption preset picker
- advanced caption controls
- layout/output controls
- clip selection defaults

Settings page structure:
- Caption Style
- Layout & Output
- Clip Selection
- Existing environment/system info moved below as technical info

#### New Job page
Add an advanced “Style & Output” panel below the URL composer.

Exact structure:
- Preset row at top
- Live caption preview card
- Caption controls section
- Output controls section
- Clip selection section

Per-job controls shown here:
- preset
- font
- active/inactive colors
- position
- box toggle
- stroke toggle
- split-screen mode
- aspect preset
- clip speed
- max clips
- caption animation

Keep this page usable:
- collapsed advanced panel by default
- “Use workspace defaults” summary shown when untouched
- preview updates immediately as controls change

#### Run detail page
Add a “Settings used” card showing:
- preset
- font
- colors
- split-screen mode
- aspect preset
- clip speed
- max clips

This is read-only and should reflect the actual resolved options stored on the run.

#### Preview behavior
Build a reusable `CaptionPreviewCard` component in the frontend.
It should:
- render sample words with active/inactive emphasis
- reflect font, colors, box, stroke, case, and position
- simulate the selected preset
- not attempt full video rendering in-browser

### 5. Common useful features included in this scope

These are the extra useful features to explicitly include now because they are common and realistic:

- Split-screen force on/off
- Aspect preset selection
- Max clips override
- Speed override
- Caption animation toggle
- “Settings used” display on run detail
- Real clip title/hook/duration shown anywhere the data exists
- Preset-based workflow instead of raw knobs only

These are explicitly out of scope even though other apps may have them:
- manual clip start/end editing
- caption transcript editing
- timeline scrubber/editor
- upload custom fonts
- animated stickers, emojis, or overlays
- auto-posting/social publishing

---

## Test Plan

### Backend tests
- settings resolution merges global defaults and per-job overrides correctly
- invalid color/font/position values are rejected
- `POST /api/jobs` stores resolved job options on the run
- `GET /api/settings` returns supported capability lists plus defaults
- `GET /api/runs/:runId` returns `jobOptions`
- split-screen mode behavior:
  - `auto` uses current fallback logic
  - `never` always uses single-video mode
  - `always` fails clearly when supporting footage is unavailable
- aspect presets correctly resolve to output dimensions
- words-per-group affects grouping deterministically

### Rendering tests
- caption overlay applies:
  - font family
  - colors
  - case mode
  - box on/off
  - stroke on/off
  - top/middle/bottom/custom positioning
- preset selection resolves to expected concrete style values
- no network dependency is required for caption fonts during render

### Frontend tests
- settings page loads and updates defaults
- new job page submits URL with default settings
- new job page submits URL with per-job overrides
- preview updates when controls change
- run detail displays stored resolved settings
- invalid numeric/color inputs are constrained or rejected in UI

### Acceptance criteria
- A user can change caption color and font without editing code
- A user can keep workspace defaults and optionally override them per run
- Runs render with the actual selected caption/output settings
- Run detail accurately shows what settings were used
- The UI stays simple enough for a solo creator to use quickly
- The implementation does not drift into a full editor

---

## Assumptions

- This plan targets the current Bun backend + React frontend architecture
- No auth means settings are workspace-level, not user-level
- Fonts are bundled locally for reliable rendering
- Per-run settings are resolved at queue time and stored on the run
- The goal is a strong creator-controls layer, not a timeline editor
