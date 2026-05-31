import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const DecodingSamplingViz = dynamic(() => import('@/components/foundations/DecodingSamplingViz'), {
  ssr: false,
})

type PredictionKey = 'entropy-shape' | 'argmax-lock' | 'tail-cutoff' | 'repetition-escape'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'entropy-shape': {
    label: 'Entropy shape',
    response: 'Temperature and filtering reshape next-token uncertainty before sampling, so the same logits can become concentrated, multi-path, or tail-heavy.',
  },
  'argmax-lock': {
    label: 'Argmax lock',
    response: 'Greedy argmax removes uncertainty, but decoding behavior depends on how much probability mass the strategy allows before a token is chosen.',
  },
  'tail-cutoff': {
    label: 'Tail cutoff',
    response: 'Top-p and top-k remove unlikely tails, but they work after the distribution has already been shaped by logits and temperature.',
  },
  'repetition-escape': {
    label: 'Repetition escape',
    response: 'Repetition penalties can break loops, but the general decoding mechanism is still probability shaping before token selection.',
  },
}

export default function DecodingSamplingDemo() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'entropy-shape'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'decoding-sampling',
      label: 'Prediction-first decoding distribution reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; decoding reveals ${expectedPrediction.label}.`
        : 'Learner is predicting which object controls decoding behavior before the sampling lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected mechanism: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `decoding invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `sampling lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
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
          <strong>What object should explain why decoding becomes concentrated, multi-path, or tail-heavy?</strong>
          <p>
            Predict the mechanism before the sampling lab appears. The reveal should connect logits,
            temperature, tail filters, and token choice into one distribution story.
          </p>
        </div>
        <div className="distributionPreview" aria-hidden="true">
          <div className="logits">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="filter">
            <span />
          </div>
          <div className="sample">
            <i />
          </div>
        </div>
        <div className="choiceRow" role="group" aria-label="Decoding mechanism prediction">
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
          Reveal decoding mechanism
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the mechanism this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to test greedy, temperature, top-p, top-k, and repetition penalty.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a mechanism to unlock the sampling lab.' : 'Reveal the mechanism to mount the sampling lab.'}</p>
        )}
      </section>

      <div className="panel">
        {revealed ? (
          <DecodingSamplingViz />
        ) : (
          <div className="panelGate">
            <span>Decoding and sampling lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the distribution object first, then inspect entropy, filters, and generated tokens.</p>
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

        .predictionPanel,
        .result,
        .panel {
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

        .distributionPreview {
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) 0.22fr minmax(0, 0.8fr);
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

        .logits,
        .sample {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.45rem;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.38);
        }

        .logits i {
          display: block;
          width: min(0.78rem, 12%);
          min-width: 0.36rem;
          border-radius: 999px 999px 4px 4px;
          background: rgba(20, 184, 166, 0.78);
          transform-origin: bottom center;
          animation: entropyShape 3s ease-in-out infinite;
        }

        .logits i:nth-child(1) { height: 76%; animation-delay: -0.1s; }
        .logits i:nth-child(2) { height: 58%; animation-delay: -0.2s; }
        .logits i:nth-child(3) { height: 44%; animation-delay: -0.3s; }
        .logits i:nth-child(4) { height: 32%; animation-delay: -0.4s; }
        .logits i:nth-child(5) { height: 24%; animation-delay: -0.5s; }
        .logits i:nth-child(6) { height: 19%; animation-delay: -0.6s; }
        .logits i:nth-child(7) { height: 14%; animation-delay: -0.7s; }

        .filter {
          position: relative;
          min-width: 0;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.1);
          overflow: hidden;
        }

        .filter::before {
          content: '';
          position: absolute;
          top: 16%;
          bottom: 16%;
          left: 48%;
          width: 2px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.78);
          animation: cutoffSweep 3s ease-in-out infinite;
        }

        .filter span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0.54rem;
          height: 0.54rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.95);
          transform: translate(-50%, -50%);
          animation: samplerPulse 2.2s ease-in-out infinite;
        }

        .sample {
          align-items: center;
        }

        .sample i {
          width: 1.8rem;
          height: 1.8rem;
          border-radius: 999px;
          background: radial-gradient(circle at 35% 35%, rgba(255, 251, 235, 0.9), rgba(245, 158, 11, 0.86));
          box-shadow: 0 0 24px rgba(245, 158, 11, 0.26);
          animation: tokenPop 2.8s ease-in-out infinite;
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

        @keyframes entropyShape {
          0%, 100% { transform: scaleY(1); opacity: 0.74; }
          50% { transform: scaleY(0.72); opacity: 1; }
        }

        @keyframes cutoffSweep {
          0%, 100% { left: 38%; }
          50% { left: 66%; }
        }

        @keyframes samplerPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.72; }
          50% { transform: translate(-50%, -50%) scale(1.12); opacity: 1; }
        }

        @keyframes tokenPop {
          0%, 100% { transform: translateY(0) scale(0.94); }
          50% { transform: translateY(-0.32rem) scale(1.05); }
        }

        @media (max-width: 720px) {
          .distributionPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .distributionPreview {
            min-height: 13rem;
          }

          .filter {
            min-height: 2.4rem;
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
