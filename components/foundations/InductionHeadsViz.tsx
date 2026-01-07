import { useMemo, useState } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6'
}

type HeadType = 'prev' | 'induction'
type ViewMode = 'qk' | 'ov'

const MAX_TOKENS = 18

type TokenEmbeddings = Record<string, number[]>

interface InductionPattern {
  firstA: number
  firstB: number
  lastA: number
}

interface TrainingPoint {
  step: number
  loss: number
}

export function softmax(values: number[]): number[] {
  if (!values.length) return []
  const maxVal = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - maxVal))
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1
  return exps.map((e) => e / sum)
}

function tokenize(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  if (!cleaned) return []
  return cleaned.split(' ').filter(Boolean)
}

function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) {
    s += a[i] * b[i]
  }
  return s
}

function buildTokenEmbeddings(tokens: string[], dim = 4): TokenEmbeddings {
  const embeddings: TokenEmbeddings = {}
  for (const token of tokens) {
    if (embeddings[token]) continue
    const vec = new Array(dim).fill(0) as number[]
    const lower = token.toLowerCase()
    for (let i = 0; i < lower.length; i++) {
      const code = lower.charCodeAt(i)
      const slot = i % dim
      vec[slot] += (code % 31) / 16
    }
    const mean = vec.reduce((acc, v) => acc + v, 0) / dim
    const centered = vec.map((v) => v - mean)
    const norm =
      Math.sqrt(centered.reduce((acc, v) => acc + v * v, 0)) || 1
    embeddings[token] = centered.map((v) => v / norm)
  }
  return embeddings
}

function buildPrevQK(tokens: string[]): { Q: number[][]; K: number[][] } {
  const n = tokens.length
  const Q: number[][] = []
  const K: number[][] = []

  // Q is one-hot for position i
  for (let i = 0; i < n; i++) {
    const q = new Array(n).fill(0) as number[]
    q[i] = 1
    Q.push(q)
  }

  // K is one-hot for "next position": j contributes to slot j+1
  for (let j = 0; j < n; j++) {
    const k = new Array(n).fill(0) as number[]
    if (j + 1 < n) {
      k[j + 1] = 1
    }
    K.push(k)
  }

  return { Q, K }
}

function buildInductionQK(tokens: string[]): {
  Q: number[][]
  K: number[][]
  tokenIndex: Map<string, number>
} {
  const tokenIndex = new Map<string, number>()
  const uniqueTokens: string[] = []

  for (const t of tokens) {
    if (!tokenIndex.has(t)) {
      tokenIndex.set(t, uniqueTokens.length)
      uniqueTokens.push(t)
    }
  }

  const dim = uniqueTokens.length
  const Q: number[][] = []
  const K: number[][] = []

  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i]
    const prev = i > 0 ? tokens[i - 1] : tokens[0]
    const prevIdx = tokenIndex.get(prev) ?? 0
    const curIdx = tokenIndex.get(current) ?? 0

    // Q encodes "previous token at this position"
    const q = new Array(dim).fill(0) as number[]
    // K encodes "current token at this key position"
    const k = new Array(dim).fill(0) as number[]
    q[prevIdx] = 1
    k[curIdx] = 1
    Q.push(q)
    K.push(k)
  }

  return { Q, K, tokenIndex }
}

function computePrevAttention(tokens: string[], temperature: number): {
  attn: number[][]
  Q: number[][]
  K: number[][]
} {
  const n = tokens.length
  if (n === 0) {
    return { attn: [], Q: [], K: [] }
  }

  const { Q, K } = buildPrevQK(tokens)
  const attn: number[][] = []
  const mask = -1e4
  const temp = Math.max(temperature, 0.05)

  for (let i = 0; i < n; i++) {
    const scores: number[] = []
    for (let j = 0; j < n; j++) {
      // Causal mask: positions can't look at themselves or the future
      if (i > 0 && j >= i) {
        scores.push(mask)
      } else {
        scores.push(dot(Q[i], K[j]) / temp)
      }
    }
    attn.push(softmax(scores))
  }

  return { attn, Q, K }
}

