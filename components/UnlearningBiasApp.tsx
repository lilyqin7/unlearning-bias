"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Theme = "dark" | "light";

type PanelPhase =
  | { type: "placeholder" }
  | { type: "loading"; message: string }
  | {
      type: "demo-result";
      message: string;
      promptText: string;
      isDiverse: boolean;
    }
  | { type: "image"; imageUrl: string; message: string; promptText: string };

type HistoryEntry = {
  id: string;
  prompt: string;
  scale: string;
  steps: string;
  thumbUrl?: string;
};

const INITIAL_HISTORY: HistoryEntry[] = [
  {
    id: "h1",
    prompt: "a portrait of a CEO",
    scale: "0.8",
    steps: "30",
  },
  {
    id: "h2",
    prompt: "a portrait of a judge in a courtroom",
    scale: "1.0",
    steps: "30",
  },
  {
    id: "h3",
    prompt: "a portrait of a software engineer",
    scale: "0.6",
    steps: "30",
  },
];

function PlaceholderIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

function PortraitIcon({ color, opacity = 0.6 }: { color: string; opacity?: number }) {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" opacity={opacity}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function LogoSvg() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" stroke="currentColor" strokeWidth="1.5" opacity="0.3" />
      <circle cx="16" cy="16" r="8" fill="var(--color-primary)" opacity="0.15" />
      <circle cx="12" cy="16" r="6" stroke="var(--color-accent-biased)" strokeWidth="1.5" fill="none" />
      <circle cx="20" cy="16" r="6" stroke="var(--color-primary)" strokeWidth="1.5" fill="none" />
      <path
        d="M16 10.5 C17.8 12.5 17.8 19.5 16 21.5 C14.2 19.5 14.2 12.5 16 10.5Z"
        fill="var(--color-primary)"
        opacity="0.3"
      />
    </svg>
  );
}

async function downloadImageFile(url: string, filename: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Download failed");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function BiasedPanelContent({ phase }: { phase: PanelPhase }) {
  if (phase.type === "placeholder") {
    return (
      <div className="image-placeholder">
        <PlaceholderIcon />
        <p>Enter a prompt and click Generate to see the baseline output</p>
      </div>
    );
  }
  if (phase.type === "loading") {
    return (
      <div className="loading-overlay skeleton">
        <div className="loading-spinner" />
        <span className="loading-text">{phase.message}</span>
      </div>
    );
  }
  if (phase.type === "image") {
    return <img src={phase.imageUrl} alt="" className="generated-image" />;
  }
  const color = "var(--color-accent-biased)";
  const bgColor = "var(--color-accent-biased-highlight)";
  return (
    <div className="generated-result">
      <div className="generated-result-inner" style={{ background: bgColor }}>
        <PortraitIcon color={color} />
        <div className="generated-result-label" style={{ color }}>
          ⚠ Baseline Output
        </div>
        <div className="generated-result-prompt">&quot;{phase.promptText}&quot;</div>
        <div className="generated-result-hint">Connect GPU backend to see real generated images</div>
      </div>
    </div>
  );
}

function DiversePanelContent({ phase }: { phase: PanelPhase }) {
  if (phase.type === "placeholder") {
    return (
      <div className="image-placeholder">
        <PlaceholderIcon />
        <p>The diverse LoRA output will appear here for comparison</p>
      </div>
    );
  }
  if (phase.type === "loading") {
    return (
      <div className="loading-overlay skeleton">
        <div className="loading-spinner" />
        <span className="loading-text">{phase.message}</span>
      </div>
    );
  }
  if (phase.type === "image") {
    return <img src={phase.imageUrl} alt="" className="generated-image" />;
  }
  const color = "var(--color-primary)";
  const bgColor = "var(--color-primary-highlight)";
  return (
    <div className="generated-result">
      <div className="generated-result-inner" style={{ background: bgColor }}>
        <PortraitIcon color={color} />
        <div className="generated-result-label" style={{ color }}>
          ✓ Diverse Output
        </div>
        <div className="generated-result-prompt">&quot;{phase.promptText}&quot;</div>
        <div className="generated-result-hint">Connect GPU backend to see real generated images</div>
      </div>
    </div>
  );
}

