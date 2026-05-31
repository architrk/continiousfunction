import { useEffect, useState } from 'react'
import LayerNormViz from '@/components/foundations/LayerNormViz'
import { emitDemoState } from '../../../../../lib/demoState'

type PredictionKey = 'centering' | 'scale-only' | 'affine' | 'batch-coupling'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  centering: {
    label: 'Mean-centering',
    response: 'LayerNorm subtracts the token-wise mean before scaling, so nonzero-mean activations can rotate to a different output direction than RMSNorm.',
  },
  'scale-only': {
    label: 'Scale only',
    response: 'RMSNorm keeps the input direction closer because it divides by root-mean-square size without subtracting the mean.',
  },
  affine: {
    label: 'Gamma/beta restore',
    response: 'Learned affine parameters let the model recover useful scale and shift, but they are not the first distinction between LayerNorm and RMSNorm.',
  },
  'batch-coupling': {
    label: 'Batch coupling',
    response: 'Batch-dependent statistics are the BatchNorm issue; LayerNorm and RMSNorm are per-token normalization schemes.',
  },
}

export default function LayerNormalizationPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'centering'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'layer-normalization',
      label: 'Prediction-first LayerNorm centering reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; LayerNorm reveals ${expectedPrediction.label}.`
        : 'Learner is predicting which operation separates LayerNorm from RMSNorm before the normalization lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected operation: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `normalization invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `normalization lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
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
          <strong>What operation most changes LayerNorm compared with RMSNorm?</strong>
          <p>
            Predict the mechanism before the lab appears. The reveal should make the vector difference feel like
            a concrete operation, not a naming convention.
          </p>
        </div>
        <div className="normPreview" aria-hidden="true">
          <div className="vectorStack">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <div className="meanPlane">
            <span />
          </div>
          <div className="outputStack">
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="choiceRow" role="group" aria-label="Layer normalization operation prediction">
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
          Reveal normalization operation
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the operation this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to compare zero-mean, positive, uniform, and outlier activations.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose an operation to unlock the normalization lab.' : 'Reveal the operation to mount the normalization lab.'}</p>
        )}
      </section>

      <div className="demoPanel">
        {revealed ? (
          <LayerNormViz conceptId="layer-normalization" />
        ) : (
          <div className="panelGate">
            <span>LayerNorm vs RMSNorm lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the operation first, then inspect mean, standard deviation, RMS, and output similarity.</p>
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
        .demoPanel {
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

        .normPreview {
          position: relative;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 0.18fr minmax(0, 1fr);
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

        .vectorStack,
        .outputStack {
          display: flex;
          align-items: end;
          justify-content: center;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.45rem;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.38);
        }

        .vectorStack i,
        .outputStack i {
          display: block;
          width: min(0.75rem, 12%);
          min-width: 0.36rem;
          border-radius: 999px 999px 4px 4px;
          background: rgba(20, 184, 166, 0.78);
          transform-origin: bottom center;
          animation: centerBars 2.8s ease-in-out infinite;
        }

        .vectorStack i:nth-child(1) { height: 28%; animation-delay: -0.1s; }
        .vectorStack i:nth-child(2) { height: 42%; animation-delay: -0.2s; }
        .vectorStack i:nth-child(3) { height: 24%; animation-delay: -0.3s; }
        .vectorStack i:nth-child(4) { height: 82%; animation-delay: -0.4s; }
        .vectorStack i:nth-child(5) { height: 36%; animation-delay: -0.5s; }
        .vectorStack i:nth-child(6) { height: 52%; animation-delay: -0.6s; }
        .vectorStack i:nth-child(7) { height: 48%; animation-delay: -0.7s; }

        .outputStack i {
          background: rgba(245, 158, 11, 0.8);
          animation-name: scaleBars;
        }

        .outputStack i:nth-child(1) { height: 42%; animation-delay: -0.15s; }
        .outputStack i:nth-child(2) { height: 55%; animation-delay: -0.25s; }
        .outputStack i:nth-child(3) { height: 36%; animation-delay: -0.35s; }
        .outputStack i:nth-child(4) { height: 76%; animation-delay: -0.45s; }
        .outputStack i:nth-child(5) { height: 46%; animation-delay: -0.55s; }
        .outputStack i:nth-child(6) { height: 64%; animation-delay: -0.65s; }
        .outputStack i:nth-child(7) { height: 58%; animation-delay: -0.75s; }

        .meanPlane {
          position: relative;
          align-self: stretch;
          min-width: 0;
          border-radius: 10px;
          background: rgba(99, 102, 241, 0.1);
          overflow: hidden;
        }

        .meanPlane::before,
        .meanPlane::after {
          content: '';
          position: absolute;
          left: 50%;
          top: 15%;
          bottom: 15%;
          width: 1px;
          background: rgba(148, 163, 184, 0.22);
        }

        .meanPlane::after {
          left: 18%;
          background: rgba(245, 158, 11, 0.42);
          animation: meanShift 2.8s ease-in-out infinite;
        }

        .meanPlane span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0.58rem;
          height: 0.58rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.95);
          transform: translate(-50%, -50%);
          animation: meanDot 2.8s ease-in-out infinite;
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

        @keyframes centerBars {
          0%, 100% { transform: translateY(0) scaleY(1); }
          50% { transform: translateY(0.35rem) scaleY(0.82); }
        }

        @keyframes scaleBars {
          0%, 100% { transform: scaleY(0.96); opacity: 0.72; }
          50% { transform: scaleY(1.08); opacity: 1; }
        }

        @keyframes meanShift {
          0%, 100% { left: 18%; }
          50% { left: 50%; }
        }

        @keyframes meanDot {
          0%, 100% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.74; }
          50% { transform: translate(-50%, -50%) scale(1.08); opacity: 1; }
        }

        @media (max-width: 720px) {
          .normPreview,
          .choiceRow {
            grid-template-columns: 1fr;
          }

          .normPreview {
            min-height: 14rem;
          }

          .meanPlane {
            min-height: 2.6rem;
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
