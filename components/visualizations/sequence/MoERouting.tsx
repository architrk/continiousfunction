'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';

const EXPERT_COUNT = 8;
const TOP_K = 2;
const ACTIVE_PERCENT = Math.round((TOP_K / EXPERT_COUNT) * 100);

const EXPERT_COLORS: string[] = [
  '#fb923c',
  '#22c55e',
  '#38bdf8',
  '#a855f7',
  '#ec4899',
  '#facc15',
  '#14b8a6',
  '#f97316',
];

type TokenPresetId = 'text' | 'code' | 'math' | 'rare';

interface TokenPreset {
  label: string;
  logits: number[];
  description: string;
}

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed';
type ExpertPrediction = [number, number] | null; // Top-2 experts

// Mystery challenges for the prediction game
const ROUTING_CHALLENGES = [
  {
    name: '🎲 Mystery Token A',
    tokenType: 'text' as TokenPresetId,
    description: 'A common word in a paragraph. Which 2 experts will activate?',
  },
  {
    name: '🎲 Mystery Token B',
    tokenType: 'code' as TokenPresetId,
    description: 'A structured programming token. Which specialists handle it?',
  },
  {
    name: '🎲 Mystery Token C',
    tokenType: 'math' as TokenPresetId,
    description: 'A numeric value in a formula. Where will it route?',
  },
  {
    name: '🎲 Mystery Token D',
    tokenType: 'rare' as TokenPresetId,
    description: 'An unusual domain-specific term. Which experts specialize?',
  },
];

// Feedback based on prediction accuracy
const getRoutingFeedback = (
  predicted: ExpertPrediction,
  actualTopK: number[],
  tokenType: TokenPresetId,
  probabilities: number[]
): string => {
  if (!predicted) return '';

  const correctCount = predicted.filter(p => actualTopK.includes(p)).length;
  const actualLabel = TOKEN_PRESETS[tokenType].label;
  const prob1 = (probabilities[actualTopK[0]] * 100).toFixed(1);
  const prob2 = (probabilities[actualTopK[1]] * 100).toFixed(1);

  if (correctCount === 2) {
    return `🎯 Perfect! E${actualTopK[0]} (${prob1}%) + E${actualTopK[1]} (${prob2}%) are exactly right for "${actualLabel}". The router learned to send similar content to specialized experts!`;
  }
  if (correctCount === 1) {
    const hit = predicted.find(p => actualTopK.includes(p));
    const missed = actualTopK.find(e => !predicted.includes(e));
    return `🎖️ Half right! You got E${hit}, but missed E${missed}. "${actualLabel}" routes to E${actualTopK[0]} (${prob1}%) and E${actualTopK[1]} (${prob2}%). Different token types develop different routing patterns!`;
  }
  return `❌ Both wrong! "${actualLabel}" actually routes to E${actualTopK[0]} (${prob1}%) and E${actualTopK[1]} (${prob2}%). MoE routing is learned—the router discovers which experts specialize in what content.`;
};

// Toy router patterns – different token types favor different experts
const TOKEN_PRESETS: Record<TokenPresetId, TokenPreset> = {
  text: {
    label: 'Natural language',
    logits: [3.2, 2.0, 0.3, -0.5, 0.6, 2.6, -0.2, -1.0],
    description: 'Common words use general-language experts E0 and E5 the most.',
  },
  code: {
    label: 'Code token',
    logits: [0.3, -0.5, 2.6, 3.3, 0.0, 0.4, 1.4, -0.3],
    description: 'Structured tokens like code route heavily to E2 and E3.',
  },
  math: {
    label: 'Number / math',
    logits: [-0.4, 0.2, 0.4, 0.5, 3.1, 2.4, 0.3, -0.2],
    description: 'Numeric & math-ish tokens lean on E4 and E5.',
  },
  rare: {
    label: 'Rare / domain token',
    logits: [0.1, 2.7, 0.1, -0.6, 0.2, 0.4, 3.0, 2.4],
    description: 'Rare or domain-specific tokens use E1, E6, and sometimes E7.',
  },
};

