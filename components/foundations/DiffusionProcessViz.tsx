'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaleLinear, line as d3Line, curveMonotoneX } from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'
import { emitDemoState } from '../../lib/demoState'

type Particle = {
  id: number
  x0: number
  y0: number
  epsX: number
  epsY: number
}

type Direction = 'forward' | 'reverse'
type SpeedPreset = 'slow' | 'normal' | 'fast'
type ThresholdChoice = 'early' | 'middle' | 'late'

type PredictionResult = {
  predicted: ThresholdChoice
  actualZone: ThresholdChoice
  actualStep: number
  targetMatch: number
} | null

const DIFFUSION_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Choose the zone before the threshold is shown.',
  },
  {
    label: 'Observe',
    detail: 'Jump to the measured crossing step.',
  },
  {
    label: 'Ground',
    detail: 'Read alpha_bar and the noise coefficient.',
  },
  {
    label: 'Carry',
    detail: 'Connect schedule shape to visual collapse.',
  },
]

// Speed presets
const SPEED_PRESETS: Record<SpeedPreset, { name: string; interval: number }> = {
  slow: { name: 'Slow', interval: 160 },
  normal: { name: 'Normal', interval: 80 },
  fast: { name: 'Fast', interval: 30 },
}

const MATCH_SIGMA = 0.9
const MATCH_EPSILON = 1e-6

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function positionsAtAlphaBar(particles: Particle[], alphaBar: number): { x: number; y: number }[] {
  const sqrtA = Math.sqrt(alphaBar)
  const sqrtNoise = Math.sqrt(1 - alphaBar)

  return particles.map((p) => ({
    x: sqrtA * p.x0 + sqrtNoise * p.epsX,
    y: sqrtA * p.y0 + sqrtNoise * p.epsY,
  }))
}

// Compute a toy overlap proxy between current particles and target centers.
const computeDistributionMatch = (
  particles: { x: number; y: number }[],
  targetCenters: { x: number; y: number }[],
  sigma: number = MATCH_SIGMA
): number => {
  // For each particle, compute distance to nearest target center
  let totalScore = 0
  for (const p of particles) {
    let minDist = Infinity
    for (const c of targetCenters) {
      const d = Math.sqrt((p.x - c.x) ** 2 + (p.y - c.y) ** 2)
      minDist = Math.min(minDist, d)
    }
    // Gaussian-ish score
    totalScore += Math.exp(-(minDist ** 2) / (2 * sigma ** 2))
  }
  return totalScore / particles.length
}

// Educational insights for different stages
const getStageInsight = (tNormalized: number, direction: Direction): string => {
  if (direction === 'forward') {
    if (tNormalized < 0.2) return 'Early noising: the two-blob structure is still visually reliable.'
    if (tNormalized < 0.5) return 'Middle noising: clusters blur as the clean coefficient shrinks.'
    if (tNormalized < 0.8) return 'Late noising: Gaussian noise dominates most visible structure.'
    return 'High-noise step: the sampled cloud is dominated by epsilon; the original two-blob structure is no longer visually reliable.'
  } else {
    if (tNormalized > 0.8) return 'Backward replay: using the stored clean sample and noise vector to walk the same toy path backward.'
    if (tNormalized > 0.5) return 'Backward replay: the clean-data coefficient grows and the two-blob path becomes visible again.'
    if (tNormalized > 0.2) return 'Backward replay: this is not a learned sampler; a real reverse model must infer denoising directions.'
    return 'Backward replay reaches the stored clean sample. Real generation does not get to know x0.'
  }
}

interface ScheduleStep {
  t: number // discrete step index
  beta: number
  alpha: number
  alphaBar: number
}

