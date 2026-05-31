import { useMemo, useState, useCallback, useEffect } from 'react'
import { emitDemoState } from '../../lib/demoState'

type LossLandscapeVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

// ─────────────────────────────────────────────────────────────
// Gamification Types
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed'
type SharpnessCheckPrediction = 'sam-lower' | 'sgd-lower' | 'similar' | null
type SharpnessCheckOutcome = Exclude<SharpnessCheckPrediction, null>
type FlatnessPrediction = SharpnessCheckPrediction

interface FlatnessChallenge {
  name: string
  lr: number
  rho: number
  description: string
  steps: number
}

// Mystery challenges - users predict which optimizer ends with lower local sharpness.
const FLATNESS_CHALLENGES: FlatnessChallenge[] = [
  {
    name: '🎲 Standard Setup',
    lr: 0.08,
    rho: 0.2,
    description: 'Medium learning rate, standard ρ... compare endpoint sensitivity.',
    steps: 20
  },
  {
    name: '🎲 Tiny Steps',
    lr: 0.02,
    rho: 0.1,
    description: 'Very small learning rate... trajectories should differ only modestly.',
    steps: 25
  },
  {
    name: '🎲 Big Jumps',
    lr: 0.15,
    rho: 0.25,
    description: 'High learning rate... inspect how far the SAM probe redirects the path.',
    steps: 15
  },
  {
    name: '🎲 Wide Search',
    lr: 0.06,
    rho: 0.4,
    description: 'Large ρ means SAM probes further along a nearby high-loss direction.',
    steps: 20
  },
  {
    name: '🎲 Edge Case',
    lr: 0.03,
    rho: 0.05,
    description: 'Tiny ρ makes SAM close to SGD... compare the computed endpoint λₘₐₓ.',
    steps: 25
  },
]

// Educational feedback
function getFlatnessFeedback(
  prediction: FlatnessPrediction,
  actual: SharpnessCheckOutcome,
  challenge: FlatnessChallenge,
  sgdSharp: number,
  samSharp: number
): string {
  const isCorrect = prediction === actual
  const actualLabel = SHARPNESS_OUTCOME_LABELS[actual]

  if (isCorrect) {
    if (actual === 'sam-lower') {
      return `✅ Correct! SAM sharpness: ${samSharp.toFixed(2)} vs SGD: ${sgdSharp.toFixed(2)}. SAM's adversarial perturbation (ρ=${challenge.rho}) found a lower-sensitivity region in this toy slice.`
    }
    if (actual === 'sgd-lower') {
      return `✅ Correct! SGD sharpness: ${sgdSharp.toFixed(2)} vs SAM: ${samSharp.toFixed(2)}. Sometimes the direct path works! Low learning rate can help SGD avoid sharp minima.`
    }
    return `✅ Correct! Both converged to similar sharpness (~${((sgdSharp + samSharp) / 2).toFixed(2)}). With lr=${challenge.lr} and ρ=${challenge.rho}, SAM's perturbation wasn't different enough to diverge paths.`
  }

  // Wrong answers
  if (actual === 'sam-lower') {
    return `❌ Actual: ${actualLabel}. Sharpness: SAM ${samSharp.toFixed(2)} vs SGD ${sgdSharp.toFixed(2)}. SAM's ascent step (with ρ=${challenge.rho}) biases optimization away from high local sensitivity in this toy.`
  }
  if (actual === 'sgd-lower') {
    return `❌ Actual: ${actualLabel}. Sharpness: SGD ${sgdSharp.toFixed(2)} vs SAM ${samSharp.toFixed(2)}. This can happen when ρ is too aggressive or the learning rate is too high for SAM.`
  }
  return `❌ Actual: ${actualLabel}. Both ended at similar sharpness (~${((sgdSharp + samSharp) / 2).toFixed(2)}). With these settings, SAM's perturbation did not create enough endpoint λₘₐₓ separation.`
}

// Optimizer scenario presets for exploration
type ScenarioId = 'samShowcase' | 'sgdWins' | 'highLr' | 'lowLr' | 'largeRho'

interface LandscapePreset {
  id: ScenarioId
  name: string
  emoji: string
  description: string
  lr: number
  rho: number
}

const LANDSCAPE_PRESETS: LandscapePreset[] = [
  {
    id: 'samShowcase',
    name: 'SAM Contrast',
    emoji: '🎯',
    description: 'Default contrast: SAM endpoint usually has lower local λₘₐₓ',
    lr: 0.08,
    rho: 0.2,
  },
  {
    id: 'sgdWins',
    name: 'Small Probe',
    emoji: '⚡',
    description: 'Low lr and smaller ρ make the trajectories closer',
    lr: 0.03,
    rho: 0.15,
  },
  {
    id: 'highLr',
    name: 'High LR',
    emoji: '🚀',
    description: 'High learning rate: compare endpoint curvature after large steps',
    lr: 0.15,
    rho: 0.25,
  },
  {
    id: 'lowLr',
    name: 'Low LR',
    emoji: '🐢',
    description: 'Low learning rate: both paths move slowly from the same start',
    lr: 0.02,
    rho: 0.1,
  },
  {
    id: 'largeRho',
    name: 'Large ρ',
    emoji: '🔍',
    description: 'Large perturbation radius: SAM reacts strongly to nearby high-loss directions',
    lr: 0.06,
    rho: 0.4,
  },
]

// Dynamic insight based on optimizer trajectories
function getLossLandscapeInsight(
  sgdTrajectory: { loss: number; sharp: number }[],
  samTrajectory: { loss: number; sharp: number }[],
  steps: number
): { text: string; color: string; emoji: string } {
  if (steps === 0) {
    return {
      emoji: '🎮',
      color: '#6366f1',
      text: 'Click "Step" to watch SGD and SAM diverge. SGD follows the raw gradient; SAM first probes a nearby high-loss direction, then descends.',
    }
  }

  const sgdLast = sgdTrajectory[sgdTrajectory.length - 1]
  const samLast = samTrajectory[samTrajectory.length - 1]

  // Compare local sharpness at the current endpoints.
  const sgdSharp = sgdLast?.sharp ?? 0
  const samSharp = samLast?.sharp ?? 0
  const sgdLoss = sgdLast?.loss ?? 0
  const samLoss = samLast?.loss ?? 0

  if (steps < 5) {
    return {
      emoji: '🏃',
      color: '#f59e0b',
      text: `Early steps: Both optimizers are moving. SGD sharpness: ${sgdSharp.toFixed(2)}, SAM sharpness: ${samSharp.toFixed(2)}. Watch them diverge!`,
    }
  }

  if (samSharp < sgdSharp * 0.5) {
    return {
      emoji: '✨',
      color: '#22c55e',
      text: `SAM reached a lower-sensitivity region in this toy. Sharpness ${samSharp.toFixed(2)} vs SGD's ${sgdSharp.toFixed(2)}; real generalization claims need a defined perturbation scale and separate validation.`,
    }
  }

  if (sgdSharp < samSharp * 0.8) {
    return {
      emoji: '⚡',
      color: '#14b8a6',
      text: `SGD found a good spot! Sometimes the direct path works. SGD sharpness: ${sgdSharp.toFixed(2)}, SAM: ${samSharp.toFixed(2)}.`,
    }
  }

  if (samLoss < sgdLoss * 0.8) {
    return {
      emoji: '📉',
      color: '#8b5cf6',
      text: `SAM achieving lower loss (${samLoss.toFixed(3)}) than SGD (${sgdLoss.toFixed(3)}). The sharpness-aware ascent step is paying off.`,
    }
  }

  return {
    emoji: '🔄',
    color: '#6366f1',
    text: `After ${steps} steps: SGD loss=${sgdLoss.toFixed(3)}, SAM loss=${samLoss.toFixed(3)}. Keep stepping to compare local sharpness and training loss separately.`,
  }
}

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
  negative: '#ef4444',
}

type OptimizerMode = 'sgd' | 'sam'

type TrajPoint = {
  x: number
  y: number
  loss: number
  sharp: number
}

type GridCell = {
  i: number
  j: number
  x: number
  y: number
  loss: number
  sharpness: number
}

type GridData = {
  cells: GridCell[]
  nx: number
  ny: number
  lossMin: number
  lossMax: number
  sharpMin: number
  sharpMax: number
}

type EigenData = {
  lambdaMax: number
  lambdaMin: number
  dirMax: { x: number; y: number }
}

