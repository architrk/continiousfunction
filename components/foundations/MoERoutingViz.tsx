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

// Expert personalities - makes it more game-like!
const EXPERT_PERSONALITIES = [
  { name: 'Scribe', emoji: '📝', specialty: 'natural language' },
  { name: 'Debugger', emoji: '🐛', specialty: 'code patterns' },
  { name: 'Proofsmith', emoji: '📐', specialty: 'math & logic' },
  { name: 'Stylist', emoji: '🎨', specialty: 'formatting' },
  { name: 'Translator', emoji: '🌐', specialty: 'cross-domain' },
  { name: 'Archivist', emoji: '📚', specialty: 'rare tokens' },
  { name: 'Planner', emoji: '🗺️', specialty: 'structure' },
  { name: 'Wildcard', emoji: '🃏', specialty: 'edge cases' },
];

// Why-this-expert insight tags
const getExpertInsight = (tokenType: TokenPresetId, expertIndex: number): string => {
  const insights: Record<TokenPresetId, Record<number, string>> = {
    text: {
      0: 'High word frequency patterns',
      5: 'Common phrase structures',
    },
    code: {
      2: 'Punctuation & operators detected',
      3: 'Syntax patterns matched',
    },
    math: {
      4: 'Numeric density recognized',
      5: 'Mathematical symbols found',
    },
    rare: {
      1: 'Unusual character sequences',
      6: 'Domain-specific patterns',
      7: 'Out-of-distribution detected',
    },
  };
  return insights[tokenType]?.[expertIndex] || '';
};

type TokenPresetId = 'text' | 'code' | 'math' | 'rare';

interface TokenPreset {
  label: string;
  logits: number[];
  description: string;
}

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

// Fun achievements
const ACHIEVEMENTS = [
  { id: 'first_prediction', name: '🔮 First Prediction', description: 'Make your first prediction', threshold: 1 },
  { id: 'streak_3', name: '🔥 Hot Streak', description: 'Get 3 correct in a row', threshold: 3 },
  { id: 'perfect_5', name: '⭐ Expert Reader', description: 'Get 5 predictions right', threshold: 5 },
  { id: 'load_balancer', name: '⚖️ Load Balancer', description: 'Route 10 tokens evenly', threshold: 10 },
] as const;

// Fun feedback messages
const FEEDBACK_MESSAGES = {
  correct: [
    "🎯 Perfect! You're learning the routing patterns!",
    "✨ Nailed it! You predicted both experts correctly!",
    "🧠 Impressive! You understand MoE routing!",
    "🎪 Amazing prediction! You're an expert at experts!",
  ],
  partial: [
    "👍 Close! You got 1 of 2 experts right.",
    "🎯 Almost! One expert matched your prediction.",
    "💡 Partial match! Keep learning the patterns.",
  ],
  wrong: [
    "🤔 Not quite! Try to notice patterns in the router scores.",
    "💭 Missed this one! Watch how different tokens prefer different experts.",
    "🔍 Keep experimenting! Each token type has preferences.",
  ],
};

