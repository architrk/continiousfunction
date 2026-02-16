'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { scaleLinear, line as d3Line, curveMonotoneX } from 'd3';

type Regime = 'low' | 'edge' | 'high';

// ─────────────────────────────────────────────────────────────────────────────
// Gamification Types and Data
// ─────────────────────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'countdown' | 'revealed';
type RegimePrediction = Regime | null;

interface StabilityChallenge {
  name: string
  description: string
  learningRate: number
  answer: Regime
}

const STABILITY_CHALLENGES: StabilityChallenge[] = [
  {
    name: '🎲 η = 0.05',
    description: 'Very small learning rate',
    learningRate: 0.05,
    answer: 'low',
  },
  {
    name: '🎲 η = 0.25',
    description: 'Moderate learning rate',
    learningRate: 0.25,
    answer: 'edge',
  },
  {
    name: '🎲 η = 0.15',
    description: 'Between low and edge',
    learningRate: 0.15,
    answer: 'edge',
  },
  {
    name: '🎲 η = 0.6',
    description: 'Large learning rate',
    learningRate: 0.6,
    answer: 'high',
  },
  {
    name: '🎲 η = 0.35',
    description: 'Upper edge regime',
    learningRate: 0.35,
    answer: 'edge',
  },
];

function getStabilityFeedback(
  predicted: RegimePrediction,
  challenge: StabilityChallenge
): string {
  const correct = predicted === challenge.answer;
  const eta = challenge.learningRate;
  const threshold = 2 / eta;

  const regimeExplanations: Record<Regime, string> = {
    low: `At η=${eta}, the stability threshold 2/η=${threshold.toFixed(1)} is high. λ_max rises slowly but stays well below this threshold, giving monotone convergence without oscillations.`,
    edge: `At η=${eta}, the threshold 2/η=${threshold.toFixed(1)} is moderate. Training drives λ_max right up to this boundary—the "edge of stability"—causing oscillations that don't diverge because sharpness self-regulates.`,
    high: `At η=${eta}, the threshold 2/η=${threshold.toFixed(1)} is low. λ_max quickly exceeds this, violating the stability condition η < 2/λ_max. Oscillations grow until hitting the "valley walls" and training diverges.`,
  };

  if (correct) {
    return `✓ Correct! ${regimeExplanations[challenge.answer]} This is the ${challenge.answer.toUpperCase()} regime.`;
  }

  return `✗ Not quite. The actual regime is ${challenge.answer.toUpperCase()}. ${regimeExplanations[challenge.answer]} The key insight: the boundary between edge and divergence depends on whether λ_max can self-regulate near 2/η.`;
}

interface SimPoint {
  step: number;
  x: number;          // position in the 2D valley (horizontal)
  y: number;          // (kept on valley floor here)
  w: number;          // 1D coordinate along the valley
  sharpness: number;  // λ_max at this step
  threshold: number;  // 2 / η
  loss: number;
  regime: Regime;
  diverged: boolean;
}

const STEPS = 240;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Toy simulation of edge-of-stability dynamics.
 *
 * - Low η: λ_max rises but stays well below 2/η, w decays monotonically.
 * - Edge: λ_max rises to ~2/η and oscillates around it, w oscillates with slow decay.
 * - High η: λ_max pushes above 2/η, w's oscillations grow and slam into "valley walls".
 */
