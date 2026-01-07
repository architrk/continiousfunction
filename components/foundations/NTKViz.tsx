import { useCallback, useEffect, useMemo, useState } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b', // amber
  secondary: '#14b8a6', // teal
  accent: '#8b5cf6', // violet
}

// Width regime presets
const WIDTH_PRESETS = [
  { name: '🔬 Narrow', logWidth: 1.3, lr: 0.25, freeze: false, description: 'Strong feature learning - kernel evolves rapidly' },
  { name: '⚖️ Standard', logWidth: 2.5, lr: 0.18, freeze: false, description: 'Balanced regime - typical transformer scale' },
  { name: '📐 Wide', logWidth: 3.5, lr: 0.12, freeze: false, description: 'Near-NTK behavior - slow feature evolution' },
  { name: '∞ Infinite', logWidth: 4.0, lr: 0.1, freeze: true, description: 'Pure NTK limit - kernel completely frozen' },
]

// Challenge scenarios for prediction game
type GamePhase = 'setup' | 'countdown' | 'racing' | 'revealed'
type RegimePrediction = 'ntk' | 'feature' | 'tie' | null

const RACE_CHALLENGES = [
  { name: '🏎️ Sprint (10 steps)', steps: 10, description: 'Quick race - which regime fits faster initially?' },
  { name: '🏃 Marathon (30 steps)', steps: 30, description: 'Longer race - watch feature learning catch up!' },
  { name: '🎯 Narrow Network', steps: 20, logWidth: 1.5, description: 'Strong feature learning - will NTK keep up?' },
  { name: '📐 Wide Network', steps: 20, logWidth: 3.8, description: 'Near-NTK limit - should they be similar!' },
]

function getRaceFeedback(
  prediction: RegimePrediction,
  ntkError: number,
  featureError: number,
  steps: number,
  width01: number
): string {
  const winner = ntkError < featureError - 0.01 ? 'ntk' : featureError < ntkError - 0.01 ? 'feature' : 'tie'
  const isCorrect = prediction === winner
  const errorDiff = Math.abs(ntkError - featureError)

  if (isCorrect) {
    if (winner === 'tie') {
      return `🎯 Correct! It's a tie (difference < 0.01). At width ~${Math.round(Math.pow(10, 1 + width01 * 3))}, both regimes perform similarly - you're in the transition zone!`
    }
    if (winner === 'ntk') {
      return `🎯 Correct! NTK regime won by ${errorDiff.toFixed(3)}. The frozen kernel provides stable, predictable convergence - especially good for wide networks.`
    }
    return `🎯 Correct! Feature learning won by ${errorDiff.toFixed(3)}. Evolving features found a better representation - this is why narrow networks can outperform!`
  }

  // Wrong prediction
  if (winner === 'ntk') {
    return `❌ Surprise - NTK won! At this width, the frozen kernel was more stable. Feature learning needs time/narrow widths to shine.`
  }
  if (winner === 'feature') {
    return `❌ Feature learning won! The evolving kernel found a better fit. This is the "rich" regime where real learning happens.`
  }
  return `❌ It was actually a tie! At this width, both regimes are in the transition zone where they perform similarly.`
}

// Dynamic educational insights
function getNTKInsight(width01: number, step: number, freezeFeatures: boolean): string {
  if (freezeFeatures) {
    if (step === 0) {
      return "🔒 Pure NTK mode: Features are frozen. Training becomes kernel regression - a linear operation in infinite-dimensional feature space!";
    }
    if (step < 10) {
      return "📊 Kernel regression: The model fits a linear combination of kernel functions K(x, xᵢ). Watch the smooth interpolation emerge.";
    }
    return "✅ Converging to kernel solution: f(x) = Σᵢ αᵢ K(x, xᵢ). The NTK predicts exactly this closed-form solution!";
  }

  if (width01 > 0.75) {
    if (step < 5) {
      return "📐 Very wide network: Approaching the NTK limit. Features change slowly - observe both panels behave similarly.";
    }
    return "🔄 Wide network dynamics: Left (NTK) and right (feature learning) look alike because wide networks stay in the 'lazy' regime.";
  }

  if (width01 < 0.35) {
    if (step === 0) {
      return "🚀 Narrow network: Features will evolve dramatically. Watch the right panel's kernel matrix change as points reorganize!";
    }
    if (step < 15) {
      return "🌀 Rich feature learning: Points in gradient space are clustering by label. The kernel itself is being learned - this is where the magic happens!";
    }
    return "🎯 Feature adaptation complete: Notice how different the right panel is from the NTK limit. Real networks escape lazy training!";
  }

  // Intermediate
  if (step === 0) {
    return "⚖️ Intermediate width: Some feature learning, but not extreme. This is where most practical transformers live.";
  }
  return "🔀 Balanced dynamics: Features are moving (right) but not as dramatically as narrow networks. Compare the kernel matrices!";
}

