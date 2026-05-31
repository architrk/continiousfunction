import { useEffect, useState } from 'react'
import {
  DEMO_STATE_EVENT,
  getLatestDemoState,
  type DemoStateEventDetail,
  type DemoStateSummary,
} from '@/lib/demoState'

export type DemoPredictionCheckpointReveal = {
  modeId: string
  label: string
  check: string
  demoState?: DemoStateSummary
}

type Props = {
  conceptId?: string
  conceptTitle: string
  demoPrompt: string
  nextConcept?: string
  onReveal?: (reveal: DemoPredictionCheckpointReveal) => void
}

const predictionModes = [
  {
    id: 'move',
    label: 'A quantity moves',
    check: 'Watch the readout or plotted value first. Then connect that movement to one equation term or control.',
  },
  {
    id: 'stable',
    label: 'An invariant holds',
    check: 'Name the thing that should remain true even while the visual representation changes.',
  },
  {
    id: 'edge',
    label: 'A boundary breaks',
    check: 'Push one control toward an edge case and look for the assumption that stops being comfortable.',
  },
]

export default function DemoPredictionCheckpoint({ conceptId, conceptTitle, demoPrompt, nextConcept, onReveal }: Props) {
  const [modeId, setModeId] = useState(predictionModes[0].id)
  const [revealed, setRevealed] = useState(false)
  const [demoState, setDemoState] = useState<DemoStateSummary | null>(null)
  const activeMode = predictionModes.find((mode) => mode.id === modeId) ?? predictionModes[0]
  const bridge = nextConcept ? `Carry the observation into ${nextConcept}.` : 'Carry the observation into the next connected idea.'
  const revealedCheck = `${activeMode.check} ${bridge}`
  const handoffSteps = [
    {
      step: '01',
      label: 'Predict',
      detail: activeMode.label,
    },
    {
      step: '02',
      label: 'Observe',
      detail: demoState?.label ?? 'Demo state pending',
    },
    {
      step: '03',
      label: 'Ground',
      detail: 'Name the equation, invariant, or control that explains it.',
    },
    {
      step: '04',
      label: 'Carry',
      detail: nextConcept ? `Next: ${nextConcept}` : 'Research Room note',
    },
  ]

  useEffect(() => {
    if (!conceptId || typeof window === 'undefined') return undefined

    setDemoState(getLatestDemoState(conceptId))

    const handleDemoState = (event: Event) => {
      const detail = (event as CustomEvent<DemoStateEventDetail>).detail
      if (detail?.conceptId === conceptId) {
        setDemoState('cleared' in detail ? null : detail)
      }
    }

    window.addEventListener(DEMO_STATE_EVENT, handleDemoState)
    return () => window.removeEventListener(DEMO_STATE_EVENT, handleDemoState)
  }, [conceptId])

  const revealCheck = () => {
    setRevealed(true)
    const reveal: DemoPredictionCheckpointReveal = {
      modeId: activeMode.id,
      label: activeMode.label,
      check: revealedCheck,
    }
    if (demoState) reveal.demoState = demoState
    onReveal?.(reveal)
  }

  return (
    <div className="demo-checkpoint" aria-live="polite">
      <div className="checkpoint-copy">
        <span>Demo Prediction Checkpoint</span>
        <p>{demoPrompt}</p>
      </div>

      <div className="mode-row" aria-label={`${conceptTitle} prediction modes`}>
        {predictionModes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            className={mode.id === activeMode.id ? 'active' : ''}
            aria-pressed={mode.id === activeMode.id}
            onClick={() => {
              setModeId(mode.id)
              setRevealed(false)
            }}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="checkpoint-handoff" aria-label="Prediction handoff loop">
        {handoffSteps.map((step) => (
          <section key={step.step} aria-label={`${step.label}: ${step.detail}`}>
            <span>{step.step}</span>
            <strong>{step.label}</strong>
            <em>{step.detail}</em>
          </section>
        ))}
      </div>

      <button type="button" className="reveal" onClick={revealCheck}>
        Reveal check
      </button>

      {demoState ? (
        <div className="demo-state" aria-label="Current demo state">
          <span>Current demo state</span>
          <strong>{demoState.label}</strong>
          <p>{demoState.summary}</p>
        </div>
      ) : null}

      <p className={revealed ? 'check open' : 'check'}>
        {revealed
          ? revealedCheck
          : `Commit to what ${conceptTitle} should make visible before reading the result.`}
      </p>

      <style jsx>{`
        .demo-checkpoint {
          display: grid;
          gap: 0.7rem;
          min-width: 0;
        }

        .checkpoint-copy {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
        }

        .checkpoint-copy span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        p {
          margin: 0;
          color: #4d5a67;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .checkpoint-copy p {
          color: #263342;
          font-weight: 750;
        }

        .mode-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        button {
          min-width: 0;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #213040;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .mode-row button {
          min-height: 2.8rem;
          padding: 0.56rem;
          font-size: 0.84rem;
          line-height: 1.18;
        }

        .checkpoint-handoff {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        .checkpoint-handoff section {
          display: grid;
          gap: 0.18rem;
          min-width: 0;
          min-height: 4.4rem;
          padding: 0.56rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.72);
        }

        .checkpoint-handoff section:nth-child(2) {
          background: rgba(231, 248, 244, 0.58);
        }

        .checkpoint-handoff span {
          color: #c24a2d;
          font-family: var(--font-mono);
          font-size: 0.58rem;
          letter-spacing: 0.1em;
        }

        .checkpoint-handoff strong {
          color: #17202a;
          line-height: 1.1;
        }

        .checkpoint-handoff em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #52606b;
          font-size: 0.72rem;
          font-style: normal;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        button.active {
          border-color: rgba(31, 111, 120, 0.34);
          background: rgba(239, 247, 245, 0.96);
        }

        button:hover {
          transform: translateY(-1px);
          border-color: rgba(31, 75, 153, 0.28);
        }

        button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.28);
          outline-offset: 2px;
        }

        .reveal {
          justify-self: start;
          min-height: 2.7rem;
          padding: 0.58rem 0.9rem;
          background: #1f6f78;
          color: #fffaf2;
          border-color: rgba(31, 111, 120, 0.6);
        }

        .check {
          min-height: 4.8rem;
          padding: 0.72rem 0;
          border-top: 1px solid rgba(27, 36, 48, 0.08);
        }

        .check.open {
          color: #263342;
        }

        .demo-state {
          display: grid;
          gap: 0.25rem;
          min-width: 0;
          padding: 0.64rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(231, 248, 244, 0.62);
        }

        .demo-state span {
          font-family: var(--font-mono);
          font-size: 0.66rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: #1f6f78;
        }

        .demo-state strong {
          color: #17202a;
          line-height: 1.28;
          overflow-wrap: break-word;
        }

        .demo-state p {
          color: #4d5a67;
          font-size: 0.88rem;
        }

        @media (max-width: 760px) {
          .demo-checkpoint {
            gap: 0.56rem;
          }

          .checkpoint-copy {
            gap: 0.26rem;
          }

          .checkpoint-copy span {
            font-size: 0.62rem;
          }

          .checkpoint-copy p {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.9rem;
            line-height: 1.34;
          }

          .mode-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.34rem;
          }

          .checkpoint-handoff {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.34rem;
          }

          .mode-row button {
            min-height: 2.42rem;
            padding: 0.38rem 0.28rem;
            font-size: 0.7rem;
            line-height: 1.08;
          }

          .checkpoint-handoff section {
            min-height: 2.78rem;
            padding: 0.42rem;
          }

          .checkpoint-handoff strong {
            font-size: 0.82rem;
          }

          .checkpoint-handoff em {
            display: none;
          }

          .reveal {
            justify-self: stretch;
            min-height: 2.42rem;
            padding-block: 0.42rem;
          }

          .check {
            min-height: auto;
            padding: 0.52rem 0 0;
            font-size: 0.86rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          button {
            transition: none;
          }
        }
      `}</style>
    </div>
  )
}
