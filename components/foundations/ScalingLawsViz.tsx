import { useCallback, useEffect, useMemo, useState } from 'react'

type PredictionChoice = 'emerges' | 'not-yet';
type GamePhase = 'setup' | 'countdown' | 'animating' | 'revealed';

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

const MAIN_WIDTH = 320
const MAIN_HEIGHT = 220
const ISO_WIDTH = 320
const ISO_HEIGHT = 220
const EMERGENT_WIDTH = 280
const EMERGENT_HEIGHT = 180
const PADDING = 28

const C_MIN = 20
const C_MAX = 26

// Chinchilla-style: roughly constant tokens-per-parameter at the frontier
const TOKENS_PER_PARAM_OPT = 20

// Kaplan-style scaling law parameters (toy but plausible)
const ALPHA = 0.076 // parameter exponent
const BETA = 0.095 // data exponent
const L_INF = 1.0 // irreducible loss
const A_PARAMS = 2.0
const B_DATA = 4.0

const ISO_GRID_COLS = 28
const ISO_GRID_ROWS = 28

type CapabilityKey = 'arithmetic' | 'coding' | 'reasoning' | 'translation'

interface CapabilityConfig {
  key: CapabilityKey
  label: string
  thresholdLogC: number
  slope: number
  maxAccuracy: number
}

interface ModelPoint {
  name: string
  logC: number
  params: number
  tokens: number
}

interface LossDecomposition {
  label: string
  L_inf: number
  L_params: number
  L_data: number
  total: number
}

interface IsoCell {
  col: number
  row: number
  logN: number
  logD: number
  loss: number
}

const CAPABILITIES: Record<CapabilityKey, CapabilityConfig> = {
  arithmetic: {
    key: 'arithmetic',
    label: '2–3 digit arithmetic',
    thresholdLogC: 22.0,
    slope: 5.5,
    maxAccuracy: 90,
  },
  coding: {
    key: 'coding',
    label: 'Code generation',
    thresholdLogC: 23.3,
    slope: 5.0,
    maxAccuracy: 85,
  },
  reasoning: {
    key: 'reasoning',
    label: 'Multi-step reasoning',
    thresholdLogC: 24.0,
    slope: 5.0,
    maxAccuracy: 80,
  },
  translation: {
    key: 'translation',
    label: 'Machine translation',
    thresholdLogC: 21.5,
    slope: 5.0,
    maxAccuracy: 92,
  },
}

const CAPABILITY_ORDER: CapabilityKey[] = [
  'arithmetic',
  'coding',
  'reasoning',
  'translation',
]

// Very rough positions for “named” models in compute space
const MODEL_POINTS: ModelPoint[] = [
  {
    name: 'GPT‑2',
    logC: 20.7,
    params: 1.5e9,
    tokens: 4e10,
  },
  {
    name: 'GPT‑3',
    logC: 23.1,
    params: 1.75e11,
    tokens: 3e11,
  },
  {
    name: 'GPT‑4‑scale',
    logC: 25.0,
    params: 5e11,
    tokens: 1e12,
  },
]

const GPT3_PARAMS = 1.75e11
const GPT3_TOKENS = 3e11
const GPT3_COMPUTE = GPT3_PARAMS * GPT3_TOKENS

// Fun compute scale presets
const COMPUTE_PRESETS = [
  { name: '🔬 GPT-2 Scale', logC: 20.7, description: '~1.5B params, 40B tokens - early decoder-only era' },
  { name: '🚀 GPT-3 Scale', logC: 23.1, description: '~175B params, 300B tokens - benchmark metrics can change sharply' },
  { name: '🐱 Chinchilla', logC: 23.5, description: '70B params, 1.4T tokens - compute-optimal frontier' },
  { name: '🌟 GPT-4 Scale', logC: 25.0, description: '~500B+ params - schematic frontier-scale checkpoint' },
  { name: '🔮 Future', logC: 25.8, description: 'Hypothetical 10x GPT-4 compute budget' },
]

// Challenge scenarios for prediction game - test metric cutoffs
const CHALLENGE_SCENARIOS = [
  { name: '🎲 Mystery 10^21.5', logC: 21.5, capability: 'arithmetic' as CapabilityKey, hint: 'Below GPT-3 scale...' },
  { name: '🎲 Mystery 10^22.5', logC: 22.5, capability: 'coding' as CapabilityKey, hint: 'Near the threshold...' },
  { name: '🎲 Mystery 10^23.8', logC: 23.8, capability: 'reasoning' as CapabilityKey, hint: 'Just below the reasoning cutoff?' },
  { name: '🎲 Mystery 10^24.2', logC: 24.2, capability: 'reasoning' as CapabilityKey, hint: 'Does the reasoning metric cross the cutoff here?' },
];

