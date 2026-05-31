import { useEffect, useMemo, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../lib/demoState'

type DiffusionScoreVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

const X_MIN = -3
const X_MAX = 3
const Y_MIN = -3
const Y_MAX = 3

const WIDTH = 340
const HEIGHT = 260
const PADDING = 28

const FIELD_GRID_X = 13
const FIELD_GRID_Y = 13

const SCHEDULE_WIDTH = 260
const SCHEDULE_HEIGHT = 120
const SCHEDULE_PAD_X = 32
const SCHEDULE_PAD_Y = 18

const DATA_SIGMA = 0.28
const DATA_SIGMA2 = DATA_SIGMA * DATA_SIGMA
const MIN_ALPHA_BAR = 1e-3

type ScheduleKey = 'linear' | 'cosine' | 'sigmoid'
type ScoreTargetPrediction =
  | 'against-noise'
  | 'with-noise'
  | 'nearest-mode'
  | 'origin'
  | null

// Game types for schedule prediction challenge
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SchedulePrediction = 'linear' | 'cosine' | 'sigmoid' | null

interface ScheduleChallenge {
  name: string
  noiseLevel: number
  question: string
  answer: SchedulePrediction
  explanation: string
}

// Schedule prediction challenges at different noise levels
const SCHEDULE_CHALLENGES: ScheduleChallenge[] = [
  {
    name: '🎲 Early Game',
    noiseLevel: 0.15,
    question: 'At t=0.15, which schedule preserves the MOST signal (highest αbar)?',
    answer: 'cosine',
    explanation: 'At early timesteps, the cosine toy schedule is gentlest. The cosine shape keeps αbar high here, while linear decays steadily.',
  },
  {
    name: '🎲 Mid-Point',
    noiseLevel: 0.5,
    question: 'At t=0.5 (halfway), which schedule has the HIGHEST αbar?',
    answer: 'linear',
    explanation: 'At the midpoint these toy schedules are close, and linear is slightly highest with the functions used here. This quiz is about reading αbar, not judging sample quality.',
  },
  {
    name: '🎲 Late Game',
    noiseLevel: 0.85,
    question: 'At t=0.85 (heavy noise), which schedule still has detectable signal?',
    answer: 'linear',
    explanation: 'At high t, compare the plotted αbar values directly. In this toy parameterization, linear remains highest here; this is not a sample-quality claim.',
  },
  {
    name: '🎲 The Crossover',
    noiseLevel: 0.35,
    question: 'At t=0.35, all three schedules have similar αbar. Which is LOWEST?',
    answer: 'linear',
    explanation: 'Linear decays steadily in this toy. The useful lesson is that schedules change signal retention and the resulting denoising targets.',
  },
]

// Feedback function for schedule challenges
function getScheduleFeedback(
  prediction: SchedulePrediction,
  challenge: ScheduleChallenge,
  alphaLinear: number,
  alphaCosine: number,
  alphaSigmoid: number
): string {
  const scheduleNames: Record<string, string> = {
    linear: 'Linear',
    cosine: 'Cosine',
    sigmoid: 'Sigmoid toy'
  }

  const values = `Linear: ${alphaLinear.toFixed(3)}, Cosine: ${alphaCosine.toFixed(3)}, Sigmoid: ${alphaSigmoid.toFixed(3)}`

  if (prediction === challenge.answer) {
    return `✓ Correct! ${challenge.explanation}\n\nActual αbar values at t=${challenge.noiseLevel}: ${values}`
  }

  return `✗ Not quite. The answer is ${scheduleNames[challenge.answer!]}.\n\n${challenge.explanation}\n\nActual αbar values at t=${challenge.noiseLevel}: ${values}`
}

// Stage presets for exploring diffusion process
const DIFFUSION_PRESETS = [
  { name: '🎨 Clean Data', t: 0, description: 'Original data distribution' },
  { name: '🌫️ Early Noise', t: 0.2, description: 'Still recognizable structure' },
  { name: '⚖️ Mid-point', t: 0.5, description: 'Half signal, half noise' },
  { name: '🌀 Heavy Noise', t: 0.8, description: 'Mostly noise, faint structure' },
  { name: '🔲 Max Noise', t: 1.0, description: 'Maximum noise in the selected schedule' },
];

// Dynamic educational insight based on diffusion state
function getDiffusionInsight(
  noiseLevel: number,
  scheduleKey: ScheduleKey,
  alphaBar: number,
  showScores: boolean,
  isSampling: boolean,
  currentStep: number,
  maxStep: number
): string {
  if (isSampling) {
    const progress = maxStep > 0 ? ((currentStep / maxStep) * 100).toFixed(0) : 0;
    if (currentStep < maxStep * 0.3) {
      return `🚀 REVERSE SAMPLING (${progress}%): Starting from pure noise, following the score field. Early steps make large corrections—the model is orienting toward data.`;
    }
    if (currentStep < maxStep * 0.7) {
      return `📊 REVERSE SAMPLING (${progress}%): Mid-journey. The samples are forming structure. The score field now points toward specific modes of the distribution.`;
    }
    if (currentStep >= maxStep) {
      return `Toy reverse walk complete: these particles followed an analytic score field for a two-blob distribution. Real score-based generators use learned scores and a chosen SDE/ODE sampler.`;
    }
    return `⏳ REVERSE SAMPLING (${progress}%): Fine-tuning. Samples are close to the data distribution. Small steps prevent overshooting.`;
  }

  if (noiseLevel < 0.1) {
    return `🎨 Clean data (t≈0). Two clusters visible. ᾱ=${alphaBar.toFixed(3)}≈1 means the signal dominates. The score field points toward cluster centers.`;
  }

  if (noiseLevel > 0.9) {
    return `🔲 Almost pure noise (t≈1). ᾱ=${alphaBar.toFixed(3)}≈0. The clusters have dissolved into a Gaussian blob. ${showScores ? 'Notice the score arrows now point weakly toward the origin.' : ''}`;
  }

  if (noiseLevel > 0.5) {
    return `🌫️ Heavy noise (t=${noiseLevel.toFixed(2)}). Structure is fading but not gone; compare αbar directly because schedules cross in this toy.`;
  }

  if (noiseLevel > 0.2) {
    return `⚖️ Intermediate stage (t=${noiseLevel.toFixed(2)}). ᾱ=${alphaBar.toFixed(3)}. Denoising score matching gives the model vector targets derived from the injected noise.`;
  }

  return `📊 Low noise (t=${noiseLevel.toFixed(2)}). ᾱ=${alphaBar.toFixed(3)}. Two clusters are clearly separated. ${showScores ? 'The score vectors point toward high-density regions.' : ''}`;
}

type DataPoint = {
  id: number
  component: number
  x0: number
  y0: number
  noiseX: number
  noiseY: number
}

type FieldCell = {
  cx: number
  cy: number
  scoreX: number
  scoreY: number
  density: number
}

type TrajectoryPoint = {
  x: number
  y: number
  t: number
}

type Trajectory = {
  id: number
  points: TrajectoryPoint[]
}

const COMPONENTS = [
  { meanX: -1.4, meanY: 0.9, weight: 0.5 },
  { meanX: 1.3, meanY: -0.7, weight: 0.5 },
]

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function gaussianPair(seed: number): [number, number] {
  const u1Raw = pseudoRandom(seed)
  const u1 = u1Raw <= 0 ? 1e-6 : u1Raw
  const u2 = pseudoRandom(seed + 1)
  const r = Math.sqrt(-2 * Math.log(u1))
  const theta = 2 * Math.PI * u2
  return [r * Math.cos(theta), r * Math.sin(theta)]
}

function alphaBarLinear(t: number): number {
  const clamped = clamp(t, 0, 1)
  const alpha = 1 - 0.95 * clamped
  return clamp(alpha, MIN_ALPHA_BAR, 1)
}

function alphaBarCosine(t: number): number {
  const clamped = clamp(t, 0, 1)
  const s = 0.008
  const angle = ((clamped + s) / (1 + s)) * (Math.PI / 2)
  const f = Math.cos(angle)
  const alpha = f * f
  return clamp(alpha, MIN_ALPHA_BAR, 1)
}

function alphaBarSigmoid(t: number): number {
  const clamped = clamp(t, 0, 1)
  const k = 8
  const mid = 0.5
  const sig = 1 / (1 + Math.exp(k * (clamped - mid)))
  const alpha = MIN_ALPHA_BAR + (1 - MIN_ALPHA_BAR) * sig
  return clamp(alpha, MIN_ALPHA_BAR, 1)
}

function alphaBarForSchedule(schedule: ScheduleKey, t: number): number {
  switch (schedule) {
    case 'linear':
      return alphaBarLinear(t)
    case 'cosine':
      return alphaBarCosine(t)
    case 'sigmoid':
    default:
      return alphaBarSigmoid(t)
  }
}

function xToSvg(x: number): number {
  const t = (x - X_MIN) / (X_MAX - X_MIN)
  return PADDING + t * (WIDTH - 2 * PADDING)
}

function yToSvg(y: number): number {
  const t = (y - Y_MIN) / (Y_MAX - Y_MIN)
  return HEIGHT - PADDING - t * (HEIGHT - 2 * PADDING)
}

function scheduleX(t: number): number {
  return SCHEDULE_PAD_X + t * (SCHEDULE_WIDTH - 2 * SCHEDULE_PAD_X)
}

function scheduleY(alphaBar: number): number {
  // alphaBar = 1 at top, 0 at bottom
  const clamped = clamp(alphaBar, 0, 1)
  return (
    SCHEDULE_HEIGHT - SCHEDULE_PAD_Y - clamped * (SCHEDULE_HEIGHT - 2 * SCHEDULE_PAD_Y)
  )
}

function buildSchedulePath(schedule: ScheduleKey): string {
  const n = 80
  let d = ''
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const alpha = alphaBarForSchedule(schedule, t)
    const x = scheduleX(t)
    const y = scheduleY(alpha)
    d += `${i === 0 ? 'M' : 'L'} ${x} ${y} `
  }
  return d.trim()
}

