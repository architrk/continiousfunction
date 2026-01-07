import { useMemo, useState, useCallback, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// Gamification Types
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed'
type FlatnessPrediction = 'sam-wins' | 'sgd-wins' | 'tie' | null

interface FlatnessChallenge {
  name: string
  lr: number
  rho: number
  answer: Exclude<FlatnessPrediction, null>
  description: string
  steps: number
}

// Mystery challenges - users predict which optimizer finds flatter minimum
const FLATNESS_CHALLENGES: FlatnessChallenge[] = [
  {
    name: '🎲 Standard Setup',
    lr: 0.08,
    rho: 0.2,
    answer: 'sam-wins',
    description: 'Medium learning rate, standard ρ... who finds the flatter basin?',
    steps: 20
  },
  {
    name: '🎲 Tiny Steps',
    lr: 0.02,
    rho: 0.1,
    answer: 'tie',
    description: 'Very small learning rate... can SGD compete with SAM?',
    steps: 25
  },
  {
    name: '🎲 Big Jumps',
    lr: 0.15,
    rho: 0.25,
    answer: 'sam-wins',
    description: 'High learning rate... will SAM stabilize or oscillate?',
    steps: 15
  },
  {
    name: '🎲 Wide Search',
    lr: 0.06,
    rho: 0.4,
    answer: 'sam-wins',
    description: 'Large ρ means SAM looks further for worst-case directions...',
    steps: 20
  },
  {
    name: '🎲 Edge Case',
    lr: 0.03,
    rho: 0.05,
    answer: 'tie',
    description: 'Tiny ρ makes SAM almost like SGD... will they converge similarly?',
    steps: 25
  },
]

// Educational feedback
function getFlatnessFeedback(
  prediction: FlatnessPrediction,
  challenge: FlatnessChallenge,
  sgdSharp: number,
  samSharp: number
): string {
  const isCorrect = prediction === challenge.answer
  const sharpDiff = sgdSharp - samSharp
  const samWon = sharpDiff > 0.5
  const sgdWon = sharpDiff < -0.5
  const wasTie = !samWon && !sgdWon

  if (isCorrect) {
    if (challenge.answer === 'sam-wins') {
      return `✅ Correct! SAM sharpness: ${samSharp.toFixed(2)} vs SGD: ${sgdSharp.toFixed(2)}. SAM's adversarial perturbation (ρ=${challenge.rho}) found a flatter region. This predicts better generalization!`
    }
    if (challenge.answer === 'sgd-wins') {
      return `✅ Correct! SGD sharpness: ${sgdSharp.toFixed(2)} vs SAM: ${samSharp.toFixed(2)}. Sometimes the direct path works! Low learning rate can help SGD avoid sharp minima.`
    }
    return `✅ Correct! Both converged to similar sharpness (~${((sgdSharp + samSharp) / 2).toFixed(2)}). With lr=${challenge.lr} and ρ=${challenge.rho}, SAM's perturbation wasn't different enough to diverge paths.`
  }

  // Wrong answers
  if (challenge.answer === 'sam-wins') {
    return `❌ SAM actually won! Sharpness: SAM ${samSharp.toFixed(2)} vs SGD ${sgdSharp.toFixed(2)}. SAM's ascent step (with ρ=${challenge.rho}) biases optimization toward flat regions that generalize better.`
  }
  if (challenge.answer === 'sgd-wins') {
    return `❌ SGD actually won! Sharpness: SGD ${sgdSharp.toFixed(2)} vs SAM ${samSharp.toFixed(2)}. This can happen when ρ is too aggressive or the learning rate is too high for SAM.`
  }
  return `❌ It was actually a tie! Both ended at similar sharpness (~${((sgdSharp + samSharp) / 2).toFixed(2)}). With these settings, SAM's perturbation didn't create enough divergence.`
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
    name: 'SAM Showcase',
    emoji: '🎯',
    description: 'SAM finds flat minimum while SGD gets stuck in sharp one',
    lr: 0.08,
    rho: 0.2,
  },
  {
    id: 'sgdWins',
    name: 'SGD Success',
    emoji: '⚡',
    description: 'Low lr lets SGD find flat minimum (slowly)',
    lr: 0.03,
    rho: 0.15,
  },
  {
    id: 'highLr',
    name: 'High LR',
    emoji: '🚀',
    description: 'High learning rate: SGD oscillates, SAM stabilizes',
    lr: 0.15,
    rho: 0.25,
  },
  {
    id: 'lowLr',
    name: 'Low LR',
    emoji: '🐢',
    description: 'Low learning rate: Both converge slowly but SGD may overshoot',
    lr: 0.02,
    rho: 0.1,
  },
  {
    id: 'largeRho',
    name: 'Large ρ',
    emoji: '🔍',
    description: 'Large perturbation radius: SAM strongly prefers flat regions',
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
      text: 'Click "Step" to watch SGD and SAM diverge! SGD follows raw gradient; SAM first perturbs to find worst-case direction, then descends.',
    }
  }

  const sgdLast = sgdTrajectory[sgdTrajectory.length - 1]
  const samLast = samTrajectory[samTrajectory.length - 1]

  // Check which found flatter minimum
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
      text: `SAM found flatter region! Sharpness ${samSharp.toFixed(2)} vs SGD's ${sgdSharp.toFixed(2)}. Flat minima generalize better—this is SAM's superpower.`,
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
    text: `After ${steps} steps: SGD loss=${sgdLoss.toFixed(3)}, SAM loss=${samLoss.toFixed(3)}. Keep stepping to see which finds the better basin!`,
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

