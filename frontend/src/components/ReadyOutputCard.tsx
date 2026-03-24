import type { ReactElement } from "react";
import type { ReadyOutput } from "@/types";
import { Play, Download, ExternalLink } from "./icons";
import "./ReadyOutputCard.css";

interface ReadyOutputCardProps {
  output: ReadyOutput;
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
}

export function ReadyOutputCard({ output }: ReadyOutputCardProps): ReactElement {
  const duration = output.duration || 15;

  return (
    <div className="ready-output-card">
      <div className="output-preview">
        <div className="output-thumbnail">
          <Play size={24} className="play-icon" />
        </div>
        <div className="output-duration">{formatDuration(duration)}</div>
      </div>
      <div className="output-content">
        <div className="output-title">{output.clipTitle}</div>
        <div className="output-source">{output.videoTitle}</div>
        <div className="output-meta">
          <span className="output-date">{formatDate(output.createdAt)}</span>
        </div>
      </div>
      <div className="output-actions">
        <a
          href={`/artifacts/${output.finalReelPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="output-action"
          title="Open"
        >
          <ExternalLink size={16} />
        </a>
        <a
          href={`/artifacts/${output.finalReelPath}`}
          download
          className="output-action"
          title="Download"
        >
          <Download size={16} />
        </a>
      </div>
    </div>
  );
}
