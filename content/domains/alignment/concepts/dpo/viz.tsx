'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const DPORatioViz = dynamic(() => import('@/components/foundations/DPORatioViz'), {
  ssr: false,
})

type PredictionKey = 'raw-winner-probability' | 'reward-model-score' | 'reference-relative-odds' | 'kl-penalty-only'

const DPO_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Name the comparator before the table appears.',
  },
  {
    label: 'Observe',
    detail: 'Reveal which quantity the pair tests.',
  },
  {
    label: 'Ground',
    detail: 'Inspect policy and reference log-ratios.',
  },
  {
    label: 'Carry',
    detail: 'Treat preference as a relative update signal.',
  },
]

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'raw-winner-probability': {
    label: 'Raw winner probability',
    response:
      'DPO does not only ask whether the preferred response is likely. It asks whether the winner-loser odds improved beyond the reference odds.',
  },
  'reward-model-score': {
    label: 'Reward model score',
    response:
      'DPO is designed to avoid training a separate reward model. The policy/reference log-ratio acts as an implicit reward representative.',
  },
  'reference-relative-odds': {
    label: 'Policy move vs reference',
    response:
      'DPO compares the current winner-loser log-odds against the reference winner-loser log-odds, then fits the beta-scaled difference with binary cross-entropy.',
  },
  'kl-penalty-only': {
    label: 'KL penalty alone',
    response:
      'The KL anchor matters, but DPO still needs the preference pair. The supervised signal is the reference-relative winner-loser margin.',
  },
}

