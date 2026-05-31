'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const RewardHackingViz = dynamic(() => import('@/components/foundations/RewardHackingViz'), {
  ssr: false,
})

type PredictionKey = 'proxy-up-true-down' | 'kl-proves-safety' | 'uncertainty-solves-it' | 'clean-score-only'

const REWARD_HACKING_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    detail: 'Choose the diagnostic before the hidden target is shown.',
  },
  {
    label: 'Observe',
    detail: 'Reveal proxy and target moving apart.',
  },
  {
    label: 'Ground',
    detail: 'Inspect pressure, KL, uncertainty, and selected mass.',
  },
  {
    label: 'Carry',
    detail: 'Separate score improvement from target improvement.',
  },
]

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'proxy-up-true-down': {
    label: 'Proxy rises, target falls',
    response:
      'Reward hacking is visible when optimization raises the learned score while probability mass shifts toward outputs whose hidden target utility is worse than the reference baseline.',
  },
  'kl-proves-safety': {
    label: 'KL proves safety',
    response:
      'A KL anchor slows movement away from the reference policy. It does not prove that the learned score is the target being optimized for.',
  },
  'uncertainty-solves-it': {
    label: 'Uncertainty fixes proxy',
    response:
      'Uncertainty penalties can make dubious outputs less attractive, but they do not turn a proxy score into the target itself.',
  },
  'clean-score-only': {
    label: 'Clean score alone',
    response:
      'A high clean-looking score is not enough. The diagnostic compares the selected proxy score against hidden target utility under optimization pressure.',
  },
}

