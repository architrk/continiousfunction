import { useEffect, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../lib/demoState'
import { MATH_COLORS, softmax, matmul } from '../../lib/mathObjects'

const GEOM_WIDTH = 320
const GEOM_HEIGHT = 260
const GEOM_CENTER_X = GEOM_WIDTH / 2
const GEOM_CENTER_Y = GEOM_HEIGHT / 2

const MATRIX_WIDTH = 320
const MATRIX_HEIGHT = 260
const MATRIX_PADDING = 40

type Vec2 = [number, number]

type AttentionGeometryDemoProps = {
  conceptId?: string
}

export const TOP_KEY_TOLERANCE = 1e-6

const D_K = 2
const BASE_SCALE = Math.sqrt(D_K)

// Fun temperature presets
const TEMPERATURE_PRESETS = [
  { name: '🎯 Sharp Focus', value: 0.3, description: 'Nearly one-hot attention' },
  { name: '📚 Standard', value: BASE_SCALE, description: 'Typical √d_k scaling' },
  { name: '🌡️ Warm', value: 2.5, description: 'Softer, more distributed' },
  { name: '♨️ Hot', value: 5.0, description: 'Almost uniform attention' },
]

// Educational insight based on temperature
const getTemperatureInsight = (temp: number): string => {
  const ratio = temp / BASE_SCALE
  if (ratio < 0.5) return '🎯 Low temperature → attention becomes sharp, nearly one-hot. The query strongly commits to its best matching key.'
  if (ratio < 1.2) return '📚 Standard √d_k scaling → balanced attention. Common choice in transformers to prevent dot products from exploding.'
  if (ratio < 2.0) return '🌡️ Higher temperature → softer attention. Information from multiple keys blends more evenly into the output.'
  return '♨️ Very high temperature → nearly uniform attention. Every key contributes equally, losing selectivity.'
}

// --- Helpers ---

function transposeMatrix(m: number[][]): number[][] {
  if (m.length === 0) return []
  const rows = m.length
  const cols = m[0].length
  const result: number[][] = []
  for (let j = 0; j < cols; j++) {
    const col: number[] = []
    for (let i = 0; i < rows; i++) {
      col.push(m[i][j])
    }
    result.push(col)
  }
  return result
}

function _vecAdd(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]]
}

function _vecScale(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s]
}

function maxExtent(vectors: Vec2[]): number {
  if (vectors.length === 0) return 1
  let maxVal = 0.0001
  for (const [x, y] of vectors) {
    const m = Math.max(Math.abs(x), Math.abs(y))
    if (m > maxVal) maxVal = m
  }
  return maxVal
}

function weightedSum(weights: number[], vectors: Vec2[]): Vec2 {
  const acc: Vec2 = [0, 0]
  for (let i = 0; i < weights.length; i++) {
    acc[0] += weights[i] * vectors[i][0]
    acc[1] += weights[i] * vectors[i][1]
  }
  return acc
}

export function getTopKeyWinners(
  weights: number[],
  tolerance = TOP_KEY_TOLERANCE
): number[] {
  if (weights.length === 0) return []
  const maxWeight = Math.max(...weights)
  return weights
    .map((weight, index) => ({ weight, index }))
    .filter(({ weight }) => Math.abs(weight - maxWeight) <= tolerance)
    .map(({ index }) => index)
}

// --- Toy sequence + projection matrices ---
// 4 tokens in a 2D embedding space
const TOKENS: { id: number; label: string; short: string; embed: Vec2 }[] = [
  { id: 0, label: 'Token 1', short: 't₁', embed: [-1.0, 0.2] },
  { id: 1, label: 'Token 2', short: 't₂', embed: [-0.2, 0.9] },
  { id: 2, label: 'Token 3', short: 't₃', embed: [0.8, 0.4] },
  { id: 3, label: 'Token 4', short: 't₄', embed: [1.4, 1.1] },
]

// X is sequence of embeddings
const X_MATRIX: number[][] = TOKENS.map((t) => t.embed)

// One attention head: fixed Q, K, V projections
// (in a real model these would be learned)
const W_Q: number[][] = [
  [1.0, 0.4],
  [0.0, 0.8],
]
const W_K: number[][] = [
  [0.7, -0.3],
  [0.4, 1.0],
]
const W_V: number[][] = [
  [0.9, 0.0],
  [0.0, 0.6],
]

