import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const ProcessRewardModelsViz = dynamic(() => import('@/components/foundations/ProcessRewardModelsViz'), {
  ssr: false,
})

type PredictionKey = 'final-answer' | 'step-validity' | 'higher-beta' | 'proxy-free-truth'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'final-answer': {
    label: 'Final answer',
    response: 'Outcome-only reward can miss broken reasoning that happens to land on the correct answer, so it is exactly the weak signal process supervision tries to densify.',
  },
  'step-validity': {
    label: 'Step validity',
    response: 'A process reward model scores intermediate reasoning steps, giving the search or policy a denser signal about which trace is locally valid.',
  },
  'higher-beta': {
    label: 'Higher beta',
    response: 'A stronger policy update can amplify whatever the verifier rewards, but it does not by itself distinguish valid steps from lucky or hacked traces.',
  },
  'proxy-free-truth': {
    label: 'Proxy-free truth',
    response: 'PRMs are still learned proxies. They can improve feedback granularity, but false positives and false negatives become new reward-hacking surfaces.',
  },
}

export default function ProcessRewardModelsDemo() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'step-validity'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'process-reward-models',
      label: 'Prediction-first process verifier reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; PRMs reveal ${expectedPrediction.label}.`
        : 'Learner is predicting what process reward models score before the step-level verifier lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected signal: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `process invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `step-verifier lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <section className="predictionPanel" aria-live="polite">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What should a process reward model score before the final answer?</strong>
          <p>
            Predict the supervision signal before the lab mounts. The reveal should separate outcome correctness
            from step-level reasoning quality.
          </p>
        </div>

        <div className="stepPreview" aria-hidden="true">
          <div className="traceColumn">
            <i />
            <i />
            <i />
          </div>
          <div className="scoreColumn">
            <i />
            <i />
            <i />
          </div>
          <div className="policyColumn">
            <i />
            <i />
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label="Process reward model prediction">
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
          Reveal verifier signal
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the signal this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to compare outcome-only and process scoring.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a supervision signal to unlock the PRM lab.' : 'Reveal the signal to mount the PRM lab.'}</p>
        )}
      </section>

      {revealed ? (
        <ProcessRewardModelsViz />
      ) : (
        <div className="panelGate">
          <span>Process reward model lab</span>
          <strong>Hidden until prediction reveal</strong>
          <p>Commit to the verifier signal first, then inspect step probabilities, aggregation, and policy shifts.</p>
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
          border-radius: 8px;
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

        .stepPreview {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 0.9fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 7.5rem;
          padding: 0.72rem;
          border: 1px solid rgba(148, 163, 184, 0.12);
          border-radius: 8px;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.24);
          background-size: 24px 24px;
        }

        .traceColumn,
        .scoreColumn,
        .policyColumn {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.38);
        }

        .traceColumn i,
        .scoreColumn i,
        .policyColumn i {
          position: absolute;
          display: block;
          border-radius: 999px;
          animation: stepPulse 3s ease-in-out infinite;
        }

        .traceColumn i {
          left: 16%;
          right: 16%;
          height: 0.5rem;
          background: rgba(148, 163, 184, 0.72);
        }

        .traceColumn i:nth-child(1) { top: 27%; animation-delay: -0.12s; }
        .traceColumn i:nth-child(2) { top: 49%; animation-delay: -0.42s; }
        .traceColumn i:nth-child(3) { top: 71%; animation-delay: -0.72s; background: rgba(248, 113, 113, 0.66); }

        .scoreColumn i {
          left: 18%;
          width: 64%;
          height: 0.5rem;
          background: rgba(20, 184, 166, 0.85);
          animation-name: scoreSweep;
        }

        .scoreColumn i:nth-child(1) { top: 27%; animation-delay: -0.16s; }
        .scoreColumn i:nth-child(2) { top: 49%; animation-delay: -0.46s; }
        .scoreColumn i:nth-child(3) { top: 71%; animation-delay: -0.76s; background: rgba(245, 158, 11, 0.78); }

        .policyColumn i {
          left: 24%;
          width: 52%;
          height: 0.62rem;
          background: rgba(99, 102, 241, 0.82);
          animation-name: policyShift;
        }

        .policyColumn i:nth-child(1) { top: 38%; animation-delay: -0.2s; }
        .policyColumn i:nth-child(2) { top: 62%; animation-delay: -0.58s; opacity: 0.52; }

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
          border-color: rgba(20, 184, 166, 0.58);
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
          min-height: 13rem;
          align-content: center;
          text-align: center;
          background:
            linear-gradient(rgba(148, 163, 184, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148, 163, 184, 0.06) 1px, transparent 1px),
            rgba(8, 12, 20, 0.22);
          background-size: 28px 28px;
        }

        @keyframes stepPulse {
          0%, 100% { transform: scaleX(0.68); opacity: 0.48; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes scoreSweep {
          0%, 100% { transform: translateX(-0.18rem) scaleX(0.56); opacity: 0.46; }
          50% { transform: translateX(0.18rem) scaleX(1); opacity: 1; }
        }

        @keyframes policyShift {
          0%, 100% { transform: translateX(-0.22rem) scaleX(0.74); opacity: 0.5; }
          50% { transform: translateX(0.24rem) scaleX(1); opacity: 1; }
        }

        @media (max-width: 720px) {
          .stepPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .stepPreview {
            min-height: 13rem;
          }
        }
      `}</style>
    </div>
  )
}
