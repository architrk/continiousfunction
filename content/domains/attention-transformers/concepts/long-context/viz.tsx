import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'

import { emitDemoState } from '../../../../../lib/demoState'

const SlidingWindowViz = dynamic(() => import('@/components/foundations/SlidingWindowViz'), { ssr: false })
const RoPEViz = dynamic(() => import('@/components/foundations/RoPEViz'), { ssr: false })
const KVCacheDashboard = dynamic(() => import('@/components/foundations/KVCacheDashboard'), { ssr: false })

type TabId = 'window' | 'rope' | 'kv'
type ConstraintKey = 'attention-work' | 'position-phase' | 'kv-memory'

const CONSTRAINTS: Record<ConstraintKey, { label: string; invariant: string }> = {
  'attention-work': {
    label: 'Attention work',
    invariant: 'A sliding window keeps each query near O(W) neighbors instead of letting every token attend to every earlier token.',
  },
  'position-phase': {
    label: 'Position phase',
    invariant: 'RoPE preserves useful relative offsets by making attention depend on phase differences rather than raw absolute positions.',
  },
  'kv-memory': {
    label: 'KV memory',
    invariant: 'KV cache cost grows with layers, heads, context length, and value width, so serving long contexts becomes a memory-management problem.',
  },
}

const EXPECTED_CONSTRAINT: Record<TabId, ConstraintKey> = {
  window: 'attention-work',
  rope: 'position-phase',
  kv: 'kv-memory',
}

const LONG_CONTEXT_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    text: 'Pick compute, phase, or memory.',
  },
  {
    label: 'Observe',
    text: 'Reveal the selected mechanism.',
  },
  {
    label: 'Ground',
    text: 'Tie it to O(TW), RoPE, or KV growth.',
  },
  {
    label: 'Carry',
    text: 'Choose the repair by constraint.',
  },
] as const

