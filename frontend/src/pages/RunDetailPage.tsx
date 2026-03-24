import type { ReactElement } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api";
import { ArrowLeft, Clock, CheckCircle, AlertCircle, RefreshCw, Download, ExternalLink, Settings } from "@/components/icons";
import type { StageResult } from "@/types";
import "./RunDetailPage.css";

export function RunDetailPage(): ReactElement {
  const { runId } = useParams<{ runId: string }>();
  const { data: runDetail, isLoading, error } = useQuery({
    queryKey: ["run", runId],
    queryFn: () => api.getRun(runId!),
    enabled: !!runId,
  });

  if (isLoading) {
    return <RunDetailSkeleton />;
  }

  if (error || !runDetail) {
    return (
      <div className="error-container">
        <AlertCircle size={48} className="error-icon" />
        <h2>Run not found</h2>
        <p>{error instanceof Error ? error.message : "This run does not exist"}</p>
        <Link to="/runs" className="btn-secondary">
          <ArrowLeft size={16} />
          Back to Runs
        </Link>
      </div>
    );
  }

  const run = runDetail.run;
  const stages = runDetail.stages || [];
  const clipProgress = runDetail.clipProgress || [];
  const finalReels = runDetail.finalReels || [];
  const jobOptions = runDetail.jobOptions;
  const displayTitle = run.videoTitle || run.videoId || "Unknown Video";

  return (
    <div className="run-detail-page">
      <Link to="/runs" className="back-link">
        <ArrowLeft size={16} />
        Back to Runs
      </Link>

      <div className="run-header">
        <div className="run-header-content">
          <div className="run-title-section">
            <h1 className="run-title">{displayTitle}</h1>
            <div className="run-meta">
              <span className={`status-badge status-${run.status}`}>
                {getStatusIcon(run.status)}
                {run.status}
              </span>
              <span className="run-stage">{run.currentStage}</span>
              <span className="run-id">ID: {run.id.slice(0, 8)}</span>
            </div>
          </div>
          <div className="run-url">
            <a href={run.videoUrl} target="_blank" rel="noopener noreferrer">
              {run.videoUrl}
              <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>

      {/* Settings Used Section */}
      {jobOptions && (
        <motion.div
          className="settings-used-section"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="section-header">
            <Settings size={18} />
            <h3 className="section-title">Settings Used</h3>
          </div>
          <div className="settings-grid-compact">
            <SettingsItem label="Preset" value={jobOptions.captions.presetId} />
            <SettingsItem label="Aspect" value={jobOptions.output.aspectPreset} />
            <SettingsItem label="Speed" value={`${jobOptions.output.clipSpeed}x`} />
            <SettingsItem label="Split Screen" value={jobOptions.output.splitScreenMode} />
            <SettingsItem label="Max Clips" value={jobOptions.clipSelection.maxClips === 0 ? "Unlimited" : jobOptions.clipSelection.maxClips.toString()} />
            <SettingsItem label="Font" value={jobOptions.captions.fontId} />
            <SettingsItem label="Text Case" value={jobOptions.captions.textCase} />
            <SettingsItem label="Position" value={jobOptions.captions.position} />
          </div>
        </motion.div>
      )}

      <div className="run-timeline">
        <h3 className="section-title">Pipeline Stages</h3>
        <div className="stages-list">
          {stages.map((stage: StageResult, index: number) => (
            <motion.div
              key={stage.stage}
              className={`stage-item ${stage.status}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <div className="stage-icon">{getStageIcon(stage.status)}</div>
              <div className="stage-content">
                <span className="stage-name">{stage.stage}</span>
                <span className="stage-status">{stage.status}</span>
              </div>
            </motion.div>
          ))}
          {stages.length === 0 && (
            <p className="no-stages">No stage information available</p>
          )}
        </div>
      </div>

      {clipProgress.length > 0 && (
        <div className="clips-section">
          <h3 className="section-title">Clip Progress</h3>
          <div className="clips-grid">
            {clipProgress.map((clip: { clipId: string; clipIndex: number; status: string; currentStage: string; artifactPaths: { finalReelPath?: string } }, index: number) => (
              <motion.div
                key={clip.clipId}
                className="clip-card"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="clip-header">
                  <span className="clip-index">#{clip.clipIndex + 1}</span>
                  <span className={`clip-status ${clip.status}`}>{clip.status}</span>
                </div>
                <div className="clip-stage">{clip.currentStage}</div>
                {clip.artifactPaths.finalReelPath && (
                  <a
                    href={`/artifacts/${clip.artifactPaths.finalReelPath}`}
                    download
                    className="clip-download"
                  >
                    <Download size={14} />
                    Download
                  </a>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {finalReels.length > 0 && (
        <div className="outputs-section">
          <h3 className="section-title">Final Outputs</h3>
          <div className="outputs-list">
            {finalReels.map((path: string, index: number) => (
              <div key={index} className="output-item">
                <span className="output-name">Clip {index + 1}</span>
                <a
                  href={`/artifacts/${path}`}
                  download
                  className="output-download"
                >
                  <Download size={16} />
                  Download
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SettingsItem({ label, value }: { label: string; value: string }): ReactElement {
  return (
    <div className="settings-item-compact">
      <span className="settings-label-compact">{label}</span>
      <span className="settings-value-compact">{value}</span>
    </div>
  );
}

function RunDetailSkeleton(): ReactElement {
  return (
    <div className="run-detail-page">
      <div className="skeleton skeleton-back" />
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-meta" />
      <div className="skeleton skeleton-timeline" />
    </div>
  );
}

function getStatusIcon(status: string): ReactElement {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} />;
    case "failed":
      return <AlertCircle size={16} />;
    case "running":
      return <RefreshCw size={16} className="spinning" />;
    case "queued":
      return <Clock size={16} />;
    default:
      return <Clock size={16} />;
  }
}

function getStageIcon(status: string): ReactElement {
  switch (status) {
    case "completed":
      return <CheckCircle size={18} />;
    case "failed":
      return <AlertCircle size={18} />;
    case "in_progress":
      return <RefreshCw size={18} className="spinning" />;
    default:
      return <Clock size={18} />;
  }
}
