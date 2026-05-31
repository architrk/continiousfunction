import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const TestTimeComputeViz = dynamic(() => import('@/components/foundations/TestTimeComputeViz'), {
  ssr: false,
})

type PredictionKey = 'more-samples' | 'reliable-verifier' | 'larger-base-model' | 'noisy-proxy'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'more-samples': {
    label: 'More samples',
    response: 'More samples improve coverage, but coverage is not selection. If the verifier ranks the wrong trace highest, extra samples can amplify the wrong answer.',
  },
  'reliable-verifier': {
    label: 'Reliable verifier',
    response: 'Test-time compute pays off when the generator can produce good candidates and the verifier ranks those candidates above plausible or proxy-exploiting mistakes.',
  },
  'larger-base-model': {
    label: 'Larger base model',
    response: 'A larger base model can help, but this route isolates inference-time budget: sampling, verification, and selection after the base model is fixed.',
  },
  'noisy-proxy': {
    label: 'Noisy proxy reward',
    response: 'A noisy proxy can make extra compute harmful by selecting rare verifier exploits more often as the sample budget grows.',
  },
}

export default function TestTimeComputeDemo() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'reliable-verifier'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'test-time-compute',
      label: 'Prediction-first test-time selection reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; test-time compute reveals ${expectedPrediction.label}.`
        : 'Learner is predicting when extra inference budget helps before the sample-verify-select lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected condition: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `test-time invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `sample-verify-select lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
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
          <strong>When does extra test-time compute actually help?</strong>
          <p>
            Predict the selection condition before the lab mounts. The reveal separates sampling more traces from
            choosing the right trace.
          </p>
        </div>

        <div className="selectionPreview" aria-hidden="true">
          <div className="sampleLane">
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
          <div className="selectLane">
            <i />
            <i />
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label="Test-time compute prediction">
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
          Reveal selection condition
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the condition this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to compare clean and noisy verifier selection.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a condition to unlock the test-time compute lab.' : 'Reveal the condition to mount the lab.'}</p>
        )}
      </section>

      {revealed ? (
        <TestTimeComputeViz />
      ) : (
        <div className="panelGate">
          <span>Test-time compute lab</span>
          <strong>Hidden until prediction reveal</strong>
          <p>Commit to the selection condition first, then inspect sample budget, verifier mode, and selected accuracy.</p>
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

        .selectionPreview {
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

        .sampleLane,
        .verifyLane,
        .selectLane {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.38);
        }

        .sampleLane i,
        .verifyLane i,
        .selectLane i {
          position: absolute;
          display: block;
          border-radius: 999px;
          animation: candidateFlow 3s ease-in-out infinite;
        }

        .sampleLane i {
          top: 50%;
          width: 0.55rem;
          height: 0.55rem;
          transform: translateY(-50%);
          background: rgba(59, 130, 246, 0.9);
        }

        .sampleLane i:nth-child(1) { left: 10%; animation-delay: -0.1s; }
        .sampleLane i:nth-child(2) { left: 26%; animation-delay: -0.32s; }
        .sampleLane i:nth-child(3) { left: 42%; animation-delay: -0.54s; }
        .sampleLane i:nth-child(4) { left: 58%; animation-delay: -0.76s; }
        .sampleLane i:nth-child(5) { left: 74%; animation-delay: -0.98s; }

        .verifyLane i {
          left: 14%;
          right: 14%;
          height: 0.46rem;
          background: rgba(245, 158, 11, 0.76);
          animation-name: verifierScore;
        }

        .verifyLane i:nth-child(1) { top: 28%; animation-delay: -0.2s; }
        .verifyLane i:nth-child(2) { top: 49%; animation-delay: -0.48s; }
        .verifyLane i:nth-child(3) { top: 70%; animation-delay: -0.76s; }

        .selectLane i {
          left: 24%;
          width: 52%;
          height: 0.62rem;
          background: rgba(20, 184, 166, 0.88);
          animation-name: selectedTrace;
        }

        .selectLane i:nth-child(1) { top: 37%; animation-delay: -0.18s; }
        .selectLane i:nth-child(2) { top: 61%; animation-delay: -0.58s; opacity: 0.45; }

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

        @keyframes candidateFlow {
          0%, 100% { transform: translate(0, -50%) scale(0.9); opacity: 0.5; }
          50% { transform: translate(0.38rem, -50%) scale(1.1); opacity: 1; }
        }

        @keyframes verifierScore {
          0%, 100% { transform: scaleX(0.42); opacity: 0.46; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes selectedTrace {
          0%, 100% { transform: translateX(-0.18rem) scaleX(0.72); opacity: 0.52; }
          50% { transform: translateX(0.22rem) scaleX(1); opacity: 1; }
        }

        @media (max-width: 720px) {
          .selectionPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .selectionPreview {
            min-height: 13rem;
          }
        }
      `}</style>
    </div>
  )
}
