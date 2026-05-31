import { useEffect, useMemo, useState } from 'react'

import type { ResolvedWitnessTriad, WitnessTriadObservation } from '@/lib/conceptWitnessTriads'

type PredictionChoice = {
  id: string
  label: string
  explanation: string
}

export type WitnessTriadProps = {
  triads: ResolvedWitnessTriad[]
  selectedObjectAnchorId?: string
  onSelectObject?: (anchorId: string) => void
  onSaveObservation?: (observation: WitnessTriadObservation) => void
}

const predictionChoices: PredictionChoice[] = [
  {
    id: 'double',
    label: 'Doubles',
    explanation: 'Correct: T appears once as a multiplicative factor, so holding the other terms fixed makes memory linear in T.',
  },
  {
    id: 'same',
    label: 'Same',
    explanation: 'Not for an ordinary KV cache: every new token contributes another key and value per layer/head.',
  },
  {
    id: 'quadratic',
    label: 'T^2 growth',
    explanation: 'That is the full-attention compute danger; KV cache storage grows linearly in context length.',
  },
]

function selectedChoiceLabel(choiceId: string | null) {
  return predictionChoices.find((choice) => choice.id === choiceId)?.label ?? 'No prediction'
}

export default function WitnessTriad({
  triads,
  selectedObjectAnchorId,
  onSelectObject,
  onSaveObservation,
}: WitnessTriadProps) {
  const preferredTriad = useMemo(
    () => triads.find((triad) => triad.objectAnchorId && triad.objectAnchorId === selectedObjectAnchorId) ?? triads[0],
    [selectedObjectAnchorId, triads]
  )
  const [activeTriadId, setActiveTriadId] = useState(preferredTriad?.id ?? '')
  const [prediction, setPrediction] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [savedObservationId, setSavedObservationId] = useState<string | null>(null)
  const activeTriad = triads.find((triad) => triad.id === activeTriadId) ?? preferredTriad
  const selectedPrediction = predictionChoices.find((choice) => choice.id === prediction)
  const predictionCorrect = prediction === 'double'

  useEffect(() => {
    if (preferredTriad?.id && preferredTriad.id !== activeTriadId) {
      setActiveTriadId(preferredTriad.id)
      setPrediction(null)
      setRevealed(false)
      setSavedObservationId(null)
    }
  }, [activeTriadId, preferredTriad?.id])

  if (!activeTriad) return null

  const saveObservation = () => {
    const observation: WitnessTriadObservation = {
      triadId: activeTriad.id,
      conceptId: activeTriad.conceptId,
      objectAnchorId: activeTriad.objectAnchorId,
      objectKey: activeTriad.objectKey,
      prediction: selectedChoiceLabel(prediction),
      changedVariable: activeTriad.observationCopy.changedVariable,
      heldFixed: activeTriad.observationCopy.heldFixed,
      observed: activeTriad.observationCopy.observed,
      invariant: activeTriad.invariant,
      nextRepair: activeTriad.observationCopy.nextRepair,
    }

    onSaveObservation?.(observation)
    setSavedObservationId(activeTriad.id)
  }

  return (
    <section
      className={`witness-triad-panel ${revealed ? 'revealed' : ''}`}
      data-witness-triad={activeTriad.id}
      aria-labelledby="witness-triad-heading"
    >
      <div className="triad-heading">
        <div>
          <p>Witness triad</p>
          <h2 id="witness-triad-heading">{activeTriad.title}</h2>
        </div>
        {activeTriad.objectAnchorId ? (
          <button type="button" onClick={() => onSelectObject?.(activeTriad.objectAnchorId as string)}>
            Use equation object
          </button>
        ) : null}
      </div>

      <p className="triad-invariant">{activeTriad.invariant}</p>

      <div className="surface-links" aria-label="Witness surfaces">
        <a href={activeTriad.math.href}>
          <span>Math</span>
          <strong>{activeTriad.math.label}</strong>
          <code>{activeTriad.math.latex}</code>
        </a>
        <a href={activeTriad.code.href}>
          <span>Code</span>
          <strong>{activeTriad.code.label}</strong>
          <code>{activeTriad.code.line}</code>
        </a>
        <a href={activeTriad.demo.href}>
          <span>Demo</span>
          <strong>{activeTriad.demo.label}</strong>
          <em>{activeTriad.demo.output}</em>
        </a>
      </div>

      <div className="symbol-map" aria-label="Symbol map">
        {activeTriad.symbols.map((symbol) => (
          <div key={symbol.symbol} className={symbol.symbol === activeTriad.defaultChangedSymbol ? 'changed' : ''}>
            <span>{symbol.symbol}</span>
            <strong>{symbol.meaning}</strong>
            <em>{symbol.codeName}</em>
          </div>
        ))}
      </div>

      <div className="prediction-box">
        <div>
          <span>Predict before reveal</span>
          <strong>{activeTriad.predictionPrompt}</strong>
        </div>
        <div className="choice-row" role="group" aria-label={activeTriad.predictionPrompt}>
          {predictionChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={prediction === choice.id ? 'selected' : ''}
              aria-pressed={prediction === choice.id}
              onClick={() => {
                setPrediction(choice.id)
                setRevealed(false)
                setSavedObservationId(null)
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={!prediction} onClick={() => setRevealed(true)}>
          Reveal invariant
        </button>
      </div>

      {revealed ? (
        <div className={`observation-receipt ${predictionCorrect ? 'correct' : ''}`} aria-live="polite">
          <span>{predictionCorrect ? 'Prediction matches' : 'Repair the prediction'}</span>
          <strong>{selectedPrediction?.explanation}</strong>
          <p>
            Changed {activeTriad.observationCopy.changedVariable}. Held{' '}
            {activeTriad.observationCopy.heldFixed.join(', ')} fixed. {activeTriad.observationCopy.observed}
          </p>
          <em>{activeTriad.observationCopy.nextRepair}</em>
          <button type="button" onClick={saveObservation}>
            {savedObservationId === activeTriad.id ? 'Observation saved' : 'Save observation'}
          </button>
        </div>
      ) : null}

      <style jsx>{`
        .witness-triad-panel {
          display: grid;
          gap: 0.75rem;
          min-width: 0;
          padding: 1rem;
          border-radius: 18px;
          border: 1px solid rgba(31, 75, 153, 0.12);
          background:
            radial-gradient(circle at top left, rgba(31, 111, 120, 0.1), transparent 34%),
            linear-gradient(135deg, rgba(255, 251, 245, 0.94), rgba(239, 247, 245, 0.9));
          box-shadow: 0 14px 30px rgba(8, 16, 26, 0.07);
        }

        .triad-heading {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.7rem;
          align-items: start;
          min-width: 0;
        }

        .triad-heading div,
        .prediction-box,
        .observation-receipt {
          display: grid;
          gap: 0.34rem;
          min-width: 0;
        }

        .triad-heading p,
        .surface-links span,
        .prediction-box span,
        .observation-receipt span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          letter-spacing: 0.11em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .triad-heading h2 {
          margin: 0;
          color: #17202a;
          font-family: var(--font-display);
          font-size: clamp(1.18rem, 2vw, 1.55rem);
          line-height: 1.08;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .triad-heading h2::before {
          content: none;
          display: none;
        }

        .triad-invariant,
        .observation-receipt p,
        .observation-receipt em {
          margin: 0;
          color: #52606b;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .surface-links {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.48rem;
          min-width: 0;
        }

        .surface-links a,
        .symbol-map div {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.62rem;
          border-radius: 10px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
          color: inherit;
          text-decoration: none;
        }

        .surface-links a:hover {
          border-color: rgba(31, 75, 153, 0.26);
          transform: translateY(-1px);
        }

        .surface-links strong,
        .symbol-map strong,
        .prediction-box strong,
        .observation-receipt strong {
          color: #17202a;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        .surface-links code {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #394653;
          font-size: 0.68rem;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }

        .surface-links em,
        .symbol-map em,
        .observation-receipt em {
          color: #52606b;
          font-size: 0.76rem;
          font-style: normal;
          line-height: 1.34;
          overflow-wrap: anywhere;
        }

        .symbol-map {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.36rem;
          min-width: 0;
        }

        .symbol-map div {
          padding: 0.5rem;
        }

        .symbol-map div.changed {
          border-color: rgba(194, 74, 45, 0.24);
          background: rgba(255, 244, 238, 0.9);
        }

        .symbol-map span {
          font-family: var(--font-mono);
          color: #c24a2d;
          font-weight: 800;
        }

        .prediction-box {
          grid-template-columns: minmax(0, 1fr) auto auto;
          align-items: center;
          padding: 0.68rem;
          border-radius: 12px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(247, 252, 250, 0.82);
        }

        .choice-row {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.34rem;
        }

        button {
          appearance: none;
          min-height: 2rem;
          border: 1px solid rgba(31, 75, 153, 0.14);
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.84);
          color: #1f4b99;
          font-weight: 760;
          cursor: pointer;
        }

        button:hover:not(:disabled),
        button.selected,
        button.reveal {
          border-color: rgba(244, 192, 111, 0.48);
          background: #f4c06f;
          color: #17202a;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.56;
        }

        .triad-heading button,
        .choice-row button,
        .reveal,
        .observation-receipt button {
          padding: 0.34rem 0.62rem;
          font-size: 0.74rem;
        }

        .observation-receipt {
          padding: 0.72rem;
          border-radius: 12px;
          border: 1px solid rgba(194, 74, 45, 0.18);
          background:
            linear-gradient(90deg, rgba(194, 74, 45, 0.1), rgba(31, 111, 120, 0.08)),
            rgba(255, 251, 245, 0.88);
        }

        .observation-receipt.correct {
          border-color: rgba(31, 111, 120, 0.18);
        }

        .observation-receipt button {
          justify-self: start;
        }

        @media (max-width: 960px) {
          .surface-links,
          .prediction-box {
            grid-template-columns: 1fr;
          }

          .choice-row {
            justify-content: flex-start;
          }

          .symbol-map {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .witness-triad-panel {
            gap: 0.54rem;
            padding: 0.72rem;
            border-radius: 14px;
          }

          .witness-triad-panel:not(.revealed) {
            max-height: 320px;
            overflow-y: auto;
            overscroll-behavior: contain;
          }

          .triad-heading {
            grid-template-columns: 1fr;
            gap: 0.4rem;
          }

          .triad-heading h2 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 1.02rem;
          }

          .triad-invariant {
            display: none;
          }

          .surface-links {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.28rem;
          }

          .surface-links a {
            align-content: start;
            min-height: 2.85rem;
            padding: 0.36rem;
          }

          .surface-links span {
            font-size: 0.5rem;
          }

          .surface-links strong {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.62rem;
            line-height: 1.12;
          }

          .surface-links code,
          .surface-links em {
            display: none;
          }

          .symbol-map {
            display: none;
          }

          .prediction-box {
            padding: 0.48rem;
          }

          .prediction-box strong {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
            overflow: hidden;
            font-size: 0.74rem;
          }

          .choice-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .choice-row button,
          .reveal,
          .triad-heading button,
          .observation-receipt button {
            min-height: 1.75rem;
            padding: 0.24rem 0.46rem;
            font-size: 0.68rem;
          }
        }
      `}</style>
    </section>
  )
}