type CrossSample = {
  x: number
  flat: number
  sharp: number
  combined: number
}

type CrossSectionData = {
  samples: CrossSample[]
  maxVal: number
}

type Vec2 = { x: number; y: number }

const DOMAIN = {
  xMin: -3,
  xMax: 3,
  yMin: -2.5,
  yMax: 2.5,
}

const START_POINT: Vec2 = { x: 1.25, y: -1.75 }

const FLAT_CENTER: Vec2 = { x: -1.4, y: 0.7 }
const SHARP_CENTER: Vec2 = { x: 1.3, y: -0.4 }

const FLAT_AX = 0.15
const FLAT_AY = 0.03
const SHARP_AX = 1.6
const SHARP_AY = 1.4

const SOFTMIN_TAU = 0.35
const LOSS_OFFSET = 0.6

const GRID_RES_X = 40
const GRID_RES_Y = 32

const MAIN_WIDTH = 320
const MAIN_HEIGHT = 260
const HEAT_WIDTH = 260
const HEAT_HEIGHT = 260
const CROSS_WIDTH = 320
const CROSS_HEIGHT = 140
const METRIC_CHART_WIDTH = 260
const METRIC_CHART_HEIGHT = 90
const PADDING = 24
const HESSIAN_EPS = 0.08
const CROSS_SECTION_Y = 0
const SHARPNESS_CHECK_STEPS = 20
const SIMILAR_REL_TOL = 0.12
const SIMILAR_ABS_TOL = 0.1

const SHARPNESS_OUTCOME_LABELS: Record<SharpnessCheckOutcome, string> = {
  'sam-lower': 'SAM lower lambda-max',
  'sgd-lower': 'SGD lower lambda-max',
  similar: 'similar lambda-max',
}

// ----- Basic loss geometry -----

function flatBasin(x: number, y: number): number {
  const dx = x - FLAT_CENTER.x
  const dy = y - FLAT_CENTER.y
  return FLAT_AX * dx * dx + FLAT_AY * dy * dy + 0.4
}

function sharpBasin(x: number, y: number): number {
  const dx = x - SHARP_CENTER.x
  const dy = y - SHARP_CENTER.y
  return SHARP_AX * dx * dx + SHARP_AY * dy * dy
}

function gradFlat(x: number, y: number): [number, number] {
  const dx = x - FLAT_CENTER.x
  const dy = y - FLAT_CENTER.y
  return [2 * FLAT_AX * dx, 2 * FLAT_AY * dy]
}

function gradSharp(x: number, y: number): [number, number] {
  const dx = x - SHARP_CENTER.x
  const dy = y - SHARP_CENTER.y
  return [2 * SHARP_AX * dx, 2 * SHARP_AY * dy]
}

// Soft-min of flat + sharp basins to create two smooth minima
function combinedLoss(x: number, y: number): number {
  const fFlat = flatBasin(x, y)
  const fSharp = sharpBasin(x, y)
  const wFlat = Math.exp(-fFlat / SOFTMIN_TAU)
  const wSharp = Math.exp(-fSharp / SOFTMIN_TAU)
  const base = -SOFTMIN_TAU * Math.log(wFlat + wSharp)
  return base + LOSS_OFFSET
}

function combinedGrad(x: number, y: number): [number, number] {
  const fFlat = flatBasin(x, y)
  const fSharp = sharpBasin(x, y)
  const [gxFlat, gyFlat] = gradFlat(x, y)
  const [gxSharp, gySharp] = gradSharp(x, y)
  const wFlat = Math.exp(-fFlat / SOFTMIN_TAU)
  const wSharp = Math.exp(-fSharp / SOFTMIN_TAU)
  const denom = wFlat + wSharp || 1e-8
  const gx = (wFlat * gxFlat + wSharp * gxSharp) / denom
  const gy = (wFlat * gyFlat + wSharp * gySharp) / denom
  return [gx, gy]
}

// ----- Hessian + eigen decomposition (sharpness) -----

function hessianLoss(x: number, y: number) {
  const h = HESSIAN_EPS
  const h2 = h * h

  const f0 = combinedLoss(x, y)
  const f_xph = combinedLoss(x + h, y)
  const f_xmh = combinedLoss(x - h, y)
  const f_yph = combinedLoss(x, y + h)
  const f_ymh = combinedLoss(x, y - h)

  const f_xph_yph = combinedLoss(x + h, y + h)
  const f_xph_ymh = combinedLoss(x + h, y - h)
  const f_xmh_yph = combinedLoss(x - h, y + h)
  const f_xmh_ymh = combinedLoss(x - h, y - h)

  const hxx = (f_xph - 2 * f0 + f_xmh) / h2
  const hyy = (f_yph - 2 * f0 + f_ymh) / h2
  const hxy =
    (f_xph_yph - f_xph_ymh - f_xmh_yph + f_xmh_ymh) / (4 * h2)

  return { hxx, hxy, hyy }
}

function eigenDecomposition2D(h: {
  hxx: number
  hxy: number
  hyy: number
}): EigenData {
  const { hxx, hxy, hyy } = h
  const trace = hxx + hyy
  const det = hxx * hyy - hxy * hxy
  const discTerm = trace * trace - 4 * det
  const disc = discTerm > 0 ? Math.sqrt(discTerm) : 0
  const lambda1 = (trace + disc) / 2
  const lambda2 = (trace - disc) / 2
  const lambdaMax = Math.max(lambda1, lambda2)
  const lambdaMin = Math.min(lambda1, lambda2)

  let vx: number
  let vy: number
  if (Math.abs(hxy) > 1e-8) {
    vx = lambdaMax - hyy
    vy = hxy
  } else if (Math.abs(hxx) >= Math.abs(hyy)) {
    vx = 1
    vy = 0
  } else {
    vx = 0
    vy = 1
  }
  const norm = Math.hypot(vx, vy) || 1
  return {
    lambdaMax,
    lambdaMin,
    dirMax: { x: vx / norm, y: vy / norm },
  }
}

// ----- Utilities: coords & colors -----

function xToSvg(x: number, width: number): number {
  const t = (x - DOMAIN.xMin) / (DOMAIN.xMax - DOMAIN.xMin)
  return PADDING + t * (width - 2 * PADDING)
}

function yToSvg(y: number, height: number): number {
  const t = (y - DOMAIN.yMin) / (DOMAIN.yMax - DOMAIN.yMin)
  return height - PADDING - t * (height - 2 * PADDING)
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '')
  const len = clean.length
  let r: number, g: number, b: number
  if (len === 3) {
    r = parseInt(clean[0] + clean[0], 16)
    g = parseInt(clean[1] + clean[1], 16)
    b = parseInt(clean[2] + clean[2], 16)
  } else {
    r = parseInt(clean.slice(0, 2), 16)
    g = parseInt(clean.slice(2, 4), 16)
    b = parseInt(clean.slice(4, 6), 16)
  }
  return [r, g, b]
}

function mixColors(hexA: string, hexB: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(hexA)
  const [r2, g2, b2] = hexToRgb(hexB)
  const c = Math.min(1, Math.max(0, t))
  const r = Math.round(r1 + (r2 - r1) * c)
  const g = Math.round(g1 + (g2 - g1) * c)
  const b = Math.round(b1 + (b2 - b1) * c)
  return `rgb(${r}, ${g}, ${b})`
}

// loss heatmap: white → teal → purple
function lossColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  const mid = 0.5
  if (clamped < mid) {
    const local = clamped / mid
    return mixColors('#ffffff', MATH_COLORS.secondary, local)
  }
  const local = (clamped - mid) / (1 - mid || 1)
  return mixColors(MATH_COLORS.secondary, MATH_COLORS.accent, local)
}

// sharpness heatmap: teal → red
function sharpnessColor(t: number): string {
  const clamped = Math.min(1, Math.max(0, t))
  return mixColors(MATH_COLORS.secondary, MATH_COLORS.negative, clamped)
}

// ----- Grid + cross-section builders -----