const X_MIN = -2.4
const X_MAX = 2.4
const GRID_POINTS = 140

const PLOT_WIDTH = 320
const PLOT_HEIGHT = 220
const PLOT_PADDING = 26

const HEATMAP_SIZE = 180
const FEATURE_SIZE = 180

const TRAIN_INPUTS = [-2, -1, 0, 1, 2]

type Vec2 = [number, number]

const POS_CENTER: Vec2 = [0.85, 0.6]
const NEG_CENTER: Vec2 = [-0.85, -0.6]

const KERNEL_SIGMA = 0.9
const KERNEL_SIGMA2 = KERNEL_SIGMA * KERNEL_SIGMA

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// Underlying target function — the "ground truth" the kernel machine tries to fit.
function targetFn(x: number): number {
  return 0.6 * Math.sin(1.4 * x) + 0.3 * x
}

// Simple 2D embedding of 1D input x — think of this as ∇θ fθ(x) projected to 2D.
function baseEmbedding(x: number): Vec2 {
  const u = Math.tanh(x / 1.4)
  const v = Math.tanh((0.9 * x + 0.5) / 1.4)
  return [u, v]
}

function rbfKernel(a: Vec2, b: Vec2): number {
  const dx = a[0] - b[0]
  const dy = a[1] - b[1]
  const dist2 = dx * dx + dy * dy
  return Math.exp(-dist2 / (2 * KERNEL_SIGMA2))
}

function computeKernelMatrix(a: Vec2[], b: Vec2[]): number[][] {
  const rows: number[][] = new Array(a.length)
  for (let i = 0; i < a.length; i++) {
    const row: number[] = new Array(b.length)
    for (let j = 0; j < b.length; j++) {
      row[j] = rbfKernel(a[i], b[j])
    }
    rows[i] = row
  }
  return rows
}

function matVecMul(matrix: number[][], vec: number[]): number[] {
  return matrix.map((row) => {
    let acc = 0
    for (let j = 0; j < row.length; j++) {
      acc += row[j] * vec[j]
    }
    return acc
  })
}

interface FunctionPlotProps {
  gridX: number[]
  gridPred: number[]
  gridTarget: number[]
  trainX: number[]
  trainY: number[]
  trainPred: number[]
  yMin: number
  yMax: number
  title: string
  regimeLabel: string
  accentColor: string
}

