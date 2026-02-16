import { useEffect, useMemo, useState } from 'react'
import { MATH_COLORS, softmax, clamp } from '../../lib/mathObjects'

const WIDTH = 340
const HEIGHT = 220
const PADDING = 28
const EPS = 1e-8

const CATEGORIES = [
  { id: 'true', label: 'True answer' },
  { id: 'paraphrase', label: 'Paraphrase' },
  { id: 'distractor', label: 'Plausible distractor' },
  { id: 'nonsense', label: 'Nonsense' }
]

// Fixed "data" distribution p_data(x)
// Think: how often each type of answer actually appears in real data.
const P_TRUE = [0.55, 0.25, 0.15, 0.05]

type ModePreset = {
  id: string
  name: string
  description: string
  logits: number[]
}

const MODE_PRESETS: ModePreset[] = [
  {
    id: 'match',
    name: 'Well-trained (q ≈ p)',
    description: 'Model matches the data; both KLs are small.',
    logits: [1.2, 0.7, 0.0, -0.8]
  },
  {
    id: 'mode-cover',
    name: 'Mode-covering (forward KL-ish)',
    description:
      'Model spreads probability mass to avoid assigning zeros to any data mode.',
    logits: [0.8, 0.4, 0.2, -0.2]
  },
  {
    id: 'mode-seek',
    name: 'Mode-seeking (reverse KL-ish)',
    description:
      'Model collapses onto the most likely answer and mostly ignores other modes.',
    logits: [3.0, 0.2, -1.5, -2.5]
  },
  {
    id: 'missing-mode',
    name: 'Catastrophic miss',
    description:
      'Model basically ignores the true answer mode; forward KL / cross-entropy explode.',
    logits: [-3.5, 2.4, 1.6, 0.4]
  }
]

// Gamification types and challenges
type GamePhase = 'setup' | 'countdown' | 'revealed'
type KLPrediction = 'forward' | 'reverse' | null

interface KLChallenge {
  name: string
  logits: number[]
  question: string
  answer: 'forward' | 'reverse'
  explanation: string
}

// Mystery scenarios for the prediction game
const KL_CHALLENGES: KLChallenge[] = [
  {
    name: '🎲 Mystery A',
    logits: [2.5, 0.5, -1.0, -2.0],
    question: 'The model is confident on the true answer. Which KL dominates?',
    answer: 'reverse',
    explanation: '🎪 Reverse KL dominates! When the model concentrates mass on fewer modes than the data distribution, reverse KL (mode-seeking) is higher. The model "knows" what it likes but might miss some data modes.',
  },
  {
    name: '🎲 Mystery B',
    logits: [0.5, 0.3, 0.1, -0.1],
    question: 'The model spreads probability fairly evenly. Which KL dominates?',
    answer: 'forward',
    explanation: '🔍 Forward KL dominates! When the model is uncertain and spreads mass broadly, forward KL (mode-covering) is higher. This is the regime cross-entropy training pushes toward.',
  },
  {
    name: '🎲 Mystery C',
    logits: [-2.0, 1.5, 1.0, 0.5],
    question: 'The model avoids the true answer (mode collapse). Which KL dominates?',
    answer: 'forward',
    explanation: '🚨 Forward KL explodes! When q≈0 where p>0, forward KL becomes huge. This is the "catastrophic miss" that cross-entropy training prevents—the model must cover all data modes.',
  },
  {
    name: '🎲 Mystery D',
    logits: [1.0, 1.0, -1.5, -1.5],
    question: 'The model splits between "True" and "Paraphrase" only. Which KL dominates?',
    answer: 'reverse',
    explanation: '⚖️ Reverse KL dominates slightly! The model ignores "distractor" and "nonsense" where p has some mass, but the model\'s concentration on two modes means reverse KL (mode-seeking) wins.',
  },
]

// Educational feedback for predictions
function getKLFeedback(
  prediction: KLPrediction,
  challenge: KLChallenge
): string {
  if (prediction === null) return ''

  if (prediction === challenge.answer) {
    return `🎯 Correct! ${challenge.explanation}`
  } else {
    return `❌ Not quite! ${challenge.explanation}`
  }
}

function _entropy(p: number[]): number {
  let h = 0
  for (let i = 0; i < p.length; i++) {
    const v = clamp(p[i], EPS, 1)
    h += -v * Math.log(v)
  }
  return h
}

