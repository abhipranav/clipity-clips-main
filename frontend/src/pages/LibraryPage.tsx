import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api";
import { EmptyState } from "@/components/EmptyState";
import { Library, Download, ExternalLink, Film } from "@/components/icons";
import type { LibraryGroup } from "@/types";
import "./LibraryPage.css";

export function LibraryPage(): ReactElement {
  const { data: library, isLoading, error } = useQuery({
    queryKey: ["library"],
    queryFn: api.getLibrary,
  });

  if (isLoading) {
    return <LibrarySkeleton />;
  }

  if (error) {
    return (
      <div className="error-container">
        <p>Failed to load library: {error instanceof Error ? error.message : "Unknown error"}</p>
      </div>
    );
  }

  const hasNoContent = !library || library.length === 0;

  return (
    <div className="library-page">
      <div className="page-header-bar">
        <h1 className="page-title">Library</h1>
      </div>

      {hasNoContent ? (
        <EmptyState
          icon={Library}
          title="No clips yet"
          description="Complete some pipeline runs to see your clips here"
          action={{ label: "Queue a Job", to: "/new" }}
        />
      ) : (
        <div className="library-groups">
          {library?.map((group: LibraryGroup, groupIndex: number) => (
            <motion.div
              key={group.videoId}
              className="library-group"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: groupIndex * 0.1 }}
            >
              <div className="group-header">
                <div className="group-title-section">
                  <Film size={20} className="group-icon" />
                  <h2 className="group-title">{group.videoTitle}</h2>
                </div>
                <div className="group-actions">
                  <span className="group-count">{group.clipCount} clips</span>
                  <a
                    href={`/api/library/${encodeURIComponent(group.videoId)}/download`}
                    className="group-download-all"
                    title="Download all clips"
                  >
                    <Download size={14} />
                    <span>Download all</span>
                  </a>
                </div>
              </div>
              <div className="clips-grid">
                {group.clips.map((clip, clipIndex) => (
                  <motion.div
                    key={clip.clipId}
                    className="library-clip-card"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: groupIndex * 0.1 + clipIndex * 0.05 }}
                  >
                    <div className="clip-preview">
                      <div className="clip-thumbnail">
                        <Film size={20} />
                      </div>
                    </div>
                    <div className="clip-info">
                      <h3 className="clip-title">{clip.title}</h3>
                      <p className="clip-hook">{clip.hookLine}</p>
                      <div className="clip-meta">
                        <span>{formatDuration(clip.duration)}</span>
                        <span>{formatDate(clip.createdAt)}</span>
                      </div>
                    </div>
                    <div className="clip-actions">
                      <a
                        href={`/artifacts/${clip.finalReelPath}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="clip-action"
                        title="View"
                      >
                        <ExternalLink size={16} />
                      </a>
                      <a
                        href={`/artifacts/${clip.finalReelPath}`}
                        download
                        className="clip-action"
                        title="Download"
                      >
                        <Download size={16} />
                      </a>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function LibrarySkeleton(): ReactElement {
  return (
    <div className="library-page">
      <div className="skeleton skeleton-header" />
      {[1, 2].map((i) => (
        <div key={i} className="skeleton skeleton-group" />
      ))}
    </div>
  );
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
