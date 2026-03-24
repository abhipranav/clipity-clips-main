import { describe, test, expect } from "bun:test";
import {
  resolveJobOptions,
  DEFAULT_RESOLVED_OPTIONS,
  DEFAULT_CAPTION_STYLE,
  DEFAULT_OUTPUT_OPTIONS,
  DEFAULT_CLIP_SELECTION,
  SUPPORTED_CAPTION_PRESETS,
  SUPPORTED_FONTS,
  SUPPORTED_ASPECT_PRESETS,
  SUPPORTED_SPLIT_SCREEN_MODES,
  SUPPORTED_TEXT_CASES,
  SUPPORTED_POSITIONS,
  VALIDATION,
  isValidHexColor,
  isValidCaptionFontId,
  isValidCaptionPresetId,
  isValidAspectPreset,
  isValidSplitScreenMode,
  isValidTextCase,
  getAspectDimensions,
  type JobOptions,
  type ResolvedJobOptions,
} from "../../src/job-options/types";

describe("JobOptions Types", () => {
  describe("resolveJobOptions", () => {
    test("returns defaults when no overrides", () => {
      const result = resolveJobOptions(DEFAULT_RESOLVED_OPTIONS, {});
      expect(result).toEqual(DEFAULT_RESOLVED_OPTIONS);
    });

    test("merges partial caption overrides", () => {
      const overrides: JobOptions = {
        captions: {
          presetId: "karaoke-pop",
          fontSizePx: 64,
        },
      };
      const result = resolveJobOptions(DEFAULT_RESOLVED_OPTIONS, overrides);
      expect(result.captions.presetId).toBe("karaoke-pop");
      expect(result.captions.fontSizePx).toBe(64);
      expect(result.captions.fontId).toBe(DEFAULT_CAPTION_STYLE.fontId);
    });

    test("merges nested output options", () => {
      const overrides: JobOptions = {
        output: {
          clipSpeed: 1.5,
        },
      };
      const result = resolveJobOptions(DEFAULT_RESOLVED_OPTIONS, overrides);
      expect(result.output.clipSpeed).toBe(1.5);
      expect(result.output.aspectPreset).toBe(DEFAULT_OUTPUT_OPTIONS.aspectPreset);
    });

    test("merges clip selection options", () => {
      const overrides: JobOptions = {
        clipSelection: {
          maxClips: 0,
        },
      };
      const result = resolveJobOptions(DEFAULT_RESOLVED_OPTIONS, overrides);
      expect(result.clipSelection.maxClips).toBe(0);
    });

    test("complete override replaces all", () => {
      const completeOverride: ResolvedJobOptions = {
        captions: {
          presetId: "minimal-subtle",
          fontId: "bebas-neue",
          fontSizePx: 32,
          activeColor: "#FF0000",
          inactiveColor: "#00FF00",
          textCase: "source",
          position: "top",
          customYPercent: null,
          maxWordsPerGroup: 5,
          boxEnabled: false,
          boxColor: "#000000",
          boxOpacity: 0.5,
          boxRadiusPx: 0,
          strokeEnabled: false,
          strokeColor: "#000000",
          strokeWidthPx: 0,
        },
        output: {
          aspectPreset: "1:1",
          clipSpeed: 1.0,
          splitScreenMode: "never",
          captionAnimate: false,
        },
        clipSelection: {
          maxClips: 10,
        },
      };
      const result = resolveJobOptions(DEFAULT_RESOLVED_OPTIONS, completeOverride);
      expect(result).toEqual(completeOverride);
    });
  });

  describe("default constants", () => {
    test("DEFAULT_RESOLVED_OPTIONS has all required fields", () => {
      expect(DEFAULT_RESOLVED_OPTIONS.captions).toBeDefined();
      expect(DEFAULT_RESOLVED_OPTIONS.output).toBeDefined();
      expect(DEFAULT_RESOLVED_OPTIONS.clipSelection).toBeDefined();
    });

    test("DEFAULT_CAPTION_STYLE has valid preset", () => {
      expect(SUPPORTED_CAPTION_PRESETS).toContain(DEFAULT_CAPTION_STYLE.presetId);
    });

    test("DEFAULT_CAPTION_STYLE has valid font", () => {
      expect(SUPPORTED_FONTS).toContain(DEFAULT_CAPTION_STYLE.fontId);
    });

    test("DEFAULT_OUTPUT_OPTIONS has valid aspect preset", () => {
      expect(SUPPORTED_ASPECT_PRESETS).toContain(DEFAULT_OUTPUT_OPTIONS.aspectPreset);
    });

    test("DEFAULT_OUTPUT_OPTIONS has valid split screen mode", () => {
      expect(SUPPORTED_SPLIT_SCREEN_MODES).toContain(DEFAULT_OUTPUT_OPTIONS.splitScreenMode);
    });

    test("DEFAULT_CAPTION_STYLE has valid text case", () => {
      expect(SUPPORTED_TEXT_CASES).toContain(DEFAULT_CAPTION_STYLE.textCase);
    });

    test("DEFAULT_OUTPUT_OPTIONS clipSpeed within validation range", () => {
      expect(DEFAULT_OUTPUT_OPTIONS.clipSpeed).toBeGreaterThanOrEqual(VALIDATION.clipSpeed.min);
      expect(DEFAULT_OUTPUT_OPTIONS.clipSpeed).toBeLessThanOrEqual(VALIDATION.clipSpeed.max);
    });

    test("DEFAULT_CLIP_SELECTION maxClips within validation range", () => {
      expect(DEFAULT_CLIP_SELECTION.maxClips).toBeGreaterThanOrEqual(VALIDATION.maxClips.min);
      expect(DEFAULT_CLIP_SELECTION.maxClips).toBeLessThanOrEqual(VALIDATION.maxClips.max);
    });

    test("DEFAULT_CAPTION_STYLE fontSizePx within validation range", () => {
      expect(DEFAULT_CAPTION_STYLE.fontSizePx).toBeGreaterThanOrEqual(VALIDATION.fontSizePx.min);
      expect(DEFAULT_CAPTION_STYLE.fontSizePx).toBeLessThanOrEqual(VALIDATION.fontSizePx.max);
    });
  });

  describe("supported lists", () => {
    test("SUPPORTED_CAPTION_PRESETS is non-empty", () => {
      expect(SUPPORTED_CAPTION_PRESETS.length).toBeGreaterThan(0);
    });

    test("SUPPORTED_FONTS is non-empty", () => {
      expect(SUPPORTED_FONTS.length).toBeGreaterThan(0);
    });

    test("SUPPORTED_ASPECT_PRESETS is non-empty", () => {
      expect(SUPPORTED_ASPECT_PRESETS.length).toBeGreaterThan(0);
    });

    test("SUPPORTED_SPLIT_SCREEN_MODES contains expected values", () => {
      expect(SUPPORTED_SPLIT_SCREEN_MODES).toContain("auto");
      expect(SUPPORTED_SPLIT_SCREEN_MODES).toContain("never");
      expect(SUPPORTED_SPLIT_SCREEN_MODES).toContain("always");
    });

    test("SUPPORTED_TEXT_CASES contains expected values", () => {
      expect(SUPPORTED_TEXT_CASES).toContain("source");
      expect(SUPPORTED_TEXT_CASES).toContain("uppercase");
    });

    test("SUPPORTED_POSITIONS contains expected values", () => {
      expect(SUPPORTED_POSITIONS).toContain("top");
      expect(SUPPORTED_POSITIONS).toContain("middle");
      expect(SUPPORTED_POSITIONS).toContain("bottom");
      expect(SUPPORTED_POSITIONS).toContain("custom");
    });
  });

  describe("validation helpers", () => {
    test("isValidHexColor accepts valid hex colors", () => {
      expect(isValidHexColor("#FFD700")).toBe(true);
      expect(isValidHexColor("#000000")).toBe(true);
      expect(isValidHexColor("#FFFFFF")).toBe(true);
      expect(isValidHexColor("#ff0000")).toBe(true);
    });

    test("isValidHexColor rejects invalid hex colors", () => {
      expect(isValidHexColor("FFD700")).toBe(false);
      expect(isValidHexColor("#GGG")).toBe(false);
      expect(isValidHexColor("#12345")).toBe(false);
      expect(isValidHexColor("#1234567")).toBe(false);
      expect(isValidHexColor("red")).toBe(false);
    });

    test("isValidCaptionFontId accepts supported fonts", () => {
      for (const font of SUPPORTED_FONTS) {
        expect(isValidCaptionFontId(font)).toBe(true);
      }
    });

    test("isValidCaptionFontId rejects unsupported fonts", () => {
      expect(isValidCaptionFontId("InvalidFont")).toBe(false);
      expect(isValidCaptionFontId("Arial")).toBe(false);
      expect(isValidCaptionFontId("")).toBe(false);
    });

    test("isValidCaptionPresetId accepts supported presets", () => {
      for (const preset of SUPPORTED_CAPTION_PRESETS) {
        expect(isValidCaptionPresetId(preset)).toBe(true);
      }
    });

    test("isValidCaptionPresetId rejects unsupported presets", () => {
      expect(isValidCaptionPresetId("invalid-preset")).toBe(false);
      expect(isValidCaptionPresetId("fancy-style")).toBe(false);
    });

    test("isValidAspectPreset accepts supported presets", () => {
      for (const preset of SUPPORTED_ASPECT_PRESETS) {
        expect(isValidAspectPreset(preset)).toBe(true);
      }
    });

    test("isValidAspectPreset rejects unsupported presets", () => {
      expect(isValidAspectPreset("4:3")).toBe(false);
      expect(isValidAspectPreset("21:9")).toBe(false);
    });

    test("isValidSplitScreenMode accepts supported modes", () => {
      for (const mode of SUPPORTED_SPLIT_SCREEN_MODES) {
        expect(isValidSplitScreenMode(mode)).toBe(true);
      }
    });

    test("isValidSplitScreenMode rejects unsupported modes", () => {
      expect(isValidSplitScreenMode("sometimes")).toBe(false);
      expect(isValidSplitScreenMode("yes")).toBe(false);
    });

    test("isValidTextCase accepts supported cases", () => {
      for (const textCase of SUPPORTED_TEXT_CASES) {
        expect(isValidTextCase(textCase)).toBe(true);
      }
    });

    test("isValidTextCase rejects unsupported cases", () => {
      expect(isValidTextCase("lower")).toBe(false);
      expect(isValidTextCase("capitalized")).toBe(false);
    });
  });

  describe("getAspectDimensions", () => {
    test("returns correct dimensions for 9:16", () => {
      const dims = getAspectDimensions("9:16");
      expect(dims.width).toBe(1080);
      expect(dims.height).toBe(1920);
    });

    test("returns correct dimensions for 1:1", () => {
      const dims = getAspectDimensions("1:1");
      expect(dims.width).toBe(1080);
      expect(dims.height).toBe(1080);
    });

    test("returns correct dimensions for 16:9", () => {
      const dims = getAspectDimensions("16:9");
      expect(dims.width).toBe(1920);
      expect(dims.height).toBe(1080);
    });
  });
});
