import type { ReactElement, ReactNode } from "react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { buildArtifactUrl } from "@/artifacts";
import { Play, Pause, Volume2, VolumeX, Maximize, Download, ExternalLink, X } from "./icons";

interface VideoCardProps {
  videoPath: string;
  title: string;
  subtitle?: string;
  duration?: number;
  date?: string;
  thumbnailUrl?: string;
  aspectRatio?: "16/9" | "9/16" | "1/1";
  onView?: () => void;
  onDownload?: () => void;
  actions?: ReactNode;
  compact?: boolean;
}

export function VideoCard({
  videoPath,
  title,
  subtitle,
  duration,
  date,
  thumbnailUrl,
  aspectRatio = "9/16",
  onView,
  onDownload,
  actions,
  compact = false,
}: VideoCardProps): ReactElement {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showLightbox, setShowLightbox] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const artifactUrl = buildArtifactUrl(videoPath);

  // Handle hover with delay to prevent flickering
  const handleMouseEnter = useCallback(() => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(true);
    }, 150);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(false);
    setIsPlaying(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  // Play video on hover (muted)
  useEffect(() => {
    if (isHovered && videoRef.current && isLoaded) {
      videoRef.current.play().catch(() => {
        // Autoplay blocked, that's fine
      });
      setIsPlaying(true);
    } else if (!isHovered && videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  }, [isHovered, isLoaded]);

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMuted(!isMuted);
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
    }
  };

  const openLightbox = () => {
    setShowLightbox(true);
    if (onView) onView();
  };

  const closeLightbox = () => {
    setShowLightbox(false);
    if (videoRef.current) {
      videoRef.current.pause();
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  };

  return (
    <>
      <motion.div
        className={`video-card ${compact ? "compact" : ""}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -4, scale: 1.01 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          background: "var(--color-surface-solid)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          border: "1px solid var(--color-border-subtle)",
          boxShadow: isHovered ? "var(--shadow-lg)" : "var(--shadow-sm)",
          transition: "box-shadow 0.3s ease, border-color 0.3s ease",
          cursor: "pointer",
        }}
      >
        {/* Video Preview Area */}
        <div
          className="video-preview-container"
          style={{
            position: "relative",
            aspectRatio,
            background: "linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%)",
            overflow: "hidden",
          }}
          onClick={openLightbox}
        >
          {/* Video Element (hidden until loaded/hover) */}
          <video
            ref={videoRef}
            src={artifactUrl}
            muted={isMuted}
            playsInline
            preload="metadata"
            loop
            onLoadedData={() => setIsLoaded(true)}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: isHovered && isLoaded ? 1 : 0,
              transition: "opacity 0.4s ease",
            }}
          />

          {/* Thumbnail / Poster */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: thumbnailUrl
                ? `url(${thumbnailUrl}) center/cover no-repeat`
                : "linear-gradient(135deg, var(--color-bg-tertiary) 0%, var(--color-surface-solid) 100%)",
              opacity: isHovered && isLoaded ? 0 : 1,
              transition: "opacity 0.4s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {!thumbnailUrl && (
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: "var(--color-accent-gradient)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "var(--shadow-glow)",
                }}
              >
                <Play size={20} style={{ color: "white", marginLeft: "2px" }} />
              </div>
            )}
          </div>

          {/* Hover Overlay Controls */}
          <AnimatePresence>
            {isHovered && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 50%)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  padding: "12px",
                }}
              >
                {/* Play/Pause Indicator */}
                <div
                  style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    width: "56px",
                    height: "56px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.15)",
                    backdropFilter: "blur(8px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid rgba(255,255,255,0.2)",
                  }}
                >
                  {isPlaying ? (
                    <Pause size={24} style={{ color: "white" }} />
                  ) : (
                    <Play size={24} style={{ color: "white", marginLeft: "2px" }} />
                  )}
                </div>

                {/* Bottom Controls */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  {/* Duration */}
                  {duration && (
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "white",
                        fontFamily: "var(--font-mono)",
                        background: "rgba(0,0,0,0.5)",
                        padding: "4px 8px",
                        borderRadius: "4px",
                      }}
                    >
                      {formatDuration(duration)}
                    </span>
                  )}

                  {/* Controls */}
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      onClick={toggleMute}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "rgba(255,255,255,0.15)",
                        border: "1px solid rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        backdropFilter: "blur(4px)",
                      }}
                    >
                      {isMuted ? (
                        <VolumeX size={16} style={{ color: "white" }} />
                      ) : (
                        <Volume2 size={16} style={{ color: "white" }} />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openLightbox();
                      }}
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "50%",
                        background: "var(--color-accent)",
                        border: "none",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        boxShadow: "var(--shadow-glow)",
                      }}
                    >
                      <Maximize size={16} style={{ color: "white" }} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Live indicator when playing */}
          {isPlaying && isHovered && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                background: "rgba(0,0,0,0.6)",
                padding: "4px 10px",
                borderRadius: "20px",
                backdropFilter: "blur(4px)",
              }}
            >
              <span
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: "#ff4444",
                  animation: "pulse 1.5s infinite",
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "white",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Preview
              </span>
            </motion.div>
          )}
        </div>

        {/* Card Info */}
        <div
          style={{
            padding: compact ? "12px" : "16px",
          }}
        >
          <h3
            style={{
              fontSize: compact ? "14px" : "15px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 4px",
              lineHeight: 1.4,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {title}
          </h3>

          {subtitle && (
            <p
              style={{
                fontSize: "13px",
                color: "var(--color-text-tertiary)",
                margin: "0 0 8px",
                lineHeight: 1.4,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {subtitle}
            </p>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: "12px",
                fontSize: "12px",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              {duration && <span>{formatDuration(duration)}</span>}
              {date && <span>{formatDate(date)}</span>}
            </div>

            {/* Actions */}
            {actions || (
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    openLightbox();
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "transparent",
                    border: "1px solid var(--color-border)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "var(--color-text-tertiary)",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "var(--color-bg-tertiary)";
                    e.currentTarget.style.color = "var(--color-accent)";
                    e.currentTarget.style.borderColor = "var(--color-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "var(--color-text-tertiary)";
                    e.currentTarget.style.borderColor = "var(--color-border)";
                  }}
                >
                  <ExternalLink size={14} />
                </button>
                <a
                  href={artifactUrl}
                  download
                  onClick={() => {
                    if (onDownload) onDownload();
                  }}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "6px",
                    background: "var(--color-accent)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    color: "white",
                    transition: "all 0.2s ease",
                    textDecoration: "none",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = "scale(1.05)";
                    e.currentTarget.style.boxShadow = "var(--shadow-accent)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = "scale(1)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  <Download size={14} />
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Lightbox Modal */}
      <VideoLightbox
        isOpen={showLightbox}
        onClose={closeLightbox}
        videoUrl={artifactUrl}
        title={title}
      />

      {/* Pulse animation for live indicator */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </>
  );
}

// Video Lightbox Component
interface VideoLightboxProps {
  isOpen: boolean;
  onClose: () => void;
  videoUrl: string;
  title: string;
}

function VideoLightbox({ isOpen, onClose, videoUrl, title }: VideoLightboxProps): ReactElement {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isOpen && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0, 0, 0, 0.95)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
          onClick={onClose}
        >
          {/* Header */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              padding: "20px 24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "linear-gradient(to bottom, rgba(0,0,0,0.8), transparent)",
            }}
          >
            <h2
              style={{
                color: "white",
                fontSize: "18px",
                fontWeight: 600,
                margin: 0,
                textShadow: "0 2px 4px rgba(0,0,0,0.5)",
              }}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "50%",
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.2)",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
              }}
            >
              <X size={20} />
            </button>
          </motion.div>

          {/* Video Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            style={{
              width: "100%",
              maxWidth: "500px",
              maxHeight: "90vh",
              position: "relative",
              borderRadius: "16px",
              overflow: "hidden",
              boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <video
              ref={videoRef}
              src={videoUrl}
              style={{
                width: "100%",
                height: "100%",
                maxHeight: "80vh",
                objectFit: "contain",
                background: "#000",
                borderRadius: "16px",
              }}
              controls
              autoPlay
              playsInline
            />
          </motion.div>

          {/* Download button at bottom */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            style={{
              position: "absolute",
              bottom: "30px",
              left: "50%",
              transform: "translateX(-50%)",
            }}
          >
            <a
              href={videoUrl}
              download
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 24px",
                background: "var(--color-accent)",
                color: "white",
                borderRadius: "30px",
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "14px",
                boxShadow: "var(--shadow-glow)",
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateX(-50%) scale(1.05)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateX(-50%) scale(1)";
              }}
            >
              <Download size={18} />
              Download Clip
            </a>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
