import { useMemo, useState } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

const MAX_FEATURES = 20
const MIN_FEATURES = 2
const MIN_DIM = 2
const MAX_DIM = 10

type Dictionary = number[][]

type Prompt = {
  id: string
  label: string
  description: string
  features: number[]
}

const FEATURE_NAMES: string[] = [
  'Vertical edges',
  'Horizontal edges',
  'Curved strokes',
  'Digit “3”-ness',
  'Digit “7”-ness',
  'Uppercase letters',
  'Lowercase letters',
  'Whitespace / padding',
  'Punctuation',
  'Number tokens',
]

const FEATURE_DESCRIPTIONS: string[] = [
  'A direction that fires on vertical lines in an image (e.g., edges of doors, digits, and letters).',
  'A direction that responds to horizontal lines (e.g., underlines, horizons, and many characters).',
  'A direction for curved strokes like circles and loops (e.g., “3”, “8”, “o”).',
  'Selectively activated by patterns that look like the digit “3”.',
  'Selectively activated by patterns that look like the digit “7”.',
  'A direction that lights up for uppercase letters in text.',
  'A direction that lights up for lowercase letters in text.',
  'A direction that encodes “blank space” or padding between tokens.',
  'A direction that responds to punctuation characters.',
  'A direction that responds to number-like tokens in text.',
]

const PROMPTS: Prompt[] = [
  {
    id: 'vertical-edge',
    label: 'Image: vertical edge',
    description: 'A simple picture with a strong vertical boundary (like a dark–light border).',
    features: [0],
  },
  {
    id: 'curve-plus-edge',
    label: 'Image: curved stroke',
    description: 'A curved stroke with some vertical structure (e.g., a partial “3”).',
    features: [0, 2],
  },
  {
    id: 'digit-3',
    label: 'Image: digit “3”',
    description: 'A handwritten “3” uses curves and a “3”-specific feature.',
    features: [0, 2, 3],
  },
  {
    id: 'digit-7',
    label: 'Image: digit “7”',
    description: 'A handwritten “7” uses edges and a “7”-specific feature.',
    features: [1, 4],
  },
  {
    id: 'text-uppercase',
    label: 'Text: SHOUTING',
    description: 'An all-caps phrase triggering uppercase and punctuation features.',
    features: [5, 8],
  },
  {
    id: 'text-mixed',
    label: 'Text: mixed case',
    description: 'A mixed-case sentence with both uppercase and lowercase structure.',
    features: [5, 6],
  },
]

