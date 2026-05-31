import { useEffect, useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const LoRAViz = dynamic(() => import('@/components/foundations/LoRAViz'), { ssr: false })
const MoERoutingViz = dynamic(() => import('@/components/foundations/MoERoutingViz'), { ssr: false })
const TaskVectorViz = dynamic(() => import('@/components/foundations/TaskVectorViz'), { ssr: false })

type TabId = 'lora' | 'moe' | 'task'
type PredictionKey = 'trainable-params' | 'active-compute' | 'memory-bandwidth' | 'behavior-reuse'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'trainable-params': {
    label: 'Trainable parameters',
    response: 'LoRA keeps the base model frozen and learns a low-rank update, so the first win is a much smaller trainable parameter set.',
  },
  'active-compute': {
    label: 'Active compute',
    response: 'Sparse MoE expands total capacity but routes each token through only a few experts, so the first win is lower active compute per token.',
  },
  'memory-bandwidth': {
    label: 'Memory bandwidth',
    response: 'Quantization usually attacks memory movement first, but this route is currently contrasting LoRA, sparse MoE, and task-vector reuse.',
  },
  'behavior-reuse': {
    label: 'Behavior reuse',
    response: 'Task vectors reuse learned behavior deltas by adding or scaling them, so the first win is composable adaptation rather than retraining from scratch.',
  },
}