function computeInductionAttention(tokens: string[], temperature: number): {
  attn: number[][]
  Q: number[][]
  K: number[][]
} {
  const n = tokens.length
  if (n === 0) {
    return { attn: [], Q: [], K: [] }
  }

  const { Q, K } = buildInductionQK(tokens)
  const attn: number[][] = []
  const mask = -1e4
  const temp = Math.max(temperature, 0.05)
  const decay = 0.3 // bias towards the most recent matching pattern

  for (let i = 0; i < n; i++) {
    const scores: number[] = []
    for (let j = 0; j < n; j++) {
      // Induction head can only look to the past
      if (j >= i) {
        scores.push(mask)
        continue
      }
      const raw = dot(Q[i], K[j])
      if (raw <= 0) {
        // Non-matching tokens get a low score
        scores.push(-5 / temp)
      } else {
        const distance = i - j
        const bias = -decay * distance
        scores.push((raw + bias) / temp)
      }
    }
    attn.push(softmax(scores))
  }

  return { attn, Q, K }
}

function buildValueVectors(
  headType: HeadType,
  tokens: string[],
  embeddings: TokenEmbeddings
): number[][] {
  const n = tokens.length
  if (n === 0) return []
  const firstEmbedding =
    embeddings[tokens[0]] ??
    embeddings[Object.keys(embeddings)[0] ?? '']
  if (!firstEmbedding) return []

  const dim = firstEmbedding.length
  const zero = new Array(dim).fill(0) as number[]
  const V: number[][] = []

  if (headType === 'prev') {
    // V stores "what token lives at this position"
    for (let j = 0; j < n; j++) {
      V.push(embeddings[tokens[j]] ?? zero)
    }
  } else {
    // Induction: V stores "the next token after this position"
    for (let j = 0; j < n; j++) {
      if (j + 1 < n) {
        V.push(embeddings[tokens[j + 1]] ?? zero)
      } else {
        V.push(zero.slice())
      }
    }
  }

  return V
}

function aggregateOutputs(attn: number[][], V: number[][]): number[][] {
  const n = attn.length
  if (n === 0 || V.length === 0) return []
  const dim = V[0].length
  const outputs: number[][] = []

  for (let i = 0; i < n; i++) {
    const out = new Array(dim).fill(0) as number[]
    const row = attn[i] ?? []
    for (let j = 0; j < V.length; j++) {
      const weight = row[j] ?? 0
      const vj = V[j]
      for (let d = 0; d < dim; d++) {
        out[d] += weight * vj[d]
      }
    }
    outputs.push(out)
  }

  return outputs
}

function predictFromOutput(
  outputVec: number[] | undefined,
  embeddings: TokenEmbeddings
): string | null {
  if (!outputVec) return null
  const entries = Object.entries(embeddings)
  if (!entries.length) return null

  let bestToken: string | null = null
  let bestScore = -Infinity

  for (const [token, vec] of entries) {
    const s = dot(outputVec, vec)
    if (s > bestScore) {
      bestScore = s
      bestToken = token
    }
  }

  return bestToken
}

function argmax(row: number[]): number {
  if (!row.length) return -1
  let bestIndex = 0
  let bestValue = row[0]
  for (let i = 1; i < row.length; i++) {
    if (row[i] > bestValue) {
      bestValue = row[i]
      bestIndex = i
    }
  }
  return bestIndex
}

function findInductionPattern(tokens: string[]): InductionPattern | null {
  const n = tokens.length
  if (n < 3) return null

  for (let i = 0; i < n - 2; i++) {
    const A = tokens[i]
    const B = tokens[i + 1]
    for (let j = i + 2; j < n; j++) {
      if (tokens[j] === A) {
        return {
          firstA: i,
          firstB: i + 1,
          lastA: j
        }
      }
    }
  }

  return null
}

const TRAINING_POINTS: TrainingPoint[] = Array.from(
  { length: 50 },
  (_, i) => {
    const x = i / 49
    const base = 1.6 - 0.7 * x
    const transition = 0.5 / (1 + Math.exp(-(x - 0.6) / 0.04))
    const loss = base - transition + 0.03 * Math.sin(i * 0.7)
    return { step: i, loss }
  }
)

const TRAINING_WIDTH = 260
const TRAINING_HEIGHT = 120
const TRAINING_PADDING = 24
const PHASE_STEP = 31