export function UnlearningBiasApp() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [prompt, setPrompt] = useState("a portrait of a CEO");
  const [loraScale, setLoraScale] = useState(0.8);
  const [inferenceSteps, setInferenceSteps] = useState(30);
  const [guidance, setGuidance] = useState("7.5");
  const [isGenerating, setIsGenerating] = useState(false);
  const genLock = useRef(false);
  const [genDurationSec, setGenDurationSec] = useState<number | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  const [biasedPhase, setBiasedPhase] = useState<PanelPhase>({ type: "placeholder" });
  const [diversePhase, setDiversePhase] = useState<PanelPhase>({ type: "placeholder" });
  const [biasedMeta, setBiasedMeta] = useState("Ready");
  const [diverseMeta, setDiverseMeta] = useState("Ready");

  const [insightsVisible, setInsightsVisible] = useState(false);
  const [biasScoreNote, setBiasScoreNote] = useState("Baseline: high gender/ethnic skew");
  const [appliedScaleNote, setAppliedScaleNote] = useState("Diverse dataset influence");
  const [genTimeNote, setGenTimeNote] = useState("30 denoising steps · T4 GPU");

  const [history, setHistory] = useState<HistoryEntry[]>(INITIAL_HISTORY);

  const scaleStr = loraScale.toFixed(2);
  const diverseSubtitle = useMemo(
    () => `SDXL 1.0 · div_rep LoRA · scale = ${scaleStr}`,
    [scaleStr],
  );

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  }, []);

  const setPromptFromChip = useCallback((text: string) => {
    setPrompt(text);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (genLock.current) return;
    genLock.current = true;
    setIsGenerating(true);
    setGenerationError(null);

    const p = prompt.trim() || "a portrait of a CEO";
    const scale = loraScale.toFixed(2);
    const steps = String(inferenceSteps);
    const guidanceScale = parseFloat(guidance);

    setBiasedPhase({ type: "loading", message: "Generating · SDXL 1.0 baseline..." });
    setDiversePhase({ type: "loading", message: `Generating · div_rep scale=${scale}...` });
    setBiasedMeta("Generating · SDXL 1.0 baseline...");
    setDiverseMeta(`Generating · div_rep scale=${scale}...`);

    const clientStarted = performance.now();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: p,
          loraScale,
          numInferenceSteps: inferenceSteps,
          guidanceScale,
        }),
      });

      const data = (await res.json()) as {
        error?: string;
        hint?: string;
        baselineUrl?: string;
        diverseUrl?: string;
        durationMs?: number;
      };

      if (!res.ok) {
        const detail = [data.error, data.hint].filter(Boolean).join(" ");
        throw new Error(detail || `Generation failed (${res.status})`);
      }

      if (!data.baselineUrl || !data.diverseUrl) {
        throw new Error("Server response missing image URLs");
      }

      const elapsedSec =
        typeof data.durationMs === "number" ? data.durationMs / 1000 : (performance.now() - clientStarted) / 1000;
      setGenDurationSec(elapsedSec);

      setBiasedPhase({
        type: "image",
        imageUrl: data.baselineUrl,
        message: "Generated · SDXL 1.0 base · No LoRA",
        promptText: p,
      });
      setDiversePhase({
        type: "image",
        imageUrl: data.diverseUrl,
        message: `Generated · div_rep LoRA · scale=${scale}`,
        promptText: p,
      });
      setBiasedMeta("Generated · SDXL 1.0 base · No LoRA");
      setDiverseMeta(`Generated · div_rep LoRA · scale=${scale}`);

      setInsightsVisible(true);
      setBiasScoreNote("↑ Male/White skew in baseline");
      setAppliedScaleNote(`${Math.round(parseFloat(scale) * 100)}% LoRA influence`);
      setGenTimeNote(`${steps} denoising steps · GPU backend`);

      const entry: HistoryEntry = {
        id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        prompt: p,
        scale,
        steps,
        thumbUrl: data.diverseUrl,
      };
      setHistory((h) => [entry, ...h]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGenerationError(msg);
      setBiasedPhase({ type: "placeholder" });
      setDiversePhase({ type: "placeholder" });
      setBiasedMeta("Ready");
      setDiverseMeta("Ready");
    } finally {
      genLock.current = false;
      setIsGenerating(false);
    }
  }, [prompt, loraScale, inferenceSteps, guidance]);

  const themeAria = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <div className="unlearning-bias app">
      <header>
        <a href="#" className="logo" aria-label="Unlearning Bias" onClick={(e) => e.preventDefault()}>
          <LogoSvg />
          <div>
            <div className="logo-text">Unlearning Bias</div>
            <div className="logo-sub">Visualizing Dataset Influence on Generated Art</div>
          </div>
        </a>
        <div className="header-actions">
          <button type="button" className="theme-toggle" onClick={toggleTheme} aria-label={themeAria}>
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="5" />
                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </header>

      <main>
        <section className="hero">
          <p>
            Enter any professional prompt and compare how a biased baseline model represents it versus a LoRA trained
            on diverse images.
          </p>
        </section>

        <div className="info-banner">
          <span className="info-banner-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </span>
          <p>
            <strong>How it works:</strong> The left panel shows output from the unmodified SDXL 1.0 base model. The
            right panel applies a custom LoRA trained on <strong>36 diverse professional images</strong> using trigger
            token <code>div_rep</code>. Adjust LoRA Scale to control how heavily the model applies the diverse dataset.
          </p>
        </div>

        <div className="status-bar">
          <div className="status-left">
            <div className="status-dot" />
            <span>GPU · Colab / FastAPI · SDXL 1.0 + HF LoRA URL</span>
          </div>
          <span className="status-right">network_dim: 32 · network_alpha: 16 · num_inference_steps: 30</span>
        </div>

        <div className="prompt-panel">
          <p className="prompt-panel-title">Generate Comparison</p>
          <div className="prompt-row">
            <input
              className="prompt-input"
              type="text"
              placeholder="a portrait of a CEO sitting in an office"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
            <button type="button" className="btn-generate" disabled={isGenerating} onClick={() => void handleGenerate()}>
              {isGenerating ? (
                <>
                  <div className="loading-spinner inline-spinner" />
                  Generating...
                </>
              ) : (
                <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  Generate
                </>
              )}
            </button>
          </div>

          {generationError ? (
            <p className="generation-error" role="alert">
              {generationError}
            </p>
          ) : null}

          <div className="controls">
            <div className="control-group">
              <div className="control-row-head">
                <span className="control-label">LoRA Scale</span>
                <span className="control-value">{scaleStr}</span>
              </div>
              <input
                type="range"
                min={0}
                max={1.5}
                step={0.05}
                value={loraScale}
                onChange={(e) => setLoraScale(parseFloat(e.target.value))}
              />
              <span className="panel-meta">0 = base model only · 1.5 = full LoRA</span>
            </div>
            <div className="control-group">
              <div className="control-row-head">
                <span className="control-label">Inference Steps</span>
                <span className="control-value">{inferenceSteps}</span>
              </div>
              <input
                type="range"
                min={10}
                max={60}
                step={5}
                value={inferenceSteps}
                onChange={(e) => setInferenceSteps(parseInt(e.target.value, 10))}
              />
              <span className="panel-meta">10 = fast/rough · 60 = slow/sharp</span>
            </div>
            <div className="control-group">
              <span className="control-label">Guidance Scale</span>
              <select className="control-select" value={guidance} onChange={(e) => setGuidance(e.target.value)}>
                <option value="5">5.0 — Creative</option>
                <option value="7.5">7.5 — Balanced</option>
                <option value="9">9.0 — Faithful</option>
                <option value="12">12.0 — Strict</option>
              </select>
              <span className="panel-meta">How closely to follow prompt</span>
            </div>
          </div>

          <div className="quick-prompts">
            <span className="quick-prompt-label">Try:</span>
            <button type="button" className="chip" onClick={() => setPromptFromChip("a portrait of a CEO")}>
              CEO
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setPromptFromChip("a portrait of a judge in a courtroom")}
            >
              Judge
            </button>
            <button type="button" className="chip" onClick={() => setPromptFromChip("a portrait of a business executive")}>
              Executive
            </button>
            <button
              type="button"
              className="chip"
              onClick={() => setPromptFromChip("a portrait of a software engineer")}
            >
              Software Engineer
            </button>
            <button type="button" className="chip" onClick={() => setPromptFromChip("a portrait of a doctor in a hospital")}>
              Doctor
            </button>
            <button type="button" className="chip" onClick={() => setPromptFromChip("a portrait of a scientist in a lab")}>
              Scientist
            </button>
          </div>
        </div>

        <div className="comparison-grid">
          <div className="image-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-dot biased" />
                <div>
                  <div className="panel-title">Baseline Model</div>
                  <div className="panel-subtitle">SDXL 1.0 · No LoRA · scale = 0.0</div>
                </div>
              </div>
              <span className="panel-badge biased">Biased</span>
            </div>
            <div className="image-area">
              <BiasedPanelContent phase={biasedPhase} />
            </div>
            <div className="panel-footer">
              <span className="panel-meta">{biasedMeta}</span>
              {biasedPhase.type === "demo-result" || biasedPhase.type === "image" ? (
                <button
                  type="button"
                  className="btn-download"
                  onClick={() => {
                    if (biasedPhase.type === "image") {
                      void downloadImageFile(biasedPhase.imageUrl, "baseline.png");
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Save
                </button>
              ) : null}
            </div>
          </div>

          <div className="image-panel">
            <div className="panel-header">
              <div className="panel-header-left">
                <div className="panel-dot debiased" />
                <div>
                  <div className="panel-title">Debiased LoRA</div>
                  <div className="panel-subtitle">{diverseSubtitle}</div>
                </div>
              </div>
              <span className="panel-badge debiased">Diverse</span>
            </div>
            <div className="image-area">
              <DiversePanelContent phase={diversePhase} />
            </div>
            <div className="panel-footer">
              <span className="panel-meta">{diverseMeta}</span>
              {diversePhase.type === "demo-result" || diversePhase.type === "image" ? (
                <button
                  type="button"
                  className="btn-download"
                  onClick={() => {
                    if (diversePhase.type === "image") {
                      void downloadImageFile(diversePhase.imageUrl, "diverse-lora.png");
                    }
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                  Save
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {insightsVisible ? (
          <div className="insights-row">
            <div className="insight-card">
              <div className="insight-label">Model Bias Score</div>
              <div className="insight-value">High</div>
              <div className="insight-delta negative">{biasScoreNote}</div>
            </div>
            <div className="insight-card">
              <div className="insight-label">LoRA Scale Applied</div>
              <div className="insight-value">{scaleStr}</div>
              <div className="insight-delta">{appliedScaleNote}</div>
            </div>
            <div className="insight-card">
              <div className="insight-label">Generation Time</div>
              <div className="insight-value">
                {genDurationSec != null ? `${genDurationSec.toFixed(1)}s` : "—"}
              </div>
              <div className="insight-delta">{genTimeNote}</div>
            </div>
          </div>
        ) : null}

        <hr className="divider" />

        <p className="section-title">Previous Generations</p>
        <div className="history-grid">
          {history.map((item) => {
            const short = item.prompt.length > 28 ? `${item.prompt.slice(0, 28)}...` : item.prompt;
            return (
              <button
                type="button"
                key={item.id}
                className="history-item"
                onClick={() => setPromptFromChip(item.prompt)}
              >
                <div className="history-thumb">
                  <div className="history-thumb-inner" style={{ background: "var(--color-primary-highlight)" }}>
                    {item.thumbUrl ? (
                      <img src={item.thumbUrl} alt="" className="history-thumb-img" />
                    ) : (
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--color-primary)"
                        strokeWidth="1.5"
                        opacity="0.6"
                      >
                        <circle cx="12" cy="8" r="4" />
                        <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                      </svg>
                    )}
                  </div>
                </div>
                <div className="history-info">
                  <div className="history-prompt">{short}</div>
                  <div className="history-meta">
                    scale: {item.scale} · {item.steps} steps
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </main>
    </div>
  );
}
