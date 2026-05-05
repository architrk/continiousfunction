import { useState } from 'react'
import { MATH_COLORS, softmax, matmul } from '../../lib/mathObjects'

const GEOM_WIDTH = 320
const GEOM_HEIGHT = 260
const GEOM_CENTER_X = GEOM_WIDTH / 2
const GEOM_CENTER_Y = GEOM_HEIGHT / 2

const MATRIX_WIDTH = 320
const MATRIX_HEIGHT = 260
const MATRIX_PADDING = 40

type Vec2 = [number, number]

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

export default function AttentionGeometryDemo() {
  // Temperature / scaling factor for logits
  const [temperature, setTemperature] = useState(BASE_SCALE)
  // Toggle between raw scores and softmax weights
  const [viewMode, setViewMode] = useState<'scores' | 'weights'>('weights')
  // Focus on a single query row at a time
  const [activeTokenIndex, setActiveTokenIndex] = useState(0)

  // Prediction game state
  const [challengeMode, setChallengeMode] = useState(false)
  const [prediction, setPrediction] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [totalAttempts, setTotalAttempts] = useState(0)

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
  const activeOutput = outputs[activeTokenIndex]

  // Find the key with maximum attention for current query
  const maxAttentionKeyIndex = activeWeights.reduce(
    (maxIdx, weight, idx, arr) => (weight > arr[maxIdx] ? idx : maxIdx),
    0
  )

  // Compute entropy of attention distribution (Oracle suggestion: entropy gauge!)
  const entropy = -activeWeights.reduce((sum, p) => {
    if (p > 0.0001) return sum + p * Math.log2(p)
    return sum
  }, 0)
  const maxEntropy = Math.log2(TOKENS.length) // uniform distribution
  const entropyRatio = entropy / maxEntropy // 0 = one-hot, 1 = uniform

  // Effective number of tokens attended (exp(entropy))
  const effectiveTokens = Math.pow(2, entropy)

  // Handle prediction check
  const checkPrediction = () => {
    if (prediction === null) return
    setRevealed(true)
    setTotalAttempts((prev) => prev + 1)
    if (prediction === maxAttentionKeyIndex) {
      setScore((prev) => prev + 10 + streak * 2)
      setStreak((prev) => prev + 1)
    } else {
      setStreak(0)
    }
  }

  // Reset for next round
  const nextChallenge = () => {
    // Randomize temperature for variety
    const randomTemp = 0.5 + Math.random() * 3.5
    setTemperature(randomTemp)
    // Randomize active query
    setActiveTokenIndex(Math.floor(Math.random() * TOKENS.length))
    setPrediction(null)
    setRevealed(false)
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

      {/* Challenge Mode Toggle & Game UI */}
      <div
        style={{
          padding: '1rem',
          marginBottom: '1rem',
          borderRadius: '10px',
          background: challengeMode
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            : '#f9fafb',
          border: challengeMode ? '2px solid #f59e0b' : '1px solid #e5e7eb',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: challengeMode ? '1rem' : 0 }}>
          <button
            type="button"
            onClick={() => {
              setChallengeMode(!challengeMode)
              if (!challengeMode) nextChallenge()
            }}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: 'none',
              background: challengeMode
                ? 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)'
                : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer',
              fontSize: '0.9rem',
            }}
          >
            {challengeMode ? '🛑 Exit Challenge' : '🎮 Start Challenge Mode'}
          </button>

          {challengeMode && (
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
              <span>🏆 Score: {score}</span>
              <span>🔥 Streak: {streak}</span>
              <span>📊 {totalAttempts > 0 ? `${Math.round(((score > 0 ? (totalAttempts - (score / 10)) : 0) / totalAttempts) * 100)}% accuracy` : '0 attempts'}</span>
            </div>
          )}
        </div>

        {challengeMode && (
          <div style={{ marginTop: '0.75rem' }}>
            <p style={{ fontWeight: 500, marginBottom: '0.75rem' }}>
              🤔 <strong>Challenge:</strong> For query {focusToken.short}, which key will receive the HIGHEST attention?
              (Temperature is hidden: T = ???)
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              {TOKENS.map((t, i) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => !revealed && setPrediction(i)}
                  disabled={revealed}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: prediction === i
                      ? '2px solid #3b82f6'
                      : revealed && i === maxAttentionKeyIndex
                      ? '2px solid #10b981'
                      : '1px solid #d1d5db',
                    background: prediction === i
                      ? '#eff6ff'
                      : revealed && i === maxAttentionKeyIndex
                      ? '#d1fae5'
                      : 'white',
                    cursor: revealed ? 'default' : 'pointer',
                    opacity: revealed && prediction !== i && i !== maxAttentionKeyIndex ? 0.5 : 1,
                    fontWeight: prediction === i || (revealed && i === maxAttentionKeyIndex) ? 600 : 400,
                  }}
                >
                  K({t.short}) {revealed && i === maxAttentionKeyIndex && '✓'}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {!revealed ? (
                <button
                  type="button"
                  onClick={checkPrediction}
                  disabled={prediction === null}
                  style={{
                    padding: '0.5rem 1.25rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: prediction !== null
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                      : '#d1d5db',
                    color: prediction !== null ? 'white' : '#6b7280',
                    fontWeight: 600,
                    cursor: prediction !== null ? 'pointer' : 'not-allowed',
                  }}
                >
                  🔍 Reveal Answer
                </button>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <span
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '8px',
                      background: prediction === maxAttentionKeyIndex
                        ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                        : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                      color: 'white',
                      fontWeight: 600,
                    }}
                  >
                    {prediction === maxAttentionKeyIndex
                      ? `🎉 Correct! +${10 + (streak - 1) * 2} pts`
                      : `❌ Wrong! Answer was K(${TOKENS[maxAttentionKeyIndex].short})`}
                  </span>
                  <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                    (T = {temperature.toFixed(2)}, weight = {(activeWeights[maxAttentionKeyIndex] * 100).toFixed(1)}%)
                  </span>
                  <button
                    type="button"
                    onClick={nextChallenge}
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
                    ➡️ Next Challenge
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
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

                  let fill: string
                  let fillOpacity: number
                  let displayValue: string

                  if (isScoresView) {
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

                  const isActiveRow = i === activeTokenIndex

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
                        onClick={() => setActiveTokenIndex(i)}
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
            aria-label="Value vectors and attention-weighted output"
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
              const r = 4 + 12 * weight
              return (
                <g key={`v-${j}`}>
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={r}
                    fill={MATH_COLORS.secondary}
                    opacity={0.7}
                  />
                  <text
                    x={point.x + 8}
                    y={point.y - 4}
                    fontSize={11}
                    className="label"
                  >
                    V({TOKENS[j].short}) · {weight.toFixed(2)}
                  </text>
                </g>
              )
            })}

            {/* Output vector for the active query */}
            {activeOutput && (
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
                onClick={() => setTemperature(preset.value)}
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
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
          />
        </label>

        {/* Entropy Gauge - Oracle suggestion: makes temperature "feel meaningful" */}
        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            marginTop: '0.75rem',
            padding: '0.75rem 1rem',
            background: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
          }}
        >
          {/* Entropy meter */}
          <div style={{ flex: 1 }}>
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
                onClick={() => setViewMode('scores')}
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
                onClick={() => setViewMode('weights')}
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
                  onClick={() => setActiveTokenIndex(i)}
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
          <div>
            <span className="label">Row sums (softmax):</span>{' '}
            {rowsSum.map((s, i) => (
              <span key={i} className={i === activeTokenIndex ? 'active-row' : ''}>
                {i === 0 ? '' : ' · '}row {i + 1} ≈ {s.toFixed(2)}
              </span>
            ))}
          </div>
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