function simulateEdgeOfStability(eta: number): { points: SimPoint[]; regime: Regime } {
  const threshold = 2 / eta;
  const regime: Regime = eta < 0.08 ? 'low' : eta < 0.4 ? 'edge' : 'high';

  const points: SimPoint[] = [];
  const w0 = regime === 'high' ? 0.6 : 1.2;

  for (let step = 0; step < STEPS; step++) {
    const tNorm = step / (STEPS - 1);

    // --- Sharpness dynamics λ_max(t) ---
    let sharpness: number;
    if (regime === 'low') {
      // Sharpness slowly increases but stays well below the stability threshold
      const minFrac = 0.15;
      const maxFrac = 0.6;
      const frac = minFrac + (maxFrac - minFrac) * (1 - Math.exp(-3 * tNorm));
      sharpness = threshold * frac;
    } else if (regime === 'edge') {
      // Sharpness rises to ~ 2/η and then oscillates slightly around it
      const base = threshold * (1 - Math.exp(-5 * tNorm));
      const osc =
        0.18 * threshold * Math.sin(6 * Math.PI * tNorm) * Math.exp(-2 * tNorm);
      sharpness = base + osc;
      sharpness = clamp(sharpness, 0.05, 1.25 * threshold);
    } else {
      // High η: sharpness grows past the threshold and keeps increasing
      const growth = 0.6 + 1.6 * tNorm;
      sharpness = threshold * growth;
    }

    // --- Toy 1D dynamics along the valley floor (for the orange trajectory) ---
    let w: number;
    let diverged = false;

    if (regime === 'low') {
      // Over-damped, monotone convergence
      const lowNorm = clamp(eta / 0.08, 0, 1);
      const decay = 0.01 + 0.18 * lowNorm;
      w = w0 * Math.exp(-decay * step);
    } else if (regime === 'edge') {
      // Under-damped: long-lived oscillations that slowly decay
      const edgeNorm = clamp((eta - 0.08) / (0.4 - 0.08), 0, 1);
      const decay = 0.008 + 0.03 * edgeNorm;
      const freq = 0.35 + 0.4 * edgeNorm;
      w = w0 * Math.exp(-decay * step) * Math.cos(freq * step);
    } else {
      // High η: oscillations whose envelope grows, then hits the "walls"
      const highNorm = clamp((eta - 0.4) / (1.0 - 0.4), 0, 1);
      const growth = 0.01 + 0.045 * highNorm;
      const freq = 0.4 + 0.25 * highNorm;
      const amp = w0 * Math.exp(growth * step);
      w = amp * Math.cos(freq * step);

      const wall = 2.2;
      if (Math.abs(w) > wall) {
        diverged = true;
        w = wall * Math.sign(w || 1);
      }
    }

    // Embed the 1D coordinate into a 2D valley picture
    const x = clamp((w / 2.5) * 1.8, -2, 2);
    const y = 0;
    const loss = 0.5 * sharpness * w * w;

    points.push({
      step,
      x,
      y,
      w,
      sharpness,
      threshold,
      loss,
      regime,
      diverged,
    });
  }

  return { points, regime };
}

const regimeDescriptions: Record<Regime, string> = {
  low: 'Low η: stable but slow convergence (λₘₐₓ stays well below 2/η).',
  edge: 'Edge of stability: oscillations while λₘₐₓ hovers near 2/η.',
  high: 'High η: instability, sharpness pushes past 2/η and the trajectory hits the valley walls.',
};