// Educational feedback for metric-cutoff predictions
function getPredictionFeedback(
  prediction: PredictionChoice,
  capability: CapabilityKey,
  logC: number,
  actualAccuracy: number
): string {
  const cfg = CAPABILITIES[capability];
  const emerged = actualAccuracy >= 50;
  const wasCorrect = (prediction === 'emerges' && emerged) || (prediction === 'not-yet' && !emerged);
  const distanceFromThreshold = logC - cfg.thresholdLogC;

  if (wasCorrect) {
    if (emerged) {
      return `Correct! At 10^${logC.toFixed(1)} FLOPS, the toy ${cfg.label} metric crosses the >=50% cutoff (${actualAccuracy.toFixed(0)}% accuracy). The cutoff is ~10^${cfg.thresholdLogC.toFixed(1)}, so this point is ${Math.abs(distanceFromThreshold).toFixed(1)} orders of magnitude past it.`;
    }
    return `Correct! At 10^${logC.toFixed(1)} FLOPS, the toy ${cfg.label} metric is below the >=50% cutoff (${actualAccuracy.toFixed(0)}% accuracy). The cutoff is ~10^${cfg.thresholdLogC.toFixed(1)}; this point is ${Math.abs(distanceFromThreshold).toFixed(1)} orders of magnitude below it.`;
  }

  // Wrong predictions
  if (emerged) {
    return `Surprise - the toy metric crossed the cutoff. At 10^${logC.toFixed(1)} FLOPS, ${cfg.label} shows ${actualAccuracy.toFixed(0)}% accuracy. The cutoff is ~10^${cfg.thresholdLogC.toFixed(1)}, and a thresholded display can change quickly near that point.`;
  }
  return `Below cutoff. At 10^${logC.toFixed(1)} FLOPS, the toy ${cfg.label} metric is ${actualAccuracy.toFixed(0)}% accuracy. The smooth sigmoid crosses near 10^${cfg.thresholdLogC.toFixed(1)}; this point is ${Math.abs(distanceFromThreshold).toFixed(1)} orders of magnitude below it.`;
}

// Dynamic educational insight based on compute scale
function getScalingInsight(logC: number, metricMode: 'loss' | 'accuracy', selectedCapability: CapabilityKey): { text: string; color: string; emoji: string } {
  const cfg = CAPABILITIES[selectedCapability]
  const capabilityThreshold = cfg.thresholdLogC

  if (logC < 21) {
    return {
      emoji: '📉',
      color: '#ef4444',
      text: 'Very small scale! Loss is dominated by insufficient model capacity. These toy thresholded metrics remain below their cutoffs.'
    }
  }

  if (logC < capabilityThreshold - 1) {
    return {
      emoji: '🔍',
      color: '#f59e0b',
      text: `Below the ${cfg.label} metric threshold. Loss can improve smoothly while a thresholded metric has not crossed its cutoff yet.`
    }
  }

  if (logC >= capabilityThreshold - 1 && logC < capabilityThreshold + 0.5) {
    return {
      emoji: '⚡',
      color: '#8b5cf6',
      text: `Near the ${cfg.label} metric threshold. A smooth sigmoid can produce a sharp-looking threshold crossing.`
    }
  }

  if (logC >= capabilityThreshold + 0.5 && logC < 24.5) {
    return {
      emoji: '🎯',
      color: '#22c55e',
      text: `${cfg.label} has crossed the toy metric cutoff. The Chinchilla insight: optimal allocation means ~20 tokens per parameter in this schematic.`
    }
  }

  if (logC >= 24.5) {
    return {
      emoji: '🌟',
      color: '#0ea5e9',
      text: 'Frontier-scale schematic: multiple toy thresholded metrics are high. The irreducible loss floor becomes visible, and further scaling shows diminishing returns per 10x compute.'
    }
  }

  return {
    emoji: '📊',
    color: '#64748b',
    text: `Compute: 10^${logC.toFixed(1)} FLOPS. The Kaplan scaling law L = L∞ + A/N^α + B/D^β shows how loss decomposes into irreducible, capacity, and data terms.`
  }
}

function optimalAllocation(C: number) {
  // Keep tokens-per-parameter roughly constant at the Chinchilla frontier
  const N_opt = Math.sqrt(C / TOKENS_PER_PARAM_OPT)
  const D_opt = N_opt * TOKENS_PER_PARAM_OPT
  return { N_opt, D_opt }
}

function lossDecompositionFromND(N: number, D: number): LossDecomposition {
  const L_params = A_PARAMS * Math.pow(N, -ALPHA)
  const L_data = B_DATA * Math.pow(D, -BETA)
  const total = L_INF + L_params + L_data
  return {
    label: '',
    L_inf: L_INF,
    L_params,
    L_data,
    total,
  }
}

function lossAtCompute(C: number): number {
  const { N_opt, D_opt } = optimalAllocation(C)
  const { total } = lossDecompositionFromND(N_opt, D_opt)
  return total
}

function capabilityAccuracy(C: number, key: CapabilityKey): number {
  const cfg = CAPABILITIES[key]
  const logC = Math.log10(C)
  const x = logC - cfg.thresholdLogC
  const t = 1 / (1 + Math.exp(-cfg.slope * x))
  return cfg.maxAccuracy * t
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) {
    return { r: 0, g: 0, b: 0 }
  }
  const r = parseInt(cleaned.slice(0, 2), 16)
  const g = parseInt(cleaned.slice(2, 4), 16)
  const b = parseInt(cleaned.slice(4, 6), 16)
  return { r, g, b }
}

function interpolateColor(c1: string, c2: string, t: number): string {
  const rgb1 = hexToRgb(c1)
  const rgb2 = hexToRgb(c2)
  const clamped = Math.min(1, Math.max(0, t))
  const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * clamped)
  const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * clamped)
  const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * clamped)
  return `rgb(${r}, ${g}, ${b})`
}

function formatScientific(value: number): string {
  if (!isFinite(value) || value <= 0) return '—'
  const exp = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exp)
  return `${mantissa.toFixed(2)} × 10^${exp}`
}

function formatExponent10(exp: number): string {
  return `10^${exp.toFixed(0)}`
}

