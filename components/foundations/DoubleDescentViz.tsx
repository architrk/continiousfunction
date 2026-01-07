import { useMemo, useState, useCallback, useEffect } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

const PARAM_MIN = 8
const PARAM_MAX = 8192

const MAIN_WIDTH = 360
const MAIN_HEIGHT = 220
const MAIN_PADDING = 32

const BIAS_WIDTH = 360
const BIAS_HEIGHT = 180
const BIAS_PADDING = 28

const TOY_WIDTH = 340
const TOY_HEIGHT = 220
const TOY_PADDING = 28

// Fun presets for exploring double descent
const DOUBLE_DESCENT_PRESETS = [
  { name: '🔬 Classic Setup', capacity: 0.45, nTrain: 16, noise: 0.35, description: 'Standard double descent curve' },
  { name: '📊 Low Noise', capacity: 0.45, nTrain: 16, noise: 0.1, description: 'Less noise = smaller variance spike' },
  { name: '🌊 High Noise', capacity: 0.45, nTrain: 16, noise: 0.8, description: 'Lots of noise = dramatic spike' },
  { name: '👥 Few Points', capacity: 0.3, nTrain: 8, noise: 0.35, description: 'Early interpolation threshold' },
  { name: '📈 Many Points', capacity: 0.6, nTrain: 28, noise: 0.35, description: 'Late interpolation threshold' },
];

// Regime presets to jump to specific regions
const REGIME_PRESETS = [
  { name: '⬅️ Underfit', capacity: 0.15, description: 'Classical regime: high bias, low variance' },
  { name: '⚠️ At Threshold', capacity: 0.45, description: 'Interpolation threshold: variance spike!' },
  { name: '➡️ Overfit', capacity: 0.85, description: 'Modern regime: implicit regularization saves us' },
];

// Prediction game types
type PredictionChoice = 'up' | 'down'
type GamePhase = 'setup' | 'countdown' | 'animating' | 'revealed'

// Challenge scenarios for the prediction game
const CHALLENGE_SCENARIOS = [
  { name: '🔬 Classical Trap', startCapacity: 0.2, description: 'Starting in the classical regime...' },
  { name: '⚡ Near Threshold', startCapacity: 0.38, description: 'Almost at the dangerous zone...' },
  { name: '🎢 Riding the Spike', startCapacity: 0.55, description: 'Just past the threshold...' },
  { name: '🌊 Deep Overfit', startCapacity: 0.75, description: 'Well into overparameterization...' },
]

// Educational feedback for predictions
const getPredictionFeedback = (
  prediction: PredictionChoice,
  actual: 'up' | 'down' | 'same',
  startCapacity: number,
  endCapacity: number,
  startRatio: number,
  endRatio: number
): string => {
  const wasCorrect = prediction === actual || (prediction === 'down' && actual === 'same')

  if (startRatio < 0.7 && endRatio < 1.0) {
    // Classical regime → approaching threshold
    if (wasCorrect) {
      return `Correct! In the classical regime, adding parameters initially improves bias but then variance starts to dominate as you approach the interpolation threshold.`
    }
    return `Not quite! Here, more parameters means higher variance. You're in the "textbook" regime where classical ML wisdom applies.`
  }

  if (startRatio >= 0.7 && startRatio < 1.5 && endRatio > 1.0) {
    // Through the threshold
    if (actual === 'up') {
      if (wasCorrect) {
        return `Exactly! Near the threshold, variance spikes dramatically. The model can fit the data in many wildly different ways.`
      }
      return `Tricky! Right at the threshold, variance peaks. Classical wisdom correctly predicts overfitting here, but wait - keep adding parameters...`
    }
    if (wasCorrect) {
      return `Correct! You've crossed the threshold. Now we're in the "benign overfitting" regime where more parameters actually helps!`
    }
    return `Surprise! Past the threshold, SGD picks low-norm solutions that generalize better. This is the modern "deep learning" regime.`
  }

  if (startRatio > 1.5) {
    // Deep overparameterized regime
    if (wasCorrect) {
      return `Correct! Deep in the overparameterized regime, test error continues decreasing. Implicit regularization via SGD prefers simple solutions.`
    }
    return `Counter-intuitive! In deep overparameterization, more parameters = better generalization. SGD's inductive bias toward simple solutions saves us.`
  }

  // Generic fallback
  if (wasCorrect) {
    return `Correct! You understand double descent well.`
  }
  return `Double descent is counter-intuitive! Test error doesn't monotonically increase with model size past the interpolation threshold.`
}

// Educational insight based on current state
const getDoubleDescentInsight = (
  ratio: number,
  testError: number,
  trainError: number,
  noiseLevel: number,
  toyRegime: 'under' | 'interpolation' | 'over'
): string => {
  if (ratio < 0.5) {
    return '📚 Classical regime: Not enough parameters to fit the data well. High bias, but variance is controlled. The textbook says stop here!';
  }

  if (ratio >= 0.5 && ratio < 0.85) {
    return '📈 Approaching the threshold... As parameters approach the number of training points, the model starts memorizing. Variance is rising.';
  }

  if (ratio >= 0.85 && ratio <= 1.3) {
    if (noiseLevel > 0.5) {
      return '💥 INTERPOLATION THRESHOLD! The model can exactly fit training data in many wildly different ways. High noise makes this spike dramatic!';
    }
    return '⚠️ At the interpolation threshold! Variance spikes because there are many equally good (training-wise) but very different solutions.';
  }

  if (ratio > 1.3 && ratio <= 3) {
    return '🔄 Entering overparameterized regime... More parameters than data points, but SGD picks low-norm solutions that generalize better.';
  }

  if (ratio > 3) {
    if (testError < trainError + 0.05) {
      return '✨ Deep overparameterization! Surprisingly, test error decreased again. Implicit regularization via SGD prefers simple solutions.';
    }
    return '🎯 Far into overparameterized territory. The "benign overfitting" regime where huge models can still generalize.';
  }

  return '💡 Double descent challenges the classical bias-variance tradeoff narrative.';
};

