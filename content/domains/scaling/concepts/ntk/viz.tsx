import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

const NTKViz = dynamic(() => import('@/components/foundations/NTKViz'), { ssr: false })

type PredictionKey = 'fixed-kernel' | 'fast-feature-learning' | 'parameter-count-only' | 'training-loss-only'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'fixed-kernel': {
    label: 'Kernel stays fixed',
    response:
      'The NTK view is the fixed-gradient kernel view: near initialization, function values move through a mostly constant parameter-gradient inner-product kernel.',
  },
  'fast-feature-learning': {
    label: 'Features reorganize fast',
    response:
      'Fast feature reorganization is the rich finite-width contrast, not the NTK limit. The lab compares this moving-kernel regime against the frozen-kernel baseline.',
  },
  'parameter-count-only': {
    label: 'Only width matters',
    response:
      'Width pushes the system toward the NTK limit, but the mechanism is not raw parameter count. The key local witness is whether the effective kernel changes during training.',
  },
  'training-loss-only': {
    label: 'Loss alone reveals it',
    response:
      'Loss curves can look similar in short windows. The NTK diagnostic is more structural: compare function-space movement while the gradient-feature kernel stays fixed.',
  },
}

export default function NTKPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'fixed-kernel'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'ntk',
      label: 'Prediction-first NTK invariant reveal',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; NTK reveals ${expectedPrediction.label}.`
        : 'Learner is predicting the invariant that separates NTK-like linearized dynamics from feature learning before the lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected invariant: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `NTK invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `kernel dynamics lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routeState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routeState), 350)
    return () => window.clearTimeout(timer)
  }, [expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Predict the NTK invariant before the dynamics lab"
      subtitle="Commit to what should stay structurally stable in the linearized wide-network regime, then compare it against feature-learning dynamics."
      metrics={['kernel diagnostic', 'linearized dynamics', 'feature-learning contrast']}
      notes={
        <p>
          The checked source claim is scoped to infinite-width or explicitly
          linearized wide-network NTK dynamics near initialization. The lab uses
          a teaching contrast against a finite-width feature-learning toy model.
        </p>
      }
      challenge={
        <p>
          Predict first: in the NTK-like regime, which structural diagnostic
          should separate linearized dynamics from feature learning?
        </p>
      }
    >
      <VizStageAdapter
        padding="compact"
        overflowX
        ariaLabel="Scrollable NTK prediction and kernel-dynamics visualization"
      >
        <div className="wrap">
          <section className="predictionPanel" aria-live="polite">
            <div className="predictionCopy">
              <span>prediction checkpoint</span>
              <strong>What makes training NTK-like rather than feature-learning-like?</strong>
              <p>
                Choose the invariant before the lab mounts. The reveal should
                make the kernel matrix feel like the object being tested, not a
                decorative heatmap.
              </p>
            </div>

            <div className="kernelPreview" aria-hidden="true">
              <div className="matrix fixed">
                {Array.from({ length: 16 }).map((_, index) => (
                  <i key={`fixed-${index}`} />
                ))}
              </div>
              <div className="flowLine">
                <span />
              </div>
              <div className="matrix moving">
                {Array.from({ length: 16 }).map((_, index) => (
                  <i key={`moving-${index}`} />
                ))}
              </div>
            </div>

            <div className="choiceRow" role="group" aria-label="NTK invariant prediction">
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
              Reveal NTK invariant
            </button>
          </section>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the invariant this route emphasizes.`}</h4>
                <p>
                  {expectedPrediction.response} Use the lab below to compare
                  the frozen-kernel and feature-learning regimes. Its race
                  prompt is a second prediction: which regime has lower error
                  under the chosen settings.
                </p>
              </>
            ) : (
              <p>{prediction === null ? 'Choose an invariant to unlock the NTK lab.' : 'Reveal the invariant to mount the lab.'}</p>
            )}
          </section>

          {revealed ? (
            <NTKViz />
          ) : (
            <div className="panelGate">
              <span>NTK kernel-dynamics lab</span>
              <strong>Hidden until prediction reveal</strong>
              <p>Commit to an invariant first, then inspect width, feature motion, kernel heatmaps, and function-space error.</p>
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

        .kernelPreview {
          display: grid;
          grid-template-columns: minmax(6rem, 0.75fr) minmax(2.5rem, 0.28fr) minmax(6rem, 0.75fr);
          align-items: center;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.75rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background:
            linear-gradient(rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.05) 1px, transparent 1px),
            rgba(255, 255, 255, 0.46);
          background-size: 22px 22px;
        }

        .matrix {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.22rem;
          min-width: 0;
          aspect-ratio: 1;
          padding: 0.42rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(23, 32, 42, 0.08);
        }

        .matrix i {
          display: block;
          min-width: 0;
          border-radius: 3px;
          background: rgba(124, 58, 237, 0.42);
        }

        .matrix.fixed i:nth-child(3n) {
          background: rgba(245, 158, 11, 0.42);
        }

        .matrix.moving i {
          animation: kernelPulse 2.4s ease-in-out infinite;
        }

        .matrix.moving i:nth-child(2n) {
          background: rgba(20, 184, 166, 0.46);
          animation-delay: -0.4s;
        }

        .matrix.moving i:nth-child(3n) {
          background: rgba(245, 158, 11, 0.42);
          animation-delay: -0.8s;
        }

        .flowLine {
          position: relative;
          height: 2px;
          min-width: 0;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.18);
        }

        .flowLine span {
          position: absolute;
          inset: -3px auto -3px 0;
          width: 0.72rem;
          border-radius: 999px;
          background: #1f6f78;
          animation: sweep 2.8s ease-in-out infinite;
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
          background: rgba(255, 255, 255, 0.7);
          color: #23303a;
          font: inherit;
          line-height: 1.2;
          cursor: pointer;
        }

        .choiceRow button {
          padding: 0.48rem 0.58rem;
          font-size: 0.84rem;
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

        .reveal {
          justify-self: start;
          padding: 0 0.78rem;
          background: #1f6f78;
          color: #fffaf0;
          border-color: rgba(31, 111, 120, 0.8);
        }

        .reveal:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .result {
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

        @keyframes kernelPulse {
          0%, 100% { opacity: 0.42; transform: scale(0.96); }
          50% { opacity: 1; transform: scale(1); }
        }

        @keyframes sweep {
          0%, 100% { left: 0; opacity: 0.35; }
          50% { left: calc(100% - 0.72rem); opacity: 1; }
        }

        @media (max-width: 760px) {
          .choiceRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .kernelPreview {
            grid-template-columns: minmax(0, 1fr);
          }

          .flowLine {
            min-height: 2rem;
            width: 2px;
            justify-self: center;
          }

          .flowLine span {
            inset: 0 -3px auto -3px;
            width: auto;
            height: 0.72rem;
            animation-name: sweepVertical;
          }

          .choiceRow {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        @keyframes sweepVertical {
          0%, 100% { top: 0; opacity: 0.35; }
          50% { top: calc(100% - 0.72rem); opacity: 1; }
        }
      `}</style>
    </VizShell>
  )
}
