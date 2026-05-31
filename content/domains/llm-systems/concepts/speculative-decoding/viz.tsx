import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const SpeculativeDecodingViz = dynamic(() => import('@/components/foundations/SpeculativeDecodingViz'), {
  ssr: false,
})

type PredictionKey = 'draft-match' | 'target-verify' | 'longer-draft' | 'residual-repair'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'draft-match': {
    label: 'Draft-target match',
    response: 'Speculation speeds up only when the draft distribution is close enough that the target accepts a long prefix of proposed tokens.',
  },
  'target-verify': {
    label: 'Target verification',
    response: 'The target model verifies the proposed chunk in parallel, preserving correctness, but speedup still depends on how many draft tokens survive.',
  },
  'longer-draft': {
    label: 'Longer draft',
    response: 'A larger draft chunk creates more upside, but it can be slower when draft-target agreement is weak and many tokens are rejected.',
  },
  'residual-repair': {
    label: 'Residual repair',
    response: 'Residual sampling repairs rejected positions so the final distribution remains the target distribution, not the draft distribution.',
  },
}

const SPECULATIVE_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    text: 'Choose the condition before the draft-verify trace appears.',
  },
  {
    label: 'Observe',
    text: 'Reveal accepted prefix, rejected tail, and target verification.',
  },
  {
    label: 'Ground',
    text: 'Separate exact target distribution from latency speedup.',
  },
  {
    label: 'Carry',
    text: 'Use agreement rate before expecting fewer target passes.',
  },
] as const

export default function SpeculativeDecodingDemo() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'draft-match'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = SPECULATIVE_EVIDENCE_STEPS[evidenceActiveIndex]?.label ?? 'Predict'

  useEffect(() => {
    const routeState = {
      conceptId: 'speculative-decoding',
      label: 'Prediction-first speculative speedup reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; speculation reveals ${expectedPrediction.label}.`
        : 'Learner is predicting what condition makes speculative decoding faster before the draft-verify lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected condition: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `speculation invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `draft-verify lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <section
        className="predictionPanel"
        data-child-demo-gate="speculative-speedup-condition"
        aria-live="polite"
      >
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What condition makes speculative decoding actually faster?</strong>
          <p>
            Predict the speedup condition before the draft-verify trace appears. The reveal should separate
            the lossless distribution guarantee from the systems-level latency win.
          </p>
        </div>

        <div className="specPreview" aria-hidden="true">
          <div className="draftLane">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="verifyLane">
            <i />
            <i />
            <i />
          </div>
          <div className="acceptLane">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label="Speculative decoding speedup prediction">
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
        <div className="evidenceStrip" aria-label="Speculative decoding evidence loop">
          {SPECULATIVE_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={index <= evidenceActiveIndex ? 'evidenceStep evidence-step active' : 'evidenceStep evidence-step'}
            >
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </div>
          ))}
        </div>

        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal speedup condition
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the condition this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to change draft-target match and draft length.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a condition to unlock the draft-verify lab.' : 'Reveal the condition to mount the draft-verify lab.'}</p>
        )}
      </section>

      {revealed ? (
        <VizStageAdapter padding="compact">
          <SpeculativeDecodingViz chrome="notebook" />
        </VizStageAdapter>
      ) : (
        <div className="panelGate">
          <span>Speculative decoding lab</span>
          <strong>Hidden until prediction reveal</strong>
          <p>Commit to the speedup condition first, then inspect acceptance rate, rejected tokens, and toy speedup.</p>
        </div>
      )}

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: 0;
        }

        .predictionPanel,
        .result,
        .panelGate {
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

        .specPreview {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr) minmax(0, 1fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 7rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: calc(var(--radius-lg) - 4px);
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .draftLane,
        .verifyLane,
        .acceptLane {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.38);
        }

        .draftLane i,
        .acceptLane i {
          position: absolute;
          top: 50%;
          width: 0.55rem;
          height: 0.55rem;
          border-radius: 999px;
          transform: translateY(-50%);
          background: rgba(20, 184, 166, 0.92);
          animation: draftFlow 3s ease-in-out infinite;
        }

        .draftLane i:nth-child(1) { left: 12%; animation-delay: -0.1s; }
        .draftLane i:nth-child(2) { left: 28%; animation-delay: -0.35s; }
        .draftLane i:nth-child(3) { left: 44%; animation-delay: -0.6s; }
        .draftLane i:nth-child(4) { left: 60%; animation-delay: -0.85s; }
        .draftLane i:nth-child(5) { left: 76%; animation-delay: -1.1s; }

        .verifyLane i {
          position: absolute;
          left: 14%;
          right: 14%;
          height: 0.46rem;
          border-radius: 999px;
          background: rgba(99, 102, 241, 0.58);
          animation: verifySweep 2.6s ease-in-out infinite;
        }

        .verifyLane i:nth-child(1) { top: 28%; animation-delay: -0.2s; }
        .verifyLane i:nth-child(2) { top: 48%; animation-delay: -0.45s; }
        .verifyLane i:nth-child(3) { top: 68%; animation-delay: -0.7s; }

        .acceptLane i {
          background: rgba(245, 158, 11, 0.9);
          animation-name: acceptPulse;
        }

        .acceptLane i:nth-child(1) { left: 18%; animation-delay: -0.15s; }
        .acceptLane i:nth-child(2) { left: 38%; animation-delay: -0.45s; }
        .acceptLane i:nth-child(3) { left: 58%; animation-delay: -0.75s; }
        .acceptLane i:nth-child(4) { left: 78%; animation-delay: -1.05s; }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
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
          min-height: 5rem;
        }

        .result.shown {
          border-color: rgba(245, 158, 11, 0.28);
          background: rgba(245, 158, 11, 0.1);
        }

        .result h4 {
          margin: 0;
          font-size: 1rem;
        }

        .panelGate {
          min-height: 13rem;
          align-content: center;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
          text-align: center;
        }

        @keyframes draftFlow {
          0%, 100% { transform: translate(0, -50%) scale(0.92); opacity: 0.58; }
          50% { transform: translate(0.42rem, -50%) scale(1.08); opacity: 1; }
        }

        @keyframes verifySweep {
          0%, 100% { transform: scaleX(0.45); opacity: 0.48; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes acceptPulse {
          0%, 100% { transform: translateY(-50%) scale(0.88); opacity: 0.55; }
          50% { transform: translateY(-50%) scale(1.1); opacity: 1; }
        }

        @media (max-width: 720px) {
          .specPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .specPreview {
            min-height: 13rem;
          }
        }

        @media (max-width: 520px) {
          .choiceRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
