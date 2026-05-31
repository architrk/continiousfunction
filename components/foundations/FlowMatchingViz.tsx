import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../lib/demoState'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

type Vec2 = { x: number; y: number }
type Mode = 'diffusion' | 'flow'
type GuessKind = 'full-displacement' | 'remaining-to-data' | 'back-to-noise' | 'unit-direction'

type FlowMatchingVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
  initialSeed?: number
  initialTime?: number
  initialPairIndex?: number
}

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

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
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

function scaleVector(v: Vec2, scale: number): Vec2 {
  return { x: v.x * scale, y: v.y * scale }
}

function addVec(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y }
}

function formatVec(v: Vec2): string {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)})`
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

const VELOCITY_CHOICES: { kind: GuessKind; label: string; description: string }[] = [
  {
    kind: 'full-displacement',
    label: 'Full displacement',
    description: 'u_t = x1 - x0',
  },
  {
    kind: 'remaining-to-data',
    label: 'Remaining displacement',
    description: 'x1 - xt',
  },
  {
    kind: 'back-to-noise',
    label: 'Back toward noise',
    description: 'x0 - xt',
  },
  {
    kind: 'unit-direction',
    label: 'Unit direction only',
    description: 'direction without magnitude',
  },
]

const FLOW_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Choose the supervised vector before seeing the arrow.',
  },
  {
    label: 'Observe',
    detail: 'Reveal the full displacement label for this pair.',
  },
  {
    label: 'Ground',
    detail: 'Compare it with the remaining displacement.',
  },
  {
    label: 'Carry',
    detail: 'Notice the same u_t stays fixed as t changes.',
  },
]

// Educational insights based on current state
const getFlowInsight = (mode: Mode, time: number, _rectifyLevel: number): string => {
  if (mode === 'diffusion') {
    if (time < 0.2) return 'Early contrast path: particles start near the source distribution.'
    if (time < 0.8) return 'Middle contrast path: the hand-built curved path bends away from the straight interpolation.'
    return 'Late contrast path: particles approach the target distribution along this synthetic curve.'
  } else {
    if (time < 0.2) return 'Flow matching starts: the conditional path moves along a chosen straight interpolation.'
    if (time < 0.8) return 'Flow matching target: the supervised velocity is the full pair displacement, not the remaining arrow.'
    return 'Arrival: the current point is near data, but the conditional velocity label is still x1 - x0.'
  }
}

// ----- Component -----

export default function FlowMatchingOTDemo({
  chrome = 'legacy',
  conceptId = 'flow-matching',
  initialSeed = 1,
  initialTime = 0.35,
  initialPairIndex = 0,
}: FlowMatchingVizProps) {
  const isNotebook = chrome === 'notebook'
  const initialDisplayTime = isNotebook
    ? Math.max(0.05, Math.min(0.95, initialTime))
    : clamp01(initialTime)
  const [mode, setMode] = useState<Mode>('flow')
  const [time, setTime] = useState(initialDisplayTime)
  const [numSteps, setNumSteps] = useState(10)
  const [showCouplings, setShowCouplings] = useState(true)
  const [particleSeed, setParticleSeed] = useState(initialSeed)
  const [isPlaying, setIsPlaying] = useState(!isNotebook)
  const [rectifyLevel, setRectifyLevel] = useState(2)
  const [selectedPairIndex, setSelectedPairIndex] = useState(initialPairIndex)
  const [velocityGuess, setVelocityGuess] = useState<GuessKind | null>(null)
  const [isTargetRevealed, setIsTargetRevealed] = useState(false)
  const [showBackgroundPairs, setShowBackgroundPairs] = useState(true)

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
  const safeSelectedPairIndex = particlePairs.length
    ? ((selectedPairIndex % particlePairs.length) + particlePairs.length) % particlePairs.length
    : 0
  const selectedPair = (particlePairs[safeSelectedPairIndex] ?? representativePair)!

  const selectedXt = useMemo(
    () => selectedPair
      ? interpolate(selectedPair.src, selectedPair.tgt, time)
      : { x: 0, y: 0 },
    [selectedPair, time],
  )
  const velocityTarget = useMemo(
    () => selectedPair
      ? { x: selectedPair.tgt.x - selectedPair.src.x, y: selectedPair.tgt.y - selectedPair.src.y }
      : { x: 0, y: 0 },
    [selectedPair],
  )
  const remainingDisplacement = useMemo(
    () => selectedPair
      ? { x: selectedPair.tgt.x - selectedXt.x, y: selectedPair.tgt.y - selectedXt.y }
      : { x: 0, y: 0 },
    [selectedPair, selectedXt],
  )
  const remainingScale = 1 - time
  const targetMagnitude = length(velocityTarget)
  const remainingMagnitude = length(remainingDisplacement)
  const flowEvidenceActiveIndex = isTargetRevealed ? 3 : velocityGuess ? 1 : 0
  const flowEvidencePhase = FLOW_EVIDENCE_STEPS[flowEvidenceActiveIndex].label

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

  useEffect(() => {
    if (!isNotebook || !selectedPair) return

    const guessLabel = VELOCITY_CHOICES.find((choice) => choice.kind === velocityGuess)?.description
      ?? 'none'
    const values = [
      `t: ${time.toFixed(2)}`,
      `pair id: ${selectedPair.id}`,
      `guess: ${guessLabel}`,
      'evidence loop: predict -> observe -> ground -> carry',
      `evidence phase: ${flowEvidencePhase}`,
      `target visible: ${isTargetRevealed ? 'yes' : 'no'}`,
      `background pairs: ${showBackgroundPairs ? 'shown' : 'hidden'}`,
    ]

    if (isTargetRevealed) {
      values.push(
        `x0: ${formatVec(selectedPair.src)}`,
        `x1: ${formatVec(selectedPair.tgt)}`,
        `xt: ${formatVec(selectedXt)}`,
        `target velocity u_t: ${formatVec(velocityTarget)}`,
        `remaining displacement: ${formatVec(remainingDisplacement)}`,
        `remaining scale: ${remainingScale.toFixed(2)}`,
        `target magnitude: ${targetMagnitude.toFixed(2)}`,
        `remaining magnitude: ${remainingMagnitude.toFixed(2)}`,
        `correct: ${velocityGuess === 'full-displacement' ? 'yes' : 'no'}`,
      )
    } else {
      values.push('target velocity: hidden until reveal')
    }

    emitDemoState({
      conceptId,
      label: 'Flow matching conditional velocity target demo',
      summary: isTargetRevealed
        ? 'The revealed conditional velocity label is u_t = x1 - x0 for the highlighted straight interpolation.'
        : 'Predict which candidate vector is the conditional velocity label for the highlighted straight interpolation.',
      values,
    })
  }, [
    conceptId,
    flowEvidencePhase,
    isNotebook,
    isTargetRevealed,
    remainingDisplacement,
    remainingMagnitude,
    remainingScale,
    selectedPair,
    selectedXt,
    showBackgroundPairs,
    targetMagnitude,
    time,
    velocityGuess,
    velocityTarget,
  ])

  if (!representativePair) {
    return null
  }

  const { avgSegmentLength, avgDiffusionLength } = otStats

  return (
    <>
    <section className={isNotebook ? 'flow-matching-demo notebook' : 'card interactive-card flow-matching-demo legacy'}>
      {!isNotebook ? (
        <>
          <h2>Flow Matching, Diffusion, and Pair Transport</h2>
          <p className="muted">
            Watch a cloud of Gaussian noise morph into a two-moons dataset. Toggle
            between synthetic curved contrast paths and deterministic flow
            matching along chosen straight conditional paths.
          </p>
        </>
      ) : null}

      {isNotebook ? (
        <div
          className="velocity-prediction-panel"
          data-child-demo-gate="flow-matching-velocity-target"
        >
          <h3>Prediction check: which velocity is supervised?</h3>
          <p>
            The highlighted particle sits at <code>x_t = (1-t)x_0 + t x_1</code>.
            Predict the conditional flow-matching label before revealing the
            arrow anchored at the current point.
          </p>
          <div className="velocity-choice-grid">
            {VELOCITY_CHOICES.map((choice) => (
              <button
                key={choice.kind}
                type="button"
                aria-pressed={velocityGuess === choice.kind}
                onClick={() => {
                  setVelocityGuess(choice.kind)
                  setIsTargetRevealed(false)
                }}
              >
                <span>{choice.label}</span>
                <small>{choice.description}</small>
              </button>
            ))}
          </div>
          <div className="evidence-strip" aria-label="Flow matching evidence loop">
            {FLOW_EVIDENCE_STEPS.map((step, index) => (
              <div
                key={step.label}
                className="evidence-step"
                data-active={index <= flowEvidenceActiveIndex ? 'true' : 'false'}
              >
                <span>{index + 1}</span>
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </div>
            ))}
          </div>
          <div className="velocity-actions">
            <button
              type="button"
              disabled={!velocityGuess}
              onClick={() => setIsTargetRevealed(true)}
            >
              Reveal velocity target
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setSelectedPairIndex((idx) => (idx + 17) % particlePairs.length)
                setVelocityGuess(null)
                setIsTargetRevealed(false)
              }}
            >
              New pair
            </button>
          </div>
          {isTargetRevealed ? (
            <p className="velocity-result" role="status" aria-live="polite">
              {velocityGuess === 'full-displacement'
                ? 'Correct: '
                : velocityGuess === 'remaining-to-data'
                  ? 'Common trap: '
                  : velocityGuess === 'unit-direction'
                    ? 'Direction alone is not enough: '
                    : 'Not the supervised direction: '}
              the conditional label is the full displacement
              {' '}<code>u_t = x_1 - x_0</code>. The remaining arrow
              {' '}<code>x_1 - x_t</code> is shorter because only
              {' '}<code>1 - t</code> units of integration time remain.
            </p>
          ) : null}
          <p className="velocity-formula">
            {isTargetRevealed ? (
              <>
                Because <code>u_t = x_1 - x_0</code>, the remaining displacement
                satisfies <code>x_t + (1 - t) u_t = x_1</code>. The visual arrows
                are scaled with a shared factor for readability.
              </>
            ) : (
              'Choose a candidate, then reveal the target arrow and compare it with the remaining displacement.'
            )}
          </p>
        </div>
      ) : null}

      <div className="flow-layout">
        {/* Left: transport + vector field */}
        <div className="flow-column left">
          {/* Transport panel */}
          <div className="flow-panel">
            <div className="flow-panel-header">
              <h3 className="flow-panel-title">
                {isNotebook ? 'Conditional velocity target' : 'Transport between noise and data'}
              </h3>
              <div className="flow-legend">
                <span className="dot noise" />
                <span className="label">{isNotebook ? 'x0 noise' : 'Noise samples'}</span>
                <span className="dot data" />
                <span className="label">{isNotebook ? 'x1 data' : 'Target data'}</span>
                <span className="dot current" />
                <span className="label">{isNotebook ? 'xt current' : 'Particles at time t'}</span>
              </div>
            </div>
            <svg
              width={TRANSPORT_WIDTH}
              height={TRANSPORT_HEIGHT}
              role="img"
              className="flow-chart transport-chart"
              aria-label="Particles moving from a Gaussian source distribution to a two-moons target distribution"
            >
              <defs>
                <marker
                  id="flow-velocity-arrowhead"
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
                  id="flow-remaining-arrowhead"
                  markerWidth="8"
                  markerHeight="8"
                  refX="7"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M 0 0 L 8 4 L 0 8 z" fill="#f59e0b" />
                </marker>
              </defs>
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
              {(isNotebook || showCouplings) &&
                particlePairs.map((pair) => {
                  if (isNotebook && pair.id !== selectedPair.id && !showBackgroundPairs) return null
                  const srcSvg = vecToSvg(pair.src, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                  const tgtSvg = vecToSvg(pair.tgt, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                  return (
                    <line
                      key={`c-${pair.id}`}
                      x1={srcSvg.x}
                      y1={srcSvg.y}
                      x2={tgtSvg.x}
                      y2={tgtSvg.y}
                      className={`ot-coupling-line ${isNotebook && pair.id === selectedPair.id ? 'selected' : ''}`}
                    />
                  )
                })}

              {/* Static source & target clouds */}
              {particlePairs.map((pair) => {
                if (isNotebook && pair.id !== selectedPair.id && !showBackgroundPairs) return null
                const srcSvg = vecToSvg(pair.src, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                const tgtSvg = vecToSvg(pair.tgt, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                const particleClass = isNotebook && pair.id === selectedPair.id
                  ? 'selected'
                  : isNotebook
                    ? 'context'
                    : ''
                return (
                  <g key={`s-${pair.id}`}>
                    <circle
                      cx={srcSvg.x}
                      cy={srcSvg.y}
                      r={3}
                      className={`particle-src ${particleClass}`}
                    />
                    <circle
                      cx={tgtSvg.x}
                      cy={tgtSvg.y}
                      r={3}
                      className={`particle-tgt ${particleClass}`}
                    />
                  </g>
                )
              })}

              {/* Moving particles */}
              {particlePairs.map((pair) => {
                if (isNotebook && pair.id !== selectedPair.id && !showBackgroundPairs) return null
                const pos = isNotebook
                  ? getPathPosition(pair, time, 0)
                  : getParticlePosition(pair, time, mode)
                const pSvg = vecToSvg(pos, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                const currentClass = isNotebook && pair.id === selectedPair.id
                  ? 'particle-current flow selected'
                  : mode === 'diffusion'
                    ? 'particle-current diffusion'
                    : 'particle-current flow'
                return (
                  <circle
                    key={`p-${pair.id}`}
                    cx={pSvg.x}
                    cy={pSvg.y}
                    r={4}
                    className={currentClass}
                  />
                )
              })}

              {isNotebook && selectedPair ? (() => {
                const anchor = vecToSvg(selectedXt, TRANSPORT_WIDTH, TRANSPORT_HEIGHT)
                const maxArrowWorld = 1.25
                const arrowScale = targetMagnitude > 0
                  ? Math.min(1, maxArrowWorld / targetMagnitude)
                  : 1
                const targetEnd = vecToSvg(
                  addVec(selectedXt, scaleVector(velocityTarget, arrowScale)),
                  TRANSPORT_WIDTH,
                  TRANSPORT_HEIGHT,
                )
                const remainingEnd = vecToSvg(
                  addVec(selectedXt, scaleVector(remainingDisplacement, arrowScale)),
                  TRANSPORT_WIDTH,
                  TRANSPORT_HEIGHT,
                )

                return (
                  <g className="velocity-target-layer">
                    {isTargetRevealed ? (
                      <>
                        <line
                          x1={anchor.x}
                          y1={anchor.y}
                          x2={remainingEnd.x}
                          y2={remainingEnd.y}
                          className="remaining-arrow"
                          markerEnd="url(#flow-remaining-arrowhead)"
                        />
                        <line
                          x1={anchor.x}
                          y1={anchor.y}
                          x2={targetEnd.x}
                          y2={targetEnd.y}
                          className="velocity-target-arrow"
                          markerEnd="url(#flow-velocity-arrowhead)"
                        />
                      </>
                    ) : null}
                  </g>
                )
              })() : null}
            </svg>

            <div className="flow-stats">
              <div>
                <span className="label">
                  {isNotebook ? 'Average pair displacement' : 'Average pair distance'}
                </span>
                <span>{avgSegmentLength.toFixed(2)}</span>
              </div>
              <div>
                <span className="label">
                  {isNotebook ? 'Target magnitude' : 'Avg curved contrast path'}
                </span>
                <span>
                  {isNotebook
                    ? isTargetRevealed
                      ? targetMagnitude.toFixed(2)
                      : 'hidden until reveal'
                    : avgDiffusionLength.toFixed(2)}{' '}
                  {!isNotebook && avgSegmentLength > 0 && (
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
              {isNotebook
                ? 'Lines show synthetic training pairings used to define conditional targets in this toy. They are not a solved optimal-transport assignment.'
                : 'Pairing lines show chosen source-target training examples. Straight segments define the conditional interpolation used by this toy; no OT assignment is solved here.'}
            </p>
          </div>

          {/* Vector field panel */}
          <div className="flow-panel">
            <h3 className="flow-panel-title">
              {isNotebook ? 'Aggregate vector field sketch' : 'Vector field v(x, t)'}
            </h3>
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
              {isNotebook
                ? isTargetRevealed
                  ? 'For one conditional pair, the revealed supervised target is a constant arrow. A model trained on many pairs only sees (x_t, t), so nearby examples can average into a different marginal field.'
                  : 'This sketch shows how many conditional examples can contribute nearby directions. After the reveal, compare the single-pair label with this aggregate field.'
                : 'The flow view averages many conditional pair velocities into a toy vector field; the curved diffusion view is only contrast geometry, not a trained sampler.'}
            </p>
          </div>
        </div>

        {/* Right: controls + path comparison + sampling + rectified flow */}
        <div className="flow-column right">
          {/* Path Race Game */}
          {!isNotebook ? (
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
                {gameMode ? 'Exit challenge' : 'Path length check'}
              </button>

              {(score > 0 || attempts > 0) && (
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span>Score: {score}/{attempts}</span>
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
                    For particle #{challengeParticleIdx}: Is the synthetic curved path <strong>longer</strong> or <strong>shorter</strong> than the straight interpolation?
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
                        Shorter
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
                        Longer
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRevealed(true)
                          setAttempts((prev) => prev + 1)
                          // This toy's curved contrast path is longer than its straight interpolation.
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
                        Check
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
                          ? 'Correct: this synthetic curved path is longer.'
                          : 'Not for this toy: the curved path is longer than the straight interpolation.'}
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
                        Next particle
                      </button>
                    </div>
                  )}
                </div>
              )
            })()}
          </div>
          ) : null}

          {/* Global controls */}
          <div className="flow-panel controls-panel">
            <h3 className="flow-panel-title">{isNotebook ? 'Inspect the interpolation time' : 'Controls'}</h3>

            {/* Presets */}
            {!isNotebook ? (
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
            ) : null}

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
              {isNotebook
                ? isTargetRevealed
                  ? `At t=${time.toFixed(2)}, the remaining displacement is ${(1 - time).toFixed(2)} times the full velocity label. The supervised target u_t itself does not shrink as t changes.`
                  : `At t=${time.toFixed(2)}, the current point x_t lies on the selected straight interpolation. Reveal the target to compare the supervised label with the remaining arrow.`
                : getFlowInsight(mode, time, rectifyLevel)}
            </div>

            <div className="flow-controls">
              <label className="slider-label">
                Time t ({time.toFixed(2)})
                <input
                  type="range"
                  min={isNotebook ? 0.05 : 0}
                  max={isNotebook ? 0.95 : 1}
                  step={0.01}
                  value={time}
                  onChange={(e) => setTime(parseFloat(e.target.value))}
                />
              </label>
              {!isNotebook ? (
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
              ) : null}
              {!isNotebook ? (
              <div className="flow-toggle-row">
                <button
                  type="button"
                  aria-pressed={mode === 'diffusion'}
                  onClick={() => setMode('diffusion')}
                  className={`toggle-btn ${mode === 'diffusion' ? 'active' : ''}`}
                >
                  Diffusion (curved)
                </button>
                <button
                  type="button"
                  aria-pressed={mode === 'flow'}
                  onClick={() => setMode('flow')}
                  className={`toggle-btn ${mode === 'flow' ? 'active' : ''}`}
                >
                  Flow matching (straight)
                </button>
              </div>
              ) : null}
              <div className="flow-toggle-row secondary">
                <label className="toggle-label">
                  <input
                    type="checkbox"
                    checked={isNotebook ? showBackgroundPairs : showCouplings}
                    onChange={(e) => {
                      if (isNotebook) {
                        setShowBackgroundPairs(e.target.checked)
                      } else {
                        setShowCouplings(e.target.checked)
                      }
                    }}
                  />{' '}
                  {isNotebook ? 'Show paired examples' : 'Show paired examples'}
                </label>
              </div>
              {!isNotebook ? (
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
              ) : null}
            </div>
          </div>

          {/* Path comparison */}
          {!isNotebook ? (
          <>
          <div className="flow-panel">
            <h3 className="flow-panel-title">Path comparison (single particle)</h3>
            <svg
              width={PATH_WIDTH}
              height={PATH_HEIGHT}
              role="img"
              className="flow-chart path-chart"
              aria-label="Curved diffusion path versus straight flow-matching path"
            >
              {/* Straight line = conditional displacement */}
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
                <span className="label">Curved path length</span>
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
              This panel compares a chosen straight interpolation with a
              hand-built curved contrast path for the same endpoints.
            </p>
          </div>

          {/* Sampling speed panel */}
          <div className="flow-panel">
            <h3 className="flow-panel-title">Toy step-response curves</h3>
            <svg
              width={SAMPLING_WIDTH}
              height={SAMPLING_HEIGHT}
              role="img"
              className="flow-chart sampling-chart"
              aria-label="Toy response proxy versus number of sampling steps for diffusion, flow matching, and rectified flow"
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
                <span className="label">Diffusion proxy</span>
                <span>{Math.round(qDiff * 100)}%</span>
              </div>
              <div>
                <span className="label">Flow matching proxy</span>
                <span>{Math.round(qFlow * 100)}%</span>
              </div>
              <div>
                <span className="label">Rectified flow proxy</span>
                <span>{Math.round(qRect * 100)}%</span>
              </div>
            </div>
            <p className="caption">
              These curves are a qualitative proxy for step response, not a
              trained model evaluation or sample-quality measurement.
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
              straightens the trajectory toward the straight conditional path.
              Full rectified-flow training and empirical speed comparisons belong
              in a separate slice.
            </p>
          </div>
          </>
          ) : null}
        </div>
      </div>

      {!isNotebook ? (
      <p className="caption">
        Takeaway: diffusion is like wandering through curved, stochastic
        trajectories, while flow matching trains velocity labels along chosen
        probability paths. Straighter conditional paths can make numerical
        integration easier, but this toy does not measure sample quality.
      </p>
      ) : null}
    </section>

    <style jsx>{`
      .flow-matching-demo {
        background: #0f172a;
        border-radius: 16px;
        color: #e5e7eb;
        min-width: 0;
        overflow-wrap: anywhere;
      }

      .flow-matching-demo.notebook {
        background: transparent;
        border: 0;
        box-shadow: none;
        padding: 0;
      }

      .velocity-prediction-panel,
      .flow-panel {
        border: 1px solid rgba(148, 163, 184, 0.18);
        border-radius: 12px;
        background: rgba(15, 23, 42, 0.72);
        padding: 0.95rem;
      }

      .velocity-prediction-panel {
        background:
          radial-gradient(circle at 12% 0%, rgba(20, 184, 166, 0.18), transparent 34%),
          linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(4, 47, 46, 0.9));
        border-color: rgba(20, 184, 166, 0.42);
        margin-bottom: 1rem;
      }

      .velocity-prediction-panel h3,
      .flow-panel-title {
        color: #f8fafc;
        font-size: 1rem;
        line-height: 1.3;
        margin: 0 0 0.55rem;
      }

      .velocity-prediction-panel p {
        color: #cbd5e1;
        font-size: 0.86rem;
        line-height: 1.55;
        margin: 0 0 0.85rem;
      }

      .velocity-prediction-panel code,
      .velocity-formula code,
      .velocity-result code {
        color: #dbeafe;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      }

      .velocity-choice-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 0.55rem;
        margin-bottom: 0.75rem;
      }

      .evidence-strip {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(4, 47, 46, 0.74));
        border: 1px solid rgba(20, 184, 166, 0.26);
        border-radius: 12px;
        display: grid;
        gap: 0.5rem;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin: 0 0 0.75rem;
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

      .velocity-choice-grid button,
      .velocity-actions button,
      .toggle-btn,
      .flow-buttons button {
        appearance: none;
        border: 1px solid rgba(148, 163, 184, 0.32);
        border-radius: 9px;
        background: rgba(15, 23, 42, 0.76);
        color: #e5e7eb;
        cursor: pointer;
        font-weight: 650;
        padding: 0.58rem 0.7rem;
      }

      .velocity-choice-grid button {
        min-height: 70px;
        text-align: left;
      }

      .velocity-choice-grid button span,
      .velocity-choice-grid button small {
        display: block;
      }

      .velocity-choice-grid button small {
        color: #94a3b8;
        font-size: 0.75rem;
        font-weight: 500;
        margin-top: 0.28rem;
      }

      .velocity-choice-grid button[aria-pressed='true'],
      .toggle-btn.active {
        border-color: rgba(20, 184, 166, 0.78);
        background: rgba(20, 184, 166, 0.2);
        color: #ccfbf1;
      }

      .velocity-actions,
      .flow-buttons,
      .flow-toggle-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.55rem;
      }

      .velocity-actions button:disabled {
        cursor: not-allowed;
        opacity: 0.55;
      }

      .velocity-actions .ghost,
      .flow-buttons .ghost {
        background: rgba(30, 41, 59, 0.82);
      }

      .velocity-result {
        border: 1px solid rgba(34, 197, 94, 0.44);
        background: rgba(20, 83, 45, 0.62);
        border-radius: 10px;
        color: #f8fafc !important;
        margin-top: 0.75rem !important;
        padding: 0.7rem 0.75rem;
      }

      .velocity-formula {
        color: #cbd5e1 !important;
        margin-top: 0.75rem !important;
      }

      .flow-layout {
        display: grid;
        grid-template-columns: minmax(360px, 1.1fr) minmax(280px, 0.9fr);
        gap: 1rem;
        align-items: start;
      }

      .flow-column {
        display: grid;
        gap: 1rem;
        min-width: 0;
      }

      .flow-panel-header {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 0.7rem;
      }

      .flow-legend {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.38rem;
        font-size: 0.75rem;
      }

      .dot {
        border-radius: 999px;
        display: inline-block;
        height: 9px;
        width: 9px;
      }

      .dot.noise {
        background: #64748b;
      }

      .dot.data {
        background: #f59e0b;
      }

      .dot.current {
        background: #22c55e;
      }

      .flow-chart {
        background: #020617;
        border: 1px solid rgba(148, 163, 184, 0.16);
        border-radius: 12px;
        display: block;
        height: auto;
        max-width: 100%;
      }

      .axis-line {
        stroke: rgba(226, 232, 240, 0.22);
        stroke-width: 1;
      }

      .ot-coupling-line {
        stroke: rgba(148, 163, 184, 0.18);
        stroke-width: 1;
      }

      .ot-coupling-line.selected {
        stroke: rgba(248, 250, 252, 0.86);
        stroke-dasharray: 5 4;
        stroke-width: 2;
      }

      .particle-src {
        fill: #64748b;
        opacity: 0.7;
      }

      .particle-tgt {
        fill: #f59e0b;
        opacity: 0.72;
      }

      .particle-src.context,
      .particle-tgt.context,
      .particle-current:not(.selected) {
        opacity: 0.26;
      }

      .particle-src.selected,
      .particle-tgt.selected,
      .particle-current.selected {
        stroke: #f8fafc;
        stroke-width: 2;
        opacity: 1;
      }

      .particle-current.flow {
        fill: #22c55e;
      }

      .particle-current.diffusion {
        fill: #14b8a6;
      }

      .velocity-target-arrow {
        stroke: #22c55e;
        stroke-linecap: round;
        stroke-width: 3;
      }

      .remaining-arrow {
        stroke: #f59e0b;
        stroke-dasharray: 5 4;
        stroke-linecap: round;
        stroke-width: 2.4;
      }

      .vector-bg {
        fill: rgba(15, 23, 42, 0.7);
        stroke: rgba(148, 163, 184, 0.14);
      }

      .vector-arrow {
        stroke-linecap: round;
        stroke-width: 1.4;
      }

      .path-flow,
      .path-diffusion,
      .sampling-curve,
      .rectified-path {
        fill: none;
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.4;
      }

      .path-diffusion,
      .sampling-curve.diffusion {
        stroke: #14b8a6;
      }

      .path-flow,
      .sampling-curve.flow {
        stroke: #f59e0b;
      }

      .sampling-curve.rectified {
        stroke: #8b5cf6;
      }

      .sampling-steps-line {
        stroke: rgba(248, 250, 252, 0.55);
        stroke-dasharray: 4 4;
      }

      .marker-flow,
      .sampling-marker.flow,
      .rectified-marker.active {
        fill: #f59e0b;
      }

      .marker-diffusion,
      .sampling-marker.diffusion {
        fill: #14b8a6;
      }

      .sampling-marker.rectified {
        fill: #8b5cf6;
      }

      .rectified-path {
        stroke: rgba(148, 163, 184, 0.35);
      }

      .rectified-path.active {
        stroke: #f59e0b;
        stroke-width: 3;
      }

      .flow-stats,
      .sampling-stats {
        display: grid;
        gap: 0.45rem;
        margin-top: 0.65rem;
      }

      .flow-stats > div {
        display: flex;
        justify-content: space-between;
        gap: 0.7rem;
      }

      .label,
      .muted-inline,
      .caption {
        color: #94a3b8;
      }

      .caption {
        font-size: 0.78rem;
        line-height: 1.55;
        margin: 0.65rem 0 0;
      }

      .controls-panel {
        display: grid;
        gap: 0.75rem;
      }

      .flow-controls {
        display: grid;
        gap: 0.75rem;
      }

      .slider-label,
      .toggle-label {
        color: #dbeafe;
        display: grid;
        font-size: 0.84rem;
        gap: 0.45rem;
      }

      .slider-label input[type='range'] {
        width: 100%;
      }

      .toggle-label {
        align-items: center;
        display: flex;
      }

      .flow-matching-demo button:focus-visible,
      .flow-matching-demo input:focus-visible {
        outline: 2px solid #f8fafc;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.35);
      }

      @media (max-width: 860px) {
        .flow-layout,
        .velocity-choice-grid,
        .evidence-strip {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 520px) {
        .velocity-prediction-panel,
        .flow-panel {
          padding: 0.8rem;
        }

        .flow-stats > div {
          align-items: flex-start;
          flex-direction: column;
          gap: 0.15rem;
        }
      }
    `}</style>
    </>
  )
}
