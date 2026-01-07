'use client'

import { useEffect, useState } from 'react'

// ----- Gamification types -----
type GamePhase = 'setup' | 'countdown' | 'revealed'
type AlignmentPrediction = 'A' | 'B' | 'C' | null

type AlignmentChallenge = {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  answer: 'A' | 'B' | 'C'
  insight: string
}

const ALIGNMENT_CHALLENGES: AlignmentChallenge[] = [
  {
    name: '🎲 Key Difference',
    question: 'What is the KEY difference between RLHF and DPO?',
    optionA: 'DPO uses more data',
    optionB: 'DPO skips reward model',
    optionC: 'RLHF is faster',
    answer: 'B',
    insight: 'DPO\'s key insight: the reward model is implicit! By deriving a closed-form loss from preference data, DPO directly optimizes the policy without needing a separate reward model training stage.'
  },
  {
    name: '🎲 DPO Loss Effect',
    question: 'What does the DPO loss do to the model\'s output probabilities?',
    optionA: '↑ chosen, ↓ rejected',
    optionB: '↑ both equally',
    optionC: 'Only changes rejected',
    answer: 'A',
    insight: 'DPO loss is: log σ(β · (log π(chosen) - log π(rejected))). It maximizes the gap between chosen and rejected log-probs, pushing chosen probability UP and rejected probability DOWN simultaneously.'
  },
  {
    name: '🎲 Training Stability',
    question: 'Which method typically has MORE STABLE training?',
    optionA: 'RLHF (PPO is robust)',
    optionB: 'DPO (simpler objective)',
    optionC: 'Both equally stable',
    answer: 'B',
    insight: 'DPO is typically more stable because it uses a simple supervised loss on preference pairs. RLHF\'s PPO stage involves reward estimation, value function updates, and policy clipping—more moving parts means more instability.'
  },
  {
    name: '🎲 Compute Cost',
    question: 'Which method requires LESS compute for alignment (after SFT)?',
    optionA: 'RLHF (reward model is cheap)',
    optionB: 'DPO (fewer components)',
    optionC: 'Same compute',
    answer: 'B',
    insight: 'DPO requires less compute because: (1) no reward model training, (2) no value function, (3) no iterative RL rollouts. Just one supervised training pass on preference pairs!'
  }
]