// Precompute Q, K, V and raw (unscaled) score matrix QK^T
const Q_VECTORS = matmul(X_MATRIX, W_Q) as Vec2[]
const K_VECTORS = matmul(X_MATRIX, W_K) as Vec2[]
const V_VECTORS = matmul(X_MATRIX, W_V) as Vec2[]
const RAW_SCORES: number[][] = matmul(
  Q_VECTORS as number[][],
  transposeMatrix(K_VECTORS as number[][])
)

function scaleScores(scores: number[][], divisor: number): number[][] {
  return scores.map((row) => row.map((v) => v / divisor))
}

export default function AttentionGeometryDemo({ conceptId = 'attention-transformers' }: AttentionGeometryDemoProps) {
  // Temperature / scaling factor for logits
  const [temperature, setTemperature] = useState(BASE_SCALE)
  // Toggle between raw scores and softmax weights
  const [viewMode, setViewMode] = useState<'scores' | 'weights'>('weights')
  // Focus on a single query row at a time
  const [activeTokenIndex, setActiveTokenIndex] = useState(0)

  // Local prediction gate: learners commit to a top key before seeing the row.
  const [prediction, setPrediction] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const scaledScores = scaleScores(RAW_SCORES, temperature)

  const attentionWeights: number[][] = scaledScores.map((row) => softmax(row))

  const outputs: Vec2[] = attentionWeights.map((row) =>
    weightedSum(row, V_VECTORS)
  )

  const allGeomVectors: Vec2[] = [
    ...TOKENS.map((t) => t.embed),
    ...Q_VECTORS,
    ...K_VECTORS,
  ]
  const geomExtent = maxExtent(allGeomVectors)
  const geomScale =
    (Math.min(GEOM_WIDTH, GEOM_HEIGHT) / 2 - 30) / (geomExtent || 1)

  const allValueVectors: Vec2[] = [...V_VECTORS, ...outputs]
  const valueExtent = maxExtent(allValueVectors)
  const valueScale =
    (Math.min(GEOM_WIDTH, GEOM_HEIGHT) / 2 - 30) / (valueExtent || 1)

  const activeWeights = attentionWeights[activeTokenIndex]
  const activeScoreRow = scaledScores[activeTokenIndex]
  const activeOutput = outputs[activeTokenIndex]

  // Find the key with maximum attention for current query
  const topKeyWinnerIndices = getTopKeyWinners(activeWeights)
  const maxAttentionKeyIndex = topKeyWinnerIndices[0] ?? 0

  // Compute entropy of attention distribution (Oracle suggestion: entropy gauge!)
  const entropy = -activeWeights.reduce((sum, p) => {
    if (p > 0.0001) return sum + p * Math.log2(p)
    return sum
  }, 0)
  const maxEntropy = Math.log2(TOKENS.length) // uniform distribution
  const entropyRatio = entropy / maxEntropy // 0 = one-hot, 1 = uniform

  // Effective number of tokens attended (exp(entropy))
  const effectiveTokens = Math.pow(2, entropy)

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
    clearDemoState(conceptId)
  }

  const choosePrediction = (keyIndex: number) => {
    setPrediction(keyIndex)
    if (revealed) {
      setRevealed(false)
      clearDemoState(conceptId)
    }
  }

  const revealDistribution = () => {
    if (prediction === null) return
    setRevealed(true)
  }

  const changeTemperature = (nextTemperature: number) => {
    setTemperature(nextTemperature)
    resetReveal()
  }

  const changeActiveToken = (nextIndex: number) => {
    setActiveTokenIndex(nextIndex)
    resetReveal()
  }

  const changeViewMode = (nextViewMode: 'scores' | 'weights') => {
    setViewMode(nextViewMode)
    resetReveal()
  }

  const focusToken = TOKENS[activeTokenIndex]

  const matrixSize = TOKENS.length
  const cellSize = (MATRIX_WIDTH - MATRIX_PADDING - 20) / matrixSize

  const isScoresView = viewMode === 'scores'

  // Precompute stats for score heatmap
  let maxPositive = 0
  let minNegative = 0
  if (isScoresView) {
    for (const row of scaledScores) {
      for (const v of row) {
        if (v > maxPositive) maxPositive = v
        if (v < minNegative) minNegative = v
      }
    }
  }

  const rowsSum = attentionWeights.map((row) =>
    row.reduce((s, v) => s + v, 0)
  )

  const temperatureRatio = temperature / BASE_SCALE
  const topToken = TOKENS[maxAttentionKeyIndex]
  const topWeight = activeWeights[maxAttentionKeyIndex] ?? 0
  const predictionCorrect =
    prediction !== null && topKeyWinnerIndices.includes(prediction)
  const predictedToken = prediction === null ? null : TOKENS[prediction]
  const tiedTopKeyCopy = topKeyWinnerIndices
    .map((index) => `K(${TOKENS[index].short})`)
    .join(', ')
  const geometryEvidenceSteps = [
    {
      step: '01',
      label: 'Predict',
      detail:
        predictedToken === null
          ? `Choose a key for query ${focusToken.short}.`
          : `Committed to K(${predictedToken.short}).`,
    },
    {
      step: '02',
      label: 'Observe',
      detail: revealed
        ? `${tiedTopKeyCopy} at ${(topWeight * 100).toFixed(1)}% top weight.`
        : 'The attention row stays locked until reveal.',
    },
    {
      step: '03',
      label: 'Ground',
      detail: revealed
        ? `Dot products became a softmax row with ${entropy.toFixed(2)} bits entropy.`
        : `Compare Q(${focusToken.short}) against the K directions.`,
    },
    {
      step: '04',
      label: 'Carry',
      detail: revealed
        ? predictionCorrect
          ? 'Matched. Save the row state for the next question.'
          : `Compare your answer with ${tiedTopKeyCopy}.`
        : 'Carry the row, entropy, and output vector after reveal.',
    },
  ]
  const geometryActiveEvidenceIndex = revealed ? 3 : 0

  useEffect(() => {
    return () => clearDemoState(conceptId)
  }, [conceptId])

  useEffect(() => {
    if (!revealed || prediction === null || predictedToken === null) return

    emitDemoState({
      conceptId,
      label: 'Prediction-first attention top-key reveal',
      summary: `Predicted K(${predictedToken.short}); actual top key K(${topToken.short}); query ${focusToken.short}, T=${temperature.toFixed(2)}, top weight ${(topWeight * 100).toFixed(1)}%, entropy ${entropy.toFixed(2)} bits.`,
      values: [
        `prediction: ${predictedToken.short}`,
        `actual top key: ${topToken.short}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `active query: ${focusToken.short}`,
        `temperature T: ${temperature.toFixed(2)} (${temperatureRatio.toFixed(2)}x sqrt(d_k))`,
        `view mode: ${viewMode}`,
        `score row: [${activeScoreRow.map((value) => value.toFixed(2)).join(', ')}]`,
        `attention row: [${activeWeights.map((value) => value.toFixed(3)).join(', ')}]`,
        `top attention weight: ${(topWeight * 100).toFixed(1)}%`,
        `attention entropy: ${entropy.toFixed(3)} bits`,
        `effective attended tokens: ${effectiveTokens.toFixed(2)}`,
        `output vector: [${activeOutput[0].toFixed(3)}, ${activeOutput[1].toFixed(3)}]`,
        `row probability sum: ${(rowsSum[activeTokenIndex] ?? 0).toFixed(4)}`,
        `top-key winners: ${tiedTopKeyCopy}`,
        'visible attention distribution: revealed',
        'evidence loop: predict -> observe -> ground -> carry',
      ],
    })
  }, [
    activeScoreRow,
    activeWeights,
    activeOutput,
    activeTokenIndex,
    conceptId,
    effectiveTokens,
    entropy,
    focusToken.short,
    prediction,
    predictedToken,
    predictionCorrect,
    revealed,
    rowsSum,
    temperature,
    temperatureRatio,
    topToken.short,
    topWeight,
    tiedTopKeyCopy,
    viewMode,
  ])

  const toGeomSvg = ([x, y]: Vec2): { x: number; y: number } => ({
    x: GEOM_CENTER_X + x * geomScale,
    y: GEOM_CENTER_Y - y * geomScale,
  })

  const toValueSvg = ([x, y]: Vec2): { x: number; y: number } => ({
    x: GEOM_CENTER_X + x * valueScale,
    y: GEOM_CENTER_Y - y * valueScale,
  })

  return (
    <section className="card interactive-card">
      <h2>Attention as Geometry: Scaled Dot-Product Intuition</h2>
      <p className="muted">
        Move the sliders and toggles to see how query (Q) and key (K) directions
        turn into attention weights over values (V). Think of it as a soft
        dictionary lookup: each query softly chooses which tokens to copy from.
      </p>

      {/* Local prediction gate */}
      <div
        data-child-demo-gate="attention-top-key"
        style={{
          padding: '0.85rem',
          marginBottom: '1rem',
          borderRadius: '8px',
          background: '#fffaf0',
          border: revealed ? '1px solid #f59e0b' : '1px solid #d6c7ad',
          boxShadow: '0 16px 34px rgba(15, 23, 42, 0.08)',
        }}
      >
        <div style={{ display: 'grid', gap: '0.35rem', marginBottom: '0.75rem' }}>
          <span
            style={{
              color: '#0f766e',
              fontSize: '0.72rem',
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            child prediction checkpoint
          </span>
          <strong style={{ color: '#111827', lineHeight: 1.25 }}>
            Which key receives the highest attention weight for query {focusToken.short}?
          </strong>
          <p style={{ margin: 0, color: '#475569', lineHeight: 1.45 }}>
            Commit before the row is revealed, then use the live geometry to explain why that key wins.
          </p>
        </div>

        <div
          role="group"
          aria-label="Attention top-key prediction"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(92px, 1fr))',
            gap: '0.5rem',
            marginBottom: '0.75rem',
          }}
        >
          {TOKENS.map((t, i) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={prediction === i}
              onClick={() => choosePrediction(i)}
              style={{
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                minHeight: '2.7rem',
                border: prediction === i
                  ? '1px solid #2563eb'
                  : revealed && topKeyWinnerIndices.includes(i)
                  ? '1px solid #10b981'
                  : '1px solid #d1d5db',
                background: prediction === i
                  ? '#dbeafe'
                  : revealed && topKeyWinnerIndices.includes(i)
                  ? '#d1fae5'
                  : '#f8fafc',
                cursor: 'pointer',
                opacity: revealed && prediction !== i && !topKeyWinnerIndices.includes(i) ? 0.55 : 1,
                fontWeight: prediction === i || (revealed && topKeyWinnerIndices.includes(i)) ? 800 : 700,
                color: prediction === i ? '#1d4ed8' : '#1f2937',
                overflowWrap: 'anywhere',
              }}
            >
              K({t.short}) {revealed && topKeyWinnerIndices.includes(i) ? 'match' : ''}
            </button>
          ))}
        </div>

        <div
          aria-label="Attention geometry evidence loop"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '0.5rem',
            padding: '0.55rem',
            marginBottom: '0.75rem',
            borderRadius: '8px',
            border: '1px solid rgba(148, 163, 184, 0.2)',
            background:
              'linear-gradient(rgba(148, 163, 184, 0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148, 163, 184, 0.045) 1px, transparent 1px), #0f172a',
            backgroundSize: '22px 22px',
          }}
        >
          {geometryEvidenceSteps.map((step, index) => (
            <article
              key={step.step}
              style={{
                display: 'grid',
                alignContent: 'start',
                gap: '0.2rem',
                minHeight: '6.8rem',
                padding: '0.6rem',
                borderRadius: '8px',
                border:
                  index === geometryActiveEvidenceIndex
                    ? '1px solid rgba(96, 165, 250, 0.76)'
                    : '1px solid rgba(148, 163, 184, 0.18)',
                background:
                  index === geometryActiveEvidenceIndex
                    ? 'rgba(37, 99, 235, 0.24)'
                    : 'rgba(15, 23, 42, 0.86)',
              }}
            >
              <span
                style={{
                  color: '#93c5fd',
                  fontSize: '0.68rem',
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                }}
              >
                {step.step}
              </span>
              <strong style={{ color: '#f8fafc', lineHeight: 1.18 }}>{step.label}</strong>
              <p style={{ margin: 0, color: '#cbd5e1', fontSize: '0.78rem', lineHeight: 1.35 }}>
                {step.detail}
              </p>
            </article>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            onClick={revealDistribution}
            disabled={prediction === null || revealed}
            style={{
              padding: '0.5rem 1.25rem',
              borderRadius: '8px',
              border: '1px solid rgba(180, 83, 9, 0.5)',
              background: prediction !== null && !revealed
                ? 'linear-gradient(135deg, #fde68a 0%, #f59e0b 100%)'
                : '#d1d5db',
              color: prediction !== null && !revealed ? '#1f2937' : '#6b7280',
              fontWeight: 800,
              cursor: prediction !== null && !revealed ? 'pointer' : 'not-allowed',
            }}
          >
            Reveal attention distribution
          </button>

          {revealed && predictedToken && (
            <div
              style={{
                display: 'grid',
                gap: '0.2rem',
                flex: '1 1 280px',
                padding: '0.6rem 0.75rem',
                borderRadius: '8px',
                border: predictionCorrect ? '1px solid #10b981' : '1px solid #f59e0b',
                background: predictionCorrect ? '#ecfdf5' : '#fff7ed',
              }}
            >
              <strong style={{ color: predictionCorrect ? '#065f46' : '#7c2d12', lineHeight: 1.25 }}>
                {predictionCorrect
                  ? topKeyWinnerIndices.length > 1
                    ? `Prediction matched. Actual winners: ${tiedTopKeyCopy}.`
                    : `Prediction matched. Actual: K(${topToken.short}).`
                  : topKeyWinnerIndices.length > 1
                  ? `Prediction missed. Actual winners: ${tiedTopKeyCopy}.`
                  : `Prediction missed. Actual: K(${topToken.short}).`}
              </strong>
              <span style={{ fontSize: '0.85rem', color: '#475569', lineHeight: 1.35 }}>
                {topKeyWinnerIndices.length > 1
                  ? `Within tolerance, top keys tie: ${tiedTopKeyCopy}.`
                  : `Top attention weight ${(topWeight * 100).toFixed(1)}%. Carry this row into the demo state and Research Room.`}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="attention-layout">
        {/* Panel 1: Token embeddings + Q/K vectors in 2D */}
        <div className="attention-panel geom-panel">
          <h3 className="panel-title">1. Queries &amp; Keys as Directions</h3>
          <svg
            width={GEOM_WIDTH}
            height={GEOM_HEIGHT}
            className="chart"
            role="img"
            aria-label="2D view of token embeddings with Q and K projections"
          >
            <defs>
              <marker
                id="attention-arrow-q"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={MATH_COLORS.primary}
                />
              </marker>
              <marker
                id="attention-arrow-k"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={MATH_COLORS.secondary}
                />
              </marker>
            </defs>

            {/* Axes */}
            <line
              x1={0}
              y1={GEOM_CENTER_Y}
              x2={GEOM_WIDTH}
              y2={GEOM_CENTER_Y}
              className="axis-line"
            />
            <line
              x1={GEOM_CENTER_X}
              y1={0}
              x2={GEOM_CENTER_X}
              y2={GEOM_HEIGHT}
              className="axis-line"
            />

            {/* Embedding points */}
            {TOKENS.map((t, i) => {
              const p = toGeomSvg(t.embed)
              const isActive = i === activeTokenIndex
              return (
                <g key={t.id}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={isActive ? 6 : 4}
                    fill={MATH_COLORS.neutral}
                    opacity={isActive ? 1 : 0.8}
                  />
                  <text
                    x={p.x + 8}
                    y={p.y - 4}
                    className="label"
                    fontSize={11}
                  >
                    {t.short}
                  </text>
                </g>
              )
            })}

            {/* Q and K arrows from origin */}
            {Q_VECTORS.map((q, i) => {
              const qEnd = toGeomSvg(q)
              const kEnd = toGeomSvg(K_VECTORS[i])
              const isActive = i === activeTokenIndex
              return (
                <g key={`qk-${i}`}>
                  {/* Q arrow */}
                  <line
                    x1={GEOM_CENTER_X}
                    y1={GEOM_CENTER_Y}
                    x2={qEnd.x}
                    y2={qEnd.y}
                    stroke={MATH_COLORS.primary}
                    strokeWidth={isActive ? 3 : 1.8}
                    markerEnd="url(#attention-arrow-q)"
                    opacity={isActive ? 1 : 0.5}
                  />
                  {/* K arrow */}
                  <line
                    x1={GEOM_CENTER_X}
                    y1={GEOM_CENTER_Y}
                    x2={kEnd.x}
                    y2={kEnd.y}
                    stroke={MATH_COLORS.secondary}
                    strokeWidth={isActive ? 3 : 1.8}
                    markerEnd="url(#attention-arrow-k)"
                    opacity={isActive ? 1 : 0.5}
                  />
                </g>
              )
            })}

            {/* Legend */}
            <g transform={`translate(${GEOM_WIDTH - 130},${20})`}>
              <rect
                x={-10}
                y={-14}
                width={120}
                height={40}
                rx={6}
                ry={6}
                fill="white"
                opacity={0.9}
              />
              <line
                x1={0}
                y1={0}
                x2={18}
                y2={0}
                stroke={MATH_COLORS.primary}
                strokeWidth={2}
                markerEnd="url(#attention-arrow-q)"
              />
              <text x={24} y={4} fontSize={11}>
                Query Q
              </text>
              <line
                x1={0}
                y1={16}
                x2={18}
                y2={16}
                stroke={MATH_COLORS.secondary}
                strokeWidth={2}
                markerEnd="url(#attention-arrow-k)"
              />
              <text x={24} y={20} fontSize={11}>
                Key K
              </text>
            </g>
          </svg>
          <p className="caption">
            Each token is a point in a 2D feature space. Q and K are learned
            projections of those embeddings. When Q for your active token points
            in a similar direction to some K, their dot product is large.
          </p>
        </div>

        {/* Panel 2 & 3: QK^T scores and softmax weights */}
        <div className="attention-panel matrix-panel">
          <h3 className="panel-title">
            2–3. Dot Products → Attention Weights
          </h3>
          <svg
            width={MATRIX_WIDTH}
            height={MATRIX_HEIGHT}
            className="chart"
            role="img"
            aria-label="Attention score and weight matrix"
          >
            {/* Row labels (queries) */}
            {TOKENS.map((t, i) => (
              <text
                key={`row-label-${t.id}`}
                x={8}
                y={MATRIX_PADDING + i * cellSize + cellSize * 0.6}
                fontSize={11}
                className={
                  i === activeTokenIndex
                    ? 'label matrix-row-label active'
                    : 'label matrix-row-label'
                }
              >
                Q({t.short})
              </text>
            ))}

            {/* Column labels (keys) */}
            {TOKENS.map((t, j) => (
              <text
                key={`col-label-${t.id}`}
                x={MATRIX_PADDING + j * cellSize + cellSize * 0.35}
                y={16}
                fontSize={11}
                className="label matrix-col-label"
              >
                K({t.short})
              </text>
            ))}

            {/* Grid */}
            <g transform={`translate(${MATRIX_PADDING},${MATRIX_PADDING})`}>
              {TOKENS.map((rowToken, i) =>
                TOKENS.map((colToken, j) => {
                  const score = scaledScores[i][j]
                  const weight = attentionWeights[i][j]
                  const isActiveRow = i === activeTokenIndex

                  let fill: string
                  let fillOpacity: number
                  let displayValue: string

                  if (!revealed) {
                    displayValue = '?'
                    fill = MATH_COLORS.neutral
                    fillOpacity = isActiveRow ? 0.16 : 0.08
                  } else if (isScoresView) {
                    // Pre-softmax scaled scores
                    displayValue = score.toFixed(1)
                    if (score > 0 && maxPositive > 0) {
                      const strength = score / maxPositive
                      fill = MATH_COLORS.positive
                      fillOpacity = 0.15 + 0.75 * strength
                    } else if (score < 0 && minNegative < 0) {
                      const strength = score / minNegative // both negative
                      fill = MATH_COLORS.negative
                      fillOpacity = 0.15 + 0.75 * strength
                    } else {
                      fill = MATH_COLORS.neutral
                      fillOpacity = 0.05
                    }
                  } else {
                    // Post-softmax attention weights
                    displayValue = weight.toFixed(2)
                    const strength = weight // in [0,1]
                    fill = MATH_COLORS.primary
                    fillOpacity = 0.1 + 0.9 * strength
                  }

                  return (
                    <g key={`cell-${i}-${j}`}>
                      <rect
                        x={j * cellSize}
                        y={i * cellSize}
                        width={cellSize}
                        height={cellSize}
                        fill={fill}
                        fillOpacity={fillOpacity}
                        stroke={isActiveRow ? '#111827' : '#e5e7eb'}
                        strokeWidth={isActiveRow ? 1.5 : 1}
                        onClick={() => changeActiveToken(i)}
                        style={{ cursor: 'pointer' }}
                      />
                      <text
                        x={j * cellSize + cellSize * 0.5}
                        y={i * cellSize + cellSize * 0.6}
                        textAnchor="middle"
                        fontSize={11}
                        className="matrix-value"
                      >
                        {displayValue}
                      </text>
                    </g>
                  )
                })
              )}
            </g>

            {/* Matrix mode label */}
            <text
              x={MATRIX_WIDTH - 8}
              y={MATRIX_HEIGHT - 8}
              textAnchor="end"
              fontSize={11}
              className="label matrix-mode-label"
            >
              {isScoresView ? 'Pre-softmax scores (QKᵀ / T)' : 'Post-softmax weights'}
            </text>
          </svg>
          <p className="caption">
            The matrix shows, for each query row, how aligned it is with every
            key (dot products), or after softmax, how much probability mass it
            assigns to copying each token. High attention to one position means
            less for the others&mdash;it&apos;s a competition.
          </p>
        </div>
      </div>

      {/* Panel 4: Values and mixed output for active query */}
      <div className="attention-layout values-layout">
        <div className="attention-panel values-panel">
          <h3 className="panel-title">
            4. Mixing V: Output for the Active Query
          </h3>
          <svg
            width={GEOM_WIDTH}
            height={GEOM_HEIGHT}
            className="chart"
            role="img"
            aria-label={
              revealed
                ? 'Value vectors and attention-weighted output'
                : 'Value vectors with output locked until reveal'
            }
          >
            <defs>
              <marker
                id="attention-arrow-out"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="8"
                markerHeight="8"
                orient="auto-start-reverse"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill={MATH_COLORS.accent}
                />
              </marker>
            </defs>

            {/* Axes */}
            <line
              x1={0}
              y1={GEOM_CENTER_Y}
              x2={GEOM_WIDTH}
              y2={GEOM_CENTER_Y}
              className="axis-line"
            />
            <line
              x1={GEOM_CENTER_X}
              y1={0}
              x2={GEOM_CENTER_X}
              y2={GEOM_HEIGHT}
              className="axis-line"
            />

            {/* Value vectors */}
            {V_VECTORS.map((v, j) => {
              const point = toValueSvg(v)
              const weight = activeWeights[j]
              const r = revealed ? 4 + 12 * weight : 7
              return (
                <g key={`v-${j}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={r}
                    fill={MATH_COLORS.secondary}
                    opacity={revealed ? 0.7 : 0.45}
                  />
                  <text
                    x={point.x + 8}
                    y={point.y - 4}
                    fontSize={11}
                    className="label"
                  >
                    {revealed
                      ? `V(${TOKENS[j].short}) · ${weight.toFixed(2)}`
                      : `V(${TOKENS[j].short})`}
                  </text>
                </g>
              )
            })}

            {/* Output vector for the active query */}
            {revealed && activeOutput && (
              <line
                x1={GEOM_CENTER_X}
                y1={GEOM_CENTER_Y}
                x2={toValueSvg(activeOutput).x}
                y2={toValueSvg(activeOutput).y}
                stroke={MATH_COLORS.accent}
                strokeWidth={3}
                markerEnd="url(#attention-arrow-out)"
              />
            )}
          </svg>
          <p className="caption">
            The active query&apos;s attention weights form a probability
            distribution over V vectors. The output is their weighted average.
            When the distribution is sharp, the output is close to a single V;
            when it&apos;s flat, it lives between many V&apos;s.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="controls attention-controls">
        {/* Temperature Presets */}
        <div className="preset-row" style={{ marginBottom: '1rem' }}>
          <span className="slider-label" style={{ marginRight: '0.5rem' }}>
            🎮 Try these:
          </span>
          <div className="preset-buttons" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {TEMPERATURE_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => changeTemperature(preset.value)}
                className={Math.abs(temperature - preset.value) < 0.1 ? 'preset-btn active' : 'preset-btn'}
                title={preset.description}
                style={{
                  padding: '0.35rem 0.75rem',
                  borderRadius: '6px',
                  border: Math.abs(temperature - preset.value) < 0.1
                    ? '2px solid #3b82f6'
                    : '1px solid #e5e7eb',
                  background: Math.abs(temperature - preset.value) < 0.1
                    ? 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)'
                    : '#fff',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: Math.abs(temperature - preset.value) < 0.1 ? 600 : 400,
                  transition: 'all 0.15s ease',
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>

        <label className="slider-label">
          Scaling / temperature T (divide QKᵀ by T) ({temperature.toFixed(2)})
          <input
            type="range"
            min={0.5 * BASE_SCALE}
            max={3 * BASE_SCALE}
            step={0.05}
            value={temperature}
            onChange={(e) => changeTemperature(parseFloat(e.target.value))}
          />
        </label>

        {/* Distribution diagnostics unlock only after the top-key prediction. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '1.5rem',
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          {revealed ? (
            <>
              {/* Entropy meter */}
              <div style={{ flex: '1 1 220px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500 }}>
                    {entropyRatio < 0.3 ? '🎯 Sharp' : entropyRatio < 0.7 ? '〰️ Balanced' : '🌊 Diffuse'}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                    Entropy: {entropy.toFixed(2)} / {maxEntropy.toFixed(2)}
                  </span>
                </div>
                <div style={{ height: '8px', background: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${entropyRatio * 100}%`,
                      background: entropyRatio < 0.3
                        ? 'linear-gradient(90deg, #10b981 0%, #34d399 100%)'
                        : entropyRatio < 0.7
                        ? 'linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)'
                        : 'linear-gradient(90deg, #ef4444 0%, #f87171 100%)',
                      borderRadius: '4px',
                      transition: 'width 0.2s ease, background 0.2s ease',
                    }}
                  />
                </div>
              </div>

              {/* Effective tokens attended */}
              <div style={{ textAlign: 'center', minWidth: '100px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
                  {effectiveTokens.toFixed(1)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  effective tokens
                </div>
              </div>

              {/* Top-1 probability */}
              <div style={{ textAlign: 'center', minWidth: '80px' }}>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#3b82f6' }}>
                  {(activeWeights[maxAttentionKeyIndex] * 100).toFixed(0)}%
                </div>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  top-1 weight
                </div>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, color: '#6b7280', fontSize: '0.9rem', fontWeight: 500 }}>
              Distribution readout locked until reveal.
            </div>
          )}
        </div>

        {/* Educational Insight */}
        <div
          className="insight-box"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            background: temperature / BASE_SCALE < 0.5
              ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
              : temperature / BASE_SCALE < 1.2
              ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
              : temperature / BASE_SCALE < 2.0
              ? 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)'
              : 'linear-gradient(135deg, #fef2f2 0%, #fecaca 100%)',
            border: '1px solid #e5e7eb',
            fontSize: '0.9rem',
            lineHeight: 1.5,
            marginTop: '0.75rem',
            marginBottom: '0.75rem',
          }}
        >
          {getTemperatureInsight(temperature)}
        </div>

        <p className="muted small">
          T ≈ √dₖ by default. Lower T (left) makes scores larger in magnitude
          and the softmax becomes sharper (almost one-hot). Higher T (right)
          shrinks scores and flattens the distribution toward uniform.
          Temperature multiplier: {temperatureRatio.toFixed(2)} × √dₖ.
        </p>

        <div className="attention-mode-row">
          <div className="slider-label">
            View matrix as:
            <div className="toggle-group" role="radiogroup">
              <button
                type="button"
                className={
                  viewMode === 'scores'
                    ? 'toggle-btn active'
                    : 'toggle-btn'
                }
                onClick={() => changeViewMode('scores')}
              >
                Pre-softmax scores
              </button>
              <button
                type="button"
                className={
                  viewMode === 'weights'
                    ? 'toggle-btn active'
                    : 'toggle-btn'
                }
                onClick={() => changeViewMode('weights')}
              >
                Post-softmax weights
              </button>
            </div>
          </div>
          <div className="attention-token-picker">
            <span className="slider-label">
              Focus query: {focusToken.short} ({focusToken.label})
            </span>
            <div className="token-buttons">
              {TOKENS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => changeActiveToken(i)}
                  className={
                    i === activeTokenIndex
                      ? 'token-btn active'
                      : 'token-btn'
                  }
                >
                  {t.short}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gd-stats attention-stats">
          {revealed ? (
            <div>
              <span className="label">Row sums (softmax):</span>{' '}
              {rowsSum.map((s, i) => (
                <span key={i} className={i === activeTokenIndex ? 'active-row' : ''}>
                  {i === 0 ? '' : ' · '}row {i + 1} ≈ {s.toFixed(2)}
                </span>
              ))}
            </div>
          ) : (
            <div>
              <span className="label">Matrix totals:</span> locked until reveal
            </div>
          )}
        </div>
      </div>

      <p className="caption">
        Conceptually, multi-head attention just runs this same geometry in
        parallel with several different Q/K/V projections, giving the model
        multiple &quot;kernels&quot; over positions and features to look up
        patterns at once.
      </p>
    </section>
  )
}
