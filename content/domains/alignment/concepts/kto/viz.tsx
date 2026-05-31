import { useLayoutEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { emitDemoState } from '../../../../../lib/demoState'

const KTOViz = dynamic(() => import('@/components/foundations/KTOViz'), {
  ssr: false,
})

type PredictionKey = 'pairwise-winner' | 'kl-reference' | 'raw-answer' | 'unbounded-push'

const KTO_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Choose the reference before the loss opens.',
  },
  {
    label: 'Observe',
    detail: 'Reveal the KL-derived baseline comparison.',
  },
  {
    label: 'Ground',
    detail: 'Inspect label, log-ratio, baseline, and saturation.',
  },
  {
    label: 'Carry',
    detail: 'Binary feedback still needs a reference point.',
  },
]

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'pairwise-winner': {
    label: 'Pairwise winner',
    response: 'Pairwise winners are the DPO shape. KTO is designed for binary desirable or undesirable labels without a paired loser.',
  },
  'kl-reference': {
    label: 'KL reference point',
    response: 'KTO compares the policy/reference log-ratio against a KL-derived baseline, then pushes desirable examples above it and undesirable examples below it.',
  },
  'raw-answer': {
    label: 'Raw final answer',
    response: 'KTO is not scoring final-answer correctness directly. It uses a labeled completion and the policy/reference ratio of that completion.',
  },
  'unbounded-push': {
    label: 'Unbounded push',
    response: 'The logistic value saturates, so examples far beyond the reference point get smaller gradients instead of being pushed without limit.',
  },
}