function getAlignmentFeedback(predicted: AlignmentPrediction, challenge: AlignmentChallenge): string {
  if (!predicted) return ''
  const isCorrect = predicted === challenge.answer
  const correctLabel = challenge.answer === 'A' ? challenge.optionA : challenge.answer === 'B' ? challenge.optionB : challenge.optionC
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}`
  }
  return `✗ The answer is "${correctLabel}". ${challenge.insight}`
}

type Mode = 'rlhf' | 'dpo'

const RLHF_COLOR = '#6366f1' // deeper, more complex pipeline
const DPO_COLOR = '#22c55e'  // brighter, simpler pipeline
const BG_COLOR = '#080c14'

const RLHF_PIPELINE = [
  'Pretrained base model',
  'Supervised fine-tuning (SFT)',
  'Train reward model on preference data',
  'RL fine-tuning (PPO) w/ reward model',
  'Aligned policy',
]

const DPO_PIPELINE = [
  'Pretrained base model',
  'Supervised fine-tuning (SFT)',
  'Direct Preference Optimization on preference pairs',
  'Aligned policy',
]

export default function RLHFDPOAlignment() {
  const [mode, setMode] = useState<Mode>('rlhf')
  const [dpoStep, setDpoStep] = useState<0 | 1>(0)

  // ----- Gamification state -----
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<AlignmentChallenge | null>(null)
  const [prediction, setPrediction] = useState<AlignmentPrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  function startChallenge(challenge: AlignmentChallenge) {
    setActiveChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
  }

  function submitPrediction() {
    if (!prediction || !activeChallenge) return
    setGamePhase('countdown')
    setCountdown(3)
  }

  function resetGame() {
    setActiveChallenge(null)
    setPrediction(null)
    setGamePhase('setup')
  }

  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      if (activeChallenge && prediction) {
        const isCorrect = prediction === activeChallenge.answer
        setScore(prev => ({
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1
        }))
      }
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, activeChallenge, prediction])

  const activePipeline = mode === 'rlhf' ? RLHF_PIPELINE : DPO_PIPELINE

  const pipelineStats = {
    steps: activePipeline.length,
    // "trainable components" is conceptual: separate learned modules that require their own training loop
    trainableComponents: mode === 'rlhf' ? 2 : 1, // policy + reward model vs policy only
    preferenceTrainingStages: mode === 'rlhf' ? 2 : 1, // reward-model training + RL vs single DPO
  }

  const stabilityMetric = {
    rlhf: 0.55,
    dpo: 0.85,
  }

  const computeCostMetric = {
    rlhf: 0.9,
    dpo: 0.6,
  }

  const dpoScenario =
    dpoStep === 0
      ? {
          label: 'Before DPO update',
          chosenProb: 0.55,
          rejectedProb: 0.45,
        }
      : {
          label: 'After DPO update',
          chosenProb: 0.85,
          rejectedProb: 0.15,
        }

  return (
    <section
      style={{
        background: BG_COLOR,
        borderRadius: 16,
        padding: 24,
        border: '1px solid rgba(148, 163, 184, 0.35)',
        color: '#e5e7eb',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '0.02em',
              marginBottom: 4,
            }}
          >
            RLHF vs DPO for Alignment
          </h2>
          <p
            style={{
              fontSize: 14,
              color: '#9ca3af',
              maxWidth: 520,
            }}
          >
            RLHF trains a separate reward model and then runs RL (PPO) against it.
            DPO skips the reward model and directly optimizes the policy on
            preference pairs.
          </p>
        </div>

        <div
          style={{
            display: 'inline-flex',
            background: 'rgba(15, 23, 42, 0.9)',
            borderRadius: 999,
            padding: 4,
            border: '1px solid rgba(148, 163, 184, 0.35)',
          }}
          aria-label="Toggle alignment training pipeline"
        >
          <button
            type="button"
            onClick={() => setMode('rlhf')}
            aria-pressed={mode === 'rlhf'}
            style={{
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              color: mode === 'rlhf' ? '#111827' : '#9ca3af',
              background:
                mode === 'rlhf'
                  ? RLHF_COLOR
                  : 'transparent',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            RLHF pipeline
          </button>
          <button
            type="button"
            onClick={() => setMode('dpo')}
            aria-pressed={mode === 'dpo'}
            style={{
              borderRadius: 999,
              padding: '6px 14px',
              fontSize: 12,
              border: 'none',
              cursor: 'pointer',
              color: mode === 'dpo' ? '#022c22' : '#9ca3af',
              background:
                mode === 'dpo'
                  ? DPO_COLOR
                  : 'transparent',
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            DPO pipeline
          </button>
        </div>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
          gap: 20,
        }}
      >
        {/* Left: Pipelines + simplification + metrics */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Pipelines diagram */}
          <div
            style={{
              borderRadius: 14,
              padding: 16,
              background:
                'radial-gradient(circle at top left, rgba(148, 163, 184, 0.12), transparent 60%)',
              border: '1px solid rgba(55, 65, 81, 0.7)',
            }}
          >
            <p
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.13em',
                color: '#9ca3af',
                marginBottom: 10,
              }}
            >
              Alignment training pipeline
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                rowGap: 10,
              }}
            >
              {/* RLHF row */}
              <PipelineRow
                label="RLHF"
                color={RLHF_COLOR}
                steps={RLHF_PIPELINE}
                isActive={mode === 'rlhf'}
                badge="Reward model + PPO"
              />

              {/* DPO row */}
              <PipelineRow
                label="DPO"
                color={DPO_COLOR}
                steps={DPO_PIPELINE}
                isActive={mode === 'dpo'}
                badge="Direct preference optimization"
              />
            </div>

            {/* Simplification callout */}
            <div
              style={{
                marginTop: 12,
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                color: '#9ca3af',
              }}
            >
              <div>
                <strong style={{ color: '#e5e7eb', fontWeight: 500 }}>
                  Simplification:
                </strong>{' '}
                DPO removes the <span style={{ color: DPO_COLOR }}>reward model training stage</span>{' '}
                and directly adjusts the policy using preference pairs.
              </div>
              <div
                style={{
                  display: 'flex',
                  gap: 16,
                  flexWrap: 'wrap',
                  marginTop: 4,
                }}
              >
                <StatPill
                  label="Pipeline steps"
                  value={pipelineStats.steps.toString()}
                  highlightColor={mode === 'rlhf' ? RLHF_COLOR : DPO_COLOR}
                />
                <StatPill
                  label="Trainable components"
                  value={pipelineStats.trainableComponents.toString()}
                  highlightColor={mode === 'rlhf' ? RLHF_COLOR : DPO_COLOR}
                />
                <StatPill
                  label="Preference-training stages"
                  value={pipelineStats.preferenceTrainingStages.toString()}
                  highlightColor={mode === 'rlhf' ? RLHF_COLOR : DPO_COLOR}
                />
              </div>
            </div>
          </div>

          {/* Stability vs compute cost */}
          <div
            style={{
              borderRadius: 14,
              padding: 16,
              background:
                'linear-gradient(to bottom right, rgba(15, 23, 42, 0.95), rgba(15, 23, 42, 0.9))',
              border: '1px solid rgba(55, 65, 81, 0.9)',
            }}
          >
            <p
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.13em',
                color: '#9ca3af',
                marginBottom: 10,
              }}
            >
              Training characteristics
            </p>

            <MetricRow
              label="Training stability"
              description="How noisy / fragile optimization feels (higher is more stable)."
              rlhf={stabilityMetric.rlhf}
              dpo={stabilityMetric.dpo}
              active={mode}
            />

            <MetricRow
              label="Compute cost"
              description="Relative training cost once you already have SFT data (lower is better)."
              rlhf={computeCostMetric.rlhf}
              dpo={computeCostMetric.dpo}
              active={mode}
              invert // lower is better
            />
          </div>
        </div>

        {/* Right: preference pairs + DPO loss visualization */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {/* Preference pair card */}
          <div
            style={{
              borderRadius: 14,
              padding: 16,
              background:
                'radial-gradient(circle at top right, rgba(56, 189, 248, 0.09), rgba(15, 23, 42, 0.96))',
              border: '1px solid rgba(55, 65, 81, 0.9)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p
              style={{
                fontSize: 12,
                textTransform: 'uppercase',
                letterSpacing: '0.13em',
                color: '#9ca3af',
              }}
            >
              Preference pair
            </p>

            <PreferenceBlock
              label="Prompt"
              body="Explain RLHF and DPO to a non-expert and mention why DPO can be simpler."
            />
            <PreferenceBlock
              label="Chosen response"
              body="DPO skips the reward-model stage and directly updates the policy on preference pairs, which usually makes training more stable and cheaper than RLHF."
              variant="chosen"
            />
            <PreferenceBlock
              label="Rejected response"
              body="RLHF and DPO are basically the same thing; DPO still needs to train a separate reward model first."
              variant="rejected"
            />
          </div>

          {/* DPO loss effect */}
          <div
            style={{
              borderRadius: 14,
              padding: 16,
              background:
                'radial-gradient(circle at bottom left, rgba(34, 197, 94, 0.18), rgba(15, 23, 42, 0.97))',
              border: '1px solid rgba(34, 197, 94, 0.5)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 10,
                gap: 8,
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: 12,
                    textTransform: 'uppercase',
                    letterSpacing: '0.13em',
                    color: '#bbf7d0',
                  }}
                >
                  DPO loss effect
                </p>
                <p
                  style={{
                    fontSize: 13,
                    color: '#d1fae5',
                  }}
                >
                  Pushes the{' '}
                  <span style={{ color: '#bbf7d0' }}>chosen</span> log‑prob up and the{' '}
                  <span style={{ color: '#fecaca' }}>rejected</span> log‑prob down.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDpoStep(prev => (prev === 0 ? 1 : 0))}
                style={{
                  borderRadius: 999,
                  padding: '6px 12px',
                  fontSize: 12,
                  border: '1px solid rgba(34, 197, 94, 0.8)',
                  background:
                    dpoStep === 0
                      ? 'rgba(6, 78, 59, 0.8)'
                      : 'rgba(22, 163, 74, 0.9)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {dpoStep === 0 ? 'Apply DPO update' : 'Reset'}
              </button>
            </div>

            <p
              style={{
                fontSize: 11,
                color: '#9ca3af',
                marginBottom: 12,
              }}
            >
              {dpoScenario.label}: the loss encourages a gap between{' '}
              <span style={{ color: '#bbf7d0' }}>chosen</span> and{' '}
              <span style={{ color: '#fecaca' }}>rejected</span> responses for each preference pair.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                gap: 32,
                height: 140,
              }}
            >
              <ProbabilityBar
                label="Chosen"
                probability={dpoScenario.chosenProb}
                color={DPO_COLOR}
                accent="up"
              />
              <div
                style={{
                  height: 80,
                  width: 1,
                  background: 'rgba(148, 163, 184, 0.35)',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: -18,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: 10,
                    color: '#9ca3af',
                    whiteSpace: 'nowrap',
                  }}
                >
                  logits gap ↑
                </div>
              </div>
              <ProbabilityBar
                label="Rejected"
                probability={dpoScenario.rejectedProb}
                color="#f97373"
                accent="down"
              />
            </div>

            <p
              style={{
                marginTop: 10,
                fontSize: 11,
                color: '#9ca3af',
              }}
            >
              In RLHF, the reward model first learns scores for chosen vs rejected.
              PPO then indirectly nudges these probabilities via RL. DPO folds that
              into a single loss directly on the policy.
            </p>
          </div>
        </div>
      </div>

      {/* Game Panel */}
      <div
        style={{
          marginTop: 16,
          padding: '14px 16px',
          borderRadius: 12,
          background: 'rgba(15, 23, 42, 0.6)',
          border: '1px solid rgba(148, 163, 184, 0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: '#f9fafb' }}>🎮 Alignment Challenge</span>
          {score.total > 0 && (
            <span style={{ fontSize: 12, color: '#14b8a6', fontWeight: 500 }}>
              Score: {score.correct}/{score.total}
            </span>
          )}
        </div>

        {!activeChallenge ? (
          <div>
            <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 10px' }}>Test your understanding of RLHF vs DPO:</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ALIGNMENT_CHALLENGES.map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => startChallenge(ch)}
                  style={{
                    padding: '6px 12px',
                    fontSize: 12,
                    background: 'rgba(59, 130, 246, 0.15)',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    borderRadius: 999,
                    color: '#93c5fd',
                    cursor: 'pointer',
                  }}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        ) : gamePhase === 'setup' ? (
          <div>
            <p style={{ fontSize: 14, color: '#f9fafb', margin: '0 0 12px', lineHeight: 1.4 }}>{activeChallenge.question}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {(['A', 'B', 'C'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setPrediction(opt)}
                  style={{
                    padding: '8px 12px',
                    fontSize: 13,
                    background: prediction === opt ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.8)',
                    border: `1px solid ${prediction === opt ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                    borderRadius: 8,
                    color: prediction === opt ? '#fbbf24' : '#e5e7eb',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {opt === 'A' ? activeChallenge.optionA : opt === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={submitPrediction}
                disabled={!prediction}
                style={{
                  flex: 1,
                  padding: '8px 14px',
                  fontSize: 13,
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  borderRadius: 8,
                  color: '#fbbf24',
                  cursor: prediction ? 'pointer' : 'not-allowed',
                  opacity: prediction ? 1 : 0.5,
                }}
              >
                Submit
              </button>
              <button
                onClick={resetGame}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  background: 'transparent',
                  border: '1px solid rgba(148, 163, 184, 0.3)',
                  borderRadius: 8,
                  color: '#9ca3af',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : gamePhase === 'countdown' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16 }}>
            <span style={{ fontSize: 32, fontWeight: 700, color: '#f59e0b' }}>{countdown}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>Revealing...</span>
          </div>
        ) : (
          <div style={{ padding: '8px 0' }}>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: '#e5e7eb', margin: '0 0 12px' }}>
              {getAlignmentFeedback(prediction, activeChallenge)}
            </p>
            <button
              onClick={resetGame}
              style={{
                width: '100%',
                padding: '8px 14px',
                fontSize: 13,
                background: 'rgba(20, 184, 166, 0.2)',
                border: '1px solid rgba(20, 184, 166, 0.5)',
                borderRadius: 8,
                color: '#2dd4bf',
                cursor: 'pointer',
              }}
            >
              Try Another Challenge
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/* -------------------------------------------------------------------------- */
/*  Subcomponents                                                             */
/* -------------------------------------------------------------------------- */

