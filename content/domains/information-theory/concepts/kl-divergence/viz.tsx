import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type Preset = {
  label: string
  weights: number[]
}

type Prediction = 'forward' | 'reverse' | 'balanced' | null

const CATEGORIES = ['true', 'paraphrase', 'distractor', 'off-topic']
const P = [0.55, 0.25, 0.15, 0.05]
const DISPLAY_EPS = 0.0005
const DOMINANCE_EPS = 0.015
const PRESETS: Preset[] = [
  { label: 'case A', weights: [96, 2, 1, 1] },
  { label: 'case B', weights: [24, 16, 15, 45] },
  { label: 'case C', weights: [90, 5, 3, 2] },
  { label: 'case D', weights: [25, 25, 25, 25] },
  { label: 'case E', weights: [55, 25, 15, 5] },
]

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function normalize(weights: number[]) {
  const total = weights.reduce((acc, value) => acc + value, 0)
  return weights.map((value) => value / total)
}

function entropy(p: number[]) {
  return p.reduce((acc, value) => (value > 0 ? acc - value * Math.log(value) : acc), 0)
}

function klTerms(p: number[], q: number[]) {
  return p.map((px, index) => (px > 0 ? px * (Math.log(px) - Math.log(q[index])) : 0))
}

function predictionLabel(prediction: Exclude<Prediction, null>) {
  if (prediction === 'forward') return 'KL(p || q) dominates'
  if (prediction === 'reverse') return 'KL(q || p) dominates'
  return 'neither direction dominates'
}