function FunctionPlot({
  gridX,
  gridPred,
  gridTarget,
  trainX,
  trainY,
  trainPred,
  yMin,
  yMax,
  title,
  regimeLabel,
  accentColor,
}: FunctionPlotProps) {
  const xToSvg = (x: number) => {
    const t = (x - X_MIN) / (X_MAX - X_MIN || 1)
    return PLOT_PADDING + t * (PLOT_WIDTH - 2 * PLOT_PADDING)
  }

  const yToSvg = (y: number) => {
    const t = (y - yMin) / (yMax - yMin || 1)
    return PLOT_HEIGHT - PLOT_PADDING - t * (PLOT_HEIGHT - 2 * PLOT_PADDING)
  }

  const targetPath = useMemo(() => {
    if (!gridX.length) return ''
    let d = ''
    for (let i = 0; i < gridX.length; i++) {
      const cmd = i === 0 ? 'M' : 'L'
      d += `${cmd} ${xToSvg(gridX[i])} ${yToSvg(gridTarget[i])} `
    }
    return d
  }, [gridX, gridTarget])

  const predPath = useMemo(() => {
    if (!gridX.length) return ''
    let d = ''
    for (let i = 0; i < gridX.length; i++) {
      const cmd = i === 0 ? 'M' : 'L'
      d += `${cmd} ${xToSvg(gridX[i])} ${yToSvg(gridPred[i])} `
    }
    return d
  }, [gridX, gridPred])

  return (
    <div className="ntk-function-panel">
      <div className="ntk-panel-header">
        <h4>{title}</h4>
        <span className="ntk-badge">{regimeLabel}</span>
      </div>
      <svg
        width={PLOT_WIDTH}
        height={PLOT_HEIGHT}
        className="ntk-function-chart"
        role="img"
        aria-label="Function space view showing target function and model prediction"
      >
        {/* Axes */}
        <line
          x1={xToSvg(X_MIN)}
          y1={yToSvg(0)}
          x2={xToSvg(X_MAX)}
          y2={yToSvg(0)}
          className="axis-line"
        />
        <line
          x1={xToSvg(0)}
          y1={yToSvg(yMin)}
          x2={xToSvg(0)}
          y2={yToSvg(yMax)}
          className="axis-line axis-center"
        />

        {/* Target function */}
        <path
          d={targetPath}
          className="ntk-target-curve"
          stroke="currentColor"
          style={{ opacity: 0.4 }}
        />

        {/* Model prediction */}
        <path
          d={predPath}
          className="ntk-pred-curve"
          stroke={accentColor}
          fill="none"
          strokeWidth={2.2}
        />

        {/* Training points (true labels) */}
        {trainX.map((x, i) => (
          <circle
            key={`train-true-${i}`}
            cx={xToSvg(x)}
            cy={yToSvg(trainY[i])}
            r={4.5}
            fill={MATH_COLORS.primary}
            className="ntk-sample-true"
          />
        ))}

        {/* Training point predictions */}
        {trainX.map((x, i) => (
          <circle
            key={`train-pred-${i}`}
            cx={xToSvg(x)}
            cy={yToSvg(trainPred[i])}
            r={3}
            fill={accentColor}
            className="ntk-sample-pred"
          />
        ))}
      </svg>
      <p className="caption">
        The curve shows f(x) as training progresses. In the NTK/lazy regime the
        path is almost linear; with feature learning the curve bends as the
        representation itself adapts.
      </p>
    </div>
  )
}

interface KernelHeatmapProps {
  matrix: number[][]
  title: string
  subtitle: string
}

function KernelHeatmap({ matrix, title, subtitle }: KernelHeatmapProps) {
  const n = matrix.length
  if (n === 0) return null

  let minVal = matrix[0][0]
  let maxVal = matrix[0][0]
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const v = matrix[i][j]
      if (v < minVal) minVal = v
      if (v > maxVal) maxVal = v
    }
  }
  const span = maxVal - minVal || 1
  const cellSize = (HEATMAP_SIZE - 32) / n
  const offset = 16

  return (
    <div className="ntk-heatmap-panel">
      <div className="ntk-panel-header">
        <h4>{title}</h4>
        <span className="ntk-subtle-label">{subtitle}</span>
      </div>
      <svg
        width={HEATMAP_SIZE}
        height={HEATMAP_SIZE}
        className="ntk-heatmap-chart"
        role="img"
        aria-label="Kernel matrix heatmap"
      >
        {/* Grid cells */}
        {matrix.map((row, i) =>
          row.map((v, j) => {
            const norm = (v - minVal) / span
            const opacity = 0.1 + 0.9 * norm
            return (
              <rect
                key={`${i}-${j}`}
                x={offset + j * cellSize}
                y={offset + i * cellSize}
                width={cellSize - 1}
                height={cellSize - 1}
                fill={MATH_COLORS.accent}
                fillOpacity={opacity}
              />
            )
          })
        )}

        {/* Border */}
        <rect
          x={offset}
          y={offset}
          width={cellSize * n}
          height={cellSize * n}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.6}
          className="axis-line"
        />
      </svg>
      <p className="caption">
        Θ(xᵢ, xⱼ) measures how coupled the gradients at two points are. In the
        NTK limit this matrix is effectively frozen; with feature learning it
        evolves as the representation changes.
      </p>
    </div>
  )
}

interface FeatureSpacePlotProps {
  points: Vec2[]
  targets: number[]
  title: string
  subtitle: string
  isFrozen: boolean
}

