import { useMemo, useState, useCallback, useEffect } from 'react'
import { emitDemoState } from '../../lib/demoState'
import { MATH_COLORS } from '../../lib/mathObjects'

const LANDSCAPE_WIDTH = 320
const LANDSCAPE_HEIGHT = 260
const PADDING = 28

// Parameter domain for the Rosenbrock function
const X_MIN = -2
const X_MAX = 2
const Y_MIN = -1
const Y_MAX = 3

// Rosenbrock minimum
const OPT_X = 1
const OPT_Y = 1

// Small numerical constant for Adam
const EPS = 1e-8

// Fixed weight decay for AdamW (decoupled)
const DEFAULT_WEIGHT_DECAY = 0.05

// Grid resolution for contour lines
const GRID_NX = 40
const GRID_NY = 40

// Guided setups for quick experiments
const GUIDED_SETUPS = [
  {
    name: 'Well tuned Adam',
    description:
      'Typical deep learning defaults. Watch Adam follow the curved valley while SGD zig-zags.',
    lr: 0.01,
    beta1: 0.9,
    beta2: 0.999,
    useAdamW: false,
  },
  {
    name: 'Noisy v (small β₂)',
    description:
      'Smaller β₂ reacts faster to gradient changes but makes the effective learning rate noisy.',
    lr: 0.01,
    beta1: 0.9,
    beta2: 0.9,
    useAdamW: false,
  },
  {
    name: 'Aggressive Adam',
    description:
      'Higher learning rate and moderate β₂. Adam may overshoot and destabilize on this valley.',
    lr: 0.05,
    beta1: 0.9,
    beta2: 0.99,
    useAdamW: false,
  },
  {
    name: 'AdamW (decoupled decay)',
    description:
      'AdamW pulls parameters toward zero independently of the adaptive gradient step.',
    lr: 0.02,
    beta1: 0.9,
    beta2: 0.999,
    useAdamW: true,
  },
]

// Prediction game types and constants
type OptimizerChoice = 'SGD' | 'Momentum' | 'Adam'
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed'

const FINISH_STEP = 60 // Fixed race length for consistent predictions

// Race presets designed so different optimizers can win
const RACE_PRESETS = [
  {
    name: "Adam's Domain",
    description: 'Classic ill-conditioned valley where Adam shines',
    lr: 0.015,
    beta1: 0.9,
    beta2: 0.999,
    useAdamW: false,
    expectedWinner: 'Adam' as OptimizerChoice,
  },
  {
    name: "Momentum's Revenge",
    description: 'Moderate momentum with a small global step - velocity can outpace Adam here',
    lr: 0.001,
    beta1: 0.9,
    beta2: 0.9,
    useAdamW: false,
    expectedWinner: 'Momentum' as OptimizerChoice,
  },
  {
    name: 'Surprise SGD',
    description: 'Sometimes simple wins - conservative LR lets SGD avoid overshooting',
    lr: 0.003,
    beta1: 0.85,
    beta2: 0.999,
    useAdamW: false,
    expectedWinner: 'SGD' as OptimizerChoice,
  },
  {
    name: 'Chaos Mode',
    description: 'Aggressive settings - unpredictable winner!',
    lr: 0.04,
    beta1: 0.85,
    beta2: 0.95,
    useAdamW: false,
    expectedWinner: 'Adam' as OptimizerChoice,
  },
]

// Educational feedback when prediction is wrong
const getWrongPredictionFeedback = (
  predicted: OptimizerChoice,
  actual: OptimizerChoice,
  settings: { lr: number; beta1: number; beta2: number }
): string => {
  if (actual === 'Adam') {
    if (predicted === 'SGD') {
      return `Adam won because its per-dimension learning rate adaptation (via v̂ₜ) handles the curved Rosenbrock valley better than SGD's single global rate.`
    }
    return `Adam beat Momentum because with β₂=${settings.beta2.toFixed(3)}, it found the optimal per-coordinate step sizes for this ill-conditioned surface.`
  }
  if (actual === 'Momentum') {
    if (predicted === 'Adam') {
      return `Momentum won! With β₁=${settings.beta1.toFixed(2)}, the consistent acceleration beat Adam's cautious adaptation. Sometimes simpler is better.`
    }
    return `Momentum's exponential averaging (β₁=${settings.beta1.toFixed(2)}) smoothed out the gradients more effectively than vanilla SGD here.`
  }
  // SGD won
  if (predicted === 'Adam') {
    return `SGD won this round! At lr=${settings.lr.toFixed(4)}, SGD's simple updates avoided the momentum-induced overshooting that hurt the other optimizers.`
  }
  return `Vanilla SGD beat Momentum here. Sometimes the extra velocity from momentum causes overshooting in tight valleys.`
}

const getCorrectPredictionFeedback = (winner: OptimizerChoice): string => {
  if (winner === 'Adam') {
    return `Correct! Adam's adaptive learning rate (dividing by √v̂ₜ) lets it take larger steps in flat directions and smaller steps in steep ones.`
  }
  if (winner === 'Momentum') {
    return `Correct! Momentum's exponential moving average of gradients gave it the consistent push needed to navigate this surface.`
  }
  return `Correct! Sometimes vanilla SGD wins - especially when adaptive methods get confused by noisy gradient estimates.`
}

const optimizerColor = (optimizer: OptimizerChoice): string => {
  if (optimizer === 'Adam') return '#a855f7'
  if (optimizer === 'Momentum') return '#0ea5e9'
  return '#14b8a6'
}

