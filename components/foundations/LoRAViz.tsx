import { useEffect, useMemo, useState } from 'react'

type Matrix = number[][]

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

const VIS_D = 12
const MAX_RANK = 64
const BASE_MODEL_DIM = 4096

// --- Basic matrix helpers ----------------------------------------------------

function createZeroMatrix(rows: number, cols: number): Matrix {
  return Array.from({ length: rows }, () => Array(cols).fill(0))
}

function randn(): number {
  // Box–Muller transform, approximate N(0, 1)
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

function createRandomMatrix(rows: number, cols: number, scale = 1): Matrix {
  const out: Matrix = []
  for (let i = 0; i < rows; i++) {
    const row: number[] = []
    for (let j = 0; j < cols; j++) {
      row.push(randn() * scale)
    }
    out.push(row)
  }
  return out
}

function matmul(a: Matrix, b: Matrix): Matrix {
  const rows = a.length
  const shared = a[0]?.length ?? 0
  const cols = b[0]?.length ?? 0
  if (shared === 0 || b.length !== shared) {
    return createZeroMatrix(rows, cols)
  }
  const out = createZeroMatrix(rows, cols)
  for (let i = 0; i < rows; i++) {
    for (let k = 0; k < shared; k++) {
      const aik = a[i][k]
      for (let j = 0; j < cols; j++) {
        out[i][j] += aik * b[k][j]
      }
    }
  }
  return out
}

function addMatrices(a: Matrix, b: Matrix): Matrix {
  const rows = a.length
  const cols = a[0]?.length ?? 0
  const out = createZeroMatrix(rows, cols)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i][j] = a[i][j] + (b[i]?.[j] ?? 0)
    }
  }
  return out
}

function subMatrices(a: Matrix, b: Matrix): Matrix {
  const rows = a.length
  const cols = a[0]?.length ?? 0
  const out = createZeroMatrix(rows, cols)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i][j] = a[i][j] - (b[i]?.[j] ?? 0)
    }
  }
  return out
}

function scaleMatrix(m: Matrix, s: number): Matrix {
  const rows = m.length
  const cols = m[0]?.length ?? 0
  const out = createZeroMatrix(rows, cols)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[i][j] = m[i][j] * s
    }
  }
  return out
}

function transpose(m: Matrix): Matrix {
  const rows = m.length
  const cols = m[0]?.length ?? 0
  const out = createZeroMatrix(cols, rows)
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      out[j][i] = m[i][j]
    }
  }
  return out
}

function frobeniusNorm(m: Matrix): number {
  let sumSq = 0
  for (let i = 0; i < m.length; i++) {
    for (let j = 0; j < (m[i]?.length ?? 0); j++) {
      const v = m[i][j]
      sumSq += v * v
    }
  }
  return Math.sqrt(sumSq)
}

// --- Heatmap component -------------------------------------------------------

interface MatrixHeatmapProps {
  matrix: Matrix
  title: string
  subtitle?: string
  compact?: boolean
}

function MatrixHeatmap({ matrix, title, subtitle, compact }: MatrixHeatmapProps) {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const CELL = compact ? 8 : 10
  const width = Math.max(cols * CELL, 40)
  const height = Math.max(rows * CELL, 40)

  let maxAbs = 0
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const v = Math.abs(matrix[i][j])
      if (v > maxAbs) maxAbs = v
    }
  }
  if (maxAbs === 0) maxAbs = 1

  return (
    <div className="lora-matrix">
      <div className="lora-matrix-header">
        <span className="label">{title}</span>
        {subtitle && <span className="value">{subtitle}</span>}
      </div>
      <svg
        width={width}
        height={height}
        className="lora-heatmap"
        role="img"
        aria-label={title}
      >
        {matrix.map((row, i) =>
          row.map((v, j) => {
            const mag = Math.abs(v) / maxAbs
            const positive = v >= 0
            const fill = positive ? MATH_COLORS.primary : MATH_COLORS.secondary
            const fillOpacity = 0.1 + 0.9 * mag
            return (
              <rect
                key={`${i}-${j}`}
                x={j * CELL}
                y={i * CELL}
                width={CELL - 1}
                height={CELL - 1}
                fill={fill}
                fillOpacity={fillOpacity}
                style={{ transition: 'fill 150ms ease, fill-opacity 150ms ease' }}
              />
            )
          })
        )}
      </svg>
    </div>
  )
}

