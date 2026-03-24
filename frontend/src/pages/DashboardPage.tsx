import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { api } from "@/api";
import { RunCard } from "@/components/RunCard";
import { MetricCard } from "@/components/MetricCard";
import { ReadyOutputCard } from "@/components/ReadyOutputCard";
import { EmptyState } from "@/components/EmptyState";
import { QueueHealthCard } from "@/components/QueueHealthCard";
import { PlusCircle, ArrowRight, Film, AlertCircle } from "@/components/icons";
import "./DashboardPage.css";

export function DashboardPage(): ReactElement {
  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["app-summary"],
    queryFn: api.getAppSummary,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <div className="error-state">
        <AlertCircle size={48} className="error-icon" />
        <h2>Failed to load dashboard</h2>
        <p>{error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const stats = summary?.stats ?? { totalRuns: 0, queuedRuns: 0, runningRuns: 0, completedRuns: 0, failedRuns: 0 };
  const recentRuns = summary?.recentRuns ?? [];
  const readyOutputs = summary?.readyOutputs ?? [];
  const hasNoRuns = stats.totalRuns === 0;

  return (
    <div className="dashboard-page">
      {/* Hero Section */}
      <section className="hero-section">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="hero-content"
        >
          <h1 className="hero-title">Turn long videos into short-form clips</h1>
          <p className="hero-subtitle">
            Paste a YouTube URL and let Clipity extract the most engaging moments automatically
          </p>
          <Link to="/new" className="hero-cta">
            <PlusCircle size={20} />
            Queue Your First Job
            <ArrowRight size={18} />
          </Link>
        </motion.div>
      </section>

      {/* Metrics Row */}
      <section className="metrics-section">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="metrics-grid"
        >
          <MetricCard
            label="Queued"
            value={stats.queuedRuns}
            status="queued"
            delay={0}
          />
          <MetricCard
            label="Running"
            value={stats.runningRuns}
            status="running"
            delay={0.1}
          />
          <MetricCard
            label="Ready"
            value={stats.completedRuns}
            status="completed"
            delay={0.2}
          />
          <MetricCard
            label="Failed"
            value={stats.failedRuns}
            status="failed"
            delay={0.3}
          />
        </motion.div>
      </section>

      {/* Main Content Grid */}
      <div className="dashboard-grid">
        {/* Left Column: Ready to Review + Recent Runs */}
        <div className="dashboard-main">
          {/* Ready to Review Section */}
          {readyOutputs.length > 0 && (
            <section className="section">
              <div className="section-header">
                <h2 className="section-title">Ready to Review</h2>
                <Link to="/library" className="section-link">
                  View All
                  <ArrowRight size={16} />
                </Link>
              </div>
              <div className="ready-outputs-grid">
                {readyOutputs.slice(0, 4).map((output, index) => (
                  <motion.div
                    key={output.clipId}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 + index * 0.1 }}
                  >
                    <ReadyOutputCard output={output} />
                  </motion.div>
                ))}
              </div>
            </section>
          )}

          {/* Recent Runs Section */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Recent Runs</h2>
              <Link to="/runs" className="section-link">
                View All
                <ArrowRight size={16} />
              </Link>
            </div>
            {hasNoRuns ? (
              <EmptyState
                icon={Film}
                title="No runs yet"
                description="Get started by queuing your first job"
                action={{ label: "Queue a Job", to: "/new" }}
              />
            ) : (
              <div className="runs-list">
                {recentRuns.slice(0, 5).map((run, index) => (
                  <motion.div
                    key={run.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + index * 0.05 }}
                  >
                    <RunCard run={run} compact />
                  </motion.div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right Column: Queue Health */}
        <div className="dashboard-sidebar">
          <QueueHealthCard
            health={summary?.queueHealth}
            worker={summary?.workerHealth}
          />
        </div>
      </div>
    </div>
  );
}

function DashboardSkeleton(): ReactElement {
  return (
    <div className="dashboard-page">
      <section className="hero-section">
        <div className="hero-content">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-subtitle" />
          <div className="skeleton skeleton-button" />
        </div>
      </section>
      <section className="metrics-section">
        <div className="metrics-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-metric" />
          ))}
        </div>
      </section>
    </div>
  );
}
