import { useState, useMemo, useEffect, useCallback } from 'react'

type Mode = 'rlhf' | 'dpo'
type GamePhase = 'setup' | 'countdown' | 'running' | 'revealed'

// Challenge scenarios with different preference margins
const CHALLENGE_SCENARIOS = [
  { name: '🎯 Easy Pick', margin: 0.4, beta: 0.5, description: 'Clear preference - should be obvious' },
  { name: '⚖️ Toss-up', margin: 0.1, beta: 0.3, description: 'Weak preference signal' },
  { name: '🔥 Strong Signal', margin: 0.6, beta: 0.7, description: 'High beta, strong margin' },
  { name: '🎲 Mystery', margin: -1, beta: -1, description: 'Random challenge!' },
]

// Educational feedback for DPO predictions
function getPredictionFeedback(
  prediction: 'strong' | 'moderate' | 'weak',
  actualProb: number,
  margin: number,
  beta: number
): string {
  const actualStrength = actualProb >= 0.85 ? 'strong' : actualProb >= 0.7 ? 'moderate' : 'weak'
  const correct = prediction === actualStrength

  if (correct) {
    if (actualStrength === 'strong') {
      return `Correct! High margin (${(margin * 100).toFixed(0)}%) + high β (${beta.toFixed(1)}) = strong preference after DPO. The Bradley-Terry model amplifies clear preferences.`
    }
    if (actualStrength === 'moderate') {
      return `Correct! Moderate settings create moderate preference shift. DPO respects the signal strength in the data.`
    }
    return `Correct! Weak margin or low β = subtle preference shift. DPO won't hallucinate strong preferences from weak data!`
  }

  // Wrong predictions
  if (actualStrength === 'strong' && prediction === 'weak') {
    return `Surprise - DPO went stronger! β=${beta.toFixed(1)} is key: higher β means DPO trusts preference data more. Final: ${(actualProb * 100).toFixed(0)}%`
  }
  if (actualStrength === 'weak' && prediction === 'strong') {
    return `DPO stayed conservative! Low margin (${(margin * 100).toFixed(0)}%) or low β (${beta.toFixed(1)}) keeps the model close to reference policy. Prevents reward hacking!`
  }
  return `Close! Actual strength was ${actualStrength} (${(actualProb * 100).toFixed(0)}%). Try adjusting your intuition for β's role in preference strength.`
}

