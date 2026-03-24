export type CaptionPresetId =
  | "bold-box"
  | "clean-cinema"
  | "minimal-subtle"
  | "karaoke-pop"
  | "headline-top";

export type CaptionFontId =
  | "anton"
  | "bebas-neue"
  | "montserrat"
  | "poppins"
  | "archivo-black";

export type CaptionPosition = "top" | "middle" | "bottom" | "custom";
export type SplitScreenMode = "auto" | "always" | "never";
export type AspectPreset = "9:16" | "1:1" | "16:9";
export type TextCaseMode = "source" | "uppercase";

export interface CaptionStyleConfig {
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

export interface OutputOptions {
  aspectPreset: AspectPreset;
  splitScreenMode: SplitScreenMode;
  clipSpeed: number;
  captionAnimate: boolean;
}

export interface ClipSelectionOptions {
  maxClips: number;
}

export interface JobOptions {
  captions?: Partial<CaptionStyleConfig>;
  output?: Partial<OutputOptions>;
  clipSelection?: Partial<ClipSelectionOptions>;
}

export interface ResolvedJobOptions {
  captions: CaptionStyleConfig;
  output: OutputOptions;
  clipSelection: ClipSelectionOptions;
}

export interface AppSettings {
  id: string;
  defaults: ResolvedJobOptions;
  updatedAt: string;
}

// Validation constants
export const VALIDATION = {
  fontSizePx: { min: 32, max: 88 },
  customYPercent: { min: 5, max: 95 },
  maxWordsPerGroup: { min: 2, max: 10 },
  boxOpacity: { min: 0, max: 1 },
  boxRadiusPx: { min: 0, max: 32 },
  strokeWidthPx: { min: 0, max: 8 },
  clipSpeed: { min: 1, max: 2 },
  maxClips: { min: 0, max: 30 },
} as const;

// Default values as per the plan
export const DEFAULT_CAPTION_STYLE: CaptionStyleConfig = {
  presetId: "bold-box",
  fontId: "anton",
  fontSizePx: 52,
  activeColor: "#FFD700",
  inactiveColor: "#FFFFFF",
  textCase: "uppercase",
  position: "middle",
  customYPercent: null,
  maxWordsPerGroup: 6,
  boxEnabled: true,
  boxColor: "#000000",
  boxOpacity: 1,
  boxRadiusPx: 8,
  strokeEnabled: true,
  strokeColor: "#000000",
  strokeWidthPx: 3,
};

export const DEFAULT_OUTPUT_OPTIONS: OutputOptions = {
  aspectPreset: "9:16",
  splitScreenMode: "auto",
  clipSpeed: 1.2,
  captionAnimate: true,
};

export const DEFAULT_CLIP_SELECTION: ClipSelectionOptions = {
  maxClips: 0,
};

export const DEFAULT_RESOLVED_OPTIONS: ResolvedJobOptions = {
  captions: DEFAULT_CAPTION_STYLE,
  output: DEFAULT_OUTPUT_OPTIONS,
  clipSelection: DEFAULT_CLIP_SELECTION,
};

// Supported capability lists
export const SUPPORTED_CAPTION_PRESETS: CaptionPresetId[] = [
  "bold-box",
  "clean-cinema",
  "minimal-subtle",
  "karaoke-pop",
  "headline-top",
];

export const SUPPORTED_FONTS: CaptionFontId[] = [
  "anton",
  "bebas-neue",
  "montserrat",
  "poppins",
  "archivo-black",
];

export const SUPPORTED_POSITIONS: CaptionPosition[] = [
  "top",
  "middle",
  "bottom",
  "custom",
];

export const SUPPORTED_SPLIT_SCREEN_MODES: SplitScreenMode[] = [
  "auto",
  "always",
  "never",
];

export const SUPPORTED_ASPECT_PRESETS: AspectPreset[] = [
  "9:16",
  "1:1",
  "16:9",
];

export const SUPPORTED_TEXT_CASES: TextCaseMode[] = [
  "source",
  "uppercase",
];

// Aspect preset dimensions
export function getAspectDimensions(preset: AspectPreset): { width: number; height: number } {
  switch (preset) {
    case "9:16":
      return { width: 1080, height: 1920 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
      return { width: 1920, height: 1080 };
    default:
      return { width: 1080, height: 1920 };
  }
}

// Validation helpers
export function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export function isValidCaptionFontId(fontId: string): fontId is CaptionFontId {
  return SUPPORTED_FONTS.includes(fontId as CaptionFontId);
}

export function isValidCaptionPresetId(presetId: string): presetId is CaptionPresetId {
  return SUPPORTED_CAPTION_PRESETS.includes(presetId as CaptionPresetId);
}

export function isValidCaptionPosition(position: string): position is CaptionPosition {
  return SUPPORTED_POSITIONS.includes(position as CaptionPosition);
}

export function isValidSplitScreenMode(mode: string): mode is SplitScreenMode {
  return SUPPORTED_SPLIT_SCREEN_MODES.includes(mode as SplitScreenMode);
}

export function isValidAspectPreset(preset: string): preset is AspectPreset {
  return SUPPORTED_ASPECT_PRESETS.includes(preset as AspectPreset);
}

export function isValidTextCase(mode: string): mode is TextCaseMode {
  return SUPPORTED_TEXT_CASES.includes(mode as TextCaseMode);
}

// Settings resolution: merge global defaults with per-job overrides
export function resolveJobOptions(
  defaults: ResolvedJobOptions,
  overrides?: JobOptions,
): ResolvedJobOptions {
  return {
    captions: {
      ...defaults.captions,
      ...overrides?.captions,
    },
    output: {
      ...defaults.output,
      ...overrides?.output,
    },
    clipSelection: {
      ...defaults.clipSelection,
      ...overrides?.clipSelection,
    },
  };
}
