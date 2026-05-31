'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { scaleLinear, line as d3Line, curveMonotoneX } from 'd3';
import { emitDemoState } from '../../lib/demoState';

type Regime = 'low' | 'edge' | 'high';
type PredictionChoice = 'stable' | 'diverge';
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed';
type NotebookRegimePrediction = 'safe' | 'edge' | 'diverge';
type NotebookActualRegime = 'safe' | 'edge' | 'diverge';

type EdgeOfStabilityVizProps = {
  chrome?: 'legacy' | 'notebook';
  conceptId?: string;
};

// Fun learning rate presets
const LEARNING_RATE_PRESETS = [
  { name: '🐢 Safe & Slow', eta: 0.04, description: 'Conservative: stable but slow convergence' },
  { name: '⚖️ Edge of Stability', eta: 0.25, description: 'The sweet spot: oscillations near 2/η' },
  { name: '🔥 Risky Business', eta: 0.5, description: 'Aggressive: dancing with divergence' },
  { name: '💥 Chaos Mode', eta: 0.9, description: 'Too hot: expect explosions!' },
];

// Challenge scenarios for the prediction game
const CHALLENGE_SCENARIOS = [
  { name: '🎲 Mystery η = 0.15', eta: 0.15, description: 'In the gray zone...' },
  { name: '🎲 Mystery η = 0.35', eta: 0.35, description: 'Getting warmer...' },
  { name: '🎲 Mystery η = 0.55', eta: 0.55, description: 'Danger zone?' },
  { name: '🎲 Mystery η = 0.75', eta: 0.75, description: 'Playing with fire...' },
];

// Educational feedback for predictions
const getPredictionFeedback = (
  prediction: PredictionChoice,
  actual: 'stable' | 'edge' | 'diverge',
  eta: number,
  threshold: number
): string => {
  const wasCorrect =
    (prediction === 'stable' && (actual === 'stable' || actual === 'edge')) ||
    (prediction === 'diverge' && actual === 'diverge');

  if (actual === 'stable') {
    if (wasCorrect) {
      return `Correct! At η = ${eta.toFixed(2)}, the stability threshold 2/η = ${threshold.toFixed(1)} is high enough that λₘₐₓ never catches up. Training converges monotonically.`;
    }
    return `Surprise - it's stable! At low η, λₘₐₓ grows slowly and never threatens 2/η = ${threshold.toFixed(1)}. Classical convergence wins here.`;
  }

  if (actual === 'edge') {
    if (wasCorrect) {
      return `Correct! η = ${eta.toFixed(2)} lands right at the "edge of stability". λₘₐₓ rises to meet 2/η = ${threshold.toFixed(1)} and oscillates there. This is where modern deep learning lives!`;
    }
    return `Close! This η = ${eta.toFixed(2)} is at the "edge" - not divergent, but not classically stable either. λₘₐₓ ≈ 2/η creates controlled oscillations that still converge.`;
  }

  // Diverge case
  if (wasCorrect) {
    return `Correct! At η = ${eta.toFixed(2)}, the threshold 2/η = ${threshold.toFixed(1)} is too low. λₘₐₓ blows past it and gradients explode. This is why LR schedules matter!`;
  }
  return `It diverged! η = ${eta.toFixed(2)} pushes λₘₐₓ past the stability boundary 2/η = ${threshold.toFixed(1)}. The quadratic approximation breaks down and chaos ensues.`;
};