function getDPOInsight(mode: Mode, dpoStep: 0 | 1): { text: string; color: string; emoji: string } {
  if (mode === 'rlhf') {
    return {
      emoji: '🔄',
      color: '#6366f1',
      text: 'RLHF uses a learned reward model as a "teacher" for PPO. This indirection can capture nuanced preferences, but adds complexity and potential reward hacking.'
    }
  }

  if (dpoStep === 0) {
    return {
      emoji: '⚖️',
      color: '#22c55e',
      text: 'Before DPO: The policy assigns similar probability to both responses. The Bradley-Terry preference model will push these apart.'
    }
  }

  return {
    emoji: '🎯',
    color: '#10b981',
    text: 'After DPO: The policy now strongly prefers the chosen response. The key insight: DPO\'s closed-form solution makes this a simple classification loss!'
  }
}

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

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<'strong' | 'moderate' | 'weak' | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<'strong' | 'moderate' | 'weak' | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<string | null>(null)
  const [challengeMargin, setChallengeMargin] = useState<number>(0.3)
  const [challengeBeta, setChallengeBeta] = useState<number>(0.5)
  const [countdown, setCountdown] = useState(0)
  const [animatedProb, setAnimatedProb] = useState(0.5)

  const activePipeline = mode === 'rlhf' ? RLHF_PIPELINE : DPO_PIPELINE

  const pipelineStats = {
    steps: activePipeline.length,
    // “trainable components” is conceptual: separate learned modules that require their own training loop
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

  const currentInsight = useMemo(() => getDPOInsight(mode, dpoStep), [mode, dpoStep])

  // Compute final DPO probability based on margin and beta
  const computeFinalProb = useCallback((margin: number, beta: number) => {
    // Simplified DPO model: prob = 0.5 + margin * sigmoid(beta * margin)
    const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))
    const shift = margin * sigmoid(beta * margin * 5)
    return Math.min(0.95, Math.max(0.55, 0.5 + shift))
  }, [])

  const finalProb = useMemo(
    () => computeFinalProb(challengeMargin, challengeBeta),
    [challengeMargin, challengeBeta, computeFinalProb]
  )

  const predictionCorrect = useMemo(() => {
    if (!lockedPrediction) return false
    const actualStrength = finalProb >= 0.85 ? 'strong' : finalProb >= 0.7 ? 'moderate' : 'weak'
    return lockedPrediction === actualStrength
  }, [lockedPrediction, finalProb])

  // Game handlers
  const applyChallenge = useCallback((scenario: typeof CHALLENGE_SCENARIOS[number]) => {
    let margin = scenario.margin
    let beta = scenario.beta
    if (scenario.margin === -1) {
      margin = 0.1 + Math.random() * 0.5
      beta = 0.2 + Math.random() * 0.6
    }
    setChallengeMargin(margin)
    setChallengeBeta(beta)
    setActiveChallenge(scenario.name)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setAnimatedProb(0.5)
  }, [])

  const startChallenge = useCallback(() => {
    if (!prediction) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
    setAnimatedProb(0.5)
  }, [prediction])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setActiveChallenge(null)
    setAnimatedProb(0.5)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('running')
      setAnimatedProb(0.5)
    }
  }, [gamePhase, countdown])

  // Animation effect
  useEffect(() => {
    if (gamePhase !== 'running') return

    const duration = 2000
    const startTime = Date.now()
    const startProb = 0.5
    const endProb = finalProb

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(1, elapsed / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setAnimatedProb(startProb + (endProb - startProb) * eased)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        setGamePhase('revealed')
      }
    }
    requestAnimationFrame(animate)
  }, [gamePhase, finalProb])

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

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(99, 102, 241, 0.05))',
        border: '1px solid rgba(34, 197, 94, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '8px' }}>
            🎯 <strong>DPO Challenge:</strong> Pick a preference scenario:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CHALLENGE_SCENARIOS.map(scenario => (
              <button
                key={scenario.name}
                onClick={() => applyChallenge(scenario)}
                disabled={gamePhase === 'running' || gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge === scenario.name
                    ? 'rgba(34, 197, 94, 0.3)'
                    : 'rgba(34, 197, 94, 0.1)',
                  border: `1px solid ${activeChallenge === scenario.name ? '#22c55e' : 'rgba(34, 197, 94, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'running' || gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'running' || gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={scenario.description}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Preference margin: <strong>{(challengeMargin * 100).toFixed(0)}%</strong> | β (strength): <strong>{challengeBeta.toFixed(1)}</strong>
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>After DPO, how strongly will the model prefer the chosen response?</strong>
            </p>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {(['strong', 'moderate', 'weak'] as const).map(strength => (
                <button
                  key={strength}
                  onClick={() => setPrediction(strength)}
                  style={{
                    padding: '10px 20px',
                    background: prediction === strength
                      ? strength === 'strong' ? 'rgba(34, 197, 94, 0.3)'
                        : strength === 'moderate' ? 'rgba(245, 158, 11, 0.3)'
                        : 'rgba(239, 68, 68, 0.3)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${prediction === strength
                      ? strength === 'strong' ? '#22c55e'
                        : strength === 'moderate' ? '#f59e0b'
                        : '#ef4444'
                      : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '0.9rem',
                    fontWeight: prediction === strength ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {strength === 'strong' ? '💪 Strong (≥85%)' : strength === 'moderate' ? '📊 Moderate (70-84%)' : '🤏 Weak (<70%)'}
                </button>
              ))}
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                  : 'rgba(34, 197, 94, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              ⚡ Run DPO Training!
            </button>
          </div>
        )}

        {/* No challenge selected */}
        {gamePhase === 'setup' && !activeChallenge && (
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>
            👆 Select a preference scenario to test your DPO intuition!
          </p>
        )}

        {/* Countdown */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#22c55e',
              textShadow: '0 0 30px rgba(34, 197, 94, 0.5)',
            }}>
              {countdown === 0 ? 'TRAINING...' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
              Your prediction: <strong style={{
                color: lockedPrediction === 'strong' ? '#22c55e'
                  : lockedPrediction === 'moderate' ? '#f59e0b' : '#ef4444'
              }}>
                {lockedPrediction === 'strong' ? '💪 Strong' : lockedPrediction === 'moderate' ? '📊 Moderate' : '🤏 Weak'}
              </strong>
            </p>
          </div>
        )}

        {/* Running */}
        {gamePhase === 'running' && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '1rem', color: '#e5e7eb', marginBottom: '8px' }}>
              ⚡ Training DPO... Preference: <strong>{(animatedProb * 100).toFixed(0)}%</strong>
            </p>
            <div style={{
              height: '12px',
              background: 'rgba(34, 197, 94, 0.2)',
              borderRadius: '6px',
              overflow: 'hidden',
              marginBottom: '8px',
            }}>
              <div style={{
                height: '100%',
                width: `${animatedProb * 100}%`,
                background: 'linear-gradient(90deg, #22c55e, #10b981)',
                transition: 'width 50ms linear',
              }} />
            </div>
          </div>
        )}

        {/* Revealed */}
        {gamePhase === 'revealed' && (
          <div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: predictionCorrect
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                {predictionCorrect ? '🎉' : '🤔'}
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: predictionCorrect ? '#22c55e' : '#ef4444',
                marginBottom: '8px',
              }}>
                {predictionCorrect ? 'Correct!' : 'Not quite!'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                Final preference: <strong style={{
                  color: finalProb >= 0.85 ? '#22c55e' : finalProb >= 0.7 ? '#f59e0b' : '#ef4444'
                }}>
                  {(finalProb * 100).toFixed(0)}% ({finalProb >= 0.85 ? 'Strong' : finalProb >= 0.7 ? 'Moderate' : 'Weak'})
                </strong>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#9ca3af',
            }}>
              💡 {getPredictionFeedback(lockedPrediction!, finalProb, challengeMargin, challengeBeta)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(34, 197, 94, 0.2)',
                border: '1px solid rgba(34, 197, 94, 0.4)',
                borderRadius: '8px',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Another Challenge
            </button>
          </div>
        )}
      </div>

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '16px',
          borderRadius: '10px',
          background: `linear-gradient(135deg, ${currentInsight.color}18 0%, ${currentInsight.color}08 100%)`,
          border: `1px solid ${currentInsight.color}40`,
        }}
      >
        <span style={{ fontSize: '1.2em', marginRight: '8px' }}>{currentInsight.emoji}</span>
        <span style={{ color: currentInsight.color, fontWeight: 500 }}>Insight:</span>{' '}
        <span style={{ color: '#d1d5db' }}>{currentInsight.text}</span>
      </div>

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
