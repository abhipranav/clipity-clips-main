import type { ReactElement } from "react";
import { VideoCard } from "./VideoCard";
import type { ReadyOutput } from "@/types";

interface ReadyOutputCardProps {
  output: ReadyOutput;
}

export function ReadyOutputCard({ output }: ReadyOutputCardProps): ReactElement {
  return (
    <VideoCard
      videoPath={output.finalReelPath}
      title={output.clipTitle}
      subtitle={output.videoTitle}
      duration={output.duration || 15}
      date={output.createdAt}
      aspectRatio="9/16"
      compact
    />
  );
}