// Fun sequence presets with patterns
const SEQUENCE_PRESETS = [
  {
    name: '🐱 Cat Pattern',
    text: 'The cat sat on the mat. The cat',
    description: 'Classic induction: "The cat" appears twice',
  },
  {
    name: '📚 Poetry',
    text: 'roses are red violets are blue sugar is sweet and so are you roses are',
    description: 'Repeated "are" pattern',
  },
  {
    name: '🔢 Numbers',
    text: 'one two three four one two',
    description: 'Numeric sequence repetition',
  },
  {
    name: '🎵 La La',
    text: 'la la la do re mi la la',
    description: 'Musical notes with "la la" repeat',
  },
  {
    name: '🌈 Colors',
    text: 'red blue green red',
    description: 'Simple color pattern',
  },
]

export default function InductionHeadsDemo() {
  const [sequence, setSequence] = useState(
    'The cat sat on the mat. The cat'
  )
  const [headType, setHeadType] = useState<HeadType>('induction')
  const [viewMode, setViewMode] = useState<ViewMode>('qk')
  const [temperature, setTemperature] = useState(0.7)
  const [activeTokenIndex, setActiveTokenIndex] = useState<number | null>(
    null
  )

  // Prediction game state
  const [gameMode, setGameMode] = useState(false)
  const [userPrediction, setUserPrediction] = useState('')
  const [predictionRevealed, setPredictionRevealed] = useState(false)
  const [score, setScore] = useState(0)
  const [attempts, setAttempts] = useState(0)

  const tokens = useMemo(
    () => tokenize(sequence).slice(0, MAX_TOKENS),
    [sequence]
  )

  const embeddings = useMemo(
    () => buildTokenEmbeddings(tokens),
    [tokens]
  )

  const prevHead = useMemo(
    () => computePrevAttention(tokens, temperature),
    [tokens, temperature]
  )
  const inductionHead = useMemo(
    () => computeInductionAttention(tokens, temperature),
    [tokens, temperature]
  )

  const activeHeadData = headType === 'prev' ? prevHead : inductionHead
  const attn = activeHeadData.attn
  const Q = activeHeadData.Q
  const K = activeHeadData.K

  const valueVectors = useMemo(
    () => buildValueVectors(headType, tokens, embeddings),
    [headType, tokens, embeddings]
  )

  const outputs = useMemo(
    () => aggregateOutputs(attn, valueVectors),
    [attn, valueVectors]
  )

  const effectiveTokenIndex =
    tokens.length === 0
      ? null
      : activeTokenIndex !== null && activeTokenIndex < tokens.length
      ? activeTokenIndex
      : tokens.length - 1

  const focusRow =
    effectiveTokenIndex !== null ? attn[effectiveTokenIndex] : undefined
  const focusKeyIndex =
    focusRow && focusRow.length ? argmax(focusRow) : -1

  const predictedNextToken =
    tokens.length && outputs.length
      ? predictFromOutput(outputs[tokens.length - 1], embeddings)
      : null

  const pattern = useMemo(
    () => findInductionPattern(tokens),
    [tokens]
  )

  const trainingChart = useMemo(() => {
    if (!TRAINING_POINTS.length) {
      return {
        pathD: '',
        phaseX: 0,
        phaseY: 0
      }
    }

    let minLoss = TRAINING_POINTS[0].loss
    let maxLoss = TRAINING_POINTS[0].loss
    for (const p of TRAINING_POINTS) {
      if (p.loss < minLoss) minLoss = p.loss
      if (p.loss > maxLoss) maxLoss = p.loss
    }

    const xMin = TRAINING_POINTS[0].step
    const xMax = TRAINING_POINTS[TRAINING_POINTS.length - 1].step || 1
    const innerWidth = TRAINING_WIDTH - 2 * TRAINING_PADDING
    const innerHeight = TRAINING_HEIGHT - 2 * TRAINING_PADDING

    const xToSvg = (step: number) =>
      TRAINING_PADDING +
      ((step - xMin) / (xMax - xMin || 1)) * innerWidth
    const yToSvg = (loss: number) =>
      TRAINING_HEIGHT -
      TRAINING_PADDING -
      ((loss - minLoss) / (maxLoss - minLoss || 1)) *
        innerHeight

    const pathD = TRAINING_POINTS.map((p, idx) => {
      const prefix = idx === 0 ? 'M' : 'L'
      return `${prefix} ${xToSvg(p.step)} ${yToSvg(p.loss)}`
    }).join(' ')

    const phasePoint =
      TRAINING_POINTS.find((p) => p.step === PHASE_STEP) ??
      TRAINING_POINTS[PHASE_STEP]
    const phaseX = xToSvg(PHASE_STEP)
    const phaseY = yToSvg(phasePoint.loss)

    return { pathD, phaseX, phaseY }
  }, [])

  return (
    <section className="card interactive-card induction-card">
      <h2>Induction Heads as Tiny Programs</h2>
      <p className="muted">
        Transformers often learn crisp algorithmic circuits. This demo builds a
        toy induction head that completes patterns of the form{' '}
        <code>[A][B] … [A] → [B]</code>.
      </p>

      <div className="induction-layout">
        <div className="induction-left">
          {/* Prediction Game Toggle */}
          <div
            style={{
              padding: '1rem',
              marginBottom: '1rem',
              borderRadius: '10px',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(245, 158, 11, 0.1) 100%)'
                : 'rgba(15, 23, 42, 0.3)',
              border: gameMode ? '2px solid #8b5cf6' : '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: gameMode ? '1rem' : 0 }}>
              <button
                type="button"
                onClick={() => {
                  setGameMode(!gameMode)
                  if (!gameMode) {
                    setUserPrediction('')
                    setPredictionRevealed(false)
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
                {gameMode ? '🛑 Exit Game' : '🎮 Predict Next Token!'}
              </button>

              {(score > 0 || attempts > 0) && (
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', fontWeight: 600 }}>
                  <span>🏆 Score: {score}</span>
                  <span>🎯 {attempts > 0 ? Math.round(score / attempts * 100) : 0}% accuracy</span>
                </div>
              )}
            </div>

            {gameMode && (
              <div style={{ marginTop: '0.75rem' }}>
                <p style={{ fontWeight: 500, marginBottom: '0.75rem' }}>
                  🤔 Based on the pattern, what token will an induction head predict next?
                </p>

                {!predictionRevealed ? (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      value={userPrediction}
                      onChange={(e) => setUserPrediction(e.target.value)}
                      placeholder="Type your prediction..."
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid #6b7280',
                        background: 'rgba(15, 23, 42, 0.8)',
                        color: '#e5e7eb',
                        flex: 1,
                        minWidth: '150px',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setPredictionRevealed(true)
                        setAttempts((prev) => prev + 1)
                        const correct = userPrediction.toLowerCase().trim() === (predictedNextToken || '').toLowerCase().trim()
                        if (correct) setScore((prev) => prev + 1)
                      }}
                      disabled={!userPrediction.trim()}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: 'none',
                        background: userPrediction.trim()
                          ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)'
                          : '#374151',
                        color: userPrediction.trim() ? 'white' : '#6b7280',
                        fontWeight: 600,
                        cursor: userPrediction.trim() ? 'pointer' : 'not-allowed',
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
                        background: userPrediction.toLowerCase().trim() === (predictedNextToken || '').toLowerCase().trim()
                          ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                          : 'linear-gradient(135deg, #f87171 0%, #ef4444 100%)',
                        color: 'white',
                        fontWeight: 600,
                      }}
                    >
                      {userPrediction.toLowerCase().trim() === (predictedNextToken || '').toLowerCase().trim()
                        ? '🎉 Correct!'
                        : `❌ Answer was: "${predictedNextToken}"`}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        // Pick a random preset for next round
                        const randomPreset = SEQUENCE_PRESETS[Math.floor(Math.random() * SEQUENCE_PRESETS.length)]
                        setSequence(randomPreset.text)
                        setUserPrediction('')
                        setPredictionRevealed(false)
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
                      ➡️ Next Pattern
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 1. Sequence input panel */}
          <div className="sequence-panel">
            <h3 className="panel-title">
              1. Sequence input &amp; pattern
            </h3>

            {/* Preset buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '0.25rem' }}>🎮 Try:</span>
              {SEQUENCE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => {
                    setSequence(preset.text)
                    setUserPrediction('')
                    setPredictionRevealed(false)
                  }}
                  title={preset.description}
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '6px',
                    border: sequence === preset.text
                      ? '2px solid #f59e0b'
                      : '1px solid rgba(148, 163, 184, 0.3)',
                    background: sequence === preset.text
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(15, 23, 42, 0.8)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: sequence === preset.text ? 600 : 400,
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>

            <label className="sequence-input-label">
              Input token sequence
              <textarea
                value={sequence}
                onChange={(e) => setSequence(e.target.value)}
                rows={3}
              />
            </label>
            <div
              className="token-row"
              aria-label="Tokenized sequence"
            >
              {tokens.map((token, idx) => {
                const isActive = idx === effectiveTokenIndex
                const classes = ['token-chip']
                if (isActive) classes.push('active')
                if (pattern) {
                  if (
                    idx === pattern.firstA ||
                    idx === pattern.lastA
                  ) {
                    classes.push('pattern-A')
                  }
                  if (idx === pattern.firstB) {
                    classes.push('pattern-B')
                  }
                }
                return (
                  <button
                    key={idx}
                    type="button"
                    className={classes.join(' ')}
                    onClick={() => setActiveTokenIndex(idx)}
                  >
                    <span className="token-index">
                      {idx}
                    </span>
                    <span className="token-text">
                      {token}
                    </span>
                  </button>
                )
              })}
              {!tokens.length && (
                <span className="muted small">
                  Type a short sequence above to see tokens.
                </span>
              )}
            </div>
            <div className="sequence-summary">
              {pattern ? (
                <p className="caption">
                  Detected pattern:{' '}
                  <code>
                    [{tokens[pattern.firstA]}][
                    {tokens[pattern.firstB]}] … [
                    {tokens[pattern.lastA]}]
                  </code>{' '}
                  so an induction head would predict{' '}
                  <code>
                    {tokens[pattern.firstB]}
                  </code>{' '}
                  as the next token.
                </p>
              ) : (
                <p className="caption">
                  Try a sequence with a repeated bigram, like{' '}
                  <code>
                    The cat sat on the mat. The cat
                  </code>
                  .
                </p>
              )}
              <p className="caption">
                Using the currently selected head, this toy model predicts the
                next token as{' '}
                <code>
                  {predictedNextToken ?? '—'}
                </code>
                .
              </p>
            </div>
          </div>

          {/* 6. Controls */}
          <div className="controls-panel">
            <h3 className="panel-title">
              6. Head &amp; circuit controls
            </h3>
            <div className="controls-grid">
              <label>
                Attention head
                <select
                  value={headType}
                  onChange={(e) =>
                    setHeadType(e.target.value as HeadType)
                  }
                >
                  <option value="prev">
                    Previous-token head (layer L)
                  </option>
                  <option value="induction">
                    Induction head (layer L+1)
                  </option>
                </select>
              </label>

              <fieldset className="view-toggle">
                <legend>View</legend>
                <button
                  type="button"
                  className={
                    viewMode === 'qk'
                      ? 'toggle active'
                      : 'toggle'
                  }
                  onClick={() => setViewMode('qk')}
                >
                  QK attention
                </button>
                <button
                  type="button"
                  className={
                    viewMode === 'ov'
                      ? 'toggle active'
                      : 'toggle'
                  }
                  onClick={() => setViewMode('ov')}
                >
                  OV value flow
                </button>
              </fieldset>

              <label className="slider-label">
                Temperature ({temperature.toFixed(2)})
                <input
                  type="range"
                  min={0.3}
                  max={2}
                  step={0.05}
                  value={temperature}
                  onChange={(e) =>
                    setTemperature(parseFloat(e.target.value))
                  }
                />
              </label>
            </div>
            <p className="caption">
              Lower temperature makes attention sharper (one dominant position);
              higher temperature spreads it out across many tokens.
            </p>
          </div>

          {/* 5. Two-head composition */}
          <div className="composition-panel">
            <h3 className="panel-title">
              5. Two-head composition
            </h3>
            {pattern ? (
              <ol className="caption">
                <li>
                  <strong>Layer L (previous-token head):</strong>{' '}
                  each position copies its previous token into
                  the residual stream.
                </li>
                <li>
                  <strong>
                    Layer L+1 (induction head, QK circuit):
                  </strong>{' '}
                  the query at the final{' '}
                  <code>{tokens[pattern.lastA]}</code>{' '}
                  looks for earlier positions whose previous
                  token matches{' '}
                  <code>
                    {tokens[pattern.firstA]}
                  </code>
                  .
                </li>
                <li>
                  <strong>
                    Layer L+1 (induction head, OV circuit):
                  </strong>{' '}
                  when it attends to that earlier{' '}
                  <code>
                    {tokens[pattern.firstA]}
                  </code>
                  , it copies the token that followed it:{' '}
                  <code>
                    {tokens[pattern.firstB]}
                  </code>
                  . That realizes the algorithm{' '}
                  <code>
                    [A][B] … [A] → [B]
                  </code>
                  .
                </li>
              </ol>
            ) : (
              <p className="caption">
                Once a pattern of the form <code>[A][B] … [A]</code> appears,
                you&apos;ll see how a previous-token head and an induction head
                can chain together across layers to predict <code>[B]</code>.
              </p>
            )}
          </div>
        </div>

        <div className="induction-right">
          {/* 2. Attention heatmap */}
          <div className="heatmap-panel">
            <h3 className="panel-title">
              2. Attention pattern heatmap
            </h3>
            <p className="caption">
              Rows are <strong>queries</strong>, columns are{' '}
              <strong>keys</strong>. Click a token on the left to
              focus a row.
            </p>
            <div className="heatmap-wrapper">
              {tokens.length ? (
                <div
                  className="attn-grid"
                  role="grid"
                  aria-label="Attention pattern"
                >
                  <div className="attn-grid-header">
                    <div className="attn-corner-cell" />
                    {tokens.map((token, j) => (
                      <div
                        key={`col-${j}`}
                        className="attn-col-label"
                      >
                        <span className="token-index">
                          {j}
                        </span>
                        <span className="token-text">
                          {token}
                        </span>
                      </div>
                    ))}
                  </div>
                  {tokens.map((token, i) => {
                    const row = attn[i] ?? []
                    const rowBest =
                      row.length > 0
                        ? argmax(row)
                        : -1
                    const isFocusRow =
                      i === effectiveTokenIndex
                    return (
                      <div
                        key={`row-${i}`}
                        className={
                          'attn-row' +
                          (isFocusRow
                            ? ' active-row'
                            : '')
                        }
                      >
                        <div className="attn-row-label">
                          <span className="token-index">
                            {i}
                          </span>
                          <span className="token-text">
                            {token}
                          </span>
                        </div>
                        {tokens.map((_, j) => {
                          const weight = row[j] ?? 0
                          const intensity =
                            Math.pow(
                              weight,
                              0.35
                            )
                          const isArgmax =
                            j === rowBest &&
                            weight > 0
                          const isPrevDiagonal =
                            headType === 'prev' &&
                            j === i - 1
                          const isInductionMatch =
                            headType ===
                              'induction' &&
                            i > 0 &&
                            j < i &&
                            tokens[j] ===
                              tokens[i - 1]

                          const classes = [
                            'attn-cell'
                          ]
                          if (isArgmax)
                            classes.push(
                              'peak'
                            )
                          if (isPrevDiagonal)
                            classes.push(
                              'prev-pattern'
                            )
                          if (isInductionMatch)
                            classes.push(
                              'induction-pattern'
                            )

                          return (
                            <div
                              key={`cell-${i}-${j}`}
                              className={classes.join(' ')}
                              style={{
                                backgroundColor: MATH_COLORS.primary,
                                opacity: 0.05 + 0.9 * intensity
                              }}
                              aria-label={`Attention from token ${i} to ${j}: ${weight.toFixed(
                                2
                              )}`}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="muted small">
                  No tokens yet — type a short sequence to see a
                  toy attention pattern.
                </p>
              )}
            </div>
          </div>

          {/* 3 & 4. QK vs OV circuit views */}
          <div className="circuit-panel">
            <h3 className="panel-title">
              {viewMode === 'qk'
                ? '3. QK circuit: what to attend to'
                : '4. OV circuit: what to copy'}
            </h3>
            {viewMode === 'qk' ? (
              <QKPanel
                tokens={tokens}
                headType={headType}
                Q={Q}
                K={K}
                attn={attn}
                activeTokenIndex={
                  effectiveTokenIndex
                }
              />
            ) : (
              <OVPanel
                tokens={tokens}
                headType={headType}
                attn={attn}
                valueVectors={valueVectors}
                outputs={outputs}
                embeddings={embeddings}
                activeTokenIndex={
                  effectiveTokenIndex
                }
              />
            )}
          </div>

          {/* 7. Training dynamics */}
          <div className="training-panel">
            <h3 className="panel-title">
              7. Training dynamics
            </h3>
            <svg
              width={TRAINING_WIDTH}
              height={TRAINING_HEIGHT}
              className="training-chart"
              role="img"
              aria-label="Toy loss curve with induction head phase transition"
            >
              <line
                x1={TRAINING_PADDING}
                y1={TRAINING_HEIGHT - TRAINING_PADDING}
                x2={
                  TRAINING_WIDTH - TRAINING_PADDING
                }
                y2={TRAINING_HEIGHT - TRAINING_PADDING}
                className="axis-line"
              />
              <line
                x1={TRAINING_PADDING}
                y1={TRAINING_PADDING}
                x2={TRAINING_PADDING}
                y2={
                  TRAINING_HEIGHT -
                  TRAINING_PADDING
                }
                className="axis-line"
              />
              <path
                d={trainingChart.pathD}
                className="loss-curve"
              />
              <line
                x1={trainingChart.phaseX}
                y1={TRAINING_PADDING}
                x2={trainingChart.phaseX}
                y2={
                  TRAINING_HEIGHT -
                  TRAINING_PADDING
                }
                className="phase-line"
              />
              <circle
                cx={trainingChart.phaseX}
                cy={trainingChart.phaseY}
                r={3}
                className="phase-point"
              />
            </svg>
            <p className="caption">
              In real models, induction heads usually appear abruptly during
              training: the loss makes a sharp drop once this circuit
              &ldquo;clicks into place.&rdquo;
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

interface QKPanelProps {
  tokens: string[]
  headType: HeadType
  Q: number[][]
  K: number[][]
  attn: number[][]
  activeTokenIndex: number | null
}

function QKPanel({
  tokens,
  headType,
  Q,
  K,
  attn,
  activeTokenIndex
}: QKPanelProps) {
  if (!tokens.length || !Q.length || !K.length) {
    return (
      <p className="muted small">
        Add some tokens to see the query/key circuit.
      </p>
    )
  }

  const queryIndex =
    activeTokenIndex !== null
      ? activeTokenIndex
      : tokens.length - 1
  const row = attn[queryIndex] ?? []
  const keyIndex =
    row.length > 0 ? argmax(row) : 0
  const queryToken = tokens[queryIndex]
  const keyToken = tokens[keyIndex]
  const qVec = Q[queryIndex] ?? []
  const kVec = K[keyIndex] ?? []
  const qkDot = dot(qVec, kVec)

  return (
    <div className="qk-panel">
      <p className="muted">
        Query at position <code>{queryIndex}</code> (
        <code>{queryToken}</code>) chooses which earlier tokens to look at by
        matching its <strong>Q</strong> vector with each <strong>K</strong>.
      </p>
      <div className="vector-pair">
        <div className="vector-column">
          <div className="vector-title">
            Q for <code>{queryToken}</code>
          </div>
          <VectorBars values={qVec} />
        </div>
        <div className="vector-column">
          <div className="vector-title">
            K for <code>{keyToken}</code>
          </div>
          <VectorBars values={kVec} />
        </div>
      </div>
      <p className="caption">
        The dot product Q·K ≈ <code>{qkDot.toFixed(2)}</code> is higher for
        positions this head wants to attend to. In this toy circuit:
      </p>
      <ul className="caption">
        {headType === 'prev' ? (
          <>
            <li>
              Q and K encode <em>position</em>, so the head locks onto the
              previous token (the bright diagonal).
            </li>
            <li>
              This behaves like a one-step shift: &ldquo;copy the token at t-1
              into position t.&rdquo;
            </li>
          </>
        ) : (
          <>
            <li>
              Q encodes the <em>previous token</em> at the query position; K
              encodes the <em>current token</em> at each key.
            </li>
            <li>
              The head prefers keys whose token matches the previous token in
              the current context, which implements the induction pattern.
            </li>
          </>
        )}
      </ul>
    </div>
  )
}

interface OVPanelProps {
  tokens: string[]
  headType: HeadType
  attn: number[][]
  valueVectors: number[][]
  outputs: number[][]
  embeddings: TokenEmbeddings
  activeTokenIndex: number | null
}

function OVPanel({
  tokens,
  headType,
  attn,
  valueVectors,
  outputs,
  embeddings,
  activeTokenIndex
}: OVPanelProps) {
  if (
    !tokens.length ||
    !attn.length ||
    !valueVectors.length ||
    !outputs.length
  ) {
    return (
      <p className="muted small">
        The OV circuit appears once there is a non-trivial attention pattern to
        copy from.
      </p>
    )
  }

  const queryIndex =
    activeTokenIndex !== null
      ? activeTokenIndex
      : tokens.length - 1
  const row = attn[queryIndex] ?? []
  const keyIndex =
    row.length > 0 ? argmax(row) : 0
  const queryToken = tokens[queryIndex]
  const keyToken = tokens[keyIndex]
  const V = valueVectors[keyIndex] ?? []
  const outputVec = outputs[queryIndex] ?? []
  const copiedToken =
    headType === 'prev'
      ? keyToken
      : keyIndex + 1 < tokens.length
      ? tokens[keyIndex + 1]
      : null
  const predictedToken = predictFromOutput(
    outputVec,
    embeddings
  )

  return (
    <div className="ov-panel">
      <p className="muted">
        Once attention chooses a key position, the <strong>V</strong> vector at
        that key is projected back into the residual stream as{' '}
        <strong>O·V</strong>.
      </p>
      <div className="vector-pair">
        <div className="vector-column">
          <div className="vector-title">
            V at key <code>{keyIndex}</code> (<code>{keyToken}</code>)
          </div>
          <VectorBars values={V} />
        </div>
        <div className="vector-column">
          <div className="vector-title">
            Output at query <code>{queryIndex}</code> (
            <code>{queryToken}</code>)
          </div>
          <VectorBars values={outputVec} />
        </div>
      </div>
      <p className="caption">
        In this toy head, attending to position <code>{keyIndex}</code>{' '}
        {copiedToken && (
          <>
            copies information about <code>{copiedToken}</code>{' '}
          </>
        )}
        into the query position&apos;s residual stream. Decoding the output
        vector gives a predicted token{' '}
        <code>{predictedToken ?? '—'}</code>.
      </p>
      <ul className="caption">
        {headType === 'prev' ? (
          <li>
            The head behaves like &ldquo;shift the sequence by one&rdquo;: V
            stores the current token, so O·V writes the previous token at each
            position.
          </li>
        ) : (
          <li>
            V is wired to store the <em>next token</em> after each key
            position. When the head attends to an earlier [A], it copies the
            following token [B] forward, realizing the induction algorithm.
          </li>
        )}
      </ul>
    </div>
  )
}

interface VectorBarsProps {
  values: number[]
}

function VectorBars({ values }: VectorBarsProps) {
  if (!values.length) {
    return (
      <div className="vector-bars empty">
        <span className="muted small">
          (vector is all zeros)
        </span>
      </div>
    )
  }

  const maxAbs = values.reduce(
    (acc, v) => Math.max(acc, Math.abs(v)),
    0
  )

  return (
    <div className="vector-bars">
      {values.map((v, i) => {
        const magnitude = maxAbs
          ? Math.abs(v) / maxAbs
          : 0
        const height = 10 + 70 * magnitude
        return (
          <div
            key={i}
            className="vector-bar-wrapper"
          >
            <div
              className="vector-bar"
              style={{
                height: `${height}%`,
                backgroundColor:
                  v >= 0
                    ? MATH_COLORS.secondary
                    : MATH_COLORS.accent
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
