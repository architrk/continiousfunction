'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaleLinear, line as d3Line, curveMonotoneX, randomNormal } from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'

type Particle = {
  id: number
  x0: number
  y0: number
  epsX: number
  epsY: number
}

type Direction = 'forward' | 'reverse'
type SpeedPreset = 'slow' | 'normal' | 'fast'
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed'
type ThresholdChoice = 'early' | 'middle' | 'late'

// Prediction game: When does structure disappear?
const THRESHOLD_CHALLENGES = [
  {
    name: '🎯 50% Match',
    targetMatch: 50,
    description: 'When does structure become half-lost?',
    hint: 'Watch the match meter as noise accumulates'
  },
  {
    name: '🌫️ 30% Match',
    targetMatch: 30,
    description: 'When is most structure destroyed?',
    hint: 'The exponential noise schedule accelerates late'
  },
  {
    name: '❓ Mystery Threshold',
    targetMatch: 40,
    description: 'Predict when match hits this hidden level',
    hint: 'Somewhere between early blur and total chaos'
  },
]

const getThresholdFeedback = (
  predicted: ThresholdChoice,
  actualStep: number,
  totalSteps: number,
  targetMatch: number
): { correct: boolean; message: string } => {
  const actualRatio = actualStep / totalSteps
  const actualZone: ThresholdChoice = actualRatio < 0.33 ? 'early' : actualRatio < 0.66 ? 'middle' : 'late'
  const correct = predicted === actualZone

  if (correct) {
    if (actualZone === 'early') {
      return {
        correct: true,
        message: `Correct! The ${targetMatch}% threshold was crossed at step ${actualStep} (${(actualRatio * 100).toFixed(0)}% through). With this noise schedule, structure degrades quickly!`
      }
    }
    if (actualZone === 'middle') {
      return {
        correct: true,
        message: `Correct! Step ${actualStep} (${(actualRatio * 100).toFixed(0)}%) hit the ${targetMatch}% mark. The linear β schedule means noise accumulates steadily.`
      }
    }
    return {
      correct: true,
      message: `Correct! It took until step ${actualStep} (${(actualRatio * 100).toFixed(0)}%) to reach ${targetMatch}%. The ᾱₜ product decays slowly at first, then plunges.`
    }
  }

  // Wrong prediction feedback
  if (actualZone === 'early') {
    return {
      correct: false,
      message: `The ${targetMatch}% threshold was crossed at step ${actualStep} — earlier than expected! Remember: ᾱₜ = ∏ᵢ(1-βᵢ) compounds multiplicatively, so even small early noise has big effects.`
    }
  }
  if (actualZone === 'middle') {
    return {
      correct: false,
      message: `Step ${actualStep} hit ${targetMatch}% — in the middle zone. The linear schedule β_t = β_start + t(β_end - β_start) adds noise gradually before accelerating.`
    }
  }
  return {
    correct: false,
    message: `It took until step ${actualStep} to reach ${targetMatch}%! Structure persists longer than intuition suggests because √ᾱₜ stays reasonably large until late timesteps.`
  }
}

// Fun data distribution presets
type DistributionPreset = 'blobs' | 'ring' | 'spiral' | 'smiley'

const DISTRIBUTION_PRESETS: Record<DistributionPreset, { name: string; emoji: string; description: string }> = {
  blobs: { name: 'Two Blobs', emoji: '🔵🔵', description: 'Classic Gaussian mixture' },
  ring: { name: 'Ring', emoji: '⭕', description: 'Circular distribution' },
  spiral: { name: 'Spiral', emoji: '🌀', description: 'Spiral pattern' },
  smiley: { name: 'Smiley', emoji: '😊', description: 'Everyone loves a smiley!' },
}

// Speed presets
const SPEED_PRESETS: Record<SpeedPreset, { name: string; interval: number }> = {
  slow: { name: '🐢 Slow', interval: 160 },
  normal: { name: '🚶 Normal', interval: 80 },
  fast: { name: '🚀 Fast', interval: 30 },
}

