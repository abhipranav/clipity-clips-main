import React from "react";
import { useCurrentFrame } from "remotion";
import type { CaptionGroup, CaptionOverlayProps } from "./types";
import type { CaptionStyleConfig } from "../job-options/types";
import { DEFAULT_CAPTION_STYLE } from "../job-options/types";

// Font registry mapping font IDs to font families
const FONT_REGISTRY: Record<string, string> = {
  anton: "Anton, Impact, sans-serif",
  "bebas-neue": '"Bebas Neue", Impact, sans-serif',
  montserrat: "Montserrat, Arial, sans-serif",
  poppins: "Poppins, Arial, sans-serif",
  "archivo-black": '"Archivo Black", Impact, sans-serif',
};

// Preset configurations
const PRESET_CONFIGS: Record<string, Partial<CaptionStyleConfig>> = {
  "bold-box": {
    boxEnabled: true,
    boxColor: "#000000",
    boxOpacity: 1,
    boxRadiusPx: 8,
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidthPx: 3,
  },
  "clean-cinema": {
    boxEnabled: false,
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidthPx: 2,
  },
  "minimal-subtle": {
    boxEnabled: false,
    strokeEnabled: false,
  },
  "karaoke-pop": {
    boxEnabled: true,
    boxColor: "#FF006E",
    boxOpacity: 0.9,
    boxRadiusPx: 12,
    strokeEnabled: true,
    strokeColor: "#FFFFFF",
    strokeWidthPx: 2,
  },
  "headline-top": {
    boxEnabled: true,
    boxColor: "#000000",
    boxOpacity: 0.8,
    boxRadiusPx: 0,
    strokeEnabled: true,
    strokeColor: "#000000",
    strokeWidthPx: 2,
  },
};

function getFontFamily(fontId: string): string {
  return FONT_REGISTRY[fontId] || FONT_REGISTRY.anton;
}

function getTextStroke(shadows: string[]): React.CSSProperties["textShadow"] {
  return shadows.join(", ");
}

function createStrokeShadows(color: string, width: number): string[] {
  if (width <= 0) return [];
  const shadows: string[] = [];
  for (let x = -width; x <= width; x++) {
    for (let y = -width; y <= width; y++) {
      if (x !== 0 || y !== 0) {
        shadows.push(`${x}px ${y}px 0 ${color}`);
      }
    }
  }
  return shadows;
}

const CaptionBox: React.FC<{
  group: CaptionGroup;
  frame: number;
  config: CaptionStyleConfig;
}> = ({ group, frame, config }) => {
  const words = group.words;
  const midpoint = Math.ceil(words.length / 2);
  const line1 = words.slice(0, midpoint);
  const line2 = words.slice(midpoint);

  const renderWord = (word: (typeof words)[0], idx: number) => {
    const isActive = frame >= word.startFrame && frame < word.endFrame;
    const textContent = config.textCase === "uppercase" ? word.text.toUpperCase() : word.text;

    return (
      <span
        key={idx}
        style={{
          color: isActive ? config.activeColor : config.inactiveColor,
          marginRight: 12,
          textShadow: config.strokeEnabled
            ? getTextStroke(createStrokeShadows(config.strokeColor, config.strokeWidthPx))
            : undefined,
        }}
      >
        {textContent}
      </span>
    );
  };

  const boxStyle: React.CSSProperties = {
    padding: "12px 20px",
    display: "inline-flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 8,
  };

  if (config.boxEnabled) {
    boxStyle.backgroundColor = config.boxColor;
    boxStyle.opacity = config.boxOpacity;
    boxStyle.borderRadius = config.boxRadiusPx;
  }

  return (
    <div style={boxStyle}>
      <div style={{ display: "flex", justifyContent: "center" }}>{line1.map(renderWord)}</div>
      {line2.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center" }}>{line2.map(renderWord)}</div>
      )}
    </div>
  );
};

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({
  groups,
  width,
  height,
  captions,
}) => {
  const frame = useCurrentFrame();

  // Merge with defaults
  const config: CaptionStyleConfig = {
    ...DEFAULT_CAPTION_STYLE,
    ...captions,
  };

  // Apply preset overrides
  const presetConfig = PRESET_CONFIGS[config.presetId];
  if (presetConfig) {
    Object.assign(config, presetConfig);
  }

  const activeGroup = groups.find((g) => frame >= g.startFrame && frame < g.endFrame);

  // Calculate position based on config
  let justifyContent: React.CSSProperties["justifyContent"] = "center";
  let alignItems: React.CSSProperties["alignItems"] = "center";
  let top: React.CSSProperties["top"] = undefined;
  let transform: React.CSSProperties["transform"] = undefined;

  switch (config.position) {
    case "top":
      alignItems = "flex-start";
      top = "10%";
      break;
    case "middle":
      alignItems = "center";
      break;
    case "bottom":
      alignItems = "flex-end";
      top = undefined;
      break;
    case "custom":
      if (config.customYPercent !== null) {
        top = `${config.customYPercent}%`;
        transform = "translateY(-50%)";
      }
      break;
  }

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        flexDirection: "column",
        justifyContent,
        alignItems,
        fontFamily: getFontFamily(config.fontId),
        fontWeight: 800,
        fontSize: config.fontSizePx,
        position: "absolute",
        top: top ?? 0,
        left: 0,
        transform,
        backgroundColor: "#00FF00",
      }}
    >
      {activeGroup && <CaptionBox group={activeGroup} frame={frame} config={config} />}
    </div>
  );
};