function FeatureSpacePlot({
  points,
  targets,
  title,
  subtitle,
  isFrozen,
}: FeatureSpacePlotProps) {
  const size = FEATURE_SIZE
  const center = size / 2
  const radius = center - 18

  const toSvg = (p: Vec2) => {
    const [x, y] = p
    return {
      x: center + x * radius,
      y: center - y * radius,
    }
  }

  return (
    <div className="ntk-feature-panel">
      <div className="ntk-panel-header">
        <h4>{title}</h4>
        <span className="ntk-subtle-label">{subtitle}</span>
      </div>
      <svg
        width={size}
        height={size}
        className="ntk-feature-chart"
        role="img"
        aria-label="Feature / gradient space view"
      >
        {/* Axes */}
        <line
          x1={0}
          y1={center}
          x2={size}
          y2={center}
          className="axis-line"
        />
        <line
          x1={center}
          y1={0}
          x2={center}
          y2={size}
          className="axis-line"
        />

        {/* Optional reference circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeDasharray="4 4"
          strokeWidth={0.5}
          style={{ opacity: 0.25 }}
        />

        {/* Cluster centers (for intuition) */}
        {!isFrozen && (
          <>
            <circle
              cx={toSvg(POS_CENTER).x}
              cy={toSvg(POS_CENTER).y}
              r={3}
              fill={MATH_COLORS.primary}
              style={{ opacity: 0.7 }}
            />
            <circle
              cx={toSvg(NEG_CENTER).x}
              cy={toSvg(NEG_CENTER).y}
              r={3}
              fill={MATH_COLORS.secondary}
              style={{ opacity: 0.7 }}
            />
          </>
        )}

        {/* Points */}
        {points.map((p, i) => {
          const svg = toSvg(p)
          const isPos = targets[i] >= 0
          return (
            <circle
              key={i}
              cx={svg.x}
              cy={svg.y}
              r={6}
              className="ntk-feature-point"
              fill={isPos ? MATH_COLORS.primary : MATH_COLORS.secondary}
              stroke={isFrozen ? 'none' : MATH_COLORS.accent}
              strokeWidth={isFrozen ? 0 : 1.3}
            />
          )
        })}
      </svg>
      <p className="caption">
        Each point is an input xᵢ viewed through its gradient/feature vector.
        Frozen features ≈ fixed kernel; moving features mean the kernel itself
        is being learned.
      </p>
    </div>
  )
}