interface DiffusionProcessVisualizerProps {
  numParticles?: number
  numSteps?: number
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

// --- Diffusion + visualization constants ---

const DATA_MEANS = [
  { x: -1.5, y: 0 },
  { x: 1.5, y: 0 },
] as const

const GAUSS_SIGMA = 0.6
const GAUSS_SIGMA2 = GAUSS_SIGMA * GAUSS_SIGMA

// Compressed linear beta schedule for an 80-step teaching demo.
// Real DDPM schedules usually use many more steps.
const BETA_START = 0.0005
const BETA_END = 0.06

const X_DOMAIN: [number, number] = [-3.5, 3.5]
const Y_DOMAIN: [number, number] = [-3.5, 3.5]

const MAIN_WIDTH = 420
const MAIN_HEIGHT = 360
const MAIN_PADDING = 32

const BETA_PLOT_WIDTH = 260
const BETA_PLOT_HEIGHT = 140
const BETA_PLOT_PADDING = 28

const SCORE_GRID_SIZE = 11

const TEAL = '#14b8a6'
const NOISE_GRAY = '#4b5563'
const SCORE_ORANGE = '#f59e0b'
const BG_COLOR = '#080c14'

// --- Small color helpers ---

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const cleaned = hex.replace('#', '')
  const bigint = parseInt(cleaned, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return { r, g, b }
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))
  return (
    '#' +
    [r, g, b]
      .map((v) => clamp(v).toString(16).padStart(2, '0'))
      .join('')
  )
}

function mixHexColors(a: string, b: string, t: number): string {
  const tClamped = Math.max(0, Math.min(1, t))
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return rgbToHex(
    ca.r + (cb.r - ca.r) * tClamped,
    ca.g + (cb.g - ca.g) * tClamped,
    ca.b + (cb.b - ca.b) * tClamped
  )
}

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sampleNormal(rng: () => number, mean = 0, std = 1): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function getZoneFromStep(step: number, totalSteps: number): ThresholdChoice {
  const ratio = step / Math.max(1, totalSteps)
  return ratio < 0.33 ? 'early' : ratio < 0.66 ? 'middle' : 'late'
}

// Approximate score ∇ log p(x) for a 2‑component Gaussian mixture,
// then scale by alphaStrength so it fades out as we add noise.
function scoreVector(x: number, y: number, alphaStrength: number): [number, number] {
  const weights = DATA_MEANS.map((mu) => {
    const dx = x - mu.x
    const dy = y - mu.y
    const dist2 = dx * dx + dy * dy
    return Math.exp(-dist2 / (2 * GAUSS_SIGMA2))
  })
  const weightSum = weights.reduce((sum, w) => sum + w, 0)
  if (weightSum === 0) return [0, 0]

  let vx = 0
  let vy = 0
  for (let i = 0; i < DATA_MEANS.length; i++) {
    const w = weights[i] / weightSum
    const mu = DATA_MEANS[i]
    // Gradient of log N(mu, σ²I) is (mu - x)/σ²
    vx += (w * (mu.x - x)) / GAUSS_SIGMA2
    vy += (w * (mu.y - y)) / GAUSS_SIGMA2
  }

  const baseMag = Math.sqrt(vx * vx + vy * vy)
  if (baseMag === 0) return [0, 0]

  // alphaStrength ~ ᾱ_t; when close to 1, strong arrows; near 0, tiny arrows.
  const strength = 0.9 * alphaStrength
  const scale = strength / baseMag
  return [vx * scale, vy * scale]
}