function scoreAndDensityAt(
  x: number,
  y: number,
  t: number,
  schedule: ScheduleKey
): { scoreX: number; scoreY: number; density: number } {
  const alpha = alphaBarForSchedule(schedule, t)
  const sqrtAlpha = Math.sqrt(alpha)
  const sigma2 = alpha * DATA_SIGMA2 + (1 - alpha)
  const safeSigma2 = Math.max(1e-3, sigma2)
  const invSigma2 = 1 / safeSigma2

  let sumWeights = 0
  let gradX = 0
  let gradY = 0

  for (const comp of COMPONENTS) {
    const meanX = sqrtAlpha * comp.meanX
    const meanY = sqrtAlpha * comp.meanY
    const dx = x - meanX
    const dy = y - meanY
    const r2 = dx * dx + dy * dy
    const w = comp.weight * Math.exp(-0.5 * r2 / safeSigma2)
    if (w === 0) continue
    sumWeights += w
    // gradient of log mixture: weighted average of component scores
    gradX += w * (-dx * invSigma2)
    gradY += w * (-dy * invSigma2)
  }

  if (sumWeights <= 1e-12) {
    return { scoreX: 0, scoreY: 0, density: 0 }
  }

  return {
    scoreX: gradX / sumWeights,
    scoreY: gradY / sumWeights,
    density: sumWeights,
  }
}

const SCHEDULE_PATHS = {
  linear: buildSchedulePath('linear'),
  cosine: buildSchedulePath('cosine'),
  sigmoid: buildSchedulePath('sigmoid'),
}

const NUM_PARTICLES = 4
const SCORE_STEP_SCALE = 1.6

const SCORE_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Commit to the hidden conditional score direction.',
  },
  {
    label: 'Observe',
    detail: 'Reveal whether the target opposes the injected noise.',
  },
  {
    label: 'Ground',
    detail: 'Tie the arrow to the DSM formula.',
  },
  {
    label: 'Carry',
    detail: 'Separate the conditional target from the marginal field.',
  },
]

