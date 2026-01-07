import { useEffect, useMemo, useState, useCallback } from 'react'

// === Gamification Types ===
type GamePhase = 'setup' | 'countdown' | 'revealed'
type PhasePrediction = 'fitting' | 'compressing' | 'overfitting' | 'optimal' | null

interface PhaseChallenge {
  name: string
  beta: number
  epoch: number
  answer: PhasePrediction
  description: string
  explanation: string
}

const PHASE_CHALLENGES: PhaseChallenge[] = [
  {
    name: '🎲 Early + Low β',
    beta: 0.3,
    epoch: 15,
    answer: 'overfitting',
    description: 'β = 0.3, epoch = 15. The network is early in training with minimal compression pressure.',
    explanation: 'Low β (0.3) + early training = overfitting risk! The network is memorizing training data without pressure to compress. I(X;Z) grows but contains noise, not just signal.',
  },
  {
    name: '🎲 Peak Fitting',
    beta: 1.5,
    epoch: 35,
    answer: 'fitting',
    description: 'β = 1.5, epoch = 35. Moderate compression with peak information accumulation.',
    explanation: 'This is the fitting phase! Both I(X;Z) and I(Y;Z) are increasing. The network is learning to represent inputs while keeping label information.',
  },
  {
    name: '🎲 Deep Compress',
    beta: 3.0,
    epoch: 80,
    answer: 'compressing',
    description: 'β = 3.0, epoch = 80. High compression weight, deep into training.',
    explanation: 'Deep compression phase! High β (3.0) + late training means I(X;Z) is dropping sharply while I(Y;Z) stays high. The network is forgetting noise, keeping labels.',
  },
  {
    name: '🎲 Sweet Spot',
    beta: 1.8,
    epoch: 65,
    answer: 'optimal',
    description: 'β = 1.8, epoch = 65. Balanced compression after the transition point.',
    explanation: 'Optimal IB trade-off! Moderate β (1.8) in the compression phase creates representations that compress well but retain label information. Best generalization!',
  },
  {
    name: '🎲 Extreme β',
    beta: 4.0,
    epoch: 90,
    answer: 'compressing',
    description: 'β = 4.0, epoch = 90. Maximum compression pressure, nearly converged.',
    explanation: 'Extreme compression! β = 4.0 pushes the network to aggressively forget input details. Risk: even label information can be lost if β is too high.',
  },
]

function getPhaseFeedback(
  prediction: PhasePrediction,
  challenge: PhaseChallenge
): string {
  if (!prediction) return ''

  const isCorrect = prediction === challenge.answer
  const phaseNames: Record<string, string> = {
    fitting: '📈 Fitting',
    compressing: '🗜️ Compressing',
    overfitting: '⚠️ Overfitting Risk',
    optimal: '🎯 Optimal Trade-off',
  }

  if (isCorrect) {
    return `✅ Correct! ${challenge.explanation}`
  }

  return `❌ Not quite. You predicted "${phaseNames[prediction]}" but this is "${phaseNames[challenge.answer!]}".\n\n${challenge.explanation}`
}

const MATH_COLORS = {
  primary: '#f59e0b', // amber
  secondary: '#14b8a6', // teal
  accent: '#8b5cf6', // purple
}

// β operating point presets for different compression regimes
const BETA_PRESETS = [
  { name: '🎯 Minimal', beta: 0.2, description: 'Almost no compression - keep all input details' },
  { name: '⚖️ Balanced', beta: 1.5, description: 'Sweet spot: compress noise, keep labels' },
  { name: '🗜️ Aggressive', beta: 3.0, description: 'Heavy compression - task-only representation' },
  { name: '💀 Extreme', beta: 4.0, description: 'Over-compression risks losing label info' },
]

// Training phase presets
const EPOCH_PRESETS = [
  { name: '🚀 Early', epoch: 10, description: 'Beginning of fitting phase' },
  { name: '📈 Fitting', epoch: 35, description: 'Peak information accumulation' },
  { name: '🔀 Transition', epoch: 45, description: 'Start of compression phase' },
  { name: '🗜️ Compressing', epoch: 75, description: 'Deep into compression' },
  { name: '✅ Converged', epoch: 100, description: 'Training complete' },
]

// Dynamic educational insights based on current state
function getIBInsight(beta: number, epoch: number, betaNorm: number): string {
  const inFitPhase = epoch < 38;
  const inCompressPhase = epoch >= 45;

  if (inFitPhase) {
    if (beta < 1.0) {
      return "🚀 Early fitting with low β: The network is memorizing training data. Watch I(X;Z) grow rapidly - it's storing everything!";
    }
    return "📈 Fitting phase: Both I(X;Z) and I(Y;Z) increase as layers learn to represent the input. The network is learning what matters.";
  }

  if (inCompressPhase) {
    if (beta > 2.5) {
      return "🗜️ Deep compression (high β): I(X;Z) drops sharply while I(Y;Z) stays high. The network forgets noise, keeps labels - this is the IB magic!";
    }
    if (beta < 1.0) {
      return "⚠️ Low β in compression phase: Network retains too much input detail. Risk of overfitting - the representation isn't generalizing well.";
    }
    return "🎯 Compression phase: I(X;Z) decreases (forgetting irrelevant details) while I(Y;Z) is preserved. This is the \"forgetting\" that helps generalization!";
  }

  // Transition phase
  if (betaNorm > 0.6) {
    return "🔀 Transition zone with high β: About to enter compression. Watch deeper layers (bottleneck) compress faster than early layers.";
  }
  return "🔀 Transition from fit to compress: The network has learned the task, now it starts forgetting unnecessary details. Watch the trajectories bend left!";
}

type InfoPoint = {
  ix: number // I(X;Z)
  iy: number // I(Y;Z)
  t: number // normalized epoch in [0,1]
}

const INFO_WIDTH = 320
const INFO_HEIGHT = 220
const INFO_PADDING = 28
const IX_MIN = 0
const IX_MAX = 3
const IY_MIN = 0
const IY_MAX = 2.4

const TRAJ_STEPS = 60
const FIT_FRACTION = 0.38

const BETA_MIN = 0.1
const BETA_MAX = 4.0