export default function NTKDemo() {
  // Log-width slider in [1, 4] ≈ network width in [10, 10000]
  const [logWidth, setLogWidth] = useState(3) // ≈ width 1000
  const [learningRate, setLearningRate] = useState(0.18)
  const [freezeFeatures, setFreezeFeatures] = useState(false)

  const [ntkAlphas, setNtkAlphas] = useState<number[]>(
    () => TRAIN_INPUTS.map(() => 0)
  )
  const [featureAlphas, setFeatureAlphas] = useState<number[]>(
    () => TRAIN_INPUTS.map(() => 0)
  )
  const [featureEmbeddings, setFeatureEmbeddings] = useState<Vec2[]>(() =>
    TRAIN_INPUTS.map((x) => baseEmbedding(x))
  )
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<RegimePrediction>(null)
  const [activeChallenge, setActiveChallenge] = useState<typeof RACE_CHALLENGES[0] | null>(null)
  const [raceSteps, setRaceSteps] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [gameScore, setGameScore] = useState(0)
  const [gameStreak, setGameStreak] = useState(0)

  const widthApprox = useMemo(
    () => Math.round(Math.pow(10, logWidth)),
    [logWidth]
  )
  const width01 = useMemo(
    () => clamp((logWidth - 1) / 3, 0, 1),
    [logWidth]
  )

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getNTKInsight(width01, step, freezeFeatures);
  }, [width01, step, freezeFeatures]);

  // Start a race challenge
  const startRaceChallenge = useCallback((challenge: typeof RACE_CHALLENGES[0]) => {
    // Reset training state
    setNtkAlphas(TRAIN_INPUTS.map(() => 0))
    setFeatureAlphas(TRAIN_INPUTS.map(() => 0))
    setFeatureEmbeddings(TRAIN_INPUTS.map((x) => baseEmbedding(x)))
    setStep(0)
    setRaceSteps(0)

    // Apply challenge-specific settings
    if ('logWidth' in challenge && challenge.logWidth !== undefined) {
      setLogWidth(challenge.logWidth)
    }

    setActiveChallenge(challenge)
    setGamePhase('setup')
    setPrediction(null)
  }, [])

  const confirmPrediction = useCallback(() => {
    if (!prediction || !activeChallenge) return
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction, activeChallenge])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setActiveChallenge(null)
    setRaceSteps(0)
    setIsPlaying(false)
  }, [])

  // Apply preset
  const handlePreset = (preset: typeof WIDTH_PRESETS[0]) => {
    setLogWidth(preset.logWidth);
    setLearningRate(preset.lr);
    setFreezeFeatures(preset.freeze);
  }

  const gridX = useMemo(() => {
    const xs: number[] = []
    for (let i = 0; i < GRID_POINTS; i++) {
      const t = i / (GRID_POINTS - 1)
      xs.push(X_MIN + t * (X_MAX - X_MIN))
    }
    return xs
  }, [])

  const targetTrain = useMemo(
    () => TRAIN_INPUTS.map((x) => targetFn(x)),
    []
  )
  const targetGrid = useMemo(
    () => gridX.map((x) => targetFn(x)),
    [gridX]
  )

  const baseTrainFeatures = useMemo<Vec2[]>(
    () => TRAIN_INPUTS.map((x) => baseEmbedding(x)),
    []
  )
  const gridFeatures = useMemo<Vec2[]>(
    () => gridX.map((x) => baseEmbedding(x)),
    [gridX]
  )

  // Kernels for NTK regime (frozen)
  const ntkKernelTrain = useMemo(
    () => computeKernelMatrix(baseTrainFeatures, baseTrainFeatures),
    [baseTrainFeatures]
  )
  const ntkKernelGridTrain = useMemo(
    () => computeKernelMatrix(gridFeatures, baseTrainFeatures),
    [gridFeatures, baseTrainFeatures]
  )

  // Kernels for feature-learning regime (evolving)
  const featureKernelTrain = useMemo(
    () => computeKernelMatrix(featureEmbeddings, featureEmbeddings),
    [featureEmbeddings]
  )
  const featureKernelGridTrain = useMemo(
    () => computeKernelMatrix(gridFeatures, featureEmbeddings),
    [gridFeatures, featureEmbeddings]
  )

  // Predictions
  const ntkTrainPred = useMemo(
    () => matVecMul(ntkKernelTrain, ntkAlphas),
    [ntkKernelTrain, ntkAlphas]
  )
  const ntkGridPred = useMemo(
    () => matVecMul(ntkKernelGridTrain, ntkAlphas),
    [ntkKernelGridTrain, ntkAlphas]
  )

  const featureTrainPred = useMemo(
    () => matVecMul(featureKernelTrain, featureAlphas),
    [featureKernelTrain, featureAlphas]
  )
  const featureGridPred = useMemo(
    () => matVecMul(featureKernelGridTrain, featureAlphas),
    [featureKernelGridTrain, featureAlphas]
  )

  // Calculate training errors for both regimes (for prediction game)
  const { ntkError, featureError } = useMemo(() => {
    const ntkMSE = ntkTrainPred.reduce((acc, pred, i) => acc + Math.pow(pred - targetTrain[i], 2), 0) / targetTrain.length
    const featureMSE = featureTrainPred.reduce((acc, pred, i) => acc + Math.pow(pred - targetTrain[i], 2), 0) / targetTrain.length
    return { ntkError: ntkMSE, featureError: featureMSE }
  }, [ntkTrainPred, featureTrainPred, targetTrain])

  // Shared y-range for function plots
  const { minY, maxY } = useMemo(() => {
    const allValues = [
      ...targetGrid,
      ...ntkGridPred,
      ...featureGridPred,
      ...targetTrain,
      ...ntkTrainPred,
      ...featureTrainPred,
    ]
    if (allValues.length === 0) {
      return { minY: -1, maxY: 1 }
    }
    let minV = allValues[0]
    let maxV = allValues[0]
    for (const v of allValues) {
      if (v < minV) minV = v
      if (v > maxV) maxV = v
    }
    const pad = 0.35 * Math.max(1, maxV - minV)
    return { minY: minV - pad, maxY: maxV + pad }
  }, [targetGrid, targetTrain, ntkGridPred, ntkTrainPred, featureGridPred, featureTrainPred])

  // One simulation step: gradient descent in function space.
  const stepOnce = useCallback(() => {
    const lrBase = learningRate
    const lrNTK = lrBase * 0.6 // a bit conservative for stability
    const lrFeature = lrBase * (0.4 + 0.6 * (1 - width01))
    const featureAdapt = freezeFeatures ? 0 : 0.4 + 0.6 * (1 - width01)

    // NTK regime: kernel fixed, only coefficients α move.
    const ntkFTrain = matVecMul(ntkKernelTrain, ntkAlphas)
    const ntkResidual = ntkFTrain.map((f, i) => f - targetTrain[i])
    const ntkGrad = matVecMul(ntkKernelTrain, ntkResidual)
    const newNtkAlphas = ntkAlphas.map(
      (a, i) => a - lrNTK * ntkGrad[i]
    )

    // Feature-learning regime: kernel built from evolving embeddings.
    const currentFeatureKernelTrain = computeKernelMatrix(
      featureEmbeddings,
      featureEmbeddings
    )
    const featFTrain = matVecMul(currentFeatureKernelTrain, featureAlphas)
    const featResidual = featFTrain.map((f, i) => f - targetTrain[i])
    const featGrad = matVecMul(currentFeatureKernelTrain, featResidual)
    const newFeatureAlphas = featureAlphas.map(
      (a, i) => a - lrFeature * featGrad[i]
    )

    // Evolve "gradient features" themselves: points with similar labels
    // gently move toward shared centers in 2D.
    const newEmbeddings: Vec2[] = featureEmbeddings.map((p, i) => {
      const [x, y] = p
      if (featureAdapt <= 0) return [x, y]
      const center = targetTrain[i] >= 0 ? POS_CENTER : NEG_CENTER
      const dx = center[0] - x
      const dy = center[1] - y
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const stepMag = featureAdapt * 0.08 * Math.tanh(featResidual[i])
      const nx = clamp(x + stepMag * ux, -1.2, 1.2)
      const ny = clamp(y + stepMag * uy, -1.2, 1.2)
      return [nx, ny]
    })

    setNtkAlphas(newNtkAlphas)
    setFeatureAlphas(newFeatureAlphas)
    setFeatureEmbeddings(newEmbeddings)
    setStep((s) => s + 1)
  }, [
    learningRate,
    width01,
    freezeFeatures,
    ntkKernelTrain,
    ntkAlphas,
    featureEmbeddings,
    featureAlphas,
    targetTrain,
  ])

  // Play / pause animation
  useEffect(() => {
    if (!isPlaying) return
    const id = window.setInterval(() => {
      stepOnce()
    }, 450)
    return () => window.clearInterval(id)
  }, [isPlaying, stepOnce])

  // Countdown effect for race game
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('racing')
      setRaceSteps(0)
    }
  }, [gamePhase, countdown])

  // Race animation effect
  useEffect(() => {
    if (gamePhase !== 'racing' || !activeChallenge) return

    if (raceSteps >= activeChallenge.steps) {
      setGamePhase('revealed')
      // Score calculation
      const winner = ntkError < featureError - 0.01 ? 'ntk' : featureError < ntkError - 0.01 ? 'feature' : 'tie'
      if (prediction === winner) {
        setGameScore(s => s + 10 + gameStreak * 2)
        setGameStreak(s => s + 1)
      } else {
        setGameStreak(0)
      }
      return
    }

    const timer = setTimeout(() => {
      stepOnce()
      setRaceSteps(s => s + 1)
    }, 200)
    return () => clearTimeout(timer)
  }, [gamePhase, activeChallenge, raceSteps, stepOnce, ntkError, featureError, prediction, gameStreak])

  const reset = () => {
    setNtkAlphas(TRAIN_INPUTS.map(() => 0))
    setFeatureAlphas(TRAIN_INPUTS.map(() => 0))
    setFeatureEmbeddings(TRAIN_INPUTS.map((x) => baseEmbedding(x)))
    setStep(0)
    setIsPlaying(false)
  }

  return (
    <section className="card interactive-card">
      <h2>Neural Tangent Kernel Dynamics</h2>
      <p className="muted">
        Compare the NTK/lazy-training limit (frozen kernel) against a
        feature-learning regime where the kernel itself evolves. Both panels see
        the same training data; only the effective width / feature dynamics
        differ.
      </p>

      {/* Width Regime Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {WIDTH_PRESETS.map((preset) => {
          const isActive = Math.abs(logWidth - preset.logWidth) < 0.2 && freezeFeatures === preset.freeze;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePreset(preset)}
              disabled={gamePhase === 'racing' || gamePhase === 'countdown'}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '999px',
                border: isActive
                  ? '1px solid rgba(139, 92, 246, 0.7)'
                  : '1px solid rgba(75, 85, 99, 0.5)',
                background: isActive
                  ? 'rgba(139, 92, 246, 0.2)'
                  : 'rgba(15, 23, 42, 0.8)',
                color: '#e5e7eb',
                cursor: gamePhase === 'racing' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                opacity: gamePhase === 'racing' || gamePhase === 'countdown' ? 0.5 : 1,
                transition: 'all 0.15s ease-out',
              }}
              title={preset.description}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* 🏎️ Regime Race Challenge */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.05))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              🏎️ <strong>Regime Race:</strong> Which training regime will have lower error?
            </span>
            {(gameScore > 0 || gameStreak > 0) && (
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span>Score: <strong style={{ color: '#f59e0b' }}>{gameScore}</strong></span>
                <span>Streak: <strong style={{ color: gameStreak > 0 ? '#22c55e' : '#9ca3af' }}>{gameStreak}🔥</strong></span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {RACE_CHALLENGES.map(challenge => (
              <button
                key={challenge.name}
                onClick={() => startRaceChallenge(challenge)}
                disabled={gamePhase === 'racing' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge?.name === challenge.name
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'rgba(139, 92, 246, 0.1)',
                  border: `1px solid ${activeChallenge?.name === challenge.name ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'racing' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'racing' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={challenge.description}
              >
                {challenge.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase - make prediction */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Race: <strong>{activeChallenge.steps} steps</strong> |
              Width: <strong>~{widthApprox.toLocaleString()}</strong>
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>Who wins the race?</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPrediction('ntk')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'ntk' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.15)',
                  border: `2px solid ${prediction === 'ntk' ? '#8b5cf6' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🧊 NTK (frozen kernel)
              </button>
              <button
                onClick={() => setPrediction('feature')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'feature' ? 'rgba(20, 184, 166, 0.4)' : 'rgba(20, 184, 166, 0.15)',
                  border: `2px solid ${prediction === 'feature' ? '#14b8a6' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🔥 Feature Learning
              </button>
              <button
                onClick={() => setPrediction('tie')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'tie' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)',
                  border: `2px solid ${prediction === 'tie' ? '#f59e0b' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🤝 Tie
              </button>
            </div>
            {prediction && (
              <button
                onClick={confirmPrediction}
                style={{
                  padding: '8px 20px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                🏁 Start Race!
              </button>
            )}
          </div>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {countdown}
            </div>
            <p style={{ color: '#9ca3af' }}>Get ready...</p>
          </div>
        )}

        {/* Racing phase */}
        {gamePhase === 'racing' && activeChallenge && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                🏎️ Racing... Step {raceSteps}/{activeChallenge.steps}
              </span>
              <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem' }}>
                <span>🧊 NTK: <strong style={{ color: '#8b5cf6' }}>{ntkError.toFixed(4)}</strong></span>
                <span>🔥 Feature: <strong style={{ color: '#14b8a6' }}>{featureError.toFixed(4)}</strong></span>
              </div>
            </div>
            <div style={{
              height: '8px',
              background: 'rgba(75, 85, 99, 0.3)',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <div style={{
                height: '100%',
                width: `${(raceSteps / activeChallenge.steps) * 100}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #14b8a6)',
                transition: 'width 0.2s ease',
              }} />
            </div>
          </div>
        )}

        {/* Revealed phase */}
        {gamePhase === 'revealed' && activeChallenge && prediction && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '0.9rem' }}>
                <span style={{ color: '#8b5cf6' }}>🧊 NTK Error: <strong>{ntkError.toFixed(4)}</strong></span>
                <span style={{ margin: '0 16px', color: '#9ca3af' }}>vs</span>
                <span style={{ color: '#14b8a6' }}>🔥 Feature Error: <strong>{featureError.toFixed(4)}</strong></span>
              </div>
              <div style={{
                fontSize: '1.5rem',
                fontWeight: 'bold',
                color: ntkError < featureError - 0.01 ? '#8b5cf6' : featureError < ntkError - 0.01 ? '#14b8a6' : '#f59e0b'
              }}>
                {ntkError < featureError - 0.01 ? '🧊 NTK Wins!' : featureError < ntkError - 0.01 ? '🔥 Feature Wins!' : '🤝 Tie!'}
              </div>
            </div>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: (prediction === (ntkError < featureError - 0.01 ? 'ntk' : featureError < ntkError - 0.01 ? 'feature' : 'tie'))
                ? 'rgba(34, 197, 94, 0.2)'
                : 'rgba(239, 68, 68, 0.2)',
              marginBottom: '12px',
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                {getRaceFeedback(prediction, ntkError, featureError, activeChallenge.steps, width01)}
              </p>
            </div>
            <button
              onClick={resetGame}
              style={{
                padding: '8px 20px',
                background: '#8b5cf6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try Another Race →
            </button>
          </div>
        )}

        {!activeChallenge && (
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
            Select a race challenge above to predict which training regime will converge faster!
          </p>
        )}
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
          background: freezeFeatures
            ? 'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(75, 85, 99, 0.05))'
            : width01 > 0.7
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
              : width01 < 0.35
                ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: freezeFeatures
            ? '1px solid rgba(75, 85, 99, 0.3)'
            : width01 > 0.7
              ? '1px solid rgba(139, 92, 246, 0.3)'
              : width01 < 0.35
                ? '1px solid rgba(20, 184, 166, 0.3)'
                : '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="ntk-top-controls">
        <div className="ntk-sliders">
          <label className="slider-label">
            Network width (10 → 10,000){' '}
            <span className="mono">≈ {widthApprox.toLocaleString()}</span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.02}
              value={logWidth}
              onChange={(e) => setLogWidth(parseFloat(e.target.value))}
            />
          </label>
          <label className="slider-label">
            Learning rate ({learningRate.toFixed(2)})
            <input
              type="range"
              min={0.04}
              max={0.6}
              step={0.02}
              value={learningRate}
              onChange={(e) => setLearningRate(parseFloat(e.target.value))}
            />
          </label>
          <label className="slider-label ntk-toggle">
            <input
              type="checkbox"
              checked={freezeFeatures}
              onChange={(e) => setFreezeFeatures(e.target.checked)}
            />
            Freeze features (pure NTK on both sides)
          </label>
        </div>
        <div className="ntk-actions">
          <button onClick={stepOnce}>Step once</button>
          <button
            onClick={() => setIsPlaying((p) => !p)}
            className="ghost"
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button onClick={reset} className="ghost">
            Reset
          </button>
          <div className="ntk-stats">
            <div>
              <span className="label">Step:</span> {step}
            </div>
            <div>
              <span className="label">Width regime:</span>{' '}
              {width01 > 0.66
                ? 'Very wide → NTK-like'
                : width01 < 0.33
                ? 'Narrow → strong feature learning'
                : 'Intermediate'}
            </div>
          </div>
        </div>
      </div>

      <div className="ntk-layout">
        {/* Left: NTK / lazy-training regime */}
        <div className="ntk-column">
          <h3 className="ntk-panel-title">
            Left: NTK / lazy training (infinite-width limit)
          </h3>
          <FunctionPlot
            gridX={gridX}
            gridPred={ntkGridPred}
            gridTarget={targetGrid}
            trainX={TRAIN_INPUTS}
            trainY={targetTrain}
            trainPred={ntkTrainPred}
            yMin={minY}
            yMax={maxY}
            title="Function space view"
            regimeLabel="Kernel fixed; linear dynamics in function space"
            accentColor={MATH_COLORS.accent}
          />
          <KernelHeatmap
            matrix={ntkKernelTrain}
            title="NTK matrix Θ(xᵢ, xⱼ)"
            subtitle="Effectively constant during training"
          />
          <FeatureSpacePlot
            points={baseTrainFeatures}
            targets={targetTrain}
            title="Gradient feature space"
            subtitle="∇θ fθ(xᵢ) projected to 2D (frozen)"
            isFrozen={true}
          />
        </div>

        {/* Right: feature-learning regime */}
        <div className="ntk-column">
          <h3 className="ntk-panel-title">
            Right: finite-width, feature learning regime
          </h3>
          <FunctionPlot
            gridX={gridX}
            gridPred={featureGridPred}
            gridTarget={targetGrid}
            trainX={TRAIN_INPUTS}
            trainY={targetTrain}
            trainPred={featureTrainPred}
            yMin={minY}
            yMax={maxY}
            title="Function space view"
            regimeLabel="Kernel evolves as features move"
            accentColor={MATH_COLORS.secondary}
          />
          <KernelHeatmap
            matrix={featureKernelTrain}
            title="Evolving kernel matrix"
            subtitle="Features reorganize → Θ(xᵢ, xⱼ) changes"
          />
          <FeatureSpacePlot
            points={featureEmbeddings}
            targets={targetTrain}
            title="Gradient / feature space"
            subtitle="Points drift and cluster by label"
            isFrozen={false}
          />
        </div>
      </div>

      <p className="caption">
        In the infinite-width limit, the NTK is fixed at initialization and
        training becomes kernel regression in function space. Narrow, finite
        networks escape this &quot;lazy&quot; regime by changing their features
        — effectively learning the kernel itself. Real-world transformers live
        somewhere between these extremes.
      </p>
    </section>
  )
}
