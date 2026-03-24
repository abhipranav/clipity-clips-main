import type { ReactElement } from "react";
import type { PipelineRun } from "@/types";
import { Link } from "react-router-dom";
import { Clock, CheckCircle, AlertCircle, RefreshCw } from "./icons";
import "./RunCard.css";

interface RunCardProps {
  run: PipelineRun;
  compact?: boolean;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStatusIcon(status: string): ReactElement {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} className="status-icon completed" />;
    case "failed":
      return <AlertCircle size={16} className="status-icon failed" />;
    case "running":
      return <RefreshCw size={16} className="status-icon running" />;
    case "queued":
      return <Clock size={16} className="status-icon queued" />;
    default:
      return <Clock size={16} className="status-icon" />;
  }
}

function getStatusClass(status: string): string {
  return `status-${status}`;
}

export function RunCard({ run, compact = false }: RunCardProps): ReactElement {
  const displayTitle = run.videoTitle || run.videoId || "Unknown Video";

  if (compact) {
    return (
      <Link to={`/runs/${run.id}`} className="run-card compact">
        <div className="run-card-status">
          {getStatusIcon(run.status)}
        </div>
        <div className="run-card-content">
          <div className="run-card-title">{displayTitle}</div>
          <div className="run-card-meta">
            <span className={`status-badge ${getStatusClass(run.status)}`}>
              {run.status}
            </span>
            <span className="run-stage">{run.currentStage}</span>
          </div>
        </div>
        <div className="run-card-date">{formatDate(run.updatedAt)}</div>
      </Link>
    );
  }

  return (
    <Link to={`/runs/${run.id}`} className="run-card">
      <div className="run-card-header">
        <div className="run-card-status">
          {getStatusIcon(run.status)}
        </div>
        <div className="run-card-title">{displayTitle}</div>
        <div className={`status-badge ${getStatusClass(run.status)}`}>
          {run.status}
        </div>
      </div>
      <div className="run-card-details">
        <span className="run-stage">{run.currentStage}</span>
        <span className="run-date">{formatDate(run.updatedAt)}</span>
      </div>
    </Link>
  );
}