export default function LongContextViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'window' as const,
          label: 'Sliding Window',
          note: 'Reduce attention work from O(T^2) to O(TW) by limiting how far each token can attend.',
          render: () => <SlidingWindowViz />,
        },
        {
          id: 'rope' as const,
          label: 'RoPE',
          note: 'Relative position as phase differences: why RoPE extrapolation matters for long contexts.',
          render: () => <RoPEViz conceptId="long-context" />,
        },
        {
          id: 'kv' as const,
          label: 'KV Cache',
          note: 'At long context, memory dominates: explore KV size, heads, layers, and paging effects.',
          render: () => <KVCacheDashboard conceptId="long-context" />,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('window')
  const [prediction, setPrediction] = useState<ConstraintKey | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const expected = EXPECTED_CONSTRAINT[active]
  const expectedConstraint = CONSTRAINTS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = LONG_CONTEXT_EVIDENCE_STEPS[evidenceActiveIndex]?.label ?? 'Predict'

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const selectTab = (id: TabId) => {
    setActive(id)
    setPrediction(null)
    setRevealed(false)
  }

  useEffect(() => {
    const routeState = {
      conceptId: 'long-context',
      label: 'Prediction-first long-context constraint router',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : CONSTRAINTS[prediction].label}; ${current.label} reveals ${expectedConstraint.label}.`
        : `Learner is predicting which long-context constraint the ${current.label} demo should expose before the demo panel is mounted.`,
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `active demo: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : CONSTRAINTS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected constraint: ${revealed ? expectedConstraint.label : 'hidden until reveal'}`,
        `constraint invariant: ${revealed ? expectedConstraint.invariant : 'hidden until reveal'}`,
        `demo panel: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [current.label, evidencePhase, expectedConstraint.invariant, expectedConstraint.label, prediction, predictionCorrect, revealed])

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = tabs.findIndex((t) => t.id === active)
    if (idx < 0) return
    let next: TabId | null = null
    if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length].id
    else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length].id
    else if (e.key === 'Home') next = tabs[0].id
    else if (e.key === 'End') next = tabs[tabs.length - 1].id
    if (!next) return
    e.preventDefault()
    selectTab(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Long context demos">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${t.id === active ? 'active' : ''}`}
            role="tab"
            id={tabId(t.id)}
            aria-selected={t.id === active}
            aria-controls={panelId}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => selectTab(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="note">{current.note}</div>

      <section
        className="predictionPanel"
        data-child-demo-gate="long-context-constraint"
        aria-live="polite"
      >
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which constraint limits this demo?</strong>
          <p>
            Pick compute, position, or memory first. The answer decides which mechanism mounts.
          </p>
        </div>
        <div className="constraintStage" aria-hidden="true">
          <div className={`lane ${active === 'window' ? 'active' : ''}`}>
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className={`phase ${active === 'rope' ? 'active' : ''}`}>
            <i />
            <i />
          </div>
          <div className={`cache ${active === 'kv' ? 'active' : ''}`}>
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="choiceRow" role="group" aria-label="Long-context constraint prediction">
          {(Object.keys(CONSTRAINTS) as ConstraintKey[]).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={prediction === key}
              className={prediction === key ? 'selected' : ''}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
              }}
            >
              {CONSTRAINTS[key].label}
            </button>
          ))}
        </div>
        <div className="evidenceStrip" aria-label="Long-context evidence loop">
          {LONG_CONTEXT_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              aria-label={`${step.label}: ${step.text}`}
              className={index <= evidenceActiveIndex ? 'evidenceStep evidence-step active' : 'evidenceStep evidence-step'}
            >
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </div>
          ))}
        </div>
        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal constraint
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedConstraint.label} is the constraint this demo emphasizes.`}</h4>
            <p>{expectedConstraint.invariant}</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a constraint to unlock the active demo.' : 'Reveal the constraint to mount the active demo.'}</p>
        )}
      </section>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        {revealed ? (
          current.render()
        ) : (
          <div className="panelGate">
            <span>{current.label}</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the bottleneck first, then inspect the concrete mechanism.</p>
          </div>
        )}
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .tab {
          appearance: none;
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(99, 102, 241, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(99, 102, 241, 0.8);
          background: rgba(99, 102, 241, 0.18);
          color: #c7d2fe;
        }

        .note {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.82rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.18);
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .panelGate span {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0;
          color: var(--text-secondary);
        }

        .predictionCopy strong,
        .result h4,
        .panelGate strong {
          color: var(--text-primary);
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p,
        .panelGate p {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.5;
        }

        .constraintStage {
          position: relative;
          display: grid;
          grid-template-columns: 1.2fr 0.9fr 1fr;
          gap: 0.6rem;
          min-height: 4.6rem;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
          padding: 0.72rem;
        }

        .lane,
        .phase,
        .cache {
          position: relative;
          min-width: 0;
          border-radius: 10px;
          background: rgba(15, 23, 42, 0.38);
          opacity: 0.62;
          transition: opacity 140ms ease, transform 140ms ease, border-color 140ms ease;
        }

        .lane.active,
        .phase.active,
        .cache.active {
          opacity: 1;
          transform: translateY(-1px);
          box-shadow: inset 0 0 0 1px rgba(245, 158, 11, 0.32);
        }

        .lane i {
          position: absolute;
          top: 50%;
          width: 0.44rem;
          height: 0.44rem;
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.95);
          transform: translateY(-50%);
          animation: tokenDrift 2.8s ease-in-out infinite;
        }

        .lane i:nth-child(1) { left: 12%; animation-delay: -0.3s; }
        .lane i:nth-child(2) { left: 34%; animation-delay: -0.7s; }
        .lane i:nth-child(3) { left: 58%; animation-delay: -1.1s; }
        .lane i:nth-child(4) { left: 82%; animation-delay: -1.5s; }

        .phase i {
          position: absolute;
          inset: 0.55rem;
          border: 2px solid rgba(99, 102, 241, 0.36);
          border-radius: 999px;
          animation: phaseSpin 4.4s linear infinite;
        }

        .phase i:nth-child(2) {
          inset: 0.95rem;
          border-color: rgba(245, 158, 11, 0.42);
          animation-duration: 3.2s;
          animation-direction: reverse;
        }

        .cache {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.3rem;
          padding: 0.48rem;
        }

        .cache i {
          border-radius: 7px;
          background: rgba(245, 158, 11, 0.24);
          border: 1px solid rgba(245, 158, 11, 0.28);
          animation: cachePulse 2.2s ease-in-out infinite;
        }

        .cache i:nth-child(2) { animation-delay: -0.35s; }
        .cache i:nth-child(3) { animation-delay: -0.7s; }
        .cache i:nth-child(4) { animation-delay: -1.05s; }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .evidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          padding: 0.58rem;
          border-radius: 12px;
          border: 1px solid rgba(20, 184, 166, 0.18);
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.16), rgba(8, 12, 20, 0.95)),
            rgba(8, 12, 20, 0.86);
        }

        .evidenceStep {
          display: grid;
          gap: 0.22rem;
          min-width: 0;
          padding: 0.58rem;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(15, 23, 42, 0.5);
          opacity: 0.58;
        }

        .evidenceStep.active {
          opacity: 1;
          border-color: rgba(20, 184, 166, 0.34);
          background: rgba(15, 118, 110, 0.28);
        }

        .evidenceStep strong {
          color: #ccfbf1;
          font-size: 0.72rem;
          line-height: 1.2;
        }

        .evidenceStep span {
          color: #d7e8ea;
          font-size: 0.7rem;
          line-height: 1.34;
          overflow-wrap: anywhere;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.7rem;
          border: 1px solid var(--border-subtle);
          border-radius: 10px;
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(99, 102, 241, 0.58);
          background: rgba(99, 102, 241, 0.18);
        }

        .reveal {
          justify-self: start;
          background: rgba(99, 102, 241, 0.88);
          border-color: rgba(99, 102, 241, 0.7);
          color: #fffaf2;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 4.75rem;
        }

        .result.shown {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panel {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
          min-width: 0;
        }

        .panelGate {
          display: grid;
          gap: 0.38rem;
          min-height: 13rem;
          align-content: center;
          padding: 1rem;
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
          text-align: center;
        }

        @keyframes tokenDrift {
          0%, 100% { transform: translate(0, -50%); }
          50% { transform: translate(0.42rem, -50%); }
        }

        @keyframes phaseSpin {
          to { transform: rotate(360deg); }
        }

        @keyframes cachePulse {
          0%, 100% { opacity: 0.46; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1); }
        }

        @media (max-width: 720px) {
          .predictionPanel {
            gap: 0.54rem;
            padding: 0.66rem;
          }

          .predictionCopy {
            gap: 0.24rem;
          }

          .predictionCopy span {
            font-size: 0.62rem;
          }

          .predictionCopy strong {
            font-size: 0.98rem;
            line-height: 1.18;
          }

          .predictionCopy p {
            font-size: 0.82rem;
            line-height: 1.36;
          }

          .constraintStage {
            grid-template-columns: 1.2fr 0.88fr 1fr;
            gap: 0.34rem;
            min-height: 3.9rem;
            padding: 0.45rem;
          }

          .choiceRow {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.36rem;
          }

          .choiceRow button {
            min-height: 2.42rem;
            padding: 0.34rem 0.28rem;
            font-size: 0.72rem;
            line-height: 1.08;
          }

          .evidenceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 0.34rem;
            padding: 0.42rem;
          }

          .evidenceStep {
            gap: 0.16rem;
            min-height: 2.64rem;
            padding: 0.42rem;
            align-content: center;
          }

          .evidenceStep strong {
            font-size: 0.66rem;
          }

          .evidenceStep span {
            display: none;
          }

          .reveal {
            justify-self: stretch;
            min-height: 2.42rem;
            padding-block: 0.42rem;
          }
        }
      `}</style>
    </div>
  )
}
