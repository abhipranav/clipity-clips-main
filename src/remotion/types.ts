import type { CaptionStyleConfig } from "../job-options/types";

export interface CaptionWord {
  text: string;
  startFrame: number;
  endFrame: number;
}

export interface CaptionGroup {
  words: CaptionWord[];
  startFrame: number;
  endFrame: number;
}

export interface CaptionOverlayProps {
  groups: CaptionGroup[];
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  captions?: CaptionStyleConfig;
  [key: string]: unknown;
}