const START_POINT: Vec2 = { x: -0.7, y: 1.3 }

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

// ----- Main component -----

export default function LossLandscapeSharpnessDemo() {
  const [rho, setRho] = useState(0.2)
  const [lr, setLr] = useState(0.08)
  const [mode, setMode] =
    useState<OptimizerMode>('sam')
  const [steps, setSteps] = useState(0)
  const [activePreset, setActivePreset] = useState<ScenarioId | null>('samShowcase')

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
      const p0 = {
        x: START_POINT.x,
        y: START_POINT.y,
        loss: combinedLoss(START_POINT.x, START_POINT.y),
        sharp: Math.max(eigenDecomposition2D(hessianLoss(START_POINT.x, START_POINT.y)).lambdaMax, 0)
      }
      setSgdTrajectory([p0])
      setSamTrajectory([p0])
      setSteps(0)
    }
  }, [gamePhase, gameStepsRemaining, selectedChallenge?.steps])

  const makeInitialPoint = () => {
    const loss0 = combinedLoss(
      START_POINT.x,
      START_POINT.y,
    )
    const h0 = hessianLoss(
      START_POINT.x,
      START_POINT.y,
    )
    const eig0 = eigenDecomposition2D(h0)
    const sharp0 = Math.max(eig0.lambdaMax, 0)
    const p0: TrajPoint = {
      x: START_POINT.x,
      y: START_POINT.y,
      loss: loss0,
      sharp: sharp0,
    }
    return p0
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
    // Reset trajectories when changing preset
    const p0 = makeInitialPoint()
    setSgdTrajectory([p0])
    setSamTrajectory([p0])
    setSteps(0)
  }, [])

  // Clear preset when manually adjusting sliders
  const handleLrChange = useCallback((newLr: number) => {
    setLr(newLr)
    setActivePreset(null)
  }, [])

  const handleRhoChange = useCallback((newRho: number) => {
    setRho(newRho)
    setActivePreset(null)
  }, [])

  const stepOnce = () => {
    setSgdTrajectory((prev) => {
      const last = prev[prev.length - 1]
      const next = sgdStep(
        { x: last.x, y: last.y },
        lr,
      )
      const loss = combinedLoss(
        next.x,
        next.y,
      )
      const h = hessianLoss(
        next.x,
        next.y,
      )
      const eig = eigenDecomposition2D(h)
      const sharp = Math.max(eig.lambdaMax, 0)
      return [
        ...prev,
        { x: next.x, y: next.y, loss, sharp },
      ]
    })
    setSamTrajectory((prev) => {
      const last = prev[prev.length - 1]
      const next = samStep(
        { x: last.x, y: last.y },
        lr,
        rho,
      )
      const loss = combinedLoss(
        next.x,
        next.y,
      )
      const h = hessianLoss(
        next.x,
        next.y,
      )
      const eig = eigenDecomposition2D(h)
      const sharp = Math.max(eig.lambdaMax, 0)
      return [
        ...prev,
        { x: next.x, y: next.y, loss, sharp },
      ]
    })
    setSteps((s) => s + 1)
  }

  const reset = () => {
    const p0 = makeInitialPoint()
    setSgdTrajectory([p0])
    setSamTrajectory([p0])
    setSteps(0)
  }

  // Game auto-stepping effect
  useEffect(() => {
    if (gamePhase !== 'running' || gameStepsRemaining <= 0) return

    const timer = setTimeout(() => {
      // Execute one step for both optimizers
      setSgdTrajectory((prev) => {
        const last = prev[prev.length - 1]
        const next = sgdStep({ x: last.x, y: last.y }, lr)
        const loss = combinedLoss(next.x, next.y)
        const h = hessianLoss(next.x, next.y)
        const eig = eigenDecomposition2D(h)
        const sharp = Math.max(eig.lambdaMax, 0)
        return [...prev, { x: next.x, y: next.y, loss, sharp }]
      })
      setSamTrajectory((prev) => {
        const last = prev[prev.length - 1]
        const next = samStep({ x: last.x, y: last.y }, lr, rho)
        const loss = combinedLoss(next.x, next.y)
        const h = hessianLoss(next.x, next.y)
        const eig = eigenDecomposition2D(h)
        const sharp = Math.max(eig.lambdaMax, 0)
        return [...prev, { x: next.x, y: next.y, loss, sharp }]
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
      setGamePhase('revealed')
      if (prediction === selectedChallenge.answer) {
        setScore((s) => s + 1)
      }
      if (!completedChallenges.includes(selectedChallenge.name)) {
        setCompletedChallenges((c) => [...c, selectedChallenge.name])
      }
    }
  }, [gamePhase, gameStepsRemaining, selectedChallenge, prediction, completedChallenges])

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

  const samGrad = gradVecAt(samCurrent)
  const samGradNorm =
    Math.hypot(samGrad.x, samGrad.y) || 1e-8
  const epsVec: Vec2 = {
    x: (rho * samGrad.x) / samGradNorm,
    y: (rho * samGrad.y) / samGradNorm,
  }
  const worstPoint: Vec2 = {
    x: samCurrent.x + epsVec.x,
    y: samCurrent.y + epsVec.y,
  }
  const worstLoss = combinedLoss(
    worstPoint.x,
    worstPoint.y,
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

  const sgdGenProxy =
    1 / (1 + sgdCurrent.sharp)
  const samGenProxy =
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

  const worstLossDelta =
    worstLoss - samCurrent.loss

  return (
    <section className="card interactive-card">
      <h2>Loss Landscape, Sharpness & SAM</h2>
      <p className="muted">
        Explore a 2D loss surface with a sharp and a flat
        minimum. Compare SGD vs SAM: SAM looks at the
        worst-case loss inside a small ball around the
        current weights and prefers flatter valleys.
      </p>

      {/* Scenario Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem', marginTop: '0.5rem' }}>
        {LANDSCAPE_PRESETS.map((preset) => (
          <button
            key={preset.id}
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
        <button
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
          {gameMode ? '🎮 Exit Challenge' : '🎯 Try Prediction Challenge'}
        </button>
        {score > 0 && (
          <span style={{ fontSize: '0.75rem', color: '#fcd34d', alignSelf: 'center', marginLeft: '0.5rem' }}>
            Score: {score}/{completedChallenges.length}
          </span>
        )}
      </div>

      {/* ───────────────────────────────────────────────────────────────
          Gamification Panel
         ─────────────────────────────────────────────────────────────── */}
      {gameMode && (
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
                Can you predict which optimizer will find the flatter minimum? SAM uses adversarial perturbations, SGD follows raw gradients!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {FLATNESS_CHALLENGES.map((challenge) => {
                  const isCompleted = completedChallenges.includes(challenge.name)
                  return (
                    <button
                      key={challenge.name}
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
                lr={selectedChallenge.lr}, ρ={selectedChallenge.rho} — Who will find the flatter minimum?
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                {[
                  { value: 'sam-wins' as const, label: '🎯 SAM Wins', desc: 'Flatter basin' },
                  { value: 'sgd-wins' as const, label: '⚡ SGD Wins', desc: 'Direct path works' },
                  { value: 'tie' as const, label: '🤝 Tie', desc: 'Similar sharpness' },
                ].map((option) => (
                  <button
                    key={option.value}
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
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34,197,94,0.4)'
                  : '1px solid rgba(239,68,68,0.4)',
              }}>
                <p style={{ margin: 0, fontSize: '0.78rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getFlatnessFeedback(prediction, selectedChallenge, sgdCurrent.sharp, samCurrent.sharp)}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.8rem', fontSize: '0.7rem', color: '#9ca3af' }}>
                <span>
                  Your guess: <span style={{ color: prediction === selectedChallenge.answer ? '#86efac' : '#fca5a5' }}>
                    {prediction === 'sam-wins' ? '🎯 SAM' : prediction === 'sgd-wins' ? '⚡ SGD' : '🤝 Tie'}
                  </span>
                </span>
                <span>
                  Actual: <span style={{ color: '#fcd34d' }}>
                    {selectedChallenge.answer === 'sam-wins' ? '🎯 SAM' : selectedChallenge.answer === 'sgd-wins' ? '⚡ SGD' : '🤝 Tie'}
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
          background: `linear-gradient(135deg, ${currentInsight.color}22, ${currentInsight.color}08)`,
          border: `1px solid ${currentInsight.color}55`,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{currentInsight.emoji}</span>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.4 }}>
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
            <button onClick={stepOnce}>
              Step both optimizers
            </button>
            <button
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
            worst-case nearby point. This explicitly
            pushes the iterate toward flatter regions.
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

              {/* Worst-case perturbation from SAM point */}
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
                  worstPoint.x,
                  MAIN_WIDTH,
                )
                const wy = yToSvg(
                  worstPoint.y,
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
                      className="sam-worst-point"
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
              direction is influenced by the worst-case
              point in its ρ-ball (arrow). It gets
              discouraged from entering extremely sharp
              minima.
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
              teal = flatter. Notice how SAM tends to
              settle in flatter (teal-ish) regions,
              even if the loss value is slightly higher.
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
              wide. Flat minima correspond to many
              nearby parameter settings with similar
              loss, which generally leads to better
              generalization and robustness to
              perturbations.
            </p>
          </div>

          {/* Panel 4: Metrics & sharpness along trajectory */}
          <div className="loss-panel metrics-panel">
            <h3>4. Local metrics & generalization proxy</h3>
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
                    Worst-case loss in ρ-ball
                    (SAM)
                  </span>
                  <span>
                    {worstLoss.toFixed(3)}{' '}
                    <span className="muted">
                      (
                      {worstLossDelta >= 0
                        ? '+'
                        : ''}
                      {worstLossDelta.toFixed(
                        3,
                      )}
                      )
                    </span>
                  </span>
                </div>
              </div>

              <div className="metric-column">
                <h4>Flatness & generalization proxy</h4>
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
                    Generalization proxy
                    (SGD)
                  </span>
                  <span>
                    {sgdGenProxy.toFixed(3)}
                  </span>
                </div>
                <div className="metric-row">
                  <span className="label">
                    Generalization proxy
                    (SAM)
                  </span>
                  <span>
                    {samGenProxy.toFixed(3)}
                  </span>
                </div>
                <p className="caption">
                  Here the proxy is{' '}
                  <code>1 / (1 + λₘₐₓ)</code>:
                  lower sharpness =&gt; higher
                  score. SAM often trades a tiny
                  increase in training loss for a
                  much flatter basin, which tends
                  to improve test performance.
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
                explicit by optimizing for the
                worst-case nearby loss.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