function buildGrid(): GridData {
  const cells: GridCell[] = []
  const nx = GRID_RES_X
  const ny = GRID_RES_Y
  const dx = (DOMAIN.xMax - DOMAIN.xMin) / nx
  const dy = (DOMAIN.yMax - DOMAIN.yMin) / ny

  let lossMin = Infinity
  let lossMax = -Infinity
  let sharpMin = Infinity
  let sharpMax = -Infinity

  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < ny; j++) {
      const x = DOMAIN.xMin + (i + 0.5) * dx
      const y = DOMAIN.yMin + (j + 0.5) * dy

      const loss = combinedLoss(x, y)
      const h = hessianLoss(x, y)
      const eig = eigenDecomposition2D(h)
      const sharpness = Math.max(eig.lambdaMax, 0)

      lossMin = Math.min(lossMin, loss)
      lossMax = Math.max(lossMax, loss)
      sharpMin = Math.min(sharpMin, sharpness)
      sharpMax = Math.max(sharpMax, sharpness)

      cells.push({ i, j, x, y, loss, sharpness })
    }
  }

  if (!Number.isFinite(lossMin)) lossMin = 0
  if (!Number.isFinite(lossMax)) lossMax = 1
  if (!Number.isFinite(sharpMin)) sharpMin = 0
  if (!Number.isFinite(sharpMax)) sharpMax = 1

  return {
    cells,
    nx,
    ny,
    lossMin,
    lossMax,
    sharpMin,
    sharpMax,
  }
}