function getCrossEntropyInsight(
  klPQ: number,
  klQP: number,
  crossEntropy: number,
  entropyP: number,
  forwardSpike: boolean[],
  reverseSpike: boolean[],
  qModel: number[]
): { text: string; color: string; emoji: string } {
  const hasCatastrophicMiss = forwardSpike.some(Boolean)
  const hasReverseMismatch = reverseSpike.some(Boolean)
  const klRatio = klPQ / (klQP + EPS)
  const wellTrained = klPQ < 0.1 && klQP < 0.1
  const maxQ = Math.max(...qModel)
  const isOverconfident = maxQ > 0.9

  if (hasCatastrophicMiss) {
    return {
      emoji: '🚨',
      color: '#dc2626',
      text: 'Forward KL explodes when q≈0 where p>0! This is why cross-entropy training forces models to cover all data modes—hallucination is "safer" than missing the true answer.'
    }
  }

  if (wellTrained) {
    return {
      emoji: '🎯',
      color: '#059669',
      text: 'Excellent match! When q≈p, both KL directions are small. This is the goal of MLE training—though getting here requires enough capacity and data.'
    }
  }

  if (klRatio > 3) {
    return {
      emoji: '🔍',
      color: '#0891b2',
      text: 'Mode-covering regime: forward KL dominates. The model spreads probability mass broadly to avoid assigning zero to any data mode—a core property of cross-entropy training.'
    }
  }

  if (klRatio < 0.33) {
    return {
      emoji: '🎪',
      color: '#7c3aed',
      text: 'Mode-seeking regime: reverse KL dominates. The model concentrates on one mode while ignoring others. VAEs trained with reverse KL exhibit this "posterior collapse" behavior.'
    }
  }

  if (hasReverseMismatch) {
    return {
      emoji: '⚠️',
      color: '#d97706',
      text: 'The model places significant mass where data rarely appears. Reverse KL (used in RLHF) penalizes this heavily—it\'s why KL constraints prevent policy drift.'
    }
  }

  if (isOverconfident) {
    return {
      emoji: '📊',
      color: '#6366f1',
      text: `Model is confident (${(maxQ * 100).toFixed(0)}% on top choice). High confidence is fine when correct, but overconfidence on wrong answers gets heavily penalized by cross-entropy.`
    }
  }

  return {
    emoji: '📐',
    color: '#64748b',
    text: `H(p,q) = ${crossEntropy.toFixed(3)} = H(p) + KL(p||q) = ${entropyP.toFixed(3)} + ${klPQ.toFixed(3)}. This identity shows why minimizing cross-entropy equals minimizing forward KL (up to a constant).`
  }
}