// Educational insight based on current dynamics
const getEdgeInsight = (regime: Regime, sharpness: number, threshold: number, step: number): string => {
  const ratio = sharpness / threshold;

  if (regime === 'low') {
    if (step < 50) {
      return '🐢 Conservative η: The Hessian\'s largest eigenvalue λₘₐₓ rises slowly toward 2/η. Convergence is stable but can be slow.';
    }
    return `📊 Safe zone! λₘₐₓ = ${sharpness.toFixed(2)} is only ${(ratio * 100).toFixed(0)}% of the stability threshold. Room to increase η for faster training.`;
  }

  if (regime === 'edge') {
    if (ratio > 0.95 && ratio < 1.05) {
      return '⚡ RIGHT AT THE EDGE! λₘₐₓ ≈ 2/η. The network self-regulates: when sharpness rises too high, oscillations kick in and push it back down.';
    }
    if (ratio > 0.85) {
      return '🎯 Approaching the edge... λₘₐₓ is climbing toward 2/η. This is where deep networks like to operate!';
    }
    return '🌊 Oscillating at the edge of stability. The loss decreases in a zig-zag pattern, not monotonically.';
  }

  // High regime
  if (step < 30) {
    return '🔥 High η detected! λₘₐₓ is rising rapidly toward (and past) the stability threshold 2/η.';
  }
  if (sharpness > threshold) {
    return '💥 UNSTABLE! λₘₐₓ > 2/η means gradients can amplify instead of shrink. Trajectory is bouncing off the "valley walls".';
  }
  return '⚠️ Danger zone! Sharpness keeps growing. Without intervention, this will diverge.';
};

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