interface PipelineRowProps {
  label: string
  badge: string
  color: string
  steps: string[]
  isActive: boolean
}

function PipelineRow({ label, badge, color, steps, isActive }: PipelineRowProps) {
  return (
    <div
      style={{
        padding: 10,
        borderRadius: 10,
        background: isActive
          ? 'rgba(15, 23, 42, 0.95)'
          : 'rgba(15, 23, 42, 0.7)',
        border: `1px solid ${
          isActive ? 'rgba(148, 163, 184, 0.8)' : 'rgba(55, 65, 81, 0.9)'
        }`,
        boxShadow: isActive
          ? `0 0 0 1px ${color}44, 0 16px 40px rgba(15, 23, 42, 0.9)`
          : 'none',
        transition: 'background 0.15s ease, box-shadow 0.15s ease, border 0.15s ease',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 8,
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '999px',
              background: color,
              boxShadow: `0 0 0 4px ${color}33`,
            }}
          />
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {label}
          </div>
        </div>
        <div
          style={{
            fontSize: 10,
            padding: '2px 7px',
            borderRadius: 999,
            border: `1px solid ${color}66`,
            color,
            background: `${color}11`,
            whiteSpace: 'nowrap',
          }}
        >
          {badge}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          gap: 8,
          alignItems: 'center',
          overflowX: 'auto',
          paddingBottom: 4,
        }}
      >
        {steps.map((step, index) => (
          <div
            key={`${label}-${index}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                border: `1px solid ${color}55`,
                background: `${color}10`,
                fontSize: 11,
                whiteSpace: 'nowrap',
              }}
            >
              {step}
            </div>
            {index < steps.length - 1 && (
              <div
                aria-hidden="true"
                style={{
                  width: 20,
                  height: 1,
                  background:
                    label === 'DPO'
                      ? `${DPO_COLOR}aa`
                      : `${RLHF_COLOR}aa`,
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    right: -1,
                    top: -3,
                    width: 0,
                    height: 0,
                    borderTop: '4px solid transparent',
                    borderBottom: '4px solid transparent',
                    borderLeft: `5px solid ${
                      label === 'DPO' ? DPO_COLOR : RLHF_COLOR
                    }`,
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface StatPillProps {
  label: string
  value: string
  highlightColor: string
}

function StatPill({ label, value, highlightColor }: StatPillProps) {
  return (
    <div
      style={{
        borderRadius: 999,
        padding: '6px 10px',
        fontSize: 11,
        background: 'rgba(15, 23, 42, 0.9)',
        border: '1px solid rgba(55, 65, 81, 0.9)',
        display: 'flex',
        gap: 6,
        alignItems: 'baseline',
      }}
    >
      <span style={{ color: '#9ca3af' }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: highlightColor,
        }}
      >
        {value}
      </span>
    </div>
  )
}

interface MetricRowProps {
  label: string
  description: string
  rlhf: number
  dpo: number
  active: Mode
  /** If true, lower is better (e.g. cost) */
  invert?: boolean
}

function MetricRow({ label, description, rlhf, dpo, active, invert }: MetricRowProps) {
  const maxWidth = 140

  const betterText = invert ? 'lower is better' : 'higher is better'

  const normalize = (v: number) => Math.max(0.1, Math.min(1, v))

  return (
    <div
      style={{
        marginBottom: 10,
        paddingBottom: 10,
        borderBottom: '1px dashed rgba(55, 65, 81, 0.8)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 10,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
          }}
        >
          {betterText}
        </div>
      </div>

      <p
        style={{
          fontSize: 11,
          color: '#9ca3af',
          marginBottom: 8,
        }}
      >
        {description}
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <MetricBar
          label="RLHF"
          color={RLHF_COLOR}
          value={normalize(rlhf)}
          maxWidth={maxWidth}
          emphasized={active === 'rlhf'}
        />
        <MetricBar
          label="DPO"
          color={DPO_COLOR}
          value={normalize(dpo)}
          maxWidth={maxWidth}
          emphasized={active === 'dpo'}
        />
      </div>
    </div>
  )
}

interface MetricBarProps {
  label: string
  value: number // 0–1
  color: string
  maxWidth: number
  emphasized: boolean
}

function MetricBar({ label, value, color, maxWidth, emphasized }: MetricBarProps) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <span
        style={{
          fontSize: 11,
          color: '#e5e7eb',
          width: 40,
        }}
      >
        {label}
      </span>
      <div
        style={{
          position: 'relative',
          flex: 1,
          maxWidth,
          height: 8,
          borderRadius: 999,
          background: 'rgba(31, 41, 55, 0.9)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            opacity: emphasized ? 0.45 : 0.25,
            background: `linear-gradient(90deg, ${color}44, transparent)`,
          }}
        />
        <div
          style={{
            width: `${Math.round(value * 100)}%`,
            height: '100%',
            borderRadius: 999,
            background: color,
            boxShadow: emphasized ? `0 0 10px ${color}aa` : 'none',
            transition: 'width 0.2s ease, box-shadow 0.2s ease',
          }}
        />
      </div>
      <span
        style={{
          fontSize: 11,
          color: '#9ca3af',
          width: 32,
          textAlign: 'right',
        }}
      >
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}

interface PreferenceBlockProps {
  label: string
  body: string
  variant?: 'chosen' | 'rejected'
}

function PreferenceBlock({ label, body, variant }: PreferenceBlockProps) {
  let borderColor = 'rgba(55, 65, 81, 0.9)'
  let bg = 'rgba(15, 23, 42, 0.96)'
  let labelColor = '#9ca3af'

  if (variant === 'chosen') {
    borderColor = 'rgba(34, 197, 94, 0.9)'
    bg = 'rgba(6, 78, 59, 0.7)'
    labelColor = '#bbf7d0'
  } else if (variant === 'rejected') {
    borderColor = 'rgba(248, 113, 113, 0.9)'
    bg = 'rgba(127, 29, 29, 0.6)'
    labelColor = '#fecaca'
  }

  return (
    <div
      style={{
        borderRadius: 10,
        padding: 10,
        border: `1px solid ${borderColor}`,
        background: bg,
      }}
    >
      <div
        style={{
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: labelColor,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13,
          color: '#e5e7eb',
        }}
      >
        {body}
      </div>
    </div>
  )
}

interface ProbabilityBarProps {
  label: string
  probability: number
  color: string
  accent: 'up' | 'down'
}

function ProbabilityBar({ label, probability, color, accent }: ProbabilityBarProps) {
  const clamped = Math.max(0, Math.min(1, probability))
  const height = 20 + clamped * 100

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          fontSize: 11,
          color: '#e5e7eb',
        }}
      >
        <span>{label}</span>
        <span
          aria-hidden="true"
          style={{
            fontSize: 10,
            color:
              accent === 'up'
                ? '#bbf7d0'
                : '#fecaca',
          }}
        >
          {accent === 'up' ? '↑' : '↓'}
        </span>
      </div>
      <div
        style={{
          width: 32,
          height: 110,
          borderRadius: 999,
          border: '1px solid rgba(148, 163, 184, 0.9)',
          background: 'rgba(15, 23, 42, 0.9)',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          padding: 3,
        }}
      >
        <div
          style={{
            width: '100%',
            height,
            borderRadius: 999,
            background: color,
            boxShadow: `0 0 14px ${color}aa`,
            transition: 'height 0.2s ease',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 11,
          color: '#9ca3af',
        }}
      >
        {Math.round(clamped * 100)}%
      </div>
    </div>
  )
}
