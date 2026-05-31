import { useEffect, useState } from 'react'
import TokenizationViz from '@/components/foundations/TokenizationViz'
import { emitDemoState } from '../../../../../lib/demoState'

type PredictionKey = 'merge' | 'byte' | 'unicode' | 'cost'

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  merge: {
    label: 'Merge compression',
    response: 'The invariant is that frequent spans become reusable tokens, reducing token count for familiar text.',
  },
  byte: {
    label: 'Byte fallback',
    response: 'The invariant is that every input remains representable, even when no learned vocabulary entry matches cleanly.',
  },
  unicode: {
    label: 'Unicode boundary',
    response: 'The invariant is that visual characters and model tokens can disagree because bytes, code points, and merges are different objects.',
  },
  cost: {
    label: 'Context cost',
    response: 'The invariant is that token count, not character count, controls context length, attention cost, and serving memory pressure.',
  },
}

export default function TokenizationVocabularyViz() {
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const expected: PredictionKey = 'cost'
  const expectedPrediction = PREDICTIONS[expected]
  const predictionCorrect = prediction === expected

  useEffect(() => {
    const routerState = {
      conceptId: 'tokenization-vocabulary',
      label: 'Prediction-first tokenization boundary',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; the tokenizer microscope reveals ${expectedPrediction.label}.`
        : 'Learner is predicting which boundary the tokenizer microscope should make concrete before the tokenizer state is revealed.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `expected boundary: ${revealed ? expectedPrediction.label : 'hidden until reveal'}`,
        `boundary invariant: ${revealed ? expectedPrediction.response : 'hidden until reveal'}`,
        `tokenizer microscope: ${revealed ? 'mounted' : 'hidden until reveal'}`,
      ],
    }

    emitDemoState(routerState)

    if (!revealed || typeof window === 'undefined') return undefined

    const timer = window.setTimeout(() => emitDemoState(routerState), 350)
    return () => window.clearTimeout(timer)
  }, [expectedPrediction.label, expectedPrediction.response, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <section className="predictionPanel" aria-live="polite">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which tokenizer boundary should matter most?</strong>
          <p>
            Tokenization is not just splitting text. Predict the boundary the microscope should expose before
            seeing token counts, byte behavior, and context cost.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Tokenization mechanism prediction">
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
        <button
          type="button"
          className="reveal"
          disabled={prediction === null}
          onClick={() => setRevealed(true)}
        >
          Reveal tokenizer boundary
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${expectedPrediction.label} is the boundary this route emphasizes.`}</h4>
            <p>{expectedPrediction.response} Use the live microscope below to see how text becomes model context.</p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a tokenizer boundary to unlock the live microscope.' : 'Reveal the boundary to enter the tokenizer microscope.'}</p>
        )}
      </section>

      <div className="demoPanel">
        {revealed ? <TokenizationViz conceptId="tokenization-vocabulary" /> : (
          <div className="panelGate">
            <span>Tokenizer microscope</span>
            <strong>Hidden until prediction reveal</strong>
            <p>Commit to the boundary first, then inspect the token stream, byte stream, and context-cost readout.</p>
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

        @media (max-width: 720px) {
          .choiceRow {
            grid-template-columns: repeat(2, minmax(0, 1fr));
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
