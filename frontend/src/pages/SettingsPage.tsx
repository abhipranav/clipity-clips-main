import type { ReactElement, ChangeEvent } from "react";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api";
import { AlertCircle, Save, RotateCcw } from "@/components/icons";
import type {
  ResolvedJobOptions,
  CaptionPresetId,
  CaptionFontId,
  CaptionPosition,
  AspectPreset,
  SplitScreenMode,
  TextCaseMode,
} from "@/types";
import "./SettingsPage.css";

const PRESET_LABELS: Record<CaptionPresetId, string> = {
  "bold-box": "Bold Box",
  "clean-cinema": "Clean Cinema",
  "minimal-subtle": "Minimal Subtle",
  "karaoke-pop": "Karaoke Pop",
  "headline-top": "Headline Top",
};

const FONT_LABELS: Record<CaptionFontId, string> = {
  inter: "Inter",
  roboto: "Roboto",
  poppins: "Poppins",
  "bebas-neue": "Bebas Neue",
  oswald: "Oswald",
  playfair: "Playfair Display",
  "jetbrains-mono": "JetBrains Mono",
};

const POSITION_LABELS: Record<CaptionPosition, string> = {
  top: "Top",
  middle: "Middle (Center)",
  bottom: "Bottom",
  custom: "Custom",
};

const ASPECT_LABELS: Record<AspectPreset, string> = {
  "9:16": "9:16 (Vertical/Shorts)",
  "1:1": "1:1 (Square)",
  "16:9": "16:9 (Horizontal)",
};

const SPLIT_SCREEN_LABELS: Record<SplitScreenMode, string> = {
  auto: "Auto (when B-roll available)",
  never: "Never (single video only)",
  always: "Always (require B-roll)",
};

const TEXT_CASE_LABELS: Record<TextCaseMode, string> = {
  uppercase: "UPPERCASE",
  lowercase: "lowercase",
  "title-case": "Title Case",
  "as-is": "As Is (no change)",
};