export default function DiffusionScoreDemo({
  chrome = 'legacy',
  conceptId = 'score-matching',
}: DiffusionScoreVizProps) {
  const isNotebook = chrome === 'notebook'
  const [noiseLevel, setNoiseLevel] = useState(0.3)
  const [scheduleKey, setScheduleKey] = useState<ScheduleKey>('cosine')
  const [showScores, setShowScores] = useState(true)
  const [showDensity, setShowDensity] = useState(true)
  const [numSteps, setNumSteps] = useState(32)
  const [sampleSeed, setSampleSeed] = useState(1)
  const [probeIndex, setProbeIndex] = useState(17)
  const [scorePrediction, setScorePrediction] = useState<ScoreTargetPrediction>(null)
  const [scorePredictionRevealed, setScorePredictionRevealed] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [isPlayingForward, setIsPlayingForward] = useState(false)
  const [isSampling, setIsSampling] = useState(false)

  // Game state for schedule prediction challenge
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<ScheduleChallenge | null>(null)
  const [prediction, setPrediction] = useState<SchedulePrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

  const dataPoints = useMemo<DataPoint[]>(() => {
    const pts: DataPoint[] = []
    const perComponent = 80
    let id = 0
    COMPONENTS.forEach((comp, componentIndex) => {
      for (let i = 0; i < perComponent; i++) {
        const seed = componentIndex * perComponent + i
        const [gx, gy] = gaussianPair(seed * 2)
        const [nx, ny] = gaussianPair(seed * 2 + 1)
        const x0 = comp.meanX + gx * DATA_SIGMA
        const y0 = comp.meanY + gy * DATA_SIGMA
        pts.push({
          id: id++,
          component: componentIndex,
          x0,
          y0,
          noiseX: nx,
          noiseY: ny,
        })
      }
    })
    return pts
  }, [])

  const currentAlphaBar = alphaBarForSchedule(scheduleKey, noiseLevel)
  const rawSigma2 = Math.max(0, 1 - currentAlphaBar)
  const currentSigma2 = Math.max(1e-4, rawSigma2)
  const currentSigma = Math.sqrt(rawSigma2)
  const isDsmTargetDefined = rawSigma2 > 1e-4

  const forwardSamples = useMemo(
    () =>
      dataPoints.map((p) => {
        const sqrtAlpha = Math.sqrt(currentAlphaBar)
        const x = sqrtAlpha * p.x0 + currentSigma * p.noiseX
        const y = sqrtAlpha * p.y0 + currentSigma * p.noiseY
        return { id: p.id, component: p.component, x, y }
      }),
    [currentAlphaBar, currentSigma, dataPoints]
  )

  const probeData = dataPoints[probeIndex % dataPoints.length] ?? dataPoints[0]
  const probeCleanAnchor = useMemo(() => {
    const sqrtAlpha = Math.sqrt(currentAlphaBar)
    return {
      x: sqrtAlpha * probeData.x0,
      y: sqrtAlpha * probeData.y0,
    }
  }, [currentAlphaBar, probeData])

  const probeNoisyPoint = useMemo(() => ({
    x: probeCleanAnchor.x + currentSigma * probeData.noiseX,
    y: probeCleanAnchor.y + currentSigma * probeData.noiseY,
  }), [currentSigma, probeCleanAnchor, probeData])

  const probeResidual = useMemo(() => ({
    x: probeNoisyPoint.x - probeCleanAnchor.x,
    y: probeNoisyPoint.y - probeCleanAnchor.y,
  }), [probeCleanAnchor, probeNoisyPoint])

  const conditionalScoreTarget = useMemo(() => ({
    x: -probeResidual.x / currentSigma2,
    y: -probeResidual.y / currentSigma2,
  }), [currentSigma2, probeResidual])

  const conditionalScoreMagnitude = Math.hypot(
    conditionalScoreTarget.x,
    conditionalScoreTarget.y,
  )
  const targetDisplayScale =
    conditionalScoreMagnitude > 0
      ? Math.min(0.65 / conditionalScoreMagnitude, 1)
      : 1
  const targetDisplayEnd = {
    x: probeNoisyPoint.x + conditionalScoreTarget.x * targetDisplayScale,
    y: probeNoisyPoint.y + conditionalScoreTarget.y * targetDisplayScale,
  }
  const marginalScoreAtProbe = scoreAndDensityAt(
    probeNoisyPoint.x,
    probeNoisyPoint.y,
    noiseLevel,
    scheduleKey,
  )

  useEffect(() => {
    setScorePredictionRevealed(false)
  }, [noiseLevel, probeIndex, scheduleKey])

  const field = useMemo(() => {
    const cells: FieldCell[] = []
    let maxDensity = 0

    for (let ix = 0; ix < FIELD_GRID_X; ix++) {
      for (let iy = 0; iy < FIELD_GRID_Y; iy++) {
        const x =
          X_MIN + ((ix + 0.5) / FIELD_GRID_X) * (X_MAX - X_MIN)
        const y =
          Y_MIN + ((iy + 0.5) / FIELD_GRID_Y) * (Y_MAX - Y_MIN)
        const { scoreX, scoreY, density } = scoreAndDensityAt(
          x,
          y,
          noiseLevel,
          scheduleKey
        )
        cells.push({ cx: x, cy: y, scoreX, scoreY, density })
        if (density > maxDensity) maxDensity = density
      }
    }

    return { cells, maxDensity }
  }, [noiseLevel, scheduleKey])

  const trajectories = useMemo<Trajectory[]>(() => {
    const steps = Math.max(2, numSteps)
    const dt = 1 / (steps - 1)
    const result: Trajectory[] = []

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const [nx, ny] = gaussianPair(sampleSeed * 10 + i * 3)
      let x = clamp(nx * 1.4, X_MIN + 0.4, X_MAX - 0.4)
      let y = clamp(ny * 1.4, Y_MIN + 0.4, Y_MAX - 0.4)
      const points: TrajectoryPoint[] = []

      for (let k = 0; k < steps; k++) {
        const t = 1 - k * dt
        points.push({ x, y, t })

        if (k < steps - 1) {
          const { scoreX, scoreY } = scoreAndDensityAt(
            x,
            y,
            t,
            scheduleKey
          )
          x = clamp(
            x + SCORE_STEP_SCALE * scoreX * dt,
            X_MIN + 0.4,
            X_MAX - 0.4
          )
          y = clamp(
            y + SCORE_STEP_SCALE * scoreY * dt,
            Y_MIN + 0.4,
            Y_MAX - 0.4
          )
        }
      }

      result.push({ id: i, points })
    }

    return result
  }, [numSteps, sampleSeed, scheduleKey])

  useEffect(() => {
    setCurrentStepIndex(0)
  }, [numSteps, sampleSeed, scheduleKey])

  useEffect(() => {
    if (!isPlayingForward) return

    let frameId: number

    const step = () => {
      setNoiseLevel((prev) => {
        const next = prev + 0.01
        if (next >= 1) {
          setIsPlayingForward(false)
          return 1
        }
        return next
      })
      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [isPlayingForward])

  useEffect(() => {
    if (!isSampling) return

    let frameId: number

    const step = () => {
      setCurrentStepIndex((prev) => {
        const maxIndex =
          trajectories.length > 0
            ? trajectories[0].points.length - 1
            : 0
        if (prev >= maxIndex) {
          setIsSampling(false)
          return maxIndex
        }
        return prev + 1
      })
      frameId = requestAnimationFrame(step)
    }

    frameId = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frameId)
  }, [isSampling, trajectories])

  const handleResample = () => {
    setIsSampling(false)
    setSampleSeed((s) => s + 1)
  }

  // Game control functions
  const startChallenge = (challenge: ScheduleChallenge) => {
    setSelectedChallenge(challenge)
    setNoiseLevel(challenge.noiseLevel)
    setIsPlayingForward(false)
    setIsSampling(false)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(4)
  }

  const submitPrediction = (pred: SchedulePrediction) => {
    if (gamePhase !== 'countdown' || !selectedChallenge) return
    setPrediction(pred)
    setGamePhase('revealed')

    if (pred === selectedChallenge.answer && !completedChallenges.has(selectedChallenge.name)) {
      setScore(s => s + 1)
      setCompletedChallenges(prev => new Set([...prev, selectedChallenge.name]))
    }
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(0)
  }

  // Countdown timer for game
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown(c => c - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  // Auto-reveal when countdown reaches 0
  useEffect(() => {
    if (gamePhase === 'countdown' && countdown === 0 && !prediction) {
      // Time's up - auto-reveal with no prediction
      setGamePhase('revealed')
    }
  }, [gamePhase, countdown, prediction])

  const maxStepIndex =
    trajectories.length > 0
      ? trajectories[0].points.length - 1
      : 0
  const clampedStepIndex = clamp(
    currentStepIndex,
    0,
    maxStepIndex
  )

  // Dynamic educational insight based on current state
  const currentInsight = useMemo(() => {
    return getDiffusionInsight(
      noiseLevel,
      scheduleKey,
      currentAlphaBar,
      showScores,
      isSampling,
      clampedStepIndex,
      maxStepIndex
    );
  }, [noiseLevel, scheduleKey, currentAlphaBar, showScores, isSampling, clampedStepIndex, maxStepIndex]);

  const scoreEvidenceActiveIndex = scorePredictionRevealed ? 3 : scorePrediction ? 1 : 0
  const scoreEvidencePhase = SCORE_EVIDENCE_STEPS[scoreEvidenceActiveIndex].label

  useEffect(() => {
    if (!isNotebook) return
    return () => clearDemoState(conceptId)
  }, [conceptId, isNotebook])

  useEffect(() => {
    if (!isNotebook) return

    const values = scorePredictionRevealed
      ? [
          `schedule: ${scheduleKey}`,
          `alpha_bar: ${currentAlphaBar.toFixed(3)}`,
          `sigma sqrt(1-alpha_bar): ${currentSigma.toFixed(3)}`,
          `probe id: ${probeData.id}`,
          `prediction: ${scorePrediction ?? 'none'}`,
          'evidence loop: predict -> observe -> ground -> carry',
          `evidence phase: ${scoreEvidencePhase}`,
          'actual: against-noise',
          `correct: ${scorePrediction === 'against-noise' ? 'yes' : 'no'}`,
          `conditional target magnitude: ${conditionalScoreMagnitude.toFixed(3)}`,
          `marginal score at probe: (${marginalScoreAtProbe.scoreX.toFixed(2)}, ${marginalScoreAtProbe.scoreY.toFixed(2)})`,
        ]
      : [
          `schedule: ${scheduleKey}`,
          `alpha_bar: ${currentAlphaBar.toFixed(3)}`,
          `sigma sqrt(1-alpha_bar): ${currentSigma.toFixed(3)}`,
          `probe id: ${probeData.id}`,
          `prediction: ${scorePrediction ?? 'none'}`,
          'evidence loop: predict -> observe -> ground -> carry',
          `evidence phase: ${scoreEvidencePhase}`,
          'revealed: no',
        ]

    emitDemoState({
      conceptId,
      label: 'Score matching DSM target demo',
      summary: scorePredictionRevealed
        ? `Two-blob score-matching toy at t=${noiseLevel.toFixed(2)}: the conditional DSM target has been revealed for the highlighted noisy sample.`
        : `Two-blob score-matching toy at t=${noiseLevel.toFixed(2)} awaiting a prediction before the hidden DSM target is revealed.`,
      values,
    })
  }, [
    conceptId,
    conditionalScoreMagnitude,
    currentAlphaBar,
    currentSigma,
    isNotebook,
    marginalScoreAtProbe.scoreX,
    marginalScoreAtProbe.scoreY,
    noiseLevel,
    probeData.id,
    scheduleKey,
    scoreEvidencePhase,
    scorePrediction,
    scorePredictionRevealed,
  ])

  return (
    <>
    <section
      className={isNotebook ? 'score-matching-demo notebook' : 'card interactive-card score-matching-demo legacy'}
      style={isNotebook ? {
        background: 'transparent',
        border: 0,
        boxShadow: 'none',
        padding: 0,
        color: '#e5e7eb',
      } : undefined}
    >
      {!isNotebook ? (
        <>
          <h2>Diffusion, Scores & Reverse Sampling</h2>
          <p className="muted">
            Watch a simple 2D diffusion process: we gradually add noise, learn the
            score field ∇ₓ log pₜ(x), then walk samples back from noise to data.
          </p>
        </>
      ) : null}

      {/* Game toggle button */}
      {!isNotebook ? (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          type="button"
          onClick={() => {
            setGameMode(!gameMode)
            if (gameMode) resetGame()
          }}
          style={{
            fontSize: '0.75rem',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: gameMode ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(75, 85, 99, 0.5)',
            background: gameMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
        >
          {gameMode ? 'Exit Challenge' : 'Try Schedule Quiz'}
        </button>
      </div>
      ) : null}

      {/* Schedule Prediction Challenge Game Panel */}
      {!isNotebook && gameMode && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: MATH_COLORS.accent }}>
              💡 Schedule Prediction Challenge
            </span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              Score: {score}/{SCHEDULE_CHALLENGES.length}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' }}>
            Can you predict which noise schedule preserves the most signal? Test your intuition!
          </p>

          {/* Challenge buttons */}
          {gamePhase === 'setup' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SCHEDULE_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  onClick={() => startChallenge(challenge)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.7rem',
                    borderRadius: '6px',
                    border: completedChallenges.has(challenge.name)
                      ? '1px solid rgba(34, 197, 94, 0.5)'
                      : '1px solid rgba(139, 92, 246, 0.4)',
                    background: completedChallenges.has(challenge.name)
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(139, 92, 246, 0.1)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                </button>
              ))}
            </div>
          )}

          {/* Active challenge - countdown and prediction */}
          {gamePhase === 'countdown' && selectedChallenge && (
            <div>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  {selectedChallenge.question}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                  ⏱️ Time remaining: {countdown}s
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('linear')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${MATH_COLORS.primary}`,
                    background: prediction === 'linear' ? `${MATH_COLORS.primary}33` : 'transparent',
                    color: MATH_COLORS.primary,
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'linear' ? 0.5 : 1,
                  }}
                >
                  📈 Linear
                </button>
                <button
                  onClick={() => submitPrediction('cosine')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${MATH_COLORS.secondary}`,
                    background: prediction === 'cosine' ? `${MATH_COLORS.secondary}33` : 'transparent',
                    color: MATH_COLORS.secondary,
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'cosine' ? 0.5 : 1,
                  }}
                >
                  🌊 Cosine
                </button>
                <button
                  onClick={() => submitPrediction('sigmoid')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: `1px solid ${MATH_COLORS.accent}`,
                    background: prediction === 'sigmoid' ? `${MATH_COLORS.accent}33` : 'transparent',
                    color: MATH_COLORS.accent,
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'sigmoid' ? 0.5 : 1,
                  }}
                >
                  📊 Sigmoid
                </button>
              </div>
            </div>
          )}

          {/* Results panel */}
          {gamePhase === 'revealed' && selectedChallenge && (
            <div>
              <div style={{
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34, 197, 94, 0.4)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
                  {getScheduleFeedback(
                    prediction,
                    selectedChallenge,
                    alphaBarLinear(selectedChallenge.noiseLevel),
                    alphaBarCosine(selectedChallenge.noiseLevel),
                    alphaBarSigmoid(selectedChallenge.noiseLevel)
                  )}
                </div>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                ← Try Another Challenge
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stage Presets */}
      {!isNotebook ? (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {DIFFUSION_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-pressed={Math.abs(noiseLevel - preset.t) < 0.05}
            onClick={() => {
              setIsPlayingForward(false);
              setNoiseLevel(preset.t);
            }}
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: Math.abs(noiseLevel - preset.t) < 0.05
                ? '1px solid rgba(245, 158, 11, 0.7)'
                : '1px solid rgba(75, 85, 99, 0.5)',
              background: Math.abs(noiseLevel - preset.t) < 0.05
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
      ) : null}

      {isNotebook ? (
        <div
          className="score-prediction-panel"
          data-child-demo-gate="score-matching-dsm-target"
        >
          <h3>Prediction check: what is the hidden DSM target?</h3>
          <p>
            The highlighted noisy sample came from a scaled clean anchor plus
            injected Gaussian noise. Predict the conditional score target before
            revealing the arrow.
          </p>
          <div className="score-prediction-options">
            {([
              ['against-noise', 'Against injected noise'],
              ['with-noise', 'With injected noise'],
              ['nearest-mode', 'Toward nearest mode'],
              ['origin', 'Toward origin'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={scorePrediction === value}
                onClick={() => {
                  setScorePrediction(value)
                  setScorePredictionRevealed(false)
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="evidence-strip" aria-label="Score matching evidence loop">
            {SCORE_EVIDENCE_STEPS.map((step, index) => (
              <div
                key={step.label}
                className="evidence-step"
                data-active={index <= scoreEvidenceActiveIndex ? 'true' : 'false'}
              >
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>
          <div className="score-prediction-actions">
            <button
              type="button"
              disabled={!scorePrediction || !isDsmTargetDefined}
              onClick={() => setScorePredictionRevealed(true)}
            >
              Reveal target
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setProbeIndex((idx) => (idx + 23) % dataPoints.length)
                setScorePrediction(null)
                setScorePredictionRevealed(false)
              }}
            >
              New probe
            </button>
          </div>
          {scorePredictionRevealed ? (
            <p className="score-result" role="status" aria-live="polite">
              {scorePrediction === 'against-noise'
                ? 'Correct: '
                : scorePrediction === 'nearest-mode'
                  ? 'Nearest mode can describe the marginal field sometimes, but not this conditional target. '
                  : 'Not for the conditional DSM target. '}
              The target points against the injected noise residual:
              {' '}∇ log q(x_t | x₀) = -(x_t - √ᾱ x₀)/(1 - ᾱ).
              A noise predictor is equivalent up to scale: score ≈ -εθ/σ.
            </p>
          ) : null}
          {!isDsmTargetDefined ? (
            <p className="score-result" role="status" aria-live="polite">
              Increase t above zero to define a noisy DSM target. At ᾱ = 1,
              the conditional formula would divide by zero because no noise was
              injected.
            </p>
          ) : null}
          {scorePredictionRevealed ? (
            <p className="score-formula">
              x_t = √ᾱ x₀ + σ ε; conditional target = -(x_t - √ᾱ x₀) / σ².
            </p>
          ) : (
            <p className="score-formula">
              The signed target formula is hidden until reveal; inspect the clean
              anchor, noisy point, and residual before committing a direction.
            </p>
          )}
        </div>
      ) : null}

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: isNotebook ? '#334155' : 'rgba(255, 255, 255, 0.9)',
          background: isNotebook
            ? 'linear-gradient(135deg, rgba(255, 251, 235, 0.96), rgba(240, 253, 250, 0.92))'
            : isSampling
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
            : noiseLevel > 0.9
              ? 'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(75, 85, 99, 0.05))'
              : noiseLevel < 0.2
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: isNotebook
            ? '1px solid rgba(217, 119, 6, 0.28)'
            : isSampling
            ? '1px solid rgba(139, 92, 246, 0.3)'
            : noiseLevel > 0.9
              ? '1px solid rgba(75, 85, 99, 0.3)'
              : noiseLevel < 0.2
                ? '1px solid rgba(34, 197, 94, 0.3)'
                : '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="diffusion-layout">
        <svg
          width={WIDTH}
          height={HEIGHT}
          className="diffusion-chart"
          role="img"
          aria-label="2D diffusion score-matching demo"
        >
          <defs>
            <marker
              id="score-target-arrowhead"
              markerWidth="8"
              markerHeight="8"
              refX="7"
              refY="4"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 8 4 L 0 8 z" fill="#22c55e" />
            </marker>
            <marker
              id="noise-residual-arrowhead"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3.5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M 0 0 L 7 3.5 L 0 7 z" fill="#f59e0b" />
            </marker>
          </defs>
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
            y1={yToSvg(Y_MIN)}
            x2={xToSvg(0)}
            y2={yToSvg(Y_MAX)}
            className="axis-line"
          />

          {/* Density heatmap */}
          {showDensity && field.maxDensity > 0 && (
            <g className="density-layer">
              {field.cells.map((cell, i) => {
                const domainWidth = X_MAX - X_MIN
                const domainHeight = Y_MAX - Y_MIN
                const cellDomainW = domainWidth / FIELD_GRID_X
                const cellDomainH = domainHeight / FIELD_GRID_Y
                const x0 = cell.cx - cellDomainW / 2
                const x1 = cell.cx + cellDomainW / 2
                const y0 = cell.cy - cellDomainH / 2
                const y1 = cell.cy + cellDomainH / 2
                const svgX0 = xToSvg(x0)
                const svgX1 = xToSvg(x1)
                const svgY0 = yToSvg(y0)
                const svgY1 = yToSvg(y1)
                const w = svgX1 - svgX0
                const h = svgY0 - svgY1
                const intensity =
                  field.maxDensity > 0
                    ? cell.density / field.maxDensity
                    : 0
                const opacity = 0.05 + 0.35 * intensity

                return (
                  <rect
                    key={i}
                    x={svgX0}
                    y={svgY1}
                    width={w}
                    height={h}
                    fill={MATH_COLORS.primary}
                    fillOpacity={opacity}
                    className="density-cell"
                  />
                )
              })}
            </g>
          )}

          {/* Score vector field */}
          {showScores && (
            <g className="score-field">
              {field.cells.map((cell, i) => {
                const { scoreX, scoreY } = cell
                const len = Math.hypot(scoreX, scoreY)
                if (len === 0) return null
                const dirX = scoreX / len
                const dirY = scoreY / len
                const arrowLength =
                  0.45 * (1 - 0.35 * noiseLevel) // shorter at high noise
                const x1 = cell.cx
                const y1 = cell.cy
                const x2 = x1 + dirX * arrowLength
                const y2 = y1 + dirY * arrowLength

                return (
                  <line
                    key={i}
                    x1={xToSvg(x1)}
                    y1={yToSvg(y1)}
                    x2={xToSvg(x2)}
                    y2={yToSvg(y2)}
                    stroke={MATH_COLORS.secondary}
                    strokeWidth={1}
                    className="score-arrow"
                  />
                )
              })}
            </g>
          )}

          {/* Forward-diffused samples */}
          <g className="samples">
            {forwardSamples.map((p) => (
              <circle
                key={p.id}
                cx={xToSvg(p.x)}
                cy={yToSvg(p.y)}
                r={3}
                fill={
                  p.component === 0
                    ? MATH_COLORS.primary
                    : MATH_COLORS.secondary
                }
                fillOpacity={0.9}
                className={`sample-point comp-${p.component}`}
              />
            ))}
          </g>

          {/* Highlighted conditional DSM target */}
          {isNotebook ? (
            <g className="dsm-probe">
              <line
                x1={xToSvg(probeCleanAnchor.x)}
                y1={yToSvg(probeCleanAnchor.y)}
                x2={xToSvg(probeNoisyPoint.x)}
                y2={yToSvg(probeNoisyPoint.y)}
                className="noise-residual"
                strokeOpacity={scorePredictionRevealed ? 0.95 : 0.35}
                markerEnd={scorePredictionRevealed ? 'url(#noise-residual-arrowhead)' : undefined}
              />
              {scorePredictionRevealed ? (
                <line
                  x1={xToSvg(probeNoisyPoint.x)}
                  y1={yToSvg(probeNoisyPoint.y)}
                  x2={xToSvg(targetDisplayEnd.x)}
                  y2={yToSvg(targetDisplayEnd.y)}
                  className="score-target-arrow"
                  markerEnd="url(#score-target-arrowhead)"
                />
              ) : null}
              <circle
                cx={xToSvg(probeCleanAnchor.x)}
                cy={yToSvg(probeCleanAnchor.y)}
                r={5}
                className="clean-anchor"
              />
              <circle
                cx={xToSvg(probeNoisyPoint.x)}
                cy={yToSvg(probeNoisyPoint.y)}
                r={6}
                className="probe-noisy-point"
              />
            </g>
          ) : null}

          {/* Reverse sampling trajectories */}
          {!isNotebook ? (
          <g className="sampling-paths">
            {trajectories.map((traj) => {
              if (traj.points.length === 0) return null
              const points = traj.points
              const visiblePoints = points.slice(
                0,
                clampedStepIndex + 1
              )
              const head =
                visiblePoints[visiblePoints.length - 1] ?? points[0]

              const diffusionPathD = visiblePoints
                .map(
                  (p, idx) =>
                    `${idx === 0 ? 'M' : 'L'} ${xToSvg(p.x)} ${yToSvg(
                      p.y
                    )}`
                )
                .join(' ')

              const fullPathD = points
                .map(
                  (p, idx) =>
                    `${idx === 0 ? 'M' : 'L'} ${xToSvg(p.x)} ${yToSvg(
                      p.y
                    )}`
                )
                .join(' ')

              const first = points[0]
              const last = points[points.length - 1]
              const straightD = `M ${xToSvg(first.x)} ${yToSvg(
                first.y
              )} L ${xToSvg(last.x)} ${yToSvg(last.y)}`

              return (
                <g key={traj.id}>
                  {/* Straight reference chord */}
                  <path
                    d={straightD}
                    stroke={MATH_COLORS.secondary}
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    fill="none"
                    className="flow-path"
                  />
                  {/* Full diffusion path (faint) */}
                  <path
                    d={fullPathD}
                    stroke={MATH_COLORS.accent}
                    strokeOpacity={0.25}
                    fill="none"
                    className="diffusion-path full"
                  />
                  {/* Visible part up to current reverse step */}
                  <path
                    d={diffusionPathD}
                    stroke={MATH_COLORS.accent}
                    strokeWidth={2}
                    fill="none"
                    className="diffusion-path visible"
                  />
                  <circle
                    cx={xToSvg(head.x)}
                    cy={yToSvg(head.y)}
                    r={4}
                    fill={MATH_COLORS.accent}
                    className="sampling-particle"
                  />
                </g>
              )
            })}
          </g>
          ) : null}
        </svg>

        <div className="diffusion-controls">
          <label className="slider-label">
            Noise level t ({noiseLevel.toFixed(2)})
            <input
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={noiseLevel}
              onChange={(e) =>
                setNoiseLevel(parseFloat(e.target.value))
              }
            />
          </label>
          <div className="diffusion-noise-buttons">
            <button
              type="button"
              onClick={() => setIsPlayingForward((p) => !p)}
            >
              {isPlayingForward ? 'Pause diffusion' : 'Play diffusion'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setIsPlayingForward(false)
                setNoiseLevel(0)
              }}
            >
              Reset to clean data
            </button>
          </div>

          {!isNotebook ? (
          <label className="slider-label">
            Reverse sampling steps ({numSteps})
            <input
              type="range"
              min={8}
              max={80}
              step={2}
              value={numSteps}
              onChange={(e) =>
                setNumSteps(parseInt(e.target.value, 10))
              }
            />
          </label>
          ) : null}

          <div className="diffusion-toggle-row">
            <label className="toggle">
              <input
                type="checkbox"
                checked={showScores}
                onChange={(e) => setShowScores(e.target.checked)}
              />
              <span>Show score vectors</span>
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showDensity}
                onChange={(e) => setShowDensity(e.target.checked)}
              />
              <span>Show density heatmap</span>
            </label>
          </div>

          {!isNotebook ? (
          <div className="diffusion-sampling-buttons">
            <button
              type="button"
              onClick={() => setIsSampling((p) => !p)}
            >
              {isSampling ? 'Pause reverse walk' : 'Play reverse walk'}
            </button>
            <button
              type="button"
              className="ghost"
              onClick={handleResample}
            >
              Sample new generation
            </button>
          </div>
          ) : null}

          <div className="diffusion-stats">
            <div>
              <span className="label">ᾱ(t):</span>{' '}
              {currentAlphaBar.toFixed(3)}
            </div>
            <div>
              <span className="label">Noise std √(1-ᾱ):</span>{' '}
              {currentSigma.toFixed(3)}
            </div>
            {!isNotebook ? (
            <div>
              <span className="label">Reverse step:</span>{' '}
              {clampedStepIndex}/{maxStepIndex}
            </div>
            ) : null}
          </div>
          <p className="caption">
            The arrows show the marginal score field ∇ₓ log pₜ(x) for this
            analytic two-blob toy. The highlighted DSM target is conditional on
            one scaled clean anchor and one injected noise residual.
          </p>
        </div>
      </div>

      <div className="diffusion-schedule-panel">
        <div className="schedule-header">
          <span className="label">Noise schedule ᾱ(t)</span>
          <div className="pill-group">
            <button
              type="button"
              aria-pressed={scheduleKey === 'linear'}
              onClick={() => setScheduleKey('linear')}
              className={
                scheduleKey === 'linear' ? 'active pill' : 'pill'
              }
            >
              Linear
            </button>
            <button
              type="button"
              aria-pressed={scheduleKey === 'cosine'}
              onClick={() => setScheduleKey('cosine')}
              className={
                scheduleKey === 'cosine' ? 'active pill' : 'pill'
              }
            >
              Cosine
            </button>
            <button
              type="button"
              aria-pressed={scheduleKey === 'sigmoid'}
              onClick={() => setScheduleKey('sigmoid')}
              className={
                scheduleKey === 'sigmoid' ? 'active pill' : 'pill'
              }
            >
              Sigmoid toy
            </button>
          </div>
        </div>
        <div className="schedule-layout">
          <svg
            width={SCHEDULE_WIDTH}
            height={SCHEDULE_HEIGHT}
            className="schedule-chart"
            role="img"
            aria-label="Noise schedules over time"
          >
            <line
              x1={scheduleX(0)}
              y1={scheduleY(0)}
              x2={scheduleX(1)}
              y2={scheduleY(0)}
              className="axis-line"
            />
            <line
              x1={scheduleX(0)}
              y1={scheduleY(0)}
              x2={scheduleX(0)}
              y2={scheduleY(1)}
              className="axis-line"
            />
            <path
              d={SCHEDULE_PATHS.linear}
              stroke={MATH_COLORS.primary}
              strokeWidth={scheduleKey === 'linear' ? 2 : 1}
              strokeOpacity={scheduleKey === 'linear' ? 1 : 0.4}
              fill="none"
              className="schedule-curve linear"
            />
            <path
              d={SCHEDULE_PATHS.cosine}
              stroke={MATH_COLORS.secondary}
              strokeWidth={scheduleKey === 'cosine' ? 2 : 1}
              strokeOpacity={scheduleKey === 'cosine' ? 1 : 0.4}
              fill="none"
              className="schedule-curve cosine"
            />
            <path
              d={SCHEDULE_PATHS.sigmoid}
              stroke={MATH_COLORS.accent}
              strokeWidth={scheduleKey === 'sigmoid' ? 2 : 1}
              strokeOpacity={scheduleKey === 'sigmoid' ? 1 : 0.4}
              fill="none"
              className="schedule-curve sigmoid"
            />

            <line
              x1={scheduleX(noiseLevel)}
              y1={scheduleY(0)}
              x2={scheduleX(noiseLevel)}
              y2={scheduleY(1)}
              stroke="#9ca3af"
              strokeDasharray="4 4"
              className="schedule-marker"
            />
            <circle
              cx={scheduleX(noiseLevel)}
              cy={scheduleY(currentAlphaBar)}
              r={4}
              fill="#fff"
              stroke={MATH_COLORS.accent}
            />
          </svg>
          <p className="caption">
            Different schedules control how quickly signal (ᾱ) decays and how
            large the denoising targets become. This toy plot is about signal
            retention, not a claim about real sample quality.
          </p>
        </div>
      </div>
    </section>
      <style jsx>{`
        .score-matching-demo {
          overflow: hidden;
        }

        .score-prediction-panel,
        .diffusion-controls,
        .diffusion-schedule-panel {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(15, 23, 42, 0.78);
          border-radius: 14px;
          padding: 0.85rem;
          min-width: 0;
        }

        .score-prediction-panel {
          margin-bottom: 0.75rem;
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.86));
          border-color: rgba(20, 184, 166, 0.36);
        }

        .score-prediction-panel h3 {
          margin: 0 0 0.35rem;
          color: #f8fafc;
          font-size: 0.96rem;
        }

        .score-prediction-panel p {
          color: #cbd5e1;
          font-size: 0.82rem;
          line-height: 1.5;
          margin: 0 0 0.65rem;
        }

        .score-prediction-options,
        .score-prediction-actions,
        .diffusion-noise-buttons,
        .diffusion-sampling-buttons,
        .pill-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .evidence-strip {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(4, 47, 46, 0.74));
          border: 1px solid rgba(20, 184, 166, 0.26);
          border-radius: 12px;
          display: grid;
          gap: 0.5rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin: 0.7rem 0;
          padding: 0.55rem;
        }

        .evidence-step {
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 10px;
          color: #94a3b8;
          min-width: 0;
          padding: 0.5rem 0.55rem;
        }

        .evidence-step[data-active='true'] {
          background: rgba(20, 184, 166, 0.14);
          border-color: rgba(20, 184, 166, 0.45);
          color: #d1fae5;
        }

        .evidence-step span,
        .evidence-step strong,
        .evidence-step small {
          display: block;
        }

        .evidence-step span {
          align-items: center;
          background: rgba(148, 163, 184, 0.18);
          border-radius: 999px;
          color: #f8fafc;
          display: inline-flex;
          font-size: 0.68rem;
          font-weight: 750;
          height: 1.25rem;
          justify-content: center;
          margin-bottom: 0.32rem;
          width: 1.25rem;
        }

        .evidence-step strong {
          color: #f8fafc;
          font-size: 0.78rem;
          line-height: 1.25;
        }

        .evidence-step small {
          color: inherit;
          font-size: 0.7rem;
          font-weight: 520;
          line-height: 1.35;
          margin-top: 0.2rem;
        }

        .score-prediction-options button,
        .score-prediction-actions button,
        .diffusion-noise-buttons button,
        .diffusion-sampling-buttons button,
        .pill {
          appearance: none;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 9px;
          color: #d9e2ef;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 650;
          padding: 0.5rem 0.7rem;
        }

        .score-prediction-options button[aria-pressed='true'],
        .pill.active {
          border-color: rgba(20, 184, 166, 0.78);
          background: rgba(20, 184, 166, 0.18);
          color: #ccfbf1;
        }

        .score-prediction-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .score-matching-demo button:focus-visible {
          outline: 2px solid #f8fafc;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.35);
        }

        .score-result {
          border: 1px solid rgba(34, 197, 94, 0.38);
          background: rgba(34, 197, 94, 0.12);
          border-radius: 10px;
          color: #f8fafc !important;
          margin-top: 0.75rem !important;
          padding: 0.65rem 0.75rem;
        }

        .score-formula {
          color: #dbeafe !important;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .diffusion-layout {
          display: grid;
          grid-template-columns: minmax(340px, 1fr) minmax(230px, 0.78fr);
          gap: 1rem;
          align-items: start;
        }

        .diffusion-chart,
        .schedule-chart {
          display: block;
          max-width: 100%;
          height: auto;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: #0f172a;
        }

        .diffusion-controls {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .caption {
          color: #9ca3af;
          font-size: 0.78rem;
          line-height: 1.5;
          margin: 0.55rem 0 0;
        }

        .diffusion-stats {
          display: grid;
          gap: 0.35rem;
          color: #e5e7eb;
          font-size: 0.82rem;
        }

        .label {
          color: #9ca3af;
        }

        .toggle {
          align-items: center;
          color: #d9e2ef;
          display: flex;
          font-size: 0.82rem;
          gap: 0.45rem;
        }

        .schedule-header {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 0.7rem;
          justify-content: space-between;
          margin-bottom: 0.65rem;
        }

        .schedule-layout {
          display: grid;
          grid-template-columns: minmax(220px, auto) minmax(180px, 1fr);
          gap: 0.8rem;
          align-items: center;
        }

        .axis-line {
          stroke: rgba(226, 232, 240, 0.34);
          stroke-width: 1;
        }

        .score-arrow {
          stroke-linecap: round;
        }

        .noise-residual {
          stroke: #f59e0b;
          stroke-width: 2;
          stroke-dasharray: 4 4;
        }

        .score-target-arrow {
          stroke: #22c55e;
          stroke-width: 3;
          stroke-linecap: round;
        }

        .clean-anchor {
          fill: rgba(226, 232, 240, 0.28);
          stroke: #f8fafc;
          stroke-width: 1.5;
        }

        .probe-noisy-point {
          fill: #f59e0b;
          stroke: #020617;
          stroke-width: 1.5;
        }

        @media (max-width: 820px) {
          .diffusion-layout,
          .schedule-layout,
          .evidence-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </>
  )
}