export default function RewardHackingPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'proxy-up-true-down'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = REWARD_HACKING_EVIDENCE_STEPS[evidenceActiveIndex].label.toLowerCase()

  useEffect(() => {
    const routeState = {
      conceptId: revealed ? 'reward-hacking-prediction-checkpoint' : 'reward-hacking',
      label: 'Prediction-first reward hacking diagnostic reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; reward hacking reveals ${expectedPrediction.label}.`
        : 'Learner is predicting which hidden diagnostic should separate useful optimization from a proxy failure before the lab is mounted.',
      values: [
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${evidencePhase}`,
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected diagnostic: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `reward hacking invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `reward hacking lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)
  }, [evidencePhase, expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <>
      <VizStageAdapter
        padding="compact"
        overflowX
        ariaLabel="Scrollable reward hacking diagnostic prediction and lab"
      >
        <div className="wrap">
          <section
            className="predictionPanel"
            data-child-demo-gate="reward-hacking-proxy-gap"
            aria-live="polite"
          >
            <div className="predictionCopy">
              <span>prediction checkpoint</span>
              <strong>What should move in the wrong direction when the optimizer finds a loophole?</strong>
              <p>
                Choose the diagnostic before the lab mounts. The reveal should
                make the difference between stronger optimization and better
                behavior feel testable.
              </p>
            </div>

            <div className="hackingPreview" aria-hidden="true">
              <div className="candidateStack">
                <span />
                <span />
                <span />
              </div>
              <div className="pressureRail">
                <i />
                <i />
              </div>
              <div className="diagnosticChart">
                <svg viewBox="0 0 160 94">
                  <path className="lineNeutral" d="M14 48 C42 46, 66 50, 92 48 S128 47, 146 49" />
                  <path className="lineNeutralAlt" d="M14 58 C42 57, 66 55, 92 57 S128 56, 146 58" />
                </svg>
              </div>
            </div>

            <div className="choiceRow" role="group" aria-label="Reward hacking diagnostic prediction">
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

            <div className="evidenceStrip" aria-label="Reward hacking evidence loop">
              {REWARD_HACKING_EVIDENCE_STEPS.map((step, index) => (
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
              Reveal diagnostic
            </button>
          </section>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the diagnostic this route emphasizes.`}</h4>
                <p>
                  {expectedPrediction.response} Use the lab below to move
                  optimization pressure and uncertainty penalties. KL anchoring
                  and uncertainty scoring are brakes, not proof that the proxy
                  is the target.
                </p>
              </>
            ) : (
              <p>{prediction === null ? 'Choose a diagnostic to unlock the reward-hacking lab.' : 'Reveal the diagnostic to mount the lab.'}</p>
            )}
          </section>

          {revealed ? (
            <RewardHackingViz conceptId="reward-hacking" emitState />
          ) : (
            <div className="panelGate">
              <span>Reward hacking lab</span>
              <strong>Hidden until prediction reveal</strong>
              <p>Commit to a diagnostic first, then inspect policy mass, optimization pressure, uncertainty, and selected outcomes.</p>
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

        .hackingPreview {
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

        .candidateStack,
        .diagnosticChart {
          min-width: 0;
          padding: 0.68rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(23, 32, 42, 0.08);
        }

        .candidateStack {
          display: grid;
          gap: 0.46rem;
        }

        .candidateStack span {
          display: block;
          height: 0.9rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.62);
          animation: candidatePulse 3s ease-in-out infinite;
        }

        .candidateStack span:nth-child(2) {
          width: 78%;
          background: rgba(124, 58, 237, 0.38);
          animation-delay: -0.28s;
        }

        .candidateStack span:nth-child(3) {
          width: 54%;
          background: rgba(180, 75, 59, 0.52);
          animation-delay: -0.56s;
        }

        .pressureRail {
          position: relative;
          height: 2px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.18);
        }

        .pressureRail i {
          position: absolute;
          inset: -4px auto -4px 0;
          width: 0.72rem;
          border-radius: 999px;
          background: #1f6f78;
          animation: pressureSweep 2.7s ease-in-out infinite;
        }

        .pressureRail i:nth-child(2) {
          background: #b44b3b;
          animation-delay: -0.74s;
        }

        .diagnosticChart svg {
          display: block;
          width: 100%;
          height: auto;
        }

        .diagnosticChart path {
          fill: none;
          stroke-width: 5;
          stroke-linecap: round;
        }

        .lineNeutral {
          stroke: rgba(31, 111, 120, 0.55);
          animation: drawLine 3.2s ease-in-out infinite;
        }

        .lineNeutralAlt {
          stroke: rgba(124, 58, 237, 0.38);
          stroke-dasharray: 7 7;
          animation: drawLine 3.2s ease-in-out infinite reverse;
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
          color: #d8d0ca;
          font-size: 0.68rem;
          line-height: 1.35;
        }

        .evidenceStep.active {
          border-color: rgba(180, 75, 59, 0.72);
          background: rgba(180, 75, 59, 0.24);
        }

        .evidenceStep.active span,
        .evidenceStep.complete span {
          background: #b44b3b;
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

        @keyframes candidatePulse {
          0%, 100% { transform: scaleX(0.74); opacity: 0.54; }
          50% { transform: scaleX(1); opacity: 1; }
        }

        @keyframes pressureSweep {
          0%, 100% { left: 0; opacity: 0.36; }
          50% { left: calc(100% - 0.72rem); opacity: 1; }
        }

        @keyframes drawLine {
          0%, 100% { opacity: 0.54; }
          50% { opacity: 1; }
        }

        @media (max-width: 760px) {
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 540px) {
          .hackingPreview,
          .choiceRow,
          .evidenceStrip {
            grid-template-columns: 1fr;
          }

          .hackingPreview {
            min-height: 14rem;
          }

          .pressureRail {
            min-height: 2rem;
            width: 2px;
            justify-self: center;
          }

          .pressureRail i {
            inset: 0 -4px auto -4px;
            width: auto;
            height: 0.72rem;
            animation-name: pressureSweepVertical;
          }
        }

        @keyframes pressureSweepVertical {
          0%, 100% { top: 0; opacity: 0.36; }
          50% { top: calc(100% - 0.72rem); opacity: 1; }
        }

        @media (prefers-reduced-motion: reduce) {
          .candidateStack span,
          .pressureRail i,
          .diagnosticChart path {
            animation: none;
          }
        }
      `}</style>
    </>
  )
}