function softmax(logits: ReadonlyArray<number>): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1;
  return exps.map((v) => v / sum);
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function MoERoutingDemo() {
  const [currentPresetId, setCurrentPresetId] = useState<TokenPresetId>('text');
  const [expertUsage, setExpertUsage] = useState<number[]>(
    () => new Array(EXPERT_COUNT).fill(0),
  );

  // Game state
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [selectedChallenge, setSelectedChallenge] = useState<typeof ROUTING_CHALLENGES[0] | null>(null);
  const [prediction, setPrediction] = useState<ExpertPrediction>(null);
  const [selectedExperts, setSelectedExperts] = useState<number[]>([]);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const probabilities = useMemo(
    () => softmax(TOKEN_PRESETS[currentPresetId].logits),
    [currentPresetId],
  );

  const topKIndices = useMemo(() => {
    const pairs = probabilities.map((score, index) => ({ score, index }));
    pairs.sort((a, b) => b.score - a.score);
    return pairs.slice(0, TOP_K).map((p) => p.index);
  }, [probabilities]);

  const totalTokens = useMemo(
    () => expertUsage.reduce((sum, c) => sum + c, 0),
    [expertUsage],
  );
  const maxUsage = useMemo(
    () => expertUsage.reduce((max, v) => Math.max(max, v), 0),
    [expertUsage],
  );

  // Refs for animation
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const tokenSourceRef = useRef<HTMLDivElement | null>(null);
  const routerRef = useRef<HTMLDivElement | null>(null);
  const expertRefs = useRef<(HTMLDivElement | null)[]>([]);
  const routerBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const usageBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tokenBubbleRef = useRef<HTMLDivElement | null>(null);
  const routeTimelineRef = useRef<gsap.core.Timeline | null>(null);

  // Hide token bubble initially
  useEffect(() => {
    if (tokenBubbleRef.current) {
      gsap.set(tokenBubbleRef.current, { autoAlpha: 0 });
    }
  }, []);

  // Animate router score bars when probabilities change
  useEffect(() => {
    routerBarRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const p = probabilities[i] ?? 0;
      gsap.to(bar, {
        scaleX: 0.15 + p * 0.85,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
  }, [probabilities]);

  // Animate load-balancing bars when usage changes
  useEffect(() => {
    const denom = maxUsage || 1;
    usageBarRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const count = expertUsage[i] ?? 0;
      const normalized = count / denom;
      gsap.to(bar, {
        scaleY: 0.1 + normalized * 0.9,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
  }, [expertUsage, maxUsage]);

  // Game control functions
  const startChallenge = (challenge: typeof ROUTING_CHALLENGES[0]) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setSelectedExperts([]);
    setGamePhase('setup');
  };

  const toggleExpertSelection = (expertIdx: number) => {
    setSelectedExperts(prev => {
      if (prev.includes(expertIdx)) {
        return prev.filter(e => e !== expertIdx);
      }
      if (prev.length < 2) {
        return [...prev, expertIdx];
      }
      // Replace oldest selection
      return [prev[1], expertIdx];
    });
  };

  const submitPrediction = () => {
    if (!selectedChallenge || selectedExperts.length !== 2) return;
    setPrediction(selectedExperts as [number, number]);
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setGamePhase('setup');
    setSelectedChallenge(null);
    setPrediction(null);
    setSelectedExperts([]);
  };

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Reveal phase - show the actual routing
          if (selectedChallenge) {
            setCurrentPresetId(selectedChallenge.tokenType);

            // Calculate actual top-k for this token type
            const probs = softmax(TOKEN_PRESETS[selectedChallenge.tokenType].logits);
            const pairs = probs.map((score, index) => ({ score, index }));
            pairs.sort((a, b) => b.score - a.score);
            const actualTopK = pairs.slice(0, TOP_K).map(p => p.index);

            // Update score
            const correctCount = prediction?.filter(p => actualTopK.includes(p)).length ?? 0;
            setScore(prev => ({
              correct: prev.correct + (correctCount === 2 ? 2 : correctCount === 1 ? 1 : 0),
              total: prev.total + 2,
            }));
          }
          setGamePhase('revealed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, selectedChallenge, prediction]);

  const handleRouteToken = () => {
    if (
      !sceneRef.current ||
      !tokenSourceRef.current ||
      !routerRef.current ||
      !tokenBubbleRef.current ||
      topKIndices.length < TOP_K
    ) {
      return;
    }

    const sceneRect = sceneRef.current.getBoundingClientRect();
    const sourceRect = tokenSourceRef.current.getBoundingClientRect();
    const routerRect = routerRef.current.getBoundingClientRect();

    const expertRect1 =
      expertRefs.current[topKIndices[0]]?.getBoundingClientRect();
    const expertRect2 =
      expertRefs.current[topKIndices[1]]?.getBoundingClientRect();

    if (!expertRect1 || !expertRect2) return;

    const fromX =
      sourceRect.left - sceneRect.left + sourceRect.width * 0.5;
    const fromY =
      sourceRect.top - sceneRect.top + sourceRect.height * 0.5;

    const routerX =
      routerRect.left - sceneRect.left + routerRect.width * 0.5;
    const routerY =
      routerRect.top - sceneRect.top + routerRect.height * 0.5;

    const expert1X =
      expertRect1.left - sceneRect.left + expertRect1.width * 0.5;
    const expert1Y =
      expertRect1.top - sceneRect.top + expertRect1.height * 0.5;

    const expert2X =
      expertRect2.left - sceneRect.left + expertRect2.width * 0.5;
    const expert2Y =
      expertRect2.top - sceneRect.top + expertRect2.height * 0.5;

    const tokenEl = tokenBubbleRef.current;

    if (!tokenEl) return;

    // Update usage counts (visualizing load balancing over time)
    setExpertUsage((prev) => {
      const next = [...prev];
      topKIndices.forEach((idx) => {
        next[idx] = (next[idx] ?? 0) + 1;
      });
      return next;
    });

    // Kill any in-flight timeline
    if (routeTimelineRef.current) {
      routeTimelineRef.current.kill();
    }

    const tl = gsap.timeline();
    routeTimelineRef.current = tl;

    tl.set(tokenEl, {
      x: fromX,
      y: fromY,
      autoAlpha: 1,
    })
      // Token moves into the router
      .to(tokenEl, {
        duration: 0.6,
        x: routerX,
        y: routerY,
        ease: 'power2.inOut',
      })
      // Routed to top-1 expert
      .to(tokenEl, {
        duration: 0.55,
        x: expert1X,
        y: expert1Y,
        ease: 'power2.inOut',
      })
      // Back through router hub (conceptually combining outputs)
      .to(tokenEl, {
        duration: 0.5,
        x: routerX,
        y: routerY,
        ease: 'power2.inOut',
      })
      // Routed to top-2 expert
      .to(tokenEl, {
        duration: 0.55,
        x: expert2X,
        y: expert2Y,
        ease: 'power2.inOut',
      })
      // Fade out
      .to(tokenEl, {
        duration: 0.4,
        autoAlpha: 0,
        ease: 'power2.out',
      });
  };

  return (
    <section className="moe-card">
      <header className="moe-header">
        <div>
          <h2 className="moe-title">Mixture-of-Experts Router</h2>
          <p className="moe-subtitle">
            Each token picks a small subset of experts (top-{TOP_K} of{' '}
            {EXPERT_COUNT}) instead of using the whole layer.
          </p>
        </div>
        <div className="moe-compute-pill">
          <span className="moe-compute-label">Active parameters</span>
          <span className="moe-compute-value">
            {TOP_K}/{EXPERT_COUNT} experts = {ACTIVE_PERCENT}% compute
          </span>
        </div>
      </header>

      {/* Game Mode Toggle & UI */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.75rem', marginBottom: gameMode ? '0' : '0.75rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode);
            if (!gameMode) resetGame();
          }}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            border: gameMode ? '1px solid #fb923c' : '1px solid rgba(251, 146, 60, 0.3)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.2), rgba(251, 146, 60, 0.1))'
              : 'rgba(15, 23, 42, 0.9)',
            color: gameMode ? '#fed7aa' : '#e5e7eb',
            cursor: 'pointer',
            fontWeight: gameMode ? 600 : 400,
          }}
        >
          {gameMode ? '🎮 Challenge Mode' : '🎮 Try Challenge'}
        </button>
        {gameMode && score.total > 0 && (
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total} experts
          </span>
        )}
      </div>

      {/* Game Panel */}
      {gameMode && (
        <div style={{
          marginTop: '0.75rem',
          marginBottom: '0.75rem',
          padding: '0.85rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.1), rgba(56, 189, 248, 0.1))',
          border: '1px solid rgba(251, 146, 60, 0.3)',
        }}>
          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.5rem', fontWeight: 600 }}>
                🎯 Router Prediction Challenge
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                Given a mystery token, predict which 2 experts (of 8) will be activated by the router!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {ROUTING_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    title={challenge.description}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(251, 146, 60, 0.3)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.4rem', fontWeight: 600 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                {selectedChallenge.description}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                Select exactly 2 experts ({selectedExperts.length}/2 selected):
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.65rem' }}>
                {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                  const isSelected = selectedExperts.includes(i);
                  return (
                    <button
                      key={i}
                      onClick={() => toggleExpertSelection(i)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.45rem 0.8rem',
                        borderRadius: '6px',
                        border: `1px solid ${isSelected ? EXPERT_COLORS[i] : 'rgba(148, 163, 184, 0.3)'}`,
                        background: isSelected
                          ? `${EXPERT_COLORS[i]}25`
                          : 'rgba(15, 23, 42, 0.9)',
                        color: isSelected ? EXPERT_COLORS[i] : '#e5e7eb',
                        cursor: 'pointer',
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      E{i}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={submitPrediction}
                disabled={selectedExperts.length !== 2}
                style={{
                  fontSize: '0.78rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: 'none',
                  background: selectedExperts.length === 2
                    ? 'linear-gradient(90deg, #fb923c, #facc15)'
                    : 'rgba(107, 114, 128, 0.5)',
                  color: selectedExperts.length === 2 ? '#111827' : '#9ca3af',
                  cursor: selectedExperts.length === 2 ? 'pointer' : 'not-allowed',
                  fontWeight: 600,
                }}
              >
                {selectedExperts.length === 2
                  ? `Predict E${selectedExperts[0]} + E${selectedExperts[1]}`
                  : 'Select 2 experts'}
              </button>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.95rem', color: '#fed7aa', marginBottom: '0.5rem' }}>
                You predicted: <strong>E{prediction?.[0]} + E{prediction?.[1]}</strong>
              </p>
              <p style={{ fontSize: '2.2rem', color: '#e5e7eb', fontWeight: 700 }}>
                {countdown}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Running router...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{
                padding: '0.65rem',
                borderRadius: '8px',
                background: prediction?.filter(p => topKIndices.includes(p)).length === 2
                  ? 'rgba(34, 197, 94, 0.15)'
                  : prediction?.filter(p => topKIndices.includes(p)).length === 1
                  ? 'rgba(245, 158, 11, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction?.filter(p => topKIndices.includes(p)).length === 2
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : prediction?.filter(p => topKIndices.includes(p)).length === 1
                  ? '1px solid rgba(245, 158, 11, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '0.65rem',
              }}>
                <p style={{ fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getRoutingFeedback(prediction, topKIndices, selectedChallenge.tokenType, probabilities)}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(251, 146, 60, 0.3)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                Try Another
              </button>
            </>
          )}
        </div>
      )}

      <div className="moe-main">
        {/* Left: controls + misconception explainer */}
        <div className="moe-left-panel">
          <div className="moe-control-group">
            <div className="moe-control-label">Token type</div>
            <div className="moe-token-types">
              {(Object.entries(TOKEN_PRESETS) as [TokenPresetId, TokenPreset][])
                .map(([id, preset]) => {
                  const isActive = currentPresetId === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCurrentPresetId(id)}
                      className={`moe-token-pill ${
                        isActive ? 'active' : ''
                      }`}
                    >
                      <span className="moe-token-pill-dot" />
                      <span className="moe-token-pill-label">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
            </div>
            <p className="moe-token-description">
              {TOKEN_PRESETS[currentPresetId].description}
            </p>
            <button
              type="button"
              onClick={handleRouteToken}
              className="moe-route-button"
            >
              Route a sample token
            </button>
          </div>

          <div className="moe-myth-card">
            <div className="moe-myth-title">"8 × 7B ≠ 56B"</div>
            <p className="moe-myth-body">
              In a MoE layer we don&apos;t copy the whole 7B model 8×. The
              shared trunk (embeddings, attention, layer norms, etc.) stays
              single. Only the feed-forward (FFN/MLP) block is split into 8
              experts, and each token touches just {TOP_K} of them.
            </p>
            <div className="moe-myth-diagram">
              <div className="moe-myth-row">
                <span className="moe-myth-row-label">Shared trunk</span>
                <div className="moe-myth-shared-bar">
                  <span className="moe-myth-shared-label">
                    Attention + others (~7B)
                  </span>
                </div>
              </div>
              <div className="moe-myth-row">
                <span className="moe-myth-row-label">Expert FFNs</span>
                <div className="moe-myth-expert-strip">
                  {Array.from({ length: EXPERT_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="moe-myth-expert-chunk"
                      style={{ background: EXPERT_COLORS[i] }}
                    />
                  ))}
                </div>
              </div>
              <p className="moe-myth-footnote">
                Effective parameters per token are closer to{' '}
                <strong>7B + 2 small FFNs</strong>, not 8 × 7B.
              </p>
            </div>
          </div>
        </div>

        {/* Right: main visualization */}
        <div className="moe-right-panel">
          {/* Scene: token → router → experts */}
          <div ref={sceneRef} className="moe-scene">
            {/* This bubble is animated with GSAP in absolute coordinates */}
            <div ref={tokenBubbleRef} className="moe-token-bubble">
              token
            </div>

            <div className="moe-pipeline">
              {/* Tokens column (source for animation) */}
              <div
                className="moe-column moe-tokens-column"
                ref={tokenSourceRef}
              >
                <div className="moe-column-title">Tokens</div>
                <div className="moe-token-stack">
                  <div className="moe-token-pill">t₀</div>
                  <div className="moe-token-pill">t₁</div>
                  <div className="moe-token-pill">t₂</div>
                  <div className="moe-token-ellipsis">…</div>
                </div>
                <p className="moe-column-caption">
                  Router runs once per token to pick its experts.
                </p>
              </div>

              {/* Router column with score bars */}
              <div className="moe-column moe-router-column">
                <div ref={routerRef} className="moe-router-card">
                  <div className="moe-router-title">Router</div>
                  <p className="moe-router-caption">
                    Produces logits and softmax scores over experts.
                  </p>
                  <div className="moe-router-bars">
                    {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                      const score = probabilities[i] ?? 0;
                      const isTop = topKIndices.includes(i);
                      return (
                        <div
                          key={i}
                          className={`moe-router-bar-row ${
                            isTop ? 'top' : ''
                          }`}
                        >
                          <span className="moe-router-bar-label">
                            E{i}
                          </span>
                          <div className="moe-router-bar-track">
                            <div
                              ref={(el) => {
                                routerBarRefs.current[i] = el;
                              }}
                              className="moe-router-bar-fill"
                              style={{
                                background: EXPERT_COLORS[i],
                              }}
                            />
                          </div>
                          <span className="moe-router-bar-value">
                            {formatPercent(score)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Experts column */}
              <div className="moe-column moe-experts-column">
                <div className="moe-column-title">Experts (FFNs)</div>
                <div className="moe-expert-grid">
                  {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                    const isActive = topKIndices.includes(i);
                    const isOverloaded =
                      maxUsage > 0 && expertUsage[i] === maxUsage;
                    return (
                      <div
                        key={i}
                        ref={(el) => {
                          expertRefs.current[i] = el;
                        }}
                        className={`moe-expert-box ${
                          isActive ? 'active' : ''
                        } ${isOverloaded ? 'hot' : ''}`}
                        style={{
                          borderColor: EXPERT_COLORS[i],
                        }}
                      >
                        <div className="moe-expert-header">
                          <span
                            className="moe-expert-dot"
                            style={{ background: EXPERT_COLORS[i] }}
                          />
                          <span className="moe-expert-id">
                            Expert E{i}
                          </span>
                        </div>
                        <div className="moe-expert-body">
                          <span className="moe-expert-chip">
                            FFN weights
                          </span>
                          {isActive && (
                            <span className="moe-expert-chip active-chip">
                              active
                            </span>
                          )}
                          {isOverloaded && !isActive && (
                            <span className="moe-expert-chip hot-chip">
                              overused
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <p className="moe-column-caption">
                  Only the highlighted experts run for the current token.
                </p>
              </div>
            </div>
          </div>

          {/* Load-balancing visualization */}
          <div className="moe-load-section">
            <div className="moe-load-header">
              <span className="moe-load-title">Expert load</span>
              <span className="moe-load-subtitle">
                {totalTokens === 0
                  ? 'Route a few tokens to see usage'
                  : `${totalTokens} tokens routed so far`}
              </span>
            </div>
            <div className="moe-load-chart">
              {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                const usage = expertUsage[i] ?? 0;
                const isOverloaded =
                  maxUsage > 0 && usage === maxUsage && usage > 0;
                return (
                  <div key={i} className="moe-load-bar-group">
                    <div className="moe-load-bar-track">
                      <div
                        ref={(el) => {
                          usageBarRefs.current[i] = el;
                        }}
                        className={`moe-load-bar-fill ${
                          isOverloaded ? 'hot' : ''
                        }`}
                        style={{
                          background: EXPERT_COLORS[i],
                        }}
                      />
                    </div>
                    <div className="moe-load-bar-label">E{i}</div>
                    <div className="moe-load-bar-count">
                      {usage}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="moe-load-caption">
              A good MoE router tries to keep experts balanced. If one column
              dominates here, that&apos;s an overused expert.
            </p>
          </div>
        </div>
      </div>

      {/* Component-scoped styles */}
      <style jsx>{`
        .moe-card {
          background: #080c14;
          border-radius: 16px;
          padding: 20px 22px 24px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5e7eb;
          box-shadow: 0 22px 45px rgba(15, 23, 42, 0.7);
          font-family: system-ui, -apple-system, BlinkMacSystemFont,
            'SF Pro Text', sans-serif;
        }

        .moe-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .moe-title {
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          margin: 0;
        }

        .moe-subtitle {
          margin: 4px 0 0;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .moe-compute-pill {
          background: radial-gradient(
              circle at top left,
              rgba(244, 244, 245, 0.16),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.96);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.8rem;
          border: 1px solid rgba(248, 250, 252, 0.2);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          white-space: nowrap;
        }

        .moe-compute-label {
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.65rem;
        }

        .moe-compute-value {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }

        .moe-main {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          margin-top: 18px;
        }

        .moe-left-panel {
          flex: 0 0 260px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .moe-right-panel {
          flex: 1;
          min-width: 280px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .moe-control-group {
          padding: 12px 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: radial-gradient(
              circle at top left,
              rgba(56, 189, 248, 0.1),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.96);
        }

        .moe-control-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          margin-bottom: 6px;
        }

        .moe-token-types {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 8px;
        }

        .moe-token-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 9px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: rgba(15, 23, 42, 0.85);
          font-size: 0.8rem;
          color: #e5e7eb;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease,
            transform 0.12s ease;
        }

        .moe-token-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
        }

        .moe-token-pill-label {
          white-space: nowrap;
        }

        .moe-token-pill:hover {
          border-color: rgba(248, 250, 252, 0.7);
          transform: translateY(-0.5px);
        }

        .moe-token-pill.active {
          background: radial-gradient(
              circle at top left,
              rgba(251, 146, 60, 0.3),
              transparent 70%
            ),
            rgba(15, 23, 42, 0.98);
          border-color: rgba(251, 146, 60, 1);
        }

        .moe-token-description {
          margin: 4px 0 8px;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .moe-route-button {
          width: 100%;
          margin-top: 4px;
          padding: 7px 10px;
          border-radius: 999px;
          border: none;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          background: linear-gradient(
            90deg,
            #fb923c,
            #facc15
          );
          color: #111827;
          box-shadow: 0 10px 25px rgba(248, 250, 252, 0.3);
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            filter 0.1s ease;
        }

        .moe-route-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
          box-shadow: 0 16px 35px rgba(15, 23, 42, 0.8);
        }

        .moe-route-button:active {
          transform: translateY(0);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.8);
        }

        .moe-myth-card {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px dashed rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.85);
        }

        .moe-myth-title {
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .moe-myth-body {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0 0 8px;
        }

        .moe-myth-diagram {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .moe-myth-row {
          display: grid;
          grid-template-columns: 84px minmax(0, 1fr);
          gap: 6px;
          align-items: center;
        }

        .moe-myth-row-label {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .moe-myth-shared-bar {
          position: relative;
          border-radius: 999px;
          height: 14px;
          background: linear-gradient(
            90deg,
            rgba(56, 189, 248, 0.25),
            rgba(129, 140, 248, 0.6)
          );
        }

        .moe-myth-shared-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          color: #f9fafb;
          text-shadow: 0 1px 2px rgba(15, 23, 42, 0.8);
        }

        .moe-myth-expert-strip {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 2px;
        }

        .moe-myth-expert-chunk {
          height: 12px;
          border-radius: 4px;
          opacity: 0.9;
        }

        .moe-myth-footnote {
          margin: 4px 0 0;
          font-size: 0.72rem;
          color: #9ca3af;
        }

        .moe-scene {
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(31, 41, 55, 0.9);
          background: radial-gradient(
              circle at top left,
              rgba(148, 163, 184, 0.15),
              transparent 55%
            ),
            radial-gradient(
              circle at bottom right,
              rgba(56, 189, 248, 0.12),
              transparent 55%
            ),
            #020617;
          padding: 14px 14px 16px;
          overflow: hidden;
        }

        .moe-token-bubble {
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: radial-gradient(
            circle at 30% 20%,
            #fef9c3,
            #fb923c
          );
          box-shadow: 0 0 18px rgba(251, 146, 60, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: #111827;
          font-weight: 600;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .moe-pipeline {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr 1.4fr;
          gap: 16px;
          align-items: stretch;
        }

        .moe-column {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .moe-column-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
        }

        .moe-column-caption {
          font-size: 0.75rem;
          color: #6b7280;
          margin: 0;
        }

        .moe-tokens-column {
          align-items: flex-start;
        }

        .moe-token-stack {
          display: inline-flex;
          flex-direction: column;
          gap: 4px;
        }

        .moe-token-stack .moe-token-pill {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.6);
        }

        .moe-token-ellipsis {
          font-size: 0.75rem;
          color: #9ca3af;
          padding-left: 2px;
        }

        .moe-router-card {
          border-radius: 12px;
          padding: 10px 10px 8px;
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(55, 65, 81, 1);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.7);
        }

        .moe-router-title {
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .moe-router-caption {
          margin: 0 0 6px;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .moe-router-bars {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .moe-router-bar-row {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) 52px;
          gap: 6px;
          align-items: center;
          font-size: 0.75rem;
        }

        .moe-router-bar-row.top .moe-router-bar-track {
          box-shadow: 0 0 0 1px rgba(248, 250, 252, 0.22);
        }

        .moe-router-bar-label {
          color: #9ca3af;
          font-variant-numeric: tabular-nums;
        }

        .moe-router-bar-track {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: rgba(31, 41, 55, 0.95);
          overflow: hidden;
        }

        .moe-router-bar-fill {
          position: absolute;
          inset: 0;
          transform-origin: left center;
          transform: scaleX(0.15);
          border-radius: 999px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
        }

        .moe-router-bar-value {
          text-align: right;
          font-variant-numeric: tabular-nums;
          color: #e5e7eb;
        }

        .moe-experts-column {
          align-items: stretch;
        }

        .moe-expert-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .moe-expert-box {
          border-radius: 10px;
          border: 1px solid rgba(55, 65, 81, 1);
          padding: 6px 6px 7px;
          background: rgba(15, 23, 42, 0.98);
          transition: box-shadow 0.16s ease, transform 0.16s ease,
            border-color 0.16s ease;
          position: relative;
        }

        .moe-expert-box::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          border: 0 solid transparent;
          opacity: 0;
          pointer-events: none;
        }

        .moe-expert-box.active {
          box-shadow: 0 0 22px rgba(251, 146, 60, 0.9);
          transform: translateY(-1px);
        }

        .moe-expert-box.active::before {
          border-width: 1px;
          border-image: linear-gradient(
              135deg,
              rgba(251, 146, 60, 0.1),
              rgba(56, 189, 248, 0.5)
            )
            1;
          opacity: 1;
        }

        .moe-expert-box.hot:not(.active) {
          box-shadow: 0 0 18px rgba(220, 38, 38, 0.9);
        }

        .moe-expert-header {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 4px;
        }

        .moe-expert-dot {
          width: 8px;
          height: 8px;
          border-radius: 999px;
          box-shadow: 0 0 10px rgba(15, 23, 42, 0.9);
        }

        .moe-expert-id {
          font-size: 0.76rem;
          font-variant-numeric: tabular-nums;
        }

        .moe-expert-body {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .moe-expert-chip {
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 0.68rem;
          background: rgba(31, 41, 55, 1);
          color: #d1d5db;
        }

        .active-chip {
          background: rgba(251, 146, 60, 0.15);
          color: #fed7aa;
          border: 1px solid rgba(251, 146, 60, 0.7);
        }

        .hot-chip {
          background: rgba(220, 38, 38, 0.15);
          color: #fecaca;
          border: 1px solid rgba(220, 38, 38, 0.7);
        }

        .moe-load-section {
          border-radius: 12px;
          border: 1px solid rgba(31, 41, 55, 1);
          padding: 10px 12px 12px;
          background: radial-gradient(
              circle at top left,
              rgba(251, 146, 60, 0.16),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.98);
        }

        .moe-load-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.8rem;
          margin-bottom: 8px;
        }

        .moe-load-title {
          font-weight: 600;
        }

        .moe-load-subtitle {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .moe-load-chart {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 6px;
          align-items: flex-end;
          margin-bottom: 4px;
        }

        .moe-load-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          font-size: 0.7rem;
        }

        .moe-load-bar-track {
          width: 100%;
          height: 60px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 1);
          border: 1px solid rgba(31, 41, 55, 1);
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .moe-load-bar-fill {
          width: 70%;
          border-radius: 999px;
          transform-origin: bottom center;
          transform: scaleY(0.1);
          box-shadow: 0 0 10px rgba(15, 23, 42, 0.9);
        }

        .moe-load-bar-fill.hot {
          box-shadow: 0 0 16px rgba(220, 38, 38, 0.9);
        }

        .moe-load-bar-label {
          color: #9ca3af;
        }

        .moe-load-bar-count {
          font-variant-numeric: tabular-nums;
        }

        .moe-load-caption {
          margin: 0;
          font-size: 0.72rem;
          color: #9ca3af;
        }

        @media (max-width: 900px) {
          .moe-main {
            flex-direction: column;
          }
          .moe-left-panel {
            flex: 1;
          }
          .moe-right-panel {
            flex: 1;
          }
          .moe-pipeline {
            grid-template-columns: 0.9fr 1fr;
            grid-template-rows: auto auto;
            grid-template-areas:
              'tokens router'
              'experts experts';
          }
          .moe-tokens-column {
            grid-area: tokens;
          }
          .moe-router-column {
            grid-area: router;
          }
          .moe-experts-column {
            grid-area: experts;
          }
        }

        @media (max-width: 640px) {
          .moe-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .moe-compute-pill {
            align-items: flex-start;
          }
        }
      `}</style>
    </section>
  );
}

export default MoERoutingDemo;