// Educational insight based on current optimizer state
const getAdamInsight = (
  distToOpt: number,
  currentLoss: number,
  steps: number,
  beta2: number,
  effLrX: number,
  effLrY: number,
  useAdamW: boolean
): string => {
  const lrRatio = Math.max(effLrX, effLrY) / Math.min(effLrX, effLrY);

  if (steps === 0) {
    return '🚀 Click "Step once" to start! Watch how Adam adapts its learning rate per dimension while SGD uses one global rate.';
  }

  if (distToOpt < 0.05) {
    return '🎯 Converged! Adam found the minimum. Notice how the effective learning rates became nearly equal as the optimizer settled into the flat region.';
  }

  if (steps < 10) {
    if (beta2 < 0.95) {
      return '⚡ Low β₂ = faster adaptation but noiser estimates. The second moment v̂ₜ changes rapidly with each gradient.';
    }
    return '📈 Early steps: Adam is building up momentum (m̂ₜ) and estimating gradient scale (v̂ₜ). Bias correction ensures these estimates aren\'t too small.';
  }

  if (lrRatio > 5) {
    return `⚖️ Adaptive magic! Adam is using ${lrRatio.toFixed(1)}× different learning rates for x vs y. This is why it handles ill-conditioned valleys so well!`;
  }

  if (currentLoss < 0.1) {
    return '✨ Getting close! The loss is low, but the curved valley makes the last steps tricky. Notice how momentum helps smooth the trajectory.';
  }

  if (useAdamW) {
    return '🔧 AdamW in action: weight decay pulls parameters toward zero independently of the gradient. This is different from L2 regularization with vanilla Adam!';
  }

  return `💡 Step ${steps}: Watch the purple Adam path - it takes a smoother route than SGD (teal) because it adapts step size to gradient curvature.`;
};

type Point = { x: number; y: number }

interface TrajectoryState {
  x: number
  y: number
  history: Point[]
}

interface MomentumState extends TrajectoryState {
  vx: number
  vy: number
}

interface AdamState extends TrajectoryState {
  m1: number
  m2: number
  v1: number
  v2: number
  t: number
}

type AdamOptimizerDemoProps = {
  conceptId?: string
}

// Rosenbrock loss
function rosenbrock(x: number, y: number): number {
  return (1 - x) * (1 - x) + 100 * (y - x * x) * (y - x * x)
}

function safeLoss(value: number): number {
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY
}

function formatRaceLoss(value: number): string {
  return Number.isFinite(value) ? value.toFixed(4) : 'diverged'
}

// Gradient of Rosenbrock
function gradRosenbrock(x: number, y: number): [number, number] {
  const dx = -2 * (1 - x) - 400 * x * (y - x * x)
  const dy = 200 * (y - x * x)
  return [dx, dy]
}

// Coordinate transforms with NaN guard
function paramXToSvg(x: number): number {
  if (!Number.isFinite(x)) return PADDING + (LANDSCAPE_WIDTH - 2 * PADDING) / 2
  const t = (x - X_MIN) / (X_MAX - X_MIN)
  return PADDING + t * (LANDSCAPE_WIDTH - 2 * PADDING)
}

function paramYToSvg(y: number): number {
  if (!Number.isFinite(y)) return LANDSCAPE_HEIGHT - PADDING - (LANDSCAPE_HEIGHT - 2 * PADDING) / 2
  const t = (y - Y_MIN) / (Y_MAX - Y_MIN)
  return (
    LANDSCAPE_HEIGHT - PADDING - t * (LANDSCAPE_HEIGHT - 2 * PADDING)
  )
}

// Marching squares helper for contours
type Segment = { x1: number; y1: number; x2: number; y2: number }

function interpolate(
  x1: number,
  y1: number,
  v1: number,
  x2: number,
  y2: number,
  v2: number,
  level: number
): { x: number; y: number } {
  const denom = v2 - v1
  const t = Math.abs(denom) < 1e-12 ? 0.5 : (level - v1) / denom
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1),
  }
}

function computeContourSegments(
  grid: number[][],
  xs: number[],
  ys: number[],
  level: number
): Segment[] {
  const segments: Segment[] = []

  const nx = xs.length
  const ny = ys.length

  for (let i = 0; i < nx - 1; i++) {
    for (let j = 0; j < ny - 1; j++) {
      const x0 = xs[i]
      const x1 = xs[i + 1]
      const y0 = ys[j]
      const y1 = ys[j + 1]

      // corners: bottom-left, bottom-right, top-right, top-left
      const v0 = grid[i][j]
      const v1v = grid[i + 1][j]
      const v2 = grid[i + 1][j + 1]
      const v3 = grid[i][j + 1]

      const above0 = v0 >= level
      const above1 = v1v >= level
      const above2 = v2 >= level
      const above3 = v3 >= level

      const edgePoints: { x: number; y: number }[] = []

      // bottom edge: (x0, y0) -> (x1, y0)
      if (above0 !== above1) {
        edgePoints.push(interpolate(x0, y0, v0, x1, y0, v1v, level))
      }
      // right edge: (x1, y0) -> (x1, y1)
      if (above1 !== above2) {
        edgePoints.push(interpolate(x1, y0, v1v, x1, y1, v2, level))
      }
      // top edge: (x1, y1) -> (x0, y1)
      if (above2 !== above3) {
        edgePoints.push(interpolate(x1, y1, v2, x0, y1, v3, level))
      }
      // left edge: (x0, y1) -> (x0, y0)
      if (above3 !== above0) {
        edgePoints.push(interpolate(x0, y1, v3, x0, y0, v0, level))
      }

      if (edgePoints.length === 2) {
        segments.push({
          x1: edgePoints[0].x,
          y1: edgePoints[0].y,
          x2: edgePoints[1].x,
          y2: edgePoints[1].y,
        })
      } else if (edgePoints.length === 4) {
        // ambiguous saddle case: connect pairs in order
        segments.push({
          x1: edgePoints[0].x,
          y1: edgePoints[0].y,
          x2: edgePoints[1].x,
          y2: edgePoints[1].y,
        })
        segments.push({
          x1: edgePoints[2].x,
          y1: edgePoints[2].y,
          x2: edgePoints[3].x,
          y2: edgePoints[3].y,
        })
      }
    }
  }

  return segments
}