// --- Geometric view (2D weight space) ---------------------------------------

function GeometricView({ rank }: { rank: number }) {
  const WIDTH = 260
  const HEIGHT = 220
  const CX = WIDTH / 2
  const CY = HEIGHT / 2
  const SCALE = 70

  const full: [number, number] = [1.4, 1.0]
  const dir1Raw: [number, number] = [1, 0.3]
  const dir2Raw: [number, number] = [-0.2, 1.0]

  const normalize2 = ([x, y]: [number, number]): [number, number] => {
    const n = Math.hypot(x, y) || 1
    return [x / n, y / n]
  }

  const dot2 = (a: [number, number], b: [number, number]) => a[0] * b[0] + a[1] * b[1]

  const dir1 = normalize2(dir1Raw)
  const dir2 = normalize2(dir2Raw)

  const proj1Len = dot2(full, dir1)
  const proj1: [number, number] = [dir1[0] * proj1Len, dir1[1] * proj1Len]

  const toSvg = ([x, y]: [number, number]) => ({
    x: CX + x * SCALE,
    y: CY - y * SCALE,
  })

  const originSvg = { x: CX, y: CY }
  const fullSvg = toSvg(full)
  const proj1Svg = toSvg(proj1)
  const dir1Svg = toSvg([dir1[0] * 1.8, dir1[1] * 1.8])
  const dir2Svg = toSvg([dir2[0] * 1.8, dir2[1] * 1.8])

  const showRank2 = rank >= 2

  return (
    <div className="lora-geom">
      <h3 className="subheading">Geometric view</h3>
      <svg
        width={WIDTH}
        height={HEIGHT}
        className="lora-geom-chart"
        role="img"
        aria-label="Weight space constraints for LoRA"
      >
        {/* axes */}
        <line x1={0} y1={CY} x2={WIDTH} y2={CY} className="axis-line" />
        <line x1={CX} y1={0} x2={CX} y2={HEIGHT} className="axis-line" />

        {/* full fine-tuning target */}
        <line
          x1={originSvg.x}
          y1={originSvg.y}
          x2={fullSvg.x}
          y2={fullSvg.y}
          className="geom-vector-full"
          stroke={MATH_COLORS.accent}
          strokeWidth={2}
        />
        <circle
          cx={fullSvg.x}
          cy={fullSvg.y}
          r={4}
          fill={MATH_COLORS.accent}
        />
        <text
          x={fullSvg.x + 6}
          y={fullSvg.y - 4}
          className="geom-label"
        >
          Full fine-tune W&apos;
        </text>

        {/* rank-1 line */}
        <line
          x1={CX - (dir1Svg.x - CX)}
          y1={CY - (dir1Svg.y - CY)}
          x2={dir1Svg.x}
          y2={dir1Svg.y}
          stroke={MATH_COLORS.secondary}
          strokeWidth={2}
          strokeDasharray="4 3"
        />
        <text
          x={dir1Svg.x - 80}
          y={dir1Svg.y + 16}
          className="geom-label"
        >
          Rank-1 subspace (line)
        </text>

        {/* rank-1 LoRA projection */}
        <circle
          cx={proj1Svg.x}
          cy={proj1Svg.y}
          r={4}
          fill={MATH_COLORS.secondary}
        />
        <text
          x={proj1Svg.x + 6}
          y={proj1Svg.y - 6}
          className="geom-label"
        >
          LoRA solution (r = 1)
        </text>

        {/* rank-2+ LoRA region */}
        {showRank2 && (
          <>
            <polygon
              points={[
                toSvg([-1.6, -1.6]),
                toSvg([1.6, -1.6]),
                toSvg([1.6, 1.6]),
                toSvg([-1.6, 1.6]),
              ]
                .map((p) => `${p.x},${p.y}`)
                .join(' ')}
              fill={MATH_COLORS.secondary}
              fillOpacity={0.04}
            />
            <line
              x1={originSvg.x}
              y1={originSvg.y}
              x2={dir2Svg.x}
              y2={dir2Svg.y}
              stroke={MATH_COLORS.secondary}
              strokeWidth={1.5}
              strokeDasharray="3 2"
            />
            <text
              x={dir2Svg.x + 6}
              y={dir2Svg.y}
              className="geom-label"
            >
              2nd LoRA direction
            </text>
          </>
        )}
      </svg>
      <p className="caption">
        Full fine-tuning can move anywhere in weight space. Rank-1 LoRA moves
        along a single line; rank-2 and higher span a low-dimensional plane
        inside the huge space of all possible weight updates.
      </p>
    </div>
  )
}