export default function KTODemo() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'kl-reference'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = KTO_EVIDENCE_STEPS[evidenceActiveIndex].label.toLowerCase()

  useLayoutEffect(() => {
    const routeState = {
      conceptId: 'kto',
      label: 'Prediction-first KTO reference reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; KTO reveals ${expectedPrediction.label}.`
        : 'Learner is predicting what KTO compares binary feedback against before the KTO loss lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected reference: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `kto invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `kto loss lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <section
        className="predictionPanel"
        data-child-demo-gate="kto-kl-reference"
        aria-live="polite"
      >
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>What does KTO compare a thumbs-up or thumbs-down sample against?</strong>
          <p>
            Predict the reference point before the lab mounts. The reveal should distinguish KTO's binary-label
            utility from pairwise preference optimization.
          </p>
        </div>

        <div className="ktoPreview" aria-hidden="true">
          <div className="labelLane">
            <i />
            <i />
          </div>
          <div className="ratioLane">
            <i />
            <i />
            <i />
          </div>
          <div className="baselineLane">
            <i />
            <i />
          </div>
        </div>

        <div className="choiceRow" role="group" aria-label="KTO reference prediction">
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

        <div className="evidenceStrip" aria-label="KTO evidence loop">
          {KTO_EVIDENCE_STEPS.map((step, index) => (
            <div
              key={step.label}
              className={`evidenceStep ${index === evidenceActiveIndex ? 'active' : ''} ${
                index < evidenceActiveIndex ? 'complete' : ''
              }`}
            >
              <span>{index + 1}</span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
          ))}
        </div>

        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal KTO reference
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the reference this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to move the label, ratio, baseline, and saturation.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a reference shape to unlock the KTO lab.' : 'Reveal the reference to mount the KTO lab.'}</p>
        )}
      </section>

      {revealed ? (
        <KTOViz conceptId="kto" emitState />
      ) : (
        <div className="panelGate">
          <span>KTO loss lab</span>
          <strong>Hidden until prediction reveal</strong>
          <p>Commit to the reference point first, then inspect binary labels, delta, saturation, and gradient direction.</p>
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
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.76);
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
          color: #60707c;
        }

        .predictionCopy strong,
        .result h4,
        .panelGate strong {
          color: #17202a;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p,
        .panelGate p {
          margin: 0;
          color: #52606c;
          line-height: 1.5;
        }

        .ktoPreview {
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.05fr) minmax(0, 1fr);
          gap: 0.7rem;
          min-width: 0;
          min-height: 7.5rem;
          padding: 0.72rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.46);
          background-size: 24px 24px;
        }

        .labelLane,
        .ratioLane,
        .baselineLane {
          position: relative;
          min-width: 0;
          overflow: hidden;
          border-radius: 8px;
          background: rgba(23, 32, 42, 0.08);
        }

        .labelLane i,
        .ratioLane i,
        .baselineLane i {
          position: absolute;
          display: block;
          border-radius: 999px;
          animation: ktoPulse 3s ease-in-out infinite;
        }

        .labelLane i {
          left: 28%;
          width: 44%;
          height: 0.72rem;
        }

        .labelLane i:nth-child(1) { top: 34%; background: rgba(20, 184, 166, 0.88); animation-delay: -0.18s; }
        .labelLane i:nth-child(2) { top: 59%; background: rgba(248, 113, 113, 0.82); animation-delay: -0.58s; }

        .ratioLane i {
          left: 16%;
          right: 16%;
          height: 0.5rem;
          background: rgba(99, 102, 241, 0.76);
          animation-name: ratioSlide;
        }

        .ratioLane i:nth-child(1) { top: 29%; animation-delay: -0.14s; }
        .ratioLane i:nth-child(2) { top: 51%; animation-delay: -0.44s; }
        .ratioLane i:nth-child(3) { top: 73%; animation-delay: -0.74s; }

        .baselineLane i {
          left: 20%;
          width: 60%;
          height: 0.54rem;
          background: rgba(245, 158, 11, 0.82);
          animation-name: baselineHold;
        }

        .baselineLane i:nth-child(1) { top: 43%; animation-delay: -0.2s; }
        .baselineLane i:nth-child(2) { top: 56%; animation-delay: -0.5s; opacity: 0.42; }

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
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.72);
          color: #23303a;
          padding: 0.45rem 0.62rem;
          font: inherit;
          font-weight: 800;
          cursor: pointer;
        }

        .choiceRow button.selected {
          border-color: rgba(20, 184, 166, 0.58);
          background: rgba(226, 242, 239, 0.9);
          color: #103f3b;
        }

        .evidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.44rem;
          min-width: 0;
          padding: 0.5rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 8px;
          background: #111827;
        }

        .evidenceStep {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.15rem 0.38rem;
          min-width: 0;
          padding: 0.48rem;
          border: 1px solid rgba(255, 250, 240, 0.12);
          border-radius: 7px;
          background: rgba(255, 250, 240, 0.06);
        }

        .evidenceStep span {
          display: inline-grid;
          width: 1.18rem;
          height: 1.18rem;
          place-items: center;
          border-radius: 999px;
          background: rgba(255, 250, 240, 0.12);
          color: #f8ead9;
          font-size: 0.68rem;
          font-weight: 800;
        }

        .evidenceStep strong,
        .evidenceStep small {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .evidenceStep strong {
          color: #fffaf0;
          font-size: 0.76rem;
          line-height: 1.2;
        }

        .evidenceStep small {
          grid-column: 1 / -1;
          color: #cde7e3;
          font-size: 0.68rem;
          line-height: 1.35;
        }

        .evidenceStep.active {
          border-color: rgba(20, 184, 166, 0.68);
          background: rgba(20, 184, 166, 0.18);
        }

        .evidenceStep.active span,
        .evidenceStep.complete span {
          background: #14b8a6;
          color: #032f2b;
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
          background: rgba(226, 242, 239, 0.72);
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
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.44);
          background-size: 28px 28px;
        }

        @keyframes ktoPulse {
          0%, 100% { transform: scaleX(0.68); opacity: 0.5; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes ratioSlide {
          0%, 100% { transform: translateX(-0.2rem) scaleX(0.64); opacity: 0.46; }
          50% { transform: translateX(0.22rem) scaleX(1); opacity: 1; }
        }

        @keyframes baselineHold {
          0%, 100% { transform: scaleX(0.82); opacity: 0.54; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @media (max-width: 720px) {
          .ktoPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .ktoPreview {
            min-height: 13rem;
          }
        }
      `}</style>
    </div>
  )
}
