import { describe, test, expect, beforeEach, afterAll } from "bun:test";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import { SqliteSettingsStore } from "../../src/providers/sqlite-settings";
import { DEFAULT_RESOLVED_OPTIONS, type ResolvedJobOptions } from "../../src/job-options/types";

const TMP = join(import.meta.dir, "__tmp_settings__");
const DB_PATH = join(TMP, "settings.db");

describe("SqliteSettingsStore", () => {
  let store: SqliteSettingsStore;

  beforeEach(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
    mkdirSync(TMP, { recursive: true });
    store = new SqliteSettingsStore(DB_PATH);
  });

  afterAll(() => {
    if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
  });

  test("getDefaults returns defaults on fresh database", async () => {
    const defaults = await store.getDefaults();
    expect(defaults).toEqual(DEFAULT_RESOLVED_OPTIONS);
  });

  test("saveDefaults changes defaults", async () => {
    const newDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      output: {
        ...DEFAULT_RESOLVED_OPTIONS.output,
        clipSpeed: 1.5,
        aspectPreset: "1:1",
      },
    };

    await store.saveDefaults(newDefaults);
    const defaults = await store.getDefaults();

    expect(defaults.output.clipSpeed).toBe(1.5);
    expect(defaults.output.aspectPreset).toBe("1:1");
  });

  test("saveDefaults fully replaces defaults", async () => {
    // First save
    const firstDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      captions: {
        ...DEFAULT_RESOLVED_OPTIONS.captions,
        presetId: "karaoke-pop",
      },
    };
    await store.saveDefaults(firstDefaults);

    // Second save should fully replace
    const secondDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      output: {
        ...DEFAULT_RESOLVED_OPTIONS.output,
        clipSpeed: 1.8,
      },
    };
    await store.saveDefaults(secondDefaults);

    const defaults = await store.getDefaults();

    // Second defaults should be in place
    expect(defaults.output.clipSpeed).toBe(1.8);
    // Caption should be back to default since second save didn't include karaoke-pop
    expect(defaults.captions.presetId).toBe(DEFAULT_RESOLVED_OPTIONS.captions.presetId);
  });

  test("saveDefaults handles caption changes", async () => {
    const newDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      captions: {
        ...DEFAULT_RESOLVED_OPTIONS.captions,
        presetId: "minimal-subtle",
        fontId: "bebas-neue",
        fontSizePx: 48,
        boxEnabled: false,
      },
    };

    await store.saveDefaults(newDefaults);
    const defaults = await store.getDefaults();

    expect(defaults.captions.presetId).toBe("minimal-subtle");
    expect(defaults.captions.fontId).toBe("bebas-neue");
    expect(defaults.captions.fontSizePx).toBe(48);
    expect(defaults.captions.boxEnabled).toBe(false);
  });

  test("saveDefaults handles clip selection changes", async () => {
    const newDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      clipSelection: { maxClips: 5 },
    };

    await store.saveDefaults(newDefaults);
    const defaults = await store.getDefaults();
    expect(defaults.clipSelection.maxClips).toBe(5);
  });

  test("defaults persist after close and reopen", async () => {
    const newDefaults: ResolvedJobOptions = {
      ...DEFAULT_RESOLVED_OPTIONS,
      output: { ...DEFAULT_RESOLVED_OPTIONS.output, clipSpeed: 1.3 },
    };

    await store.saveDefaults(newDefaults);
    await store.close();

    // Reopen store
    const newStore = new SqliteSettingsStore(DB_PATH);
    const defaults = await newStore.getDefaults();
    expect(defaults.output.clipSpeed).toBe(1.3);

    await newStore.close();
  });

  test("close is idempotent", async () => {
    await store.close();
    // Should not throw
    await store.close();
  });
});