// Compute similarity between current particle distribution and target (for Freeze Frame game)
const computeDistributionMatch = (
  particles: { x: number; y: number }[],
  targetCenters: { x: number; y: number }[],
  sigma: number = 0.6
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
    if (tNormalized < 0.2) return '💡 Early stage: Data structure still visible. Noise is subtle.'
    if (tNormalized < 0.5) return '🌫️ Middle stage: Clusters starting to blur. Information being destroyed.'
    if (tNormalized < 0.8) return '☁️ Late stage: Almost pure noise. Very hard to see original structure.'
    return '🎲 Final stage: Pure Gaussian noise. No trace of original data!'
  } else {
    if (tNormalized > 0.8) return '🎲 Starting from noise: Score field begins guiding particles.'
    if (tNormalized > 0.5) return '✨ Recovery begins: Faint structure emerging from chaos.'
    if (tNormalized > 0.2) return '🔮 Structure forming: Clusters becoming visible again!'
    return '🎯 Recovery complete: Data distribution restored from pure noise!'
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
}

// --- Diffusion + visualization constants ---

const DATA_MEANS = [
  { x: -1.5, y: 0 },
  { x: 1.5, y: 0 },
] as const

const GAUSS_SIGMA = 0.6
const GAUSS_SIGMA2 = GAUSS_SIGMA * GAUSS_SIGMA