export default function KLDivergenceViz() {
  const [weights, setWeights] = useState(PRESETS[0].weights)
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].label)
  const [prediction, setPrediction] = useState<Prediction>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const q = normalize(weights)
    const forwardTerms = klTerms(P, q)
    const reverseTerms = klTerms(q, P)
    const klPQ = forwardTerms.reduce((acc, value) => acc + value, 0)
    const klQP = reverseTerms.reduce((acc, value) => acc + value, 0)
    const hP = entropy(P)
    const crossEntropy = hP + klPQ
    const matched = Math.max(klPQ, klQP) < DISPLAY_EPS
    const maxAbsTerm = Math.max(0.05, ...forwardTerms.map(Math.abs), ...reverseTerms.map(Math.abs))
    const missingMode = P.some((px, index) => px > 0.08 && q[index] / px < 0.2)
    const extraMass = q.some((qx, index) => qx > 0.2 && P[index] < 0.08)

    return { q, forwardTerms, reverseTerms, klPQ, klQP, hP, crossEntropy, maxAbsTerm, matched, missingMode, extraMass }
  }, [weights])

  const applyPreset = (preset: Preset) => {
    setWeights(preset.weights)
    setActivePreset(preset.label)
    setPrediction(null)
    setRevealed(false)
  }

  const updateWeight = (index: number, value: number) => {
    setWeights((prev) => prev.map((old, i) => (i === index ? value : old)))
    setActivePreset(null)
    setPrediction(null)
    setRevealed(false)
  }

  const correctPrediction: Exclude<Prediction, null> =
    Math.abs(data.klPQ - data.klQP) < DOMINANCE_EPS ? 'balanced' : data.klPQ > data.klQP ? 'forward' : 'reverse'
  const predictionCorrect = prediction === correctPrediction
  const diagnosis = data.missingMode ? 'missing p-heavy mode' : data.extraMass ? 'extra q mass on p-small outcome' : data.matched ? 'matched distributions' : 'directional mismatch'

  const claim = data.matched
    ? 'The distributions match, so both KL directions are zero up to rounding.'
    : data.missingMode
    ? 'Forward KL is large because q nearly misses an outcome that p samples.'
    : data.extraMass
      ? 'Reverse KL is large because q puts substantial mass where p is small.'
      : data.klPQ > data.klQP
        ? 'Forward KL dominates: the model is worse on outcomes that data visits often.'
        : 'Reverse KL dominates: the model spends mass in places the reference does not.'

  useEffect(() => {
    emitDemoState({
      conceptId: 'kl-divergence',
      label: 'Prediction-first KL direction explorer',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : predictionLabel(prediction)}; KL(p||q) is ${fmt(data.klPQ)}, KL(q||p) is ${fmt(data.klQP)}, and ${predictionLabel(correctPrediction)}.`
        : prediction === null
          ? 'Learner has not chosen a KL direction yet; KL totals, cross-entropy, entropy, and signed contribution rows are hidden.'
          : `Learner predicted ${predictionLabel(prediction)}; KL totals, cross-entropy, entropy, and signed contribution rows are still hidden until reveal.`,
      values: [
        `prediction: ${prediction === null ? 'none' : predictionLabel(prediction)}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `KL(p||q)=${revealed ? fmt(data.klPQ) : 'hidden until reveal'}`,
        `KL(q||p)=${revealed ? fmt(data.klQP) : 'hidden until reveal'}`,
        `H(p,q)=${revealed ? fmt(data.crossEntropy) : 'hidden until reveal'}`,
        `H(p)=${revealed ? fmt(data.hP) : 'hidden until reveal'}`,
        `dominance=${revealed ? predictionLabel(correctPrediction) : 'hidden until reveal'}`,
        `diagnosis=${revealed ? diagnosis : 'hidden until reveal'}`,
        activePreset ? `preset=${activePreset}` : 'custom slider state',
      ],
    })
  }, [activePreset, correctPrediction, data.crossEntropy, data.extraMass, data.hP, data.klPQ, data.klQP, data.matched, data.missingMode, prediction, predictionCorrect, revealed])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" role="group" aria-label="KL divergence presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" aria-pressed={activePreset === preset.label} onClick={() => applyPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>

        <div className="sliders">
          {CATEGORIES.map((label, index) => (
            <label key={label}>
              <span>raw q weight: {label}</span>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={weights[index]}
                aria-valuetext={`raw q weight for ${label} ${weights[index]}, normalized q probability ${fmtPct(data.q[index])}`}
                onChange={(event) => updateWeight(index, Number(event.target.value))}
              />
              <strong>{fmtPct(data.q[index])}</strong>
            </label>
          ))}
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>KL(p || q)</span>
          <strong>{revealed ? fmt(data.klPQ) : 'hidden'}</strong>
        </div>
        <div>
          <span>KL(q || p)</span>
          <strong>{revealed ? fmt(data.klQP) : 'hidden'}</strong>
        </div>
        <div>
          <span>H(p,q)</span>
          <strong>{revealed ? fmt(data.crossEntropy) : 'hidden'}</strong>
        </div>
        <div>
          <span>H(p)</span>
          <strong>{revealed ? fmt(data.hP) : 'hidden'}</strong>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which KL direction should become larger?</strong>
          <p>
            Inspect which distribution does the averaging. The KL totals,
            entropy identity, and signed outcome terms stay hidden until you commit.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="KL direction prediction">
          {(['forward', 'reverse', 'balanced'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              aria-pressed={prediction === choice}
              className={prediction === choice ? 'selected' : ''}
              onClick={() => {
                setPrediction(choice)
                setRevealed(false)
              }}
            >
              {predictionLabel(choice)}
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal KL terms
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `Not quite: ${predictionLabel(correctPrediction)}.`}</h4>
            <p>
              You predicted {prediction === null ? 'nothing' : predictionLabel(prediction)}. KL(p||q) averages log-ratio regret under p, while KL(q||p) averages under q.
              Here KL(p||q)={fmt(data.klPQ)} and KL(q||p)={fmt(data.klQP)}{correctPrediction === 'balanced' ? `, within the ${fmt(DOMINANCE_EPS)}-nat close band.` : '.'}
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a direction to unlock the KL totals.' : 'Reveal the signed terms to test your prediction.'}</p>
        )}
      </section>

      <div className="stage">
        <div className="panel">
          <h3>distributions</h3>
          <div className="distHeader" aria-hidden="true">
            <span>outcome</span>
            <span>p</span>
            <span>q</span>
            <span>values</span>
          </div>
          <div className="distRows">
            {CATEGORIES.map((label, index) => (
              <div className="distRow" key={label}>
                <span>{label}</span>
                <Bar value={P[index]} color="#1f6f78" label={`p ${label}`} />
                <Bar value={data.q[index]} color="#c26f34" label={`q ${label}`} />
                <code>{fmt(P[index])} / {fmt(data.q[index])}</code>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h3>directional terms</h3>
          {revealed ? (
            <>
              <div className="termRows">
                {CATEGORIES.map((label, index) => (
                  <div className="termRow" key={label}>
                    <span>{label}</span>
                    <SignedBar value={data.forwardTerms[index]} maxAbs={data.maxAbsTerm} label="p||q" />
                    <SignedBar value={data.reverseTerms[index]} maxAbs={data.maxAbsTerm} label="q||p" />
                  </div>
                ))}
              </div>
              <div className="legend">
                <span>top row: p log(p/q)</span>
                <span>bottom row: q log(q/p)</span>
              </div>
            </>
          ) : (
            <div className="hiddenTerms">
              <strong>terms hidden until prediction</strong>
              <p>The bars will show which outcomes are sampled by p versus q, and why one direction can punish a different mistake.</p>
            </div>
          )}
        </div>
      </div>

      <p className="claim">
        {revealed
          ? `${claim} Individual terms can be negative; the summed KL is the nonnegative divergence.`
          : 'KL is directional because the first distribution chooses which outcomes are averaged. Decide which sampler will visit the expensive mistakes before seeing the totals.'}
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls {
          display: grid;
          grid-template-columns: minmax(170px, 0.28fr) minmax(0, 1fr);
          gap: 0.75rem;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.78);
        }

        .presetGroup,
        .sliders,
        .distRows,
        .termRows {
          display: grid;
          gap: 0.45rem;
        }

        button {
          min-height: 34px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #fffaf0;
          color: #1b2430;
          padding: 0 0.68rem;
          font-size: 0.82rem;
          cursor: pointer;
          text-align: left;
        }

        button[aria-pressed='true'] {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.9);
        }

        label {
          display: grid;
          grid-template-columns: 9rem minmax(0, 1fr) 4rem;
          gap: 0.55rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.78rem;
        }

        input {
          width: 100%;
        }

        label strong {
          color: #1b2430;
          font-family: var(--font-mono);
          text-align: right;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(8.4rem, 1fr));
          gap: 0.6rem;
        }

        .metrics div,
        .panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div,
        .panel {
          padding: 0.7rem;
        }

        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong,
        code {
          color: #1b2430;
          font-family: var(--font-mono);
        }

        .predictionPanel,
        .result,
        .hiddenTerms {
          display: grid;
          gap: 0.7rem;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(247, 250, 246, 0.78);
        }

        .predictionPanel {
          grid-template-columns: minmax(0, 1.05fr) minmax(260px, 1fr) auto;
          align-items: center;
        }

        .predictionCopy {
          display: grid;
          gap: 0.25rem;
        }

        .predictionCopy span {
          color: #65717d;
          font-size: 0.74rem;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .predictionCopy strong,
        .result h4,
        .hiddenTerms strong {
          margin: 0;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .predictionCopy p,
        .result p,
        .hiddenTerms p {
          margin: 0;
          color: #4a5865;
          font-size: 0.83rem;
          line-height: 1.45;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .choiceRow button,
        .reveal {
          min-height: 38px;
          text-align: center;
        }

        .choiceRow .selected {
          border-color: rgba(31, 111, 120, 0.68);
          background: rgba(226, 242, 239, 0.96);
        }

        .reveal {
          border-color: rgba(31, 111, 120, 0.45);
          background: #1f6f78;
          color: #fffaf0;
          font-weight: 700;
        }

        .reveal:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .result {
          background: rgba(255, 251, 245, 0.78);
        }

        .result.shown {
          border-color: rgba(31, 111, 120, 0.24);
          background: rgba(226, 242, 239, 0.82);
        }

        .hiddenTerms {
          min-height: 10rem;
          place-content: center;
          text-align: center;
          background: rgba(255, 251, 245, 0.72);
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
          gap: 0.75rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .distRow {
          display: grid;
          grid-template-columns: 5.8rem minmax(0, 1fr) minmax(0, 1fr) 5.8rem;
          gap: 0.5rem;
          align-items: center;
        }

        .distHeader {
          display: grid;
          grid-template-columns: 5.8rem minmax(0, 1fr) minmax(0, 1fr) 5.8rem;
          gap: 0.5rem;
          margin-bottom: 0.35rem;
          color: #65717d;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
        }

        .distRow span,
        .termRow span {
          color: #4a5865;
          font-size: 0.76rem;
        }

        .termRow {
          display: grid;
          grid-template-columns: 5.8rem minmax(0, 1fr);
          gap: 0.35rem 0.5rem;
          align-items: center;
        }

        .termRow > span {
          grid-row: span 2;
        }

        .legend {
          display: flex;
          justify-content: space-between;
          gap: 0.75rem;
          margin-top: 0.65rem;
          color: #65717d;
          font-size: 0.74rem;
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 820px) {
          .controls,
          .stage,
          .predictionPanel {
            grid-template-columns: 1fr;
          }

          .presetGroup {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          label,
          .distHeader,
          .distRow,
          .termRow {
            grid-template-columns: 1fr;
          }

          .distHeader {
            display: none;
          }

          .termRow > span {
            grid-row: auto;
          }

          label strong {
            text-align: left;
          }

          .legend {
            flex-direction: column;
          }

          .choiceRow {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function Bar({ value, color, label }: { value: number; color: string; label: string }) {
  return (
    <div
      className="track"
      role="meter"
      aria-label={`${label} ${fmt(value)}`}
      aria-valuemin={0}
      aria-valuemax={1}
      aria-valuenow={value}
    >
      <div className="fill" style={{ width: `${value * 100}%`, background: color }} />
      <style jsx>{`
        .track {
          height: 11px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
        }

        .fill {
          height: 100%;
          border-radius: inherit;
        }
      `}</style>
    </div>
  )
}

function SignedBar({ value, maxAbs, label }: { value: number; maxAbs: number; label: string }) {
  const isZero = Math.abs(value) < DISPLAY_EPS
  const magnitude = isZero ? 0 : Math.min(50, (Math.abs(value) / maxAbs) * 50)
  const left = value < 0 ? 50 - magnitude : 50
  const width = isZero ? 0 : Math.max(2, magnitude)
  const color = value >= 0 ? '#9a4f2d' : '#1f6f78'

  return (
    <div className="signed" aria-label={`${label} contribution ${fmt(value)}`}>
      <div className="zero" />
      <div className="signedFill" style={{ left: `${left}%`, width: `${width}%`, background: color }} />
      <code>{label}: {fmt(value)}</code>
      <style jsx>{`
        .signed {
          position: relative;
          min-height: 1.7rem;
          border-radius: 7px;
          background: rgba(27, 36, 48, 0.06);
          overflow: hidden;
        }

        .zero {
          position: absolute;
          top: 0;
          bottom: 0;
          left: 50%;
          width: 1px;
          background: rgba(27, 36, 48, 0.24);
        }

        .signedFill {
          position: absolute;
          top: 0;
          bottom: 0;
          opacity: 0.42;
        }

        code {
          position: relative;
          z-index: 1;
          display: block;
          padding: 0.35rem 0.5rem;
          color: #1b2430;
          font-family: var(--font-mono);
          font-size: 0.75rem;
        }
      `}</style>
    </div>
  )
}