export default function CrossEntropyKLDemo() {
  // Unnormalized model "logits" for each category. Softmax -> q_model(x).
  const [rawQ, setRawQ] = useState<number[]>(MODE_PRESETS[0].logits)
  const [activePreset, setActivePreset] = useState<string | null>(
    MODE_PRESETS[0].id
  )

  // Gamification state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<KLChallenge | null>(null)
  const [prediction, setPrediction] = useState<KLPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

  const qModel = useMemo(() => softmax(rawQ), [rawQ])

  const {
    entropyP,
    crossEntropy,
    klPQ,
    klQP,
    ceContribs,
    klPQContribs: _klPQContribs,
    klQPContribs: _klQPContribs,
    maxCEContrib,
    forwardSpike,
    reverseSpike
  } = useMemo(() => {
    const ce: number[] = []
    const k1: number[] = []
    const k2: number[] = []
    let hP = 0
    let hPQ = 0
    let kPQ = 0
    let kQP = 0

    for (let i = 0; i < P_TRUE.length; i++) {
      const p = clamp(P_TRUE[i], EPS, 1)
      const q = clamp(qModel[i], EPS, 1)

      const hPTerm = -p * Math.log(p)
      const ceTerm = -p * Math.log(q)
      const klPQTerm = p * Math.log(p / q)
      const klQPTerm = q * Math.log(q / p)

      hP += hPTerm
      hPQ += ceTerm
      kPQ += klPQTerm
      kQP += klQPTerm

      ce.push(ceTerm)
      k1.push(klPQTerm)
      k2.push(klQPTerm)
    }

    const maxCE = Math.max(...ce, EPS)

    // Where forward KL / cross-entropy "blows up" (p > 0, q ~ 0)
    const fSpike = P_TRUE.map(
      (p, i) => p > 0.05 && qModel[i] < 0.02 // q nearly zero where data has mass
    )

    // Where reverse KL gets upset (q big where p is tiny)
    const rSpike = P_TRUE.map(
      (p, i) => qModel[i] > 0.3 && p < 0.05 // model puts mass where data almost never goes
    )

    return {
      entropyP: hP,
      crossEntropy: hPQ,
      klPQ: kPQ,
      klQP: kQP,
      ceContribs: ce,
      klPQContribs: k1,
      klQPContribs: k2,
      maxCEContrib: maxCE,
      forwardSpike: fSpike,
      reverseSpike: rSpike
    }
  }, [qModel])

  const maxProb = 1 // probabilities are in [0,1]
  const innerWidth = WIDTH - 2 * PADDING
  const innerHeight = HEIGHT - 2 * PADDING
  const groupWidth = innerWidth / 2
  const barSpacing = groupWidth / (P_TRUE.length + 1)
  const barWidth = barSpacing * 0.5
  const baseY = HEIGHT - PADDING

  const probToHeight = (prob: number) => (prob / maxProb) * innerHeight

  const difference =
    crossEntropy - entropyP - klPQ // should be ~= 0 (floating-point noise)
  const forwardDominant = klPQ > klQP

  const catastrophicModes = CATEGORIES.filter(
    (_, i) => forwardSpike[i]
  ).map((c) => c.label)

  const currentInsight = useMemo(() => {
    return getCrossEntropyInsight(klPQ, klQP, crossEntropy, entropyP, forwardSpike, reverseSpike, qModel)
  }, [klPQ, klQP, crossEntropy, entropyP, forwardSpike, reverseSpike, qModel])

  const applyPreset = (preset: ModePreset) => {
    setRawQ(preset.logits)
    setActivePreset(preset.id)
  }

  const updateLogit = (index: number, value: number) => {
    setRawQ((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setActivePreset(null)
  }

  // Game control functions
  const startChallenge = (challenge: KLChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setCountdown(3)
    setGamePhase('countdown')
    // Load the mystery logits
    setRawQ(challenge.logits)
    setActivePreset(null)
  }

  const submitPrediction = () => {
    if (prediction === null || !selectedChallenge) return
    setGamePhase('revealed')
    // Score based on correctness
    if (prediction === selectedChallenge.answer) {
      setScore((s) => s + 10)
    }
    setCompletedChallenges((prev) => new Set([...prev, selectedChallenge.name]))
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(0)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [gamePhase, countdown])

  return (
    <section className="card interactive-card">
      <h2>Cross-Entropy, KL Direction & Mode Coverage</h2>
      <p className="muted">
        Compare a fixed "true" data distribution <code>p_data(x)</code> to a
        model distribution <code>q_model(x)</code>. Cross-entropy training uses
        forward KL, which punishes missing any data mode much more than placing
        extra mass on unlikely (even wrong) answers.
      </p>

      {/* Gamification Panel */}
      <div
        style={{
          padding: '14px 18px',
          marginBottom: '1rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setGameMode(!gameMode)
                if (gameMode) resetGame()
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: gameMode ? '1px solid rgba(168, 85, 247, 0.7)' : '1px solid rgba(148, 163, 184, 0.4)',
                background: gameMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                color: gameMode ? '#d8b4fe' : '#374151',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              {gameMode ? '🎮 Challenge Mode ON' : '🎯 Try KL Direction Quiz'}
            </button>
            {gameMode && (
              <span style={{ fontSize: '0.85rem', color: '#6366f1' }}>
                Score: <strong style={{ color: '#f59e0b' }}>{score}</strong>
              </span>
            )}
          </div>
        </div>

        {gameMode && gamePhase === 'setup' && (
          <div>
            <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '10px' }}>
              Select a challenge and predict whether forward KL or reverse KL will dominate:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {KL_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  type="button"
                  onClick={() => startChallenge(challenge)}
                  disabled={completedChallenges.has(challenge.name)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: completedChallenges.has(challenge.name)
                      ? '1px solid rgba(34, 197, 94, 0.5)'
                      : '1px solid rgba(56, 189, 248, 0.5)',
                    background: completedChallenges.has(challenge.name)
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(56, 189, 248, 0.1)',
                    color: completedChallenges.has(challenge.name) ? '#059669' : '#0284c7',
                    cursor: completedChallenges.has(challenge.name) ? 'default' : 'pointer',
                    fontSize: '0.8rem',
                    opacity: completedChallenges.has(challenge.name) ? 0.7 : 1,
                  }}
                >
                  {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameMode && gamePhase === 'countdown' && selectedChallenge && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: '#374151', marginBottom: '8px' }}>
              {selectedChallenge.question}
            </p>
            {countdown > 0 ? (
              <div style={{ fontSize: '2rem', color: '#f59e0b', fontWeight: 700 }}>{countdown}</div>
            ) : (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '10px' }}>
                  Look at the distributions above. Which KL direction dominates?
                </p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setPrediction('forward')}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: prediction === 'forward' ? '2px solid #0891b2' : '1px solid rgba(148, 163, 184, 0.4)',
                      background: prediction === 'forward' ? 'rgba(8, 145, 178, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                      color: prediction === 'forward' ? '#0891b2' : '#374151',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: prediction === 'forward' ? 700 : 400,
                    }}
                  >
                    🔍 Forward KL<br/><span style={{ fontSize: '0.7rem', opacity: 0.7 }}>mode-covering</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrediction('reverse')}
                    style={{
                      padding: '12px 24px',
                      borderRadius: '8px',
                      border: prediction === 'reverse' ? '2px solid #7c3aed' : '1px solid rgba(148, 163, 184, 0.4)',
                      background: prediction === 'reverse' ? 'rgba(124, 58, 237, 0.2)' : 'rgba(255, 255, 255, 0.9)',
                      color: prediction === 'reverse' ? '#7c3aed' : '#374151',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      fontWeight: prediction === 'reverse' ? 700 : 400,
                    }}
                  >
                    🎪 Reverse KL<br/><span style={{ fontSize: '0.7rem', opacity: 0.7 }}>mode-seeking</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={submitPrediction}
                  disabled={prediction === null}
                  style={{
                    marginTop: '12px',
                    padding: '8px 24px',
                    borderRadius: '999px',
                    border: 'none',
                    background: prediction !== null
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'rgba(148, 163, 184, 0.5)',
                    color: prediction !== null ? '#111827' : '#6b7280',
                    cursor: prediction !== null ? 'pointer' : 'default',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  Submit Prediction
                </button>
              </div>
            )}
          </div>
        )}

        {gameMode && gamePhase === 'revealed' && selectedChallenge && (
          <div>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(251, 146, 60, 0.1)',
                border: `1px solid ${prediction === selectedChallenge.answer ? 'rgba(34, 197, 94, 0.5)' : 'rgba(251, 146, 60, 0.4)'}`,
                marginBottom: '10px',
              }}
            >
              <p style={{ fontSize: '0.85rem', color: '#374151', margin: 0 }}>
                Your prediction: <strong>{prediction === 'forward' ? 'Forward KL' : 'Reverse KL'}</strong> |
                Correct: <strong>{selectedChallenge.answer === 'forward' ? 'Forward KL' : 'Reverse KL'}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#6b7280', margin: '6px 0 0 0' }}>
                {getKLFeedback(prediction, selectedChallenge)}
              </p>
            </div>
            <button
              type="button"
              onClick={resetGame}
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background: 'rgba(255, 255, 255, 0.9)',
                color: '#374151',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Try Another Challenge
            </button>
          </div>
        )}
      </div>

      <div className="guided-prompts">
        <span className="guided-label">Scenarios:</span>
        {MODE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => applyPreset(preset)}
            className={`guided-btn ${
              activePreset === preset.id ? 'active' : ''
            }`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>
      {activePreset && (
        <p className="guided-description">
          {MODE_PRESETS.find((p) => p.id === activePreset)?.description}
        </p>
      )}

      <div className="cekl-layout">
        <svg
          width={WIDTH}
          height={HEIGHT}
          className="cekl-chart"
          role="img"
          aria-label="Bar charts comparing data distribution p and model distribution q, with cross-entropy and KL penalties highlighted."
        >
          {/* Baseline and split between p and q panels */}
          <line
            x1={PADDING}
            y1={baseY}
            x2={WIDTH - PADDING}
            y2={baseY}
            className="axis-line"
          />
          <line
            x1={PADDING + groupWidth}
            y1={PADDING}
            x2={PADDING + groupWidth}
            y2={HEIGHT - PADDING}
            className="axis-line"
          />

          {/* Labels for the two panels */}
          <text
            x={PADDING + groupWidth / 2}
            y={PADDING - 6}
            textAnchor="middle"
            className="axis-label"
          >
            p_data(x) (true distribution)
          </text>
          <text
            x={PADDING + groupWidth + groupWidth / 2}
            y={PADDING - 6}
            textAnchor="middle"
            className="axis-label"
          >
            q_model(x) (what the model believes)
          </text>

          {/* p_data bars */}
          {P_TRUE.map((pVal, i) => {
            const h = probToHeight(pVal)
            const x =
              PADDING + groupWidth * 0 + barSpacing * (i + 1) - barWidth / 2
            const y = baseY - h
            return (
              <g key={`p-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={MATH_COLORS.secondary}
                  opacity={0.9}
                />
                <text
                  x={x + barWidth / 2}
                  y={baseY + 14}
                  textAnchor="middle"
                  className="tick-label"
                >
                  {CATEGORIES[i].label}
                </text>
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="value-label"
                >
                  {pVal.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* q_model bars with cross-entropy intensity + KL direction highlights */}
          {qModel.map((qVal, i) => {
            const h = probToHeight(qVal)
            const x =
              PADDING + groupWidth * 1 + barSpacing * (i + 1) - barWidth / 2
            const y = baseY - h
            const ceNorm = ceContribs[i] / maxCEContrib
            const isForwardSpike = forwardSpike[i]
            const isReverseSpike = reverseSpike[i]

            return (
              <g key={`q-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={barWidth}
                  height={h}
                  fill={MATH_COLORS.primary}
                  fillOpacity={0.25 + 0.65 * ceNorm}
                />
                {/* Forward KL (p || q) spike: p cares but q ~ 0 */}
                {isForwardSpike && (
                  <rect
                    x={x - 2}
                    y={y - 2}
                    width={barWidth + 4}
                    height={h + 4}
                    fill="none"
                    stroke={MATH_COLORS.negative}
                    strokeWidth={2}
                    strokeDasharray="4 2"
                  />
                )}
                {/* Reverse KL (q || p) spike: q puts mass where p is tiny */}
                {isReverseSpike && (
                  <line
                    x1={x + barWidth / 2}
                    y1={y - 6}
                    x2={x + barWidth / 2}
                    y2={y - 18}
                    stroke={MATH_COLORS.accent}
                    strokeWidth={2}
                    markerEnd="url(#arrowhead)"
                  />
                )}
                <text
                  x={x + barWidth / 2}
                  y={y - 4}
                  textAnchor="middle"
                  className="value-label"
                >
                  {qVal.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* Arrowhead marker for reverse-KL spikes */}
          <defs>
            <marker
              id="arrowhead"
              markerWidth="6"
              markerHeight="6"
              refX="3"
              refY="3"
              orient="auto"
            >
              <path
                d="M0,0 L6,3 L0,6 Z"
                fill={MATH_COLORS.accent}
              />
            </marker>
          </defs>

          {/* Legend */}
          <g className="cekl-legend">
            <rect
              x={PADDING}
              y={PADDING + 8}
              width={12}
              height={12}
              fill={MATH_COLORS.secondary}
              opacity={0.9}
            />
            <text
              x={PADDING + 18}
              y={PADDING + 18}
              className="legend-label"
            >
              height = probability under p(x) or q(x)
            </text>

            <rect
              x={PADDING}
              y={PADDING + 26}
              width={12}
              height={12}
              fill={MATH_COLORS.primary}
              fillOpacity={0.8}
            />
            <text
              x={PADDING + 18}
              y={PADDING + 36}
              className="legend-label"
            >
              brighter q-bar = larger contribution to H(p, q)
            </text>

            <rect
              x={PADDING}
              y={PADDING + 44}
              width={12}
              height={12}
              fill="none"
              stroke={MATH_COLORS.negative}
              strokeWidth={2}
              strokeDasharray="4 2"
            />
            <text
              x={PADDING + 18}
              y={PADDING + 54}
              className="legend-label"
            >
              red outline: forward KL spike (p&gt;0, q≈0)
            </text>

            <line
              x1={PADDING}
              y1={PADDING + 64}
              x2={PADDING + 12}
              y2={PADDING + 64}
              stroke={MATH_COLORS.accent}
              strokeWidth={2}
              markerEnd="url(#arrowhead)"
            />
            <text
              x={PADDING + 18}
              y={PADDING + 68}
              className="legend-label"
            >
              purple arrow: reverse KL spike (q≫p)
            </text>
          </g>
        </svg>

        <div className="cekl-controls">
          <div className="cekl-stats-grid">
            <div className="stat">
              <div className="label">
                H(p) <span className="muted">(data entropy, constant)</span>
              </div>
              <div className="value">{entropyP.toFixed(3)} nats</div>
            </div>
            <div className="stat">
              <div className="label">
                H(p, q) <span className="muted">(cross-entropy)</span>
              </div>
              <div className="value">{crossEntropy.toFixed(3)} nats</div>
            </div>
            <div className="stat">
              <div className="label">
                KL(p‖q) <span className="muted">(forward KL)</span>
              </div>
              <div className="value">{klPQ.toFixed(3)} nats</div>
            </div>
            <div className="stat">
              <div className="label">
                KL(q‖p) <span className="muted">(reverse KL)</span>
              </div>
              <div className="value">{klQP.toFixed(3)} nats</div>
            </div>
          </div>

          <div
            style={{
              padding: '12px 16px',
              marginBottom: '12px',
              borderRadius: '8px',
              background: `linear-gradient(135deg, ${currentInsight.color}15 0%, ${currentInsight.color}08 100%)`,
              border: `1px solid ${currentInsight.color}30`,
            }}
          >
            <span style={{ fontSize: '1.2em', marginRight: '8px' }}>{currentInsight.emoji}</span>
            <span style={{ color: currentInsight.color, fontWeight: 500 }}>Insight:</span>{' '}
            <span style={{ color: '#374151' }}>{currentInsight.text}</span>
          </div>

          <p className="caption">
            Numerically, <code>H(p, q) - H(p) ≈ KL(p‖q)</code>:
            &nbsp;
            <code>{(crossEntropy - entropyP).toFixed(4)}</code> vs{' '}
            <code>{klPQ.toFixed(4)}</code>, difference{' '}
            <code>{difference.toExponential(2)}</code>.
            Minimizing cross-entropy is the same as minimizing forward KL, up
            to the constant <code>H(p)</code>.
          </p>

          <div className="cekl-direction">
            <strong>KL direction right now:</strong>{' '}
            {forwardDominant ? (
              <span className="forward-kl">
                forward KL (p_data‖q_model) dominates ⇒ mode-covering pressure
              </span>
            ) : (
              <span className="reverse-kl">
                reverse KL (q_model‖p_data) dominates ⇒ mode-seeking pressure
              </span>
            )}
          </div>

          {catastrophicModes.length > 0 && (
            <p className="warning">
              ⚠ Forward KL spike: the model assigns almost zero probability to{' '}
              <strong>{catastrophicModes.join(', ')}</strong>. Cross-entropy
              loss becomes extremely large here, so training will strongly push
              the model to{' '}
              <em>cover</em> these modes rather than ever assigning them zero.
            </p>
          )}

          <div className="cekl-sliders">
            {CATEGORIES.map((cat, i) => (
              <label className="slider-label" key={cat.id}>
                Model preference for {cat.label}{' '}
                <span className="muted">
                  (q ≈ {qModel[i].toFixed(2)})
                </span>
                <input
                  type="range"
                  min={-4}
                  max={4}
                  step={0.1}
                  value={rawQ[i]}
                  onChange={(e) =>
                    updateLogit(i, parseFloat(e.target.value))
                  }
                />
              </label>
            ))}
          </div>

          <p className="caption">
            Sliders control unnormalized{' '}
            <code>logits</code> for each outcome. Softmax turns them into a
            probability distribution <code>q_model(x)</code>. Forward KL (used
            by maximum likelihood / cross-entropy training) heavily penalizes
            missing any outcome that actually appears in the data, so the model
            prefers to <strong>cover all modes</strong> – even if that means
            putting some probability on distractors or nonsense. This mode
            coverage pressure under distribution shift is one reason LLMs can
            hallucinate: they would rather guess than risk assigning zero
            probability to the true answer.
          </p>
        </div>
      </div>
    </section>
  )
}