const X_DOMAIN_MIN = -1
const X_DOMAIN_MAX = 1

type ErrorComponents = {
  bias2: number
  variance: number
  noise: number
  testError: number
  trainError: number
  ratio: number
  params: number
}

type DoubleDescentPoint = {
  capacity: number
  params: number
  xNorm: number
  bias2: number
  variance: number
  noise: number
  testError: number
  trainError: number
}

type Interpolator = (x: number) => number

function clamp01(v: number): number {
  if (v < 0) return 0
  if (v > 1) return 1
  return v
}

function capacityToParams(capacity: number): number {
  const c = clamp01(capacity)
  const ratio = PARAM_MAX / PARAM_MIN
  return PARAM_MIN * Math.pow(ratio, c)
}

function paramsToCapacity(params: number): number {
  const ratio = PARAM_MAX / PARAM_MIN
  const scaled = params / PARAM_MIN
  if (scaled <= 0) return 0
  const t = Math.log(scaled) / Math.log(ratio)
  return clamp01(t)
}

function capacityToDegree(
  capacity: number,
  minDegree: number,
  maxDegree: number
): number {
  const t = clamp01(capacity)
  return Math.round(minDegree + t * (maxDegree - minDegree))
}

// “Ground truth” function for the toy regression demo
function targetFunction(x: number): number {
  return 0.3 * x * x * x - 0.5 * x + 0.3 * Math.sin(3 * x)
}

// Deterministic “noise” so the visualization is stable.
function deterministicNoise(x: number, index: number, noiseLevel: number): number {
  if (noiseLevel <= 0) return 0
  const base =
    Math.sin(7 * x + index * 1.3) + Math.cos(3.3 * x - index * 0.5)
  return noiseLevel * 0.25 * base
}

// Smooth toy model of bias–variance–noise and double descent.
// This is not a precise theorem, but a pedagogical shape model.
function computeErrorComponents(
  capacity: number,
  nTrain: number,
  noiseLevel: number
): ErrorComponents {
  const params = capacityToParams(capacity)
  const ratio = params / Math.max(1, nTrain)

  // Irreducible noise contribution
  const noise = 0.08 + 0.5 * noiseLevel

  // Bias^2 shrinks as model capacity increases
  const bias2 = 0.7 * Math.exp(-2.2 * capacity)

  // Classical variance that grows with capacity
  const classicalVar = 0.03 + 0.4 * capacity

  // Big spike in variance around the interpolation threshold (ratio ≈ 1)
  const spikeWidth = 0.22
  const spike =
    0.9 *
    noiseLevel *
    Math.exp(-0.5 * Math.pow((ratio - 1) / spikeWidth, 2))

  // Overparameterized regime: variance drops again
  const overParamFactor =
    ratio <= 1 ? 1 + 0.6 * ratio * ratio : 1.6 / (1 + 1.2 * (ratio - 1))

  const variance = classicalVar * overParamFactor + spike

  // Test error follows the bias–variance–noise decomposition
  const testError = bias2 + variance + noise

  // Training error monotonically decreases with capacity
  const trainError = Math.max(
    0.02,
    (0.9 + 0.6 * noiseLevel) * Math.exp(-3.5 * capacity)
  )

  return { bias2, variance, noise, testError, trainError, ratio, params }
}

