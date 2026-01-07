'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Point2D, lerp, lerpPoint2D, clamp } from '../../../lib/mathObjects'

const CANVAS_WIDTH = 640
const CANVAS_HEIGHT = 360
const PADDING = 32

const DOMAIN = {
  x: [0, 1] as [number, number],
  y: [-0.6, 0.6] as [number, number],
}

const NUM_PARTICLES = 28
const PATH_SAMPLES = 80

const SOURCE_COLOR = '#9ca3af'
const TARGET_COLOR = '#14b8a6'
const PATH_COLOR = '#f59e0b'
const DARK_BG = '#080c14'

type Mode = 'diffusion' | 'flow'

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed'
type PathPrediction = 'diffusion' | 'flow' | null

// Mystery challenges for the prediction game
const PATH_CHALLENGES = [
  {
    name: '🎲 Step Count',
    question: 'Which approach needs fewer sampling steps?',
    hint: 'Diffusion uses ~50 steps, flow matching uses ~1-4 steps',
    answer: 'flow' as const,
    metric: 'steps',
  },
  {
    name: '🎲 Path Length',
    question: 'Which has shorter total path length?',
    hint: 'Curved vs straight trajectories through state space',
    answer: 'flow' as const,
    metric: 'length',
  },
  {
    name: '🎲 Training Target',
    question: 'Which learns a simpler velocity field?',
    hint: 'Noisy score vs straight optimal transport vector',
    answer: 'flow' as const,
    metric: 'simplicity',
  },
  {
    name: '🎲 Memory Usage',
    question: 'Which typically requires more memory at inference?',
    hint: 'More steps = more intermediate states stored',
    answer: 'diffusion' as const,
    metric: 'memory',
  },
];

// Feedback based on prediction
const getPathFeedback = (
  predicted: PathPrediction,
  challenge: typeof PATH_CHALLENGES[0]
): string => {
  const isCorrect = predicted === challenge.answer;

  if (challenge.metric === 'steps') {
    if (isCorrect) {
      return `🎯 Correct! Flow matching needs only 1-4 steps vs diffusion's ~50. By learning straight optimal transport paths, the model can jump directly from noise to data instead of taking a curvy detour!`;
    }
    return `❌ Actually flow matching wins! Diffusion's noisy score function requires many small steps (50-1000). Flow matching learns the straight path x_t = (1-t)x_0 + t·x_1, enabling 1-4 step generation.`;
  }

  if (challenge.metric === 'length') {
    if (isCorrect) {
      return `🎯 Correct! Flow matching paths are nearly straight (optimal transport). Diffusion paths arc and wiggle through state space, covering more total distance. Shorter path = faster traversal!`;
    }
    return `❌ Actually flow matching is shorter! Look at the paths—diffusion curves and oscillates while flow matching goes nearly straight. This is the "rectified flow" insight from Lipman et al.`;
  }

  if (challenge.metric === 'simplicity') {
    if (isCorrect) {
      return `🎯 Correct! Flow matching learns v(x,t) = x_1 - x_0 (a constant!), while diffusion learns the tangled score ∇log p_t(x). Simpler target = easier training & faster convergence.`;
    }
    return `❌ Actually flow matching is simpler! The velocity field v(x,t) in flow matching points straight toward the target. Diffusion's score function curves through a complex landscape.`;
  }

  // memory
  if (isCorrect) {
    return `🎯 Correct! Diffusion's 50-1000 steps means more intermediate activations stored for gradient checkpointing. Flow matching's few steps = smaller memory footprint at inference.`;
  }
  return `❌ Actually diffusion uses more memory! Each sampling step stores intermediate states. With 50-1000 steps vs 1-4, diffusion has much higher peak memory usage.`;
};

interface ParticlePaths {
  id: number
  source: Point2D
  target: Point2D
  diffPath: Point2D[]
  straightPath: Point2D[]
}

function randomNormal(mean = 0, std = 1): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const mag = Math.sqrt(-2.0 * Math.log(u))
  const z0 = mag * Math.cos(2.0 * Math.PI * v)
  return mean + std * z0
}

function toCanvasX(x: number): number {
  const [minX, maxX] = DOMAIN.x
  return PADDING + ((x - minX) / (maxX - minX)) * (CANVAS_WIDTH - 2 * PADDING)
}