export default function DPOPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'reference-relative-odds'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = DPO_EVIDENCE_STEPS[evidenceActiveIndex].label.toLowerCase()

  useEffect(() => {
    const routeState = {
      conceptId: revealed ? 'dpo-prediction-checkpoint' : 'dpo',
      label: 'Prediction-first DPO comparator reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; DPO reveals ${expectedPrediction.label}.`
        : 'Learner is predicting what object a DPO preference pair compares before the lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected comparator: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `DPO invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `DPO lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <>
      <VizStageAdapter
        padding="compact"
        overflowX
        ariaLabel="Scrollable DPO comparator prediction and lab"
      >
        <div className="wrap">
          <section
            className="predictionPanel"
            data-child-demo-gate="dpo-reference-relative-odds"
            aria-live="polite"
          >
            <div className="predictionCopy">
              <span>prediction checkpoint</span>
              <strong>What is DPO measuring before the loss moves the policy?</strong>
              <p>
                Choose the comparator before the lab mounts. The reveal should
                make the preference pair feel like a precise update signal
                rather than a generic thumbs-up label.
              </p>
            </div>

            <div className="dpoPreview" aria-hidden="true">
              <div className="completionPair">
                <span />
                <span />
              </div>
              <div className="comparatorBeam">
                <i />
                <i />
              </div>
              <div className="lossSurface">
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="choiceRow" role="group" aria-label="DPO comparator prediction">
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

            <div className="evidenceStrip" aria-label="DPO evidence loop">
              {DPO_EVIDENCE_STEPS.map((step, index) => (
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
              Reveal DPO comparator
            </button>
          </section>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the comparator this route emphasizes.`}</h4>
                <p>
                  {expectedPrediction.response} The lab below uses a
                  two-completion soft-target toy so the finite target is visible;
                  hard-label DPO is the p* approaching 1 edge case.
                </p>
              </>
            ) : (
              <p>{prediction === null ? 'Choose a comparator to unlock the DPO lab.' : 'Reveal the comparator to mount the DPO lab.'}</p>
            )}
          </section>

          {revealed ? (
            <DPORatioViz conceptId="dpo" emitState />
          ) : (
            <div className="panelGate">
              <span>DPO lab</span>
              <strong>Hidden until prediction reveal</strong>
              <p>Commit to the comparator first, then inspect the controls, loss, and update direction.</p>
            </div>
          )}
        </div>
      </VizStageAdapter>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          min-width: min(100%, 34rem);
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

        .dpoPreview {
          display: grid;
          grid-template-columns: minmax(7rem, 0.8fr) minmax(3rem, 0.32fr) minmax(7rem, 0.85fr);
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
          min-height: 8rem;
          padding: 0.75rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.46);
          background-size: 22px 22px;
        }

        .completionPair,
        .lossSurface {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
          padding: 0.7rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(23, 32, 42, 0.08);
        }

        .completionPair span,
        .lossSurface span {
          display: block;
          height: 1rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.68);
          animation: dpoPulse 2.8s ease-in-out infinite;
        }

        .completionPair span:nth-child(2) {
          width: 72%;
          background: rgba(194, 111, 52, 0.48);
          animation-delay: -0.42s;
        }

        .lossSurface span:nth-child(1) {
          width: 46%;
          background: rgba(124, 58, 237, 0.42);
        }

        .lossSurface span:nth-child(2) {
          width: 70%;
          background: rgba(31, 111, 120, 0.56);
          animation-delay: -0.3s;
        }

        .lossSurface span:nth-child(3) {
          width: 88%;
          background: rgba(245, 158, 11, 0.5);
          animation-delay: -0.6s;
        }

        .comparatorBeam {
          position: relative;
          min-width: 0;
          height: 2px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.18);
        }

        .comparatorBeam i {
          position: absolute;
          inset: -4px auto -4px 0;
          width: 0.72rem;
          border-radius: 999px;
          background: #1f6f78;
          animation: comparatorSweep 2.7s ease-in-out infinite;
        }

        .comparatorBeam i:nth-child(2) {
          background: #c26f34;
          animation-delay: -0.72s;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .choiceRow button,
        .reveal {
          min-width: 0;
          min-height: 2.5rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background: rgba(255, 255, 255, 0.72);
          color: #23303a;
          font: inherit;
          line-height: 1.2;
          cursor: pointer;
        }

        .choiceRow button {
          padding: 0.48rem 0.58rem;
          font-size: 0.82rem;
        }

        .choiceRow button:hover,
        .choiceRow button:focus-visible {
          border-color: rgba(31, 111, 120, 0.48);
        }

        .choiceRow button.selected {
          border-color: rgba(31, 111, 120, 0.72);
          background: rgba(226, 242, 239, 0.9);
          color: #143c43;
        }

        .evidenceStrip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.44rem;
          min-width: 0;
          padding: 0.5rem;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #1b2430;
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
          color: #c9d5d9;
          font-size: 0.68rem;
          line-height: 1.35;
        }

        .evidenceStep.active {
          border-color: rgba(31, 111, 120, 0.72);
          background: rgba(31, 111, 120, 0.24);
        }

        .evidenceStep.active span,
        .evidenceStep.complete span {
          background: #1f6f78;
          color: #fffaf0;
        }

        .reveal {
          justify-self: start;
          padding: 0 0.78rem;
          background: #1f6f78;
          color: #fffaf0;
          border-color: rgba(31, 111, 120, 0.8);
        }

        .reveal:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .result {
          min-height: 5rem;
          background: rgba(255, 255, 255, 0.54);
        }

        .result.shown {
          border-color: rgba(31, 111, 120, 0.25);
          background: rgba(226, 242, 239, 0.7);
        }

        .result h4 {
          margin: 0;
          font-size: 0.98rem;
        }

        .panelGate {
          min-height: 12rem;
          align-content: center;
          text-align: center;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.44);
          background-size: 26px 26px;
        }

        @keyframes dpoPulse {
          0%, 100% { transform: scaleX(0.7); opacity: 0.52; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes comparatorSweep {
          0%, 100% { left: 0; opacity: 0.36; }
          50% { left: calc(100% - 0.72rem); opacity: 1; }
        }

        @media (max-width: 760px) {
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 540px) {
          .dpoPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .dpoPreview {
            min-height: 14rem;
          }

          .comparatorBeam {
            min-height: 2rem;
            width: 2px;
            justify-self: center;
          }

          .comparatorBeam i {
            inset: 0 -4px auto -4px;
            width: auto;
            height: 0.72rem;
            animation-name: comparatorSweepVertical;
          }
        }

        @keyframes comparatorSweepVertical {
          0%, 100% { top: 0; opacity: 0.36; }
          50% { top: calc(100% - 0.72rem); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .completionPair span,
          .lossSurface span,
          .comparatorBeam i {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