function buildLinePath(
  points: DoubleDescentPoint[],
  ySelector: (p: DoubleDescentPoint) => number,
  xToSvg: (t: number) => number,
  yToSvg: (v: number) => number
): string {
  if (points.length === 0) return ''
  return points
    .map(
      (p, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xToSvg(p.xNorm)} ${yToSvg(
          ySelector(p)
        )}`
    )
    .join(' ')
}

function buildStackedAreaPath(
  points: DoubleDescentPoint[],
  top: (p: DoubleDescentPoint) => number,
  bottom: (p: DoubleDescentPoint) => number,
  xToSvg: (t: number) => number,
  yToSvg: (v: number) => number
): string {
  const n = points.length
  if (!n) return ''
  let d = `M ${xToSvg(points[0].xNorm)} ${yToSvg(top(points[0]))}`
  for (let i = 1; i < n; i++) {
    const p = points[i]
    d += ` L ${xToSvg(p.xNorm)} ${yToSvg(top(p))}`
  }
  for (let i = n - 1; i >= 0; i--) {
    const p = points[i]
    d += ` L ${xToSvg(p.xNorm)} ${yToSvg(bottom(p))}`
  }
  d += ' Z'
  return d
}

// Basic linear solver for small systems (normal equations for polynomial fit)
function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = b.length
  const M: number[][] = Array.from({ length: n }, (_, i) => [...A[i], b[i]])

  for (let i = 0; i < n; i++) {
    // Pivot for numerical stability
    let maxRow = i
    let maxVal = Math.abs(M[i][i])
    for (let r = i + 1; r < n; r++) {
      const v = Math.abs(M[r][i])
      if (v > maxVal) {
        maxVal = v
        maxRow = r
      }
    }
    if (maxVal < 1e-12) continue
    if (maxRow !== i) {
      const tmp = M[i]
      M[i] = M[maxRow]
      M[maxRow] = tmp
    }

    const diag = M[i][i]
    for (let r = i + 1; r < n; r++) {
      const factor = M[r][i] / diag
      if (!isFinite(factor)) continue
      for (let c = i; c <= n; c++) {
        M[r][c] -= factor * M[i][c]
      }
    }
  }

  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let sum = M[i][n]
    for (let c = i + 1; c < n; c++) {
      sum -= M[i][c] * x[c]
    }
    const diag = M[i][i]
    x[i] = Math.abs(diag) < 1e-12 ? 0 : sum / diag
  }
  return x
}

function fitPolynomialLeastSquares(
  xs: number[],
  ys: number[],
  degree: number,
  lambda = 1e-3
): number[] {
  const n = xs.length
  const p = degree + 1
  const A: number[][] = Array.from({ length: p }, () => Array(p).fill(0))
  const b: number[] = Array(p).fill(0)

  for (let i = 0; i < n; i++) {
    const x = xs[i]
    const row: number[] = new Array(p)
    let power = 1
    for (let j = 0; j < p; j++) {
      row[j] = power
      power *= x
    }
    const y = ys[i]
    for (let j = 0; j < p; j++) {
      b[j] += row[j] * y
      for (let k = 0; k < p; k++) {
        A[j][k] += row[j] * row[k]
      }
    }
  }

  for (let j = 0; j < p; j++) {
    A[j][j] += lambda
  }

  return solveLinearSystem(A, b)
}

function evalPolynomial(coeffs: number[], x: number): number {
  let y = 0
  let power = 1
  for (let i = 0; i < coeffs.length; i++) {
    y += coeffs[i] * power
    power *= x
  }
  return y
}

// Global polynomial interpolation – deliberately wiggly near the edges.
function makeLagrangeInterpolator(xs: number[], ys: number[]): Interpolator {
  const n = xs.length
  const weights = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let w = 1
    for (let j = 0; j < n; j++) {
      if (j === i) continue
      w *= xs[i] - xs[j]
    }
    weights[i] = w === 0 ? 0 : 1 / w
  }

  return (x: number) => {
    for (let i = 0; i < n; i++) {
      if (Math.abs(x - xs[i]) < 1e-9) return ys[i]
    }
    let num = 0
    let den = 0
    for (let i = 0; i < n; i++) {
      const diff = x - xs[i]
      if (diff === 0) return ys[i]
      const w = weights[i] / diff
      num += w * ys[i]
      den += w
    }
    return den === 0 ? 0 : num / den
  }
}

// Natural cubic spline interpolation – much smoother, but still interpolates.
function makeNaturalCubicSpline(xs: number[], ys: number[]): Interpolator {
  const n = xs.length
  if (n === 1) {
    const y0 = ys[0]
    return () => y0
  }

  const a = ys.slice()
  const b = new Array(n - 1).fill(0)
  const c = new Array(n).fill(0)
  const d = new Array(n - 1).fill(0)
  const h = new Array(n - 1).fill(0)

  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i]
  }

  const alpha = new Array(n).fill(0)
  for (let i = 1; i < n - 1; i++) {
    alpha[i] =
      (3 / h[i]) * (a[i + 1] - a[i]) -
      (3 / h[i - 1]) * (a[i] - a[i - 1])
  }

  const l = new Array(n).fill(0)
  const mu = new Array(n).fill(0)
  const z = new Array(n).fill(0)

  l[0] = 1
  mu[0] = 0
  z[0] = 0

  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1]
    if (l[i] === 0) l[i] = 1e-12
    mu[i] = h[i] / l[i]
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i]
  }

  l[n - 1] = 1
  z[n - 1] = 0
  c[n - 1] = 0

  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1]
    b[j] =
      (a[j + 1] - a[j]) / h[j] -
      (h[j] * (c[j + 1] + 2 * c[j])) / 3
    d[j] = (c[j + 1] - c[j]) / (3 * h[j])
  }

  return (x: number) => {
    let j = 0
    if (x <= xs[0]) {
      j = 0
    } else if (x >= xs[n - 1]) {
      j = n - 2
    } else {
      for (let k = 0; k < n - 1; k++) {
        if (x >= xs[k] && x <= xs[k + 1]) {
          j = k
          break
        }
      }
    }
    const dx = x - xs[j]
    return a[j] + b[j] * dx + c[j] * dx * dx + d[j] * dx * dx * dx
  }
}

export default function DoubleDescent() {
  // capacity is on a [0, 1] log-ish scale corresponding to model size
  const [capacity, setCapacity] = useState(0.45)
  const [nTrain, setNTrain] = useState(16)
  const [noiseLevel, setNoiseLevel] = useState(0.35)
  const [showTrainCurve, setShowTrainCurve] = useState(true)

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<PredictionChoice | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<PredictionChoice | null>(null)
  const [startCapacity, setStartCapacity] = useState(0.3)
  const [startTestError, setStartTestError] = useState(0)
  const [startRatio, setStartRatio] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [activeScenario, setActiveScenario] = useState<string | null>(null)
  const TARGET_CAPACITY_INCREASE = 0.25 // How much capacity increases during the challenge

  const { points, mainYMax, stackYMax } = useMemo(() => {
    const pts: DoubleDescentPoint[] = []
    let mainMax = 0
    let stackMax = 0
    const SAMPLES = 80

    for (let i = 0; i < SAMPLES; i++) {
      const t = i / (SAMPLES - 1)
      const comps = computeErrorComponents(t, nTrain, noiseLevel)
      const p: DoubleDescentPoint = {
        capacity: t,
        params: comps.params,
        xNorm: t,
        bias2: comps.bias2,
        variance: comps.variance,
        noise: comps.noise,
        testError: comps.testError,
        trainError: comps.trainError,
      }
      pts.push(p)
      mainMax = Math.max(mainMax, comps.testError, comps.trainError)
      stackMax = Math.max(
        stackMax,
        comps.bias2 + comps.variance + comps.noise
      )
    }

    if (mainMax === 0) mainMax = 1
    if (stackMax === 0) stackMax = 1

    return {
      points: pts,
      mainYMax: mainMax * 1.1,
      stackYMax: stackMax * 1.1,
    }
  }, [nTrain, noiseLevel])

  const xToSvgMain = (t: number) =>
    MAIN_PADDING + t * (MAIN_WIDTH - 2 * MAIN_PADDING)

  const yToSvgMain = (v: number) => {
    const ratio = v / mainYMax
    const t = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
    return (
      MAIN_HEIGHT - MAIN_PADDING - t * (MAIN_HEIGHT - 2 * MAIN_PADDING)
    )
  }

  const xToSvgBias = (t: number) =>
    BIAS_PADDING + t * (BIAS_WIDTH - 2 * BIAS_PADDING)

  const yToSvgBias = (v: number) => {
    const ratio = v / stackYMax
    const t = ratio < 0 ? 0 : ratio > 1 ? 1 : ratio
    return (
      BIAS_HEIGHT - BIAS_PADDING - t * (BIAS_HEIGHT - 2 * BIAS_PADDING)
    )
  }

  const testPath = buildLinePath(
    points,
    (p) => p.testError,
    xToSvgMain,
    yToSvgMain
  )

  const trainPath = buildLinePath(
    points,
    (p) => p.trainError,
    xToSvgMain,
    yToSvgMain
  )

  const noiseAreaPath = buildStackedAreaPath(
    points,
    (p) => p.noise,
    () => 0,
    xToSvgBias,
    yToSvgBias
  )

  const varianceAreaPath = buildStackedAreaPath(
    points,
    (p) => p.noise + p.variance,
    (p) => p.noise,
    xToSvgBias,
    yToSvgBias
  )

  const biasAreaPath = buildStackedAreaPath(
    points,
    (p) => p.noise + p.variance + p.bias2,
    (p) => p.noise + p.variance,
    xToSvgBias,
    yToSvgBias
  )

  const current = computeErrorComponents(capacity, nTrain, noiseLevel)

  // Prediction game computed values
  const endCapacity = Math.min(1, startCapacity + TARGET_CAPACITY_INCREASE)
  const endError = computeErrorComponents(endCapacity, nTrain, noiseLevel)
  const actualDirection: 'up' | 'down' | 'same' =
    endError.testError > startTestError + 0.01 ? 'up' :
    endError.testError < startTestError - 0.01 ? 'down' : 'same'
  const predictionCorrect = lockedPrediction === actualDirection ||
    (lockedPrediction === 'down' && actualDirection === 'same')

  // Apply a challenge scenario
  const applyScenario = useCallback((scenario: typeof CHALLENGE_SCENARIOS[number]) => {
    const startErr = computeErrorComponents(scenario.startCapacity, nTrain, noiseLevel)
    setCapacity(scenario.startCapacity)
    setStartCapacity(scenario.startCapacity)
    setStartTestError(startErr.testError)
    setStartRatio(startErr.ratio)
    setActiveScenario(scenario.name)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
  }, [nTrain, noiseLevel])

  // Start the prediction challenge
  const startChallenge = useCallback(() => {
    if (!prediction) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction])

  // Reset the game
  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setActiveScenario(null)
    setCapacity(0.45)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 700)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('animating')
    }
  }, [gamePhase, countdown])

  // Animation effect - smoothly increase capacity
  useEffect(() => {
    if (gamePhase !== 'animating') return
    if (capacity >= endCapacity - 0.01) {
      setCapacity(endCapacity)
      setGamePhase('revealed')
      return
    }
    const timer = setTimeout(() => {
      setCapacity(c => Math.min(endCapacity, c + 0.02))
    }, 60)
    return () => clearTimeout(timer)
  }, [gamePhase, capacity, endCapacity])

  const interpolationParams = nTrain
  const thresholdCapacity = paramsToCapacity(interpolationParams)

  const currentX = xToSvgMain(capacity)
  const currentTestY = yToSvgMain(current.testError)
  const currentTrainY = yToSvgMain(current.trainError)
  const thresholdX = xToSvgMain(thresholdCapacity)

  const maxPolyDegree = 16
  const polyDegree = capacityToDegree(capacity, 0, maxPolyDegree)

  const trainXs = useMemo(() => {
    const xs: number[] = []
    if (nTrain <= 1) return xs
    for (let i = 0; i < nTrain; i++) {
      const t = nTrain === 1 ? 0.5 : i / (nTrain - 1)
      const x = X_DOMAIN_MIN + (X_DOMAIN_MAX - X_DOMAIN_MIN) * t
      xs.push(x)
    }
    return xs
  }, [nTrain])

  const trainYs = useMemo(
    () =>
      trainXs.map((x, idx) => {
        const base = targetFunction(x)
        const noise = deterministicNoise(x, idx, noiseLevel)
        return base + noise
      }),
    [trainXs, noiseLevel]
  )

  const thresholdDegree = Math.min(
    maxPolyDegree,
    Math.max(1, trainXs.length - 1)
  )

  let toyRegime: 'under' | 'interpolation' | 'over' = 'under'
  if (
    polyDegree >= thresholdDegree - 1 &&
    polyDegree <= thresholdDegree + 1
  ) {
    toyRegime = 'interpolation'
  } else if (polyDegree > thresholdDegree + 1) {
    toyRegime = 'over'
  } else {
    toyRegime = 'under'
  }

  let modelFn: Interpolator
  if (trainXs.length === 0) {
    modelFn = (x: number) => targetFunction(x)
  } else if (toyRegime === 'under') {
    const degreeUsed = Math.max(0, Math.min(polyDegree, thresholdDegree - 1))
    const coeffs = fitPolynomialLeastSquares(
      trainXs,
      trainYs,
      degreeUsed,
      1e-3
    )
    modelFn = (x: number) => evalPolynomial(coeffs, x)
  } else if (toyRegime === 'interpolation') {
    modelFn = makeLagrangeInterpolator(trainXs, trainYs)
  } else {
    modelFn = makeNaturalCubicSpline(trainXs, trainYs)
  }

  // Build toy example curves
  const toySampleCount = 160
  const toyXs: number[] = []
  const toyTrueYs: number[] = []
  const toyModelYs: number[] = []
  let toyYMin = Infinity
  let toyYMax = -Infinity

  for (let i = 0; i < toySampleCount; i++) {
    const t = i / (toySampleCount - 1)
    const x = X_DOMAIN_MIN + (X_DOMAIN_MAX - X_DOMAIN_MIN) * t
    toyXs.push(x)
    const yTrue = targetFunction(x)
    const yModel = modelFn(x)
    toyTrueYs.push(yTrue)
    toyModelYs.push(yModel)
    if (yTrue < toyYMin) toyYMin = yTrue
    if (yTrue > toyYMax) toyYMax = yTrue
    if (yModel < toyYMin) toyYMin = yModel
    if (yModel > toyYMax) toyYMax = yModel
  }

  for (let i = 0; i < trainYs.length; i++) {
    const y = trainYs[i]
    if (y < toyYMin) toyYMin = y
    if (y > toyYMax) toyYMax = y
  }

  if (!isFinite(toyYMin) || !isFinite(toyYMax)) {
    toyYMin = -1
    toyYMax = 1
  }

  const toySpan = toyYMax - toyYMin || 1
  const toyMargin = 0.15 * toySpan
  toyYMin -= toyMargin
  toyYMax += toyMargin

  const xToSvgToy = (x: number) => {
    const t = (x - X_DOMAIN_MIN) / (X_DOMAIN_MAX - X_DOMAIN_MIN)
    return TOY_PADDING + t * (TOY_WIDTH - 2 * TOY_PADDING)
  }

  const yToSvgToy = (y: number) => {
    const t = (y - toyYMin) / (toyYMax - toyYMin)
    const clamped = t < 0 ? 0 : t > 1 ? 1 : t
    return (
      TOY_HEIGHT - TOY_PADDING - clamped * (TOY_HEIGHT - 2 * TOY_PADDING)
    )
  }

  const toyTruePath = toyXs
    .map(
      (x, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xToSvgToy(x)} ${yToSvgToy(
          toyTrueYs[idx]
        )}`
    )
    .join(' ')

  const toyModelPath = toyXs
    .map(
      (x, idx) =>
        `${idx === 0 ? 'M' : 'L'} ${xToSvgToy(x)} ${yToSvgToy(
          toyModelYs[idx]
        )}`
    )
    .join(' ')

  const toyTrainPoints = trainXs.map((x, idx) => ({
    x: xToSvgToy(x),
    y: yToSvgToy(trainYs[idx] ?? 0),
  }))

  let toyTrainError = 0
  let toyTestError = 0
  if (trainXs.length > 0) {
    let sumTrain = 0
    for (let i = 0; i < trainXs.length; i++) {
      const pred = modelFn(trainXs[i])
      const diff = pred - trainYs[i]
      sumTrain += diff * diff
    }
    toyTrainError = sumTrain / trainXs.length

    let sumTest = 0
    for (let i = 0; i < toyXs.length; i++) {
      const diff = toyModelYs[i] - toyTrueYs[i]
      sumTest += diff * diff
    }
    toyTestError = sumTest / toyXs.length
  }

  let regimeLabel = ''
  if (current.ratio < 0.7) {
    regimeLabel = 'Underparameterized: not enough parameters to fit the data.'
  } else if (current.ratio <= 1.3) {
    regimeLabel =
      'Interpolation threshold: model is just big enough to hit every training point, variance spikes.'
  } else {
    regimeLabel =
      'Overparameterized: many more parameters than data; SGD prefers simple, low-norm solutions.'
  }

  let toyRegimeLabel = ''
  if (toyRegime === 'under') {
    toyRegimeLabel = 'Underfitting: low-degree polynomial, high bias.'
  } else if (toyRegime === 'interpolation') {
    toyRegimeLabel =
      'Interpolation spike: high-degree polynomial wiggles through every point.'
  } else {
    toyRegimeLabel =
      'Overparameterized / minimum-norm: smoother interpolant (spline) still hits all training points.'
  }

  return (
    <section className="card interactive-card">
      <h2>🎯 Double Descent Challenge</h2>
      <p className="muted">
        Test your intuition: If I add more parameters, will test error go UP or DOWN?
        Classical wisdom says more = worse. But double descent says it&apos;s complicated!
      </p>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(139, 92, 246, 0.05))',
        border: '1px solid rgba(20, 184, 166, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        {/* Scenario selection */}
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #b8b0a0)', marginRight: '8px' }}>
            Pick a starting point:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CHALLENGE_SCENARIOS.map(scenario => (
              <button
                key={scenario.name}
                onClick={() => applyScenario(scenario)}
                disabled={gamePhase === 'animating' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeScenario === scenario.name
                    ? 'rgba(20, 184, 166, 0.3)'
                    : 'rgba(20, 184, 166, 0.1)',
                  border: `1px solid ${activeScenario === scenario.name ? '#14b8a6' : 'rgba(20, 184, 166, 0.3)'}`,
                  borderRadius: '6px',
                  color: 'var(--text-primary, #f5f0e1)',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'animating' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'animating' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={scenario.description}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeScenario && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: 'var(--text-primary, #f5f0e1)' }}>
              📊 Current: {capacityToParams(startCapacity).toFixed(0)} params | Ratio: {startRatio.toFixed(2)} | Test error: {startTestError.toFixed(3)}
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: 'var(--text-primary, #f5f0e1)' }}>
              🎯 <strong>If I increase capacity by {(TARGET_CAPACITY_INCREASE * 100).toFixed(0)}%, will test error go UP or DOWN?</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPrediction('up')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'up' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'up' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: 'var(--text-primary, #f5f0e1)',
                  fontSize: '1rem',
                  fontWeight: prediction === 'up' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                📈 UP (more overfitting)
              </button>
              <button
                onClick={() => setPrediction('down')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'down' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'down' ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: 'var(--text-primary, #f5f0e1)',
                  fontSize: '1rem',
                  fontWeight: prediction === 'down' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                📉 DOWN (better generalization)
              </button>
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #14b8a6, #0d9488)'
                  : 'rgba(20, 184, 166, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : 'var(--text-secondary)',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              🚀 Lock In Prediction!
            </button>
          </div>
        )}

        {/* No scenario selected */}
        {gamePhase === 'setup' && !activeScenario && (
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #b8b0a0)', textAlign: 'center', padding: '12px' }}>
            👆 Select a starting point above to begin the challenge!
          </p>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#14b8a6',
              textShadow: '0 0 30px rgba(20, 184, 166, 0.5)',
            }}>
              {countdown === 0 ? 'WATCH!' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Your prediction: <strong style={{ color: lockedPrediction === 'up' ? '#ef4444' : '#22c55e' }}>
                {lockedPrediction === 'up' ? '📈 UP' : '📉 DOWN'}
              </strong>
            </p>
          </div>
        )}

        {/* Animating phase */}
        {gamePhase === 'animating' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: 'var(--text-primary, #f5f0e1)', marginBottom: '8px' }}>
              ⚡ Adding parameters... Watch the curve!
            </p>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              Capacity: {(capacity * 100).toFixed(0)}% → {(endCapacity * 100).toFixed(0)}%
            </div>
            <div style={{
              marginTop: '8px',
              height: '4px',
              background: 'rgba(20, 184, 166, 0.2)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${((capacity - startCapacity) / TARGET_CAPACITY_INCREASE) * 100}%`,
                background: '#14b8a6',
                transition: 'width 0.06s linear',
              }} />
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
                {predictionCorrect ? 'Correct!' : 'Surprise!'}
              </div>
              <div style={{ fontSize: '0.9rem', color: 'var(--text-primary, #f5f0e1)' }}>
                Test error went <strong style={{ color: actualDirection === 'up' ? '#ef4444' : '#22c55e' }}>
                  {actualDirection === 'up' ? '📈 UP' : actualDirection === 'down' ? '📉 DOWN' : '➡️ STAYED SAME'}
                </strong>
                {' '}({startTestError.toFixed(3)} → {current.testError.toFixed(3)})
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'var(--text-secondary, #b8b0a0)',
            }}>
              💡 {getPredictionFeedback(lockedPrediction!, actualDirection, startCapacity, endCapacity, startRatio, current.ratio)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(20, 184, 166, 0.2)',
                border: '1px solid rgba(20, 184, 166, 0.4)',
                borderRadius: '8px',
                color: 'var(--text-primary, #f5f0e1)',
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
        <summary style={{ cursor: 'pointer', fontSize: '0.9rem', color: 'var(--text-secondary, #b8b0a0)' }}>
          📚 Manual exploration mode
        </summary>
        <div style={{ paddingTop: '12px' }}>

      {/* Configuration Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {DOUBLE_DESCENT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              setCapacity(preset.capacity);
              setNTrain(preset.nTrain);
              setNoiseLevel(preset.noise);
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #374151',
              background: 'rgba(31, 41, 55, 0.5)',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Regime Quick Jump */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <span style={{ fontSize: '12px', color: '#9ca3af', alignSelf: 'center' }}>Jump to:</span>
        {REGIME_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setCapacity(preset.capacity)}
            style={{
              padding: '4px 10px',
              borderRadius: '6px',
              border: Math.abs(capacity - preset.capacity) < 0.1 ? '2px solid #f59e0b' : '1px solid #374151',
              background: Math.abs(capacity - preset.capacity) < 0.1
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: Math.abs(capacity - preset.capacity) < 0.1 ? '#f59e0b' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: Math.abs(capacity - preset.capacity) < 0.1 ? 600 : 400,
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
        background: current.ratio < 0.7
          ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(20, 184, 166, 0.04))'
          : current.ratio <= 1.3
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))'
            : 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))',
        border: `1px solid ${current.ratio < 0.7 ? '#14b8a6' : current.ratio <= 1.3 ? '#ef4444' : '#22c55e'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getDoubleDescentInsight(current.ratio, current.testError, current.trainError, noiseLevel, toyRegime)}
      </div>

      <div className="dd-layout">
        {/* Left column: double descent curve + bias-variance */}
        <div className="dd-main-column">
          <div className="dd-main-chart-block">
            <h3 className="dd-subtitle">Test vs. Training Error</h3>
            <svg
              width={MAIN_WIDTH}
              height={MAIN_HEIGHT}
              className="dd-main-chart"
              role="img"
              aria-label="Double descent curve showing test error vs model capacity"
            >
              {/* Axes */}
              <line
                x1={xToSvgMain(0)}
                y1={yToSvgMain(0)}
                x2={xToSvgMain(1)}
                y2={yToSvgMain(0)}
                className="axis-line"
              />
              <line
                x1={xToSvgMain(0)}
                y1={yToSvgMain(0)}
                x2={xToSvgMain(0)}
                y2={yToSvgMain(mainYMax)}
                className="axis-line"
              />

              {/* Interpolation threshold marker */}
              <line
                x1={thresholdX}
                y1={yToSvgMain(0)}
                x2={thresholdX}
                y2={yToSvgMain(mainYMax)}
                className="dd-threshold-line"
                strokeDasharray="4 4"
              />
              <text
                x={thresholdX}
                y={yToSvgMain(mainYMax) + 14}
                className="axis-label"
                textAnchor="middle"
              >
                interpolation
              </text>

              {/* Test error (double descent) */}
              <path
                d={testPath}
                fill="none"
                stroke={MATH_COLORS.primary}
                strokeWidth={2}
                className="dd-test-curve"
              />

              {/* Training error (monotone decreasing) */}
              {showTrainCurve && (
                <path
                  d={trainPath}
                  fill="none"
                  stroke={MATH_COLORS.secondary}
                  strokeWidth={1.6}
                  strokeDasharray="5 3"
                  className="dd-train-curve"
                />
              )}

              {/* Current capacity marker */}
              <line
                x1={currentX}
                y1={yToSvgMain(0)}
                x2={currentX}
                y2={yToSvgMain(mainYMax)}
                className="dd-capacity-line"
                stroke="rgba(148, 163, 184, 0.8)"
                strokeDasharray="2 3"
              />
              <circle
                cx={currentX}
                cy={currentTestY}
                r={5}
                fill={MATH_COLORS.primary}
                className="dd-current-point"
              />
              {showTrainCurve && (
                <circle
                  cx={currentX}
                  cy={currentTrainY}
                  r={4}
                  fill={MATH_COLORS.secondary}
                  className="dd-current-point-train"
                />
              )}

              {/* Legend */}
              <g className="dd-legend" transform={`translate(${MAIN_PADDING}, ${MAIN_PADDING - 8})`}>
                <rect
                  x={0}
                  y={-10}
                  width={10}
                  height={2}
                  fill={MATH_COLORS.primary}
                />
                <text x={16} y={-6} className="axis-label">
                  test error
                </text>
                {showTrainCurve && (
                  <>
                    <rect
                      x={90}
                      y={-10}
                      width={10}
                      height={2}
                      fill={MATH_COLORS.secondary}
                    />
                    <text x={106} y={-6} className="axis-label">
                      training error
                    </text>
                  </>
                )}
              </g>

              {/* Axis labels */}
              <text
                x={MAIN_WIDTH / 2}
                y={MAIN_HEIGHT - 4}
                className="axis-label"
                textAnchor="middle"
              >
                model size (# parameters, log scale)
              </text>
              <text
                x={MAIN_PADDING - 22}
                y={MAIN_PADDING}
                className="axis-label"
                textAnchor="start"
              >
                error
              </text>
            </svg>

            <p className="caption">
              Classical wisdom says larger models always overfit. Double descent
              shows a second regime: far past the interpolation threshold,
              overparameterized models can generalize better again.
            </p>
          </div>

          <div className="dd-bias-chart-block">
            <h3 className="dd-subtitle">Bias–Variance–Noise Decomposition</h3>
            <svg
              width={BIAS_WIDTH}
              height={BIAS_HEIGHT}
              className="dd-bias-chart"
              role="img"
              aria-label="Stacked area chart for bias squared, variance, and irreducible noise"
            >
              {/* Axes */}
              <line
                x1={xToSvgBias(0)}
                y1={yToSvgBias(0)}
                x2={xToSvgBias(1)}
                y2={yToSvgBias(0)}
                className="axis-line"
              />
              <line
                x1={xToSvgBias(0)}
                y1={yToSvgBias(0)}
                x2={xToSvgBias(0)}
                y2={yToSvgBias(stackYMax)}
                className="axis-line"
              />

              {/* Stacked areas: noise (bottom), variance (middle), bias² (top) */}
              <path
                d={noiseAreaPath}
                fill={MATH_COLORS.secondary}
                fillOpacity={0.2}
              />
              <path
                d={varianceAreaPath}
                fill={MATH_COLORS.accent}
                fillOpacity={0.25}
              />
              <path
                d={biasAreaPath}
                fill={MATH_COLORS.primary}
                fillOpacity={0.25}
              />

              {/* Current capacity marker */}
              <line
                x1={xToSvgBias(capacity)}
                y1={yToSvgBias(0)}
                x2={xToSvgBias(capacity)}
                y2={yToSvgBias(stackYMax)}
                className="dd-capacity-line"
                stroke="rgba(148, 163, 184, 0.9)"
                strokeDasharray="2 3"
              />

              {/* Legend */}
              <g className="dd-legend" transform={`translate(${BIAS_PADDING}, ${BIAS_PADDING - 8})`}>
                <rect
                  x={0}
                  y={-10}
                  width={10}
                  height={8}
                  fill={MATH_COLORS.primary}
                  fillOpacity={0.5}
                />
                <text x={16} y={-4} className="axis-label">
                  bias²
                </text>
                <rect
                  x={80}
                  y={-10}
                  width={10}
                  height={8}
                  fill={MATH_COLORS.accent}
                  fillOpacity={0.5}
                />
                <text x={96} y={-4} className="axis-label">
                  variance
                </text>
                <rect
                  x={170}
                  y={-10}
                  width={10}
                  height={8}
                  fill={MATH_COLORS.secondary}
                  fillOpacity={0.5}
                />
                <text x={186} y={-4} className="axis-label">
                  noise
                </text>
              </g>

              <text
                x={BIAS_WIDTH / 2}
                y={BIAS_HEIGHT - 4}
                className="axis-label"
                textAnchor="middle"
              >
                model capacity
              </text>
            </svg>
            <p className="caption">
              Near the interpolation threshold, variance spikes: the model can
              fit the training set in many violently different ways. In the
              overparameterized regime, SGD implicitly picks low-norm,
              low-variance solutions again.
            </p>
          </div>
        </div>

        {/* Right column: controls + toy polynomial regression */}
        <div className="dd-side-column">
          <div className="dd-controls">
            <h3 className="dd-subtitle">Controls</h3>
            <label className="slider-label">
              Model capacity ({capacityToParams(capacity).toFixed(0)} params)
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={capacity}
                onChange={(e) => setCapacity(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label">
              Number of training points ({nTrain})
              <input
                type="range"
                min={6}
                max={32}
                step={1}
                value={nTrain}
                onChange={(e) => setNTrain(parseInt(e.target.value, 10))}
              />
            </label>
            <label className="slider-label">
              Noise level in data ({noiseLevel.toFixed(2)})
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={noiseLevel}
                onChange={(e) => setNoiseLevel(parseFloat(e.target.value))}
              />
            </label>

            <label className="toggle-label">
              <input
                type="checkbox"
                checked={showTrainCurve}
                onChange={(e) => setShowTrainCurve(e.target.checked)}
              />
              <span>Show training error curve</span>
            </label>

            <div className="dd-metrics">
              <div>
                <span className="label">Test error:</span>{' '}
                {current.testError.toFixed(3)}
              </div>
              <div>
                <span className="label">Training error:</span>{' '}
                {current.trainError.toFixed(3)}
              </div>
              <div>
                <span className="label"># parameters:</span>{' '}
                {Math.round(current.params).toLocaleString()}
              </div>
              <div>
                <span className="label"># training points:</span> {nTrain}
              </div>
              <div>
                <span className="label">ratio params / points:</span>{' '}
                {current.ratio.toFixed(2)}
              </div>
              <div>
                <span className="label">Interpolation threshold:</span>{' '}
                ≈ {nTrain.toLocaleString()} params
              </div>
            </div>
            <p className="muted dd-regime">{regimeLabel}</p>
          </div>

          <div className="dd-toy-panel">
            <h3 className="dd-subtitle">
              Toy Example: Polynomial Regression (1D)
            </h3>
            <svg
              width={TOY_WIDTH}
              height={TOY_HEIGHT}
              className="dd-toy-chart"
              role="img"
              aria-label="Toy polynomial regression showing underfitting, interpolation spike, and overparameterized smooth interpolation"
            >
              {/* Axes */}
              <line
                x1={xToSvgToy(X_DOMAIN_MIN)}
                y1={yToSvgToy(0)}
                x2={xToSvgToy(X_DOMAIN_MAX)}
                y2={yToSvgToy(0)}
                className="axis-line"
              />
              <line
                x1={xToSvgToy(0)}
                y1={yToSvgToy(toyYMin)}
                x2={xToSvgToy(0)}
                y2={yToSvgToy(toyYMax)}
                className="axis-line"
              />

              {/* True function */}
              <path
                d={toyTruePath}
                fill="none"
                stroke="rgba(148,163,184,0.8)"
                strokeWidth={1.5}
                className="dd-true-curve"
              />

              {/* Fitted model */}
              <path
                d={toyModelPath}
                fill="none"
                stroke={MATH_COLORS.accent}
                strokeWidth={2}
                className="dd-model-curve"
              />

              {/* Training points */}
              {toyTrainPoints.map((p, idx) => (
                <circle
                  key={idx}
                  cx={p.x}
                  cy={p.y}
                  r={4}
                  fill={MATH_COLORS.primary}
                  className="dd-train-point"
                />
              ))}
            </svg>
            <div className="dd-toy-meta">
              <div className="dd-toy-metrics">
                <div>
                  <span className="label">Effective degree slider:</span>{' '}
                  {polyDegree}
                </div>
                <div>
                  <span className="label">Interpolation degree:</span>{' '}
                  {thresholdDegree}
                </div>
                <div>
                  <span className="label">Toy train error:</span>{' '}
                  {toyTrainError.toFixed(3)}
                </div>
                <div>
                  <span className="label">Toy test error:</span>{' '}
                  {toyTestError.toFixed(3)}
                </div>
              </div>
              <p className="caption">{toyRegimeLabel}</p>
              <p className="caption">
                At the interpolation threshold, the high-degree polynomial
                oscillates wildly while still hitting every point. In the
                overparameterized regime, there are infinitely many interpolants
                – gradient descent tends to pick smooth, low-norm ones (similar
                to the spline here), which generalize better.
              </p>
            </div>
          </div>
        </div>
      </div>

        </div>
      </details>

    </section>
  )
}
