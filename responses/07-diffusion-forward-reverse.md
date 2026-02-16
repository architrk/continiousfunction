Here’s a self‑contained client component you can drop into your Next.js app as components/DiffusionProcessVisualizer.tsx. It uses D3 (scales, line generator, randomNormal) plus React state to simulate the forward noising and reverse denoising processes, with a timestep slider, play/pause, βₜ schedule plot, and score vectors.

 

You’ll want:

bash
Copy code
npm install d3-scale d3-random d3-shape

tsx
Copy code
'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaleLinear } from 'd3-scale'
import { line as d3Line, curveMonotoneX } from 'd3-shape'
import { randomNormal } from 'd3-random'
import { MATH_COLORS } from '../lib/mathObjects'

type Particle = {
  id: number
  x0: number
  y0: number
  epsX: number
  epsY: number
}

type Direction = 'forward' | 'reverse'

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

    const id = window.setInterval(() => {
      setStep((prev) => {
        const last = clampedSteps - 1
        if (direction === 'forward') {
          return prev >= last ? 0 : prev + 1
        } else {
          return prev <= 0 ? last : prev - 1
        }
      })
    }, 80)

    return () => window.clearInterval(id)
  }, [isPlaying, direction, clampedSteps])

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
      <h2 style={{ marginBottom: '0.25rem' }}>Diffusion Process Explorer</h2>
      <p className="muted" style={{ marginBottom: '1rem', fontSize: '0.9rem' }}>
        Drag <code>t</code> from 0 (clean data) to 1 (pure noise). The forward
        process gradually adds Gaussian noise; the reverse process learns a
        score field that nudges samples back toward the data manifold.
      </p>

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
      </div>
    </section>
  )
}


Usage example in a page:

tsx
Copy code
// app/diffusion/page.tsx (Next.js app router)
import DiffusionProcessVisualizer from '@/components/DiffusionProcessVisualizer'

export default function DiffusionPage() {
  return (
    <div style={{ padding: '2rem 0' }}>
      <DiffusionProcessVisualizer />
    </div>
  )
}


This ties into your existing visual style (teal/orange palette, canvas‑style cards) by reusing MATH_COLORS from lib/mathObjects.ts. 

attachments-bundle
