'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const RLHFProbabilityShapingViz = dynamic(() => import('@/components/foundations/RLHFProbabilityShapingViz'), {
  ssr: false,
})

type PredictionKey = 'reward-reweights-reference' | 'absolute-score-only' | 'shift-changes-policy' | 'ppo-is-definition'

const RLHF_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Choose the probability-moving object first.',
  },
  {
    label: 'Observe',
    detail: 'Reveal how reward reshapes the reference.',
  },
  {
    label: 'Ground',
    detail: 'Inspect beta, weights, and normalization.',
  },
  {
    label: 'Carry',
    detail: 'Remember reward moves probability through the reference.',
  },
]

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'reward-reweights-reference': {
    label: 'Reward reshapes reference',
    response:
      'In the finite-action view, the learned reward multiplies each reference probability by exp(r_model / beta), then normalization turns those weights into the new policy. Beta is the KL-reference anchor that controls how far probability mass moves.',
  },
  'absolute-score-only': {
    label: 'Absolute score wins',
    response:
      'The reward score matters, but RLHF does not ignore the starting distribution. The reference policy and the KL anchor decide how far probability mass moves.',
  },
  'shift-changes-policy': {
    label: 'Reward shift changes it',
    response:
      'Adding the same constant to every reward multiplies all unnormalized weights by the same factor, so the normalized policy is unchanged.',
  },
  'ppo-is-definition': {
    label: 'PPO is the definition',
    response:
      'PPO is one optimizer used in large language-model RLHF. The finite-action objective defines the clean probability-shaping target.',
  },
}

export default function RLHFPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'reward-reweights-reference'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = RLHF_EVIDENCE_STEPS[evidenceActiveIndex].label.toLowerCase()

  useEffect(() => {
    const routeState = {
      conceptId: revealed ? 'rlhf-prediction-checkpoint' : 'rlhf',
      label: 'Prediction-first RLHF update reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; RLHF reveals ${expectedPrediction.label}.`
        : 'Learner is choosing among RLHF update shapes before the lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected update: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `RLHF invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `RLHF lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <>
      <VizStageAdapter
        padding="compact"
        overflowX
        ariaLabel="Scrollable RLHF update prediction checkpoint and gated lab"
      >
        <div className="wrap">
          <section
            className="predictionPanel"
            data-child-demo-gate="rlhf-probability-shaping"
            aria-live="polite"
          >
            <div className="predictionCopy">
              <span>prediction checkpoint</span>
              <strong>What does the reward model change before the policy is normalized?</strong>
              <p>
                Choose the update shape before the lab mounts. The reveal will
                make the update rule inspectable before you tune it.
              </p>
            </div>

            <div className="rlhfPreview" aria-hidden="true">
              <div className="comparisonCards">
                <span />
                <span />
              </div>
              <div className="updateRail">
                <i />
                <i />
              </div>
              <div className="distributionBars">
                <span />
                <span />
                <span />
                <span />
              </div>
            </div>

            <div className="choiceRow" role="group" aria-label="RLHF update prediction">
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

            <div className="evidenceStrip" aria-label="RLHF evidence loop">
              {RLHF_EVIDENCE_STEPS.map((step, index) => (
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
              Reveal RLHF update
            </button>
          </section>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the update this route emphasizes.`}</h4>
                <p>
                  {expectedPrediction.response} Use the lab below to move the
                  anchor strength, reward shift, and proxy gap.
                </p>
              </>
            ) : (
              <p>{prediction === null ? 'Choose an update shape to unlock the RLHF lab.' : 'Reveal the update to mount the RLHF lab.'}</p>
            )}
          </section>

          {revealed ? (
            <RLHFProbabilityShapingViz conceptId="rlhf" emitState />
          ) : (
            <div className="panelGate">
              <span>RLHF probability lab</span>
              <strong>Hidden until prediction reveal</strong>
              <p>Commit to an update shape first; the lab controls stay hidden until reveal.</p>
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

        .rlhfPreview {
          display: grid;
          grid-template-columns: minmax(7rem, 0.78fr) minmax(3rem, 0.28fr) minmax(8rem, 1fr);
          align-items: center;
          gap: 0.7rem;
          min-width: 0;
          min-height: 8.25rem;
          padding: 0.75rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.46);
          background-size: 22px 22px;
        }

        .comparisonCards,
        .distributionBars {
          min-width: 0;
          padding: 0.68rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(23, 32, 42, 0.08);
        }

        .comparisonCards {
          display: grid;
          gap: 0.55rem;
        }

        .comparisonCards span,
        .distributionBars span {
          display: block;
          border-radius: 999px;
          animation: previewPulse 3s ease-in-out infinite;
        }

        .comparisonCards span {
          height: 0.92rem;
          background: rgba(31, 111, 120, 0.6);
        }

        .comparisonCards span:nth-child(2) {
          width: 72%;
          background: rgba(124, 58, 237, 0.4);
          animation-delay: -0.42s;
        }

        .updateRail {
          position: relative;
          height: 2px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.18);
        }

        .updateRail i {
          position: absolute;
          inset: -4px auto -4px 0;
          width: 0.72rem;
          border-radius: 999px;
          background: #1f6f78;
          animation: updateSweep 2.7s ease-in-out infinite;
        }

        .updateRail i:nth-child(2) {
          background: #c26f34;
          animation-delay: -0.74s;
        }

        .distributionBars {
          display: grid;
          gap: 0.42rem;
        }

        .distributionBars span {
          height: 0.72rem;
          background: rgba(31, 111, 120, 0.54);
        }

        .distributionBars span:nth-child(1) { width: 68%; }
        .distributionBars span:nth-child(2) { width: 52%; background: rgba(124, 58, 237, 0.36); animation-delay: -0.2s; }
        .distributionBars span:nth-child(3) { width: 42%; background: rgba(194, 111, 52, 0.42); animation-delay: -0.4s; }
        .distributionBars span:nth-child(4) { width: 58%; background: rgba(31, 111, 120, 0.42); animation-delay: -0.6s; }

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

        @keyframes previewPulse {
          0%, 100% { transform: scaleX(0.76); opacity: 0.55; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes updateSweep {
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
          .rlhfPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .rlhfPreview {
            min-height: 14rem;
          }

          .updateRail {
            min-height: 2rem;
            width: 2px;
            justify-self: center;
          }

          .updateRail i {
            inset: 0 -4px auto -4px;
            width: auto;
            height: 0.72rem;
            animation-name: updateSweepVertical;
          }
        }

        @keyframes updateSweepVertical {
          0%, 100% { top: 0; opacity: 0.36; }
          50% { top: calc(100% - 0.72rem); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .comparisonCards span,
          .distributionBars span,
          .updateRail i {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