// Simple linear beta schedule like classic DDPM
const BETA_START = 0.0005
const BETA_END = 0.03

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
}: DiffusionProcessVisualizerProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState<Direction>('forward')
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<SpeedPreset>('normal')
  const [distribution, setDistribution] = useState<DistributionPreset>('blobs')

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<typeof THRESHOLD_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<ThresholdChoice | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<ThresholdChoice | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [thresholdCrossedStep, setThresholdCrossedStep] = useState<number | null>(null)

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

    const clusterNormals = DATA_MEANS.map((mu) => ({
      randX: randomNormal(mu.x, GAUSS_SIGMA),
      randY: randomNormal(mu.y, GAUSS_SIGMA),
    }))

    const randNoiseX = randomNormal(0, 1)
    const randNoiseY = randomNormal(0, 1)

    for (let i = 0; i < clampedParticles; i++) {
      const clusterIndex = i % DATA_MEANS.length
      const { randX, randY } = clusterNormals[clusterIndex]
      const x0 = randX()
      const y0 = randY()
      const epsX = randNoiseX()
      const epsY = randNoiseY()
      pts.push({ id: i, x0, y0, epsX, epsY })
    }
    return pts
  }, [clampedParticles])

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

  // --- Score field grid (fixed grid in data space) ---

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

  // Countdown effect for prediction game
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 700)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('running')
      setStep(0)
      setDirection('forward')
      setIsPlaying(true)
      setThresholdCrossedStep(null)
    }
  }, [gamePhase, countdown])

  // Game control functions
  const selectChallenge = (challenge: typeof THRESHOLD_CHALLENGES[0]) => {
    setActiveChallenge(challenge)
    setPrediction(null)
    setLockedPrediction(null)
    setThresholdCrossedStep(null)
    setGamePhase('setup')
    setStep(0)
    setIsPlaying(false)
  }

  const startChallenge = () => {
    if (!prediction || !activeChallenge) return
    setLockedPrediction(prediction)
    setCountdown(3)
    setGamePhase('countdown')
  }

  const resetGame = () => {
    setGamePhase('setup')
    setActiveChallenge(null)
    setPrediction(null)
    setLockedPrediction(null)
    setThresholdCrossedStep(null)
    setStep(0)
    setIsPlaying(false)
  }

  // Get current stage insight
  const stageInsight = getStageInsight(tNormalized, direction)

  // Compute match score for Freeze Frame game
  const matchScore = useMemo(() => {
    const positions = particlePositions.map(p => ({ x: p.x, y: p.y }))
    const targets = DATA_MEANS.map(m => ({ x: m.x, y: m.y }))
    return computeDistributionMatch(positions, targets)
  }, [particlePositions])

  const matchPercent = Math.round(matchScore * 100)
  const matchLabel = matchPercent > 80 ? '🎯 Excellent!' : matchPercent > 60 ? '✨ Good' : matchPercent > 40 ? '👍 Getting there' : '🌫️ Noisy'

  // Track when threshold is crossed during game
  // (Placed after matchPercent is computed to satisfy hook ordering)
  useEffect(() => {
    if (gamePhase !== 'running' || !activeChallenge) return

    // Check if we've crossed the threshold
    if (thresholdCrossedStep === null && matchPercent <= activeChallenge.targetMatch) {
      setThresholdCrossedStep(safeStep)
      setIsPlaying(false)
      setGamePhase('revealed')
    }

    // If we reach the end without crossing, reveal anyway
    if (safeStep >= clampedSteps - 1 && thresholdCrossedStep === null) {
      setThresholdCrossedStep(clampedSteps - 1)
      setIsPlaying(false)
      setGamePhase('revealed')
    }
  }, [gamePhase, activeChallenge, matchPercent, safeStep, clampedSteps, thresholdCrossedStep])

  return (
    <section
      className="card interactive-card diffusion-card"
      style={{
        background: BG_COLOR,
        borderRadius: '16px',
        padding: '18px 20px 20px',
        color: '#e5e7eb',
      }}
    >
      <h2 style={{ marginBottom: '0.25rem' }}>🌊 Diffusion Process Explorer</h2>
      <p className="muted" style={{ marginBottom: '0.5rem', fontSize: '0.9rem' }}>
        Drag <code>t</code> from 0 (clean data) to 1 (pure noise). The forward
        process gradually adds Gaussian noise; the reverse process learns a
        score field that nudges samples back toward the data manifold.
      </p>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(59, 130, 246, 0.05))',
        border: '1px solid rgba(20, 184, 166, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#e5e7eb' }}>
          🎮 Noise Threshold Challenge
        </h3>
        <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '12px' }}>
          Predict when the data structure will degrade to a target match level.
        </p>

        {/* Challenge selection */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {THRESHOLD_CHALLENGES.map((challenge) => (
            <button
              key={challenge.name}
              onClick={() => selectChallenge(challenge)}
              disabled={gamePhase === 'running' || gamePhase === 'countdown'}
              style={{
                padding: '6px 12px',
                background: activeChallenge?.name === challenge.name
                  ? 'rgba(20, 184, 166, 0.3)'
                  : 'rgba(20, 184, 166, 0.1)',
                border: `1px solid ${activeChallenge?.name === challenge.name ? '#14b8a6' : 'rgba(20, 184, 166, 0.3)'}`,
                borderRadius: '6px',
                color: '#e5e7eb',
                fontSize: '0.8rem',
                cursor: gamePhase === 'running' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                opacity: gamePhase === 'running' || gamePhase === 'countdown' ? 0.5 : 1,
              }}
              title={challenge.description}
            >
              {challenge.name}
            </button>
          ))}
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              🎯 <strong>When will the match drop to {activeChallenge.targetMatch}%?</strong>
            </p>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '10px' }}>
              {activeChallenge.hint}
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['early', 'middle', 'late'] as ThresholdChoice[]).map((choice) => (
                <button
                  key={choice}
                  onClick={() => setPrediction(choice)}
                  style={{
                    padding: '10px 20px',
                    background: prediction === choice
                      ? choice === 'early' ? 'rgba(239, 68, 68, 0.4)'
                        : choice === 'middle' ? 'rgba(250, 204, 21, 0.4)'
                        : 'rgba(34, 197, 94, 0.4)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${prediction === choice
                      ? choice === 'early' ? '#ef4444' : choice === 'middle' ? '#facc15' : '#22c55e'
                      : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '0.95rem',
                    fontWeight: prediction === choice ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {choice === 'early' ? '🔴 Early (0-33%)' : choice === 'middle' ? '🟡 Middle (33-66%)' : '🟢 Late (66-100%)'}
                </button>
              ))}
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #14b8a6, #0ea5e9)'
                  : 'rgba(20, 184, 166, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              🌊 Start Forward Diffusion
            </button>
          </div>
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
              {countdown === 0 ? 'GO!' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
              Your prediction: <strong style={{
                color: lockedPrediction === 'early' ? '#ef4444' : lockedPrediction === 'middle' ? '#facc15' : '#22c55e'
              }}>
                {lockedPrediction === 'early' ? 'Early' : lockedPrediction === 'middle' ? 'Middle' : 'Late'}
              </strong>
            </p>
          </div>
        )}

        {/* Running phase */}
        {gamePhase === 'running' && activeChallenge && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: '#e5e7eb', marginBottom: '8px' }}>
              ⚡ Diffusing... Step {safeStep}/{clampedSteps - 1}
            </p>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Target: {activeChallenge.targetMatch}% | Current Match: {matchPercent}%
            </p>
            <div style={{
              display: 'inline-block',
              padding: '6px 14px',
              background: lockedPrediction === 'early' ? 'rgba(239, 68, 68, 0.2)'
                : lockedPrediction === 'middle' ? 'rgba(250, 204, 21, 0.2)'
                : 'rgba(34, 197, 94, 0.2)',
              borderRadius: '20px',
              fontSize: '0.85rem',
              marginTop: '8px',
            }}>
              Your prediction: <strong>{lockedPrediction}</strong>
            </div>
          </div>
        )}

        {/* Revealed phase */}
        {gamePhase === 'revealed' && activeChallenge && lockedPrediction && thresholdCrossedStep !== null && (
          <div>
            {(() => {
              const feedback = getThresholdFeedback(lockedPrediction, thresholdCrossedStep, clampedSteps - 1, activeChallenge.targetMatch)
              return (
                <>
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    background: feedback.correct
                      ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                      : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
                    borderRadius: '10px',
                    marginBottom: '12px',
                  }}>
                    <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                      {feedback.correct ? '🎉' : '🤔'}
                    </div>
                    <div style={{
                      fontSize: '1.2rem',
                      fontWeight: 'bold',
                      color: feedback.correct ? '#22c55e' : '#ef4444',
                      marginBottom: '8px',
                    }}>
                      {feedback.correct ? 'Correct!' : 'Not quite!'}
                    </div>
                    <div style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                      Threshold crossed at step <strong>{thresholdCrossedStep}</strong>
                    </div>
                  </div>
                  <div style={{
                    padding: '12px',
                    background: 'rgba(0, 0, 0, 0.2)',
                    borderRadius: '8px',
                    fontSize: '0.85rem',
                    lineHeight: 1.6,
                    color: '#9ca3af',
                  }}>
                    💡 {feedback.message}
                  </div>
                  <button
                    onClick={resetGame}
                    style={{
                      marginTop: '12px',
                      padding: '10px 20px',
                      background: 'rgba(20, 184, 166, 0.2)',
                      border: '1px solid rgba(20, 184, 166, 0.4)',
                      borderRadius: '8px',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    🔄 Try Another Challenge
                  </button>
                </>
              )
            })()}
          </div>
        )}

        {/* No challenge selected */}
        {!activeChallenge && gamePhase === 'setup' && (
          <p style={{ fontSize: '0.85rem', color: '#6b7280', fontStyle: 'italic' }}>
            Select a challenge above to test your intuition about diffusion dynamics!
          </p>
        )}
      </div>

      {/* Distribution presets */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8rem', color: '#9ca3af', marginRight: '4px' }}>Distribution:</span>
        {(Object.entries(DISTRIBUTION_PRESETS) as [DistributionPreset, typeof DISTRIBUTION_PRESETS[DistributionPreset]][]).map(([id, preset]) => (
          <button
            key={id}
            type="button"
            onClick={() => setDistribution(id)}
            style={{
              padding: '4px 10px',
              borderRadius: '999px',
              border: distribution === id ? '1px solid #14b8a6' : '1px solid rgba(148, 163, 184, 0.4)',
              background: distribution === id ? 'rgba(20, 184, 166, 0.15)' : 'rgba(15, 23, 42, 0.8)',
              color: '#e5e7eb',
              fontSize: '0.8rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={preset.description}
          >
            {preset.emoji} {preset.name}
          </button>
        ))}
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

      {/* Match score meter - Freeze Frame game */}
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
          🎯 Match:
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
          aria-label="2D diffusion process with particles and score vectors"
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

          {/* Score vectors (∇ log p_t(x)) */}
          <g aria-label="score field vectors">
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
              score ∇ log p_t(x)
            </text>
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
            {isPlaying ? '⏸ Pause' : '▶ Play'}
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
              : 'Reverse: noise → data'}
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
    </section>
  )
}