function buildTrajectoryPath(
  points: TrajPoint[],
  width: number,
  height: number,
): string {
  if (!points.length) return ''
  return points
    .map((p, idx) => {
      const x = xToSvg(p.x, width)
      const y = yToSvg(p.y, height)
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function buildSharpnessSparkline(
  points: TrajPoint[],
  width: number,
  height: number,
): string {
  if (!points.length) return ''
  const innerW = width - 2 * PADDING
  const innerH = height - 2 * PADDING
  const maxSharp = points.reduce(
    (m, p) => Math.max(m, p.sharp),
    0,
  )
  if (maxSharp <= 0) return ''

  return points
    .map((p, idx) => {
      const tX =
        points.length === 1
          ? 0
          : idx / (points.length - 1)
      const x = PADDING + tX * innerW
      const normSharp = p.sharp / maxSharp
      const y =
        height -
        PADDING -
        normSharp * innerH
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function buildCrossSection(): CrossSectionData {
  const samples: CrossSample[] = []
  const n = 120
  let maxVal = 0

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1)
    const x =
      DOMAIN.xMin +
      t * (DOMAIN.xMax - DOMAIN.xMin)
    const flat = flatBasin(x, CROSS_SECTION_Y)
    const sharp = sharpBasin(x, CROSS_SECTION_Y)
    const combined = combinedLoss(x, CROSS_SECTION_Y)
    maxVal = Math.max(maxVal, flat, sharp, combined)
    samples.push({ x, flat, sharp, combined })
  }

  if (maxVal <= 0) maxVal = 1
  return { samples, maxVal }
}

function buildCrossPath(
  samples: CrossSample[],
  width: number,
  height: number,
  kind: 'flat' | 'sharp' | 'combined',
  maxVal: number,
): string {
  if (!samples.length) return ''
  const innerH = height - 2 * PADDING
  return samples
    .map((s, idx) => {
      const x = xToSvg(s.x, width)
      const v =
        kind === 'flat'
          ? s.flat
          : kind === 'sharp'
            ? s.sharp
            : s.combined
      const tY = v / maxVal
      const y =
        height -
        PADDING -
        tY * innerH
      return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')
}

function averageSharpness(points: TrajPoint[]): number {
  if (!points.length) return 0
  const total = points.reduce(
    (s, p) => s + p.sharp,
    0,
  )
  return total / points.length
}

function makeTrajectoryPoint(point: Vec2): TrajPoint {
  const loss = combinedLoss(point.x, point.y)
  const h = hessianLoss(point.x, point.y)
  const eig = eigenDecomposition2D(h)
  return {
    x: point.x,
    y: point.y,
    loss,
    sharp: Math.max(eig.lambdaMax, 0),
  }
}

function sgdStep(w: Vec2, lr: number): Vec2 {
  const [gx, gy] = combinedGrad(w.x, w.y)
  return {
    x: w.x - lr * gx,
    y: w.y - lr * gy,
  }
}

function samStep(
  w: Vec2,
  lr: number,
  rho: number,
): Vec2 {
  const [gx, gy] = combinedGrad(w.x, w.y)
  const norm = Math.hypot(gx, gy) || 1e-8
  const eps: Vec2 = {
    x: (rho * gx) / norm,
    y: (rho * gy) / norm,
  }
  const wPerturbed: Vec2 = {
    x: w.x + eps.x,
    y: w.y + eps.y,
  }
  const [gxPert, gyPert] = combinedGrad(
    wPerturbed.x,
    wPerturbed.y,
  )
  return {
    x: w.x - lr * gxPert,
    y: w.y - lr * gyPert,
  }
}

function gradVecAt(point: Vec2): Vec2 {
  const [gx, gy] = combinedGrad(point.x, point.y)
  return { x: gx, y: gy }
}

function simulateTrajectoryPair(
  lr: number,
  rho: number,
  stepCount: number,
): { sgd: TrajPoint[]; sam: TrajPoint[] } {
  const sgd: TrajPoint[] = [makeTrajectoryPoint(START_POINT)]
  const sam: TrajPoint[] = [makeTrajectoryPoint(START_POINT)]

  for (let i = 0; i < stepCount; i += 1) {
    const sgdLast = sgd[sgd.length - 1]
    const sgdNext = sgdStep({ x: sgdLast.x, y: sgdLast.y }, lr)
    sgd.push(makeTrajectoryPoint(sgdNext))

    const samLast = sam[sam.length - 1]
    const samNext = samStep({ x: samLast.x, y: samLast.y }, lr, rho)
    sam.push(makeTrajectoryPoint(samNext))
  }

  return { sgd, sam }
}

function classifySharpnessOutcome(
  sgdSharp: number,
  samSharp: number,
): SharpnessCheckOutcome {
  const diff = sgdSharp - samSharp
  const scale = Math.max(Math.abs(sgdSharp), Math.abs(samSharp), 1)
  if (Math.abs(diff) <= Math.max(SIMILAR_ABS_TOL, SIMILAR_REL_TOL * scale)) {
    return 'similar'
  }
  return diff > 0 ? 'sam-lower' : 'sgd-lower'
}

// ----- Main component -----

export default function LossLandscapeSharpnessDemo({
  chrome = 'legacy',
  conceptId = 'loss-landscapes',
}: LossLandscapeVizProps) {
  const isNotebook = chrome === 'notebook'
  const [rho, setRho] = useState(0.2)
  const [lr, setLr] = useState(0.08)
  const [mode, setMode] =
    useState<OptimizerMode>('sam')
  const [steps, setSteps] = useState(0)
  const [activePreset, setActivePreset] = useState<ScenarioId | null>('samShowcase')
  const [sharpnessPrediction, setSharpnessPrediction] =
    useState<SharpnessCheckPrediction>(null)
  const [sharpnessPredictionResult, setSharpnessPredictionResult] = useState<{
    predicted: SharpnessCheckOutcome
    actual: SharpnessCheckOutcome
    sgdSharp: number
    samSharp: number
    checkSteps: number
  } | null>(null)

  // ─────────────────────────────────────────────────────────────
  // Gamification State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<FlatnessChallenge | null>(null)
  const [prediction, setPrediction] = useState<FlatnessPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])
  const [gameStepsRemaining, setGameStepsRemaining] = useState(0)

  const resetSharpnessCheck = useCallback(() => {
    setSharpnessPrediction(null)
    setSharpnessPredictionResult(null)
  }, [])

  // Game control functions
  const startChallenge = useCallback((challenge: FlatnessChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(3)
  }, [])

  const submitPrediction = useCallback((pred: FlatnessPrediction) => {
    if (!selectedChallenge || gamePhase !== 'countdown') return
    setPrediction(pred)
    // Apply challenge settings
    setLr(selectedChallenge.lr)
    setRho(selectedChallenge.rho)
    setActivePreset(null)
    // Reset trajectories
    setGamePhase('running')
    setGameStepsRemaining(selectedChallenge.steps)
  }, [selectedChallenge, gamePhase])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(3)
    setGameStepsRemaining(0)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  // Reset trajectories when game starts running
  useEffect(() => {
    if (gamePhase === 'running' && gameStepsRemaining === selectedChallenge?.steps) {
      // Reset trajectories at the start
      const p0 = makeTrajectoryPoint(START_POINT)
      setSgdTrajectory([p0])
      setSamTrajectory([p0])
      setSteps(0)
    }
  }, [gamePhase, gameStepsRemaining, selectedChallenge?.steps])

  const makeInitialPoint = () => {
    return makeTrajectoryPoint(START_POINT)
  }

  const [sgdTrajectory, setSgdTrajectory] =
    useState<TrajPoint[]>(() => [makeInitialPoint()])
  const [samTrajectory, setSamTrajectory] =
    useState<TrajPoint[]>(() => [makeInitialPoint()])

  const grid = useMemo<GridData>(
    () => buildGrid(),
    [],
  )
  const crossSection =
    useMemo<CrossSectionData>(
      () => buildCrossSection(),
      [],
    )

  // Dynamic insight based on trajectory
  const currentInsight = useMemo(() => {
    return getLossLandscapeInsight(sgdTrajectory, samTrajectory, steps)
  }, [sgdTrajectory, samTrajectory, steps])

  // Handle preset selection
  const handlePreset = useCallback((preset: LandscapePreset) => {
    setLr(preset.lr)
    setRho(preset.rho)
    setActivePreset(preset.id)
    resetSharpnessCheck()
    // Reset trajectories when changing preset
    const p0 = makeInitialPoint()
    setSgdTrajectory([p0])
    setSamTrajectory([p0])
    setSteps(0)
  }, [resetSharpnessCheck])

  // Clear preset when manually adjusting sliders
  const handleLrChange = useCallback((newLr: number) => {
    setLr(newLr)
    setActivePreset(null)
    setSharpnessPredictionResult(null)
  }, [])

  const handleRhoChange = useCallback((newRho: number) => {
    setRho(newRho)
    setActivePreset(null)
    setSharpnessPredictionResult(null)
  }, [])

  const stepOnce = () => {
    setSharpnessPredictionResult(null)
    setSgdTrajectory((prev) => {
      const last = prev[prev.length - 1]
      const next = sgdStep(
        { x: last.x, y: last.y },
        lr,
      )
      return [
        ...prev,
        makeTrajectoryPoint(next),
      ]
    })
    setSamTrajectory((prev) => {
      const last = prev[prev.length - 1]
      const next = samStep(
        { x: last.x, y: last.y },
        lr,
        rho,
      )
      return [
        ...prev,
        makeTrajectoryPoint(next),
      ]
    })
    setSteps((s) => s + 1)
  }

  const reset = () => {
    resetSharpnessCheck()
    const p0 = makeInitialPoint()
    setSgdTrajectory([p0])
    setSamTrajectory([p0])
    setSteps(0)
  }

  const checkSharpnessPrediction = () => {
    if (!sharpnessPrediction) return
    const simulated = simulateTrajectoryPair(lr, rho, SHARPNESS_CHECK_STEPS)
    const sgdEnd = simulated.sgd[simulated.sgd.length - 1]
    const samEnd = simulated.sam[simulated.sam.length - 1]
    const actual = classifySharpnessOutcome(sgdEnd.sharp, samEnd.sharp)

    setSgdTrajectory(simulated.sgd)
    setSamTrajectory(simulated.sam)
    setSteps(SHARPNESS_CHECK_STEPS)
    setSharpnessPredictionResult({
      predicted: sharpnessPrediction,
      actual,
      sgdSharp: sgdEnd.sharp,
      samSharp: samEnd.sharp,
      checkSteps: SHARPNESS_CHECK_STEPS,
    })
  }

  // Game auto-stepping effect
  useEffect(() => {
    if (gamePhase !== 'running' || gameStepsRemaining <= 0) return

    const timer = setTimeout(() => {
      // Execute one step for both optimizers
      setSgdTrajectory((prev) => {
        const last = prev[prev.length - 1]
        const next = sgdStep({ x: last.x, y: last.y }, lr)
        return [...prev, makeTrajectoryPoint(next)]
      })
      setSamTrajectory((prev) => {
        const last = prev[prev.length - 1]
        const next = samStep({ x: last.x, y: last.y }, lr, rho)
        return [...prev, makeTrajectoryPoint(next)]
      })
      setSteps((s) => s + 1)
      setGameStepsRemaining((r) => r - 1)
    }, 200)

    return () => clearTimeout(timer)
  }, [gamePhase, gameStepsRemaining, lr, rho])

  // Reveal results when game steps complete
  useEffect(() => {
    if (gamePhase === 'running' && gameStepsRemaining === 0 && selectedChallenge) {
      // Score the prediction
      const sgdEnd = sgdTrajectory[sgdTrajectory.length - 1]
      const samEnd = samTrajectory[samTrajectory.length - 1]
      const actual = classifySharpnessOutcome(sgdEnd.sharp, samEnd.sharp)
      setGamePhase('revealed')
      if (prediction === actual) {
        setScore((s) => s + 1)
      }
      if (!completedChallenges.includes(selectedChallenge.name)) {
        setCompletedChallenges((c) => [...c, selectedChallenge.name])
      }
    }
  }, [
    completedChallenges,
    gamePhase,
    gameStepsRemaining,
    prediction,
    samTrajectory,
    selectedChallenge,
    sgdTrajectory,
  ])

  const activeTrajectory =
    mode === 'sgd'
      ? sgdTrajectory
      : samTrajectory
  const activeCurrent =
    activeTrajectory[
      activeTrajectory.length - 1
    ]
  const sgdCurrent =
    sgdTrajectory[sgdTrajectory.length - 1]
  const samCurrent =
    samTrajectory[samTrajectory.length - 1]
  const currentSharpnessOutcome = classifySharpnessOutcome(
    sgdCurrent.sharp,
    samCurrent.sharp,
  )

  const samGrad = gradVecAt(samCurrent)
  const samGradNorm =
    Math.hypot(samGrad.x, samGrad.y) || 1e-8
  const epsVec: Vec2 = {
    x: (rho * samGrad.x) / samGradNorm,
    y: (rho * samGrad.y) / samGradNorm,
  }
  const probePoint: Vec2 = {
    x: samCurrent.x + epsVec.x,
    y: samCurrent.y + epsVec.y,
  }
  const probeLoss = combinedLoss(
    probePoint.x,
    probePoint.y,
  )

  const hSamCurrent = hessianLoss(
    samCurrent.x,
    samCurrent.y,
  )
  const eigSamCurrent =
    eigenDecomposition2D(hSamCurrent)

  const sgdAvgSharp = averageSharpness(
    sgdTrajectory,
  )
  const samAvgSharp = averageSharpness(
    samTrajectory,
  )

  const sgdFlatnessScore =
    1 / (1 + sgdCurrent.sharp)
  const samFlatnessScore =
    1 / (1 + samCurrent.sharp)

  const sgdPathMain = buildTrajectoryPath(
    sgdTrajectory,
    MAIN_WIDTH,
    MAIN_HEIGHT,
  )
  const samPathMain = buildTrajectoryPath(
    samTrajectory,
    MAIN_WIDTH,
    MAIN_HEIGHT,
  )
  const sgdPathHeat = buildTrajectoryPath(
    sgdTrajectory,
    HEAT_WIDTH,
    HEAT_HEIGHT,
  )
  const samPathHeat = buildTrajectoryPath(
    samTrajectory,
    HEAT_WIDTH,
    HEAT_HEIGHT,
  )

  const sharpSpark = buildSharpnessSparkline(
    activeTrajectory,
    METRIC_CHART_WIDTH,
    METRIC_CHART_HEIGHT,
  )

  const crossFlatPath = buildCrossPath(
    crossSection.samples,
    CROSS_WIDTH,
    CROSS_HEIGHT,
    'flat',
    crossSection.maxVal,
  )
  const crossSharpPath = buildCrossPath(
    crossSection.samples,
    CROSS_WIDTH,
    CROSS_HEIGHT,
    'sharp',
    crossSection.maxVal,
  )
  const crossCombinedPath = buildCrossPath(
    crossSection.samples,
    CROSS_WIDTH,
    CROSS_HEIGHT,
    'combined',
    crossSection.maxVal,
  )

  const sgdLabel =
    mode === 'sgd' ? 'active' : 'ghost'
  const samLabel =
    mode === 'sam' ? 'active' : 'ghost'

  const flatMinX = FLAT_CENTER.x
  const sharpMinX = SHARP_CENTER.x

  const probeLossDelta =
    probeLoss - samCurrent.loss

  useEffect(() => {
    emitDemoState({
      conceptId,
      label: 'Loss landscape sharpness demo',
      summary: `2D toy slice after ${steps} steps: SGD and SAM are compared by local Hessian lambda-max.`,
      values: [
        `learning rate eta: ${lr.toFixed(3)}`,
        `SAM radius rho: ${rho.toFixed(2)}`,
        `SGD loss/lambda-max: ${sgdCurrent.loss.toFixed(3)} / ${sgdCurrent.sharp.toFixed(3)}`,
        `SAM loss/lambda-max: ${samCurrent.loss.toFixed(3)} / ${samCurrent.sharp.toFixed(3)}`,
        `SAM neighborhood-probe delta-rho: ${probeLossDelta.toFixed(3)}`,
        sharpnessPredictionResult
          ? `prediction check: ${SHARPNESS_OUTCOME_LABELS[sharpnessPredictionResult.predicted]}, actual ${SHARPNESS_OUTCOME_LABELS[sharpnessPredictionResult.actual]}`
          : 'prediction check: not run',
      ],
    })
  }, [
    conceptId,
    lr,
    rho,
    samCurrent.loss,
    samCurrent.sharp,
    sgdCurrent.loss,
    sgdCurrent.sharp,
    sharpnessPredictionResult,
    steps,
    probeLossDelta,
  ])

  return (
    <>
    <section
      className={isNotebook ? 'loss-landscape-card notebook' : 'card interactive-card loss-landscape-card'}
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
          <h2>Loss Landscape, Sharpness & SAM</h2>
          <p className="muted">
            Explore a 2D loss surface with a sharp and a flat
            minimum. Compare SGD vs SAM: SAM looks at the
            loss at a nearby high-loss probe point inside a small ball around
            the current weights and can avoid locally sensitive valleys in this toy.
          </p>
        </>
      ) : null}

      {/* Scenario Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
        {LANDSCAPE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => handlePreset(preset)}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: activePreset === preset.id ? '2px solid #a855f7' : '1px solid rgba(148,163,184,0.4)',
              background: activePreset === preset.id
                ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.15))'
                : 'rgba(15,23,42,0.8)',
              color: activePreset === preset.id ? '#e5e7eb' : '#9ca3af',
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title={preset.description}
          >
            <span>{preset.emoji}</span>
            <span>{preset.name}</span>
          </button>
        ))}
        {!isNotebook ? (
          <button
            type="button"
            onClick={() => setGameMode(!gameMode)}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: gameMode ? '2px solid #f59e0b' : '1px solid rgba(148,163,184,0.4)',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(245,158,11,0.25), rgba(249,115,22,0.15))'
                : 'rgba(15,23,42,0.8)',
              color: gameMode ? '#fcd34d' : '#9ca3af',
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {gameMode ? 'Exit Challenge' : 'Try Prediction Challenge'}
          </button>
        ) : null}
        {!isNotebook && score > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#fcd34d', alignSelf: 'center', marginLeft: '0.5rem' }}>
            Score: {score}/{completedChallenges.length}
          </span>
        )}
      </div>

      {isNotebook ? (
        <div
          style={{
            marginBottom: '0.75rem',
            padding: '0.85rem',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(15, 23, 42, 0.86))',
            border: '1px solid rgba(20, 184, 166, 0.38)',
          }}
        >
          <h3 style={{ margin: '0 0 0.35rem', fontSize: '0.96rem', color: '#f8fafc' }}>
            Prediction check: which path ends less locally sharp?
          </h3>
          <p style={{ margin: '0 0 0.7rem', fontSize: '0.82rem', lineHeight: 1.5, color: '#cbd5e1' }}>
            Choose an outcome, then run a fixed {SHARPNESS_CHECK_STEPS}-step rollout
            from the same start. The check compares only local Hessian lambda-max
            in this 2D toy slice.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.7rem' }}>
            {([
              ['sam-lower', 'SAM lower lambda-max'],
              ['sgd-lower', 'SGD lower lambda-max'],
              ['similar', 'similar lambda-max'],
            ] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={sharpnessPrediction === value}
                onClick={() => {
                  setSharpnessPrediction(value)
                  setSharpnessPredictionResult(null)
                }}
                style={{
                  padding: '0.55rem 0.75rem',
                  borderRadius: '9px',
                  border: sharpnessPrediction === value
                    ? '2px solid #14b8a6'
                    : '1px solid rgba(148, 163, 184, 0.28)',
                  background: sharpnessPrediction === value
                    ? 'rgba(20, 184, 166, 0.2)'
                    : 'rgba(15, 23, 42, 0.64)',
                  color: sharpnessPrediction === value ? '#ccfbf1' : '#d9e2ef',
                  fontSize: '0.84rem',
                  fontWeight: sharpnessPrediction === value ? 650 : 500,
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              disabled={!sharpnessPrediction}
              onClick={checkSharpnessPrediction}
              style={{
                padding: '0.58rem 0.85rem',
                borderRadius: '9px',
                border: '0',
                background: sharpnessPrediction
                  ? 'linear-gradient(135deg, #14b8a6, #2563eb)'
                  : 'rgba(51, 65, 85, 0.65)',
                color: sharpnessPrediction ? '#fff' : '#94a3b8',
                fontWeight: 700,
                cursor: sharpnessPrediction ? 'pointer' : 'not-allowed',
              }}
            >
              Run check
            </button>
            <button type="button" className="ghost" onClick={resetSharpnessCheck}>
              Clear prediction
            </button>
          </div>
          {sharpnessPredictionResult ? (
            <p
              role="status"
              aria-live="polite"
              style={{
                margin: '0.75rem 0 0',
                padding: '0.65rem 0.75rem',
                borderRadius: '10px',
                border: sharpnessPredictionResult.predicted === sharpnessPredictionResult.actual
                  ? '1px solid rgba(34, 197, 94, 0.35)'
                  : '1px solid rgba(245, 158, 11, 0.35)',
                background: sharpnessPredictionResult.predicted === sharpnessPredictionResult.actual
                  ? 'rgba(34, 197, 94, 0.12)'
                  : 'rgba(245, 158, 11, 0.1)',
                color: '#f8fafc',
                fontSize: '0.82rem',
                lineHeight: 1.55,
              }}
            >
              After {sharpnessPredictionResult.checkSteps} toy steps, SGD ended at
              lambda-max {sharpnessPredictionResult.sgdSharp.toFixed(3)} and SAM
              ended at lambda-max {sharpnessPredictionResult.samSharp.toFixed(3)}.
              Actual: {SHARPNESS_OUTCOME_LABELS[sharpnessPredictionResult.actual]}.
              This is a local perturbation-sensitivity diagnostic, not a test-loss guarantee.
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ───────────────────────────────────────────────────────────────
          Gamification Panel
         ─────────────────────────────────────────────────────────────── */}
      {!isNotebook && gameMode && (
        <div style={{
          marginBottom: '0.75rem',
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(245,158,11,0.1), rgba(249,115,22,0.05))',
          border: '1px solid rgba(245,158,11,0.3)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600, color: '#fcd34d' }}>
              🎯 Flatness Prediction Challenge
            </h3>
            {gamePhase !== 'setup' && (
              <button
                type="button"
                onClick={resetGame}
                style={{
                  fontSize: '0.7rem',
                  padding: '0.25rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid #6b7280',
                  background: 'rgba(55,65,81,0.5)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                ← Back
              </button>
            )}
          </div>

          {gamePhase === 'setup' && (
            <>
              <p style={{ fontSize: '0.78rem', color: '#d1d5db', marginBottom: '0.6rem' }}>
                Can you predict which optimizer will end with lower local λₘₐₓ? SAM uses an approximate high-loss neighborhood probe, while SGD follows raw gradients.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {FLATNESS_CHALLENGES.map((challenge) => {
                  const isCompleted = completedChallenges.includes(challenge.name)
                  return (
                    <button
                      key={challenge.name}
                      type="button"
                      onClick={() => startChallenge(challenge)}
                      style={{
                        fontSize: '0.75rem',
                        padding: '0.35rem 0.7rem',
                        borderRadius: '8px',
                        border: isCompleted ? '1px solid #22c55e' : '1px solid #6b7280',
                        background: isCompleted ? 'rgba(34,197,94,0.15)' : 'rgba(55,65,81,0.5)',
                        color: isCompleted ? '#86efac' : '#e5e7eb',
                        cursor: 'pointer',
                      }}
                    >
                      {isCompleted ? '✓ ' : ''}{challenge.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {gamePhase === 'countdown' && selectedChallenge && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: '#fcd34d', marginBottom: '0.4rem', fontWeight: 500 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#d1d5db', marginBottom: '0.8rem', fontStyle: 'italic' }}>
                &ldquo;{selectedChallenge.description}&rdquo;
              </p>
              <p style={{ fontSize: '0.8rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                lr={selectedChallenge.lr}, ρ={selectedChallenge.rho} — Which endpoint has lower local λₘₐₓ?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {[
                  { value: 'sam-lower' as const, label: 'SAM lower λₘₐₓ', desc: 'Lower local sensitivity' },
                  { value: 'sgd-lower' as const, label: 'SGD lower λₘₐₓ', desc: 'Direct path is less sharp' },
                  { value: 'similar' as const, label: 'Similar λₘₐₓ', desc: 'Similar sharpness' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => submitPrediction(option.value)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.5rem 0.8rem',
                      borderRadius: '10px',
                      border: '1px solid #6b7280',
                      background: 'rgba(55,65,81,0.7)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                    <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: '2px' }}>{option.desc}</div>
                  </button>
                ))}
              </div>
              {countdown > 0 && (
                <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                  Make your prediction! ({countdown}s to think...)
                </div>
              )}
            </div>
          )}

          {gamePhase === 'running' && selectedChallenge && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.85rem', color: '#fcd34d', marginBottom: '0.4rem' }}>
                Running optimization... {gameStepsRemaining} steps remaining
              </p>
              <p style={{ fontSize: '0.78rem', color: '#d1d5db' }}>
                👆 Watch the trajectories diverge in real-time!
              </p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <div>
              <div style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '10px',
                marginBottom: '0.5rem',
                background: prediction === currentSharpnessOutcome
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)',
                border: prediction === currentSharpnessOutcome
                  ? '1px solid rgba(34,197,94,0.4)'
                  : '1px solid rgba(239,68,68,0.4)',
              }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getFlatnessFeedback(prediction, currentSharpnessOutcome, selectedChallenge, sgdCurrent.sharp, samCurrent.sharp)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                <span>
                  Your guess: <span style={{ color: prediction === currentSharpnessOutcome ? '#86efac' : '#fca5a5' }}>
                    {prediction ? SHARPNESS_OUTCOME_LABELS[prediction] : 'none'}
                  </span>
                </span>
                <span>
                  Actual: <span style={{ color: '#fcd34d' }}>
                    {SHARPNESS_OUTCOME_LABELS[currentSharpnessOutcome]}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '0.6rem 0.9rem',
          borderRadius: '0.5rem',
          background: isNotebook
            ? `linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(15, 23, 42, 0.82))`
            : `linear-gradient(135deg, ${currentInsight.color}22, ${currentInsight.color}08)`,
          border: isNotebook
            ? `1px solid ${currentInsight.color}77`
            : `1px solid ${currentInsight.color}55`,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{currentInsight.emoji}</span>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#f8fafc', lineHeight: 1.4 }}>
          {currentInsight.text}
        </p>
      </div>

      {/* Controls */}
      <div className="loss-layout">
        <div className="loss-controls">
          <label className="slider-label">
            Perturbation radius ρ ({rho.toFixed(2)})
            <input
              type="range"
              min={0.01}
              max={0.5}
              step={0.01}
              value={rho}
              onChange={(e) =>
                handleRhoChange(
                  parseFloat(e.target.value) || 0.01,
                )
              }
            />
          </label>
          <label className="slider-label">
            Learning rate ({lr.toFixed(3)})
            <input
              type="range"
              min={0.02}
              max={0.25}
              step={0.01}
              value={lr}
              onChange={(e) =>
                handleLrChange(
                  parseFloat(e.target.value) || 0.02,
                )
              }
            />
          </label>
          <div className="toggle-row">
            <span className="label">Optimizer view:</span>
            <button
              type="button"
              aria-pressed={mode === 'sgd'}
              onClick={() => setMode('sgd')}
              className={
                mode === 'sgd'
                  ? 'toggle-btn active'
                  : 'toggle-btn'
              }
            >
              SGD
            </button>
            <button
              type="button"
              aria-pressed={mode === 'sam'}
              onClick={() => setMode('sam')}
              className={
                mode === 'sam'
                  ? 'toggle-btn active'
                  : 'toggle-btn'
              }
            >
              SAM
            </button>
          </div>
          <div className="gd-buttons">
            <button type="button" onClick={stepOnce}>
              Step both optimizers
            </button>
            <button
              type="button"
              onClick={reset}
              className="ghost"
            >
              Reset
            </button>
          </div>
          <p className="caption">
            SAM approximates the inner maximization{' '}
            <code>
              max&#123;∥ε∥≤ρ&#125; L(w + ε)
            </code>{' '}
            by stepping using the gradient at a
            nearby high-loss probe point. This explicitly
            penalizes nearby high-loss directions in this toy slice.
          </p>
        </div>

        <div className="loss-panels">
          {/* Panel 1: Loss contours + trajectories */}
          <div className="loss-panel">
            <h3>1. Loss contours & optimizer trajectories</h3>
            <svg
              width={MAIN_WIDTH}
              height={MAIN_HEIGHT}
              role="img"
              aria-label="2D loss surface with two minima and optimizer trajectories"
              className="loss-chart main"
            >
              {/* Background loss heatmap */}
              {(() => {
                const { cells, nx, ny, lossMin, lossMax } =
                  grid
                const cellW =
                  (MAIN_WIDTH - 2 * PADDING) / nx
                const cellH =
                  (MAIN_HEIGHT - 2 * PADDING) / ny
                const span =
                  lossMax - lossMin || 1
                return cells.map((c) => {
                  const t =
                    (c.loss - lossMin) / span
                  const fill = lossColor(t)
                  const x =
                    PADDING +
                    c.i * cellW
                  const y =
                    PADDING +
                    (ny - 1 - c.j) * cellH
                  return (
                    <rect
                      key={`loss-${c.i}-${c.j}`}
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill={fill}
                      fillOpacity={0.95}
                    />
                  )
                })
              })()}

              {/* Axes */}
              <line
                x1={xToSvg(DOMAIN.xMin, MAIN_WIDTH)}
                y1={yToSvg(0, MAIN_HEIGHT)}
                x2={xToSvg(DOMAIN.xMax, MAIN_WIDTH)}
                y2={yToSvg(0, MAIN_HEIGHT)}
                className="axis-line"
              />
              <line
                x1={xToSvg(0, MAIN_WIDTH)}
                y1={yToSvg(DOMAIN.yMin, MAIN_HEIGHT)}
                x2={xToSvg(0, MAIN_WIDTH)}
                y2={yToSvg(DOMAIN.yMax, MAIN_HEIGHT)}
                className="axis-line"
              />

              {/* Flat & sharp minima markers */}
              <circle
                cx={xToSvg(
                  FLAT_CENTER.x,
                  MAIN_WIDTH,
                )}
                cy={yToSvg(
                  FLAT_CENTER.y,
                  MAIN_HEIGHT,
                )}
                r={4}
                className="minimum-point flat"
              />
              <circle
                cx={xToSvg(
                  SHARP_CENTER.x,
                  MAIN_WIDTH,
                )}
                cy={yToSvg(
                  SHARP_CENTER.y,
                  MAIN_HEIGHT,
                )}
                r={4}
                className="minimum-point sharp"
              />

              {/* SGD & SAM trajectories */}
              {sgdPathMain && (
                <path
                  d={sgdPathMain}
                  className={`loss-path sgd ${sgdLabel}`}
                />
              )}
              {samPathMain && (
                <path
                  d={samPathMain}
                  className={`loss-path sam ${samLabel}`}
                />
              )}

              {/* Current points */}
              <circle
                cx={xToSvg(
                  sgdCurrent.x,
                  MAIN_WIDTH,
                )}
                cy={yToSvg(
                  sgdCurrent.y,
                  MAIN_HEIGHT,
                )}
                r={
                  mode === 'sgd'
                    ? 5
                    : 4
                }
                className="optimizer-point sgd"
              />
              <circle
                cx={xToSvg(
                  samCurrent.x,
                  MAIN_WIDTH,
                )}
                cy={yToSvg(
                  samCurrent.y,
                  MAIN_HEIGHT,
                )}
                r={
                  mode === 'sam'
                    ? 6
                    : 4
                }
                className="optimizer-point sam"
              />

              {/* ρ-ball around SAM point */}
              {(() => {
                const cx = xToSvg(
                  samCurrent.x,
                  MAIN_WIDTH,
                )
                const cy = yToSvg(
                  samCurrent.y,
                  MAIN_HEIGHT,
                )
                const rSvg = Math.abs(
                  xToSvg(
                    samCurrent.x + rho,
                    MAIN_WIDTH,
                  ) - cx,
                )
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={rSvg}
                    className="rho-ball"
                  />
                )
              })()}

              {/* SAM neighborhood probe from the current point */}
              {(() => {
                const cx = xToSvg(
                  samCurrent.x,
                  MAIN_WIDTH,
                )
                const cy = yToSvg(
                  samCurrent.y,
                  MAIN_HEIGHT,
                )
                const wx = xToSvg(
                  probePoint.x,
                  MAIN_WIDTH,
                )
                const wy = yToSvg(
                  probePoint.y,
                  MAIN_HEIGHT,
                )
                return (
                  <>
                    <line
                      x1={cx}
                      y1={cy}
                      x2={wx}
                      y2={wy}
                      className="sam-eps-arrow"
                    />
                    <circle
                      cx={wx}
                      cy={wy}
                      r={3}
                      className="sam-probe-point"
                    />
                  </>
                )
              })()}

              {/* Hessian max-eigenvector direction at SAM point */}
              {(() => {
                const dir =
                  eigSamCurrent.dirMax
                const scale = 0.8
                const start: Vec2 = {
                  x:
                    samCurrent.x -
                    dir.x * scale,
                  y:
                    samCurrent.y -
                    dir.y * scale,
                }
                const end: Vec2 = {
                  x:
                    samCurrent.x +
                    dir.x * scale,
                  y:
                    samCurrent.y +
                    dir.y * scale,
                }
                return (
                  <line
                    x1={xToSvg(
                      start.x,
                      MAIN_WIDTH,
                    )}
                    y1={yToSvg(
                      start.y,
                      MAIN_HEIGHT,
                    )}
                    x2={xToSvg(
                      end.x,
                      MAIN_WIDTH,
                    )}
                    y2={yToSvg(
                      end.y,
                      MAIN_HEIGHT,
                    )}
                    className="hessian-max-eig"
                  />
                )
              })()}
            </svg>
            <p className="caption">
              Both optimizers see the same training
              loss surface, but SAM&apos;s update
              direction is influenced by the high-loss
              probe point in its ρ-ball (arrow). It gets
              discouraged from entering regions where small
              perturbations sharply raise this toy loss.
            </p>
          </div>

          {/* Panel 2: Sharpness heatmap */}
          <div className="loss-panel">
            <h3>2. Sharpness heatmap (λₘₐₓ of Hessian)</h3>
            <svg
              width={HEAT_WIDTH}
              height={HEAT_HEIGHT}
              role="img"
              aria-label="Sharpness heatmap over the loss landscape"
              className="loss-chart sharpness"
            >
              {(() => {
                const {
                  cells,
                  nx,
                  ny,
                  sharpMin,
                  sharpMax,
                } = grid
                const cellW =
                  (HEAT_WIDTH - 2 * PADDING) / nx
                const cellH =
                  (HEAT_HEIGHT - 2 * PADDING) /
                  ny
                const span =
                  sharpMax - sharpMin || 1
                return cells.map((c) => {
                  const t =
                    (c.sharpness - sharpMin) /
                    span
                  const fill =
                    sharpnessColor(t)
                  const x =
                    PADDING +
                    c.i * cellW
                  const y =
                    PADDING +
                    (ny - 1 - c.j) * cellH
                  return (
                    <rect
                      key={`sharp-${c.i}-${c.j}`}
                      x={x}
                      y={y}
                      width={cellW}
                      height={cellH}
                      fill={fill}
                      fillOpacity={0.9}
                    />
                  )
                })
              })()}

              {/* Axes */}
              <line
                x1={xToSvg(DOMAIN.xMin, HEAT_WIDTH)}
                y1={yToSvg(0, HEAT_HEIGHT)}
                x2={xToSvg(DOMAIN.xMax, HEAT_WIDTH)}
                y2={yToSvg(0, HEAT_HEIGHT)}
                className="axis-line"
              />
              <line
                x1={xToSvg(0, HEAT_WIDTH)}
                y1={yToSvg(DOMAIN.yMin, HEAT_HEIGHT)}
                x2={xToSvg(0, HEAT_WIDTH)}
                y2={yToSvg(DOMAIN.yMax, HEAT_HEIGHT)}
                className="axis-line"
              />

              {/* Paths over sharpness field */}
              {sgdPathHeat && (
                <path
                  d={sgdPathHeat}
                  className={`loss-path sgd ${sgdLabel}`}
                />
              )}
              {samPathHeat && (
                <path
                  d={samPathHeat}
                  className={`loss-path sam ${samLabel}`}
                />
              )}

              {/* Current points */}
              <circle
                cx={xToSvg(
                  sgdCurrent.x,
                  HEAT_WIDTH,
                )}
                cy={yToSvg(
                  sgdCurrent.y,
                  HEAT_HEIGHT,
                )}
                r={4}
                className="optimizer-point sgd"
              />
              <circle
                cx={xToSvg(
                  samCurrent.x,
                  HEAT_WIDTH,
                )}
                cy={yToSvg(
                  samCurrent.y,
                  HEAT_HEIGHT,
                )}
                r={5}
                className="optimizer-point sam"
              />
            </svg>
            <p className="caption">
              Color encodes the maximum eigenvalue
              λₘₐₓ of the Hessian: red = very sharp,
              teal = less locally sharp. In this toy, SAM can
              settle in a lower-sensitivity region even if the
              training loss is slightly higher.
            </p>
          </div>

          {/* Panel 3: 1D cross-section */}
          <div className="loss-panel">
            <h3>3. Cross-section: sharp vs flat profile</h3>
            <svg
              width={CROSS_WIDTH}
              height={CROSS_HEIGHT}
              role="img"
              aria-label="1D cross-section of the loss along a horizontal slice"
              className="loss-chart cross-section"
            >
              {/* Cross-section curves */}
              {crossFlatPath && (
                <path
                  d={crossFlatPath}
                  className="cross-curve flat"
                />
              )}
              {crossSharpPath && (
                <path
                  d={crossSharpPath}
                  className="cross-curve sharp"
                />
              )}
              {crossCombinedPath && (
                <path
                  d={crossCombinedPath}
                  className="cross-curve combined"
                />
              )}

              {/* Minima markers */}
              <line
                x1={xToSvg(
                  flatMinX,
                  CROSS_WIDTH,
                )}
                y1={PADDING}
                x2={xToSvg(
                  flatMinX,
                  CROSS_WIDTH,
                )}
                y2={
                  CROSS_HEIGHT - PADDING
                }
                className="cross-min-line flat"
              />
              <line
                x1={xToSvg(
                  sharpMinX,
                  CROSS_WIDTH,
                )}
                y1={PADDING}
                x2={xToSvg(
                  sharpMinX,
                  CROSS_WIDTH,
                )}
                y2={
                  CROSS_HEIGHT - PADDING
                }
                className="cross-min-line sharp"
              />

              {/* Active algorithm marker projected to cross-section */}
              {(() => {
                const x =
                  activeCurrent.x
                const yVal =
                  combinedLoss(
                    x,
                    CROSS_SECTION_Y,
                  )
                const yPx = (() => {
                  const tY =
                    yVal /
                    crossSection.maxVal
                  const innerH =
                    CROSS_HEIGHT -
                    2 * PADDING
                  return (
                    CROSS_HEIGHT -
                    PADDING -
                    tY * innerH
                  )
                })()
                return (
                  <circle
                    cx={xToSvg(
                      x,
                      CROSS_WIDTH,
                    )}
                    cy={yPx}
                    r={5}
                    className={`cross-current ${mode}`}
                  />
                )
              })()}
            </svg>
            <p className="caption">
              The sharp minimum is deeper but very
              narrow; the flat minimum is shallower but
              wide. A flatter region has more nearby
              parameter settings with similar toy loss, but
              real generalization claims depend on the
              perturbation definition and validation data.
            </p>
          </div>

          {/* Panel 4: Metrics & sharpness along trajectory */}
          <div className="loss-panel metrics-panel">
            <h3>4. Local metrics & toy flatness score</h3>
            <div className="metrics-grid">
              <div className="metric-column">
                <h4>Current point</h4>
                <div className="metric-row">
                  <span className="label">
                    Steps
                  </span>
                  <span>{steps}</span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Algorithm
                  </span>
                  <span>
                    {mode === 'sgd'
                      ? 'SGD'
                      : 'SAM'}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Loss (SGD)
                  </span>
                  <span>
                    {sgdCurrent.loss.toFixed(
                      3,
                    )}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Loss (SAM)
                  </span>
                  <span>
                    {samCurrent.loss.toFixed(
                      3,
                    )}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    λₘₐₓ (SGD)
                  </span>
                  <span>
                    {sgdCurrent.sharp.toFixed(
                      3,
                    )}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    λₘₐₓ (SAM)
                  </span>
                  <span>
                    {samCurrent.sharp.toFixed(
                      3,
                    )}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    SAM perturbation loss in ρ-ball
                    (SAM)
                  </span>
                  <span>
                    {probeLoss.toFixed(3)}{' '}
                    <span className="muted">
                      (
                      {probeLossDelta >= 0
                        ? '+'
                        : ''}
                      {probeLossDelta.toFixed(
                        3,
                      )}
                      )
                    </span>
                  </span>
                </div>
              </div>

              <div className="metric-column">
                <h4>Flatness score in this slice</h4>
                <div className="metric-row">
                  <span className="label">
                    Avg λₘₐₓ (SGD path)
                  </span>
                  <span>
                    {sgdAvgSharp.toFixed(3)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Avg λₘₐₓ (SAM path)
                  </span>
                  <span>
                    {samAvgSharp.toFixed(3)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Toy flatness score
                    (SGD)
                  </span>
                  <span>
                    {sgdFlatnessScore.toFixed(3)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Toy flatness score
                    (SAM)
                  </span>
                  <span>
                    {samFlatnessScore.toFixed(3)}
                  </span>
                </div>
                <p className="caption">
                  Here the toy score is{' '}
                  <code>1 / (1 + λₘₐₓ)</code>:
                  lower sharpness =&gt; higher
                  score. It is a local sensitivity
                  diagnostic, not a substitute for
                  held-out test performance.
                </p>
              </div>
            </div>

            <div className="metric-chart-wrapper">
              <h4>
                Sharpness along{' '}
                {mode === 'sgd' ? 'SGD' : 'SAM'}{' '}
                trajectory
              </h4>
              <svg
                width={METRIC_CHART_WIDTH}
                height={METRIC_CHART_HEIGHT}
                role="img"
                aria-label="Sharpness over optimization steps"
                className="sharpness-sparkline"
              >
                <line
                  x1={PADDING}
                  y1={
                    METRIC_CHART_HEIGHT -
                    PADDING
                  }
                  x2={
                    METRIC_CHART_WIDTH -
                    PADDING
                  }
                  y2={
                    METRIC_CHART_HEIGHT -
                    PADDING
                  }
                  className="axis-line"
                />
                <line
                  x1={PADDING}
                  y1={PADDING}
                  x2={PADDING}
                  y2={
                    METRIC_CHART_HEIGHT -
                    PADDING
                  }
                  className="axis-line"
                />
                {sharpSpark && (
                  <path
                    d={sharpSpark}
                    className="sharpness-path"
                  />
                )}
              </svg>
              <p className="caption">
                Mini-batch SGD injects noise into
                the updates, which tends to push
                away from extremely sharp minima
                (where small moves cause large
                loss jumps). SAM makes this idea
                explicit by approximating the
                high-loss nearby probe.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
      <style jsx>{`
        .loss-landscape-card {
          overflow: hidden;
        }

        .loss-layout {
          display: grid;
          grid-template-columns: minmax(220px, 0.75fr) minmax(0, 2fr);
          gap: 1rem;
          align-items: start;
        }

        .loss-controls,
        .loss-panel {
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(15, 23, 42, 0.72);
          border-radius: 14px;
          padding: 0.85rem;
          min-width: 0;
        }

        .notebook .loss-controls,
        .notebook .loss-panel {
          background: rgba(15, 23, 42, 0.58);
          border-color: rgba(148, 163, 184, 0.2);
        }

        .loss-controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .loss-panels {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 0.85rem;
          min-width: 0;
        }

        .loss-panel h3,
        .loss-panel h4 {
          margin: 0 0 0.55rem;
          color: #e5e7eb;
          line-height: 1.25;
        }

        .loss-panel h3 {
          font-size: 0.94rem;
        }

        .loss-panel h4 {
          font-size: 0.84rem;
        }

        .loss-landscape-card button:focus-visible {
          outline: 2px solid #f8fafc;
          outline-offset: 2px;
          box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.35);
        }

        .loss-chart {
          display: block;
          max-width: 100%;
          height: auto;
          border-radius: 12px;
          background: #0f172a;
          border: 1px solid rgba(148, 163, 184, 0.14);
        }

        .caption {
          margin: 0.55rem 0 0;
          color: #9ca3af;
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .caption code {
          color: #dbeafe;
          white-space: normal;
        }

        .toggle-row,
        .gd-buttons {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.45rem;
        }

        .toggle-row .label {
          color: #aab8ca;
          font-size: 0.8rem;
        }

        .toggle-btn,
        .gd-buttons button,
        .ghost {
          appearance: none;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 9px;
          background: rgba(15, 23, 42, 0.7);
          color: #d9e2ef;
          cursor: pointer;
          font-size: 0.82rem;
          font-weight: 600;
          padding: 0.5rem 0.68rem;
        }

        .toggle-btn.active,
        .gd-buttons button:not(.ghost):hover,
        .ghost:hover {
          border-color: rgba(20, 184, 166, 0.72);
          color: #ccfbf1;
        }

        .toggle-btn.active {
          background: rgba(20, 184, 166, 0.18);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.85rem;
        }

        .metric-row {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          border-bottom: 1px solid rgba(148, 163, 184, 0.12);
          padding: 0.34rem 0;
          color: #e5e7eb;
          font-size: 0.78rem;
        }

        .metric-row .label {
          color: #9ca3af;
        }

        .metric-chart-wrapper {
          margin-top: 0.9rem;
        }

        .axis-line {
          stroke: rgba(226, 232, 240, 0.34);
          stroke-width: 1;
        }

        .minimum-point.flat,
        .cross-min-line.flat {
          stroke: #14b8a6;
          fill: #14b8a6;
        }

        .minimum-point.sharp,
        .cross-min-line.sharp {
          stroke: #ef4444;
          fill: #ef4444;
        }

        .cross-min-line {
          stroke-width: 1.5;
          stroke-dasharray: 4 4;
          opacity: 0.8;
        }

        .loss-path,
        .cross-curve,
        .sharpness-path {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .loss-path {
          stroke-width: 3;
          opacity: 0.9;
        }

        .loss-path.ghost {
          opacity: 0.45;
        }

        .loss-path.sgd,
        .cross-current.sgd {
          stroke: #60a5fa;
        }

        .optimizer-point.sgd,
        .cross-current.sgd {
          fill: #60a5fa;
        }

        .loss-path.sam,
        .cross-current.sam {
          stroke: #f59e0b;
        }

        .optimizer-point.sam,
        .cross-current.sam {
          fill: #f59e0b;
        }

        .optimizer-point {
          stroke: #020617;
          stroke-width: 1.5;
        }

        .rho-ball {
          fill: rgba(245, 158, 11, 0.12);
          stroke: rgba(245, 158, 11, 0.72);
          stroke-width: 1.5;
          stroke-dasharray: 4 4;
        }

        .sam-eps-arrow {
          stroke: #fbbf24;
          stroke-width: 2;
          stroke-linecap: round;
        }

        .sam-probe-point {
          fill: #fbbf24;
          stroke: #020617;
          stroke-width: 1;
        }

        .hessian-max-eig {
          stroke: rgba(255, 255, 255, 0.82);
          stroke-width: 1.5;
          stroke-dasharray: 3 3;
        }

        .cross-curve {
          stroke-width: 2.5;
        }

        .cross-curve.flat {
          stroke: #14b8a6;
        }

        .cross-curve.sharp {
          stroke: #ef4444;
        }

        .cross-curve.combined {
          stroke: #dbeafe;
        }

        .sharpness-path {
          stroke: #f59e0b;
          stroke-width: 2.5;
        }

        @media (max-width: 820px) {
          .loss-layout {
            grid-template-columns: 1fr;
          }

          .loss-controls,
          .loss-panel {
            padding: 0.72rem;
          }
        }
      `}</style>
    </>
  )
}