export default function AdamOptimizerDemo({ conceptId = 'adam' }: AdamOptimizerDemoProps) {
  // Shared hyperparameters
  const [learningRate, setLearningRate] = useState(0.01)
  const [beta1, setBeta1] = useState(0.9)
  const [beta2, setBeta2] = useState(0.999)
  const [useAdamW, setUseAdamW] = useState(false)

  // Initial point in the valley
  const START: Point = { x: -1.5, y: 1.5 }

  const [sgd, setSgd] = useState<TrajectoryState>({
    x: START.x,
    y: START.y,
    history: [START],
  })

  const [momentum, setMomentum] = useState<MomentumState>({
    x: START.x,
    y: START.y,
    vx: 0,
    vy: 0,
    history: [START],
  })

  const [adam, setAdam] = useState<AdamState>({
    x: START.x,
    y: START.y,
    m1: 0,
    m2: 0,
    v1: 0,
    v2: 0,
    t: 0,
    history: [START],
  })

  const [steps, setSteps] = useState(0)
  const [activeSetup, setActiveSetup] = useState<string | null>(null)

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<OptimizerChoice | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<OptimizerChoice | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [activeRacePreset, setActiveRacePreset] = useState<string | null>(null)

  // Precompute contour lines for the Rosenbrock surface
  const contourData = useMemo(() => {
    const xs: number[] = []
    const ys: number[] = []

    for (let i = 0; i < GRID_NX; i++) {
      xs.push(X_MIN + ((X_MAX - X_MIN) * i) / (GRID_NX - 1))
    }
    for (let j = 0; j < GRID_NY; j++) {
      ys.push(Y_MIN + ((Y_MAX - Y_MIN) * j) / (GRID_NY - 1))
    }

    const grid: number[][] = []
    let maxF = 0

    for (let i = 0; i < GRID_NX; i++) {
      grid[i] = []
      for (let j = 0; j < GRID_NY; j++) {
        const f = rosenbrock(xs[i], ys[j])
        grid[i][j] = f
        if (f > maxF) maxF = f
      }
    }

    // A few logarithmically spaced contour levels
    const levels = [0.1, 0.3, 1, 3, 10, 30].filter((l) => l < maxF * 0.9)

    const segmentsByLevel = levels.map((level) => ({
      level,
      segments: computeContourSegments(grid, xs, ys, level),
    }))

    return segmentsByLevel
  }, [])

  const applySetup = (setup: (typeof GUIDED_SETUPS)[number]) => {
    setLearningRate(setup.lr)
    setBeta1(setup.beta1)
    setBeta2(setup.beta2)
    setUseAdamW(setup.useAdamW)
    setActiveSetup(setup.name)

    const startPoint = { ...START }

    setSgd({
      x: startPoint.x,
      y: startPoint.y,
      history: [startPoint],
    })

    setMomentum({
      x: startPoint.x,
      y: startPoint.y,
      vx: 0,
      vy: 0,
      history: [startPoint],
    })

    setAdam({
      x: startPoint.x,
      y: startPoint.y,
      m1: 0,
      m2: 0,
      v1: 0,
      v2: 0,
      t: 0,
      history: [startPoint],
    })

    setSteps(0)
  }

  const reset = () => {
    const startPoint = { ...START }

    setSgd({
      x: startPoint.x,
      y: startPoint.y,
      history: [startPoint],
    })

    setMomentum({
      x: startPoint.x,
      y: startPoint.y,
      vx: 0,
      vy: 0,
      history: [startPoint],
    })

    setAdam({
      x: startPoint.x,
      y: startPoint.y,
      m1: 0,
      m2: 0,
      v1: 0,
      v2: 0,
      t: 0,
      history: [startPoint],
    })

    setSteps(0)
    setActiveSetup(null)
  }

  const stepOnce = () => {
    setSteps((s) => s + 1)

    // Vanilla SGD
    setSgd((prev) => {
      const [gx, gy] = gradRosenbrock(prev.x, prev.y)
      const newX = prev.x - learningRate * gx
      const newY = prev.y - learningRate * gy
      const nextPoint = { x: newX, y: newY }
      return {
        x: newX,
        y: newY,
        history: [...prev.history, nextPoint],
      }
    })

    // SGD with momentum (using β₁ as momentum coefficient to highlight the analogy)
    setMomentum((prev) => {
      const [gx, gy] = gradRosenbrock(prev.x, prev.y)
      const vx = beta1 * prev.vx - learningRate * gx
      const vy = beta1 * prev.vy - learningRate * gy
      const newX = prev.x + vx
      const newY = prev.y + vy
      const nextPoint = { x: newX, y: newY }
      return {
        x: newX,
        y: newY,
        vx,
        vy,
        history: [...prev.history, nextPoint],
      }
    })

    // Adam / AdamW
    setAdam((prev) => {
      const [gx, gy] = gradRosenbrock(prev.x, prev.y)
      const newT = prev.t + 1

      // First and second moments
      const m1 = beta1 * prev.m1 + (1 - beta1) * gx
      const m2 = beta1 * prev.m2 + (1 - beta1) * gy
      const v1 = beta2 * prev.v1 + (1 - beta2) * gx * gx
      const v2 = beta2 * prev.v2 + (1 - beta2) * gy * gy

      // Bias correction
      const beta1Pow = Math.pow(beta1, newT)
      const beta2Pow = Math.pow(beta2, newT)
      const m1Hat = m1 / (1 - beta1Pow + EPS)
      const m2Hat = m2 / (1 - beta1Pow + EPS)
      const v1Hat = v1 / (1 - beta2Pow + EPS)
      const v2Hat = v2 / (1 - beta2Pow + EPS)

      const lrEffX = learningRate / (Math.sqrt(v1Hat) + EPS)
      const lrEffY = learningRate / (Math.sqrt(v2Hat) + EPS)

      let newX = prev.x - lrEffX * m1Hat
      let newY = prev.y - lrEffY * m2Hat

      if (useAdamW) {
        // Decoupled weight decay: AdamW ≠ Adam + plain L2
        newX -= learningRate * DEFAULT_WEIGHT_DECAY * prev.x
        newY -= learningRate * DEFAULT_WEIGHT_DECAY * prev.y
      }

      const nextPoint = { x: newX, y: newY }

      return {
        x: newX,
        y: newY,
        m1,
        m2,
        v1,
        v2,
        t: newT,
        history: [...prev.history, nextPoint],
      }
    })
  }

  // Paths for trajectories
  const sgdPathD = useMemo(() => {
    if (sgd.history.length === 0) return ''
    return sgd.history
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${paramXToSvg(p.x)} ${paramYToSvg(p.y)}`
      )
      .join(' ')
  }, [sgd.history])

  const momentumPathD = useMemo(() => {
    if (momentum.history.length === 0) return ''
    return momentum.history
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${paramXToSvg(p.x)} ${paramYToSvg(p.y)}`
      )
      .join(' ')
  }, [momentum.history])

  const adamPathD = useMemo(() => {
    if (adam.history.length === 0) return ''
    return adam.history
      .map(
        (p, i) =>
          `${i === 0 ? 'M' : 'L'} ${paramXToSvg(p.x)} ${paramYToSvg(p.y)}`
      )
      .join(' ')
  }, [adam.history])

  // Adam per-dimension statistics for the bar charts
  const adamStats = useMemo(() => {
    if (adam.t === 0) {
      return {
        mHatX: 0,
        mHatY: 0,
        vHatX: 0,
        vHatY: 0,
        effLrX: learningRate,
        effLrY: learningRate,
      }
    }

    const beta1Pow = Math.pow(beta1, adam.t)
    const beta2Pow = Math.pow(beta2, adam.t)

    const mHatX = adam.m1 / (1 - beta1Pow + EPS)
    const mHatY = adam.m2 / (1 - beta1Pow + EPS)
    const vHatX = adam.v1 / (1 - beta2Pow + EPS)
    const vHatY = adam.v2 / (1 - beta2Pow + EPS)

    const effLrX = learningRate / (Math.sqrt(vHatX) + EPS)
    const effLrY = learningRate / (Math.sqrt(vHatY) + EPS)

    return { mHatX, mHatY, vHatX, vHatY, effLrX, effLrY }
  }, [adam, beta1, beta2, learningRate])

  const currentLoss = safeLoss(rosenbrock(adam.x, adam.y))
  const distanceToOptimum = Math.hypot(adam.x - OPT_X, adam.y - OPT_Y)

  // Compute losses for each optimizer at current step
  const currentLosses = useMemo(() => ({
    SGD: safeLoss(rosenbrock(sgd.x, sgd.y)),
    Momentum: safeLoss(rosenbrock(momentum.x, momentum.y)),
    Adam: safeLoss(rosenbrock(adam.x, adam.y)),
  }), [sgd.x, sgd.y, momentum.x, momentum.y, adam.x, adam.y])

  // Determine race winner (lowest loss)
  const raceWinner = useMemo((): OptimizerChoice => {
    const { SGD: lSGD, Momentum: lMom, Adam: lAdam } = currentLosses
    if (lSGD <= lMom && lSGD <= lAdam) return 'SGD'
    if (lMom <= lAdam) return 'Momentum'
    return 'Adam'
  }, [currentLosses])

  const sortedRaceLosses = useMemo(
    () =>
      (Object.entries(currentLosses) as Array<[OptimizerChoice, number]>).sort(
        (a, b) => a[1] - b[1]
      ),
    [currentLosses]
  )

  const runnerUp = sortedRaceLosses[1]?.[0] ?? raceWinner
  const winnerLoss = sortedRaceLosses[0]?.[1] ?? currentLosses[raceWinner]
  const runnerUpLoss = sortedRaceLosses[1]?.[1] ?? winnerLoss
  const winnerGap =
    Number.isFinite(runnerUpLoss) && Number.isFinite(winnerLoss)
      ? Math.max(0, runnerUpLoss - winnerLoss)
      : Number.POSITIVE_INFINITY
  const winnerGapRatio = winnerLoss > EPS ? runnerUpLoss / winnerLoss : Infinity

  // Apply a race preset
  const applyRacePreset = useCallback((preset: typeof RACE_PRESETS[number]) => {
    setLearningRate(preset.lr)
    setBeta1(preset.beta1)
    setBeta2(preset.beta2)
    setUseAdamW(preset.useAdamW)
    setActiveRacePreset(preset.name)
    setActiveSetup(null)

    const startPoint = { ...START }
    setSgd({ x: startPoint.x, y: startPoint.y, history: [startPoint] })
    setMomentum({ x: startPoint.x, y: startPoint.y, vx: 0, vy: 0, history: [startPoint] })
    setAdam({ x: startPoint.x, y: startPoint.y, m1: 0, m2: 0, v1: 0, v2: 0, t: 0, history: [startPoint] })
    setSteps(0)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- START is a constant
  }, [])

  // Start the race
  const startRace = useCallback(() => {
    if (!prediction) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction])

  // Reset everything
  const resetGame = useCallback(() => {
    const startPoint = { ...START }
    setSgd({ x: startPoint.x, y: startPoint.y, history: [startPoint] })
    setMomentum({ x: startPoint.x, y: startPoint.y, vx: 0, vy: 0, history: [startPoint] })
    setAdam({ x: startPoint.x, y: startPoint.y, m1: 0, m2: 0, v1: 0, v2: 0, t: 0, history: [startPoint] })
    setSteps(0)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setActiveRacePreset(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- START is a constant
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 800)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('running')
    }
  }, [gamePhase, countdown])

  // Auto-run during race
  useEffect(() => {
    if (gamePhase !== 'running') return
    if (steps >= FINISH_STEP) {
      setGamePhase('revealed')
      return
    }
    const timer = setTimeout(() => stepOnce(), 80)
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stepOnce is stable within each gamePhase
  }, [gamePhase, steps])

  // Check if prediction was correct
  const predictionCorrect = lockedPrediction === raceWinner
  const raceOutcomeVisible = gamePhase === 'revealed'
  const raceOutcomeLocked = Boolean(lockedPrediction) && !raceOutcomeVisible
  const visibleLossSummary = raceOutcomeLocked
    ? `hidden until reveal; learner locked ${lockedPrediction}`
    : `SGD=${formatRaceLoss(currentLosses.SGD)}, Momentum=${formatRaceLoss(currentLosses.Momentum)}, Adam=${formatRaceLoss(currentLosses.Adam)}`
  const visibleWinnerSummary = raceOutcomeLocked ? 'hidden until reveal' : raceWinner

  // Helpers for moment and variance bar charts
  const renderMomentBars = () => {
    const WIDTH = 220
    const HEIGHT = 90
    const baseline = HEIGHT / 2

    const { mHatX, mHatY } = adamStats
    const values = [mHatX, mHatY]
    const maxAbs = Math.max(Math.abs(mHatX), Math.abs(mHatY), 1e-6)
    const dims = ['x', 'y'] as const

    return (
      <svg
        width={WIDTH}
        height={HEIGHT}
        className="adam-moment-chart"
        role="img"
        aria-label="First moment (momentum) estimates per dimension"
      >
        <line
          x1={0}
          y1={baseline}
          x2={WIDTH}
          y2={baseline}
          className="axis-line"
        />
        {dims.map((dim, i) => {
          const val = values[i]
          const barWidth = 26
          const centerX = 60 + i * 70
          const height = (Math.abs(val) / maxAbs) * (HEIGHT / 2 - 12)
          const isPositive = val >= 0
          const y = isPositive ? baseline - height : baseline
          return (
            <g key={dim}>
              <rect
                x={centerX - barWidth / 2}
                y={y}
                width={barWidth}
                height={height}
                fill={MATH_COLORS.primary}
                className="adam-bar adam-bar-m"
              />
              <text
                x={centerX}
                y={HEIGHT - 6}
                textAnchor="middle"
                className="axis-label"
              >
                {dim}
              </text>
            </g>
          )
        })}
        <text
          x={8}
          y={16}
          className="caption tiny"
        >
          m̂ₜ (momentum-like)
        </text>
      </svg>
    )
  }

  const renderVarianceBars = () => {
    const WIDTH = 220
    const HEIGHT = 90
    const bottom = HEIGHT - 16

    const { vHatX, vHatY } = adamStats
    const values = [vHatX, vHatY]
    const maxVal = Math.max(vHatX, vHatY, 1e-8)
    const dims = ['x', 'y'] as const

    return (
      <svg
        width={WIDTH}
        height={HEIGHT}
        className="adam-variance-chart"
        role="img"
        aria-label="Second moment (squared gradient) estimates per dimension"
      >
        <line
          x1={0}
          y1={bottom}
          x2={WIDTH}
          y2={bottom}
          className="axis-line"
        />
        {dims.map((dim, i) => {
          const val = values[i]
          const barWidth = 26
          const centerX = 60 + i * 70
          const height = (val / maxVal) * (HEIGHT - 30)
          const y = bottom - height
          return (
            <g key={dim}>
              <rect
                x={centerX - barWidth / 2}
                y={y}
                width={barWidth}
                height={height}
                fill={MATH_COLORS.secondary}
                className="adam-bar adam-bar-v"
              />
              <text
                x={centerX}
                y={HEIGHT - 4}
                textAnchor="middle"
                className="axis-label"
              >
                {dim}
              </text>
            </g>
          )
        })}
        <text
          x={8}
          y={16}
          className="caption tiny"
        >
          v̂ₜ (RMS-like)
        </text>
      </svg>
    )
  }

  const { effLrX, effLrY } = adamStats
  const effLrRatio = Math.max(effLrX, effLrY) / Math.max(Math.min(effLrX, effLrY), EPS)

  const winnerMechanism = useMemo(() => {
    if (raceWinner === 'Adam') {
      return `Adam won by adapting per-coordinate step sizes; the current effective LR ratio is ${effLrRatio.toFixed(2)}x, so the steep and flat directions are not forced to share one step scale.`
    }
    if (raceWinner === 'Momentum') {
      return `Momentum won by turning repeated gradients into velocity; with beta1=${beta1.toFixed(2)}, the accumulated push beat Adam's more cautious RMS normalization.`
    }
    return `SGD won because the global step stayed conservative enough to avoid the extra momentum or adaptive overshoot used by the other optimizers.`
  }, [beta1, effLrRatio, raceWinner])

  useEffect(() => {
    emitDemoState({
      conceptId,
      label: 'Adam optimizer race state',
      summary: `${activeRacePreset ?? activeSetup ?? 'manual'} setup; ${gamePhase} phase at step ${steps}/${FINISH_STEP}; hyperparameters lr=${learningRate.toFixed(4)}, beta1=${beta1.toFixed(3)}, beta2=${beta2.toFixed(3)}, AdamW=${useAdamW ? 'on' : 'off'}; race losses ${visibleLossSummary}; winner ${visibleWinnerSummary}; Adam loss ${formatRaceLoss(currentLoss)} at (${adam.x.toFixed(3)}, ${adam.y.toFixed(3)}), effective LR ratio ${effLrRatio.toFixed(2)}x.${raceOutcomeVisible ? ` ${winnerMechanism}` : ''}`,
      values: [
        `race/setup: ${activeRacePreset ?? activeSetup ?? 'manual exploration'}`,
        `prediction state: phase=${gamePhase}, selected=${prediction ?? 'none'}, locked=${lockedPrediction ?? 'none'}`,
        `winner revealed: ${raceOutcomeVisible ? 'yes' : 'no'}`,
        `prediction correct: ${raceOutcomeVisible && lockedPrediction ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `steps: ${steps}/${FINISH_STEP}`,
        `hyperparameters: lr=${learningRate.toFixed(4)}, beta1=${beta1.toFixed(3)}, beta2=${beta2.toFixed(3)}, AdamW=${useAdamW ? 'on' : 'off'}`,
        `losses: ${visibleLossSummary}`,
        `current winner: ${visibleWinnerSummary}`,
        `winner gap: ${raceOutcomeVisible ? `${formatRaceLoss(winnerGap)} vs ${runnerUp}; ratio=${Number.isFinite(winnerGapRatio) ? `${winnerGapRatio.toFixed(2)}x` : 'infinite'}` : 'hidden until reveal'}`,
        `winner mechanism: ${raceOutcomeVisible ? winnerMechanism : 'hidden until reveal'}`,
        `Adam state: x=${adam.x.toFixed(3)}, y=${adam.y.toFixed(3)}, loss=${formatRaceLoss(currentLoss)}, distance=${distanceToOptimum.toFixed(4)}`,
        `Adam effective learning rates: x=${effLrX.toExponential(2)}, y=${effLrY.toExponential(2)}, ratio=${effLrRatio.toFixed(2)}x`,
      ],
    })
  }, [
    activeRacePreset,
    activeSetup,
    adam.x,
    adam.y,
    beta1,
    beta2,
    conceptId,
    currentLoss,
    currentLosses.Adam,
    currentLosses.Momentum,
    currentLosses.SGD,
    distanceToOptimum,
    effLrRatio,
    effLrX,
    effLrY,
    gamePhase,
    learningRate,
    lockedPrediction,
    prediction,
    predictionCorrect,
    raceWinner,
    raceOutcomeVisible,
    runnerUp,
    steps,
    useAdamW,
    visibleLossSummary,
    visibleWinnerSummary,
    winnerGap,
    winnerGapRatio,
    winnerMechanism,
  ])

  return (
    <section className="card interactive-card">
      <h2>🏁 Optimizer Race: Adam vs SGD vs Momentum</h2>
      <p className="muted">
        Predict which optimizer will have the lowest loss after {FINISH_STEP} steps on
        the Rosenbrock valley. Test your intuition!
      </p>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        {/* Race preset selection */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #b8b0a0)', marginRight: '8px' }}>
            Pick a race scenario:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {RACE_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => applyRacePreset(preset)}
                disabled={gamePhase === 'running' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeRacePreset === preset.name
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'rgba(139, 92, 246, 0.1)',
                  border: `1px solid ${activeRacePreset === preset.name ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                  borderRadius: '6px',
                  color: 'var(--text-primary, #f5f0e1)',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'running' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'running' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={preset.description}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase - make prediction */}
        {gamePhase === 'setup' && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary, #f5f0e1)' }}>
              🎯 <strong>Who will win?</strong> (lowest loss at step {FINISH_STEP})
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['SGD', 'Momentum', 'Adam'] as OptimizerChoice[]).map(opt => (
                <button
                  key={opt}
                  onClick={() => setPrediction(opt)}
                  style={{
                    padding: '10px 20px',
                    background: prediction === opt
                      ? opt === 'Adam' ? 'rgba(168, 85, 247, 0.4)'
                        : opt === 'Momentum' ? 'rgba(14, 165, 233, 0.4)'
                        : 'rgba(20, 184, 166, 0.4)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${prediction === opt
                      ? opt === 'Adam' ? '#a855f7' : opt === 'Momentum' ? '#0ea5e9' : '#14b8a6'
                      : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: 'var(--text-primary, #f5f0e1)',
                    fontSize: '0.95rem',
                    fontWeight: prediction === opt ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {opt === 'Adam' ? '🟣 Adam' : opt === 'Momentum' ? '🔵 Momentum' : '🟢 SGD'}
                </button>
              ))}
            </div>
            <button
              onClick={startRace}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #8b5cf6, #6366f1)'
                  : 'rgba(139, 92, 246, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : 'var(--text-secondary)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              🏁 Start Race!
            </button>
          </div>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#8b5cf6',
              textShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
              animation: 'pulse 0.8s ease-in-out',
            }}>
              {countdown === 0 ? 'GO!' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Your pick: <strong style={{ color: lockedPrediction === 'Adam' ? '#a855f7' : lockedPrediction === 'Momentum' ? '#0ea5e9' : '#14b8a6' }}>
                {lockedPrediction}
              </strong>
            </p>
          </div>
        )}

        {/* Running phase */}
        {gamePhase === 'running' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-primary, #f5f0e1)', marginBottom: '8px' }}>
              ⚡ Race in progress... Step {steps}/{FINISH_STEP}
            </p>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: lockedPrediction === 'Adam' ? 'rgba(168, 85, 247, 0.2)'
                : lockedPrediction === 'Momentum' ? 'rgba(14, 165, 233, 0.2)'
                : 'rgba(20, 184, 166, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
            }}>
              Your pick: <strong>{lockedPrediction}</strong>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Winner hidden until step {FINISH_STEP}. Watch the paths, but do not use the scoreboard yet.
            </div>
            <div className="adam-race-progress" aria-hidden="true">
              <i style={{ width: `${Math.max(4, (steps / FINISH_STEP) * 100)}%` }} />
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
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f5f0e1)' }}>
                Winner: <strong style={{
                  color: optimizerColor(raceWinner)
                }}>{raceWinner}</strong>
                {' '}with loss {formatRaceLoss(currentLosses[raceWinner])}
              </div>
              <div className="adam-winner-gap">
                Gap to {runnerUp}: {formatRaceLoss(winnerGap)}
                {' '}({Number.isFinite(winnerGapRatio) ? `${winnerGapRatio.toFixed(2)}x lower loss` : 'winner reached zero loss'})
              </div>
            </div>
            <div className="adam-loss-table" aria-label="Final optimizer race losses">
              {sortedRaceLosses.map(([optimizer, optimizerLoss], index) => (
                <div key={optimizer} className={index === 0 ? 'winner' : ''}>
                  <span>
                    <i style={{ background: optimizerColor(optimizer) }} />
                    {optimizer}
                  </span>
                  <strong>{formatRaceLoss(optimizerLoss)}</strong>
                </div>
              ))}
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary, #b8b0a0)',
            }}>
              💡 {predictionCorrect
                ? getCorrectPredictionFeedback(raceWinner)
                : getWrongPredictionFeedback(lockedPrediction!, raceWinner, { lr: learningRate, beta1, beta2 })}
              {' '}
              {winnerMechanism}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f5f0e1)',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Another Race
            </button>
          </div>
        )}
      </div>

      <details style={{ marginBottom: '1rem' }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary, #b8b0a0)' }}>
          📚 Manual exploration mode
        </summary>
        <div style={{ paddingTop: '12px' }}>

      <div className="guided-prompts">
        <span className="guided-label">Try:</span>
        {GUIDED_SETUPS.map((setup) => (
          <button
            key={setup.name}
            className={`guided-btn ${
              activeSetup === setup.name ? 'active' : ''
            }`}
            onClick={() => applySetup(setup)}
            title={setup.description}
          >
            {setup.name}
          </button>
        ))}
      </div>
      {activeSetup && (
        <p className="guided-description">
          {GUIDED_SETUPS.find((s) => s.name === activeSetup)?.description}
        </p>
      )}

      {/* Dynamic Educational Insight */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: distanceToOptimum < 0.05
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
          : steps < 10
            ? 'linear-gradient(135deg, rgba(14, 165, 233, 0.12), rgba(14, 165, 233, 0.05))'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.05))',
        border: `1px solid ${distanceToOptimum < 0.05 ? '#22c55e' : steps < 10 ? '#0ea5e9' : '#8b5cf6'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getAdamInsight(distanceToOptimum, currentLoss, steps, beta2, effLrX, effLrY, useAdamW)}
      </div>

      <div className="adam-layout">
        {/* 2D loss landscape and trajectories */}
        <svg
          width={LANDSCAPE_WIDTH}
          height={LANDSCAPE_HEIGHT}
          className="adam-landscape-chart"
          role="img"
          aria-label="Rosenbrock loss landscape with optimizer trajectories"
        >
          {/* Axes */}
          <line
            x1={paramXToSvg(X_MIN)}
            y1={paramYToSvg(OPT_Y)}
            x2={paramXToSvg(X_MAX)}
            y2={paramYToSvg(OPT_Y)}
            className="axis-line"
          />
          <line
            x1={paramXToSvg(OPT_X)}
            y1={paramYToSvg(Y_MIN)}
            x2={paramXToSvg(OPT_X)}
            y2={paramYToSvg(Y_MAX)}
            className="axis-line"
          />

          {/* Contour lines */}
          {contourData.map(({ level, segments }) => (
            <g key={level} className="adam-contour-group">
              {segments.map((seg, i) => (
                <line
                  key={i}
                  x1={paramXToSvg(seg.x1)}
                  y1={paramYToSvg(seg.y1)}
                  x2={paramXToSvg(seg.x2)}
                  y2={paramYToSvg(seg.y2)}
                  className="adam-contour"
                />
              ))}
            </g>
          ))}

          {/* SGD trajectory */}
          {sgdPathD && (
            <path
              d={sgdPathD}
              className="adam-path sgd"
              fill="none"
              stroke={MATH_COLORS.secondary}
            />
          )}
          {/* SGD+Momentum trajectory */}
          {momentumPathD && (
            <path
              d={momentumPathD}
              className="adam-path momentum"
              fill="none"
              stroke={MATH_COLORS.primary}
            />
          )}
          {/* Adam / AdamW trajectory */}
          {adamPathD && (
            <path
              d={adamPathD}
              className="adam-path adam"
              fill="none"
              stroke={MATH_COLORS.accent}
            />
          )}

          {/* Current positions */}
          <circle
            cx={paramXToSvg(sgd.x)}
            cy={paramYToSvg(sgd.y)}
            r={4}
            className="adam-point sgd"
            fill={MATH_COLORS.secondary}
          />
          <circle
            cx={paramXToSvg(momentum.x)}
            cy={paramYToSvg(momentum.y)}
            r={4.5}
            className="adam-point momentum"
            fill={MATH_COLORS.primary}
          />
          <circle
            cx={paramXToSvg(adam.x)}
            cy={paramYToSvg(adam.y)}
            r={5}
            className="adam-point adam"
            fill={MATH_COLORS.accent}
          />

          {/* Optimum marker */}
          <circle
            cx={paramXToSvg(OPT_X)}
            cy={paramYToSvg(OPT_Y)}
            r={4}
            className="adam-optimum"
          />
        </svg>

        {/* Right side: controls and per-dimension dynamics */}
        <div className="adam-side-panel">
          <div className="adam-controls">
            <label className="slider-label">
              Learning rate α ({learningRate.toFixed(3)})
              <input
                type="range"
                min={0.001}
                max={0.1}
                step={0.001}
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label">
              β₁ (momentum) ({beta1.toFixed(2)})
              <input
                type="range"
                min={0.8}
                max={0.99}
                step={0.01}
                value={beta1}
                onChange={(e) => setBeta1(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label">
              β₂ (second moment) ({beta2.toFixed(3)})
              <input
                type="range"
                min={0.9}
                max={0.999}
                step={0.001}
                value={beta2}
                onChange={(e) => setBeta2(parseFloat(e.target.value))}
              />
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={useAdamW}
                onChange={(e) => setUseAdamW(e.target.checked)}
              />
              <span>Use AdamW (decoupled weight decay)</span>
            </label>

            <div className="adam-buttons">
              <button onClick={stepOnce}>Step once</button>
              <button onClick={reset} className="ghost">
                Reset
              </button>
            </div>

            <p className="caption">
              Adam combines momentum (m̂ₜ) and RMS-style scaling (v̂ₜ). Bias
              correction keeps early steps from being too small; β₂ controls how
              quickly v̂ₜ adapts to gradient scale.
            </p>
          </div>

          <div className="adam-dynamics-panel">
            {renderMomentBars()}
            {renderVarianceBars()}
            <div className="adam-effective-lr">
              <div className="metric-row">
                <span className="label">Effective lr (x):</span>
                <span>{effLrX.toExponential(2)}</span>
              </div>
              <div className="metric-row">
                <span className="label">Effective lr (y):</span>
                <span>{effLrY.toExponential(2)}</span>
              </div>
              <p className="caption tiny">
                Adam rescales each coordinate by 1/√v̂ₜ. In ill-conditioned
                valleys, this shrinks steps along steep directions while letting
                shallow ones move further.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics + legend */}
      <div className="adam-footer">
        <div className="adam-metrics">
          <div className="metric-row">
            <span className="label">Step:</span> <span>{steps}</span>
          </div>
          <div className="metric-row">
            <span className="label">Adam loss f(x,y):</span>
            <span>{formatRaceLoss(currentLoss)}</span>
          </div>
          <div className="metric-row">
            <span className="label">Distance to optimum:</span>
            <span>{distanceToOptimum.toFixed(3)}</span>
          </div>
          <div className="metric-row">
            <span className="label">Adam type:</span>
            <span>{useAdamW ? 'AdamW (with decay)' : 'Adam'}</span>
          </div>
          {useAdamW && (
            <div className="metric-row tiny">
              <span className="label">Weight decay λ:</span>
              <span>{DEFAULT_WEIGHT_DECAY.toFixed(3)}</span>
            </div>
          )}
        </div>
        <div className="adam-legend">
          <div className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: MATH_COLORS.secondary }}
            />
            <span>SGD</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: MATH_COLORS.primary }}
            />
            <span>SGD + momentum (β₁)</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-swatch"
              style={{ background: MATH_COLORS.accent }}
            />
            <span>{useAdamW ? 'AdamW' : 'Adam'}</span>
          </div>
        </div>
      </div>

      <p className="caption">
        Things to notice: SGD zig-zags across the narrow valley; adding momentum
        straightens the path but still shares one global learning rate. Adam
        adapts per-parameter step sizes via v̂ₜ, which helps on ill-conditioned
        surfaces but can overfit or even diverge on simple convex problems when
        tuned too aggressively. AdamW further decouples weight decay from the
        adaptive step, so it is not the same as &quot;Adam + L2&quot;.
      </p>

        </div>
      </details>

      <style jsx>{`
        .interactive-card {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
        }
        .interactive-card h2 {
          font-size: 1.2rem;
          margin: 0 0 0.5rem;
          color: var(--text-primary, #f5f0e1);
        }
        .muted {
          color: var(--text-secondary, #b8b0a0);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }
        .guided-prompts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          margin-bottom: 0.75rem;
        }
        .guided-label {
          font-size: 0.85rem;
          color: var(--text-secondary, #b8b0a0);
        }
        .guided-btn {
          padding: 0.35rem 0.75rem;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 6px;
          color: var(--text-primary, #f5f0e1);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }
        .guided-btn:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.5);
        }
        .guided-btn.active {
          background: rgba(245, 158, 11, 0.3);
          border-color: #f59e0b;
        }
        .guided-description {
          font-size: 0.85rem;
          color: var(--text-secondary, #b8b0a0);
          margin: 0 0 1rem;
          padding: 0.5rem;
          background: rgba(245, 158, 11, 0.05);
          border-radius: 6px;
        }
        .adam-race-progress {
          width: min(360px, 100%);
          height: 7px;
          margin: 12px auto 0;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.1);
        }
        .adam-race-progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #14b8a6, #0ea5e9, #a855f7);
          transition: width 120ms ease;
        }
        .adam-winner-gap {
          margin-top: 0.35rem;
          color: var(--text-secondary, #b8b0a0);
          font-size: 0.78rem;
        }
        .adam-loss-table {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
          margin: 0 0 0.75rem;
        }
        .adam-loss-table div {
          min-width: 0;
          padding: 0.55rem 0.65rem;
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.18);
        }
        .adam-loss-table div.winner {
          border-color: rgba(34, 197, 94, 0.46);
          background: rgba(34, 197, 94, 0.1);
        }
        .adam-loss-table span,
        .adam-loss-table strong {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          min-width: 0;
        }
        .adam-loss-table span {
          color: var(--text-secondary, #b8b0a0);
          font-size: 0.74rem;
        }
        .adam-loss-table strong {
          margin-top: 0.22rem;
          color: var(--text-primary, #f5f0e1);
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          overflow-wrap: anywhere;
        }
        .adam-loss-table i {
          width: 8px;
          height: 8px;
          flex: none;
          border-radius: 999px;
        }
        .adam-layout {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .adam-landscape-chart {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          flex-shrink: 0;
        }
        .axis-line {
          stroke: rgba(245, 158, 11, 0.2);
          stroke-width: 1;
        }
        .adam-contour {
          stroke: rgba(245, 158, 11, 0.4);
          stroke-width: 1;
        }
        .adam-path {
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
        }
        .adam-path.sgd {
          stroke-dasharray: 4 2;
        }
        .adam-point {
          stroke: rgba(0, 0, 0, 0.5);
          stroke-width: 1;
        }
        .adam-optimum {
          fill: none;
          stroke: #22c55e;
          stroke-width: 2;
        }
        .adam-side-panel {
          flex: 1;
          min-width: 220px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .adam-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .slider-label {
          display: flex;
          flex-direction: column;
          font-size: 0.8rem;
          color: var(--text-secondary, #b8b0a0);
        }
        .slider-label input {
          margin-top: 0.25rem;
          accent-color: #f59e0b;
        }
        .toggle-label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-secondary, #b8b0a0);
          cursor: pointer;
        }
        .toggle-label input {
          accent-color: #f59e0b;
        }
        .adam-buttons {
          display: flex;
          gap: 0.5rem;
          margin-top: 0.5rem;
        }
        .adam-buttons button {
          padding: 0.5rem 1rem;
          background: linear-gradient(135deg, #f59e0b, #d97706);
          border: none;
          border-radius: 6px;
          color: #0a0a0a;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .adam-buttons button:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }
        .adam-buttons button.ghost {
          background: transparent;
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: var(--text-primary, #f5f0e1);
        }
        .adam-buttons button.ghost:hover {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.1);
        }
        .caption {
          font-size: 0.8rem;
          color: var(--text-secondary, #b8b0a0);
          line-height: 1.5;
        }
        .caption.tiny {
          font-size: 0.7rem;
        }
        .adam-dynamics-panel {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .adam-moment-chart,
        .adam-variance-chart {
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
        }
        .adam-bar {
          opacity: 0.8;
        }
        .adam-effective-lr {
          padding: 0.5rem;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 6px;
        }
        .metric-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          padding: 0.15rem 0;
        }
        .metric-row .label {
          color: var(--text-secondary, #b8b0a0);
        }
        .metric-row.tiny {
          font-size: 0.7rem;
        }
        .adam-footer {
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 1rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(245, 158, 11, 0.15);
        }
        .adam-metrics {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }
        .adam-legend {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          align-items: center;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
        }
        .legend-swatch {
          width: 16px;
          height: 4px;
          border-radius: 2px;
        }
        .axis-label {
          font-size: 10px;
          fill: var(--text-secondary, #b8b0a0);
        }
        @media (max-width: 640px) {
          .interactive-card {
            padding: 1rem;
          }
          .adam-loss-table {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