// --- Layer-wise LoRA configuration ------------------------------------------

type LayerType = 'embed' | 'attn' | 'mlp' | 'head'

// --- Gamification types and data ---------------------------------------------

type GamePhase = 'setup' | 'countdown' | 'revealed'
type RankPrediction = 'tiny' | 'standard' | 'powerful' | null

interface RankChallenge {
  name: string
  targetError: number      // Target relative error threshold
  answer: Exclude<RankPrediction, null>
  description: string
}

const RANK_CHALLENGES: RankChallenge[] = [
  { name: '🎲 Style Transfer', targetError: 0.5, answer: 'tiny', description: 'Light adaptation for artistic style - how much rank do you need?' },
  { name: '🎲 Code Generation', targetError: 0.25, answer: 'standard', description: 'Adapting for code requires capturing more structure...' },
  { name: '🎲 Math Reasoning', targetError: 0.15, answer: 'powerful', description: 'Complex reasoning tasks need more capacity...' },
  { name: '🎲 Multilingual', targetError: 0.2, answer: 'standard', description: 'Cross-language adaptation - what\'s the sweet spot?' },
  { name: '🎲 Domain Expert', targetError: 0.1, answer: 'powerful', description: 'Specialized expertise requires near-full coverage...' },
]

const getRankFeedback = (prediction: RankPrediction, challenge: RankChallenge): string => {
  const correct = prediction === challenge.answer
  const targetPct = (challenge.targetError * 100).toFixed(0)

  if (correct) {
    if (challenge.answer === 'tiny') {
      return `💡 Correct! For ${targetPct}% error threshold, rank 2-4 suffices. Style/tone changes live in a very low-dimensional subspace of weight space - LoRA's biggest efficiency win!`
    }
    if (challenge.answer === 'standard') {
      return `💡 Correct! ${targetPct}% error needs rank 8-16. This is the "production sweet spot" - enough capacity to capture task-specific patterns while keeping parameters under 1% of full fine-tuning.`
    }
    return `💡 Correct! Achieving ${targetPct}% error requires rank 32+. Complex reasoning/expertise tasks need updates that span more directions in weight space. Still much cheaper than full fine-tuning!`
  }

  // Incorrect predictions with educational feedback
  if (prediction === 'tiny' && challenge.answer !== 'tiny') {
    return `📊 Too conservative! Rank 2-4 can't capture enough variation for ${targetPct}% error. This task needs more expressivity in the low-rank update.`
  }
  if (prediction === 'powerful' && challenge.answer !== 'powerful') {
    return `⚠️ Overestimated! You don't need rank 32+ for ${targetPct}% error. The task-specific change fits in a smaller subspace - using higher rank wastes parameters.`
  }
  return `🔄 Close! The actual requirement differs. Remember: simpler adaptations (style) need less rank than complex ones (reasoning).`
}

const LORA_LAYERS: { id: string; label: string; type: LayerType }[] = [
  { id: 'embed', label: 'Token embed', type: 'embed' },
  { id: 'attn1', label: 'Attention 1', type: 'attn' },
  { id: 'mlp1', label: 'MLP 1', type: 'mlp' },
  { id: 'attn2', label: 'Attention 2', type: 'attn' },
  { id: 'mlp2', label: 'MLP 2', type: 'mlp' },
  { id: 'head', label: 'Output head', type: 'head' },
]

// Fun rank presets
const LORA_PRESETS = [
  { name: '🐣 Tiny', rank: 2, lr: 0.04, description: 'Minimal adaptation, maximum efficiency' },
  { name: '📦 Standard', rank: 8, lr: 0.05, description: 'Common production configuration' },
  { name: '💪 Powerful', rank: 32, lr: 0.03, description: 'More capacity, near full performance' },
  { name: '🚀 Maximum', rank: 64, lr: 0.02, description: 'Almost full fine-tuning quality' },
]