const TOY_WIDTH = 260
const TOY_HEIGHT = 180
const TOY_PADDING = 24

const MDL_WIDTH = 260
const MDL_HEIGHT = 180
const MDL_PADDING = 30

const LAYERS = [
  { id: 0, label: 'Layer 1 · Edge / local', color: MATH_COLORS.primary },
  { id: 1, label: 'Layer 2 · Mid-level', color: MATH_COLORS.secondary },
  { id: 2, label: 'Layer 3 · Bottleneck', color: MATH_COLORS.accent },
]

type ToyPoint = {
  x: number
  y: number
  label: 0 | 1
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function betaToNorm(beta: number) {
  const b = clamp(beta, BETA_MIN, BETA_MAX)
  return (b - BETA_MIN) / (BETA_MAX - BETA_MIN)
}

/**
 * Simulate training trajectories in the information plane.
 * Phase 1 (fit): both I(X;Z) and I(Y;Z) increase.
 * Phase 2 (compress): I(X;Z) decreases while I(Y;Z) is mostly preserved.
 */
function computeLayerTrajectory(
  layerIndex: number,
  betaNorm: number,
  steps: number,
): InfoPoint[] {
  const depth = layerIndex + 1
  const numLayers = LAYERS.length
  const depthFactor = depth / numLayers

  const points: InfoPoint[] = []

  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1) // epoch ∈ [0,1]
    const fitPhase = clamp(t / FIT_FRACTION, 0, 1)
    const compressPhase =
      t <= FIT_FRACTION ? 0 : (t - FIT_FRACTION) / (1 - FIT_FRACTION)

    // Early layers retain more input information; deeper layers compress harder.
    const startIx = 0.5 + 0.1 * layerIndex
    const maxIx = 2.5 - 0.25 * layerIndex
    let ix = startIx + (maxIx - startIx) * fitPhase

    const compressionStrength = (0.25 + 0.75 * betaNorm) * depthFactor
    ix -= compressionStrength * compressPhase * 1.1
    ix *= 1 - 0.15 * compressPhase * depthFactor

    // Label information: grows fast in fit phase, then plateaus.
    const maxIy = 1.0 + 0.6 * depthFactor
    let iy = 0.1 + maxIy * fitPhase
    const labelLoss = 0.25 * depthFactor * compressPhase * (0.4 + 0.6 * betaNorm)
    iy -= labelLoss

    ix = clamp(ix, IX_MIN + 0.05, IX_MAX - 0.05)
    iy = clamp(iy, IY_MIN, IY_MAX)

    points.push({ ix, iy, t })
  }

  return points
}

/**
 * Frontier of optimal IB representations: concave trade‑off
 * between keeping input info and label info.
 */
function useFrontierCurve() {
  return useMemo(() => {
    const pts: InfoPoint[] = []
    const n = 64
    for (let i = 0; i <= n; i++) {
      const s = i / n // 0: keep almost everything, 1: heavily compressed
      const ix = 2.7 - 1.6 * s + 0.15 * Math.sin(2 * Math.PI * s)
      const iy = 0.4 + 1.6 * Math.exp(-1.8 * s)
      pts.push({
        ix: clamp(ix, IX_MIN, IX_MAX),
        iy: clamp(iy, IY_MIN, IY_MAX),
        t: s,
      })
    }
    return pts
  }, [])
}

function infoToSvgX(ix: number) {
  const t = (ix - IX_MIN) / (IX_MAX - IX_MIN)
  return INFO_PADDING + t * (INFO_WIDTH - 2 * INFO_PADDING)
}

function infoToSvgY(iy: number) {
  const t = (iy - IY_MIN) / (IY_MAX - IY_MIN)
  return INFO_HEIGHT - INFO_PADDING - t * (INFO_HEIGHT - 2 * INFO_PADDING)
}

// --- Toy dataset for the compression vs prediction panel ---

function useToyPoints(): ToyPoint[] {
  return useMemo(() => {
    const pts: ToyPoint[] = []
    const perCluster = 24
    for (let i = 0; i < perCluster; i++) {
      const angle = (i / perCluster) * Math.PI * 2

      // Class 0: bottom-left blob
      pts.push({
        x: -1 + 0.55 * Math.cos(angle),
        y: -0.8 + 0.35 * Math.sin(angle),
        label: 0,
      })

      // Class 1: top-right blob
      pts.push({
        x: 1.0 + 0.55 * Math.cos(angle + 0.5),
        y: 0.9 + 0.35 * Math.sin(angle + 0.3),
        label: 1,
      })
    }
    return pts
  }, [])
}

function toyToSvgX(x: number) {
  const X_MIN = -2
  const X_MAX = 2
  const t = (x - X_MIN) / (X_MAX - X_MIN)
  return TOY_PADDING + t * (TOY_WIDTH - 2 * TOY_PADDING)
}

function toyToSvgY(y: number) {
  const Y_MIN = -2
  const Y_MAX = 2
  const t = (y - Y_MIN) / (Y_MAX - Y_MIN)
  return TOY_HEIGHT - TOY_PADDING - t * (TOY_HEIGHT - 2 * TOY_PADDING)
}

// --- Sub‑components ---

interface InformationPlaneProps {
  beta: number
  betaNorm: number
  epoch: number // 0..100
  trajectories: { id: number; label: string; color: string; points: InfoPoint[] }[]
  selectedLayerId: number
  onSelectLayer: (id: number) => void
  showEstimates: boolean
}

