import type { ReactElement } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { api } from "@/api";
import { RunCard } from "@/components/RunCard";
import { EmptyState } from "@/components/EmptyState";
import { Film, PlusCircle, Search } from "@/components/icons";
import type { PipelineRun } from "@/types";
import "./RunsPage.css";

export function RunsPage(): ReactElement {
  const { data: runs, isLoading, error } = useQuery({
    queryKey: ["runs"],
    queryFn: api.listRuns,
  });

  const [filter, setFilter] = useState<"all" | "queued" | "running" | "completed" | "failed">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRuns = runs?.filter((run: PipelineRun) => {
    if (filter !== "all" && run.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        run.videoTitle?.toLowerCase().includes(query) ||
        run.videoUrl.toLowerCase().includes(query) ||
        run.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  if (isLoading) {
    return <RunsPageSkeleton />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load runs: {error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const hasNoRuns = !runs || runs.length === 0;

  return (
    <div className="runs-page">
      <div className="page-header-bar">
        <h1 className="page-title">Pipeline Runs</h1>
        <Link to="/new" className="btn-primary">
          <PlusCircle size={18} />
          New Job
        </Link>
      </div>

      {hasNoRuns ? (
        <EmptyState
          icon={Film}
          title="No runs yet"
          description="Start by queuing your first video processing job"
          action={{ label: "Queue a Job", to: "/new" }}
        />
      ) : (
        <>
          <div className="filter-bar">
            <div className="search-input-wrapper">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder="Search by title, URL, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <div className="filter-chips">
              {(["all", "queued", "running", "completed", "failed"] as const).map((status) => (
                <button
                  key={status}
                  className={`filter-chip ${filter === status ? "active" : ""}`}
                  onClick={() => setFilter(status)}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="runs-list">
            {filteredRuns?.map((run: PipelineRun, index: number) => (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <RunCard run={run} />
              </motion.div>
            ))}
          </div>

          {filteredRuns?.length === 0 && (
            <div className="no-results">
              <p>No runs match your filters</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function RunsPageSkeleton(): ReactElement {
  return (
    <div className="runs-page">
      <div className="skeleton skeleton-header" />
      <div className="skeleton skeleton-filter" />
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="skeleton skeleton-run" />
      ))}
    </div>
  );
}