export default function EdgeOfStabilityExplorer({
  chrome = 'legacy',
  conceptId = 'loss-landscapes',
}: EdgeOfStabilityVizProps) {
  const isNotebook = chrome === 'notebook';
  const [learningRate, setLearningRate] = useState(0.25);
  const { points, regime } = useMemo(
    () => simulateEdgeOfStability(learningRate),
    [learningRate]
  );

  const [currentStep, setCurrentStep] = useState(0);

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [prediction, setPrediction] = useState<PredictionChoice | null>(null);
  const [lockedPrediction, setLockedPrediction] = useState<PredictionChoice | null>(null);
  const [challengeEta, setChallengeEta] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null);
  const [notebookPrediction, setNotebookPrediction] = useState<NotebookRegimePrediction | null>(null);
  const [notebookRevealed, setNotebookRevealed] = useState(false);
  const [revealedEta, setRevealedEta] = useState<number | null>(null);
  const [notebookPlaying, setNotebookPlaying] = useState(false);

  // Reset animation when η changes
  useEffect(() => {
    setCurrentStep(0);
  }, [learningRate]);

  const totalSteps = points.length;

  // Simple looping animation over the simulated trajectory
  useEffect(() => {
    if (isNotebook) return;
    if (totalSteps <= 0) return;

    const id = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) return prev;
        return prev + 1;
      });
    }, 40);

    return () => window.clearInterval(id);
  }, [isNotebook, totalSteps]);

  useEffect(() => {
    if (!isNotebook) return;
    if (!notebookRevealed || revealedEta !== learningRate || !notebookPlaying || totalSteps <= 0) return;

    const id = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= totalSteps - 1) {
          setNotebookPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 55);

    return () => window.clearInterval(id);
  }, [isNotebook, learningRate, notebookPlaying, notebookRevealed, revealedEta, totalSteps]);

  useEffect(() => {
    if (!isNotebook) return;
    setCurrentStep(0);
    setNotebookRevealed(false);
    setRevealedEta(null);
    setNotebookPlaying(false);
  }, [isNotebook, learningRate]);

  const visiblePoints = useMemo(
    () => points.slice(0, Math.min(currentStep + 1, totalSteps)),
    [points, currentStep, totalSteps]
  );

  const current =
    points[Math.min(currentStep, totalSteps - 1)] ?? points[totalSteps - 1];

  // Determine actual outcome for prediction game
  const actualOutcome: 'stable' | 'edge' | 'diverge' = useMemo(() => {
    if (regime === 'low') return 'stable';
    if (regime === 'edge') return 'edge';
    return 'diverge';
  }, [regime]);

  const predictionCorrect = useMemo(() => {
    if (!lockedPrediction) return false;
    return (lockedPrediction === 'stable' && actualOutcome !== 'diverge') ||
           (lockedPrediction === 'diverge' && actualOutcome === 'diverge');
  }, [lockedPrediction, actualOutcome]);

  const edgeDiagnostics = useMemo(() => {
    const ratios = points.map((point) => point.sharpness / point.threshold);
    const maxRatio = ratios.reduce((max, value) => Math.max(max, value), 0);
    const finalWindow = ratios.slice(Math.max(0, ratios.length - 36));
    const tailMeanRatio = finalWindow.length
      ? finalWindow.reduce((sum, value) => sum + value, 0) / finalWindow.length
      : 0;
    const firstEdgeStep = points.find((point) => point.sharpness / point.threshold >= 0.9)?.step ?? null;
    const firstCrossStep = points.find((point) => point.sharpness / point.threshold >= 1)?.step ?? null;
    const firstDivergedStep = points.find((point) => point.diverged)?.step ?? null;
    const losses = points.map((point) => point.loss);
    const lossIncreases = losses.reduce((count, loss, index) => {
      if (index === 0) return count;
      return count + (loss > losses[index - 1] ? 1 : 0);
    }, 0);
    const lossTrend = firstDivergedStep !== null
      ? 'clipped after divergence'
      : lossIncreases > Math.max(8, losses.length * 0.08)
        ? 'non-monotone bounded'
        : 'decreasing';

    let actualRegime: NotebookActualRegime = 'safe';
    if (firstDivergedStep !== null || (firstCrossStep !== null && regime === 'high')) {
      actualRegime = 'diverge';
    } else if (firstEdgeStep !== null || tailMeanRatio >= 0.78) {
      actualRegime = 'edge';
    }

    return {
      ratios,
      maxRatio,
      tailMeanRatio,
      firstEdgeStep,
      firstCrossStep,
      firstDivergedStep,
      lossTrend,
      actualRegime,
    };
  }, [points, regime]);

  const traceIsRevealed = notebookRevealed && revealedEta === learningRate;

  const notebookPredictionCorrect =
    traceIsRevealed && notebookPrediction !== null
      ? notebookPrediction === edgeDiagnostics.actualRegime
      : null;

  // Apply a challenge scenario
  const applyChallenge = useCallback((scenario: typeof CHALLENGE_SCENARIOS[number]) => {
    setChallengeEta(scenario.eta);
    setActiveChallenge(scenario.name);
    setGamePhase('setup');
    setPrediction(null);
    setLockedPrediction(null);
    setCurrentStep(0);
  }, []);

  // Start the challenge
  const startChallenge = useCallback(() => {
    if (!prediction || challengeEta === null) return;
    setLockedPrediction(prediction);
    setLearningRate(challengeEta);
    setGamePhase('countdown');
    setCountdown(3);
    setCurrentStep(0);
  }, [prediction, challengeEta]);

  // Reset game
  const resetGame = useCallback(() => {
    setGamePhase('setup');
    setPrediction(null);
    setLockedPrediction(null);
    setChallengeEta(null);
    setActiveChallenge(null);
    setLearningRate(0.25);
    setCurrentStep(0);
  }, []);

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 700);
      return () => clearTimeout(timer);
    } else {
      setGamePhase('running');
      setCurrentStep(0);
    }
  }, [gamePhase, countdown]);

  // Auto-reveal when animation finishes during running phase
  useEffect(() => {
    if (gamePhase !== 'running') return;
    if (currentStep >= totalSteps - 1) {
      setGamePhase('revealed');
    }
  }, [gamePhase, currentStep, totalSteps]);

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
  const currentRatio = current.sharpness / current.threshold;

  useEffect(() => {
    if (!isNotebook) return;

    const values = [
      `eta: ${learningRate.toFixed(3)}`,
      `threshold 2/eta: ${threshold.toFixed(2)}`,
      `prediction: ${notebookPrediction ?? 'none'}`,
      `revealed: ${traceIsRevealed ? 'yes' : 'no'}`,
      'caveat: toy sharpness trace, not a measured neural-network Hessian',
    ];

    if (traceIsRevealed) {
      values.push(
        `actual regime: ${edgeDiagnostics.actualRegime}`,
        `current step: ${current.step}`,
        `current lambda_max: ${current.sharpness.toFixed(2)}`,
        `current ratio: ${currentRatio.toFixed(2)}`,
        `max ratio: ${edgeDiagnostics.maxRatio.toFixed(2)}`,
        `tail mean ratio: ${edgeDiagnostics.tailMeanRatio.toFixed(2)}`,
        `first edge step: ${edgeDiagnostics.firstEdgeStep ?? 'none'}`,
        `first crossing step: ${edgeDiagnostics.firstCrossStep ?? 'none'}`,
        `first divergence step: ${edgeDiagnostics.firstDivergedStep ?? 'none'}`,
        `loss trend: ${edgeDiagnostics.lossTrend}`,
        `prediction correct: ${notebookPredictionCorrect === null ? 'not checked' : notebookPredictionCorrect ? 'yes' : 'no'}`,
      );
    }

    emitDemoState({
      conceptId,
      label: 'Edge-of-stability toy trace',
      summary: traceIsRevealed
        ? `Toy trace result: ${edgeDiagnostics.actualRegime} regime with ${edgeDiagnostics.lossTrend} loss trend.`
        : 'Predict whether the toy sharpness trace will stay safe, hover near the edge, or diverge.',
      values,
    });
  }, [
    conceptId,
    current.sharpness,
    current.step,
    currentRatio,
    edgeDiagnostics.actualRegime,
    edgeDiagnostics.firstCrossStep,
    edgeDiagnostics.firstDivergedStep,
    edgeDiagnostics.firstEdgeStep,
    edgeDiagnostics.lossTrend,
    edgeDiagnostics.maxRatio,
    edgeDiagnostics.tailMeanRatio,
    isNotebook,
    learningRate,
    notebookPrediction,
    notebookPredictionCorrect,
    notebookRevealed,
    traceIsRevealed,
    threshold,
  ]);

  if (isNotebook) {
    const notebookVisiblePoints = traceIsRevealed ? visiblePoints : [];
    const notebookValleyLine = d3Line<SimPoint>()
      .x((d) => valleyX(d.x))
      .y(() => valleyCenterY);
    const notebookYScale = traceIsRevealed
      ? yScale
      : scaleLinear()
          .domain([0, Math.max(1, threshold * 2.4)])
          .range([chartHeight - chartPadding.bottom, chartPadding.top]);
    const notebookSharpnessLine = d3Line<SimPoint>()
      .x((d) => xScale(d.step))
      .y((d) => notebookYScale(d.sharpness));
    const notebookValleyPath = notebookVisiblePoints.length > 1
      ? notebookValleyLine(notebookVisiblePoints) ?? undefined
      : undefined;
    const notebookSharpnessPath = notebookVisiblePoints.length > 1
      ? notebookSharpnessLine(notebookVisiblePoints) ?? undefined
      : undefined;
    const notebookThresholdY = notebookYScale(threshold);
    const notebookCurrentSharpnessY = notebookYScale(current.sharpness);
    const actualLabel = edgeDiagnostics.actualRegime === 'safe'
      ? 'safe'
      : edgeDiagnostics.actualRegime === 'edge'
        ? 'edge'
        : 'divergent';

    return (
      <>
        <section
          className="edge-of-stability-demo notebook"
          style={{
            background: 'transparent',
            border: 0,
            boxShadow: 'none',
            color: '#e5e7eb',
            padding: 0,
          }}
        >
          <div className="edge-prediction-panel">
            <h3>Prediction check: compare sharpness with the learning-rate line</h3>
            <p>
              Choose a learning rate, then predict whether this toy sharpness
              trace stays safely below the local quadratic GD edge, hovers near
              it, or diverges after crossing.
            </p>

            <label className="edge-slider">
              Learning rate eta ({learningRate.toFixed(3)})
              <input
                type="range"
                min={0.03}
                max={0.9}
                step={0.01}
                value={learningRate}
                onChange={(event) => {
                  setLearningRate(parseFloat(event.target.value));
                  setNotebookRevealed(false);
                  setRevealedEta(null);
                  setNotebookPlaying(false);
                  setCurrentStep(0);
                }}
              />
            </label>

            <div className="edge-threshold-readout">
              <span>Local quadratic GD edge</span>
              <strong>2 / eta = {threshold.toFixed(2)}</strong>
            </div>

            <div className="edge-choice-grid">
              {([
                ['safe', 'Safe', 'lambda_max stays well below 2/eta'],
                ['edge', 'Edge', 'hovers near the line with bounded oscillations'],
                ['diverge', 'Diverge', 'crosses and hits the clipping wall'],
              ] as const).map(([choice, label, detail]) => (
                <button
                  key={choice}
                  type="button"
                  aria-pressed={notebookPrediction === choice}
                  onClick={() => {
                    setNotebookPrediction(choice);
                    setNotebookRevealed(false);
                    setRevealedEta(null);
                    setNotebookPlaying(false);
                    setCurrentStep(0);
                  }}
                >
                  <span>{label}</span>
                  <small>{detail}</small>
                </button>
              ))}
            </div>

            <div className="edge-actions">
              <button
                type="button"
                disabled={!notebookPrediction}
                onClick={() => {
                  setNotebookRevealed(true);
                  setRevealedEta(learningRate);
                  setNotebookPlaying(true);
                  setCurrentStep(0);
                }}
              >
                Reveal trace
              </button>
              <button
                type="button"
                className="ghost"
                disabled={!traceIsRevealed}
                onClick={() => {
                  setNotebookPlaying((playing) => !playing);
                }}
              >
                {notebookPlaying ? 'Pause trace' : 'Play trace'}
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setNotebookPrediction(null);
                  setNotebookRevealed(false);
                  setRevealedEta(null);
                  setNotebookPlaying(false);
                  setCurrentStep(0);
                }}
              >
                Reset
              </button>
            </div>

            {traceIsRevealed ? (
              <p
                className={`edge-result ${
                  notebookPredictionCorrect
                    ? 'correct'
                    : edgeDiagnostics.actualRegime === 'diverge'
                      ? 'diverge'
                      : 'neutral'
                }`}
                role="status"
                aria-live="polite"
              >
                {notebookPredictionCorrect ? 'Correct: ' : 'Result: '}
                the revealed regime is <strong>{actualLabel}</strong>. Max ratio
                lambda_max / (2 / eta) reaches {edgeDiagnostics.maxRatio.toFixed(2)};
                loss trend is {edgeDiagnostics.lossTrend}.
              </p>
            ) : (
              <p className="edge-pre-reveal">
                Before reveal, only eta and the threshold are shown. The trace,
                regime, and ratio diagnostics stay hidden.
              </p>
            )}
          </div>

          <div className="edge-notebook-layout">
            <div className="edge-panel">
              <h3>Loss trajectory in the toy valley</h3>
              <svg
                width={landscapeWidth}
                height={landscapeHeight}
                viewBox={`0 0 ${landscapeWidth} ${landscapeHeight}`}
                role="img"
                aria-label="Toy loss-valley trajectory for the selected learning rate"
                className="edge-chart"
              >
                <rect width={landscapeWidth} height={landscapeHeight} fill="#020617" />
                {Array.from({ length: 7 }).map((_, index) => {
                  const t = (index + 1) / 7;
                  const rx = (landscapeWidth / 2 - valleyPadding) * (0.25 + 0.75 * t);
                  const ry = (landscapeHeight / 2 - valleyPadding) * (0.15 + 0.65 * t);
                  return (
                    <ellipse
                      key={index}
                      cx={valleyX(0)}
                      cy={valleyCenterY + 10}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke="#14b8a6"
                      strokeWidth={1.2}
                      strokeOpacity={0.18 + t * 0.32}
                    />
                  );
                })}
                <line
                  x1={valleyX(-2)}
                  y1={valleyCenterY}
                  x2={valleyX(2)}
                  y2={valleyCenterY}
                  stroke="#14b8a6"
                  strokeWidth={2.4}
                  strokeLinecap="round"
                />
                {traceIsRevealed && edgeDiagnostics.firstDivergedStep !== null ? (
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
                ) : null}
                {notebookValleyPath ? (
                  <path
                    d={notebookValleyPath}
                    fill="none"
                    stroke="#f59e0b"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {traceIsRevealed ? (
                  <g>
                    <circle cx={valleyX(current.x)} cy={valleyCenterY} r={8} fill="#f59e0b" />
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
                ) : null}
              </svg>
              <p className="edge-caption">
                This valley is a toy scalar path. Divergent traces are clipped at
                the wall and labeled that way after reveal.
              </p>
            </div>

            <div className="edge-panel">
              <h3>Sharpness versus local quadratic GD edge</h3>
              <svg
                width={chartWidth}
                height={chartHeight}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                role="img"
                aria-label="Toy sharpness trace compared with the local quadratic gradient-descent edge"
                className="edge-chart"
              >
                <rect width={chartWidth} height={chartHeight} fill="#020617" />
                {Array.from({ length: 5 }).map((_, index) => {
                  const y =
                    chartPadding.top +
                    ((chartHeight - chartPadding.top - chartPadding.bottom) * index) / 4;
                  return (
                    <line
                      key={`h-${index}`}
                      x1={chartPadding.left}
                      y1={y}
                      x2={chartWidth - chartPadding.right}
                      y2={y}
                      stroke="rgba(148, 163, 184, 0.15)"
                      strokeWidth={1}
                    />
                  );
                })}
                <line
                  x1={xScale(0)}
                  y1={notebookThresholdY}
                  x2={xScale(totalSteps - 1)}
                  y2={notebookThresholdY}
                  stroke="#ef4444"
                  strokeWidth={1.7}
                  strokeDasharray="6 4"
                />
                <text
                  x={xScale(totalSteps - 1)}
                  y={notebookThresholdY - 6}
                  textAnchor="end"
                  fill="#fecaca"
                  fontSize={10}
                >
                  local edge 2 / eta
                </text>
                {notebookSharpnessPath ? (
                  <path
                    d={notebookSharpnessPath}
                    fill="none"
                    stroke="#14b8a6"
                    strokeWidth={2.5}
                  />
                ) : null}
                {traceIsRevealed ? (
                  <>
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
                      cy={notebookCurrentSharpnessY}
                      r={5}
                      fill="#f59e0b"
                      stroke="#0f172a"
                      strokeWidth={1.5}
                    />
                  </>
                ) : null}
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
              </svg>
              <p className="edge-caption">
                The red line is the one-step quadratic GD reference. The teal
                curve is generated by the toy, not measured from a neural network.
              </p>
            </div>
          </div>

          <div className="edge-readout">
            <div>
              <span>eta</span>
              <strong>{learningRate.toFixed(3)}</strong>
            </div>
            <div>
              <span>2 / eta</span>
              <strong>{threshold.toFixed(2)}</strong>
            </div>
            {traceIsRevealed ? (
              <>
                <div>
                  <span>lambda ratio</span>
                  <strong>{currentRatio.toFixed(2)}</strong>
                </div>
                <div>
                  <span>max ratio</span>
                  <strong>{edgeDiagnostics.maxRatio.toFixed(2)}</strong>
                </div>
                <div>
                  <span>loss trend</span>
                  <strong>{edgeDiagnostics.lossTrend}</strong>
                </div>
              </>
            ) : null}
          </div>
        </section>

        <style jsx>{`
          .edge-prediction-panel,
          .edge-panel,
          .edge-readout {
            background: rgba(15, 23, 42, 0.72);
            border: 1px solid rgba(148, 163, 184, 0.18);
            border-radius: 12px;
            padding: 0.95rem;
          }

          .edge-prediction-panel {
            background: linear-gradient(135deg, rgba(14, 165, 233, 0.14), rgba(245, 158, 11, 0.07));
            border-color: rgba(14, 165, 233, 0.34);
            margin-bottom: 1rem;
          }

          .edge-prediction-panel h3,
          .edge-panel h3 {
            color: #f8fafc;
            font-size: 1rem;
            line-height: 1.35;
            margin: 0 0 0.55rem;
          }

          .edge-prediction-panel p,
          .edge-caption,
          .edge-pre-reveal {
            color: #cbd5e1;
            font-size: 0.84rem;
            line-height: 1.55;
            margin: 0.6rem 0 0;
          }

          .edge-slider {
            color: #dbeafe;
            display: grid;
            font-size: 0.84rem;
            gap: 0.45rem;
            margin: 0.85rem 0;
          }

          .edge-slider input {
            width: 100%;
          }

          .edge-threshold-readout {
            align-items: center;
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 10px;
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
            justify-content: space-between;
            padding: 0.65rem 0.75rem;
          }

          .edge-threshold-readout span,
          .edge-readout span {
            color: #94a3b8;
            font-size: 0.78rem;
          }

          .edge-choice-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.55rem;
            margin: 0.85rem 0;
          }

          .edge-choice-grid button,
          .edge-actions button {
            appearance: none;
            background: rgba(15, 23, 42, 0.76);
            border: 1px solid rgba(148, 163, 184, 0.32);
            border-radius: 9px;
            color: #e5e7eb;
            cursor: pointer;
            font-weight: 650;
            padding: 0.58rem 0.7rem;
          }

          .edge-choice-grid button {
            min-height: 78px;
            text-align: left;
          }

          .edge-choice-grid button span,
          .edge-choice-grid button small {
            display: block;
          }

          .edge-choice-grid button small {
            color: #94a3b8;
            font-size: 0.74rem;
            font-weight: 500;
            margin-top: 0.3rem;
          }

          .edge-choice-grid button[aria-pressed='true'] {
            background: rgba(14, 165, 233, 0.2);
            border-color: rgba(14, 165, 233, 0.8);
            color: #dbeafe;
          }

          .edge-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.55rem;
          }

          .edge-actions button:disabled {
            cursor: not-allowed;
            opacity: 0.55;
          }

          .edge-actions .ghost {
            background: rgba(30, 41, 59, 0.82);
          }

          .edge-result {
            background: rgba(51, 65, 85, 0.45);
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 10px;
            color: #f8fafc;
            margin-top: 0.75rem !important;
            padding: 0.7rem 0.75rem;
          }

          .edge-result.correct {
            background: rgba(34, 197, 94, 0.1);
            border-color: rgba(34, 197, 94, 0.34);
          }

          .edge-result.diverge {
            background: rgba(244, 63, 94, 0.1);
            border-color: rgba(244, 63, 94, 0.34);
          }

          .edge-result.neutral {
            background: rgba(245, 158, 11, 0.1);
            border-color: rgba(245, 158, 11, 0.32);
          }

          .edge-notebook-layout {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 1rem;
          }

          .edge-chart {
            background: #020617;
            border: 1px solid rgba(148, 163, 184, 0.16);
            border-radius: 12px;
            display: block;
            height: auto;
            max-width: 100%;
          }

          .edge-readout {
            display: grid;
            gap: 0.6rem;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            margin-top: 1rem;
          }

          .edge-readout div {
            display: grid;
            gap: 0.2rem;
          }

          .edge-readout strong {
            color: #f8fafc;
            font-size: 0.9rem;
          }

          .edge-of-stability-demo button:focus-visible,
          .edge-of-stability-demo input:focus-visible {
            box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.35);
            outline: 2px solid #f8fafc;
            outline-offset: 2px;
          }

          @media (max-width: 860px) {
            .edge-notebook-layout,
            .edge-choice-grid,
            .edge-readout {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </>
    );
  }

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
          🎯 Edge of Stability Challenge
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginTop: '0.25rem' }}>
          Will training CONVERGE or DIVERGE? The boundary is <code style={{ color: '#e5e7eb' }}>η &lt; 2 / λₘₐₓ</code>.
          Test your intuition about where the edge lies!
        </p>
      </header>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(239, 68, 68, 0.05))',
        border: '1px solid rgba(14, 165, 233, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        {/* Challenge selection */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '8px' }}>
            Pick a mystery learning rate:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CHALLENGE_SCENARIOS.map(scenario => (
              <button
                key={scenario.name}
                onClick={() => applyChallenge(scenario)}
                disabled={gamePhase === 'running' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge === scenario.name
                    ? 'rgba(14, 165, 233, 0.3)'
                    : 'rgba(14, 165, 233, 0.1)',
                  border: `1px solid ${activeChallenge === scenario.name ? '#0ea5e9' : 'rgba(14, 165, 233, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'running' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'running' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={scenario.description}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && challengeEta !== null && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Learning rate η = {challengeEta.toFixed(2)} → Stability threshold 2/η = {(2/challengeEta).toFixed(1)}
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>Will training stay STABLE or DIVERGE?</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPrediction('stable')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'stable' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'stable' ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: '1rem',
                  fontWeight: prediction === 'stable' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                ✅ STABLE (converges)
              </button>
              <button
                onClick={() => setPrediction('diverge')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'diverge' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'diverge' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: '1rem',
                  fontWeight: prediction === 'diverge' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                💥 DIVERGE (explodes)
              </button>
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                  : 'rgba(14, 165, 233, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              🚀 Run Simulation!
            </button>
          </div>
        )}

        {/* No challenge selected */}
        {gamePhase === 'setup' && !activeChallenge && (
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>
            👆 Select a mystery learning rate above to begin the challenge!
          </p>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#0ea5e9',
              textShadow: '0 0 30px rgba(14, 165, 233, 0.5)',
            }}>
              {countdown === 0 ? 'WATCH!' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
              Your prediction: <strong style={{ color: lockedPrediction === 'stable' ? '#22c55e' : '#ef4444' }}>
                {lockedPrediction === 'stable' ? '✅ STABLE' : '💥 DIVERGE'}
              </strong>
            </p>
          </div>
        )}

        {/* Running phase */}
        {gamePhase === 'running' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: '#e5e7eb', marginBottom: '8px' }}>
              ⚡ Simulating... Step {currentStep}/{totalSteps - 1}
            </p>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: lockedPrediction === 'stable' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
            }}>
              Your pick: <strong>{lockedPrediction === 'stable' ? '✅ STABLE' : '💥 DIVERGE'}</strong>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
              λₘₐₓ = {current.sharpness.toFixed(2)} | threshold = {current.threshold.toFixed(1)}
            </div>
          </div>
        )}

        {/* Revealed phase */}
        {gamePhase === 'revealed' && (
          <div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: predictionCorrect
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                {predictionCorrect ? '🎉' : '🤔'}
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: predictionCorrect ? '#22c55e' : '#ef4444',
                marginBottom: '8px',
              }}>
                {predictionCorrect ? 'Correct!' : 'Not quite!'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                Result: <strong style={{
                  color: actualOutcome === 'diverge' ? '#ef4444' : actualOutcome === 'edge' ? '#0ea5e9' : '#22c55e'
                }}>
                  {actualOutcome === 'stable' ? '✅ STABLE' : actualOutcome === 'edge' ? '⚖️ EDGE OF STABILITY' : '💥 DIVERGED'}
                </strong>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#9ca3af',
            }}>
              💡 {getPredictionFeedback(lockedPrediction!, actualOutcome, learningRate, 2/learningRate)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(14, 165, 233, 0.2)',
                border: '1px solid rgba(14, 165, 233, 0.4)',
                borderRadius: '8px',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Another Challenge
            </button>
          </div>
        )}
      </div>

      <details style={{ marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#9ca3af' }}>
          📚 Manual exploration mode
        </summary>
        <div style={{ paddingTop: '12px' }}>

      {/* Learning Rate Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {LEARNING_RATE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setLearningRate(preset.eta)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: Math.abs(learningRate - preset.eta) < 0.05 ? '2px solid #f59e0b' : '1px solid #374151',
              background: Math.abs(learningRate - preset.eta) < 0.05
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: Math.abs(learningRate - preset.eta) < 0.05 ? '#f59e0b' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: Math.abs(learningRate - preset.eta) < 0.05 ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Educational Insight */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: regime === 'low'
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))'
          : regime === 'edge'
            ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(14, 165, 233, 0.04))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
        border: `1px solid ${regime === 'low' ? '#22c55e' : regime === 'edge' ? '#0ea5e9' : '#ef4444'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getEdgeInsight(regime, current.sharpness, threshold, current.step)}
      </div>

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
      </div>
        </div>
      </details>
    </section>
  );
}
