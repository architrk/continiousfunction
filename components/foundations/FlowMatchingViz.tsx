import { useEffect, useMemo, useState } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

type Vec2 = { x: number; y: number }
type Mode = 'diffusion' | 'flow'

interface ParticlePair {
  id: number
  src: Vec2
  tgt: Vec2
  delta: Vec2
  ortho: Vec2
  curveAmp: number
}

const TRANSPORT_WIDTH = 360
const TRANSPORT_HEIGHT = 260
const VECTOR_WIDTH = 260
const VECTOR_HEIGHT = 260
const PATH_WIDTH = 260
const PATH_HEIGHT = 180
const SAMPLING_WIDTH = 260
const SAMPLING_HEIGHT = 160

const PADDING = 28

const WORLD_X_MIN = -3.2
const WORLD_X_MAX = 3.2
const WORLD_Y_MIN = -2.8
const WORLD_Y_MAX = 2.8

const PARTICLE_COUNT = 80
const GRID_COLS = 11
const GRID_ROWS = 11
const MAX_STEPS = 50

// ----- Basic vector helpers -----

function length(v: Vec2): number {
  return Math.hypot(v.x, v.y)
}

function normalize(v: Vec2): Vec2 {
  const len = length(v) || 1
  return { x: v.x / len, y: v.y / len }
}

function interpolate(a: Vec2, b: Vec2, t: number): Vec2 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  }
}

function xToSvg(x: number, width: number): number {
  const t = (x - WORLD_X_MIN) / (WORLD_X_MAX - WORLD_X_MIN)
  return PADDING + t * (width - 2 * PADDING)
}

function yToSvg(y: number, height: number): number {
  const t = (y - WORLD_Y_MIN) / (WORLD_Y_MAX - WORLD_Y_MIN)
  return height - PADDING - t * (height - 2 * PADDING)
}

function vecToSvg(p: Vec2, width: number, height: number): { x: number; y: number } {
  return {
    x: xToSvg(p.x, width),
    y: yToSvg(p.y, height),
  }
}

function buildPathD(points: Vec2[], width: number, height: number): string {
  if (points.length === 0) return ''
  return points
    .map((p, i) => {
      const svg = vecToSvg(p, width, height)
      return `${i === 0 ? 'M' : 'L'} ${svg.x} ${svg.y}`
    })
    .join(' ')
}

function computePathLength(points: Vec2[]): number {
  if (points.length < 2) return 0
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x
    const dy = points[i].y - points[i - 1].y
    total += Math.hypot(dx, dy)
  }
  return total
}

// ----- RNG & sampling helpers -----

function makeRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sampleStandardNormal(rng: () => number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function sampleNoisePoint(rng: () => number): Vec2 {
  const x = sampleStandardNormal(rng) * 1.2
  const y = sampleStandardNormal(rng) * 1.2
  return { x, y }
}

// Simple two-moons toy data (roughly like sklearn's make_moons)
function sampleTwoMoons(rng: () => number): Vec2 {
  const angle = Math.PI * rng()
  const which = rng() < 0.5 ? 0 : 1
  const radius = 1.4
  const noiseScale = 0.12
  const nx = sampleStandardNormal(rng) * noiseScale
  const ny = sampleStandardNormal(rng) * noiseScale

  if (which === 0) {
    const x = radius * Math.cos(angle) - 1.4 + nx
    const y = radius * Math.sin(angle) + ny
    return { x, y }
  } else {
    const x = radius * (1 - Math.cos(angle)) + 0.4 + nx
    const y = -radius * Math.sin(angle) - 0.4 + ny
    return { x, y }
  }
}

function generateParticlePairs(seed: number, count: number = PARTICLE_COUNT): ParticlePair[] {
  const rng = makeRng(seed)
  const pairs: ParticlePair[] = []

  for (let i = 0; i < count; i++) {
    const src = sampleNoisePoint(rng)
    const tgt = sampleTwoMoons(rng)
    const delta = { x: tgt.x - src.x, y: tgt.y - src.y }
    const dir = normalize(delta)
    const ortho = { x: -dir.y, y: dir.x }
    const curveAmp = 0.25 + 0.3 * rng() // how "wiggly" diffusion paths are

    pairs.push({
      id: i,
      src,
      tgt,
      delta,
      ortho,
      curveAmp,
    })
  }

  return pairs
}

// ----- Path geometry for diffusion vs. flow / rectified flow -----

// Smooth bump that is zero at t=0 and t=1 and maximal in the middle.
function diffusionCurveOffset(t: number): number {
  return Math.sin(Math.PI * t)
}

function getPathPosition(pair: ParticlePair, t: number, curveScale: number): Vec2 {
  const base = interpolate(pair.src, pair.tgt, t)
  if (curveScale === 0) return base
  const bump = pair.curveAmp * curveScale * diffusionCurveOffset(t)
  return {
    x: base.x + pair.ortho.x * bump,
    y: base.y + pair.ortho.y * bump,
  }
}

function getParticlePosition(pair: ParticlePair, t: number, mode: Mode): Vec2 {
  return mode === 'flow' ? getPathPosition(pair, t, 0) : getPathPosition(pair, t, 1)
}

function getVelocityAlongPair(pair: ParticlePair, t: number, curveScale: number): Vec2 {
  const base = pair.delta
  if (curveScale === 0) return base
  const osc = pair.curveAmp * curveScale * Math.PI * Math.cos(Math.PI * t)
  return {
    x: base.x + pair.ortho.x * osc,
    y: base.y + pair.ortho.y * osc,
  }
}

function vectorFieldAtPoint(
  x: Vec2,
  t: number,
  mode: Mode,
  pairs: ParticlePair[],
): Vec2 {
  const sigma2 = 0.7 * 0.7
  let vx = 0
  let vy = 0
  let wSum = 0

  for (const pair of pairs) {
    const curveScale = mode === 'flow' ? 0 : 1
    const center = getPathPosition(pair, t, curveScale)
    const dx = center.x - x.x
    const dy = center.y - x.y
    const dist2 = dx * dx + dy * dy
    const weight = Math.exp(-dist2 / (2 * sigma2))
    if (weight < 1e-3) continue
    const vel = getVelocityAlongPair(pair, t, curveScale)
    vx += vel.x * weight
    vy += vel.y * weight
    wSum += weight
  }

  if (wSum === 0) return { x: 0, y: 0 }
  return { x: vx / wSum, y: vy / wSum }
}

function magnitudeColor(mag: number): string {
  const norm = Math.min(mag / 3, 1)
  if (norm < 0.33) return MATH_COLORS.secondary
  if (norm < 0.66) return MATH_COLORS.primary
  return MATH_COLORS.accent
}

function samplePath(pair: ParticlePair, samples: number, curveScale: number): Vec2[] {
  const pts: Vec2[] = []
  for (let i = 0; i <= samples; i++) {
    const t = i / samples
    pts.push(getPathPosition(pair, t, curveScale))
  }
  return pts
}

// ----- Sampling speed toy curves -----

function qualityDiffusion(steps: number): number {
  // Slow improvement: needs many steps
  return 1 - Math.exp(-steps / 30)
}

function qualityFlow(steps: number): number {
  // Faster: straight paths
  return 1 - Math.exp(-steps / 8)
}

function qualityRectifiedFlow(steps: number): number {
  // Even faster: nearly straight everywhere
  return 1 - Math.exp(-steps / 4)
}

// Fun presets for different scenarios
const FLOW_PRESETS = [
  { name: '🌙 Two Moons', seed: 1, description: 'Classic sklearn-style two moons' },
  { name: '🔄 Swirly', seed: 42, description: 'Particles with longer journeys' },
  { name: '🎯 Clustered', seed: 123, description: 'Tighter target clusters' },
  { name: '🌊 Wave', seed: 777, description: 'Wave-like distribution' },
  { name: '🎲 Random', seed: -1, description: 'Random new samples' },
]

// Educational insights based on current state
const getFlowInsight = (mode: Mode, time: number, _rectifyLevel: number): string => {
  if (mode === 'diffusion') {
    if (time < 0.2) return '🌀 Early diffusion: particles start from pure noise, wandering unpredictably'
    if (time < 0.8) return '🔀 Mid-diffusion: particles slowly find their way, taking curved, stochastic paths'
    return '✨ Late diffusion: particles settle into data distribution, but the journey was long!'
  } else {
    if (time < 0.2) return '🚀 Flow matching starts: straight paths from noise to data targets'
    if (time < 0.8) return '📏 Direct trajectories: particles take the shortest (OT-optimal) route'
    return '🎯 Arrival: minimal transport cost achieved via straight-line geodesics!'
  }
}

// ----- Component -----

export default function FlowMatchingOTDemo() {
  const [mode, setMode] = useState<Mode>('flow')
  const [time, setTime] = useState(0.25)
  const [numSteps, setNumSteps] = useState(10)
  const [showCouplings, setShowCouplings] = useState(true)
  const [particleSeed, setParticleSeed] = useState(1)
  const [isPlaying, setIsPlaying] = useState(true)
  const [rectifyLevel, setRectifyLevel] = useState(2)

  // Prediction game state
  const [gameMode, setGameMode] = useState(false)
  const [challengeParticleIdx, setChallengeParticleIdx] = useState(0)
  const [userGuess, setUserGuess] = useState<'shorter' | 'longer' | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)

  const particlePairs = useMemo(
    () => generateParticlePairs(particleSeed, PARTICLE_COUNT),
    [particleSeed],
  )

  const representativePair = particlePairs[0]

  const otStats = useMemo(() => {
    if (particlePairs.length === 0) {
      return {
        avgSegmentLength: 0,
        avgDiffusionLength: 0,
      }
    }

    let totalStraight = 0
    let totalCurved = 0
    for (const pair of particlePairs) {
      const straightLength = length(pair.delta)
      const curvedPath = samplePath(pair, 60, 1)
      const curvedLength = computePathLength(curvedPath)
      totalStraight += straightLength
      totalCurved += curvedLength
    }

    return {
      avgSegmentLength: totalStraight / particlePairs.length,
      avgDiffusionLength: totalCurved / particlePairs.length,
    }
  }, [particlePairs])

  // Path comparison for a single pair
  const pathComparison = useMemo(() => {
    if (!representativePair) {
      return {
        diffPathD: '',
        flowPathD: '',
        diffLength: 0,
        flowLength: 0,
      }
    }

    const diffPts = samplePath(representativePair, 80, 1)
    const flowPts = samplePath(representativePair, 2, 0)
    const diffLen = computePathLength(diffPts)
    const flowLen = length(representativePair.delta)

    return {
      diffPathD: buildPathD(diffPts, PATH_WIDTH, PATH_HEIGHT),
      flowPathD: buildPathD(flowPts, PATH_WIDTH, PATH_HEIGHT),
      diffLength: diffLen,
      flowLength: flowLen,
    }
  }, [representativePair])

  // Rectified flow iterations: 0 = diffusion, 3 = almost straight
  const rectifiedPaths = useMemo(() => {
    if (!representativePair) return []
    const levels = [1, 0.7, 0.35, 0]
    return levels.map((scale) => ({
      scale,
      d: buildPathD(samplePath(representativePair, 80, scale), PATH_WIDTH, PATH_HEIGHT),
    }))
  }, [representativePair])

  // Vector field grid (recomputed when time/mode/pairs change)
  const vectorField = useMemo(() => {
    const cells: { pos: Vec2; v: Vec2; mag: number }[] = []
    for (let iy = 0; iy < GRID_ROWS; iy++) {
      const ty = (iy + 0.5) / GRID_ROWS
      const wy = WORLD_Y_MIN + ty * (WORLD_Y_MAX - WORLD_Y_MIN)
      for (let ix = 0; ix < GRID_COLS; ix++) {
        const tx = (ix + 0.5) / GRID_COLS
        const wx = WORLD_X_MIN + tx * (WORLD_X_MAX - WORLD_X_MIN)
        const pos = { x: wx, y: wy }
        const v = vectorFieldAtPoint(pos, time, mode, particlePairs)
        const mag = length(v)
        cells.push({ pos, v, mag })
      }
    }
    return cells
  }, [particlePairs, mode, time])

  // Sampling quality at the chosen numSteps
  const qDiff = qualityDiffusion(numSteps)
  const qFlow = qualityFlow(numSteps)
  const qRect = qualityRectifiedFlow(numSteps)

  const samplingPaths = useMemo(() => {
    const n = 80
    const build = (curve: (s: number) => number): string => {
      const cmds: string[] = []
      for (let i = 0; i < n; i++) {
        const t = i / (n - 1)
        const steps = 1 + t * (MAX_STEPS - 1)
        const q = curve(steps)
        const x =
          PADDING +
          ((steps - 1) / (MAX_STEPS - 1)) * (SAMPLING_WIDTH - 2 * PADDING)
        const y =
          SAMPLING_HEIGHT -
          PADDING -
          q * (SAMPLING_HEIGHT - 2 * PADDING)
        cmds.push(`${i === 0 ? 'M' : 'L'} ${x} ${y}`)
      }
      return cmds.join(' ')
    }

    return {
      diff: build(qualityDiffusion),
      flow: build(qualityFlow),
      rect: build(qualityRectifiedFlow),
    }
  }, [])

  const selectedSamplingX =
    PADDING +
    ((numSteps - 1) / (MAX_STEPS - 1)) * (SAMPLING_WIDTH - 2 * PADDING)

  // Simple playback: animate t from 0 to 1
  useEffect(() => {
    if (!isPlaying) return
    let frameId: number
    let lastTime: number | null = null

    const loop = (timestamp: number) => {
      if (lastTime === null) lastTime = timestamp
      const dt = (timestamp - lastTime) / 1000
      lastTime = timestamp
      setTime((prev) => {
        let next = prev + dt * 0.2 // ~5s per cycle
        if (next > 1) next -= 1
        return next
      })
      frameId = requestAnimationFrame(loop)
    }

    frameId = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(frameId)
    }
  }, [isPlaying])

  if (!representativePair) {
    return null
  }

  const { avgSegmentLength, avgDiffusionLength } = otStats

  return (
    <section className="card interactive-card">
      <h2>Flow Matching, Diffusion, and Optimal Transport</h2>
      <p className="muted">
        Watch a cloud of Gaussian noise morph into a two-moons dataset. Toggle
        between stochastic diffusion-style curved paths and deterministic flow
        matching along straight, optimal-transport geodesics.
      </p>

      <div className="flow-layout">
        {/* Left: transport + vector field */}
        <div className="flow-column left">
          {/* Transport panel */}
          <div className="flow-panel">
            <div className="flow-panel-header">
              <h3 className="flow-panel-title">Transport between noise and data</h3>
              <div className="flow-legend">
                <span className="dot noise" />
                <span className="label">Noise samples</span>
                <span className="dot data" />
                <span className="label">Target data</span>
                <span className="dot current" />
                <span className="label">Particles at time t</span>
              </div>
            </div>
            <svg
              width={TRANSPORT_WIDTH}
              height={TRANSPORT_HEIGHT}
              role="img"
              className="flow-chart transport-chart"
              aria-label="Particles moving from a Gaussian source distribution to a two-moons target distribution"
            >
              {/* Axes */}
              <line
                x1={xToSvg(WORLD_X_MIN, TRANSPORT_WIDTH)}
                y1={yToSvg(0, TRANSPORT_HEIGHT)}
                x2={xToSvg(WORLD_X_MAX, TRANSPORT_WIDTH)}
                y2={yToSvg(0, TRANSPORT_HEIGHT)}
                className="axis-line"
              />
              <line
                x1={xToSvg(0, TRANSPORT_WIDTH)}
                y1={yToSvg(WORLD_Y_MIN, TRANSPORT_HEIGHT)}
                x2={xToSvg(0, TRANSPORT_WIDTH)}
                y2={yToSvg(WORLD_Y_MAX, TRANSPORT_HEIGHT)}
                className="axis-line"
              />

              {/* Coupling lines = OT plan */}
              {showCouplings &&
                particlePairs.map((pair) => {
                  const srcSvg = vecToSvg(pair.src, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                  const tgtSvg = vecToSvg(pair.tgt, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                  return (
                    <line
                      key={`c-${pair.id}`}
                      x1={srcSvg.x}
                      y1={srcSvg.y}
                      x2={tgtSvg.x}
                      y2={tgtSvg.y}
                      className="ot-coupling-line"
                    />
                  )
                })}

              {/* Static source & target clouds */}
              {particlePairs.map((pair) => {
                const srcSvg = vecToSvg(pair.src, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                const tgtSvg = vecToSvg(pair.tgt, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                return (
                  <g key={`s-${pair.id}`}>
                    <circle
                      cx={srcSvg.x}
                      cy={srcSvg.y}
                      r={3}
                      className="particle-src"
                    />
                    <circle
                      cx={tgtSvg.x}
                      cy={tgtSvg.y}
                      r={3}
                      className="particle-tgt"
                    />
                  </g>
                )
              })}

              {/* Moving particles */}
              {particlePairs.map((pair) => {
                const pos = getParticlePosition(pair, time, mode)
                const pSvg = vecToSvg(pos, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                return (
                  <circle
                    key={`p-${pair.id}`}
                    cx={pSvg.x}
                    cy={pSvg.y}
                    r={4}
                    className={
                      mode === 'diffusion'
                        ? 'particle-current diffusion'
                        : 'particle-current flow'
                    }
                  />
                )
              })}
            </svg>

            <div className="flow-stats">
              <div>
                <span className="label">Average OT cost</span>
                <span>{avgSegmentLength.toFixed(2)}</span>
              </div>
              <div>
                <span className="label">Avg diffusion path length</span>
                <span>
                  {avgDiffusionLength.toFixed(2)}{' '}
                  {avgSegmentLength > 0 && (
                    <span className="muted-inline">
                      (
                      {(avgDiffusionLength / avgSegmentLength).toFixed(2)}
                      × longer)
                    </span>
                  )}
                </span>
              </div>
            </div>
            <p className="caption">
              Coupling lines show an optimal-transport plan: each noise sample is
              matched to a target sample, and straight segments give the
              displacement interpolation that minimizes average transport cost.
            </p>
          </div>

          {/* Vector field panel */}
          <div className="flow-panel">
            <h3 className="flow-panel-title">Vector field v(x, t)</h3>
            <svg
              width={VECTOR_WIDTH}
              height={VECTOR_HEIGHT}
              role="img"
              className="flow-chart vector-field-chart"
              aria-label="Vector field guiding particles from source to target"
            >
              {/* Background box */}
              <rect
                x={PADDING}
                y={PADDING}
                width={VECTOR_WIDTH - 2 * PADDING}
                height={VECTOR_HEIGHT - 2 * PADDING}
                className="vector-bg"
              />
              {/* Grid arrows */}
              {vectorField.map(({ pos, v, mag }, idx) => {
                if (mag < 0.05) return null
                const tail = vecToSvg(pos, VECTOR_WIDTH, VECTOR_HEIGHT)
                const dir = normalize(v)
                const scale = 0.6 * (mag / (1 + mag)) // saturating
                const headWorld: Vec2 = {
                  x: pos.x + dir.x * scale,
                  y: pos.y + dir.y * scale,
                }
                const head = vecToSvg(headWorld, VECTOR_WIDTH, VECTOR_HEIGHT)
                const color = magnitudeColor(mag)

                // small arrowhead
                const backWorld: Vec2 = {
                  x: headWorld.x - dir.x * 0.2 * scale,
                  y: headWorld.y - dir.y * 0.2 * scale,
                }
                const back = vecToSvg(backWorld, VECTOR_WIDTH, VECTOR_HEIGHT)

                return (
                  <g key={idx}>
                    <line
                      x1={tail.x}
                      y1={tail.y}
                      x2={head.x}
                      y2={head.y}
                      stroke={color}
                      className="vector-arrow"
                    />
                    <circle cx={tail.x} cy={tail.y} r={1.2} fill={color} />
                    <circle cx={back.x} cy={back.y} r={1} fill={color} />
                  </g>
                )
              })}
            </svg>
            <p className="caption">
              Diffusion mode shows a noisy, swirling field; flow matching learns a
              clean vector field whose streamlines are straight rays from noise to
              data.
            </p>
          </div>
        </div>

        {/* Right: controls + path comparison + sampling + rectified flow */}
        <div className="flow-column right">
          {/* Path Race Game */}
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              borderRadius: '10px',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(139, 92, 246, 0.1) 100%)'
                : 'rgba(15, 23, 42, 0.3)',
              border: gameMode ? '2px solid #f59e0b' : '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: gameMode ? '1rem' : 0 }}>
              <button
                type="button"
                onClick={() => {
                  setGameMode(!gameMode)
                  if (!gameMode) {
                    setUserGuess(null)
                    setRevealed(false)
                    setChallengeParticleIdx(Math.floor(Math.random() * particlePairs.length))
                  }
                }}
                style={{
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: 'none',
                  background: gameMode
                    ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                {gameMode ? '🛑 Exit Game' : '🎮 Path Race Challenge!'}
              </button>

              {(score > 0 || attempts > 0) && (
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span>🏆 Score: {score}/{attempts}</span>
                </div>
              )}
            </div>

            {gameMode && (() => {
              const challengePair = particlePairs[challengeParticleIdx]
              if (!challengePair) return null
              const diffPath = samplePath(challengePair, 60, 1)
              const diffLen = computePathLength(diffPath)
              const flowLen = length(challengePair.delta)
              const ratio = diffLen / flowLen

              return (
                <div style={{ marginTop: '0.75rem' }}>
                  <p style={{ fontWeight: 500, marginBottom: '0.75rem' }}>
                    🤔 For particle #{challengeParticleIdx}: Is the diffusion path <strong>longer</strong> or <strong>shorter</strong> than the flow path?
                  </p>

                  {!revealed ? (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setUserGuess('shorter')}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: userGuess === 'shorter' ? '2px solid #3b82f6' : '1px solid #6b7280',
                          background: userGuess === 'shorter' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                          color: '#e5e7eb',
                          cursor: 'pointer',
                          fontWeight: userGuess === 'shorter' ? 600 : 400,
                        }}
                      >
                        📉 Shorter
                      </button>
                      <button
                        type="button"
                        onClick={() => setUserGuess('longer')}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: userGuess === 'longer' ? '2px solid #3b82f6' : '1px solid #6b7280',
                          background: userGuess === 'longer' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
                          color: '#e5e7eb',
                          cursor: 'pointer',
                          fontWeight: userGuess === 'longer' ? 600 : 400,
                        }}
                      >
                        📈 Longer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealed(true)
                          setAttempts((prev) => prev + 1)
                          // Diffusion is always longer (curved), so "longer" is correct
                          if (userGuess === 'longer') setScore((prev) => prev + 1)
                        }}
                        disabled={!userGuess}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: userGuess
                            ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                            : '#374151',
                          color: userGuess ? 'white' : '#6b7280',
                          fontWeight: 600,
                          cursor: userGuess ? 'pointer' : 'not-allowed',
                        }}
                      >
                        🔍 Check
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          background: userGuess === 'longer'
                            ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                            : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                          color: 'white',
                          fontWeight: 600,
                        }}
                      >
                        {userGuess === 'longer'
                          ? '🎉 Correct! Diffusion paths are always longer (curved)'
                          : '❌ Wrong! Diffusion curves are always longer than straight OT paths'}
                      </span>
                      <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                        (Diff: {diffLen.toFixed(2)} vs Flow: {flowLen.toFixed(2)} = {ratio.toFixed(2)}× longer)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setChallengeParticleIdx(Math.floor(Math.random() * particlePairs.length))
                          setUserGuess(null)
                          setRevealed(false)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: 'none',
                          background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                          color: 'white',
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        ➡️ Next Particle
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>

          {/* Global controls */}
          <div className="flow-panel controls-panel">
            <h3 className="flow-panel-title">Controls</h3>

            {/* Presets */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '0.25rem' }}>🎮 Presets:</span>
              {FLOW_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    if (preset.seed === -1) {
                      setParticleSeed(Date.now())
                    } else {
                      setParticleSeed(preset.seed)
                    }
                  }}
                  title={preset.description}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    border: particleSeed === preset.seed
                      ? '2px solid #f59e0b'
                      : '1px solid rgba(148, 163, 184, 0.3)',
                    background: particleSeed === preset.seed
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(15, 23, 42, 0.8)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: particleSeed === preset.seed ? 600 : 400,
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            {/* Insight box */}
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                background: mode === 'diffusion'
                  ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.2) 0%, rgba(20, 184, 166, 0.1) 100%)'
                  : 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)',
                border: '1px solid rgba(148, 163, 184, 0.2)',
                fontSize: '0.9rem',
                marginBottom: '0.75rem',
              }}
            >
              {getFlowInsight(mode, time, rectifyLevel)}
            </div>

            <div className="flow-controls">
              <label className="slider-label">
                Time t ({time.toFixed(2)})
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={time}
                  onChange={(e) => setTime(parseFloat(e.target.value))}
                />
              </label>
              <label className="slider-label">
                Sampling steps ({numSteps})
                <input
                  type="range"
                  min={3}
                  max={MAX_STEPS}
                  step={1}
                  value={numSteps}
                  onChange={(e) => setNumSteps(parseInt(e.target.value, 10))}
                />
              </label>
              <div className="flow-toggle-row">
                <button
                  type="button"
                  onClick={() => setMode('diffusion')}
                  className={`toggle-btn ${mode === 'diffusion' ? 'active' : ''}`}
                >
                  Diffusion (curved)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('flow')}
                  className={`toggle-btn ${mode === 'flow' ? 'active' : ''}`}
                >
                  Flow matching (straight)
                </button>
              </div>
              <div className="flow-toggle-row secondary">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={showCouplings}
                    onChange={(e) => setShowCouplings(e.target.checked)}
                  />{' '}
                  Show OT coupling lines
                </label>
              </div>
              <div className="flow-buttons">
                <button
                  type="button"
                  onClick={() => setParticleSeed((s) => s + 1)}
                >
                  Sample new particles
                </button>
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="ghost"
                >
                  {isPlaying ? 'Pause animation' : 'Play animation'}
                </button>
              </div>
            </div>
          </div>

          {/* Path comparison */}
          <div className="flow-panel">
            <h3 className="flow-panel-title">Path comparison (single particle)</h3>
            <svg
              width={PATH_WIDTH}
              height={PATH_HEIGHT}
              role="img"
              className="flow-chart path-chart"
              aria-label="Curved diffusion path versus straight flow-matching path"
            >
              {/* Straight line = OT displacement */}
              <path
                d={pathComparison.flowPathD}
                className="path-flow"
                stroke={MATH_COLORS.primary}
              />
              {/* Curved diffusion path */}
              <path
                d={pathComparison.diffPathD}
                className="path-diffusion"
                stroke={MATH_COLORS.secondary}
              />

              {/* Moving markers at global time t */}
              {(() => {
                const straightPos = getPathPosition(representativePair, time, 0)
                const diffPos = getPathPosition(representativePair, time, 1)
                const sSvg = vecToSvg(straightPos, PATH_WIDTH, PATH_HEIGHT)
                const dSvg = vecToSvg(diffPos, PATH_WIDTH, PATH_HEIGHT)
                return (
                  <g>
                    <circle
                      cx={sSvg.x}
                      cy={sSvg.y}
                      r={5}
                      className="marker-flow"
                    />
                    <circle
                      cx={dSvg.x}
                      cy={dSvg.y}
                      r={5}
                      className="marker-diffusion"
                    />
                  </g>
                )
              })()}
            </svg>
            <div className="flow-stats">
              <div>
                <span className="label">Straight path length</span>
                <span>{pathComparison.flowLength.toFixed(2)}</span>
              </div>
              <div>
                <span className="label">Diffusion path length</span>
                <span>
                  {pathComparison.diffLength.toFixed(2)}{' '}
                  <span className="muted-inline">
                    (
                    {(
                      pathComparison.diffLength / pathComparison.flowLength
                    ).toFixed(2)}
                    × longer)
                  </span>
                </span>
              </div>
            </div>
            <p className="caption">
              OT theory says the shortest way to move mass between endpoints is a
              straight line. Diffusion burns extra cost by wandering along
              curved, noisy paths.
            </p>
          </div>

          {/* Sampling speed panel */}
          <div className="flow-panel">
            <h3 className="flow-panel-title">Sampling speed vs. steps</h3>
            <svg
              width={SAMPLING_WIDTH}
              height={SAMPLING_HEIGHT}
              role="img"
              className="flow-chart sampling-chart"
              aria-label="Quality versus number of sampling steps for diffusion, flow matching, and rectified flow"
            >
              <rect
                x={PADDING}
                y={PADDING}
                width={SAMPLING_WIDTH - 2 * PADDING}
                height={SAMPLING_HEIGHT - 2 * PADDING}
                className="vector-bg"
              />
              {/* Curves */}
              <path
                d={samplingPaths.diff}
                className="sampling-curve diffusion"
              />
              <path
                d={samplingPaths.flow}
                className="sampling-curve flow"
              />
              <path
                d={samplingPaths.rect}
                className="sampling-curve rectified"
              />

              {/* Vertical line at selected step count */}
              <line
                x1={selectedSamplingX}
                y1={PADDING}
                x2={selectedSamplingX}
                y2={SAMPLING_HEIGHT - PADDING}
                className="sampling-steps-line"
              />

              {/* Markers at current step for each method */}
              {[
                { q: qDiff, className: 'diffusion' },
                { q: qFlow, className: 'flow' },
                { q: qRect, className: 'rectified' },
              ].map(({ q, className }, _idx) => {
                const y =
                  SAMPLING_HEIGHT -
                  PADDING -
                  q * (SAMPLING_HEIGHT - 2 * PADDING)
                return (
                  <circle
                    key={className}
                    cx={selectedSamplingX}
                    cy={y}
                    r={3.5}
                    className={`sampling-marker ${className}`}
                  />
                )
              })}
            </svg>
            <div className="flow-stats sampling-stats">
              <div>
                <span className="label">Diffusion quality</span>
                <span>{Math.round(qDiff * 100)}%</span>
              </div>
              <div>
                <span className="label">Flow matching quality</span>
                <span>{Math.round(qFlow * 100)}%</span>
              </div>
              <div>
                <span className="label">Rectified flow quality</span>
                <span>{Math.round(qRect * 100)}%</span>
              </div>
            </div>
            <p className="caption">
              Curved diffusion paths need many tiny steps. Once paths are
              straight (flow matching) or nearly straight everywhere (rectified
              flow), far fewer steps are needed for the same sample quality.
            </p>
          </div>

          {/* Rectified flow panel */}
          <div className="flow-panel">
            <div className="flow-panel-header">
              <h3 className="flow-panel-title">Rectified flow straightens paths</h3>
              <label className="slider-label compact">
                Rectification level ({rectifyLevel})
                <input
                  type="range"
                  min={0}
                  max={3}
                  step={1}
                  value={rectifyLevel}
                  onChange={(e) => setRectifyLevel(parseInt(e.target.value, 10))}
                />
              </label>
            </div>
            <svg
              width={PATH_WIDTH}
              height={PATH_HEIGHT}
              role="img"
              className="flow-chart rectified-chart"
              aria-label="Rectified flow gradually straightens diffusion paths"
            >
              {rectifiedPaths.map((p, idx) => {
                const isActive = idx === rectifyLevel
                const curveScale = p.scale
                const pos = getPathPosition(
                  representativePair,
                  time,
                  curveScale,
                )
                const svgPos = vecToSvg(pos, PATH_WIDTH, PATH_HEIGHT)
                return (
                  <g key={idx}>
                    <path
                      d={p.d}
                      className={`rectified-path level-${idx} ${
                        isActive ? 'active' : ''
                      }`}
                    />
                    <circle
                      cx={svgPos.x}
                      cy={svgPos.y}
                      r={isActive ? 5 : 3}
                      className={`rectified-marker level-${idx} ${
                        isActive ? 'active' : ''
                      }`}
                    />
                  </g>
                )
              })}
            </svg>
            <p className="caption">
              Start from a noisy diffusion path (level 0) and iteratively train
              flows that follow the average direction. Each rectification level
              straightens the trajectory, converging to the optimal-transport
              straight line used by fast modern models like SDXL Turbo and Stable
              Diffusion 3.
            </p>
          </div>
        </div>
      </div>

      <p className="caption">
        Takeaway: diffusion is like wandering through curved, stochastic
        trajectories, while flow matching (and rectified flow) learns almost
        straight, optimal-transport paths. Straighter paths mean fewer steps and
        much faster generation — diffusion done right.
      </p>
    </section>
  )
}