export default function EfficiencyViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'lora' as const,
          label: 'LoRA',
          note: 'Low-rank adaptation: a tiny rank-r update can steer a huge frozen model.',
          expected: 'trainable-params' as const,
          invariant: 'Only the low-rank adapter moves; the dense base matrix stays fixed.',
          Component: LoRAViz,
        },
        {
          id: 'moe' as const,
          label: 'Sparse MoE',
          note: 'Routing chooses a few experts per token: big capacity, small active compute.',
          expected: 'active-compute' as const,
          invariant: 'Total parameters can be huge while each token activates only a small expert subset.',
          Component: MoERoutingViz,
        },
        {
          id: 'task' as const,
          label: 'Task Vectors',
          note: 'Behavior deltas as vectors: add, scale, and compose updates (with tradeoffs).',
          expected: 'behavior-reuse' as const,
          invariant: 'A task delta can be reused as an edit direction without replaying full training.',
          Component: TaskVectorViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('lora')
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component
  const expectedPrediction = PREDICTIONS[current.expected]
  const predictionCorrect = prediction === current.expected

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const selectActive = (next: TabId) => {
    setActive(next)
    setPrediction(null)
    setRevealed(false)
  }

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
    selectActive(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  useEffect(() => {
    const routeState = {
      conceptId: 'efficiency',
      label: 'Prediction-first efficiency lever reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; ${current.label} reveals ${expectedPrediction.label}.`
        : `Learner is predicting which efficiency lever ${current.label} buys down before the lab is mounted.`,
      values: [
        `active demo: ${current.label}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected lever: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `efficiency invariant: ${revealed ? current.invariant : 'hidden until reveal'}`,
        `efficiency lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [
    current.invariant,
    current.label,
    expectedPrediction.label,
    prediction,
    predictionCorrect,
    revealed,
  ])

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Efficiency demos">
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
            onClick={() => selectActive(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="note">{current.note}</div>

      <section className="predictionPanel" aria-live="polite">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which cost does {current.label} buy down first?</strong>
          <p>
            Commit before the lab mounts. The reveal separates the visible speedup story from the mechanism that
            actually makes the technique efficient.
          </p>
        </div>

        <div className={`efficiencyPreview ${active}`} aria-hidden="true">
          <div className="previewLane frozen">
            <span>frozen base</span>
            <div className="matrix">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="previewLane adapter">
            <span>small update</span>
            <div className="adapterPulse">
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="previewLane compute">
            <span>active path</span>
            <div className="expertRail">
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
          <div className="previewLane reuse">
            <span>delta reuse</span>
            <div className="deltaStack">
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label={`${current.label} efficiency prediction`}>
          {(Object.keys(PREDICTIONS) as PredictionKey[]).map((key) => (
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
              {PREDICTIONS[key].label}
            </button>
          ))}
        </div>

        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal efficiency lever
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the lever this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to inspect the mechanism and its tradeoff.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a cost lever to unlock the lab.' : 'Reveal the cost lever to mount the lab.'}</p>
        )}
      </section>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        {revealed ? (
          <Active />
        ) : (
          <div className="panelGate">
            <span>{current.label} lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Pick the cost lever first, then inspect the controls, metric readouts, and tradeoff surface.</p>
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
          border-color: rgba(59, 130, 246, 0.65);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(59, 130, 246, 0.85);
          background: rgba(59, 130, 246, 0.16);
          color: #bfdbfe;
        }

        .note {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .predictionPanel,
        .result,
        .panel {
          min-width: 0;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .panelGate span,
        .previewLane span {
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

        .efficiencyPreview {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.62rem;
          min-width: 0;
          min-height: 8rem;
          padding: 0.7rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .previewLane {
          display: grid;
          grid-template-rows: auto 1fr;
          gap: 0.5rem;
          min-width: 0;
          overflow: hidden;
          padding: 0.6rem;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.38);
        }

        .matrix,
        .adapterPulse,
        .expertRail,
        .deltaStack {
          position: relative;
          min-height: 4.2rem;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.25);
        }

        .matrix {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.26rem;
          padding: 0.42rem;
        }

        .matrix i {
          border-radius: 6px;
          background: rgba(148, 163, 184, 0.28);
          animation: matrixHold 3.2s ease-in-out infinite;
        }

        .adapterPulse i,
        .expertRail i,
        .deltaStack i {
          position: absolute;
          border-radius: 999px;
          animation: leverPulse 2.8s ease-in-out infinite;
        }

        .adapterPulse i {
          left: 22%;
          right: 22%;
          height: 0.5rem;
          background: rgba(20, 184, 166, 0.86);
        }

        .adapterPulse i:nth-child(1) { top: 26%; animation-delay: -0.1s; }
        .adapterPulse i:nth-child(2) { top: 48%; animation-delay: -0.42s; }
        .adapterPulse i:nth-child(3) { top: 70%; animation-delay: -0.74s; }

        .expertRail i {
          width: 0.62rem;
          height: 0.62rem;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(245, 158, 11, 0.88);
          animation-name: expertRoute;
        }

        .expertRail i:nth-child(1) { left: 12%; animation-delay: -0.1s; }
        .expertRail i:nth-child(2) { left: 34%; animation-delay: -0.34s; }
        .expertRail i:nth-child(3) { left: 56%; animation-delay: -0.58s; }
        .expertRail i:nth-child(4) { left: 78%; animation-delay: -0.82s; }

        .deltaStack i {
          left: 20%;
          width: 60%;
          height: 0.56rem;
          background: rgba(99, 102, 241, 0.78);
          animation-name: deltaCompose;
        }

        .deltaStack i:nth-child(1) { top: 27%; animation-delay: -0.15s; }
        .deltaStack i:nth-child(2) { top: 49%; animation-delay: -0.45s; }
        .deltaStack i:nth-child(3) { top: 71%; animation-delay: -0.75s; }

        .efficiencyPreview.lora .adapter,
        .efficiencyPreview.moe .compute,
        .efficiencyPreview.task .reuse {
          border: 1px solid rgba(20, 184, 166, 0.35);
          background: rgba(20, 184, 166, 0.1);
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.7rem;
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-primary);
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(20, 184, 166, 0.55);
          background: rgba(20, 184, 166, 0.14);
        }

        .reveal {
          justify-self: start;
          background: rgba(31, 111, 120, 0.88);
          border-color: rgba(31, 111, 120, 0.7);
          color: #fffaf2;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(20, 184, 166, 0.28);
          background: rgba(20, 184, 166, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panelGate {
          display: grid;
          gap: 0.4rem;
          min-height: 13rem;
          align-content: center;
          text-align: center;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
        }

        @keyframes matrixHold {
          0%, 100% { opacity: 0.42; transform: scale(0.96); }
          50% { opacity: 0.72; transform: scale(1); }
        }

        @keyframes leverPulse {
          0%, 100% { transform: scaleX(0.55); opacity: 0.48; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes expertRoute {
          0%, 100% { transform: translate(0, -50%) scale(0.88); opacity: 0.48; }
          50% { transform: translate(0.38rem, -50%) scale(1.1); opacity: 1; }
        }

        @keyframes deltaCompose {
          0%, 100% { transform: translateX(-0.2rem) scaleX(0.74); opacity: 0.5; }
          50% { transform: translateX(0.22rem) scaleX(1); opacity: 1; }
        }

        @media (max-width: 820px) {
          .efficiencyPreview,
          .choiceRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .efficiencyPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