function createPrng(seed: number) {
  let s = seed >>> 0
  return () => {
    // Simple LCG PRNG (deterministic)
    s = (1664525 * s + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

function l2Norm(v: number[]): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i]
  return Math.sqrt(sum) || 1
}

function dot(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let s = 0
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

function softThreshold(x: number, lam: number): number {
  const mag = Math.abs(x) - lam
  if (mag <= 0) return 0
  return (x >= 0 ? 1 : -1) * mag
}

function generateDictionary(dim: number): Dictionary {
  const prng = createPrng(dim * 12345 + 1337)
  const dict: Dictionary = []
  for (let f = 0; f < MAX_FEATURES; f++) {
    const v: number[] = []
    for (let d = 0; d < dim; d++) {
      v.push(prng() * 2 - 1)
    }
    const n = l2Norm(v)
    dict.push(v.map((x) => x / n))
  }
  return dict
}

function computeAverageInterference(dict: Dictionary): number {
  const m = dict.length
  if (m <= 1) return 0
  let sum = 0
  let count = 0
  for (let i = 0; i < m; i++) {
    for (let j = i + 1; j < m; j++) {
      sum += Math.abs(dot(dict[i], dict[j]))
      count++
    }
  }
  return count === 0 ? 0 : sum / count
}

function buildActivation(dict: Dictionary, activeFeatures: number[]): number[] {
  const dim = dict[0]?.length ?? 0
  const h = new Array(dim).fill(0)
  activeFeatures.forEach((fi, idx) => {
    if (!dict[fi]) return
    const strength = 1 - idx * 0.2 // slightly decreasing strengths
    const v = dict[fi]
    for (let d = 0; d < dim; d++) {
      h[d] += strength * v[d]
    }
  })
  return h
}

function computeSparseCode(
  dict: Dictionary,
  h: number[],
  lambda: number,
): {
  dense: number[]
  sparse: number[]
  recon: number[]
  error: number
} {
  const dense = dict.map((v) => dot(v, h))
  const sparse = dense.map((c) => softThreshold(c, lambda))
  const dim = h.length
  const recon = new Array(dim).fill(0)
  for (let i = 0; i < dict.length; i++) {
    const coeff = sparse[i]
    if (coeff === 0) continue
    const v = dict[i]
    for (let d = 0; d < dim; d++) {
      recon[d] += coeff * v[d]
    }
  }
  let err2 = 0
  for (let d = 0; d < dim; d++) {
    const diff = h[d] - recon[d]
    err2 += diff * diff
  }
  return {
    dense,
    sparse,
    recon,
    error: Math.sqrt(err2),
  }
}

function getFeatureName(index: number): string {
  if (index < FEATURE_NAMES.length) return FEATURE_NAMES[index]
  return `Compressed feature ${index + 1}`
}

function getFeatureDescription(index: number): string {
  if (index < FEATURE_DESCRIPTIONS.length) return FEATURE_DESCRIPTIONS[index]
  return 'An extra packed feature direction used to squeeze more concepts into the same neurons.'
}

function getTopContributorsForNeuron(
  dict: Dictionary,
  neuronIndex: number,
  featureCount: number,
  topK = 3,
): { featureIndex: number; weight: number }[] {
  const contribs: { featureIndex: number; weight: number }[] = []
  for (let i = 0; i < featureCount; i++) {
    const row = dict[i]
    if (!row) continue
    const w = Math.abs(row[neuronIndex] ?? 0)
    contribs.push({ featureIndex: i, weight: w })
  }
  contribs.sort((a, b) => b.weight - a.weight)
  return contribs.slice(0, topK)
}

// Game phase for prediction game
type GamePhase = 'setup' | 'predicting' | 'revealed'

// Fun configuration presets
const SUPERPOSITION_PRESETS = [
  {
    name: '🎯 Orthogonal',
    features: 4,
    dim: 4,
    lambda: 0.3,
    description: 'Features = Dimensions: no superposition needed',
  },
  {
    name: '📦 Light Packing',
    features: 6,
    dim: 4,
    lambda: 0.3,
    description: 'Slightly more features than neurons',
  },
  {
    name: '🔥 Heavy Packing',
    features: 12,
    dim: 4,
    lambda: 0.4,
    description: '3× more features than neurons!',
  },
  {
    name: '🚀 Extreme',
    features: 18,
    dim: 4,
    lambda: 0.5,
    description: 'Pushing the limits of superposition',
  },
  {
    name: '🌊 High Dim',
    features: 12,
    dim: 8,
    lambda: 0.3,
    description: 'More room = less interference',
  },
]

// Educational insight based on current configuration
const getSuperpositionInsight = (features: number, dim: number, interference: number): string => {
  const ratio = features / dim
  if (ratio <= 1) {
    return '✅ No superposition needed: each feature has its own dimension. This is the cleanest setup!'
  }
  if (ratio <= 1.5) {
    return '📊 Light superposition: features share some dimensions but stay fairly separable.'
  }
  if (ratio <= 2.5) {
    return '🔀 Moderate superposition: features overlap significantly. Sparse autoencoders help decompress.'
  }
  if (interference > 0.45) {
    return '⚠️ High interference! Features are crowded. Some will be hard to distinguish.'
  }
  return '🔥 Heavy superposition: the network is squeezing many concepts into few neurons. Impressive but tricky!'
}

export default function SuperpositionDemo() {
  const [featureCount, setFeatureCount] = useState(8)
  const [dim, setDim] = useState(4)
  const [lambda, setLambda] = useState(0.3)
  const [viewMode, setViewMode] = useState<'features' | 'neurons'>('features')
  const [selectedFeature, setSelectedFeature] = useState<number | null>(0)
  const [selectedNeuron, setSelectedNeuron] = useState<number | null>(0)
  const [promptIndex, setPromptIndex] = useState(0)

  // Feature prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [userPredictions, setUserPredictions] = useState<Set<number>>(new Set())
  const [gameScore, setGameScore] = useState(0)
  const [gameTotalAttempts, setGameTotalAttempts] = useState(0)
  const [lastResult, setLastResult] = useState<{ correct: number; total: number; feedback: string } | null>(null)

  const dictionaryFull = useMemo(() => generateDictionary(dim), [dim])
  const activeDictionary = useMemo(
    () => dictionaryFull.slice(0, featureCount),
    [dictionaryFull, featureCount],
  )

  const availablePrompts = useMemo(() => {
    return PROMPTS.filter((p) =>
      p.features.every((fi) => fi < featureCount),
    )
  }, [featureCount])

  const clampedPromptIndex = Math.min(
    promptIndex,
    Math.max(availablePrompts.length - 1, 0),
  )
  const currentPrompt =
    availablePrompts[clampedPromptIndex] ?? availablePrompts[0] ?? PROMPTS[0]

  const activation = useMemo(
    () => buildActivation(activeDictionary, currentPrompt.features),
    [activeDictionary, currentPrompt],
  )

  const coding = useMemo(
    () => computeSparseCode(activeDictionary, activation, lambda),
    [activeDictionary, activation, lambda],
  )

  const averageInterference = useMemo(
    () => computeAverageInterference(activeDictionary),
    [activeDictionary],
  )

  const capacityPoints = useMemo(() => {
    const pts: { k: number; interference: number; jl: number }[] = []
    for (let k = 2; k <= MAX_FEATURES; k++) {
      const subset = dictionaryFull.slice(0, k)
      const inter = computeAverageInterference(subset)
      const jl = Math.min(1, Math.sqrt((2 * Math.log(k)) / dim))
      pts.push({ k, interference: inter, jl })
    }
    return pts
  }, [dictionaryFull, dim])

  const dimCount = activation.length
  const maxDimVal =
    activation.reduce(
      (m, v, i) => Math.max(m, Math.abs(v), Math.abs(coding.recon[i] ?? 0)),
      0,
    ) || 1

  const maxFeatureActivation =
    coding.sparse.slice(0, featureCount).reduce(
      (m, v) => Math.max(m, Math.abs(v)),
      0,
    ) || 1

  const maxNeuronActivation =
    activation.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1

  const problemInterferenceThreshold = 0.45
  const inHighInterference = averageInterference > problemInterferenceThreshold

  // Geometry SVG constants (shared style with other demos)
  const GEO_WIDTH = 260
  const GEO_HEIGHT = 260
  const GEO_CENTER_X = GEO_WIDTH / 2
  const GEO_CENTER_Y = GEO_HEIGHT / 2
  const GEO_SCALE = 90

  const projectedDirections = useMemo(() => {
    return activeDictionary.map((vec, i) => {
      const x = vec[0] ?? 0
      const y = vec[1] ?? 0
      const n = Math.sqrt(x * x + y * y) || 1
      return { index: i, x: x / n, y: y / n }
    })
  }, [activeDictionary])

  const CAP_WIDTH = 320
  const CAP_HEIGHT = 180
  const CAP_PADDING = 28

  const xToCap = (k: number) => {
    const t = (k - 2) / (MAX_FEATURES - 2)
    return CAP_PADDING + t * (CAP_WIDTH - 2 * CAP_PADDING)
  }
  const yToCap = (val: number) => {
    const yMax = 1
    const v = Math.max(0, Math.min(yMax, val))
    const t = v / yMax
    return CAP_HEIGHT - CAP_PADDING - t * (CAP_HEIGHT - 2 * CAP_PADDING)
  }

  const interferencePath = useMemo(() => {
    if (capacityPoints.length === 0) return ''
    return capacityPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToCap(p.k)} ${yToCap(p.interference)}`)
      .join(' ')
  }, [capacityPoints])

  const jlPath = useMemo(() => {
    if (capacityPoints.length === 0) return ''
    return capacityPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToCap(p.k)} ${yToCap(p.jl)}`)
      .join(' ')
  }, [capacityPoints])

  // Determine which features are actually active (above threshold)
  const actualActiveFeatures = useMemo(() => {
    const threshold = 0.1
    return coding.sparse.slice(0, featureCount)
      .map((v, i) => Math.abs(v) > threshold ? i : -1)
      .filter(i => i >= 0)
  }, [coding.sparse, featureCount])

  // Game control functions
  const startPredictionGame = () => {
    setUserPredictions(new Set())
    setLastResult(null)
    setGamePhase('predicting')
  }

  const toggleFeaturePrediction = (featureIndex: number) => {
    if (gamePhase !== 'predicting') return
    setUserPredictions(prev => {
      const next = new Set(prev)
      if (next.has(featureIndex)) {
        next.delete(featureIndex)
      } else {
        next.add(featureIndex)
      }
      return next
    })
  }

  const submitPredictions = () => {
    if (gamePhase !== 'predicting') return

    // Calculate score: correct predictions vs actual active features
    const predictedSet = userPredictions
    const actualSet = new Set(actualActiveFeatures)

    // True positives: features we predicted that are actually active
    let truePositives = 0
    predictedSet.forEach(f => {
      if (actualSet.has(f)) truePositives++
    })

    // False positives: features we predicted that aren't active
    const falsePositives = predictedSet.size - truePositives

    // False negatives: features that are active but we didn't predict
    const falseNegatives = actualSet.size - truePositives

    // Score: reward true positives, penalize false positives/negatives
    const total = actualSet.size
    const correct = truePositives

    // Generate educational feedback
    let feedback = ''
    if (correct === total && falsePositives === 0) {
      feedback = '🎯 Perfect! You correctly identified all active features!'
    } else if (correct === total && falsePositives > 0) {
      feedback = `✨ Good! You found all active features, but predicted ${falsePositives} extra that weren't active. Superposition makes it tricky!`
    } else if (correct > 0) {
      feedback = `👍 You got ${correct}/${total} active features. ${falseNegatives > 0 ? `The superposition hiding ${falseNegatives} is working as expected!` : ''}`
    } else {
      feedback = `💡 No matches this time. In superposition, features share neurons, so predicting which ones fire takes practice!`
    }

    setLastResult({ correct, total, feedback })
    setGameScore(prev => prev + correct)
    setGameTotalAttempts(prev => prev + 1)
    setGamePhase('revealed')
  }

  const resetGame = () => {
    setGamePhase('setup')
    setUserPredictions(new Set())
    setLastResult(null)
  }

  return (
    <section className="card interactive-card">
      <h2>Superposition & Sparse Features</h2>
      <p className="muted">
        Neural networks pack more features than neurons. Superposition uses
        overlapping directions in activation space as a compression trick;
        sparse autoencoders act like a decompressor that teases apart clean,
        monosemantic features.
      </p>

      {/* Presets & Insight */}
      <div style={{ marginBottom: '1rem' }}>
        {/* Preset buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#6b7280', marginRight: '0.25rem' }}>🎮 Presets:</span>
          {SUPERPOSITION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => {
                setFeatureCount(preset.features)
                setDim(preset.dim)
                setLambda(preset.lambda)
              }}
              title={preset.description}
              style={{
                padding: '0.3rem 0.6rem',
                borderRadius: '6px',
                border: featureCount === preset.features && dim === preset.dim
                  ? '2px solid #8b5cf6'
                  : '1px solid #e5e7eb',
                background: featureCount === preset.features && dim === preset.dim
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(139, 92, 246, 0.05) 100%)'
                  : '#fff',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: featureCount === preset.features && dim === preset.dim ? 600 : 400,
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
            background: averageInterference > 0.45
              ? 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)'
              : featureCount / dim > 2
              ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
              : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
            border: '1px solid #e5e7eb',
            fontSize: '0.9rem',
            marginBottom: '0.75rem',
          }}
        >
          {getSuperpositionInsight(featureCount, dim, averageInterference)}
        </div>

        {/* Prediction Game Section */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(20, 184, 166, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '16px',
          }}
        >
          <h3 style={{ fontSize: '1rem', marginBottom: '8px', color: '#1f2937' }}>
            🎮 Feature Prediction Challenge
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#6b7280', marginBottom: '12px' }}>
            Can you predict which features will fire for the current input? Test your intuition about superposition!
          </p>

          {gamePhase === 'setup' && (
            <div>
              <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#374151' }}>
                Current input: <strong>{currentPrompt.label}</strong>
              </p>
              <button
                onClick={startPredictionGame}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                🎯 Start Prediction
              </button>
              {gameTotalAttempts > 0 && (
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '8px' }}>
                  Session score: {gameScore} correct across {gameTotalAttempts} attempt{gameTotalAttempts !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}

          {gamePhase === 'predicting' && (
            <div>
              <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#374151' }}>
                🤔 <strong>Which features do you think will fire for "{currentPrompt.label}"?</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '12px' }}>
                Click features to toggle your prediction. Remember: superposition means features share neurons!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                {Array.from({ length: Math.min(featureCount, 10) }).map((_, i) => (
                  <button
                    key={i}
                    onClick={() => toggleFeaturePrediction(i)}
                    style={{
                      padding: '4px 10px',
                      background: userPredictions.has(i)
                        ? 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)'
                        : '#f3f4f6',
                      border: userPredictions.has(i) ? '2px solid #8b5cf6' : '1px solid #d1d5db',
                      borderRadius: '6px',
                      color: userPredictions.has(i) ? 'white' : '#374151',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                    title={getFeatureName(i)}
                  >
                    f{i + 1}: {getFeatureName(i).slice(0, 12)}...
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={submitPredictions}
                  style={{
                    padding: '8px 16px',
                    background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ✅ Submit Prediction ({userPredictions.size} selected)
                </button>
                <button
                  onClick={resetGame}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '8px',
                    color: '#374151',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {gamePhase === 'revealed' && lastResult && (
            <div>
              <div
                style={{
                  padding: '12px',
                  borderRadius: '8px',
                  background: lastResult.correct === lastResult.total
                    ? 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)'
                    : lastResult.correct > 0
                    ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
                    : 'linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)',
                  marginBottom: '12px',
                }}
              >
                <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '4px' }}>
                  {lastResult.feedback}
                </p>
                <p style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                  You predicted: {Array.from(userPredictions).map(i => `f${i + 1}`).join(', ') || 'none'}
                  <br />
                  Actually active: {actualActiveFeatures.map(i => `f${i + 1}`).join(', ') || 'none'}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  padding: '8px 16px',
                  background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                🔄 Try Another Input
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="superposition-controls">
        <div className="control-group">
          <label className="slider-label">
            Number of features ({featureCount})
            <input
              type="range"
              min={MIN_FEATURES}
              max={MAX_FEATURES}
              step={1}
              value={featureCount}
              onChange={(e) =>
                setFeatureCount(parseInt(e.target.value || '2', 10))
              }
            />
          </label>
          <p className="caption">
            More features than dimensions means they must share neurons and
            interfere with each other.
          </p>
        </div>
        <div className="control-group">
          <label className="slider-label">
            Activation dimension N ({dim})
            <input
              type="range"
              min={MIN_DIM}
              max={MAX_DIM}
              step={1}
              value={dim}
              onChange={(e) => setDim(parseInt(e.target.value || '2', 10))}
            />
          </label>
          <p className="caption">
            Increasing N gives you more room to host nearly-orthogonal feature
            directions.
          </p>
        </div>
        <div className="control-group">
          <label className="slider-label">
            Sparsity penalty λ ({lambda.toFixed(2)})
            <input
              type="range"
              min={0}
              max={0.9}
              step={0.05}
              value={lambda}
              onChange={(e) => setLambda(parseFloat(e.target.value))}
            />
          </label>
          <p className="caption">
            Higher λ pushes the autoencoder to explain h with fewer active
            features, giving more monosemantic codes.
          </p>
        </div>
        <div className="control-group toggle-group">
          <span className="slider-label">View:</span>
          <div className="toggle-buttons">
            <button
              type="button"
              className={viewMode === 'features' ? 'active' : ''}
              onClick={() => setViewMode('features')}
            >
              Feature directions
            </button>
            <button
              type="button"
              className={viewMode === 'neurons' ? 'active' : ''}
              onClick={() => setViewMode('neurons')}
            >
              Individual neurons
            </button>
          </div>
          <p className="caption">
            Features are directions in the space; neurons are coordinates along
            those directions. Features can be monosemantic even when individual
            neurons are polysemantic.
          </p>
        </div>
      </div>

      <div className="superposition-layout">
        {/* Left column: geometry + capacity trade-off */}
        <div className="superposition-left">
          {/* 1. Superposition geometry */}
          <div className="panel">
            <h3>Superposition geometry</h3>
            <p className="muted">
              Each arrow is a feature direction in a 2D slice of activation
              space. Active features for the chosen input are highlighted.
            </p>
            <div className="superposition-geometry">
              <svg
                width={GEO_WIDTH}
                height={GEO_HEIGHT}
                role="img"
                aria-label="2D view of feature directions in activation space"
              >
                {/* Axes */}
                <line
                  x1={0}
                  y1={GEO_CENTER_Y}
                  x2={GEO_WIDTH}
                  y2={GEO_CENTER_Y}
                  className="axis-line"
                />
                <line
                  x1={GEO_CENTER_X}
                  y1={0}
                  x2={GEO_CENTER_X}
                  y2={GEO_HEIGHT}
                  className="axis-line"
                />

                {/* Feature directions */}
                {projectedDirections.map((d) => {
                  const isActive = currentPrompt.features.includes(d.index)
                  const sx = GEO_CENTER_X
                  const sy = GEO_CENTER_Y
                  const ex = GEO_CENTER_X + d.x * GEO_SCALE
                  const ey = GEO_CENTER_Y - d.y * GEO_SCALE
                  return (
                    <line
                      key={d.index}
                      x1={sx}
                      y1={sy}
                      x2={ex}
                      y2={ey}
                      stroke={
                        isActive ? MATH_COLORS.accent : MATH_COLORS.secondary
                      }
                      strokeWidth={isActive ? 3 : 1.5}
                      strokeOpacity={isActive ? 0.95 : 0.5}
                    />
                  )
                })}

                {/* Crowd circle */}
                <circle
                  cx={GEO_CENTER_X}
                  cy={GEO_CENTER_Y}
                  r={GEO_SCALE}
                  fill="none"
                  stroke="#e5e7eb"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              </svg>
              <p className="caption">
                With only {dim} dimensions, you can still host many feature
                directions, but as you add more, they crowd together and become
                less orthogonal — that&apos;s interference.
              </p>
            </div>
          </div>

          {/* 2. Capacity vs interference */}
          <div className="panel">
            <h3>Capacity vs interference</h3>
            <p className="muted">
              Packing more features than dimensions is efficient, but eventually
              interference becomes too large and features stop being clean.
            </p>
            <svg
              width={CAP_WIDTH}
              height={CAP_HEIGHT}
              role="img"
              className="capacity-chart"
              aria-label="Capacity vs interference plot"
            >
              {/* Axes */}
              <line
                x1={xToCap(2)}
                y1={yToCap(0)}
                x2={xToCap(MAX_FEATURES)}
                y2={yToCap(0)}
                className="axis-line"
              />
              <line
                x1={xToCap(2)}
                y1={yToCap(0)}
                x2={xToCap(2)}
                y2={yToCap(1)}
                className="axis-line"
              />

              {/* Interference curve */}
              <path
                d={interferencePath}
                fill="none"
                stroke={MATH_COLORS.primary}
                strokeWidth={2}
              />

              {/* JL-ish theoretical curve */}
              <path
                d={jlPath}
                fill="none"
                stroke={MATH_COLORS.accent}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />

              {/* Current feature count */}
              <line
                x1={xToCap(featureCount)}
                y1={yToCap(0)}
                x2={xToCap(featureCount)}
                y2={yToCap(1)}
                stroke="#9ca3af"
                strokeDasharray="3 3"
                strokeWidth={1}
              />

              {/* Problematic interference threshold */}
              <line
                x1={xToCap(2)}
                y1={yToCap(problemInterferenceThreshold)}
                x2={xToCap(MAX_FEATURES)}
                y2={yToCap(problemInterferenceThreshold)}
                stroke="#ef4444"
                strokeDasharray="4 4"
                strokeWidth={1}
                opacity={0.8}
              />

              {/* Labels */}
              <text
                x={xToCap(MAX_FEATURES)}
                y={yToCap(0) + 18}
                fontSize={10}
                textAnchor="end"
                fill="#6b7280"
              >
                Number of features M
              </text>
              <text
                x={xToCap(2) - 10}
                y={yToCap(1)}
                fontSize={10}
                textAnchor="end"
                fill="#6b7280"
              >
                Interference
              </text>
            </svg>
            <div className="capacity-stats">
              <div>
                <span className="label">Current M:</span> {featureCount}
              </div>
              <div>
                <span className="label">Average interference:</span>{' '}
                {averageInterference.toFixed(2)}
              </div>
              <div>
                <span className="label">Regime:</span>{' '}
                {inHighInterference ? 'crowded / high interference' : 'safe-ish'}
              </div>
            </div>
            <p className="caption">
              The dashed purple curve is a rough Johnson–Lindenstrauss-style
              limit: beyond it, you can&apos;t keep all features nearly
              orthogonal. The red line marks where interference becomes
              noticeably problematic.
            </p>
          </div>
        </div>

        {/* Right column: sparse autoencoder + feature viewer */}
        <div className="superposition-right">
          {/* 3. Sparse autoencoder panel */}
          <div className="panel">
            <h3>Sparse autoencoder: decompression</h3>
            <p className="muted">
              We treat the feature directions as columns of a dictionary{' '}
              <code>A</code>, and we try to explain the activation vector{' '}
              <code>h</code> as <code>A s</code> with a sparse code{' '}
              <code>s</code>.
            </p>
            <div className="sparse-panel">
              <div className="sparse-input">
                <div className="sparse-header">
                  <span>Input activation h (neurons)</span>
                  <span className="small">
                    ‖h − ĥ‖₂ ≈ {coding.error.toFixed(3)}
                  </span>
                </div>
                <svg
                  width={320}
                  height={150}
                  role="img"
                  aria-label="Input and reconstructed activation vector"
                  className="sparse-chart"
                >
                  <line
                    x1={20}
                    y1={130}
                    x2={300}
                    y2={130}
                    className="axis-line"
                  />
                  {activation.map((v, i) => {
                    const reconVal = coding.recon[i] ?? 0
                    const barWidth = (280 / Math.max(dimCount, 1)) * 0.8
                    const gap = (280 / Math.max(dimCount, 1)) * 0.2
                    const x = 20 + i * (barWidth + gap)
                    const baseY = 130
                    const hHeight = (Math.abs(v) / maxDimVal) * 100
                    const rHeight = (Math.abs(reconVal) / maxDimVal) * 100
                    return (
                      <g key={i}>
                        {/* Original h */}
                        <rect
                          x={x}
                          y={baseY - hHeight}
                          width={barWidth / 2}
                          height={hHeight}
                          fill={MATH_COLORS.primary}
                          opacity={0.9}
                        />
                        {/* Reconstruction */}
                        <rect
                          x={x + barWidth / 2}
                          y={baseY - rHeight}
                          width={barWidth / 2}
                          height={rHeight}
                          fill={MATH_COLORS.secondary}
                          opacity={0.8}
                        />
                      </g>
                    )
                  })}
                  <text
                    x={300}
                    y={140}
                    fontSize={10}
                    textAnchor="end"
                    fill="#6b7280"
                  >
                    Neuron index
                  </text>
                </svg>
                <p className="caption">
                  The sparse code <code>s</code> chooses a few feature
                  directions that reconstruct h. Higher λ drops small features,
                  trading accuracy for interpretability.
                </p>
              </div>
            </div>
          </div>

          {/* 4 + 6. Feature activation viewer & polysemantic vs monosemantic */}
          <div className="panel">
            <h3>Which features fire?</h3>
            <p className="muted">
              Choose an input pattern and see which dictionary features light
              up. Compare feature directions (monosemantic) to individual
              neurons (polysemantic).
            </p>

            {/* Prompt chooser */}
            <div className="prompt-picker">
              <div className="prompt-label">Input pattern</div>
              <div className="prompt-buttons">
                {availablePrompts.map((p, idx) => (
                  <button
                    key={p.id}
                    type="button"
                    className={
                      idx === clampedPromptIndex ? 'prompt-btn active' : 'prompt-btn'
                    }
                    onClick={() => setPromptIndex(idx)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="caption">{currentPrompt.description}</p>
            </div>

            {/* Feature / neuron viewer */}
            {viewMode === 'features' ? (
              <>
                <div className="viewer-header">
                  <span>Active feature directions (sparse code s)</span>
                </div>
                <div className="feature-list">
                  {coding.sparse.slice(0, featureCount).map((v, i) => {
                    const magnitude = Math.abs(v)
                    const widthPct =
                      (magnitude / maxFeatureActivation) * 100 || 0
                    const isActive = magnitude > 0.02
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedFeature(i)}
                        className={
                          selectedFeature === i
                            ? 'feature-row selected'
                            : 'feature-row'
                        }
                      >
                        <div className="feature-meta">
                          <span className="feature-index">f{i + 1}</span>
                          <span className="feature-name">
                            {getFeatureName(i)}
                          </span>
                        </div>
                        <div className="feature-bar-track">
                          <div
                            className="feature-bar-fill"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: MATH_COLORS.primary,
                              opacity: isActive ? 0.9 : 0.15,
                            }}
                          />
                        </div>
                        <span className="feature-value">
                          {v >= 0 ? '+' : '-'}
                          {magnitude.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {selectedFeature != null && selectedFeature < featureCount && (
                  <div className="feature-detail">
                    <div className="feature-detail-title">
                      Feature f{selectedFeature + 1}:{' '}
                      {getFeatureName(selectedFeature)}
                    </div>
                    <p className="caption">
                      {getFeatureDescription(selectedFeature)}
                    </p>
                    <p className="caption">
                      Below is how this feature lives across neurons; no single
                      neuron is purely “the {getFeatureName(selectedFeature)} neuron”
                      – the meaning is in the direction, not in any one unit.
                    </p>
                    <div className="feature-neurons">
                      {activation.map((_, j) => {
                        const weight =
                          activeDictionary[selectedFeature][j] ?? 0
                        const mag = Math.abs(weight)
                        const widthPct = mag * 100
                        return (
                          <div key={j} className="neuron-row">
                            <span className="neuron-label">Neuron {j}</span>
                            <div className="neuron-bar-track">
                              <div
                                className="neuron-bar-fill"
                                style={{
                                  width: `${widthPct}%`,
                                  backgroundColor: MATH_COLORS.secondary,
                                  opacity: 0.9,
                                }}
                              />
                            </div>
                            <span className="neuron-weight">
                              {weight >= 0 ? '+' : '-'}
                              {mag.toFixed(2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
                <p className="caption">
                  In feature space, each direction can correspond to a fairly
                  clean concept (monosemantic), even though it is implemented as
                  a pattern of many neuron activations.
                </p>
              </>
            ) : (
              <>
                <div className="viewer-header">
                  <span>Neuron responses (polysemantic units)</span>
                </div>
                <div className="neuron-list">
                  {activation.map((v, j) => {
                    const mag = Math.abs(v)
                    const widthPct = (mag / maxNeuronActivation) * 100 || 0
                    return (
                      <button
                        key={j}
                        type="button"
                        onClick={() => setSelectedNeuron(j)}
                        className={
                          selectedNeuron === j
                            ? 'neuron-row selected'
                            : 'neuron-row'
                        }
                      >
                        <div className="neuron-meta">
                          <span className="neuron-label">Neuron {j}</span>
                        </div>
                        <div className="neuron-bar-track">
                          <div
                            className="neuron-bar-fill"
                            style={{
                              width: `${widthPct}%`,
                              backgroundColor: MATH_COLORS.accent,
                              opacity: 0.9,
                            }}
                          />
                        </div>
                        <span className="neuron-value">
                          {v >= 0 ? '+' : '-'}
                          {mag.toFixed(2)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                {selectedNeuron != null && selectedNeuron < dimCount && (
                  <div className="feature-detail">
                    <div className="feature-detail-title">
                      Neuron {selectedNeuron}: overlapping meanings
                    </div>
                    <p className="caption">
                      This neuron participates in several different feature
                      directions. That&apos;s polysemanticity: a single unit
                      helps represent multiple concepts at once.
                    </p>
                    <div className="feature-neurons">
                      {getTopContributorsForNeuron(
                        activeDictionary,
                        selectedNeuron,
                        featureCount,
                      ).map((c) => (
                        <div key={c.featureIndex} className="neuron-row">
                          <span className="neuron-label">
                            f{c.featureIndex + 1}:{' '}
                            {getFeatureName(c.featureIndex)}
                          </span>
                          <div className="neuron-bar-track">
                            <div
                              className="neuron-bar-fill"
                              style={{
                                width: `${c.weight * 100}%`,
                                backgroundColor: MATH_COLORS.secondary,
                                opacity: 0.9,
                              }}
                            />
                          </div>
                          <span className="neuron-weight">
                            {c.weight.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <p className="caption">
                  A single neuron is reused across many features. Sparse
                  autoencoders back out the cleaner feature directions, turning
                  tangled neurons into more interpretable, monosemantic
                  features.
                </p>
              </>
            )}

            <p className="muted">
              Superposition lets the model store M ≫ N features in an
              N-dimensional neuron space – great for capacity, tricky for
              interpretability. Sparse autoencoders learn a dictionary that
              approximately inverts this compression, revealing the underlying
              features used internally by models like Claude.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