export function SettingsPage(): ReactElement {
  const queryClient = useQueryClient();
  const { data: settings, isLoading, error } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const [localSettings, setLocalSettings] = useState<ResolvedJobOptions | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings && !localSettings) {
      setLocalSettings(settings.creatorDefaults);
    }
  }, [settings, localSettings]);

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setHasChanges(false);
    },
  });

  if (isLoading || !localSettings || !settings) {
    return <SettingsSkeleton />;
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle size={48} className="error-icon" />
        <h2>Failed to load settings</h2>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const updateCaptions = (updates: Partial<ResolvedJobOptions["captions"]>) => {
    setLocalSettings({
      ...localSettings,
      captions: { ...localSettings.captions, ...updates },
    });
    setHasChanges(true);
  };

  const updateOutput = (updates: Partial<ResolvedJobOptions["output"]>) => {
    setLocalSettings({
      ...localSettings,
      output: { ...localSettings.output, ...updates },
    });
    setHasChanges(true);
  };

  const updateClipSelection = (updates: Partial<ResolvedJobOptions["clipSelection"]>) => {
    setLocalSettings({
      ...localSettings,
      clipSelection: { ...localSettings.clipSelection, ...updates },
    });
    setHasChanges(true);
  };

  const handleSave = () => {
    updateMutation.mutate(localSettings);
  };

  const handleReset = () => {
    if (settings) {
      setLocalSettings(settings.creatorDefaults);
      setHasChanges(false);
    }
  };

  const { validation, capabilities } = settings;
  const { captions, output, clipSelection } = localSettings;

  return (
    <div className="settings-page">
      <div className="page-header-bar">
        <h1 className="page-title">Creator Settings</h1>
        <div className="header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={!hasChanges}
          >
            <RotateCcw size={16} />
            Reset
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!hasChanges || updateMutation.isPending}
          >
            <Save size={16} />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {updateMutation.isError && (
        <div className="error-banner">
          <AlertCircle size={16} />
          Failed to save: {updateMutation.error instanceof Error ? updateMutation.error.message : "Unknown error"}
        </div>
      )}

      <div className="settings-grid">
        {/* Caption Styling */}
        <motion.div
          className="settings-card settings-card-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          <h3 className="card-title">Caption Styling</h3>
          
          <div className="form-section">
            <h4>Preset & Font</h4>
            <div className="form-row">
              <FormGroup label="Preset">
                <select
                  value={captions.presetId}
                  onChange={(e) => updateCaptions({ presetId: e.target.value as CaptionPresetId })}
                >
                  {capabilities.captionPresets.map((p) => (
                    <option key={p} value={p}>{PRESET_LABELS[p]}</option>
                  ))}
                </select>
              </FormGroup>
              <FormGroup label="Font">
                <select
                  value={captions.fontId}
                  onChange={(e) => updateCaptions({ fontId: e.target.value as CaptionFontId })}
                >
                  {capabilities.fonts.map((f) => (
                    <option key={f} value={f}>{FONT_LABELS[f]}</option>
                  ))}
                </select>
              </FormGroup>
            </div>
          </div>

          <div className="form-section">
            <h4>Colors & Style</h4>
            <div className="form-row">
              <FormGroup label="Active Word Color">
                <ColorInput
                  value={captions.activeColor}
                  onChange={(v) => updateCaptions({ activeColor: v })}
                />
              </FormGroup>
              <FormGroup label="Inactive Word Color">
                <ColorInput
                  value={captions.inactiveColor}
                  onChange={(v) => updateCaptions({ inactiveColor: v })}
                />
              </FormGroup>
            </div>
            <div className="form-row">
              <FormGroup label="Font Size (px)">
                <NumberInput
                  value={captions.fontSizePx}
                  min={validation.fontSizePx.min}
                  max={validation.fontSizePx.max}
                  onChange={(v) => updateCaptions({ fontSizePx: v })}
                />
              </FormGroup>
              <FormGroup label="Text Case">
                <select
                  value={captions.textCase}
                  onChange={(e) => updateCaptions({ textCase: e.target.value as TextCaseMode })}
                >
                  {capabilities.textCases.map((t) => (
                    <option key={t} value={t}>{TEXT_CASE_LABELS[t]}</option>
                  ))}
                </select>
              </FormGroup>
            </div>
          </div>

          <div className="form-section">
            <h4>Position</h4>
            <div className="form-row">
              <FormGroup label="Position">
                <select
                  value={captions.position}
                  onChange={(e) => updateCaptions({ position: e.target.value as CaptionPosition })}
                >
                  {capabilities.positions.map((p) => (
                    <option key={p} value={p}>{POSITION_LABELS[p]}</option>
                  ))}
                </select>
              </FormGroup>
              {captions.position === "custom" && (
                <FormGroup label="Custom Y Position (%)">
                  <NumberInput
                    value={captions.customYPercent ?? 50}
                    min={validation.customYPercent.min}
                    max={validation.customYPercent.max}
                    onChange={(v) => updateCaptions({ customYPercent: v })}
                  />
                </FormGroup>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4>Text Grouping</h4>
            <FormGroup label="Max Words Per Group">
              <NumberInput
                value={captions.maxWordsPerGroup}
                min={validation.maxWordsPerGroup.min}
                max={validation.maxWordsPerGroup.max}
                onChange={(v) => updateCaptions({ maxWordsPerGroup: v })}
              />
            </FormGroup>
          </div>

          <div className="form-section">
            <h4>Background Box</h4>
            <div className="form-row">
              <FormGroup label="Enable Box">
                <Toggle
                  checked={captions.boxEnabled}
                  onChange={(v) => updateCaptions({ boxEnabled: v })}
                />
              </FormGroup>
              {captions.boxEnabled && (
                <>
                  <FormGroup label="Box Color">
                    <ColorInput
                      value={captions.boxColor}
                      onChange={(v) => updateCaptions({ boxColor: v })}
                    />
                  </FormGroup>
                  <FormGroup label="Opacity (0-1)">
                    <NumberInput
                      value={captions.boxOpacity}
                      min={validation.boxOpacity.min}
                      max={validation.boxOpacity.max}
                      step={0.1}
                      onChange={(v) => updateCaptions({ boxOpacity: v })}
                    />
                  </FormGroup>
                  <FormGroup label="Border Radius (px)">
                    <NumberInput
                      value={captions.boxRadiusPx}
                      min={validation.boxRadiusPx.min}
                      max={validation.boxRadiusPx.max}
                      onChange={(v) => updateCaptions({ boxRadiusPx: v })}
                    />
                  </FormGroup>
                </>
              )}
            </div>
          </div>

          <div className="form-section">
            <h4>Text Stroke</h4>
            <div className="form-row">
              <FormGroup label="Enable Stroke">
                <Toggle
                  checked={captions.strokeEnabled}
                  onChange={(v) => updateCaptions({ strokeEnabled: v })}
                />
              </FormGroup>
              {captions.strokeEnabled && (
                <>
                  <FormGroup label="Stroke Color">
                    <ColorInput
                      value={captions.strokeColor}
                      onChange={(v) => updateCaptions({ strokeColor: v })}
                    />
                  </FormGroup>
                  <FormGroup label="Stroke Width (px)">
                    <NumberInput
                      value={captions.strokeWidthPx}
                      min={validation.strokeWidthPx.min}
                      max={validation.strokeWidthPx.max}
                      onChange={(v) => updateCaptions({ strokeWidthPx: v })}
                    />
                  </FormGroup>
                </>
              )}
            </div>
          </div>
        </motion.div>

        {/* Output & Layout */}
        <motion.div
          className="settings-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="card-title">Output & Layout</h3>
          
          <FormGroup label="Aspect Ratio">
            <select
              value={output.aspectPreset}
              onChange={(e) => updateOutput({ aspectPreset: e.target.value as AspectPreset })}
            >
              {capabilities.aspectPresets.map((a) => (
                <option key={a} value={a}>{ASPECT_LABELS[a]}</option>
              ))}
            </select>
          </FormGroup>

          <FormGroup label="Clip Speed">
            <NumberInput
              value={output.clipSpeed}
              min={validation.clipSpeed.min}
              max={validation.clipSpeed.max}
              step={0.1}
              onChange={(v) => updateOutput({ clipSpeed: v })}
            />
          </FormGroup>

          <FormGroup label="Split Screen Mode">
            <select
              value={output.splitScreenMode}
              onChange={(e) => updateOutput({ splitScreenMode: e.target.value as SplitScreenMode })}
            >
              {capabilities.splitScreenModes.map((s) => (
                <option key={s} value={s}>{SPLIT_SCREEN_LABELS[s]}</option>
              ))}
            </select>
          </FormGroup>
        </motion.div>

        {/* Clip Selection */}
        <motion.div
          className="settings-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="card-title">Clip Selection</h3>
          
          <FormGroup label="Max Clips (0 = unlimited)">
            <NumberInput
              value={clipSelection.maxClips}
              min={validation.maxClips.min}
              max={validation.maxClips.max}
              onChange={(v) => updateClipSelection({ maxClips: v })}
            />
          </FormGroup>
        </motion.div>

        {/* Environment (read-only) */}
        <motion.div
          className="settings-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="card-title">Environment</h3>
          <div className="settings-list">
            <SettingItem label="App Mode" value={settings.environment.appMode} />
            <SettingItem label="Checkpoint" value={settings.environment.checkpointBackend} />
            <SettingItem label="Queue" value={settings.environment.queueBackend} />
            <SettingItem label="Artifacts" value={settings.environment.artifactBackend} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// Form Components
function FormGroup({ label, children }: { label: string; children: React.ReactNode }): ReactElement {
  return (
    <div className="form-group">
      <label className="form-label">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}): ReactElement {
  return (
    <input
      type="number"
      className="form-input"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(Number(e.target.value))}
    />
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (value: string) => void }): ReactElement {
  return (
    <div className="color-input-wrapper">
      <input
        type="color"
        className="color-picker"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="form-input color-text"
        value={value}
        onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        pattern="^#[0-9A-Fa-f]{6}$"
      />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }): ReactElement {
  return (
    <button
      type="button"
      className={`toggle ${checked ? "toggle-on" : ""}`}
      onClick={() => onChange(!checked)}
      aria-checked={checked}
      role="switch"
    >
      <span className="toggle-slider" />
    </button>
  );
}

function SettingItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="setting-item">
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
    </div>
  );
}

function SettingsSkeleton(): ReactElement {
  return (
    <div className="settings-page">
      <div className="skeleton skeleton-header" />
      <div className="settings-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton skeleton-card" />
        ))}
      </div>
    </div>
  );
}