function LossBreakdownBar({ breakdown }: { breakdown: LossDecomposition }) {
  const total = breakdown.L_inf + breakdown.L_params + breakdown.L_data
  if (!isFinite(total) || total <= 0) return null

  const pInf = (breakdown.L_inf / total) * 100
  const pParams = (breakdown.L_params / total) * 100
  const pData = (breakdown.L_data / total) * 100

  return (
    <div className="loss-breakdown">
      <div className="loss-breakdown-header">
        <span className="label">{breakdown.label}</span>
        <span className="value">L ≈ {total.toFixed(3)}</span>
      </div>
      <div
        className="loss-breakdown-bar"
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 9999,
          overflow: 'hidden',
          background: '#e5e7eb',
          marginBottom: 4,
        }}
      >
        <div
          style={{
            flex: breakdown.L_inf,
            background: '#d4d4d8',
          }}
        />
        <div
          style={{
            flex: breakdown.L_params,
            background: MATH_COLORS.primary,
          }}
        />
        <div
          style={{
            flex: breakdown.L_data,
            background: MATH_COLORS.secondary,
          }}
        />
      </div>
      <div
        className="loss-breakdown-legend"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '0.7rem',
          opacity: 0.8,
        }}
      >
        <span>Irreducible ~{pInf.toFixed(0)}%</span>
        <span>Params ~{pParams.toFixed(0)}%</span>
        <span>Data ~{pData.toFixed(0)}%</span>
      </div>
    </div>
  )
}

