import type { ReactElement } from "react";
import type { QueueHealth, WorkerHealth } from "@/types";
import { Clock, CheckCircle, AlertCircle, RefreshCw } from "./icons";
import "./QueueHealthCard.css";

interface QueueHealthCardProps {
  health?: QueueHealth;
  worker?: WorkerHealth;
}

export function QueueHealthCard({ health, worker }: QueueHealthCardProps): ReactElement {
  const queuedCount = health?.queuedCount ?? 0;
  const runningCount = health?.runningCount ?? 0;
  const hasQueuedWithoutWorker = health?.hasQueuedWithoutWorker ?? false;
  const workerConnected = worker?.connected ?? false;
  const workerMode = worker?.mode ?? "local";

  return (
    <div className="queue-health-card">
      <h3 className="card-title">Queue Health</h3>
      
      <div className="health-stats">
        <div className="health-stat">
          <Clock size={18} className="stat-icon" />
          <span className="stat-value">{queuedCount}</span>
          <span className="stat-label">Queued</span>
        </div>
        <div className="health-stat">
          <RefreshCw size={18} className="stat-icon running" />
          <span className="stat-value">{runningCount}</span>
          <span className="stat-label">Running</span>
        </div>
      </div>

      <div className="health-status">
        {workerConnected ? (
          <div className="status-item healthy">
            <CheckCircle size={16} />
            <span>Worker connected ({workerMode})</span>
          </div>
        ) : (
          <div className="status-item warning">
            <AlertCircle size={16} />
            <span>No worker connected</span>
          </div>
        )}
        
        {hasQueuedWithoutWorker && (
          <div className="status-item alert">
            <Clock size={16} />
            <span>Jobs waiting for worker</span>
          </div>
        )}
      </div>
    </div>
  );
}
