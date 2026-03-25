import type { ReactElement } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/api";
import { EmptyState } from "@/components/EmptyState";
import { VideoCard } from "@/components/VideoCard";
import { Library, Download, Film } from "@/components/icons";
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
                {group.clips.map((clip) => (
                  <VideoCard
                    key={clip.clipId}
                    videoPath={clip.finalReelPath}
                    title={clip.title}
                    subtitle={clip.hookLine}
                    duration={clip.duration}
                    date={clip.createdAt}
                    aspectRatio="9/16"
                  />
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