export default function ScalingLawsDemo() {
  const [logCompute, setLogCompute] = useState<number>(23)
  const [metricMode, setMetricMode] = useState<'loss' | 'accuracy'>('loss')
  const [yScaleMode, setYScaleMode] = useState<'log' | 'linear'>('log')
  const [selectedCapability, setSelectedCapability] =
    useState<CapabilityKey>('reasoning')
  const [activePreset, setActivePreset] = useState<string | null>('🚀 GPT-3 Scale')

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<PredictionChoice | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<PredictionChoice | null>(null)
  const [challengeLogC, setChallengeLogC] = useState<number | null>(null)
  const [challengeCapability, setChallengeCapability] = useState<CapabilityKey | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [animatedLogC, setAnimatedLogC] = useState<number>(20)

  const currentInsight = useMemo(
    () => getScalingInsight(logCompute, metricMode, selectedCapability),
    [logCompute, metricMode, selectedCapability]
  )

  const handlePreset = useCallback((preset: typeof COMPUTE_PRESETS[0]) => {
    setLogCompute(preset.logC)
    setActivePreset(preset.name)
  }, [])

  const handleSliderChange = useCallback((value: number) => {
    setLogCompute(value)
    setActivePreset(null)
  }, [])

  // Prediction game handlers
  const applyChallenge = useCallback((scenario: typeof CHALLENGE_SCENARIOS[number]) => {
    setChallengeLogC(scenario.logC)
    setChallengeCapability(scenario.capability)
    setActiveChallenge(scenario.name)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setAnimatedLogC(20) // Start animation from low compute
  }, [])

  const startChallenge = useCallback(() => {
    if (!prediction || challengeLogC === null) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
    setAnimatedLogC(20) // Reset animation start
  }, [prediction, challengeLogC])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setChallengeLogC(null)
    setChallengeCapability(null)
    setActiveChallenge(null)
    setAnimatedLogC(20)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 700)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('animating')
      setAnimatedLogC(20)
    }
  }, [gamePhase, countdown])

  // Animation effect - sweep compute from 20 to challengeLogC
  useEffect(() => {
    if (gamePhase !== 'animating' || challengeLogC === null) return

    const animationDuration = 2500 // ms
    const startTime = performance.now()
    const startLogC = 20
    const endLogC = challengeLogC

    let rafId = 0
    let cancelled = false

    const animate = (now: number) => {
      if (cancelled) return
      const elapsed = now - startTime
      const progress = Math.min(1, elapsed / animationDuration)
      // Ease out curve for dramatic reveal
      const easedProgress = 1 - Math.pow(1 - progress, 3)
      const currentLogC = startLogC + (endLogC - startLogC) * easedProgress
      setAnimatedLogC(currentLogC)

      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      } else {
        setGamePhase('revealed')
      }
    }
    rafId = requestAnimationFrame(animate)

    return () => {
      cancelled = true
      cancelAnimationFrame(rafId)
    }
  }, [gamePhase, challengeLogC])

  // Compute actual accuracy for prediction result
  const actualAccuracy = useMemo(() => {
    if (challengeLogC === null || challengeCapability === null) return 0
    const C = Math.pow(10, challengeLogC)
    return capabilityAccuracy(C, challengeCapability)
  }, [challengeLogC, challengeCapability])

  const predictionCorrect = useMemo(() => {
    if (!lockedPrediction || challengeLogC === null) return false
    const emerged = actualAccuracy >= 50
    return (lockedPrediction === 'emerges' && emerged) || (lockedPrediction === 'not-yet' && !emerged)
  }, [lockedPrediction, actualAccuracy, challengeLogC])

  const computeBudget = useMemo(
    () => Math.pow(10, logCompute),
    [logCompute]
  )

  // Main scaling curve (Kaplan-style loss vs compute)
  const scalingCurve = useMemo(() => {
    const points: { logC: number; loss: number }[] = []
    let lossMin = Number.POSITIVE_INFINITY
    let lossMax = Number.NEGATIVE_INFINITY

    const steps = 96
    for (let i = 0; i <= steps; i++) {
      const logCVal = C_MIN + ((C_MAX - C_MIN) * i) / steps
      const C = Math.pow(10, logCVal)
      const L = lossAtCompute(C)
      points.push({ logC: logCVal, loss: L })
      if (L < lossMin) lossMin = L
      if (L > lossMax) lossMax = L
    }

    return { points, lossMin, lossMax }
  }, [])

  // Loss landscape in (N, D) for iso-compute view
  const isoGrid = useMemo(() => {
    const cells: IsoCell[] = []
    let minLoss = Number.POSITIVE_INFINITY
    let maxLoss = Number.NEGATIVE_INFINITY

    const logNMin = 8
    const logNMax = 13
    const logDMin = 8
    const logDMax = 13

    for (let col = 0; col < ISO_GRID_COLS; col++) {
      const logN =
        logNMin +
        ((logNMax - logNMin) * col) / Math.max(1, ISO_GRID_COLS - 1)
      const N = Math.pow(10, logN)
      for (let row = 0; row < ISO_GRID_ROWS; row++) {
        const logD =
          logDMin +
          ((logDMax - logDMin) * row) / Math.max(1, ISO_GRID_ROWS - 1)
        const D = Math.pow(10, logD)
        const { total } = lossDecompositionFromND(N, D)
        minLoss = Math.min(minLoss, total)
        maxLoss = Math.max(maxLoss, total)
        cells.push({ col, row, logN, logD, loss: total })
      }
    }

    return {
      cells,
      minLoss,
      maxLoss,
      logNMin,
      logNMax,
      logDMin,
      logDMax,
    }
  }, [])

  const { N_opt, D_opt } = optimalAllocation(computeBudget)
  const optDecompRaw = lossDecompositionFromND(N_opt, D_opt)

  // Under-trained vs over-trained scenarios at the current compute budget
  const factor = 10 // how far we move away from the frontier
  const N_paramHeavy = N_opt * factor
  const D_paramHeavy = computeBudget / N_paramHeavy
  const N_dataHeavy = computeBudget / (D_opt * factor)
  const D_dataHeavy = D_opt * factor

  const paramHeavyDecompRaw = lossDecompositionFromND(
    N_paramHeavy,
    D_paramHeavy
  )
  const dataHeavyDecompRaw = lossDecompositionFromND(
    N_dataHeavy,
    D_dataHeavy
  )

  // GPT‑3-style vs Chinchilla optimal at the same compute
  const gpt3DecompRaw = lossDecompositionFromND(GPT3_PARAMS, GPT3_TOKENS)
  const gpt3Opt = optimalAllocation(GPT3_COMPUTE)
  const gpt3OptDecompRaw = lossDecompositionFromND(
    gpt3Opt.N_opt,
    gpt3Opt.D_opt
  )

  const efficiencyGain =
    gpt3DecompRaw.total > 0
      ? ((gpt3DecompRaw.total - gpt3OptDecompRaw.total) /
          gpt3DecompRaw.total) *
        100
      : 0

  const activeCapability = CAPABILITIES[selectedCapability]
  const activeMetricLabel =
    metricMode === 'loss'
      ? 'Language modeling loss'
      : `${activeCapability.label} accuracy`

  const xMain = (logCVal: number) => {
    const t = (logCVal - C_MIN) / (C_MAX - C_MIN)
    return (
      PADDING + t * (MAIN_WIDTH - 2 * PADDING)
    )
  }

  const yMain = (value: number) => {
    if (!isFinite(value)) {
      return MAIN_HEIGHT - PADDING
    }

    if (metricMode === 'loss') {
      const min = scalingCurve.lossMin * 0.9
      const max = scalingCurve.lossMax * 1.05
      if (yScaleMode === 'log') {
        const safeMin = Math.max(min, 1e-3)
        const safeVal = Math.max(value, safeMin)
        const logMin = Math.log10(safeMin)
        const logMax = Math.log10(max)
        const logVal = Math.log10(safeVal)
        const t = (logVal - logMin) / (logMax - logMin)
        return (
          MAIN_HEIGHT - PADDING - t * (MAIN_HEIGHT - 2 * PADDING)
        )
      } else {
        const t = (value - min) / (max - min)
        return (
          MAIN_HEIGHT - PADDING - t * (MAIN_HEIGHT - 2 * PADDING)
        )
      }
    } else {
      // Accuracy mode: 0–100%
      const min = 0
      const max = 100
      const clamped = Math.min(max, Math.max(min, value))
      if (yScaleMode === 'log') {
        const safeMin = 1
        const safeVal = Math.max(safeMin, clamped)
        const logMin = Math.log10(safeMin)
        const logMax = Math.log10(max)
        const logVal = Math.log10(safeVal)
        const t = (logVal - logMin) / (logMax - logMin)
        return (
          MAIN_HEIGHT - PADDING - t * (MAIN_HEIGHT - 2 * PADDING)
        )
      } else {
        const t = (clamped - min) / (max - min)
        return (
          MAIN_HEIGHT - PADDING - t * (MAIN_HEIGHT - 2 * PADDING)
        )
      }
    }
  }

  const xEmergent = (logCVal: number) => {
    const t = (logCVal - C_MIN) / (C_MAX - C_MIN)
    return (
      PADDING + t * (EMERGENT_WIDTH - 2 * PADDING)
    )
  }

  const yEmergent = (accuracy: number) => {
    const min = 0
    const max = 100
    const clamped = Math.min(max, Math.max(min, accuracy))
    const t = (clamped - min) / (max - min)
    return (
      EMERGENT_HEIGHT - PADDING - t * (EMERGENT_HEIGHT - 2 * PADDING)
    )
  }

  const xIso = (logN: number) => {
    const { logNMin, logNMax } = isoGrid
    const t = (logN - logNMin) / (logNMax - logNMin)
    return (
      PADDING + t * (ISO_WIDTH - 2 * PADDING)
    )
  }

  const yIso = (logD: number) => {
    const { logDMin, logDMax } = isoGrid
    const t = (logD - logDMin) / (logDMax - logDMin)
    return (
      ISO_HEIGHT - PADDING - t * (ISO_HEIGHT - 2 * PADDING)
    )
  }

  const mainPathD = scalingCurve.points
    .map((pt, i) => {
      const C = Math.pow(10, pt.logC)
      const metricValue =
        metricMode === 'loss'
          ? pt.loss
          : capabilityAccuracy(C, selectedCapability)
      const x = xMain(pt.logC)
      const y = yMain(metricValue)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Iso-compute curves for a couple of fixed budgets plus the current slider
  const isoComputeLevels = [21, 23, 25]
  const allIsoLevels = [...new Set([...isoComputeLevels, logCompute])]

  const isoPaths = allIsoLevels.map((logCVal) => {
    const C = Math.pow(10, logCVal)
    const points: { x: number; y: number }[] = []
    const steps = 80
    for (let i = 0; i <= steps; i++) {
      const logN =
        isoGrid.logNMin +
        ((isoGrid.logNMax - isoGrid.logNMin) * i) /
          Math.max(1, steps)
      const logD = Math.log10(C) - logN
      if (
        logD < isoGrid.logDMin ||
        logD > isoGrid.logDMax
      ) {
        continue
      }
      points.push({ x: xIso(logN), y: yIso(logD) })
    }
    const d = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
    const isActive = Math.abs(logCVal - logCompute) < 1e-6
    return { logC: logCVal, d, isActive }
  })

  const chinchillaFrontierPath = (() => {
    const points: { x: number; y: number }[] = []
    const logRatio = Math.log10(TOKENS_PER_PARAM_OPT)
    const steps = 80
    for (let i = 0; i <= steps; i++) {
      const logN =
        isoGrid.logNMin +
        ((isoGrid.logNMax - isoGrid.logNMin) * i) /
          Math.max(1, steps)
      const logD = logN + logRatio
      if (
        logD < isoGrid.logDMin ||
        logD > isoGrid.logDMax
      ) {
        continue
      }
      points.push({ x: xIso(logN), y: yIso(logD) })
    }
    return points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
  })()

  const currentOptDecomp: LossDecomposition = {
    ...optDecompRaw,
    label: 'At Chinchilla frontier (your budget)',
  }

  const currentParamHeavyDecomp: LossDecomposition = {
    ...paramHeavyDecompRaw,
    label: 'Too many params (under-trained)',
  }

  const currentDataHeavyDecomp: LossDecomposition = {
    ...dataHeavyDecompRaw,
    label: 'Too many tokens (over-trained)',
  }

  const gpt3Decomp: LossDecomposition = {
    ...gpt3DecompRaw,
    label: 'GPT‑3 style (param-heavy)',
  }

  const gpt3OptDecomp: LossDecomposition = {
    ...gpt3OptDecompRaw,
    label: 'Chinchilla-optimal at GPT‑3 compute',
  }

  return (
    <section className="card interactive-card">
      <h2>🎯 Scaling Laws & Thresholded Metrics</h2>
      <p className="muted">
        Explore how loss falls as a power law with compute, how
        thresholded metrics can look abrupt at scale, and why Chinchilla-style
        training balances parameters and data.
      </p>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.05))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '8px' }}>
            🧪 <strong>Metric-cutoff challenge:</strong> Pick a mystery compute budget:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CHALLENGE_SCENARIOS.map(scenario => (
              <button
                key={scenario.name}
                onClick={() => applyChallenge(scenario)}
                disabled={gamePhase === 'animating' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge === scenario.name
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'rgba(139, 92, 246, 0.1)',
                  border: `1px solid ${activeChallenge === scenario.name ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'animating' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'animating' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={scenario.hint}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && challengeLogC !== null && challengeCapability && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Compute: <strong>10^{challengeLogC.toFixed(1)} FLOPS</strong> | Testing: <strong>{CAPABILITIES[challengeCapability].label}</strong>
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>Will the toy {CAPABILITIES[challengeCapability].label} metric cross the cutoff (&ge;50% accuracy)?</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPrediction('emerges')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'emerges' ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'emerges' ? '#22c55e' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: '1rem',
                  fontWeight: prediction === 'emerges' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                🚀 CROSSES CUTOFF (&ge;50%)
              </button>
              <button
                onClick={() => setPrediction('not-yet')}
                style={{
                  padding: '12px 24px',
                  background: prediction === 'not-yet' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                  border: `2px solid ${prediction === 'not-yet' ? '#ef4444' : 'rgba(255, 255, 255, 0.1)'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  fontSize: '1rem',
                  fontWeight: prediction === 'not-yet' ? 600 : 400,
                  cursor: 'pointer',
                }}
              >
                ⏳ BELOW CUTOFF (&lt;50%)
              </button>
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #8b5cf6, #7c3aed)'
                  : 'rgba(139, 92, 246, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              🔬 Scale Up & See!
            </button>
          </div>
        )}

        {/* No challenge selected */}
        {gamePhase === 'setup' && !activeChallenge && (
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>
            👆 Select a mystery compute budget above to test your intuition about metric cutoffs!
          </p>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#8b5cf6',
              textShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
            }}>
              {countdown === 0 ? 'SCALING...' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
              Your prediction: <strong style={{ color: lockedPrediction === 'emerges' ? '#22c55e' : '#ef4444' }}>
                {lockedPrediction === 'emerges' ? '🚀 CROSSES CUTOFF' : '⏳ BELOW CUTOFF'}
              </strong>
            </p>
          </div>
        )}

        {/* Animating phase */}
        {gamePhase === 'animating' && challengeCapability && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: '#e5e7eb', marginBottom: '8px' }}>
              ⚡ Scaling compute... 10^{animatedLogC.toFixed(1)} FLOPS
            </p>
            <div style={{
              height: '8px',
              background: 'rgba(139, 92, 246, 0.2)',
              borderRadius: '4px',
              overflow: 'hidden',
              marginBottom: '8px',
            }}>
              <div style={{
                height: '100%',
                width: `${((animatedLogC - 20) / ((challengeLogC ?? 25) - 20)) * 100}%`,
                background: 'linear-gradient(90deg, #8b5cf6, #f59e0b)',
                transition: 'width 50ms linear',
              }} />
            </div>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: lockedPrediction === 'emerges' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
            }}>
              Your pick: <strong>{lockedPrediction === 'emerges' ? '🚀 CROSSES CUTOFF' : '⏳ BELOW CUTOFF'}</strong>
            </div>
            <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#9ca3af' }}>
              {CAPABILITIES[challengeCapability].label} accuracy: {capabilityAccuracy(Math.pow(10, animatedLogC), challengeCapability).toFixed(0)}%
            </div>
          </div>
        )}

        {/* Revealed phase */}
        {gamePhase === 'revealed' && challengeLogC !== null && challengeCapability && (
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
                {CAPABILITIES[challengeCapability].label}: <strong style={{
                  color: actualAccuracy >= 50 ? '#22c55e' : '#ef4444'
                }}>
                  {actualAccuracy.toFixed(0)}% accuracy {actualAccuracy >= 50 ? '✅ CROSSED CUTOFF' : '⏳ BELOW CUTOFF'}
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
              💡 {getPredictionFeedback(lockedPrediction!, challengeCapability, challengeLogC, actualAccuracy)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(139, 92, 246, 0.2)',
                border: '1px solid rgba(139, 92, 246, 0.4)',
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

      {/* Compute Scale Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {COMPUTE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => handlePreset(preset)}
            title={preset.description}
            style={{
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: activePreset === preset.name ? '1px solid rgba(245, 158, 11, 0.7)' : '1px solid rgba(148, 163, 184, 0.35)',
              background: activePreset === preset.name ? 'rgba(245, 158, 11, 0.2)' : 'rgba(15, 23, 42, 0.6)',
              color: activePreset === preset.name ? '#fbbf24' : '#d1d5db',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: activePreset === preset.name ? 600 : 400,
              transition: 'all 0.15s ease',
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '1rem',
          borderRadius: '8px',
          background: `linear-gradient(135deg, ${currentInsight.color}15 0%, ${currentInsight.color}08 100%)`,
          border: `1px solid ${currentInsight.color}30`,
        }}
      >
        <span style={{ fontSize: '1.2em', marginRight: '8px' }}>{currentInsight.emoji}</span>
        <span style={{ color: currentInsight.color, fontWeight: 500 }}>Insight:</span>{' '}
        <span style={{ color: '#d1d5db' }}>{currentInsight.text}</span>
      </div>

      {/* Global controls */}
      <div className="scaling-controls">
        <label className="slider-label">
          Total training compute (FLOPs) — log₁₀ C
          <input
            type="range"
            min={C_MIN}
            max={C_MAX}
            step={0.1}
            value={logCompute}
            onChange={(e) => handleSliderChange(parseFloat(e.target.value))}
          />
          <div className="caption">
            Current budget: C ≈ {formatExponent10(logCompute)} FLOPs
            (≈ {formatScientific(computeBudget)})
          </div>
        </label>
        <div className="scaling-toggle-row">
          <div className="toggle-group">
            <span className="label">Metric:</span>
            <button
              type="button"
              className={
                metricMode === 'loss' ? 'chip active' : 'chip'
              }
              onClick={() => setMetricMode('loss')}
            >
              Loss
            </button>
            <button
              type="button"
              className={
                metricMode === 'accuracy'
                  ? 'chip active'
                  : 'chip'
              }
              onClick={() => setMetricMode('accuracy')}
            >
              Task accuracy
            </button>
          </div>
          <div className="toggle-group">
            <span className="label">Y scale:</span>
            <button
              type="button"
              className={
                yScaleMode === 'log' ? 'chip active' : 'chip'
              }
              onClick={() => setYScaleMode('log')}
            >
              Log
            </button>
            <button
              type="button"
              className={
                yScaleMode === 'linear'
                  ? 'chip active'
                  : 'chip'
              }
              onClick={() => setYScaleMode('linear')}
            >
              Linear
            </button>
          </div>
          <div className="toggle-group">
            <span className="label">Capability:</span>
            <select
              value={selectedCapability}
              onChange={(e) =>
                setSelectedCapability(
                  e.target.value as CapabilityKey
                )
              }
            >
              {CAPABILITY_ORDER.map((key) => (
                <option key={key} value={key}>
                  {CAPABILITIES[key].label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="scaling-layout">
        {/* Main scaling plot */}
        <div className="panel main-scaling">
          <h3 className="panel-title">
            1. Scaling law: {activeMetricLabel} vs compute
          </h3>
          <svg
            width={MAIN_WIDTH}
            height={MAIN_HEIGHT}
            className="scaling-chart"
            role="img"
            aria-label="Scaling law: loss or accuracy vs compute"
          >
            {/* Axes */}
            <line
              x1={xMain(C_MIN)}
              y1={yMain(
                metricMode === 'loss' ? scalingCurve.lossMin : 0
              )}
              x2={xMain(C_MAX)}
              y2={yMain(
                metricMode === 'loss' ? scalingCurve.lossMin : 0
              )}
              className="axis-line"
            />
            <line
              x1={xMain(C_MIN)}
              y1={PADDING}
              x2={xMain(C_MIN)}
              y2={MAIN_HEIGHT - PADDING}
              className="axis-line"
            />

            {/* X ticks */}
            {[20, 22, 24, 26].map((tick) => (
              <g key={tick}>
                <line
                  x1={xMain(tick)}
                  y1={MAIN_HEIGHT - PADDING}
                  x2={xMain(tick)}
                  y2={MAIN_HEIGHT - PADDING + 4}
                  className="axis-tick"
                />
                <text
                  x={xMain(tick)}
                  y={MAIN_HEIGHT - PADDING + 16}
                  textAnchor="middle"
                  className="axis-label"
                >
                  {formatExponent10(tick)}
                </text>
              </g>
            ))}

            {/* Main scaling curve */}
            <path
              d={mainPathD}
              fill="none"
              className="scaling-curve"
              stroke={MATH_COLORS.secondary}
              strokeWidth={2}
            />

            {/* Current compute budget line */}
            <line
              x1={xMain(logCompute)}
              x2={xMain(logCompute)}
              y1={PADDING}
              y2={MAIN_HEIGHT - PADDING}
              stroke={MATH_COLORS.accent}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <text
              x={xMain(logCompute)}
              y={PADDING + 10}
              textAnchor="end"
              className="axis-label"
            >
              Your budget
            </text>

            {/* Model points */}
            {MODEL_POINTS.map((m) => {
              const C = Math.pow(10, m.logC)
              const metricValue =
                metricMode === 'loss'
                  ? lossAtCompute(C)
                  : capabilityAccuracy(C, selectedCapability)
              const x = xMain(m.logC)
              const y = yMain(metricValue)
              return (
                <g key={m.name}>
                  <circle
                    cx={x}
                    cy={y}
                    r={4}
                    fill={MATH_COLORS.primary}
                    stroke="#111827"
                    strokeWidth={0.5}
                  />
                  <text
                    x={x + 6}
                    y={y - 6}
                    className="axis-label"
                  >
                    {m.name}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="caption">
            On log–log axes the curve is almost a straight line:
            predictable power-law improvement across many orders of
            magnitude. The orange dots are approximate GPT‑scale
            checkpoints; the slider moves a vertical line showing your
            chosen compute budget.
          </p>
        </div>

        {/* Thresholded metrics panel + compute calculator column */}
        <div className="panel right-column">
          <div className="subpanel emergent-panel">
            <h3 className="panel-title">
              3. Thresholded metrics: smooth curves, sharp display
            </h3>
            <svg
              width={EMERGENT_WIDTH}
              height={EMERGENT_HEIGHT}
              className="emergent-chart"
              role="img"
              aria-label="Thresholded task accuracies vs model scale"
            >
              {/* Axes */}
              <line
                x1={xEmergent(C_MIN)}
                y1={yEmergent(0)}
                x2={xEmergent(C_MAX)}
                y2={yEmergent(0)}
                className="axis-line"
              />
              <line
                x1={xEmergent(C_MIN)}
                y1={yEmergent(0)}
                x2={xEmergent(C_MIN)}
                y2={yEmergent(100)}
                className="axis-line"
              />

              {/* Y ticks */}
              {[0, 50, 100].map((tick) => (
                <g key={tick}>
                  <line
                    x1={xEmergent(C_MIN)}
                    y1={yEmergent(tick)}
                    x2={xEmergent(C_MIN) - 4}
                    y2={yEmergent(tick)}
                    className="axis-tick"
                  />
                  <text
                    x={xEmergent(C_MIN) - 8}
                    y={yEmergent(tick) + 4}
                    textAnchor="end"
                    className="axis-label"
                  >
                    {tick}%
                  </text>
                </g>
              ))}

              {/* Capability curves */}
              {CAPABILITY_ORDER.map((key) => {
                const _cfg = CAPABILITIES[key]
                const steps = 80
                const path = []
                for (let i = 0; i <= steps; i++) {
                  const logCVal =
                    C_MIN +
                    ((C_MAX - C_MIN) * i) / Math.max(1, steps)
                  const C = Math.pow(10, logCVal)
                  const acc = capabilityAccuracy(C, key)
                  const x = xEmergent(logCVal)
                  const y = yEmergent(acc)
                  path.push(
                    `${i === 0 ? 'M' : 'L'} ${x} ${y}`
                  )
                }
                const isActive = key === selectedCapability
                const stroke =
                  key === 'reasoning'
                    ? MATH_COLORS.accent
                    : key === 'coding'
                    ? MATH_COLORS.secondary
                    : MATH_COLORS.primary
                return (
                  <path
                    key={key}
                    d={path.join(' ')}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={isActive ? 2 : 1}
                    style={{
                      opacity: isActive ? 1 : 0.35,
                    }}
                  />
                )
              })}

              {/* Threshold markers for selected capability */}
              {(() => {
                const cfg = activeCapability
                const x = xEmergent(cfg.thresholdLogC)
                const y = yEmergent(cfg.maxAccuracy * 0.8)
                return (
                  <>
                    <circle
                      cx={x}
                      cy={y}
                      r={4}
                      fill={MATH_COLORS.accent}
                    />
                    <text
                      x={x + 6}
                      y={y - 6}
                      className="axis-label"
                    >
                      Metric cutoff
                    </text>
                  </>
                )
              })()}

              {/* Current compute budget line */}
              <line
                x1={xEmergent(logCompute)}
                x2={xEmergent(logCompute)}
                y1={yEmergent(0)}
                y2={yEmergent(100)}
                stroke={MATH_COLORS.accent}
                strokeWidth={1.2}
                strokeDasharray="4 4"
              />
            </svg>
            <p className="caption">
              In this toy chart, thresholded task accuracy can stay low and then
              climb quickly as scale changes. The visible jump is a metric effect,
              not evidence of a literal discontinuity.
            </p>
          </div>

          <div className="subpanel compute-panel">
            <h3 className="panel-title">
              4. Compute allocation: GPT‑3 vs Chinchilla
            </h3>
            <div className="compute-row">
              <div className="compute-stat">
                <div className="label">GPT‑3 params</div>
                <div className="value">
                  {formatScientific(GPT3_PARAMS)}
                </div>
              </div>
              <div className="compute-stat">
                <div className="label">GPT‑3 tokens</div>
                <div className="value">
                  {formatScientific(GPT3_TOKENS)}
                </div>
              </div>
            </div>
            <div className="compute-row">
              <div className="compute-stat">
                <div className="label">
                  GPT‑3 tokens / param
                </div>
                <div className="value">
                  {(GPT3_TOKENS / GPT3_PARAMS).toFixed(1)}
                </div>
              </div>
              <div className="compute-stat">
                <div className="label">
                  Chinchilla tokens / param
                </div>
                <div className="value">
                  {TOKENS_PER_PARAM_OPT.toFixed(0)}
                </div>
              </div>
            </div>
            <LossBreakdownBar breakdown={gpt3Decomp} />
            <LossBreakdownBar breakdown={gpt3OptDecomp} />
            <p className="caption">
              With the same compute as GPT‑3, a Chinchilla-style
              allocation (more data, fewer parameters) lowers loss by
              roughly {efficiencyGain.toFixed(1)}%. The key idea:
              don&apos;t over-scale parameters without matching data.
            </p>
          </div>
        </div>
      </div>

      {/* Iso-compute curves + decomposition panel */}
      <div className="scaling-layout bottom-row">
        <div className="panel iso-panel">
          <h3 className="panel-title">
            2. Iso-compute curves: parameters vs data
          </h3>
          <svg
            width={ISO_WIDTH}
            height={ISO_HEIGHT}
            className="iso-chart"
            role="img"
            aria-label="Loss landscape over parameters and data with iso-compute curves"
          >
            {/* Loss heatmap */}
            {isoGrid.cells.map((cell) => {
              const innerWidth = ISO_WIDTH - 2 * PADDING
              const innerHeight = ISO_HEIGHT - 2 * PADDING
              const cellW =
                innerWidth / Math.max(1, ISO_GRID_COLS)
              const cellH =
                innerHeight / Math.max(1, ISO_GRID_ROWS)
              const x =
                PADDING +
                (cell.col * innerWidth) /
                  Math.max(1, ISO_GRID_COLS)
              const y =
                PADDING +
                (cell.row * innerHeight) /
                  Math.max(1, ISO_GRID_ROWS)
              const t =
                (cell.loss - isoGrid.minLoss) /
                (isoGrid.maxLoss - isoGrid.minLoss + 1e-9)
              // Low loss = more saturated teal, high loss = light grey
              const fill = interpolateColor(
                MATH_COLORS.secondary,
                '#f9fafb',
                t
              )
              return (
                <rect
                  key={`${cell.col}-${cell.row}`}
                  x={x}
                  y={y}
                  width={cellW + 0.5}
                  height={cellH + 0.5}
                  fill={fill}
                  opacity={0.9}
                />
              )
            })}

            {/* Axes outline */}
            <rect
              x={PADDING}
              y={PADDING}
              width={ISO_WIDTH - 2 * PADDING}
              height={ISO_HEIGHT - 2 * PADDING}
              fill="none"
              className="axis-line"
            />

            {/* Iso-compute curves */}
            {isoPaths.map((curve) => (
              <path
                key={curve.logC}
                d={curve.d}
                fill="none"
                stroke={
                  curve.isActive
                    ? MATH_COLORS.accent
                    : '#0f172a'
                }
                strokeWidth={curve.isActive ? 2 : 1}
                strokeDasharray={
                  curve.isActive ? '4 4' : '2 3'
                }
                opacity={curve.isActive ? 1 : 0.6}
              />
            ))}

            {/* Chinchilla frontier */}
            <path
              d={chinchillaFrontierPath}
              fill="none"
              stroke={MATH_COLORS.primary}
              strokeWidth={2}
            />

            {/* Region annotations */}
            <text
              x={xIso(isoGrid.logNMin) + 8}
              y={yIso(isoGrid.logDMax) - 8}
              className="axis-label"
            >
              Data-rich (too few parameters)
            </text>
            <text
              x={xIso(isoGrid.logNMax) - 8}
              y={yIso(isoGrid.logDMin) + 16}
              textAnchor="end"
              className="axis-label"
            >
              Param-heavy (too few tokens)
            </text>
            <text
              x={xIso(isoGrid.logNMin) + 8}
              y={ISO_HEIGHT - 4}
              className="axis-label"
            >
              Parameters N (log₁₀)
            </text>
            <text
              x={4}
              y={yIso(isoGrid.logDMax)}
              className="axis-label"
            >
              Data tokens D (log₁₀)
            </text>
          </svg>
          <p className="caption">
            Each curve is a fixed compute budget C = N·D (iso-compute).
            Along a curve you can trade parameters for data. The orange
            line is the Chinchilla frontier D ∝ N, where parameter and
            data errors contribute about equally to total loss.
          </p>
        </div>

        <div className="panel decomposition-panel">
          <h3 className="panel-title">
            6. Decomposing loss: L = L∞ + L<sub>params</sub> +
            L<sub>data</sub>
          </h3>
          <LossBreakdownBar breakdown={currentParamHeavyDecomp} />
          <LossBreakdownBar breakdown={currentOptDecomp} />
          <LossBreakdownBar breakdown={currentDataHeavyDecomp} />
          <p className="caption">
            As you move along an iso-compute curve, you tilt the balance
            between parameter error (orange) and data error (teal). At
            the Chinchilla frontier they&apos;re of similar size; off
            the frontier, one term dominates and you waste compute.
          </p>
        </div>
      </div>
    </section>
  )
}