function MoERoutingDemo() {
  const [currentPresetId, setCurrentPresetId] = useState<TokenPresetId>('text');
  const [expertUsage, setExpertUsage] = useState<number[]>(
    () => new Array(EXPERT_COUNT).fill(0),
  );

  // Gamification state
  const [predictionMode, setPredictionMode] = useState(false);
  const [selectedExperts, setSelectedExperts] = useState<number[]>([]);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [totalPredictions, setTotalPredictions] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [showCelebration, setShowCelebration] = useState(false);

  const probabilities = useMemo(
    () => softmax(TOKEN_PRESETS[currentPresetId].logits),
    [currentPresetId],
  );

  const topKIndices = useMemo(() => {
    const pairs = probabilities.map((score, index) => ({ score, index }));
    pairs.sort((a, b) => b.score - a.score);
    return pairs.slice(0, TOP_K).map((p) => p.index);
  }, [probabilities]);

  // Compute router confidence (inverse of entropy)
  const routerConfidence = useMemo(() => {
    // Shannon entropy
    const entropy = -probabilities.reduce((sum, p) => {
      if (p > 0) return sum + p * Math.log2(p);
      return sum;
    }, 0);
    // Max entropy for 8 experts is log2(8) = 3
    // Confidence is 1 - normalized entropy
    return Math.max(0, 1 - entropy / 3);
  }, [probabilities]);

  const confidenceLabel = routerConfidence > 0.7 ? '🎯 High' : routerConfidence > 0.4 ? '🤔 Medium' : '😵 Low';

  const totalTokens = useMemo(
    () => expertUsage.reduce((sum, c) => sum + c, 0),
    [expertUsage],
  );
  const maxUsage = useMemo(
    () => expertUsage.reduce((max, v) => Math.max(max, v), 0),
    [expertUsage],
  );

  // Check for load balancing achievement
  const isLoadBalanced = useMemo(() => {
    if (totalTokens < 10) return false;
    const min = Math.min(...expertUsage);
    const max = Math.max(...expertUsage);
    return max - min <= 2; // Within 2 of each other
  }, [expertUsage, totalTokens]);

  // Toggle expert selection for prediction
  const toggleExpertPrediction = (index: number) => {
    if (!predictionMode) return;
    setSelectedExperts((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= TOP_K) {
        // Replace oldest selection
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  };

  // Check prediction result
  const checkPrediction = () => {
    const correctCount = selectedExperts.filter((i) => topKIndices.includes(i)).length;
    const isPerfect = correctCount === TOP_K;
    const isPartial = correctCount === 1;

    // Update score and streak
    if (isPerfect) {
      setScore((s) => s + 10 + streak * 2); // Bonus for streak
      setStreak((s) => s + 1);
      setLastFeedback(FEEDBACK_MESSAGES.correct[Math.floor(Math.random() * FEEDBACK_MESSAGES.correct.length)]);
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 2000);
    } else if (isPartial) {
      setScore((s) => s + 3);
      setStreak(0);
      setLastFeedback(FEEDBACK_MESSAGES.partial[Math.floor(Math.random() * FEEDBACK_MESSAGES.partial.length)]);
    } else {
      setStreak(0);
      setLastFeedback(FEEDBACK_MESSAGES.wrong[Math.floor(Math.random() * FEEDBACK_MESSAGES.wrong.length)]);
    }

    setTotalPredictions((t) => t + 1);

    // Check achievements
    const newAchievements: string[] = [];
    if (totalPredictions === 0 && !unlockedAchievements.includes('first_prediction')) {
      newAchievements.push('first_prediction');
    }
    if (isPerfect && streak + 1 >= 3 && !unlockedAchievements.includes('streak_3')) {
      newAchievements.push('streak_3');
    }
    if (score + (isPerfect ? 10 : isPartial ? 3 : 0) >= 50 && !unlockedAchievements.includes('perfect_5')) {
      newAchievements.push('perfect_5');
    }
    if (isLoadBalanced && !unlockedAchievements.includes('load_balancer')) {
      newAchievements.push('load_balancer');
    }

    if (newAchievements.length > 0) {
      setUnlockedAchievements((prev) => [...prev, ...newAchievements]);
    }

    // Clear selection after checking
    setSelectedExperts([]);
  };

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

    // If in prediction mode with selections, check prediction first
    if (predictionMode && selectedExperts.length === TOP_K) {
      checkPrediction();
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
        <div className="moe-header-right">
          {/* Score display */}
          {predictionMode && (
            <div className="moe-score-panel">
              <div className="moe-score-item">
                <span className="moe-score-label">Score</span>
                <span className="moe-score-value">{score}</span>
              </div>
              <div className="moe-score-item">
                <span className="moe-score-label">Streak</span>
                <span className="moe-score-value">{streak > 0 ? `🔥 ${streak}` : '0'}</span>
              </div>
            </div>
          )}
          <div className="moe-compute-pill">
            <span className="moe-compute-label">Active parameters</span>
            <span className="moe-compute-value">
              {TOP_K}/{EXPERT_COUNT} experts = {ACTIVE_PERCENT}% compute
            </span>
          </div>
        </div>
      </header>

      {/* Prediction mode toggle & feedback */}
      <div className="moe-game-bar">
        <button
          type="button"
          onClick={() => {
            setPredictionMode(!predictionMode);
            setSelectedExperts([]);
            setLastFeedback(null);
          }}
          className={`moe-game-toggle ${predictionMode ? 'active' : ''}`}
        >
          {predictionMode ? '🎮 Prediction Mode ON' : '🎯 Enable Prediction Mode'}
        </button>
        {predictionMode && (
          <span className="moe-game-hint">
            Click {TOP_K} experts to predict, then route the token!
            {selectedExperts.length > 0 && ` (${selectedExperts.length}/${TOP_K} selected)`}
          </span>
        )}
        {lastFeedback && (
          <div className={`moe-feedback ${showCelebration ? 'celebrate' : ''}`}>
            {lastFeedback}
          </div>
        )}
      </div>

      {/* Achievements display */}
      {unlockedAchievements.length > 0 && (
        <div className="moe-achievements">
          {ACHIEVEMENTS.filter(a => unlockedAchievements.includes(a.id)).map(a => (
            <div key={a.id} className="moe-achievement-badge" title={a.description}>
              {a.name}
            </div>
          ))}
        </div>
      )}

      {/* Celebration overlay */}
      {showCelebration && (
        <div className="moe-celebration">
          <span className="moe-celebration-emoji">🎉</span>
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
                  const isRare = id === 'rare';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setCurrentPresetId(id)}
                      className={`moe-token-pill ${isActive ? 'active' : ''} ${isRare && isActive ? 'rare' : ''}`}
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
            <div className="moe-confidence-meter">
              <span className="moe-confidence-label">Router confidence:</span>
              <div className="moe-confidence-bar-track">
                <div
                  className="moe-confidence-bar-fill"
                  style={{
                    width: `${routerConfidence * 100}%`,
                    background: routerConfidence > 0.7 ? '#22c55e' : routerConfidence > 0.4 ? '#facc15' : '#ef4444'
                  }}
                />
              </div>
              <span className="moe-confidence-value">{confidenceLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleRouteToken}
              className="moe-route-button"
            >
              Route a sample token
            </button>
          </div>

          <div className="moe-myth-card">
            <div className="moe-myth-title">“8 × 7B ≠ 56B”</div>
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
                    const isPredicted = selectedExperts.includes(i);
                    return (
                      <div
                        key={i}
                        ref={(el) => {
                          expertRefs.current[i] = el;
                        }}
                        onClick={() => toggleExpertPrediction(i)}
                        className={`moe-expert-box ${
                          isActive ? 'active' : ''
                        } ${isOverloaded ? 'hot' : ''} ${isPredicted ? 'predicted' : ''} ${predictionMode ? 'clickable' : ''}`}
                        style={{
                          borderColor: EXPERT_COLORS[i],
                          cursor: predictionMode ? 'pointer' : 'default',
                        }}
                      >
                        <div className="moe-expert-header">
                          <span className="moe-expert-emoji">
                            {EXPERT_PERSONALITIES[i].emoji}
                          </span>
                          <span className="moe-expert-id">
                            {EXPERT_PERSONALITIES[i].name}
                          </span>
                        </div>
                        {isActive && (
                          <div className="moe-expert-insight">
                            {getExpertInsight(currentPresetId, i) || EXPERT_PERSONALITIES[i].specialty}
                          </div>
                        )}
                        <div className="moe-expert-body">
                          <span className="moe-expert-chip">
                            FFN weights
                          </span>
                          {isPredicted && (
                            <span className="moe-expert-chip predicted-chip">
                              predicted
                            </span>
                          )}
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

        .moe-header-right {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .moe-score-panel {
          display: flex;
          gap: 12px;
          padding: 8px 14px;
          background: linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(168, 85, 247, 0.15));
          border-radius: 999px;
          border: 1px solid rgba(251, 146, 60, 0.4);
        }

        .moe-score-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .moe-score-label {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
        }

        .moe-score-value {
          font-size: 1rem;
          font-weight: 700;
          color: #fbbf24;
          font-variant-numeric: tabular-nums;
        }

        .moe-game-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
          margin-bottom: 8px;
        }

        .moe-game-toggle {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid rgba(56, 189, 248, 0.5);
          background: rgba(15, 23, 42, 0.95);
          color: #e5e7eb;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .moe-game-toggle:hover {
          border-color: rgba(56, 189, 248, 0.8);
          background: rgba(56, 189, 248, 0.1);
        }

        .moe-game-toggle.active {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2));
          border-color: rgba(168, 85, 247, 0.7);
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
        }

        .moe-game-hint {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .moe-feedback {
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.3);
          font-size: 0.85rem;
          animation: fadeIn 0.3s ease;
        }

        .moe-feedback.celebrate {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(251, 146, 60, 0.2));
          border-color: rgba(34, 197, 94, 0.6);
          animation: celebrate 0.5s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes celebrate {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05); }
        }

        .moe-achievements {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
          margin-bottom: 8px;
        }

        .moe-achievement-badge {
          padding: 6px 12px;
          border-radius: 999px;
          background: linear-gradient(135deg, rgba(251, 191, 36, 0.2), rgba(251, 146, 60, 0.2));
          border: 1px solid rgba(251, 191, 36, 0.5);
          font-size: 0.8rem;
          color: #fde68a;
          animation: badgeUnlock 0.5s ease;
        }

        @keyframes badgeUnlock {
          0% { opacity: 0; transform: scale(0.5) rotate(-10deg); }
          50% { transform: scale(1.2) rotate(5deg); }
          100% { opacity: 1; transform: scale(1) rotate(0); }
        }

        .moe-celebration {
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 100;
        }

        .moe-celebration-emoji {
          font-size: 4rem;
          animation: celebrationPop 2s ease forwards;
        }

        @keyframes celebrationPop {
          0% { opacity: 0; transform: scale(0) rotate(0deg); }
          20% { opacity: 1; transform: scale(1.5) rotate(15deg); }
          40% { transform: scale(1.2) rotate(-10deg); }
          60% { transform: scale(1.3) rotate(5deg); }
          100% { opacity: 0; transform: scale(2) rotate(0deg) translateY(-50px); }
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

        .moe-token-pill.rare {
          animation: rareShimmer 2s infinite;
          background: linear-gradient(
            135deg,
            rgba(168, 85, 247, 0.3),
            rgba(236, 72, 153, 0.3),
            rgba(251, 146, 60, 0.3)
          );
          border-color: rgba(168, 85, 247, 0.8);
        }

        @keyframes rareShimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }

        .moe-token-description {
          margin: 4px 0 8px;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .moe-confidence-meter {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 0.75rem;
        }

        .moe-confidence-label {
          color: #9ca3af;
          white-space: nowrap;
        }

        .moe-confidence-bar-track {
          flex: 1;
          height: 6px;
          background: rgba(31, 41, 55, 0.9);
          border-radius: 999px;
          overflow: hidden;
        }

        .moe-confidence-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease, background 0.3s ease;
        }

        .moe-confidence-value {
          min-width: 70px;
          text-align: right;
          font-weight: 500;
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

        .moe-expert-box.clickable {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .moe-expert-box.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
        }

        .moe-expert-box.predicted {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
          border-color: #a855f7 !important;
          transform: translateY(-2px);
        }

        .moe-expert-box.predicted::after {
          content: '🎯';
          position: absolute;
          top: -8px;
          right: -8px;
          font-size: 1rem;
        }

        .predicted-chip {
          background: rgba(168, 85, 247, 0.2);
          color: #d8b4fe;
          border: 1px solid rgba(168, 85, 247, 0.6);
        }

        .moe-expert-header {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 4px;
        }

        .moe-expert-emoji {
          font-size: 1rem;
        }

        .moe-expert-id {
          font-size: 0.76rem;
          font-weight: 600;
        }

        .moe-expert-insight {
          font-size: 0.65rem;
          color: #fde68a;
          background: rgba(251, 191, 36, 0.15);
          border-radius: 4px;
          padding: 2px 6px;
          margin-bottom: 4px;
          animation: insightPop 0.3s ease;
        }

        @keyframes insightPop {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
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