function InformationPlane(props: InformationPlaneProps) {
  const {
    beta,
    betaNorm,
    epoch,
    trajectories,
    selectedLayerId,
    onSelectLayer,
    showEstimates,
  } = props

  const frontier = useFrontierCurve()
  const epochIndex = Math.max(
    0,
    Math.min(
      TRAJ_STEPS - 1,
      Math.round((epoch / 100) * (TRAJ_STEPS - 1)),
    ),
  )

  const frontierIndex = Math.max(
    0,
    Math.min(
      frontier.length - 1,
      Math.round(betaNorm * (frontier.length - 1)),
    ),
  )
  const betaPoint = frontier[frontierIndex]

  const selectedTrajectory =
    trajectories.find((t) => t.id === selectedLayerId) ?? trajectories[0]
  const selectedPoint =
    selectedTrajectory?.points[epochIndex] ?? selectedTrajectory?.points[0]

  const frontierPath = useMemo(() => {
    if (!frontier.length) return ''
    return frontier
      .map((p, i) => {
        const x = infoToSvgX(p.ix)
        const y = infoToSvgY(p.iy)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [frontier])

  const IXY = 2.1 // I(X;Y) upper bound line (Data Processing Inequality)

  return (
    <div className="ib-panel info-plane">
      <h3>Information Plane</h3>
      <p className="muted">
        Each layer is a point in the information plane. Training first moves
        up/right (fit), then left (compression) while staying high on{' '}
        <span className="math-symbol">I(Y;Z)</span>.
      </p>
      <svg
        width={INFO_WIDTH}
        height={INFO_HEIGHT}
        className="ib-chart info-plane-chart"
        role="img"
        aria-label="Information plane showing trade-off between compression and prediction"
      >
        {/* Axes */}
        <line
          x1={infoToSvgX(IX_MIN)}
          y1={infoToSvgY(IY_MIN)}
          x2={infoToSvgX(IX_MAX)}
          y2={infoToSvgY(IY_MIN)}
          className="axis-line"
        />
        <line
          x1={infoToSvgX(IX_MIN)}
          y1={infoToSvgY(IY_MIN)}
          x2={infoToSvgX(IX_MIN)}
          y2={infoToSvgY(IY_MAX)}
          className="axis-line"
        />

        {/* Axis labels */}
        <text
          x={infoToSvgX(IX_MAX)}
          y={infoToSvgY(IY_MIN) + 20}
          className="axis-label"
          textAnchor="end"
        >
          I(X;Z) — info about input
        </text>
        <text
          x={infoToSvgX(IX_MIN) - 18}
          y={infoToSvgY(IY_MAX)}
          className="axis-label"
          textAnchor="end"
        >
          I(Y;Z)
        </text>

        {/* Data Processing Inequality line I(X;Y) ≥ I(H;Y) */}
        <line
          x1={infoToSvgX(IX_MIN)}
          y1={infoToSvgY(IXY)}
          x2={infoToSvgX(IX_MAX)}
          y2={infoToSvgY(IXY)}
          className="ib-dashed-line"
        />
        <text
          x={infoToSvgX(IX_MAX)}
          y={infoToSvgY(IXY) - 6}
          className="tiny-label"
          textAnchor="end"
        >
          I(X;Y) upper bound
        </text>

        {/* IB frontier */}
        <path d={frontierPath} className="ib-frontier" />

        {/* Layer trajectories */}
        {trajectories.map((layer) => {
          if (!layer.points.length) return null
          const pathD = layer.points
            .map((p, i) => {
              const x = infoToSvgX(p.ix)
              const y = infoToSvgY(p.iy)
              return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
            })
            .join(' ')
          const isSelected = layer.id === selectedLayerId
          return (
            <g key={layer.id}>
              <path
                d={pathD}
                className="ib-layer-path"
                style={{
                  stroke: layer.color,
                  opacity: isSelected ? 0.9 : 0.4,
                  strokeWidth: isSelected ? 2.2 : 1.3,
                }}
              />
              {/* Current epoch point */}
              {layer.points[epochIndex] && (
                <circle
                  cx={infoToSvgX(layer.points[epochIndex].ix)}
                  cy={infoToSvgY(layer.points[epochIndex].iy)}
                  r={isSelected ? 5 : 3.5}
                  style={{
                    fill: layer.color,
                    opacity: isSelected ? 0.95 : 0.6,
                  }}
                />
              )}
            </g>
          )
        })}

        {/* β-selected frontier point */}
        {betaPoint && (
          <g>
            <circle
              cx={infoToSvgX(betaPoint.ix)}
              cy={infoToSvgY(betaPoint.iy)}
              r={5}
              style={{ stroke: MATH_COLORS.accent, fill: 'white', strokeWidth: 2 }}
            />
            <text
              x={infoToSvgX(betaPoint.ix) + 8}
              y={infoToSvgY(betaPoint.iy) - 6}
              className="tiny-label"
            >
              β trade-off
            </text>
          </g>
        )}
      </svg>

      <div className="ib-legend">
        <div className="ib-legend-row">
          <span className="ib-legend-swatch ib-frontier-swatch" />
          <span className="tiny-label">
            Optimal Information Bottleneck frontier
          </span>
        </div>
        {trajectories.map((layer) => (
          <button
            key={layer.id}
            type="button"
            className={`ib-layer-pill ${
              layer.id === selectedLayerId ? 'active' : ''
            }`}
            onClick={() => onSelectLayer(layer.id)}
          >
            <span
              className="ib-legend-swatch"
              style={{ backgroundColor: layer.color }}
            />
            {layer.label}
          </button>
        ))}
      </div>

      {showEstimates && selectedPoint && (
        <p className="tiny-label">
          Selected layer at epoch {epoch.toFixed(0)}:{' '}
          <strong>I(X;Z) ≈ {selectedPoint.ix.toFixed(2)}</strong> bits,{' '}
          <strong>I(Y;Z) ≈ {selectedPoint.iy.toFixed(2)}</strong> bits. Lower
          β keeps more input detail; higher β moves left along the frontier.
        </p>
      )}
      <p className="caption">
        The Data Processing Inequality says each layer can only lose label
        information, never gain it. Training tries to move each layer up towards
        the <em>frontier</em> while compressing along the x-axis.
      </p>
    </div>
  )
}

interface CompressionPredictionProps {
  betaNorm: number
}

function CompressionPredictionPanel({ betaNorm }: CompressionPredictionProps) {
  const toyPoints = useToyPoints()

  // Compression strength: 0 = keep every detail of X; 1 = heavy compression.
  const compression = betaNorm

  const centers: Record<0 | 1, { x: number; y: number }> = {
    0: { x: -1, y: -0.8 },
    1: { x: 1, y: 0.9 },
  }

  // Reconstruction by mixing original with class center
  const reconstructed = useMemo(
    () =>
      toyPoints.map((p) => {
        const c = centers[p.label]
        const x = (1 - compression) * p.x + compression * c.x
        const y = (1 - compression) * p.y + compression * c.y
        return { ...p, rx: x, ry: y }
      }),
    [toyPoints, compression],
  )

  // Simple qualitative scores (0..1) for the bars
  const reconstructionQuality = 1 - compression
  const predictionQuality =
    0.7 + 0.3 * (1 - Math.abs(compression - 0.55) / 0.55) // peak near moderate compression

  return (
    <div className="ib-panel compression-panel">
      <h3>Compression vs Prediction</h3>
      <p className="muted">
        A toy 2D classification task. As β grows, representation{' '}
        <span className="math-symbol">Z</span> collapses within each class:
        input details are compressed, labels are preserved.
      </p>
      <div className="ib-two-column">
        <svg
          width={TOY_WIDTH}
          height={TOY_HEIGHT}
          className="ib-chart"
          role="img"
          aria-label="Toy 2D classification task with compressed reconstruction"
        >
          {/* Axes */}
          <line
            x1={toyToSvgX(-2)}
            y1={toyToSvgY(0)}
            x2={toyToSvgX(2)}
            y2={toyToSvgY(0)}
            className="axis-line"
          />
          <line
            x1={toyToSvgX(0)}
            y1={toyToSvgY(-2)}
            x2={toyToSvgX(0)}
            y2={toyToSvgY(2)}
            className="axis-line"
          />

          {/* Original points (faint) */}
          {toyPoints.map((p, idx) => (
            <circle
              key={`orig-${idx}`}
              cx={toyToSvgX(p.x)}
              cy={toyToSvgY(p.y)}
              r={2.5}
              style={{
                fill: p.label === 0 ? MATH_COLORS.primary : MATH_COLORS.secondary,
                opacity: 0.35,
              }}
            />
          ))}

          {/* Reconstructed points from Z */}
          {reconstructed.map((p, idx) => (
            <rect
              key={`rec-${idx}`}
              x={toyToSvgX(p.rx) - 3.5}
              y={toyToSvgY(p.ry) - 3.5}
              width={7}
              height={7}
              rx={1.5}
              style={{
                fill: p.label === 0 ? MATH_COLORS.primary : MATH_COLORS.secondary,
                opacity: 0.9,
              }}
            />
          ))}

          {/* Class centers (decoder prototypes) */}
          {(Object.keys(centers) as unknown as (0 | 1)[]).map((label) => {
            const c = centers[label]
            return (
              <circle
                key={`center-${label}`}
                cx={toyToSvgX(c.x)}
                cy={toyToSvgY(c.y)}
                r={6}
                style={{
                  fill: 'none',
                  stroke:
                    label === 0 ? MATH_COLORS.primary : MATH_COLORS.secondary,
                  strokeDasharray: '3 2',
                }}
              />
            )
          })}

          <text
            x={toyToSvgX(-1.5)}
            y={toyToSvgY(-1.5)}
            className="tiny-label"
          >
            X (input space)
          </text>
          <text
            x={toyToSvgX(1.4)}
            y={toyToSvgY(1.8)}
            className="tiny-label"
            textAnchor="end"
          >
            Decoder from Z
          </text>
        </svg>

        <div className="ib-metrics">
          <div className="ib-metric-row">
            <span className="tiny-label">Reconstruction of X from Z</span>
            <div className="ib-bar-track">
              <div
                className="ib-bar-fill"
                style={{
                  width: `${(reconstructionQuality * 100).toFixed(0)}%`,
                  background: MATH_COLORS.secondary,
                }}
              />
            </div>
            <span className="tiny-label">
              {(reconstructionQuality * 100).toFixed(0)}%
            </span>
          </div>
          <div className="ib-metric-row">
            <span className="tiny-label">Prediction of Y from Z</span>
            <div className="ib-bar-track">
              <div
                className="ib-bar-fill"
                style={{
                  width: `${(predictionQuality * 100).toFixed(0)}%`,
                  background: MATH_COLORS.primary,
                }}
              />
            </div>
            <span className="tiny-label">
              {(predictionQuality * 100).toFixed(0)}%
            </span>
          </div>
          <p className="caption">
            Low β: Z almost perfectly reconstructs X but may overfit. Moderate β:{' '}
            Z forgets tiny details, clusters by label, and tends to generalize
            better. Extreme β: Z becomes too small, and even label information
            can be lost.
          </p>
        </div>
      </div>
    </div>
  )
}

interface TrainingDynamicsProps {
  epoch: number
  trajectories: { id: number; label: string; color: string; points: InfoPoint[] }[]
  selectedLayerId: number
  setEpoch: (v: number) => void
  autoPlay: boolean
  setAutoPlay: (v: boolean) => void
}

function TrainingDynamicsPanel({
  epoch,
  trajectories,
  selectedLayerId,
  setEpoch,
  autoPlay,
  setAutoPlay,
}: TrainingDynamicsProps) {
  const width = 320
  const height = 160
  const padding = 28
  const epochNorm = epoch / 100

  const selectedTrajectory =
    trajectories.find((t) => t.id === selectedLayerId) ?? trajectories[0]

  const ixPath = useMemo(() => {
    if (!selectedTrajectory.points.length) return ''
    return selectedTrajectory.points
      .map((p, i) => {
        const x =
          padding +
          (p.t * (width - 2 * padding))
        const y =
          height -
          padding -
          ((p.ix - IX_MIN) / (IX_MAX - IX_MIN)) * (height - 2 * padding)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [selectedTrajectory, width, height])

  const iyPath = useMemo(() => {
    if (!selectedTrajectory.points.length) return ''
    return selectedTrajectory.points
      .map((p, i) => {
        const x =
          padding +
          (p.t * (width - 2 * padding))
        const y =
          height -
          padding -
          ((p.iy - IY_MIN) / (IY_MAX - IY_MIN)) * (height - 2 * padding)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [selectedTrajectory, width, height])

  const fitBoundaryX =
    padding + FIT_FRACTION * (width - 2 * padding)

  const cursorX = padding + epochNorm * (width - 2 * padding)

  const epochIndex = Math.max(
    0,
    Math.min(
      TRAJ_STEPS - 1,
      Math.round((epoch / 100) * (TRAJ_STEPS - 1)),
    ),
  )
  const current = selectedTrajectory.points[epochIndex]

  return (
    <div className="ib-panel training-panel">
      <h3>Training Dynamics: Fit → Compress</h3>
      <p className="muted">
        For the selected layer, mutual information with the input and label
        changes over training. Early steps fit data; later steps compress.
      </p>
      <svg
        width={width}
        height={height}
        className="ib-chart"
        role="img"
        aria-label="Training dynamics of mutual information over epochs"
      >
        {/* Background fit/compress shading */}
        <rect
          x={padding}
          y={padding}
          width={fitBoundaryX - padding}
          height={height - 2 * padding}
          className="ib-fit-region"
        />
        <rect
          x={fitBoundaryX}
          y={padding}
          width={width - padding - fitBoundaryX}
          height={height - 2 * padding}
          className="ib-compress-region"
        />

        {/* Axes */}
        <line
          x1={padding}
          y1={height - padding}
          x2={width - padding}
          y2={height - padding}
          className="axis-line"
        />
        <line
          x1={padding}
          y1={padding}
          x2={padding}
          y2={height - padding}
          className="axis-line"
        />
        <text
          x={width - padding}
          y={height - padding + 18}
          className="tiny-label"
          textAnchor="end"
        >
          Training epoch
        </text>
        <text
          x={padding - 16}
          y={padding}
          className="tiny-label"
          textAnchor="end"
        >
          bits
        </text>

        {/* Fit/compress labels */}
        <text
          x={(padding + fitBoundaryX) / 2}
          y={padding + 14}
          className="tiny-label"
          textAnchor="middle"
        >
          Fit phase
        </text>
        <text
          x={(fitBoundaryX + width - padding) / 2}
          y={padding + 14}
          className="tiny-label"
          textAnchor="middle"
        >
          Compression phase
        </text>

        {/* Curves */}
        <path
          d={ixPath}
          style={{
            fill: 'none',
            stroke: MATH_COLORS.secondary,
            strokeWidth: 2,
          }}
        />
        <path
          d={iyPath}
          style={{
            fill: 'none',
            stroke: MATH_COLORS.primary,
            strokeWidth: 2,
          }}
        />

        {/* Current epoch cursor */}
        <line
          x1={cursorX}
          y1={padding}
          x2={cursorX}
          y2={height - padding}
          className="ib-epoch-line"
        />

        {/* Legend */}
        <g>
          <rect x={padding + 4} y={padding + 6} width={10} height={2} fill={MATH_COLORS.secondary} />
          <text x={padding + 18} y={padding + 10} className="tiny-label">
            I(X;Z)
          </text>
          <rect x={padding + 82} y={padding + 6} width={10} height={2} fill={MATH_COLORS.primary} />
          <text x={padding + 96} y={padding + 10} className="tiny-label">
            I(Y;Z)
          </text>
        </g>
      </svg>
      <div className="ib-training-controls">
        <label className="slider-label">
          Training epoch ({epoch.toFixed(0)})
          <input
            type="range"
            min={0}
            max={100}
            value={epoch}
            onChange={(e) => setEpoch(parseFloat(e.target.value))}
          />
        </label>
        <button
          type="button"
          className={`tiny-button ${autoPlay ? 'active' : ''}`}
          onClick={() => setAutoPlay(!autoPlay)}
        >
          {autoPlay ? 'Pause' : 'Play'} animation
        </button>
      </div>
      {current && (
        <p className="tiny-label">
          Fit phase: both curves rise as the layer memorizes the training set.
          Compression phase: <strong>I(X;Z)</strong> drops as irrelevant details
          are forgotten, while <strong>I(Y;Z)</strong> stays near its peak.
        </p>
      )}
    </div>
  )
}

interface MDLViewProps {
  modelComplexity: number // 0..1
  setModelComplexity: (v: number) => void
}

function MDLView({ modelComplexity, setModelComplexity }: MDLViewProps) {
  const points = useMemo(() => {
    const pts: {
      c: number
      lh: number
      ld: number
      total: number
    }[] = []
    const n = 64
    for (let i = 0; i <= n; i++) {
      const c = i / n
      const lh = 0.5 + 1.7 * c // model description length
      const ld = 2.2 - 1.5 * Math.sqrt(c) // data given model
      const total = lh + ld
      pts.push({ c, lh, ld, total })
    }
    return pts
  }, [])

  // Find MDL-optimal complexity
  const optimal = useMemo(() => {
    return points.reduce(
      (best, p) => (p.total < best.total ? p : best),
      points[0],
    )
  }, [points])

  const yMin = Math.min(
    ...points.map((p) => Math.min(p.lh, p.ld, p.total)),
  )
  const yMax = Math.max(
    ...points.map((p) => Math.max(p.lh, p.ld, p.total)),
  )

  const xScale = (c: number) =>
    MDL_PADDING +
    c * (MDL_WIDTH - 2 * MDL_PADDING)

  const yScale = (v: number) =>
    MDL_HEIGHT -
    MDL_PADDING -
    ((v - yMin) / (yMax - yMin)) *
      (MDL_HEIGHT - 2 * MDL_PADDING)

  const totalPath = useMemo(() => {
    return points
      .map((p, i) => {
        const x = xScale(p.c)
        const y = yScale(p.total)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [points])

  const lhPath = useMemo(() => {
    return points
      .map((p, i) => {
        const x = xScale(p.c)
        const y = yScale(p.lh)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [points])

  const ldPath = useMemo(() => {
    return points
      .map((p, i) => {
        const x = xScale(p.c)
        const y = yScale(p.ld)
        return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
      })
      .join(' ')
  }, [points])

  const currentC = clamp(modelComplexity, 0, 1)
  const current = useMemo(() => {
    // approximate current point by interpolation
    const idx = Math.round(currentC * points.length)
    return points[clamp(idx, 0, points.length - 1)]
  }, [points, currentC])

  return (
    <div className="ib-panel mdl-panel">
      <h3>Minimum Description Length (MDL)</h3>
      <p className="muted">
        MDL says: the best model is the shortest code for{' '}
        <span className="math-symbol">model + data</span>. Complexity helps fit
        the data but also costs bits.
      </p>
      <svg
        width={MDL_WIDTH}
        height={MDL_HEIGHT}
        className="ib-chart mdl-chart"
        role="img"
        aria-label="Minimum description length trade-off between model complexity and code length"
      >
        {/* Axes */}
        <line
          x1={MDL_PADDING}
          y1={MDL_HEIGHT - MDL_PADDING}
          x2={MDL_WIDTH - MDL_PADDING}
          y2={MDL_HEIGHT - MDL_PADDING}
          className="axis-line"
        />
        <line
          x1={MDL_PADDING}
          y1={MDL_PADDING}
          x2={MDL_PADDING}
          y2={MDL_HEIGHT - MDL_PADDING}
          className="axis-line"
        />
        <text
          x={MDL_WIDTH - MDL_PADDING}
          y={MDL_HEIGHT - MDL_PADDING + 18}
          className="tiny-label"
          textAnchor="end"
        >
          Model complexity
        </text>
        <text
          x={MDL_PADDING - 16}
          y={MDL_PADDING}
          className="tiny-label"
          textAnchor="end"
        >
          code length (bits)
        </text>

        {/* Curves */}
        <path
          d={lhPath}
          style={{
            fill: 'none',
            stroke: MATH_COLORS.secondary,
            strokeWidth: 1.6,
          }}
        />
        <path
          d={ldPath}
          style={{
            fill: 'none',
            stroke: MATH_COLORS.primary,
            strokeWidth: 1.6,
          }}
        />
        <path
          d={totalPath}
          style={{
            fill: 'none',
            stroke: MATH_COLORS.accent,
            strokeWidth: 2,
          }}
        />

        {/* Optimal point */}
        <circle
          cx={xScale(optimal.c)}
          cy={yScale(optimal.total)}
          r={4.5}
          style={{ fill: MATH_COLORS.accent }}
        />
        <text
          x={xScale(optimal.c) + 6}
          y={yScale(optimal.total) - 6}
          className="tiny-label"
        >
          MDL optimum
        </text>

        {/* Current complexity vertical line */}
        <line
          x1={xScale(currentC)}
          y1={MDL_PADDING}
          x2={xScale(currentC)}
          y2={MDL_HEIGHT - MDL_PADDING}
          className="ib-epoch-line"
        />
      </svg>
      <label className="slider-label">
        Model complexity ({currentC.toFixed(2)})
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={currentC}
          onChange={(e) => setModelComplexity(parseFloat(e.target.value))}
        />
      </label>
      {current && (
        <p className="tiny-label">
          At this complexity, model cost L(H) ≈ {current.lh.toFixed(2)} bits,
          data cost L(D|H) ≈ {current.ld.toFixed(2)} bits, total L(D,H) ≈{' '}
          {current.total.toFixed(2)} bits. The sweet spot balances{' '}
          <strong>simple representations</strong> with <strong>good fit</strong>.
      </p>
      )}
    </div>
  )
}

interface LayerAnalysisProps {
  epoch: number
  trajectories: { id: number; label: string; color: string; points: InfoPoint[] }[]
}

function LayerAnalysisPanel({ epoch, trajectories }: LayerAnalysisProps) {
  const epochIndex = Math.max(
    0,
    Math.min(
      TRAJ_STEPS - 1,
      Math.round((epoch / 100) * (TRAJ_STEPS - 1)),
    ),
  )

  const maxIxAcross = Math.max(
    ...trajectories
      .map((t) => t.points[epochIndex]?.ix ?? 0)
      .concat([IX_MAX]),
  )
  const maxIyAcross = Math.max(
    ...trajectories
      .map((t) => t.points[epochIndex]?.iy ?? 0)
      .concat([IY_MAX]),
  )

  return (
    <div className="ib-panel layer-panel">
      <h3>Layer‑by‑Layer Information</h3>
      <p className="muted">
        Earlier layers keep more about the input X; deeper layers forget most
        details and hold a compact, task‑relevant summary.
      </p>
      <div className="ib-layer-table">
        <div className="ib-layer-header tiny-label">
          <span>Layer</span>
          <span>I(H;X)</span>
          <span>I(H;Y)</span>
        </div>
        {trajectories.map((layer) => {
          const p = layer.points[epochIndex]
          if (!p) return null
          const ixFrac = p.ix / maxIxAcross
          const iyFrac = p.iy / maxIyAcross
          return (
            <div className="ib-layer-row" key={layer.id}>
              <span className="tiny-label">{layer.label}</span>
              <div className="ib-bar-track small">
                <div
                  className="ib-bar-fill"
                  style={{
                    width: `${(ixFrac * 100).toFixed(0)}%`,
                    background: layer.color,
                  }}
                />
              </div>
              <div className="ib-bar-track small">
                <div
                  className="ib-bar-fill"
                  style={{
                    width: `${(iyFrac * 100).toFixed(0)}%`,
                    background: layer.color,
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <p className="caption">
        The information bottleneck perspective views each layer as a{' '}
        <strong>bottleneck</strong>: it passes on what matters for the labels and
        discards the rest.
      </p>
    </div>
  )
}

interface GeneralizationProps {
  betaNorm: number
}

function GeneralizationPanel({ betaNorm }: GeneralizationProps) {
  // Treat betaNorm as "how aggressively we regularize/compress"
  const compression = betaNorm

  // Two conceptual models with the same training accuracy
  const trainAccuracy = 0.99

  const richModelIx = 2.6 - 0.2 * compression
  const compressedModelIx = 2.6 - 1.3 * compression

  // Test accuracy – compressed representation generalizes better
  const richTest = 0.84 - 0.03 * compression
  const compressedTest =
    0.86 + 0.08 * compression - 0.03 * compression * compression

  const maxIx = 2.7
  const ixScale = (ix: number) => clamp(ix / maxIx, 0, 1) * 100

  return (
    <div className="ib-panel generalization-panel">
      <h3>Compression &amp; Generalization</h3>
      <p className="muted">
        Two models can fit the training set equally well, but the one whose
        representation <span className="math-symbol">Z</span> compresses X more
        often has better test accuracy.
      </p>
      <div className="ib-generalization-grid">
        <div className="ib-model-block">
          <h4 className="tiny-label">Model A · Rich representation</h4>
          <div className="ib-metric-row">
            <span className="tiny-label">I(X;Z)</span>
            <div className="ib-bar-track small">
              <div
                className="ib-bar-fill"
                style={{
                  width: `${ixScale(richModelIx).toFixed(0)}%`,
                  background: MATH_COLORS.secondary,
                }}
              />
            </div>
            <span className="tiny-label">
              {richModelIx.toFixed(2)} bits
            </span>
          </div>
          <div className="ib-metric-row">
            <span className="tiny-label">Train accuracy</span>
            <span className="ib-chip">
              {(trainAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ib-metric-row">
            <span className="tiny-label">Test accuracy</span>
            <span className="ib-chip ghost">
              {(richTest * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="ib-model-block">
          <h4 className="tiny-label">Model B · Compressed IB representation</h4>
          <div className="ib-metric-row">
            <span className="tiny-label">I(X;Z)</span>
            <div className="ib-bar-track small">
              <div
                className="ib-bar-fill"
                style={{
                  width: `${ixScale(compressedModelIx).toFixed(0)}%`,
                  background: MATH_COLORS.accent,
                }}
              />
            </div>
            <span className="tiny-label">
              {compressedModelIx.toFixed(2)} bits
            </span>
          </div>
          <div className="ib-metric-row">
            <span className="tiny-label">Train accuracy</span>
            <span className="ib-chip">
              {(trainAccuracy * 100).toFixed(1)}%
            </span>
          </div>
          <div className="ib-metric-row">
            <span className="tiny-label">Test accuracy</span>
            <span className="ib-chip positive">
              {(compressedTest * 100).toFixed(1)}%
            </span>
          </div>
        </div>
      </div>
      <p className="caption">
        From the MDL view, compressed representations act as an implicit
        regularizer: they <strong>shorten the code</strong> describing the model
        and effectively rule out many overfitted solutions that memorize noise.
      </p>
    </div>
  )
}

// --- Top-level demo component ---

export default function InformationBottleneckDemo() {
  const [beta, setBeta] = useState(1.2)
  const [epoch, setEpoch] = useState(45)
  const [selectedLayerId, setSelectedLayerId] = useState(LAYERS[2].id)
  const [showEstimates, setShowEstimates] = useState(true)
  const [modelComplexity, setModelComplexity] = useState(0.55)
  const [autoPlay, setAutoPlay] = useState(false)

  // === Gamification State ===
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<PhaseChallenge | null>(null)
  const [prediction, setPrediction] = useState<PhasePrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

  // Start a challenge
  const startChallenge = useCallback((challenge: PhaseChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    // Set the visualization to the challenge parameters
    setBeta(challenge.beta)
    setEpoch(challenge.epoch)
    setGamePhase('countdown')
    setCountdown(6) // 6 seconds to think and predict
  }, [])

  // Submit prediction
  const submitPrediction = useCallback((phase: PhasePrediction) => {
    if (gamePhase !== 'countdown' || !selectedChallenge) return
    setPrediction(phase)
    setGamePhase('revealed')
    // Update score if correct
    if (phase === selectedChallenge.answer && !completedChallenges.has(selectedChallenge.name)) {
      setScore((s) => s + 1)
      setCompletedChallenges((prev) => new Set([...prev, selectedChallenge.name]))
    }
  }, [gamePhase, selectedChallenge, completedChallenges])

  // Reset game
  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setScore(0)
    setCompletedChallenges(new Set())
  }, [])

  // Countdown timer
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) {
        // Time's up - reveal without prediction
        setGamePhase('revealed')
      } else {
        setCountdown((c) => c - 1)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  const betaNorm = betaToNorm(beta)

  const trajectories = useMemo(
    () =>
      LAYERS.map((layer, idx) => ({
        id: layer.id,
        label: layer.label,
        color: layer.color,
        points: computeLayerTrajectory(idx, betaNorm, TRAJ_STEPS),
      })),
    [betaNorm],
  )

  // Dynamic educational insight based on current state
  const currentInsight = useMemo(() => {
    return getIBInsight(beta, epoch, betaNorm);
  }, [beta, epoch, betaNorm]);

  // Simple play/pause animation over epochs
  useEffect(() => {
    if (!autoPlay) return
    const id = window.setInterval(() => {
      setEpoch((prev) => {
        if (prev >= 100) return 0
        return prev + 1
      })
    }, 80)
    return () => window.clearInterval(id)
  }, [autoPlay])

  return (
    <section className="card interactive-card information-bottleneck-demo">
      <h2>Information Bottleneck Playground</h2>
      <p className="muted">
        Deep networks can be viewed as a stack of information bottlenecks.
        Each layer builds a representation{' '}
        <span className="math-symbol">Z</span> that tries to keep what matters
        for the label <span className="math-symbol">Y</span> while forgetting
        irrelevant details of the input <span className="math-symbol">X</span>.
      </p>

      {/* Game Toggle */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode)
            if (gameMode) resetGame()
          }}
          style={{
            padding: '0.35rem 0.7rem',
            borderRadius: '999px',
            border: gameMode ? '2px solid #22c55e' : '1px solid rgba(34,197,94,0.4)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))'
              : 'rgba(15,23,42,0.8)',
            color: gameMode ? '#e5e7eb' : '#9ca3af',
            fontSize: '0.78rem',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <span>{gameMode ? '🎮' : '🎯'}</span>
          <span>{gameMode ? 'Exit Challenge' : 'Try Phase Quiz'}</span>
        </button>
      </div>

      {/* Gamification Panel */}
      {gameMode && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))',
          border: '1px solid rgba(34,197,94,0.4)',
          marginBottom: '0.75rem',
        }}>
          {gamePhase === 'setup' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  🎯 Training Phase Prediction Challenge
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                  Score: {score}/{PHASE_CHALLENGES.length}
                </span>
              </div>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: '#9ca3af' }}>
                Given β and epoch settings, can you predict what training phase the network is in? Look at the information plane to build intuition!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {PHASE_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '999px',
                      border: completedChallenges.has(challenge.name)
                        ? '1px solid rgba(34,197,94,0.6)'
                        : '1px solid rgba(148,163,184,0.3)',
                      background: completedChallenges.has(challenge.name)
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(15,23,42,0.7)',
                      color: completedChallenges.has(challenge.name) ? '#22c55e' : '#e5e7eb',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'countdown' && selectedChallenge && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  {selectedChallenge.name}
                </h3>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: countdown <= 2 ? '#ef4444' : '#f59e0b',
                }}>
                  ⏱️ {countdown}s
                </span>
              </div>
              <div style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.2)',
                marginBottom: '0.6rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  <strong>Settings:</strong> {selectedChallenge.description}
                </p>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                  💡 Look at the information plane above. What phase is this?
                </p>
              </div>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.78rem', color: '#9ca3af' }}>
                What training phase is this network in?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {[
                  { id: 'fitting' as PhasePrediction, label: '📈 Fitting', desc: 'Learning the data' },
                  { id: 'compressing' as PhasePrediction, label: '🗜️ Compressing', desc: 'Forgetting noise' },
                  { id: 'overfitting' as PhasePrediction, label: '⚠️ Overfitting', desc: 'Memorizing too much' },
                  { id: 'optimal' as PhasePrediction, label: '🎯 Optimal', desc: 'Sweet spot' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => submitPrediction(opt.id)}
                    style={{
                      padding: '0.4rem 0.7rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(139,92,246,0.5)',
                      background: 'rgba(139,92,246,0.12)',
                      color: '#e5e7eb',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      transition: 'all 0.15s ease',
                    }}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  {selectedChallenge.name} — Result
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                  Score: {score}/{PHASE_CHALLENGES.length}
                </span>
              </div>
              <div style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)',
                border: `1px solid ${prediction === selectedChallenge.answer ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                marginBottom: '0.6rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {getPhaseFeedback(prediction, selectedChallenge)}
                </p>
                {!prediction && (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#f59e0b' }}>
                    ⏰ Time's up! The correct answer is {selectedChallenge.answer === 'fitting' ? '📈 Fitting' : selectedChallenge.answer === 'compressing' ? '🗜️ Compressing' : selectedChallenge.answer === 'overfitting' ? '⚠️ Overfitting' : '🎯 Optimal'}.
                    <br /><br />{selectedChallenge.explanation}
                  </p>
                )}
              </div>
              <button
                onClick={() => setGamePhase('setup')}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(34,197,94,0.5)',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                ← Try Another Challenge
              </button>
            </>
          )}
        </div>
      )}

      {/* β Compression Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginRight: '0.25rem', alignSelf: 'center' }}>β presets:</span>
        {BETA_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => setBeta(preset.beta)}
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: Math.abs(beta - preset.beta) < 0.1
                ? '1px solid rgba(139, 92, 246, 0.7)'
                : '1px solid rgba(75, 85, 99, 0.5)',
              background: Math.abs(beta - preset.beta) < 0.1
                ? 'rgba(139, 92, 246, 0.2)'
                : 'rgba(15, 23, 42, 0.8)',
              color: '#e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Training Phase Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginRight: '0.25rem', alignSelf: 'center' }}>Phase:</span>
        {EPOCH_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => setEpoch(preset.epoch)}
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: Math.abs(epoch - preset.epoch) < 8
                ? '1px solid rgba(245, 158, 11, 0.7)'
                : '1px solid rgba(75, 85, 99, 0.5)',
              background: Math.abs(epoch - preset.epoch) < 8
                ? 'rgba(245, 158, 11, 0.2)'
                : 'rgba(15, 23, 42, 0.8)',
              color: '#e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.9)',
          background: epoch < 38
            ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
            : epoch >= 45
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: epoch < 38
            ? '1px solid rgba(20, 184, 166, 0.3)'
            : epoch >= 45
              ? '1px solid rgba(139, 92, 246, 0.3)'
              : '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      {/* Global controls */}
      <div className="ib-top-controls">
        <label className="slider-label">
          Compression weight β ({beta.toFixed(2)})
          <input
            type="range"
            min={BETA_MIN}
            max={BETA_MAX}
            step={0.05}
            value={beta}
            onChange={(e) => setBeta(parseFloat(e.target.value))}
          />
        </label>
        <label className="slider-label">
          Show mutual information estimates
          <input
            type="checkbox"
            checked={showEstimates}
            onChange={(e) => setShowEstimates(e.target.checked)}
          />
        </label>
        <label className="slider-label">
          Layer focus
          <select
            value={selectedLayerId}
            onChange={(e) => setSelectedLayerId(parseInt(e.target.value, 10))}
          >
            {LAYERS.map((layer) => (
              <option key={layer.id} value={layer.id}>
                {layer.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Row 1: Information plane + Compression toy */}
      <div className="ib-grid">
        <InformationPlane
          beta={beta}
          betaNorm={betaNorm}
          epoch={epoch}
          trajectories={trajectories}
          selectedLayerId={selectedLayerId}
          onSelectLayer={setSelectedLayerId}
          showEstimates={showEstimates}
        />
        <CompressionPredictionPanel betaNorm={betaNorm} />
      </div>

      {/* Row 2: Training dynamics + MDL */}
      <div className="ib-grid">
        <TrainingDynamicsPanel
          epoch={epoch}
          trajectories={trajectories}
          selectedLayerId={selectedLayerId}
          setEpoch={setEpoch}
          autoPlay={autoPlay}
          setAutoPlay={setAutoPlay}
        />
        <MDLView
          modelComplexity={modelComplexity}
          setModelComplexity={setModelComplexity}
        />
      </div>

      {/* Row 3: Layer analysis + generalization */}
      <div className="ib-grid">
        <LayerAnalysisPanel epoch={epoch} trajectories={trajectories} />
        <GeneralizationPanel betaNorm={betaNorm} />
      </div>

      <p className="caption">
        The Information Bottleneck objective{' '}
        <span className="math-symbol">
          max<sub>p(z|x)</sub> I(Z;Y) − β·I(Z;X)
        </span>{' '}
        formalizes the idea that <strong>good representations</strong> keep the
        bits that help predict Y and aggressively compress away everything else.
        Deep learning can be seen as the search for these compact,
        task‑relevant codes.
      </p>
    </section>
  )
}
