Here’s a self-contained interactive component you can drop into your components/ folder, e.g. RLHFDPOAlignment.tsx:

tsx
Copy code
import { useState } from 'react'

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


You can import this anywhere in your Next.js app:

tsx
Copy code
import RLHFDPOAlignment from '@/components/RLHFDPOAlignment'

export default function Page() {
  return (
    <main>
      <RLHFDPOAlignment />
    </main>
  )
}


It uses a dark background (#080c14), color-codes the two pipelines (RLHF vs DPO), lets you toggle between them to see step & component counts change, and shows a simple preference-pair + DPO-loss visualization without going into math formulas.

 

attachments-bundle
