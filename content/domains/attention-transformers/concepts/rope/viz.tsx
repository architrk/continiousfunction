import { useEffect, useState } from 'react'
import RoPEViz from '@/components/foundations/RoPEViz'
import { emitDemoState } from '../../../../../lib/demoState'

type PredictionKey = 'relative-phase' | 'absolute-index' | 'vector-length' | 'cache-memory'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  'relative-phase': {
    label: 'Relative phase',
    response: 'RoPE makes the query-key dot product depend on the angle gap between positions, so shifting both tokens preserves the relative-position score.',
  },
  'absolute-index': {
    label: 'Absolute index',
    response: 'Absolute indices rotate each vector, but the key attention score is controlled by the difference between their rotations.',
  },
  'vector-length': {
    label: 'Vector length',
    response: 'The rotation preserves vector length, but that is not the mechanism that lets attention compare relative positions.',
  },
  'cache-memory': {
    label: 'Cache memory',
    response: 'KV memory matters for long-context serving, but RoPE itself is a positional phase mechanism rather than a cache-allocation mechanism.',
  },
}

export default function RoPEPredictionViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'relative-phase'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routeState = {
      conceptId: 'rope',
      label: 'Prediction-first RoPE phase invariant',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; RoPE reveals ${expectedPrediction.label}.`
        : 'Learner is predicting which quantity RoPE should preserve before the rotating-vector lab is mounted.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected invariant: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `phase invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `rotating-vector lab: ${revealed ? 'mounted' : 'hidden until reveal'}`,
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
          <strong>When both token positions shift, what should RoPE preserve?</strong>
          <p>
            Commit to the invariant before the rotating-vector lab appears. The reveal should make the
            attention score feel geometric, not memorized.
          </p>
        </div>
        <div className="phasePreview" aria-hidden="true">
          <div className="circle">
            <i className="ray rayA" />
            <i className="ray rayB" />
            <span className="arc" />
          </div>
          <div className="shiftRail">
            <i />
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="choiceRow" role="group" aria-label="RoPE invariant prediction">
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
          Reveal phase invariant
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the invariant this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the lab below to shift both positions and watch the relative gap hold.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose an invariant to unlock the RoPE lab.' : 'Reveal the invariant to mount the RoPE lab.'}</p>
        )}
      </section>

      <div className="demoPanel">
        {revealed ? (
          <RoPEViz conceptId="rope" />
        ) : (
          <div className="panelGate">
            <span>RoPE rotating-vector lab</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the invariant first, then inspect phase, relative distance, and dot product.</p>
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

        .phasePreview {
          display: grid;
          grid-template-columns: minmax(7rem, 0.55fr) minmax(0, 1fr);
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

        .circle {
          position: relative;
          min-height: 5.6rem;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          align-self: center;
          aspect-ratio: 1;
          justify-self: center;
          width: min(100%, 6.4rem);
          animation: softRotate 7s linear infinite;
        }

        .circle::after {
          content: '';
          position: absolute;
          inset: 50%;
          width: 0.42rem;
          height: 0.42rem;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.95);
          transform: translate(-50%, -50%);
        }

        .ray {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 39%;
          height: 2px;
          transform-origin: left center;
          border-radius: 999px;
        }

        .rayA {
          background: rgba(20, 184, 166, 0.95);
          transform: rotate(24deg);
        }

        .rayB {
          background: rgba(245, 158, 11, 0.95);
          transform: rotate(94deg);
        }

        .arc {
          position: absolute;
          inset: 1rem;
          border: 2px dashed rgba(99, 102, 241, 0.42);
          border-left-color: transparent;
          border-bottom-color: transparent;
          border-radius: 999px;
          animation: phasePulse 2.4s ease-in-out infinite;
        }

        .shiftRail {
          position: relative;
          min-height: 5.6rem;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.42);
        }

        .shiftRail::before,
        .shiftRail::after {
          content: '';
          position: absolute;
          left: 10%;
          right: 10%;
          height: 1px;
          background: rgba(148, 163, 184, 0.25);
        }

        .shiftRail::before { top: 38%; }
        .shiftRail::after { top: 62%; }

        .shiftRail i {
          position: absolute;
          top: 50%;
          width: 0.56rem;
          height: 0.56rem;
          border-radius: 999px;
          background: rgba(20, 184, 166, 0.95);
          transform: translateY(-50%);
          animation: shiftPair 3.4s ease-in-out infinite;
        }

        .shiftRail i:nth-child(1) { left: 18%; top: 38%; }
        .shiftRail i:nth-child(2) { left: 38%; top: 38%; background: rgba(245, 158, 11, 0.95); }
        .shiftRail i:nth-child(3) { left: 42%; top: 62%; animation-delay: -1.3s; }
        .shiftRail i:nth-child(4) { left: 62%; top: 62%; background: rgba(245, 158, 11, 0.95); animation-delay: -1.3s; }

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

        @keyframes softRotate {
          to { transform: rotate(360deg); }
        }

        @keyframes phasePulse {
          0%, 100% { opacity: 0.42; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1.02); }
        }

        @keyframes shiftPair {
          0%, 100% { transform: translate(0, -50%); }
          50% { transform: translate(1.1rem, -50%); }
        }

        @media (max-width: 720px) {
          .phasePreview,
          .choiceRow {
            grid-template-columns: 1fr;
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
