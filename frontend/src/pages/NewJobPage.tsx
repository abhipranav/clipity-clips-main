import type { ReactElement, FormEvent } from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/api";
import { ArrowRight, Film, AlertCircle, CheckCircle, Clock, ChevronDown, ChevronUp } from "@/components/icons";
import type { JobOptions } from "@/types";
import "./NewJobPage.css";

export function NewJobPage(): ReactElement {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [extractedId, setExtractedId] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [jobOptions, setJobOptions] = useState<JobOptions>({});

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const createJob = useMutation({
    mutationFn: api.createJob,
    onSuccess: (data) => {
      navigate(`/runs/${data.runId}`);
    },
  });

  function validateYouTubeUrl(input: string): boolean {
    const pattern = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/;
    return pattern.test(input.trim());
  }

  function extractVideoId(input: string): string | null {
    const match = input.match(/(?:v=|\/shorts\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match?.[1] ?? null;
  }

  function handleUrlChange(value: string): void {
    setUrl(value);
    const valid = validateYouTubeUrl(value);
    setIsValid(value ? valid : null);
    if (valid) {
      setExtractedId(extractVideoId(value));
    } else {
      setExtractedId(null);
    }
  }

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    if (!validateYouTubeUrl(url)) return;
    
    // Only send options if user has customized them
    const hasCustomOptions = Object.keys(jobOptions).length > 0;
    createJob.mutate({ 
      videoUrl: url.trim(),
      options: hasCustomOptions ? jobOptions : undefined,
    });
  }

  function handlePasteExample(): void {
    const exampleUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    handleUrlChange(exampleUrl);
  }

  const defaults = settings?.creatorDefaults;
  const validation = settings?.validation;

  return (
    <div className="new-job-page">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="new-job-container"
      >
        <div className="page-header">
          <h1 className="page-title">Queue a New Job</h1>
          <p className="page-subtitle">
            Paste a YouTube URL to start extracting short-form clips
          </p>
        </div>

        <form onSubmit={handleSubmit} className="job-form">
          <div className="url-input-container">
            <label htmlFor="videoUrl" className="input-label">
              YouTube Video URL
            </label>
            <div className="input-wrapper">
              <input
                type="text"
                id="videoUrl"
                value={url}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className={`url-input ${isValid === false ? "invalid" : ""} ${isValid === true ? "valid" : ""}`}
                disabled={createJob.isPending}
              />
              {isValid === true && (
                <CheckCircle size={20} className="input-icon valid" />
              )}
              {isValid === false && (
                <AlertCircle size={20} className="input-icon invalid" />
              )}
            </div>
            {isValid === false && (
              <p className="input-error">Please enter a valid YouTube URL</p>
            )}
          </div>

          {extractedId && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="source-preview"
            >
              <div className="preview-card">
                <Film size={24} className="preview-icon" />
                <div className="preview-content">
                  <span className="preview-label">Video ID detected</span>
                  <span className="preview-id">{extractedId}</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Advanced Options Panel */}
          {defaults && validation && (
            <div className="advanced-section">
              <button
                type="button"
                className="advanced-toggle"
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                <span>Style & Output Options</span>
                {showAdvanced ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>

              <AnimatePresence>
                {showAdvanced && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="advanced-panel"
                  >
                    <p className="advanced-hint">
                      Customize how clips will be styled and output. 
                      Leave as default to use your global settings.
                    </p>

                    {/* Caption Preset */}
                    <div className="advanced-group">
                      <label>Caption Preset</label>
                      <select
                        value={jobOptions.captions?.presetId ?? defaults.captions.presetId}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          captions: { ...jobOptions.captions, presetId: e.target.value as any }
                        })}
                      >
                        {settings?.capabilities.captionPresets.map((p) => (
                          <option key={p} value={p}>{p.replace(/-/g, " ")}</option>
                        ))}
                      </select>
                    </div>

                    {/* Aspect Ratio */}
                    <div className="advanced-group">
                      <label>Aspect Ratio</label>
                      <select
                        value={jobOptions.output?.aspectPreset ?? defaults.output.aspectPreset}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          output: { ...jobOptions.output, aspectPreset: e.target.value as any }
                        })}
                      >
                        {settings?.capabilities.aspectPresets.map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </select>
                    </div>

                    {/* Clip Speed */}
                    <div className="advanced-group">
                      <label>Clip Speed ({defaults.output.clipSpeed}x default)</label>
                      <input
                        type="number"
                        min={validation.clipSpeed.min}
                        max={validation.clipSpeed.max}
                        step={0.1}
                        value={jobOptions.output?.clipSpeed ?? defaults.output.clipSpeed}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          output: { ...jobOptions.output, clipSpeed: Number(e.target.value) }
                        })}
                      />
                    </div>

                    {/* Split Screen */}
                    <div className="advanced-group">
                      <label>Split Screen Mode</label>
                      <select
                        value={jobOptions.output?.splitScreenMode ?? defaults.output.splitScreenMode}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          output: { ...jobOptions.output, splitScreenMode: e.target.value as any }
                        })}
                      >
                        {settings?.capabilities.splitScreenModes.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>

                    {/* Max Clips */}
                    <div className="advanced-group">
                      <label>Max Clips (0 = unlimited, default: {defaults.clipSelection.maxClips})</label>
                      <input
                        type="number"
                        min={validation.maxClips.min}
                        max={validation.maxClips.max}
                        value={jobOptions.clipSelection?.maxClips ?? defaults.clipSelection.maxClips}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          clipSelection: { ...jobOptions.clipSelection, maxClips: Number(e.target.value) }
                        })}
                      />
                    </div>

                    {/* Font */}
                    <div className="advanced-group">
                      <label>Caption Font</label>
                      <select
                        value={jobOptions.captions?.fontId ?? defaults.captions.fontId}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          captions: { ...jobOptions.captions, fontId: e.target.value as any }
                        })}
                      >
                        {settings?.capabilities.fonts.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </div>

                    {/* Text Case */}
                    <div className="advanced-group">
                      <label>Text Case</label>
                      <select
                        value={jobOptions.captions?.textCase ?? defaults.captions.textCase}
                        onChange={(e) => setJobOptions({
                          ...jobOptions,
                          captions: { ...jobOptions.captions, textCase: e.target.value as any }
                        })}
                      >
                        {settings?.capabilities.textCases.map((t) => (
                          <option key={t} value={t}>{t}</option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      className="reset-options"
                      onClick={() => setJobOptions({})}
                    >
                      Reset to Defaults
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="timeline-preview">
            <h3 className="timeline-title">What happens next</h3>
            <div className="timeline-steps">
              <div className="timeline-step">
                <div className="step-icon"><Film size={16} /></div>
                <div className="step-content">
                  <span className="step-label">Download</span>
                  <span className="step-desc">Video & audio extraction</span>
                </div>
              </div>
              <div className="timeline-step">
                <div className="step-icon"><Sparkles size={16} /></div>
                <div className="step-content">
                  <span className="step-label">Transcribe</span>
                  <span className="step-desc">Speech to text</span>
                </div>
              </div>
              <div className="timeline-step">
                <div className="step-icon"><Sparkles size={16} /></div>
                <div className="step-content">
                  <span className="step-label">Identify</span>
                  <span className="step-desc">AI finds best clips</span>
                </div>
              </div>
              <div className="timeline-step">
                <div className="step-icon"><Clock size={16} /></div>
                <div className="step-content">
                  <span className="step-label">Process</span>
                  <span className="step-desc">Extract & caption</span>
                </div>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn-primary"
              disabled={!isValid || createJob.isPending}
            >
              {createJob.isPending ? (
                <>
                  <span className="spinner" />
                  Queueing...
                </>
              ) : (
                <>
                  Queue Job
                  <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handlePasteExample}
              disabled={createJob.isPending}
            >
              Paste Example URL
            </button>
          </div>

          {createJob.isError && (
            <div className="form-error">
              <AlertCircle size={16} />
              {createJob.error instanceof Error ? createJob.error.message : "Failed to create job"}
            </div>
          )}
        </form>
      </motion.div>
    </div>
  );
}

// Sparkles icon
const Sparkles = ({ size = 24, className = "" }: { size?: number; className?: string }): ReactElement => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4" />
    <path d="M19 17v4" />
    <path d="M3 5h4" />
    <path d="M17 19h4" />
  </svg>
);