export default function EdgeOfStabilityExplorer() {
  const [learningRate, setLearningRate] = useState(0.25);
  const { points, regime } = useMemo(
    () => simulateEdgeOfStability(learningRate),
    [learningRate]
  );

  const [currentStep, setCurrentStep] = useState(0);

  // ─── Gamification State ───
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [selectedChallenge, setSelectedChallenge] = useState<StabilityChallenge | null>(null);
  const [prediction, setPrediction] = useState<RegimePrediction>(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);

  // ─── Game Control Functions ───
  const startChallenge = (challenge: StabilityChallenge) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setFeedback(null);
    setGamePhase('setup');
    setLearningRate(challenge.learningRate);
    setCurrentStep(0);
  };

  const makePrediction = (pred: RegimePrediction) => {
    if (gamePhase !== 'setup' || !selectedChallenge) return;
    setPrediction(pred);
    setCountdown(3);
    setGamePhase('countdown');
  };

  const revealAnswer = () => {
    if (!selectedChallenge || !prediction) return;
    const feedbackText = getStabilityFeedback(prediction, selectedChallenge);
    setFeedback(feedbackText);
    setGamePhase('revealed');
    const correct = prediction === selectedChallenge.answer;
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  };

  // ─── Countdown Effect ───
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown <= 0) {
      revealAnswer();
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revealAnswer is stable callback
  }, [gamePhase, countdown]);

  // Reset animation when η changes
  useEffect(() => {
    setCurrentStep(0);
  }, [learningRate]);

  const totalSteps = points.length;

  // Simple looping animation over the simulated trajectory
  useEffect(() => {
    if (totalSteps <= 0) return;

    const id = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) return prev;
        return prev + 1;
      });
    }, 40);

    return () => window.clearInterval(id);
  }, [totalSteps]);

  const visiblePoints = useMemo(
    () => points.slice(0, Math.min(currentStep + 1, totalSteps)),
    [points, currentStep, totalSteps]
  );

  const current =
    points[Math.min(currentStep, totalSteps - 1)] ?? points[totalSteps - 1];

  const threshold = current.threshold;

  // Dimensions
  const landscapeWidth = 360;
  const landscapeHeight = 260;
  const chartWidth = 360;
  const chartHeight = 260;

  // Scales for the landscape view
  const valleyPadding = 32;
  const valleyX = scaleLinear()
    .domain([-2, 2])
    .range([valleyPadding, landscapeWidth - valleyPadding]);
  const valleyY = scaleLinear()
    .domain([-1.5, 1.5])
    .range([landscapeHeight - valleyPadding, valleyPadding]);
  const valleyCenterY = valleyY(0);

  const valleyLine = d3Line<SimPoint>()
    .x((d) => valleyX(d.x))
    .y(() => valleyCenterY)
    .curve(curveMonotoneX);

  const valleyTrajectoryPath = valleyLine(visiblePoints) ?? undefined;

  // Scales for the sharpness plot
  const chartPadding = { top: 28, right: 20, bottom: 40, left: 56 };
  const xScale = scaleLinear()
    .domain([0, Math.max(totalSteps - 1, 1)])
    .range([chartPadding.left, chartWidth - chartPadding.right]);

  const maxSharpness = Math.max(
    1,
    threshold,
    ...points.map((p) => Math.max(p.sharpness, p.threshold))
  );
  const yScale = scaleLinear()
    .domain([0, maxSharpness * 1.1])
    .range([chartHeight - chartPadding.bottom, chartPadding.top]);

  const sharpnessLine = d3Line<SimPoint>()
    .x((d) => xScale(d.step))
    .y((d) => yScale(d.sharpness))
    .curve(curveMonotoneX);

  const sharpnessPath = sharpnessLine(visiblePoints) ?? undefined;

  const thresholdY = yScale(threshold);
  const currentX = xScale(current.step);
  const currentSharpnessY = yScale(current.sharpness);

  return (
    <section
      className="card interactive-card edge-of-stability-card"
      style={{
        background: '#080c14',
        borderRadius: '16px',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        padding: '1.5rem',
        boxShadow: '0 30px 80px rgba(15, 23, 42, 0.8)',
      }}
    >
      <header className="edge-header" style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#e5e7eb' }}>
          Edge of Stability Explorer
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          Theory: <code style={{ color: '#e5e7eb' }}>η &lt; 2 / λₘₐₓ</code> for stability.
          In deep nets, training drives the Hessian&apos;s largest eigenvalue{' '}
          <code>λₘₐₓ</code> right up to the stability edge <code>2 / η</code>, creating
          controlled instability.
        </p>
      </header>

      <div
        className="edge-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
          gap: '1.25rem',
          alignItems: 'stretch',
        }}
      >
        {/* Loss landscape + trajectory */}
        <div>
          <h3 style={{ fontSize: '0.9rem', color: '#e5e7eb', marginBottom: '0.35rem' }}>
            Loss landscape &amp; parameter trajectory
          </h3>
          <svg
            width={landscapeWidth}
            height={landscapeHeight}
            viewBox={`0 0 ${landscapeWidth} ${landscapeHeight}`}
            role="img"
            aria-label="Loss landscape with optimization trajectory"
            style={{ display: 'block', borderRadius: 12, overflow: 'hidden' }}
          >
            <defs>
              <linearGradient id="loss-teal-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2dd4bf" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0f766e" stopOpacity={0.3} />
              </linearGradient>
              <radialGradient id="valley-shadow" cx="50%" cy="50%" r="65%">
                <stop offset="0%" stopColor="#020617" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#020617" stopOpacity={0.95} />
              </radialGradient>
            </defs>

            {/* Background */}
            <rect
              x={0}
              y={0}
              width={landscapeWidth}
              height={landscapeHeight}
              fill="url(#valley-shadow)"
            />

            {/* Teal contour ellipses (2D view of a 3D valley) */}
            {Array.from({ length: 7 }).map((_, i) => {
              const t = (i + 1) / 7;
              const rx = (landscapeWidth / 2 - valleyPadding) * (0.25 + 0.75 * t);
              const ry = (landscapeHeight / 2 - valleyPadding) * (0.15 + 0.65 * t);
              return (
                <ellipse
                  key={i}
                  cx={valleyX(0)}
                  cy={valleyCenterY + 10}
                  rx={rx}
                  ry={ry}
                  fill="none"
                  stroke="url(#loss-teal-gradient)"
                  strokeWidth={1.2}
                  strokeOpacity={0.18 + t * 0.35}
                />
              );
            })}

            {/* Valley floor */}
            <line
              x1={valleyX(-2)}
              y1={valleyCenterY}
              x2={valleyX(2)}
              y2={valleyCenterY}
              stroke="#14b8a6"
              strokeWidth={2.5}
              strokeOpacity={0.9}
              strokeLinecap="round"
            />

            {/* Trajectory path */}
            {valleyTrajectoryPath && (
              <path
                d={valleyTrajectoryPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))',
                }}
              />
            )}

            {/* Current position */}
            {current && (
              <g>
                <circle
                  cx={valleyX(current.x)}
                  cy={valleyCenterY}
                  r={8}
                  fill="#f59e0b"
                />
                <circle
                  cx={valleyX(current.x)}
                  cy={valleyCenterY}
                  r={14}
                  fill="none"
                  stroke="#f59e0b"
                  strokeOpacity={0.4}
                  strokeWidth={2}
                />
              </g>
            )}

            {/* Wall indicators for the divergent regime */}
            {regime === 'high' && (
              <>
                <rect
                  x={0}
                  y={0}
                  width={valleyX(-1.8)}
                  height={landscapeHeight}
                  fill="rgba(148, 27, 53, 0.18)"
                />
                <rect
                  x={valleyX(1.8)}
                  y={0}
                  width={landscapeWidth - valleyX(1.8)}
                  height={landscapeHeight}
                  fill="rgba(148, 27, 53, 0.18)"
                />
              </>
            )}
          </svg>
        </div>

        {/* Sharpness vs. steps */}
        <div>
          <h3 style={{ fontSize: '0.9rem', color: '#e5e7eb', marginBottom: '0.35rem' }}>
            Sharpness λₘₐₓ vs. training step
          </h3>
          <svg
            width={chartWidth}
            height={chartHeight}
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            role="img"
            aria-label="Sharpness and stability threshold over training"
            style={{ display: 'block', borderRadius: 12, overflow: 'hidden' }}
          >
            {/* Background */}
            <rect
              x={0}
              y={0}
              width={chartWidth}
              height={chartHeight}
              fill="#020617"
            />

            {/* Grid */}
            {Array.from({ length: 5 }).map((_, i) => {
              const y =
                chartPadding.top +
                ((chartHeight - chartPadding.top - chartPadding.bottom) * i) / 4;
              return (
                <line
                  key={`h-${i}`}
                  x1={chartPadding.left}
                  y1={y}
                  x2={chartWidth - chartPadding.right}
                  y2={y}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth={1}
                />
              );
            })}
            {Array.from({ length: 5 }).map((_, i) => {
              const x =
                chartPadding.left +
                ((chartWidth - chartPadding.left - chartPadding.right) * i) / 4;
              return (
                <line
                  key={`v-${i}`}
                  x1={x}
                  y1={chartPadding.top}
                  x2={x}
                  y2={chartHeight - chartPadding.bottom}
                  stroke="rgba(148, 163, 184, 0.12)"
                  strokeWidth={1}
                />
              );
            })}

            {/* Threshold line 2/η */}
            <line
              x1={xScale(0)}
              y1={thresholdY}
              x2={xScale(totalSteps - 1)}
              y2={thresholdY}
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text
              x={xScale(totalSteps - 1)}
              y={thresholdY - 6}
              textAnchor="end"
              fill="#fecaca"
              fontSize={10}
            >
              stability edge 2 / η
            </text>

            {/* Sharpness trajectory */}
            {sharpnessPath && (
              <path
                d={sharpnessPath}
                fill="none"
                stroke="#14b8a6"
                strokeWidth={2.5}
              />
            )}

            {/* Current point marker */}
            <line
              x1={currentX}
              y1={chartPadding.top}
              x2={currentX}
              y2={chartHeight - chartPadding.bottom}
              stroke="rgba(248, 250, 252, 0.35)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle
              cx={currentX}
              cy={currentSharpnessY}
              r={5}
              fill="#f59e0b"
              stroke="#0f172a"
              strokeWidth={1.5}
            />

            {/* Axes */}
            <line
              x1={chartPadding.left}
              y1={chartHeight - chartPadding.bottom}
              x2={chartWidth - chartPadding.right}
              y2={chartHeight - chartPadding.bottom}
              stroke="rgba(148, 163, 184, 0.9)"
              strokeWidth={1.2}
            />
            <line
              x1={chartPadding.left}
              y1={chartPadding.top}
              x2={chartPadding.left}
              y2={chartHeight - chartPadding.bottom}
              stroke="rgba(148, 163, 184, 0.9)"
              strokeWidth={1.2}
            />

            {/* Axis labels */}
            <text
              x={(chartWidth + chartPadding.left - chartPadding.right) / 2}
              y={chartHeight - 8}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={11}
            >
              training step
            </text>
            <text
              x={16}
              y={(chartHeight + chartPadding.top - chartPadding.bottom) / 2}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={11}
              transform={`rotate(-90 16 ${
                (chartHeight + chartPadding.top - chartPadding.bottom) / 2
              })`}
            >
              sharpness λₘₐₓ
            </text>

            {/* Legend */}
            <g transform={`translate(${chartWidth - 150}, ${chartPadding.top + 6})`}>
              <rect width={10} height={10} fill="#14b8a6" rx={2} />
              <text x={16} y={9} fill="#e5e7eb" fontSize={10}>
                λₘₐₓ
              </text>
              <rect x={0} y={18} width={10} height={10} fill="#ef4444" rx={2} />
              <text x={16} y={27} fill="#e5e7eb" fontSize={10}>
                2 / η (stability threshold)
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* Controls + numeric readout */}
      <div
        className="edge-controls"
        style={{
          marginTop: '1.25rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <label
            style={{
              display: 'block',
              fontSize: '0.8rem',
              color: '#e5e7eb',
              marginBottom: '0.35rem',
            }}
          >
            Learning rate η ({learningRate.toFixed(3)})
          </label>
          <input
            type="range"
            min={0.02}
            max={1}
            step={0.01}
            value={learningRate}
            onChange={(e) => setLearningRate(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
          <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.35rem' }}>
            Drag to move between three regimes: slow stable training, edge-of-stability
            oscillations, and divergence.
          </p>
        </div>

        <div
          style={{
            flex: '0 0 220px',
            fontSize: '0.8rem',
            color: '#e5e7eb',
            display: 'grid',
            gap: '0.3rem',
          }}
        >
          <div>
            <span style={{ color: '#9ca3af' }}>Step:</span>{' '}
            {current.step}
          </div>
          <div>
            <span style={{ color: '#9ca3af' }}>λₘₐₓ(current):</span>{' '}
            {current.sharpness.toFixed(2)}
          </div>
          <div>
            <span style={{ color: '#9ca3af' }}>2 / η:</span>{' '}
            {threshold.toFixed(2)}
          </div>
          <div>
            <span style={{ color: '#9ca3af' }}>Regime:</span>{' '}
            <span
              style={{
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background:
                  regime === 'edge'
                    ? 'rgba(14, 165, 233, 0.18)'
                    : regime === 'high'
                    ? 'rgba(248, 113, 113, 0.14)'
                    : 'rgba(34, 197, 94, 0.12)',
              }}
            >
              {regimeDescriptions[regime]}
            </span>
          </div>
        </div>

        <button
          type="button"
          className={gameMode ? '' : 'ghost'}
          onClick={() => {
            setGameMode(!gameMode);
            if (gameMode) {
              setSelectedChallenge(null);
              setGamePhase('setup');
              setFeedback(null);
            }
          }}
          style={{ alignSelf: 'flex-start' }}
        >
          {gameMode ? '🎯 Exit Challenge' : '🎯 Regime Challenge'}
        </button>
      </div>

      {/* ─── Gamification Panel ─── */}
      {gameMode && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(15,23,42,0.9)',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: '#e5e7eb' }}>🎯 Regime Prediction Challenge</h3>
            <span style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>
              Score: {score.correct}/{score.total}
            </span>
          </div>

          {/* Challenge Selection */}
          {gamePhase === 'setup' && !selectedChallenge && (
            <div>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#9ca3af' }}>
                Given a learning rate η, predict whether training will be in the LOW (slow, stable),
                EDGE (oscillating around 2/η), or HIGH (divergent) regime.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {STABILITY_CHALLENGES.map((ch) => (
                  <button
                    key={ch.name}
                    type="button"
                    className="ghost"
                    onClick={() => startChallenge(ch)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Challenge */}
          {selectedChallenge && (
            <div>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500, color: '#e5e7eb' }}>
                Learning rate η = {selectedChallenge.learningRate} → Stability threshold 2/η = {(2 / selectedChallenge.learningRate).toFixed(1)}
              </p>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#9ca3af' }}>
                What regime will this training be in?
              </p>

              {gamePhase === 'setup' && (
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => makePrediction('low')}
                    className={prediction === 'low' ? '' : 'ghost'}
                    style={{ background: prediction === 'low' ? 'rgba(34, 197, 94, 0.3)' : undefined }}
                  >
                    LOW (stable)
                  </button>
                  <button
                    type="button"
                    onClick={() => makePrediction('edge')}
                    className={prediction === 'edge' ? '' : 'ghost'}
                    style={{ background: prediction === 'edge' ? 'rgba(14, 165, 233, 0.3)' : undefined }}
                  >
                    EDGE (oscillating)
                  </button>
                  <button
                    type="button"
                    onClick={() => makePrediction('high')}
                    className={prediction === 'high' ? '' : 'ghost'}
                    style={{ background: prediction === 'high' ? 'rgba(248, 113, 113, 0.3)' : undefined }}
                  >
                    HIGH (divergent)
                  </button>
                </div>
              )}

              {gamePhase === 'countdown' && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    {countdown}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    You predicted: <strong>{prediction?.toUpperCase()}</strong>
                  </p>
                </div>
              )}

              {gamePhase === 'revealed' && feedback && (
                <div>
                  <p style={{
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    background: feedback.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${feedback.startsWith('✓') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}>
                    {feedback}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChallenge(null);
                      setGamePhase('setup');
                      setFeedback(null);
                      setPrediction(null);
                    }}
                    style={{ marginTop: '0.75rem' }}
                  >
                    Try Another Challenge
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
