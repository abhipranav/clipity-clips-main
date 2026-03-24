import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api";
import { Clock, RefreshCw, AlertCircle, CheckCircle } from "@/components/icons";
import "./QueuePage.css";

export function QueuePage(): ReactElement {
  const { data: queue, isLoading, error } = useQuery({
    queryKey: ["queue"],
    queryFn: api.getQueue,
  });

  if (isLoading) {
    return <QueueSkeleton />;
  }

  if (error) {
    return (
      <div className="error-container">
        <AlertCircle size={48} className="error-icon" />
        <h2>Failed to load queue status</h2>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const queueData = queue ?? {
    queuedCount: 0,
    runningCount: 0,
    workerMode: "local",
    workerConnected: false,
    recentFailures: [],
  };

  return (
    <div className="queue-page">
      <div className="page-header-bar">
        <h1 className="page-title">Queue Status</h1>
      </div>

      <div className="queue-grid">
        <div className="queue-stats">
          <motion.div
            className="queue-stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0 }}
          >
            <Clock size={24} className="stat-icon queued" />
            <div className="stat-value">{queueData.queuedCount}</div>
            <div className="stat-label">Queued Jobs</div>
          </motion.div>

          <motion.div
            className="queue-stat-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <RefreshCw size={24} className="stat-icon running" />
            <div className="stat-value">{queueData.runningCount}</div>
            <div className="stat-label">Running Jobs</div>
          </motion.div>
        </div>

        <motion.div
          className="worker-status-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="card-title">Worker Status</h3>
          <div className="worker-info">
            <div className={`worker-badge ${queueData.workerConnected ? "connected" : "disconnected"}`}>
              {queueData.workerConnected ? (
                <>
                  <CheckCircle size={16} />
                  Connected
                </>
              ) : (
                <>
                  <AlertCircle size={16} />
                  Disconnected
                </>
              )}
            </div>
            <div className="worker-mode">
              Mode: <span className="mode-value">{queueData.workerMode}</span>
            </div>
          </div>
          {!queueData.workerConnected && queueData.queuedCount > 0 && (
            <div className="queue-alert">
              <AlertCircle size={16} />
              <span>Jobs are queued but no worker is connected to process them.</span>
            </div>
          )}
          {queueData.workerMode === "cloud" && (
            <p className="worker-note">
              In cloud mode, jobs are retried from scratch on failure. This ensures reliable processing
              but may take longer for large videos.
            </p>
          )}
        </motion.div>

        {queueData.recentFailures.length > 0 && (
          <motion.div
            className="failures-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="card-title">Recent Failures</h3>
            <div className="failures-list">
              {queueData.recentFailures.map((failure: { runId: string; error: string; failedAt: string }, index: number) => (
                <div key={index} className="failure-item">
                  <div className="failure-header">
                    <span className="failure-run">{failure.runId.slice(0, 8)}</span>
                    <span className="failure-time">{formatDate(failure.failedAt)}</span>
                  </div>
                  <p className="failure-error">{failure.error}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function QueueSkeleton(): ReactElement {
  return (
    <div className="queue-page">
      <div className="skeleton skeleton-header" />
      <div className="queue-stats">
        <div className="skeleton skeleton-stat" />
        <div className="skeleton skeleton-stat" />
      </div>
    </div>
  );
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