function toCanvasY(y: number): number {
  const [minY, maxY] = DOMAIN.y
  return (
    CANVAS_HEIGHT -
    PADDING -
    ((y - minY) / (maxY - minY)) * (CANVAS_HEIGHT - 2 * PADDING)
  )
}

function toCanvas(point: Point2D): [number, number] {
  return [toCanvasX(point[0]), toCanvasY(point[1])]
}

// Curved, noisy diffusion-style velocity field
function diffusionVelocity(x: number, y: number, t: number): Point2D {
  const swirl = Math.sin(2 * Math.PI * (t + x * 0.7 + y * 0.3))
  const swirl2 = Math.cos(2 * Math.PI * (t * 1.3 + x * 0.2 - y * 0.4))

  const vx = 0.35 + 0.55 * swirl2
  const vy = 0.6 * swirl - 0.25 * y

  return [vx, vy]
}

// Simple left-to-right optimal transport field
function optimalTransportVelocity(x: number, y: number): Point2D {
  const targetX = 0.85
  const dx = targetX - x
  const vy = -0.6 * y
  const vx = dx * 1.1
  return [vx, vy]
}

// Interpolate between diffusion-like and rectified flow fields
function mixedVelocity(
  x: number,
  y: number,
  t: number,
  trainingProgress: number
): Point2D {
  const vd = diffusionVelocity(x, y, t)
  const vf = optimalTransportVelocity(x, y)
  const w = clamp(trainingProgress, 0, 1)
  return [lerp(vd[0], vf[0], w), lerp(vd[1], vf[1], w)]
}

// Precompute noisy vs straight paths between source and target
function createParticles(): ParticlePaths[] {
  const particles: ParticlePaths[] = []

  for (let i = 0; i < NUM_PARTICLES; i++) {
    const source: Point2D = [
      randomNormal(0.18, 0.06),
      randomNormal(0, 0.22),
    ]
    const target: Point2D = [
      randomNormal(0.82, 0.06),
      randomNormal(0, 0.16),
    ]

    const diffPath: Point2D[] = []
    const straightPath: Point2D[] = []

    const arcHeight =
      (Math.random() * 0.35 + 0.25) * (Math.random() < 0.5 ? -1 : 1)
    const wigglePhase = Math.random() * Math.PI * 2
    const wiggleFreq = 1 + Math.random() * 2
    const lateralPhase = Math.random() * Math.PI * 2

    for (let step = 0; step < PATH_SAMPLES; step++) {
      const t = step / (PATH_SAMPLES - 1)
      const base = lerpPoint2D(source, target, t)

      // arcing + small oscillations to mimic diffusion sampling
      const arch = Math.sin(Math.PI * t) * arcHeight
      const wiggle = 0.12 * Math.sin(wiggleFreq * Math.PI * t + wigglePhase)
      const lateral = 0.05 * Math.cos(wiggleFreq * Math.PI * t + lateralPhase)

      const diffPoint: Point2D = [
        clamp(base[0] + lateral, DOMAIN.x[0], DOMAIN.x[1]),
        clamp(base[1] + arch + wiggle, DOMAIN.y[0], DOMAIN.y[1]),
      ]

      diffPath.push(diffPoint)
      straightPath.push(base)
    }

    particles.push({ id: i, source, target, diffPath, straightPath })
  }

  return particles
}

interface LegendSwatchProps {
  color: string
  label: string
}

function LegendSwatch({ color, label }: LegendSwatchProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.4rem',
        fontSize: '0.78rem',
        color: '#d1d5db',
      }}
    >
      <span
        style={{
          width: '0.9rem',
          height: '0.9rem',
          borderRadius: '999px',
          backgroundColor: color,
          boxShadow:
            color === PATH_COLOR
              ? '0 0 0 1px rgba(248,250,252,0.4)'
              : '0 0 0 1px rgba(15,23,42,0.8)',
        }}
      />
      {label}
    </span>
  )
}