export default function DiffusionProcessVisualizer({
  numParticles = 400,
  numSteps = 80,
  chrome = 'legacy',
  conceptId = 'diffusion',
}: DiffusionProcessVisualizerProps) {
  const isNotebook = chrome === 'notebook'
  const showScoreProxy = chrome === 'legacy'
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<Direction>('forward')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<SpeedPreset>('normal')
  const [sampleSeed, setSampleSeed] = useState(7)
  const [prediction, setPrediction] = useState<ThresholdChoice | null>(null)
  const [predictionResult, setPredictionResult] = useState<PredictionResult>(null)

  const clampedSteps = Math.max(2, numSteps)
  const clampedParticles = Math.max(20, numParticles)

  // --- D3 scales for the main canvas ---

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain(X_DOMAIN)
        .range([MAIN_PADDING, MAIN_WIDTH - MAIN_PADDING]),
    []
  )

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain(Y_DOMAIN)
        .range([MAIN_HEIGHT - MAIN_PADDING, MAIN_PADDING]),
    []
  )

  // --- Diffusion noise schedule β_t, α_t, ᾱ_t ---

  const schedule = useMemo<ScheduleStep[]>(() => {
    const steps: ScheduleStep[] = []
    let alphaBarPrev = 1

    for (let i = 0; i < clampedSteps; i++) {
      // t index normalized to [0, 1]
      const frac = clampedSteps <= 1 ? 0 : i / (clampedSteps - 1)
      const beta = i === 0 ? 0 : BETA_START + (BETA_END - BETA_START) * frac
      const alpha = 1 - beta
      const alphaBar = i === 0 ? 1 : alphaBarPrev * alpha
      alphaBarPrev = alphaBar
      steps.push({ t: i, beta, alpha, alphaBar })
    }

    return steps
  }, [clampedSteps])

  const safeStep = Math.min(step, schedule.length - 1)
  const current = schedule[safeStep] ?? schedule[0]
  const alphaBar = current.alphaBar
  const sqrtAlphaBar = Math.sqrt(alphaBar)
  const sqrtOneMinusAlphaBar = Math.sqrt(1 - alphaBar)
  const noiseLevel = sqrtOneMinusAlphaBar // visual proxy for "how noisy" we are
  const tNormalized = schedule.length > 1 ? safeStep / (schedule.length - 1) : 0

  // --- Sample base data: two Gaussian blobs, plus one noise vector per particle ---

  const particles = useMemo<Particle[]>(() => {
    const pts: Particle[] = []
    const rng = makeRng(sampleSeed)

    for (let i = 0; i < clampedParticles; i++) {
      const clusterIndex = i % DATA_MEANS.length
      const mu = DATA_MEANS[clusterIndex]
      const x0 = sampleNormal(rng, mu.x, GAUSS_SIGMA)
      const y0 = sampleNormal(rng, mu.y, GAUSS_SIGMA)
      const epsX = sampleNormal(rng, 0, 1)
      const epsY = sampleNormal(rng, 0, 1)
      pts.push({ id: i, x0, y0, epsX, epsY })
    }
    return pts
  }, [clampedParticles, sampleSeed])

  const targetCenters = useMemo(
    () => DATA_MEANS.map((m) => ({ x: m.x, y: m.y })),
    []
  )

  const matchBaselines = useMemo(() => {
    const clean = computeDistributionMatch(
      particles.map((p) => ({ x: p.x0, y: p.y0 })),
      targetCenters
    )
    const finalAlphaBar = schedule[clampedSteps - 1]?.alphaBar ?? 0
    const final = computeDistributionMatch(
      positionsAtAlphaBar(particles, finalAlphaBar),
      targetCenters
    )

    return { clean, final }
  }, [clampedSteps, particles, schedule, targetCenters])

  const normalizeMatchScore = useMemo(() => {
    const denom = matchBaselines.clean - matchBaselines.final

    return (raw: number) =>
      denom > MATCH_EPSILON
        ? clamp01((raw - matchBaselines.final) / denom)
        : clamp01(raw)
  }, [matchBaselines])

  // Positions at time step t using DDPM forward equation:
  // x_t = sqrt(ᾱ_t) * x_0 + sqrt(1 - ᾱ_t) * ε
  const particlePositions = useMemo(
    () =>
      particles.map((p) => {
        const x = sqrtAlphaBar * p.x0 + sqrtOneMinusAlphaBar * p.epsX
        const y = sqrtAlphaBar * p.y0 + sqrtOneMinusAlphaBar * p.epsY

        // Mix from teal (data) to gray (noise) as noiseLevel grows
        const color = mixHexColors(TEAL, NOISE_GRAY, noiseLevel)

        return { ...p, x, y, color }
      }),
    [particles, sqrtAlphaBar, sqrtOneMinusAlphaBar, noiseLevel]
  )

  // --- Restoring-direction proxy grid (fixed grid in data space) ---

  const scoreGrid = useMemo(
    () => {
      const pts: { id: number; x: number; y: number }[] = []
      const n = SCORE_GRID_SIZE

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const gx =
            X_DOMAIN[0] +
            ((X_DOMAIN[1] - X_DOMAIN[0]) * (i + 0.5)) / n
          const gy =
            Y_DOMAIN[0] +
            ((Y_DOMAIN[1] - Y_DOMAIN[0]) * (j + 0.5)) / n
          pts.push({
            id: i * n + j,
            x: gx,
            y: gy,
          })
        }
      }

      return pts
    },
    []
  )

  const scoreVectors = useMemo(
    () =>
      scoreGrid.map((p) => {
        const [vx, vy] = scoreVector(p.x, p.y, alphaBar)
        const x1 = xScale(p.x)
        const y1 = yScale(p.y)
        const x2 = xScale(p.x + vx)
        const y2 = yScale(p.y + vy)
        const mag = Math.sqrt(vx * vx + vy * vy)
        return { ...p, x1, y1, x2, y2, mag }
      }),
    [scoreGrid, xScale, yScale, alphaBar]
  )

  // --- Noise schedule β_t line path for the mini plot ---

  const betaPathD = useMemo(() => {
    if (!schedule.length) return ''

    const x = scaleLinear()
      .domain([0, clampedSteps - 1])
      .range([BETA_PLOT_PADDING, BETA_PLOT_WIDTH - BETA_PLOT_PADDING])

    const y = scaleLinear()
      .domain([0, BETA_END])
      .range([BETA_PLOT_HEIGHT - BETA_PLOT_PADDING, BETA_PLOT_PADDING])

    const lineGen = d3Line<ScheduleStep>()
      .x((d) => x(d.t))
      .y((d) => y(d.beta))
      .curve(curveMonotoneX)

    return lineGen(schedule) ?? ''
  }, [schedule, clampedSteps])

  // For the current step marker on the β_t plot
  const betaXScale = scaleLinear()
    .domain([0, clampedSteps - 1])
    .range([BETA_PLOT_PADDING, BETA_PLOT_WIDTH - BETA_PLOT_PADDING])

  const betaYScale = scaleLinear()
    .domain([0, BETA_END])
    .range([BETA_PLOT_HEIGHT - BETA_PLOT_PADDING, BETA_PLOT_PADDING])

  const currentBetaX = betaXScale(safeStep)
  const currentBetaY = betaYScale(current.beta)

  // --- Simple play/pause animation over t using setInterval ---

  useEffect(() => {
    if (!isPlaying) return

    const interval = SPEED_PRESETS[speed].interval
    const id = window.setInterval(() => {
      setStep((prev) => {
        const last = clampedSteps - 1
        if (direction === 'forward') {
          return prev >= last ? 0 : prev + 1
        } else {
          return prev <= 0 ? last : prev - 1
        }
      })
    }, interval)

    return () => window.clearInterval(id)
  }, [isPlaying, direction, clampedSteps, speed])

  // Get current stage insight
  const stageInsight = getStageInsight(tNormalized, direction)

  const matchScore = useMemo(() => {
    const raw = computeDistributionMatch(
      particlePositions.map(p => ({ x: p.x, y: p.y })),
      targetCenters
    )
    return normalizeMatchScore(raw)
  }, [normalizeMatchScore, particlePositions, targetCenters])

  const matchPercent = Math.round(matchScore * 100)
  const matchLabel = matchPercent > 75 ? 'strong structure' : matchPercent > 50 ? 'visible structure' : matchPercent > 25 ? 'fading structure' : 'mostly noise'

  const thresholdCrossing = useMemo(() => {
    const targetMatch = 50

    for (let candidateStep = 0; candidateStep < clampedSteps; candidateStep++) {
      const scheduleStep = schedule[candidateStep]
      const positions = positionsAtAlphaBar(particles, scheduleStep.alphaBar)
      const rawMatch = computeDistributionMatch(
        positions,
        targetCenters
      )
      const match = normalizeMatchScore(rawMatch)

      if (Math.round(match * 100) <= targetMatch) {
        return {
          actualStep: candidateStep,
          actualZone: getZoneFromStep(candidateStep, clampedSteps - 1),
          targetMatch,
        }
      }
    }

    return {
      actualStep: clampedSteps - 1,
      actualZone: 'late' as const,
      targetMatch,
    }
  }, [clampedSteps, normalizeMatchScore, particles, schedule, targetCenters])

  const predictionSummary = useMemo(() => {
    if (!predictionResult) return null
    if (predictionResult.predicted === predictionResult.actualZone) {
      return `Matched: in this two-blob toy with this compressed beta schedule, the normalized ${predictionResult.targetMatch}% structure-match proxy crosses in the ${predictionResult.actualZone} zone at step ${predictionResult.actualStep}.`
    }
    return `The crossing happens in the ${predictionResult.actualZone} zone at step ${predictionResult.actualStep}, not the ${predictionResult.predicted} zone. The proxy is normalized between the clean cloud and the final high-noise cloud; alpha_bar_t controls how much of x0 remains.`
  }, [predictionResult])
  const diffusionEvidenceActiveIndex = predictionResult ? 3 : prediction ? 1 : 0
  const diffusionEvidencePhase = DIFFUSION_EVIDENCE_STEPS[diffusionEvidenceActiveIndex].label.toLowerCase()

  const checkPrediction = () => {
    if (!prediction) return
    setPredictionResult({
      predicted: prediction,
      actualZone: thresholdCrossing.actualZone,
      actualStep: thresholdCrossing.actualStep,
      targetMatch: thresholdCrossing.targetMatch,
    })
    setStep(thresholdCrossing.actualStep)
    setIsPlaying(false)
    setDirection('forward')
  }

  const resetPredictionCheck = () => {
    setPrediction(null)
    setPredictionResult(null)
  }

  useEffect(() => {
    emitDemoState({
      conceptId,
      label: 'Diffusion forward-process demo',
      summary: `Two-blob toy at step ${safeStep}/${clampedSteps - 1}: x_t mixes clean data with Gaussian noise through alpha_bar_t.`,
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${diffusionEvidencePhase}`,
        `alpha_bar: ${alphaBar.toFixed(3)}`,
        `noise std sqrt(1-alpha_bar): ${noiseLevel.toFixed(3)}`,
        `structure-match proxy: ${matchPercent}% of clean-to-final diagnostic`,
        `direction: ${direction === 'forward' ? 'forward noising' : 'backward replay'}`,
        predictionResult
          ? `prediction check: ${predictionResult.predicted} guess, actual ${predictionResult.actualZone} at step ${predictionResult.actualStep}`
          : 'prediction check: not run',
      ],
    })
  }, [
    alphaBar,
    clampedSteps,
    conceptId,
    direction,
    diffusionEvidencePhase,
    matchPercent,
    noiseLevel,
    predictionResult,
    safeStep,
  ])

  return (
    <section
      className={`card interactive-card diffusion-card ${chrome}`}
      style={{
        background: BG_COLOR,
        borderRadius: isNotebook ? '18px' : '16px',
        padding: isNotebook ? '16px' : '18px 20px 20px',
        color: '#e5e7eb',
        border: isNotebook ? '0' : undefined,
        boxShadow: isNotebook ? 'none' : undefined,
      }}
    >
      {!isNotebook ? (
        <>
          <h2 style={{ marginBottom: '0.25rem' }}>Diffusion Process Explorer</h2>
          <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Drag <code>t</code> from 0 (clean data) to 1 (noise). The forward
            process adds Gaussian noise; backward replay follows the stored
            clean sample and noise path rather than a learned sampler.
          </p>
        </>
      ) : null}

      <div
        className="diffusionPredictionPanel"
        data-child-demo-gate="diffusion-structure-threshold"
        style={{
          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(59, 130, 246, 0.05))',
          border: '1px solid rgba(20, 184, 166, 0.3)',
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '16px',
        }}
      >
        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#e5e7eb' }}>
          Prediction check: when does structure fade?
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '12px' }}>
          Before checking, predict whether the 50% structure-match proxy crosses early, in the middle, or late.
        </p>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {(['early', 'middle', 'late'] as ThresholdChoice[]).map((choice) => (
            <button
              key={choice}
              type="button"
              onClick={() => {
                setPrediction(choice)
                setPredictionResult(null)
              }}
              aria-pressed={prediction === choice}
              style={{
                padding: '10px 18px',
                background: prediction === choice
                  ? 'rgba(20, 184, 166, 0.22)'
                  : 'rgba(255, 255, 255, 0.05)',
                border: `2px solid ${prediction === choice ? '#14b8a6' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '8px',
                color: '#e5e7eb',
                fontSize: '0.92rem',
                fontWeight: prediction === choice ? 650 : 450,
                cursor: 'pointer',
              }}
            >
              {choice === 'early' ? 'Early (0-33%)' : choice === 'middle' ? 'Middle (33-66%)' : 'Late (66-100%)'}
            </button>
          ))}
        </div>
        <div className="evidenceStrip" aria-label="Diffusion evidence loop">
          {DIFFUSION_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={`evidenceStep ${index === diffusionEvidenceActiveIndex ? 'active' : ''} ${
                index < diffusionEvidenceActiveIndex ? 'complete' : ''
              }`}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={checkPrediction}
            disabled={!prediction}
            style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: prediction ? 'linear-gradient(135deg, #14b8a6, #0ea5e9)' : 'rgba(20, 184, 166, 0.2)',
              color: prediction ? '#fff' : '#9ca3af',
              cursor: prediction ? 'pointer' : 'not-allowed',
              fontWeight: 650,
            }}
          >
            Check threshold
          </button>
          <button
            type="button"
            className="ghost"
            onClick={resetPredictionCheck}
          >
            Reset check
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setSampleSeed((seed) => seed + 1)
              setPredictionResult(null)
              setStep(0)
              setIsPlaying(false)
              setDirection('forward')
            }}
          >
            Resample particles
          </button>
        </div>
        {predictionSummary ? (
          <div
            role="status"
            aria-live="polite"
            style={{
              marginTop: '12px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
              fontSize: '0.86rem',
              lineHeight: 1.6,
              color: '#cbd5e1',
            }}
          >
            {predictionSummary}
          </div>
        ) : null}
      </div>

      {/* Stage insight box */}
      <div style={{
        padding: '10px 14px',
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(59, 130, 246, 0.1))',
        borderLeft: '3px solid #14b8a6',
        borderRadius: '0 8px 8px 0',
        fontSize: '0.85rem',
        marginBottom: '0.75rem',
      }}>
        {stageInsight}
      </div>

      <div style={{
        padding: '10px 14px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        marginBottom: '0.75rem',
        fontSize: '0.9rem',
        fontFamily: 'var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)',
        color: '#cbd5e1',
      }}>
        x_t = {sqrtAlphaBar.toFixed(2)} x_0 + {sqrtOneMinusAlphaBar.toFixed(2)} epsilon
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        background: 'rgba(15, 23, 42, 0.8)',
        borderRadius: '8px',
        marginBottom: '1rem',
      }}>
        <span style={{ fontSize: '0.85rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
          Structure-match proxy:
        </span>
        <div style={{
          flex: 1,
          height: '10px',
          background: 'rgba(31, 41, 55, 0.9)',
          borderRadius: '999px',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${matchPercent}%`,
            height: '100%',
            background: matchPercent > 80
              ? 'linear-gradient(90deg, #22c55e, #14b8a6)'
              : matchPercent > 60
              ? 'linear-gradient(90deg, #facc15, #22c55e)'
              : matchPercent > 40
              ? 'linear-gradient(90deg, #f97316, #facc15)'
              : 'linear-gradient(90deg, #ef4444, #f97316)',
            borderRadius: '999px',
            transition: 'width 0.15s ease, background 0.3s ease',
          }} />
        </div>
        <span style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          minWidth: '100px',
          textAlign: 'right',
          color: matchPercent > 80 ? '#22c55e' : matchPercent > 60 ? '#facc15' : '#f97316',
        }}>
          {matchPercent}% {matchLabel}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Main diffusion view: particles + score vectors */}
        <svg
          width={MAIN_WIDTH}
          height={MAIN_HEIGHT}
          role="img"
          aria-label={showScoreProxy ? '2D diffusion process with particles and score proxy vectors' : '2D diffusion process with clean and noised particles'}
          style={{
            borderRadius: '12px',
            background:
              'radial-gradient(circle at top, rgba(15,23,42,1), #020617)',
          }}
        >
          <defs>
            <marker
              id="score-arrow-head"
              viewBox="0 0 10 10"
              refX={6}
              refY={5}
              markerWidth={6}
              markerHeight={6}
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={SCORE_ORANGE} />
            </marker>
          </defs>

          {/* Border frame */}
          <rect
            x={MAIN_PADDING - 10}
            y={MAIN_PADDING - 10}
            width={MAIN_WIDTH - 2 * (MAIN_PADDING - 10)}
            height={MAIN_HEIGHT - 2 * (MAIN_PADDING - 10)}
            fill="none"
            stroke="rgba(148, 163, 184, 0.24)"
            strokeWidth={1}
          />

          {showScoreProxy ? (
            <g aria-label="restoring-direction proxy vectors">
              {scoreVectors.map((v) => (
                <line
                  key={v.id}
                  x1={v.x1}
                  y1={v.y1}
                  x2={v.x2}
                  y2={v.y2}
                  stroke={SCORE_ORANGE}
                  strokeWidth={1.2}
                  strokeOpacity={0.35 + 0.35 * Math.min(v.mag, 1)}
                  markerEnd="url(#score-arrow-head)"
                />
              ))}
            </g>
          ) : null}

          <g aria-label="faint clean particle positions">
            {particles.map((p) => (
              <circle
                key={`clean-${p.id}`}
                cx={xScale(p.x0)}
                cy={yScale(p.y0)}
                r={2}
                fill={TEAL}
                fillOpacity={0.18}
              />
            ))}
          </g>

          {/* Data/particles */}
          <g aria-label="particles">
            {particlePositions.map((p) => (
              <circle
                key={p.id}
                cx={xScale(p.x)}
                cy={yScale(p.y)}
                r={2.4}
                fill={p.color}
                fillOpacity={0.95}
              />
            ))}
          </g>

          {/* Mode centers (original data distribution) */}
          <g aria-label="data mode centers">
            {DATA_MEANS.map((mu, i) => (
              <circle
                key={i}
                cx={xScale(mu.x)}
                cy={yScale(mu.y)}
                r={4}
                fill={MATH_COLORS.secondary}
                fillOpacity={0.2}
                stroke={MATH_COLORS.secondary}
                strokeOpacity={0.7}
              />
            ))}
          </g>

          {/* Small legend in corner */}
          <g transform={`translate(${MAIN_PADDING + 4}, ${MAIN_PADDING + 4})`}>
            <circle cx={0} cy={0} r={3} fill={TEAL} />
            <text
              x={8}
              y={3}
              fontSize={10}
              fill="#e5e7eb"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              data sample x_t
            </text>

            {showScoreProxy ? (
              <>
                <line
                  x1={0}
                  y1={15}
                  x2={14}
                  y2={15}
                  stroke={SCORE_ORANGE}
                  strokeWidth={1.2}
                  markerEnd="url(#score-arrow-head)"
                />
                <text
                  x={18}
                  y={18}
                  fontSize={10}
                  fill="#e5e7eb"
                  style={{ fontFamily: 'system-ui, sans-serif' }}
                >
                  restoring-direction proxy
                </text>
              </>
            ) : null}
          </g>
        </svg>

        {/* Right-hand panel: β_t plot + scalar readouts */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minWidth: BETA_PLOT_WIDTH,
            flex: 1,
          }}
        >
          <svg
            width={BETA_PLOT_WIDTH}
            height={BETA_PLOT_HEIGHT}
            role="img"
            aria-label="Noise schedule beta_t over diffusion steps"
            style={{
              borderRadius: '12px',
              background: 'rgba(15,23,42,0.95)',
            }}
          >
            {/* Axes */}
            <line
              x1={BETA_PLOT_PADDING}
              y1={BETA_PLOT_HEIGHT - BETA_PLOT_PADDING}
              x2={BETA_PLOT_WIDTH - BETA_PLOT_PADDING}
              y2={BETA_PLOT_HEIGHT - BETA_PLOT_PADDING}
              stroke="rgba(148, 163, 184, 0.5)"
              strokeWidth={1}
            />
            <line
              x1={BETA_PLOT_PADDING}
              y1={BETA_PLOT_PADDING}
              x2={BETA_PLOT_PADDING}
              y2={BETA_PLOT_HEIGHT - BETA_PLOT_PADDING}
              stroke="rgba(148, 163, 184, 0.5)"
              strokeWidth={1}
            />

            {/* β_t curve */}
            <path
              d={betaPathD}
              fill="none"
              stroke={MATH_COLORS.primary}
              strokeWidth={2}
            />

            {/* Current t marker */}
            <line
              x1={currentBetaX}
              y1={BETA_PLOT_PADDING}
              x2={currentBetaX}
              y2={BETA_PLOT_HEIGHT - BETA_PLOT_PADDING}
              stroke="rgba(248, 250, 252, 0.45)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <circle
              cx={currentBetaX}
              cy={currentBetaY}
              r={4}
              fill={MATH_COLORS.primary}
            />

            {/* Title & labels */}
            <text
              x={BETA_PLOT_WIDTH / 2}
              y={18}
              textAnchor="middle"
              fontSize={12}
              fill="#e5e7eb"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              Noise schedule βₜ
            </text>
            <text
              x={BETA_PLOT_WIDTH / 2}
              y={BETA_PLOT_HEIGHT - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              t / T
            </text>
            <text
              x={BETA_PLOT_PADDING - 16}
              y={BETA_PLOT_PADDING + 4}
              textAnchor="middle"
              fontSize={10}
              fill="#9ca3af"
              transform={`rotate(-90 ${BETA_PLOT_PADDING - 16}, ${
                BETA_PLOT_PADDING + 4
              })`}
              style={{ fontFamily: 'system-ui, sans-serif' }}
            >
              βₜ
            </text>
          </svg>

          <div
            style={{
              fontSize: '0.8rem',
              lineHeight: 1.4,
              background: 'rgba(15,23,42,0.85)',
              borderRadius: '10px',
              padding: '0.6rem 0.75rem',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                t step:{' '}
                <strong>
                  {safeStep} / {clampedSteps - 1}
                </strong>
              </span>
              <span>
                t (normalized):{' '}
                <strong>{tNormalized.toFixed(2)}</strong>
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>
                ᾱₜ (data weight):{' '}
                <strong>{alphaBar.toFixed(3)}</strong>
              </span>
              <span>
                √(1 − ᾱₜ) (noise level):{' '}
                <strong>{noiseLevel.toFixed(3)}</strong>
              </span>
            </div>
            <div>
              βₜ:{' '}
              <strong>{current.beta.toExponential(3)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Controls: slider + play/pause + direction */}
      <div
        style={{
          marginTop: '1.1rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.9rem',
          alignItems: 'center',
        }}
      >
        <label
          style={{
            flex: 1,
            minWidth: '220px',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}
        >
          <span>
            Timestep t{' '}
            <span style={{ opacity: 0.6 }}>
              (0 = data, {clampedSteps - 1} = noise)
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={clampedSteps - 1}
            step={1}
            value={safeStep}
            onChange={(e) => {
              setIsPlaying(false)
              const v = Number(e.target.value)
              setStep(Number.isFinite(v) ? v : 0)
            }}
          />
        </label>

        <div
          style={{
            display: 'flex',
            gap: '0.5rem',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() =>
              setDirection((prev) => (prev === 'forward' ? 'reverse' : 'forward'))
            }
          >
            {direction === 'forward'
              ? 'Forward: data → noise'
              : 'Backward replay: noise → stored data path'}
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => {
              setIsPlaying(false)
              setStep(direction === 'forward' ? 0 : clampedSteps - 1)
            }}
          >
            Reset
          </button>
        </div>

        {/* Speed controls */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>Speed:</span>
          {(Object.entries(SPEED_PRESETS) as [SpeedPreset, typeof SPEED_PRESETS[SpeedPreset]][]).map(([id, preset]) => (
            <button
              key={id}
              type="button"
              onClick={() => setSpeed(id)}
              style={{
                padding: '4px 8px',
                borderRadius: '6px',
                border: speed === id ? '1px solid #14b8a6' : '1px solid rgba(148, 163, 184, 0.3)',
                background: speed === id ? 'rgba(20, 184, 166, 0.2)' : 'transparent',
                color: '#e5e7eb',
                fontSize: '0.75rem',
                cursor: 'pointer',
              }}
            >
            {preset.name}
            </button>
          ))}
        </div>
      </div>
      <style jsx>{`
        .evidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          margin: 0 0 0.85rem;
          padding: 0.5rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.42);
        }

        .evidenceStep {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.16rem 0.38rem;
          min-width: 0;
          padding: 0.5rem;
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.64);
          color: #cbd5e1;
        }

        .evidenceStep span {
          display: inline-grid;
          width: 1.25rem;
          height: 1.25rem;
          place-items: center;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.16);
          color: #cbd5e1;
          font-size: 0.7rem;
          font-weight: 800;
        }

        .evidenceStep strong,
        .evidenceStep small {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .evidenceStep strong {
          color: #f8fafc;
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .evidenceStep small {
          grid-column: 1 / -1;
          color: #9fb0c4;
          font-size: 0.7rem;
          line-height: 1.35;
        }

        .evidenceStep.active {
          border-color: rgba(20, 184, 166, 0.54);
          background: rgba(20, 184, 166, 0.14);
        }

        .evidenceStep.active span,
        .evidenceStep.complete span {
          background: #14b8a6;
          color: #022c2a;
        }

        .diffusionPredictionPanel .ghost {
          min-height: 2.5rem;
          padding: 0.55rem 0.85rem;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.72);
          color: #e5e7eb;
          font: inherit;
          font-weight: 650;
          cursor: pointer;
        }

        .diffusionPredictionPanel .ghost:hover,
        .diffusionPredictionPanel .ghost:focus-visible {
          border-color: rgba(20, 184, 166, 0.6);
          background: rgba(20, 184, 166, 0.14);
        }

        @media (max-width: 640px) {
          .diffusion-card.notebook {
            padding: 12px !important;
          }
        }

        @media (max-width: 760px) {
          .evidenceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 430px) {
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .diffusionPredictionPanel .ghost {
            width: 100%;
            text-align: center;
          }
        }
      `}</style>
    </section>
  )
}