// Educational insight based on current config
const getLoRAInsight = (rank: number, relError: number, savingsFraction: number): string => {
  if (rank <= 4) {
    if (relError < 0.3) return '🎯 Great! Low rank with good approximation - this is the LoRA sweet spot!'
    return '📊 Low rank = huge savings, but may need more training steps to converge.'
  }
  if (rank <= 16) {
    if (relError < 0.2) return '✅ Solid configuration! Good balance of capacity and efficiency.'
    return '🔄 Standard LoRA range. Keep training to reduce error.'
  }
  if (rank <= 32) {
    return '💡 Higher rank captures more nuance. Approaching full fine-tuning quality.'
  }
  if (savingsFraction < 0.5) {
    return '⚠️ Very high rank - almost as expensive as full fine-tuning. Consider lower rank.'
  }
  return '🔥 Maximum capacity! Near-perfect approximation but reduced efficiency benefits.'
}

// --- Main component ----------------------------------------------------------

export default function LoRADemo() {
  const [rank, setRank] = useState(8)
  const [lr, setLr] = useState(0.05)
  const [steps, setSteps] = useState(0)

  const [alpha, setAlpha] = useState(1)
  const [beta, setBeta] = useState(0)

  // Gamification state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<RankChallenge | null>(null)
  const [prediction, setPrediction] = useState<RankPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)

  const [layerState, setLayerState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {}
    for (const layer of LORA_LAYERS) {
      // Common pattern: LoRA on attention layers only
      initial[layer.id] = layer.type === 'attn'
    }
    return initial
  })

  // Base matrix and a "full fine-tuning" target update ΔW*
  const [baseW] = useState<Matrix>(() => createRandomMatrix(VIS_D, VIS_D, 0.4))
  const [targetDelta] = useState<Matrix>(() =>
    createRandomMatrix(VIS_D, VIS_D, 0.6)
  )

  // Task-specific LoRA updates (for task arithmetic)
  const [deltaTaskA] = useState<Matrix>(() =>
    createRandomMatrix(VIS_D, VIS_D, 0.5)
  )
  const [deltaTaskB] = useState<Matrix>(() =>
    createRandomMatrix(VIS_D, VIS_D, 0.5)
  )

  // LoRA factors B and A; B starts at 0, A is small Gaussian
  const [B, setB] = useState<Matrix>(() =>
    createZeroMatrix(VIS_D, rank)
  )
  const [A, setA] = useState<Matrix>(() =>
    createRandomMatrix(rank, VIS_D, 0.1)
  )

  // When rank changes, re-initialize B and A per LoRA recipe
  useEffect(() => {
    setB(createZeroMatrix(VIS_D, rank))
    setA(createRandomMatrix(rank, VIS_D, 0.1))
    setSteps(0)
  }, [rank])

  // Core LoRA update and reconstruction error against target ΔW*
  const loraStats = useMemo(() => {
    const deltaLoRA = matmul(B, A)
    const wPrime = addMatrices(baseW, deltaLoRA)
    const wFull = addMatrices(baseW, targetDelta)
    const errMat = subMatrices(targetDelta, deltaLoRA)
    const errNorm = frobeniusNorm(errMat)
    const targetNorm = frobeniusNorm(targetDelta) || 1
    const relError = errNorm / targetNorm
    return { deltaLoRA, wPrime, wFull, errNorm, relError }
  }, [B, A, baseW, targetDelta])

  // Task arithmetic: combine two LoRAs with weights α, β
  const taskMetrics = useMemo(() => {
    const combined = addMatrices(
      scaleMatrix(deltaTaskA, alpha),
      scaleMatrix(deltaTaskB, beta)
    )
    const distA = frobeniusNorm(subMatrices(combined, deltaTaskA))
    const distB = frobeniusNorm(subMatrices(combined, deltaTaskB))
    const normA = frobeniusNorm(deltaTaskA) || 1
    const normB = frobeniusNorm(deltaTaskB) || 1

    const scoreA = Math.exp(-0.5 * (distA / normA) ** 2)
    const scoreB = Math.exp(-0.5 * (distB / normB) ** 2)
    const blended = 0.5 * (scoreA + scoreB)

    return {
      combined,
      scoreA,
      scoreB,
      blended,
    }
  }, [alpha, beta, deltaTaskA, deltaTaskB])

  // Layer-wise efficiency metrics
  const activeLayers = LORA_LAYERS.filter((l) => layerState[l.id])
  const numLayersActive = activeLayers.length
  const totalLayers = LORA_LAYERS.length
  const perLayerFull = BASE_MODEL_DIM * BASE_MODEL_DIM
  const perLayerLoRA = 2 * BASE_MODEL_DIM * rank

  const fullParams = numLayersActive * perLayerFull
  const loraParams = numLayersActive * perLayerLoRA
  const savingsFraction =
    fullParams > 0 ? 1 - loraParams / fullParams : 0

  const trainedFractionAllWeights =
    totalLayers > 0 ? loraParams / (totalLayers * perLayerFull) : 0

  const BYTES_PER_PARAM_FP16 = 2
  const fullMemMB =
    (fullParams * BYTES_PER_PARAM_FP16) / (1024 * 1024)
  const loraMemMB =
    (loraParams * BYTES_PER_PARAM_FP16) / (1024 * 1024)

  const relativeStepTime =
    fullParams > 0 ? loraParams / fullParams : 0

  const perfEstimate = (() => {
    // Toy performance estimate: depends on rank, layer coverage and reconstruction error
    const rankFactor = Math.min(rank / 16, 1)
    const coverage = numLayersActive / Math.max(totalLayers, 1)
    const errorFactor = Math.max(0, 1 - loraStats.relError)
    let p = 0.6 + 0.25 * rankFactor + 0.1 * coverage + 0.05 * errorFactor
    if (p > 1) p = 1
    if (p < 0) p = 0
    return p
  })()

  const trainStep = () => {
    if (!B.length || !A.length) return
    const currentDelta = matmul(B, A)
    const error = subMatrices(currentDelta, targetDelta) // BA - ΔW*
    const gradB = matmul(error, transpose(A))
    const gradA = matmul(transpose(B), error)

    const newB = addMatrices(B, scaleMatrix(gradB, -lr))
    const newA = addMatrices(A, scaleMatrix(gradA, -lr))

    setB(newB)
    setA(newA)
    setSteps((s) => s + 1)
  }

  const resetTraining = () => {
    setB(createZeroMatrix(VIS_D, rank))
    setA(createRandomMatrix(rank, VIS_D, 0.1))
    setSteps(0)
  }

  // Game control functions
  const startChallenge = (challenge: RankChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
  }

  const submitPrediction = (pred: RankPrediction) => {
    setPrediction(pred)
    setCountdown(3)
    setGamePhase('countdown')
  }

  const _resetGame = () => {
    setGameMode(false)
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setGamePhase('revealed')
        // Apply the challenge's rank setting
        if (selectedChallenge) {
          const answerRank = selectedChallenge.answer === 'tiny' ? 4 : selectedChallenge.answer === 'standard' ? 16 : 32
          setRank(answerRank)
          // Update score
          if (prediction === selectedChallenge.answer) {
            setScore(s => s + 1)
          }
        }
      } else {
        setCountdown(c => c - 1)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, selectedChallenge, prediction])

  const toggleLayer = (id: string) => {
    setLayerState((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const relErrorPct = (loraStats.relError * 100).toFixed(1)
  const savingsPct = (savingsFraction * 100).toFixed(1)
  const trainedPct = (trainedFractionAllWeights * 100).toFixed(2)
  const perfPct = (perfEstimate * 100).toFixed(1)

  const scoreAPct = (taskMetrics.scoreA * 100).toFixed(1)
  const scoreBPct = (taskMetrics.scoreB * 100).toFixed(1)
  const blendedPct = (taskMetrics.blended * 100).toFixed(1)

  return (
    <section className="card interactive-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>LoRA: Low-Rank Adaptation Playground</h2>
        <button
          onClick={() => setGameMode(!gameMode)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: gameMode ? '2px solid #f59e0b' : '1px solid #374151',
            background: gameMode ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.5)',
            color: gameMode ? '#f59e0b' : '#9ca3af',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {gameMode ? '🎯 Challenge Mode' : '🎮 Try Challenge'}
          {gameMode && score > 0 && <span style={{ marginLeft: '8px' }}>Score: {score}</span>}
        </button>
      </div>
      <p className="muted">
        Instead of updating an entire weight matrix W, LoRA learns a low-rank
        update ΔW = BA. Only A and B are trained, dramatically shrinking the
        number of trainable parameters.
      </p>

      {/* Game Challenge Panel */}
      {gameMode && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(139, 92, 246, 0.05))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#f59e0b' }}>
            💡 Rank Prediction Challenge
          </div>

          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '14px', marginBottom: '12px', color: '#9ca3af' }}>
                Given a task adaptation goal and target error threshold, predict how much LoRA rank is needed!
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {RANK_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #374151',
                      background: 'rgba(31, 41, 55, 0.5)',
                      color: '#d1d5db',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                    title={challenge.description}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px', color: '#e5e7eb' }}>
                {selectedChallenge.name}
              </div>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>
                {selectedChallenge.description}
              </p>
              <p style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '12px' }}>
                Target: achieve &lt;{(selectedChallenge.targetError * 100).toFixed(0)}% relative error
              </p>
              <p style={{ fontSize: '13px', marginBottom: '8px', color: '#9ca3af' }}>
                What LoRA rank is needed?
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => submitPrediction('tiny')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  🐣 Tiny (r=2-4)
                </button>
                <button
                  onClick={() => submitPrediction('standard')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  📦 Standard (r=8-16)
                </button>
                <button
                  onClick={() => submitPrediction('powerful')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  💪 Powerful (r=32+)
                </button>
              </div>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: '#f59e0b' }}>{countdown}</div>
              <p style={{ color: '#9ca3af' }}>Applying LoRA configuration...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '6px',
              background: prediction === selectedChallenge.answer
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              border: `1px solid ${prediction === selectedChallenge.answer ? '#22c55e' : '#ef4444'}40`,
            }}>
              <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                {getRankFeedback(prediction, selectedChallenge)}
              </p>
              <button
                onClick={() => {
                  setSelectedChallenge(null)
                  setGamePhase('setup')
                  setPrediction(null)
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #374151',
                  background: 'rgba(31, 41, 55, 0.5)',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Try Another
              </button>
            </div>
          )}
        </div>
      )}

      {/* Rank Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {LORA_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              setRank(preset.rank)
              setLr(preset.lr)
            }}
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              border: rank === preset.rank ? '2px solid #f59e0b' : '1px solid #374151',
              background: rank === preset.rank
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: rank === preset.rank ? '#f59e0b' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: rank === preset.rank ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Global controls */}
      <div className="lora-controls-row">
        <label className="slider-label">
          Rank r ({rank})
          <input
            type="range"
            min={1}
            max={MAX_RANK}
            step={1}
            value={rank}
            onChange={(e) => setRank(parseInt(e.target.value, 10))}
          />
        </label>
        <label className="slider-label">
          LoRA learning rate ({lr.toFixed(3)})
          <input
            type="range"
            min={0.002}
            max={0.2}
            step={0.002}
            value={lr}
            onChange={(e) => setLr(parseFloat(e.target.value))}
          />
        </label>
        <div className="lora-train-buttons">
          <button onClick={trainStep}>Train step</button>
          <button onClick={resetTraining} className="ghost">
            Reset LoRA
          </button>
        </div>
        <div className="lora-train-stats">
          <span className="label">Steps:</span> {steps}
          <span className="label">Rel. error:</span> {relErrorPct}%
        </div>
      </div>

      {/* Educational Insight */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: loraStats.relError < 0.3
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
          : loraStats.relError < 0.6
            ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
        border: `1px solid ${loraStats.relError < 0.3 ? '#22c55e' : loraStats.relError < 0.6 ? '#f59e0b' : '#ef4444'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getLoRAInsight(rank, loraStats.relError, savingsFraction)}
      </div>

      {/* Matrix decomposition row */}
      <div className="lora-matrices-grid">
        <MatrixHeatmap
          matrix={baseW}
          title="Base weights W"
          subtitle={`${VIS_D} × ${VIS_D}`}
        />
        <MatrixHeatmap
          matrix={B}
          title="LoRA B"
          subtitle={`${VIS_D} × r`}
          compact
        />
        <MatrixHeatmap
          matrix={A}
          title="LoRA A"
          subtitle={`r × ${VIS_D}`}
          compact
        />
        <MatrixHeatmap
          matrix={loraStats.deltaLoRA}
          title="LoRA update ΔW = BA"
          subtitle="low rank"
        />
        <MatrixHeatmap
          matrix={targetDelta}
          title="Full update ΔW*"
          subtitle="reference"
        />
        <MatrixHeatmap
          matrix={loraStats.wPrime}
          title="Updated W' = W + BA"
          subtitle="current LoRA"
        />
      </div>

      {/* Geometric + layer-wise panel */}
      <div className="lora-secondary-row">
        <GeometricView rank={rank} />
        <div className="lora-layers-panel">
          <h3 className="subheading">Layer-wise LoRA</h3>
          <p className="muted">
            Toggle LoRA on different transformer blocks. In practice, many
            setups only adapt attention layers and still get strong performance.
          </p>
          <div className="lora-layer-strip">
            {LORA_LAYERS.map((layer) => {
              const active = layerState[layer.id]
              const typeClass = `type-${layer.type}`
              return (
                <button
                  key={layer.id}
                  className={`lora-layer ${typeClass} ${
                    active ? 'active' : 'inactive'
                  }`}
                  onClick={() => toggleLayer(layer.id)}
                  aria-pressed={active}
                >
                  <span className="layer-label">{layer.label}</span>
                  <span className="layer-pill">
                    {active ? 'LoRA on' : 'LoRA off'}
                  </span>
                </button>
              )
            })}
          </div>
          <div className="lora-efficiency">
            <div>
              <span className="label">LoRA params:</span>{' '}
              {loraParams.toLocaleString()}
            </div>
            <div>
              <span className="label">Full fine-tuning params:</span>{' '}
              {fullParams.toLocaleString()}
            </div>
            <div>
              <span className="label">Savings vs full FT:</span> {savingsPct}%
            </div>
            <div>
              <span className="label">Share of all weights trained:</span>{' '}
              {trainedPct}%
            </div>
            <div>
              <span className="label">Approx. memory (fp16):</span>{' '}
              {loraMemMB.toFixed(1)} MB vs {fullMemMB.toFixed(1)} MB
            </div>
            <div>
              <span className="label">Relative step cost:</span>{' '}
              {(relativeStepTime * 100).toFixed(2)}% of full fine-tuning
            </div>
            <div>
              <span className="label">Toy perf vs full FT:</span> ~{perfPct}%
            </div>
          </div>
          <p className="caption">
            LoRA keeps the giant base model frozen and only trains small BA
            adapters in chosen layers. With r ≪ d and only a subset of layers
            adapted, trainable parameters can drop below 1% of full
            fine-tuning.
          </p>
        </div>
      </div>

      {/* Task arithmetic panel */}
      <div className="lora-task-panel">
        <h3 className="subheading">Task arithmetic with LoRAs</h3>
        <p className="muted">
          Imagine one LoRA is trained for task A (e.g. code), another for task B
          (e.g. poetry). You can mix them by adding their low-rank updates:
          W&apos; = W + α·ΔW<span className="subscript">A</span> + β·ΔW
          <span className="subscript">B</span>.
        </p>
        <div className="lora-task-controls">
          <label className="slider-label">
            α (task A weight) {alpha.toFixed(1)}
            <input
              type="range"
              min={-1.5}
              max={1.5}
              step={0.1}
              value={alpha}
              onChange={(e) => setAlpha(parseFloat(e.target.value))}
            />
          </label>
          <label className="slider-label">
            β (task B weight) {beta.toFixed(1)}
            <input
              type="range"
              min={-1.5}
              max={1.5}
              step={0.1}
              value={beta}
              onChange={(e) => setBeta(parseFloat(e.target.value))}
            />
          </label>
        </div>
        <div className="lora-task-metrics">
          <div>
            <span className="label">Score on task A:</span> {scoreAPct}%
          </div>
          <div>
            <span className="label">Score on task B:</span> {scoreBPct}%
          </div>
          <div>
            <span className="label">Blended capability:</span> {blendedPct}%
          </div>
        </div>
        <p className="caption">
          Because LoRAs live in a low-dimensional subspace of weight space, they
          compose nicely: you can swap, share, and linearly mix task adapters
          without ever touching the huge base model.
        </p>
      </div>

      <p className="caption">
        The big picture: most task-specific change lives in a low-rank slice of
        weight space. LoRA parameterizes that slice with BA, letting you train
        massive models on modest hardware while keeping multiple task adapters
        around as cheap, swappable add-ons.
      </p>
    </section>
  )
}