export default function FlowMatchingVsDiffusion() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [mode, setMode] = useState<Mode>('diffusion')
  const [time, setTime] = useState(0)
  const [trainingProgress, setTrainingProgress] = useState(0)

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof PATH_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<PathPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const particles = useMemo(() => createParticles(), [])

  // Animate particle time parameter t in [0, 1]
  useEffect(() => {
    let frameId: number

    const animate = () => {
      setTime(prev => {
        let next = prev + 0.01
        if (next > 1) next -= 1
        return next
      })
      frameId = window.requestAnimationFrame(animate)
    }

    frameId = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  // Animate rectification once from 0 -> 1 after mount
  useEffect(() => {
    let frameId: number
    let start: number | null = null
    const duration = 10000 // ms

    const animateTraining = (timestamp: number) => {
      if (start === null) start = timestamp
      const elapsed = timestamp - start
      const progress = clamp(elapsed / duration, 0, 1)
      setTrainingProgress(progress)

      if (progress < 1) {
        frameId = window.requestAnimationFrame(animateTraining)
      }
    }

    frameId = window.requestAnimationFrame(animateTraining)
    return () => window.cancelAnimationFrame(frameId)
  }, [])

  // Draw field + trajectories
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    ctx.fillStyle = DARK_BG
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    const left = PADDING
    const right = CANVAS_WIDTH - PADDING
    const top = PADDING
    const bottom = CANVAS_HEIGHT - PADDING

    // Panel background
    const panelGradient = ctx.createLinearGradient(left, top, right, bottom)
    panelGradient.addColorStop(0, 'rgba(15,23,42,0.98)')
    panelGradient.addColorStop(1, 'rgba(15,23,42,0.85)')
    ctx.fillStyle = panelGradient
    ctx.fillRect(left, top, right - left, bottom - top)

    const midCanvasX = toCanvasX(0.5)

    // Source / target shading
    ctx.fillStyle = 'rgba(148, 163, 184, 0.06)'
    ctx.fillRect(left, top, midCanvasX - left, bottom - top)

    ctx.fillStyle = 'rgba(20, 184, 166, 0.07)'
    ctx.fillRect(midCanvasX, top, right - midCanvasX, bottom - top)

    // Vertical divider
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)'
    ctx.lineWidth = 1
    ctx.setLineDash([4, 6])
    ctx.beginPath()
    ctx.moveTo(midCanvasX, top + 4)
    ctx.lineTo(midCanvasX, bottom - 4)
    ctx.stroke()
    ctx.setLineDash([])

    // Subtle grid
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.14)'
    ctx.lineWidth = 0.5
    const gridLines = 6
    for (let i = 0; i <= gridLines; i++) {
      const gx = left + ((right - left) * i) / gridLines
      ctx.beginPath()
      ctx.moveTo(gx, top)
      ctx.lineTo(gx, bottom)
      ctx.stroke()
    }
    for (let j = 0; j <= gridLines; j++) {
      const gy = top + ((bottom - top) * j) / gridLines
      ctx.beginPath()
      ctx.moveTo(left, gy)
      ctx.lineTo(right, gy)
      ctx.stroke()
    }

    // Labels
    ctx.fillStyle = '#e5e7eb'
    ctx.font =
      '12px system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    ctx.fillText('Source (noise)', left + 6, top + 6)
    ctx.textAlign = 'right'
    ctx.fillStyle = TARGET_COLOR
    ctx.fillText('Target (data)', right - 6, top + 6)

    ctx.textAlign = 'right'
    ctx.fillStyle = PATH_COLOR
    ctx.fillText('velocity field v(x, t)', right - 6, top + 24)

    // Velocity field arrows
    const cols = 14
    const rows = 8
    ctx.lineWidth = 1.1

    for (let i = 0; i <= cols; i++) {
      for (let j = 0; j <= rows; j++) {
        const x =
          DOMAIN.x[0] + ((DOMAIN.x[1] - DOMAIN.x[0]) * i) / cols
        const y =
          DOMAIN.y[0] + ((DOMAIN.y[1] - DOMAIN.y[0]) * j) / rows

        let vx: number
        let vy: number

        if (mode === 'diffusion') {
          ;[vx, vy] = diffusionVelocity(x, y, time)
        } else {
          ;[vx, vy] = mixedVelocity(x, y, time, trainingProgress)
        }

        const mag = Math.hypot(vx, vy)
        if (mag < 1e-5) continue

        const nx = vx / mag
        const ny = vy / mag

        const step = 0.09
        const x2 = x + nx * step
        const y2 = y + ny * step

        const [sx, sy] = toCanvas([x, y])
        const [ex, ey] = toCanvas([x2, y2])

        const intensity = Math.min(0.25 + mag * 0.4, 0.9)

        ctx.strokeStyle =
          mode === 'diffusion'
            ? `rgba(245, 158, 11, ${0.25 + intensity * 0.7})`
            : `rgba(245, 158, 11, ${0.2 + intensity * 0.55})`

        ctx.beginPath()
        ctx.moveTo(sx, sy)
        ctx.lineTo(ex, ey)
        ctx.stroke()

        // Arrow head
        const angle = Math.atan2(ey - sy, ex - sx)
        const headLen = 6
        ctx.beginPath()
        ctx.moveTo(ex, ey)
        ctx.lineTo(
          ex - headLen * Math.cos(angle - Math.PI / 6),
          ey - headLen * Math.sin(angle - Math.PI / 6)
        )
        ctx.lineTo(
          ex - headLen * Math.cos(angle + Math.PI / 6),
          ey - headLen * Math.sin(angle + Math.PI / 6)
        )
        ctx.closePath()
        ctx.fillStyle =
          mode === 'diffusion'
            ? `rgba(245, 158, 11, ${0.35 + intensity * 0.55})`
            : `rgba(245, 158, 11, ${0.25 + intensity * 0.45})`
        ctx.fill()
      }
    }

    // Source / target distributions
    ctx.globalAlpha = 0.9
    particles.forEach(particle => {
      const [sx, sy] = toCanvas(particle.source)
      ctx.beginPath()
      ctx.arc(sx, sy, 2.3, 0, Math.PI * 2)
      ctx.fillStyle = SOURCE_COLOR
      ctx.fill()

      const [tx, ty] = toCanvas(particle.target)
      ctx.beginPath()
      ctx.arc(tx, ty, 3, 0, Math.PI * 2)
      ctx.fillStyle = TARGET_COLOR
      ctx.fill()
    })
    ctx.globalAlpha = 1

    // Trajectories
    const totalSteps = mode === 'diffusion' ? 50 : 4
    const clampedTime = clamp(time, 0, 0.9999)
    const stepIndex = Math.floor(clampedTime * totalSteps)
    const headT = totalSteps > 1 ? stepIndex / (totalSteps - 1) : 0

    particles.forEach((particle, idx) => {
      const path: Point2D[] =
        mode === 'diffusion'
          ? particle.diffPath
          : particle.diffPath.map((pt, i) =>
              lerpPoint2D(pt, particle.straightPath[i], trainingProgress)
            )

      // Full path (faint)
      ctx.beginPath()
      path.forEach((pt, i) => {
        const [cx, cy] = toCanvas(pt)
        if (i === 0) {
          ctx.moveTo(cx, cy)
        } else {
          ctx.lineTo(cx, cy)
        }
      })
      ctx.strokeStyle =
        mode === 'diffusion'
          ? 'rgba(245, 158, 11, 0.25)'
          : 'rgba(245, 158, 11, 0.45)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Highlighted segment up to current step
      const headIndex = Math.min(
        path.length - 1,
        Math.round(headT * (path.length - 1))
      )

      if (headIndex > 0) {
        ctx.beginPath()
        for (let i = 0; i <= headIndex; i++) {
          const [cx, cy] = toCanvas(path[i])
          if (i === 0) ctx.moveTo(cx, cy)
          else ctx.lineTo(cx, cy)
        }
        ctx.strokeStyle = PATH_COLOR
        ctx.lineWidth = 2
        ctx.stroke()
      }

      // Particle head
      const [hx, hy] = toCanvas(path[headIndex])
      ctx.beginPath()
      ctx.arc(hx, hy, 3.6, 0, Math.PI * 2)
      ctx.fillStyle = PATH_COLOR
      ctx.fill()

      // Glow on a few exemplar particles
      if (idx < 5) {
        const gradient = ctx.createRadialGradient(hx, hy, 0, hx, hy, 18)
        gradient.addColorStop(0, 'rgba(245,158,11,0.5)')
        gradient.addColorStop(1, 'rgba(245,158,11,0)')
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(hx, hy, 18, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Axis hint (horizontal)
    const [axisXStart, axisY] = toCanvas([DOMAIN.x[0], 0])
    const axisXEnd = toCanvasX(DOMAIN.x[1])
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(axisXStart, axisY)
    ctx.lineTo(axisXEnd, axisY)
    ctx.stroke()
  }, [mode, particles, time, trainingProgress])

  // Game control functions
  const startChallenge = (challenge: typeof PATH_CHALLENGES[0]) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
  }

  const submitPrediction = (pred: PathPrediction) => {
    if (!selectedChallenge || !pred) return
    setPrediction(pred)
    setGamePhase('countdown')
    setCountdown(3)
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
  }

  // Countdown effect for game
  useEffect(() => {
    if (gamePhase !== 'countdown') return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Reveal phase - update score
          if (selectedChallenge && prediction) {
            const isCorrect = prediction === selectedChallenge.answer
            setScore(prev => ({
              correct: prev.correct + (isCorrect ? 1 : 0),
              total: prev.total + 1,
            }))
            // Show the relevant mode
            setMode(selectedChallenge.answer === 'flow' ? 'flow' : 'diffusion')
          }
          setGamePhase('revealed')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gamePhase, selectedChallenge, prediction])

  const totalSteps = mode === 'diffusion' ? 50 : 4
  const displayStep =
    Math.floor(clamp(time, 0, 0.9999) * totalSteps) + 1

  return (
    <section
      className="card interactive-card flow-matching-viz"
      style={{
        background: DARK_BG,
        borderRadius: '1rem',
        border: '1px solid rgba(148, 163, 184, 0.35)',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.9)',
        padding: '1.5rem',
      }}
    >
      <header
        className="flow-matching-header"
        style={{ marginBottom: '1rem' }}
      >
        <h2
          style={{
            fontSize: '1.05rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            color: '#e5e7eb',
            marginBottom: '0.25rem',
          }}
        >
          Flow Matching vs Diffusion
        </h2>
        <p
          style={{
            fontSize: '0.85rem',
            color: '#9ca3af',
            maxWidth: '42rem',
          }}
        >
          Compare noisy diffusion trajectories to straight optimal transport
          flows. The orange arrows show the learned velocity field v(x, t).
        </p>
      </header>

      {/* Game Mode Toggle & UI */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: gameMode ? '0' : '0.75rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode)
            if (!gameMode) resetGame()
          }}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            border: gameMode ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
              : 'rgba(15, 23, 42, 0.9)',
            color: gameMode ? '#fed7aa' : '#e5e7eb',
            cursor: 'pointer',
            fontWeight: gameMode ? 600 : 400,
          }}
        >
          {gameMode ? '🎮 Challenge Mode' : '🎮 Path Challenge'}
        </button>
        {gameMode && score.total > 0 && (
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
          </span>
        )}
      </div>

      {/* Game Panel */}
      {gameMode && (
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.85rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(20, 184, 166, 0.1))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.5rem', fontWeight: 600 }}>
                🎯 Path Efficiency Challenge
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                Compare diffusion vs flow matching on different metrics. Can you predict which wins?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {PATH_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    title={challenge.hint}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.4rem', fontWeight: 600 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.82rem', color: '#e5e7eb', marginBottom: '0.6rem' }}>
                {selectedChallenge.question}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem', fontStyle: 'italic' }}>
                Hint: {selectedChallenge.hint}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('diffusion')}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(156, 163, 175, 0.5)',
                    background: 'rgba(156, 163, 175, 0.15)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  Diffusion
                </button>
                <button
                  onClick={() => submitPrediction('flow')}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '6px',
                    border: '1px solid rgba(20, 184, 166, 0.5)',
                    background: 'rgba(20, 184, 166, 0.15)',
                    color: '#14b8a6',
                    cursor: 'pointer',
                  }}
                >
                  Flow Matching
                </button>
              </div>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.95rem', color: '#fed7aa', marginBottom: '0.5rem' }}>
                You predicted: <strong>{prediction === 'flow' ? 'Flow Matching' : 'Diffusion'}</strong>
              </p>
              <p style={{ fontSize: '2.2rem', color: '#e5e7eb', fontWeight: 700 }}>
                {countdown}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Comparing approaches...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{
                padding: '0.65rem',
                borderRadius: '8px',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '0.65rem',
              }}>
                <p style={{ fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getPathFeedback(prediction, selectedChallenge)}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                Try Another
              </button>
            </>
          )}
        </div>
      )}

      <div
        className="flow-matching-body"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        <div className="flow-matching-canvas-wrapper">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '0.75rem',
              background: 'transparent',
            }}
            aria-label="Comparison of diffusion vs flow matching trajectories and velocity fields"
          />
        </div>

        <div
          className="flow-matching-controls"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            fontSize: '0.85rem',
            color: '#d1d5db',
          }}
        >
          <div>
            <div
              style={{
                fontSize: '0.75rem',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                color: '#9ca3af',
                marginBottom: '0.35rem',
              }}
            >
              Mode
            </div>
            <div
              className="mode-toggle"
              style={{
                display: 'inline-flex',
                padding: '0.25rem',
                borderRadius: '999px',
                background:
                  'linear-gradient(135deg, rgba(30,64,175,0.4), rgba(15,118,110,0.4))',
              }}
            >
              <button
                type="button"
                onClick={() => setMode('diffusion')}
                style={{
                  padding: '0.3rem 0.9rem',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  background:
                    mode === 'diffusion' ? '#0f172a' : 'transparent',
                  color:
                    mode === 'diffusion' ? '#e5e7eb' : '#cbd5f5',
                  boxShadow:
                    mode === 'diffusion'
                      ? '0 0 0 1px rgba(148,163,184,0.6)'
                      : 'none',
                  transition:
                    'background 150ms ease, color 150ms ease, box-shadow 150ms ease',
                }}
              >
                Diffusion (many steps)
              </button>
              <button
                type="button"
                onClick={() => setMode('flow')}
                style={{
                  padding: '0.3rem 0.9rem',
                  borderRadius: '999px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '0.8rem',
                  background:
                    mode === 'flow' ? '#0f172a' : 'transparent',
                  color: mode === 'flow' ? '#e5e7eb' : '#a5f3fc',
                  boxShadow:
                    mode === 'flow'
                      ? '0 0 0 1px rgba(34,211,238,0.6)'
                      : 'none',
                  transition:
                    'background 150ms ease, color 150ms ease, box-shadow 150ms ease',
                }}
              >
                Flow matching (few steps)
              </button>
            </div>
          </div>

          <div
            className="step-counter"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.5rem',
              padding: '0.75rem',
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at top left, rgba(248,250,252,0.06), transparent 55%)',
              border: '1px solid rgba(148,163,184,0.3)',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  marginBottom: '0.15rem',
                }}
              >
                Current step
              </div>
              <div style={{ fontWeight: 600, color: '#e5e7eb' }}>
                {displayStep} / {totalSteps}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontSize: '0.75rem',
                  color: '#9ca3af',
                  marginBottom: '0.15rem',
                }}
              >
                Typical schedule
              </div>
              <div style={{ color: '#e5e7eb' }}>
                Diffusion ≈ <span style={{ color: PATH_COLOR }}>50</span>{' '}
                steps
                <br />
                Flow matching ≈{' '}
                <span style={{ color: TARGET_COLOR }}>1–4</span> steps
              </div>
            </div>
          </div>

          <div className="rectification-control">
            <label
              className="slider-label"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  gap: '0.5rem',
                }}
              >
                <span>Rectification / training progress</span>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: '#a5b4fc',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {(trainingProgress * 100).toFixed(0)}%
                </span>
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={trainingProgress}
                onChange={e =>
                  setTrainingProgress(parseFloat(e.target.value))
                }
                disabled={mode === 'diffusion'}
                style={{
                  width: '100%',
                  accentColor: PATH_COLOR,
                  opacity: mode === 'diffusion' ? 0.5 : 1,
                  cursor:
                    mode === 'diffusion' ? 'not-allowed' : 'pointer',
                }}
              />
            </label>
            <p
              className="caption"
              style={{
                marginTop: '0.4rem',
                fontSize: '0.78rem',
                color: '#9ca3af',
              }}
            >
              In diffusion mode, particles follow curved, noisy trajectories
              through a tangled velocity field. As flow matching trains (use the
              slider in flow mode), v(x, t) rectifies into smooth left-to-right
              transport and the orange paths straighten.
            </p>
          </div>

          <div
            className="legend-row"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.8rem',
              marginTop: '0.1rem',
            }}
          >
            <LegendSwatch color={SOURCE_COLOR} label="Source samples (noise)" />
            <LegendSwatch color={TARGET_COLOR} label="Target samples (data)" />
            <LegendSwatch color={PATH_COLOR} label="Particle paths" />
          </div>
        </div>
      </div>
    </section>
  )
}
