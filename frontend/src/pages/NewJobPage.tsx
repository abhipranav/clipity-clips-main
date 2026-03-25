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

                    {/* Background Video (Split-Screen) */}
                    <div className="advanced-group">
                      <label>Background Video (Split Screen)</label>
                      <div className="asset-grid">
                        <div 
                          className={`asset-card ${(jobOptions.output?.brainrotType ?? defaults.output.brainrotType) === 'none' ? 'active' : ''}`}
                          onClick={() => setJobOptions({
                            ...jobOptions,
                            output: { ...jobOptions.output, brainrotType: 'none', splitScreenMode: 'never', brollMode: 'none' }
                          })}
                          style={{ minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <div className="asset-label" style={{ top: 0, position: 'relative', background: 'none', padding: 10, color: 'var(--color-text-primary)' }}>
                            None / Gameplay Only
                          </div>
                          {((jobOptions.output?.brainrotType ?? defaults.output.brainrotType) === 'none') && <div className="asset-check"><CheckCircle size={12} /></div>}
                        </div>

                        {(settings?.capabilities.brainrotTypes ?? []).filter(t => t !== "none").map((t) => {
                          const isActive = (jobOptions.output?.brainrotType ?? defaults.output.brainrotType) === t;
                          const isSpecial = t === "random";
                          const isBroll = ['finance', 'tech', 'nature'].includes(t);
                          const thumbPath = `/assets/${isBroll ? 'broll' : 'brainrot'}/${t}/thumbnail.jpg`;
                          
                          return (
                            <div 
                              key={t} 
                              className={`asset-card ${isActive ? 'active' : ''}`}
                              onClick={() => setJobOptions({
                                ...jobOptions,
                                output: { 
                                  ...jobOptions.output, 
                                  brainrotType: t as any,
                                  splitScreenMode: 'always',
                                  brollMode: 'none',
                                  brainrotClipIdx: 'random'
                                }
                              })}
                              style={isSpecial ? { minHeight: '80px', display: 'flex', alignItems: 'center', justifyContent: 'center' } : undefined}
                            >
                              {isSpecial ? (
                                <div className="asset-label" style={{ position: 'relative', background: 'none', padding: 10, color: 'var(--color-text-primary)' }}>
                                  Random Mix
                                </div>
                              ) : (
                                <>
                                  <img 
                                    src={thumbPath} 
                                    alt={t} 
                                    className="asset-thumb"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <div className="asset-label">{t.replace(/-/g, " ")}</div>
                                </>
                              )}
                              {isActive && <div className="asset-check"><CheckCircle size={12} /></div>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Sub-Clip Selection */}
                      {((jobOptions.output?.brainrotType ?? defaults.output.brainrotType) !== "random" && (jobOptions.output?.brainrotType ?? defaults.output.brainrotType) !== "none") && (
                        <div style={{ marginTop: 'var(--space-md)' }}>
                          <label style={{ fontSize: '0.75rem', color: 'var(--color-text-tertiary)' }}>Select Specific Variation</label>
                          <div className="asset-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))' }}>
                            {/* Random Option */}
                            <div 
                              className={`asset-card ${(jobOptions.output?.brainrotClipIdx ?? defaults.output.brainrotClipIdx) === 'random' ? 'active' : ''}`}
                              onClick={() => setJobOptions({
                                ...jobOptions,
                                output: { ...jobOptions.output, brainrotClipIdx: 'random' }
                              })}
                              style={{ height: '60px', aspectRatio: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <div className="asset-label" style={{ position: 'relative', background: 'none', padding: 0, color: 'var(--color-text-primary)' }}>
                                Random
                              </div>
                              {(jobOptions.output?.brainrotClipIdx ?? defaults.output.brainrotClipIdx) === 'random' && <div className="asset-check"><CheckCircle size={12} /></div>}
                            </div>
                            
                            {/* Specific Clips */}
                            {((['finance', 'tech', 'nature'].includes(jobOptions.output?.brainrotType ?? defaults.output.brainrotType) ? settings?.capabilities.availableClips?.broll : settings?.capabilities.availableClips?.brainrot)?.[jobOptions.output?.brainrotType ?? defaults.output.brainrotType] ?? []).map((idx) => {
                              const isActive = (jobOptions.output?.brainrotClipIdx ?? defaults.output.brainrotClipIdx) === idx;
                              const currentCategory = jobOptions.output?.brainrotType ?? defaults.output.brainrotType;
                              const isBroll = ['finance', 'tech', 'nature'].includes(currentCategory);
                              const subThumbPath = `/assets/${isBroll ? 'broll' : 'brainrot'}/${currentCategory}/thumb_${idx}.jpg`;
                              return (
                                <div 
                                  key={idx} 
                                  className={`asset-card ${isActive ? 'active' : ''}`}
                                  onClick={() => setJobOptions({
                                    ...jobOptions,
                                    output: { ...jobOptions.output, brainrotClipIdx: idx as any }
                                  })}
                                >
                                  <img 
                                    src={subThumbPath} 
                                    alt={`Clip ${idx}`} 
                                    className="asset-thumb"
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                  <div className="asset-label">Variation {idx}</div>
                                  {isActive && <div className="asset-check"><CheckCircle size={12} /></div>}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
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
                      <div className="asset-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
                        {settings?.capabilities.fonts.map((f) => {
                          const isActive = (jobOptions.captions?.fontId ?? defaults.captions.fontId) === f;
                          const getFontFamily = (id: string) => {
                            if (id === 'montserrat') return "'Montserrat', sans-serif";
                            if (id === 'anton') return "'Anton', sans-serif";
                            if (id === 'bangers') return "'Bangers', cursive";
                            if (id === 'oswald') return "'Oswald', sans-serif";
                            if (id === 'roboto-mono') return "'Roboto Mono', monospace";
                            return "sans-serif";
                          };

                          return (
                            <div 
                              key={f} 
                              className={`asset-card ${isActive ? 'active' : ''}`}
                              onClick={() => setJobOptions({
                                ...jobOptions,
                                captions: { ...jobOptions.captions, fontId: f as any }
                              })}
                              style={{ height: '60px', aspectRatio: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <span style={{ fontFamily: getFontFamily(f), fontSize: '1.2rem', color: isActive ? 'var(--color-primary)' : 'var(--color-text-primary)' }}>
                                {f.replace(/-/g, " ")}
                              </span>
                              {isActive && <div className="asset-check"><CheckCircle size={12} /></div>}
                            </div>
                          );
                        })}
                      </div>
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
