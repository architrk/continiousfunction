import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

const OUTCOMES = ['HH', 'HT', 'TH', 'TT'] as const
const X_VALUES = [0, 1, 2] as const
const OBSERVED = [2, 1, 1, 0, 2]

type XValue = (typeof X_VALUES)[number]

function fmt(n: number) {
  if (!Number.isFinite(n)) return n < 0 ? '-inf' : 'inf'
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function heads(outcome: string) {
  return outcome.split('').filter((c) => c === 'H').length
}

function outcomeProb(outcome: string, pHead: number) {
  return outcome.split('').reduce((prob, c) => prob * (c === 'H' ? pHead : 1 - pHead), 1)
}

export default function DistributionsViz() {
  const [pHead, setPHead] = useState(0.65)
  const [prediction, setPrediction] = useState<XValue | null>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const outcomeRows = OUTCOMES.map((outcome) => ({
      outcome,
      x: heads(outcome),
      prob: outcomeProb(outcome, pHead),
    }))

    const pmf = X_VALUES.map((x) => ({
      x,
      prob: outcomeRows.filter((row) => row.x === x).reduce((acc, row) => acc + row.prob, 0),
    }))

    const mean = pmf.reduce((acc, row) => acc + row.x * row.prob, 0)
    const variance = pmf.reduce((acc, row) => acc + (row.x - mean) ** 2 * row.prob, 0)
    const observedMasses = OBSERVED.map((x) => pmf.find((row) => row.x === x)?.prob ?? 0)
    const logLikelihood = observedMasses.some((prob) => prob === 0)
      ? Number.NEGATIVE_INFINITY
      : observedMasses.reduce((acc, prob) => acc + Math.log(prob), 0)
    const maxMass = Math.max(...pmf.map((row) => row.prob))
    const topValues = pmf.filter((row) => Math.abs(row.prob - maxMass) < 1e-9).map((row) => row.x)
    const dominantValue = topValues[0] ?? pmf[0].x

    return { outcomeRows, pmf, mean, variance, logLikelihood, observedMasses, topValues, dominantValue, maxMass }
  }, [pHead])

  const updatePHead = (value: number) => {
    setPHead(value)
    setPrediction(null)
    setRevealed(false)
  }

  const predictionCorrect = prediction !== null && data.topValues.includes(prediction)
  const topValueText = data.topValues.map((x) => `X=${x}`).join(' or ')

  useEffect(() => {
    emitDemoState({
      conceptId: 'distributions',
      label: 'Prediction-first distribution pushforward',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : `X=${prediction}`}; after grouping raw outcomes by X, the largest PMF mass is ${topValueText} with probability ${fmt(data.maxMass)}. E[X]=${fmt(data.mean)}, Var(X)=${fmt(data.variance)}, observed log likelihood=${fmt(data.logLikelihood)}.`
        : `Learner is predicting which X value gets the most probability mass after raw coin-flip outcomes are pushed through the random variable X.`,
      values: [
        `prediction: ${prediction === null ? 'none' : `X=${prediction}`}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `head probability p: ${fmt(pHead)}`,
        `raw outcome probabilities: ${data.outcomeRows.map((row) => `${row.outcome}=${fmt(row.prob)}`).join(', ')}`,
        `PMF of X: ${revealed ? data.pmf.map((row) => `P(X=${row.x})=${fmt(row.prob)}`).join(', ') : 'hidden until reveal'}`,
        `largest PMF mass: ${revealed ? `${topValueText}=${fmt(data.maxMass)}` : 'hidden until reveal'}`,
        `E[X]: ${revealed ? fmt(data.mean) : 'hidden until reveal'}`,
        `Var(X): ${revealed ? fmt(data.variance) : 'hidden until reveal'}`,
        `observed values: [${OBSERVED.join(', ')}]`,
        `observed masses: ${revealed ? `[${data.observedMasses.map(fmt).join(', ')}]` : 'hidden until reveal'}`,
        `i.i.d. log likelihood: ${revealed ? fmt(data.logLikelihood) : 'hidden until reveal'}`,
      ],
    })
  }, [
    data.logLikelihood,
    data.maxMass,
    data.mean,
    data.observedMasses,
    data.outcomeRows,
    data.pmf,
    data.topValues,
    data.variance,
    pHead,
    prediction,
    predictionCorrect,
    revealed,
    topValueText,
  ])

  return (
    <div className="wrap">
      <div className="control">
        <label>
          <span>head probability p</span>
          <input type="range" min="0" max="1" step="0.01" value={pHead} onChange={(event) => updatePHead(Number(event.target.value))} />
          <strong>{fmt(pHead)}</strong>
        </label>
      </div>

      <div className="metrics">
        <div>
          <span>E[X]</span>
          <strong>{revealed ? fmt(data.mean) : 'hidden'}</strong>
        </div>
        <div>
          <span>Var(X)</span>
          <strong>{revealed ? fmt(data.variance) : 'hidden'}</strong>
        </div>
        <div>
          <span>observed values</span>
          <strong>[{OBSERVED.join(', ')}]</strong>
        </div>
        <div>
          <span>i.i.d. log likelihood</span>
          <strong>{revealed ? fmt(data.logLikelihood) : 'hidden'}</strong>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>After grouping outcomes, where does the most mass land?</strong>
          <p>
            The raw outcomes keep their own probabilities. The distribution of X is what remains
            after outcomes with the same number of heads are pooled together.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Most likely X value prediction">
          {X_VALUES.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={prediction === x}
              className={prediction === x ? 'selected' : ''}
              onClick={() => {
                setPrediction(x)
                setRevealed(false)
              }}
            >
              X={x}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="reveal"
          disabled={prediction === null}
          onClick={() => setRevealed(true)}
        >
          Reveal PMF
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : 'The pushforward mass is visible.'}</h4>
            <p>
              {topValueText} has the largest mass, {fmt(data.maxMass)}. It is not a raw outcome;
              it is the pooled probability of all outcomes that map to that value.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose X=0, X=1, or X=2 to unlock the PMF.' : 'Reveal the grouped distribution to test your prediction.'}</p>
        )}
      </section>

      <div className="stage">
        <div className="panel">
          <h3>raw outcomes</h3>
          <div className="outcomes">
            {data.outcomeRows.map((row) => (
              <div className="outcome" key={row.outcome}>
                <div>
                  <strong>{row.outcome}</strong>
                  <span>X={row.x}</span>
                </div>
                <div className="barTrack" aria-label={`${row.outcome} probability ${fmt(row.prob)}`}>
                  <div className="bar outcomeBar" style={{ width: `${row.prob * 100}%` }} />
                </div>
                <code>{fmt(row.prob)}</code>
              </div>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 640 330" role="img" aria-label="Probability mass from raw outcomes is grouped into the distribution of X, the number of heads.">
          <defs>
            <marker id="dist-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" />
            </marker>
          </defs>
          <rect x="24" y="24" width="592" height="282" rx="8" className="plotBg" />
          <text x="48" y="58" className="title">push probability through X</text>
          <text x="408" y="58" className="title">PMF of X</text>

          {data.outcomeRows.map((row, index) => {
            const y = 92 + index * 48
            const targetY = 100 + row.x * 64
            return (
              <g key={row.outcome}>
                <rect x="48" y={y - 22} width="96" height="32" rx="7" className="outcomeNode" />
                <text x="70" y={y - 2} className="nodeText">{row.outcome}</text>
                <text x="114" y={y - 2} className="nodeProb">{fmtPct(row.prob)}</text>
                <path
                  d={`M 150 ${y - 6} C 238 ${y - 6}, 282 ${targetY}, 376 ${targetY}`}
                  className="flow"
                  style={{ strokeWidth: 1 + row.prob * 8, opacity: 0.25 + row.prob * 0.65 }}
                />
              </g>
            )
          })}

          {data.pmf.map((row) => {
            const y = 100 + row.x * 64
            const barWidth = revealed ? row.prob * 150 : 12
            return (
              <g key={row.x}>
                <text x="408" y={y + 5} className="xLabel">X={row.x}</text>
                <rect x="452" y={y - 14} width="150" height="28" rx="6" className="pmfTrack" />
                <rect x="452" y={y - 14} width={barWidth} height="28" rx="6" className={revealed && data.topValues.includes(row.x) ? 'pmfBar dominant' : 'pmfBar'} />
                <text x="462" y={y + 5} className="pmfValue">{revealed ? fmt(row.prob) : 'hidden'}</text>
              </g>
            )
          })}
        </svg>
      </div>

      <p className="claim">
        The random variable is the map from outcomes to values. The distribution is the probability mass after outcomes with the same value have been grouped together. At p=0 or p=1, some observed values are impossible, so their log likelihood is negative infinity.
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .control {
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.78);
        }

        label {
          display: grid;
          grid-template-columns: 8.6rem minmax(0, 1fr) 4.5rem;
          gap: 0.6rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.82rem;
        }

        input {
          width: 100%;
        }

        label strong {
          color: #1b2430;
          font-family: var(--font-mono);
          text-align: right;
        }

        button {
          min-height: 36px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #fffaf0;
          color: #1b2430;
          padding: 0 0.78rem;
          font-size: 0.84rem;
          cursor: pointer;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .metrics div,
        .panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div {
          padding: 0.7rem;
        }

        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(230px, 0.85fr) minmax(220px, 0.7fr) auto;
          gap: 0.75rem;
          align-items: stretch;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(238, 248, 245, 0.72));
        }

        .predictionCopy {
          min-width: 0;
        }

        .predictionCopy span,
        .result h4 {
          color: #1f6f78;
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          display: block;
          margin-top: 0.22rem;
          color: #1b2430;
          font-size: 0.94rem;
          line-height: 1.3;
        }

        .predictionCopy p,
        .result p {
          margin: 0.38rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          align-items: stretch;
        }

        .choiceRow button {
          font-family: var(--font-mono);
        }

        .choiceRow button.selected,
        button[aria-pressed='true'] {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.9);
          box-shadow: 0 0 0 2px rgba(31, 111, 120, 0.1);
        }

        .reveal {
          align-self: center;
          min-height: 46px;
          background: #1b2430;
          color: white;
        }

        .result {
          min-height: 56px;
          padding: 0.75rem 0.85rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.64);
        }

        .result.shown {
          border-color: rgba(31, 111, 120, 0.25);
          background: rgba(238, 248, 245, 0.74);
        }

        .result h4 {
          margin: 0;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(220px, 0.33fr) minmax(0, 1fr);
          gap: 0.75rem;
        }

        .panel {
          padding: 0.8rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .outcomes {
          display: grid;
          gap: 0.6rem;
        }

        .outcome {
          display: grid;
          grid-template-columns: minmax(4.4rem, 0.5fr) minmax(0, 1fr) 3.5rem;
          gap: 0.55rem;
          align-items: center;
        }

        .outcome div:first-child {
          display: grid;
          gap: 0.1rem;
        }

        .outcome strong,
        code {
          color: #1b2430;
          font-family: var(--font-mono);
        }

        .outcome span {
          color: #65717d;
          font-size: 0.74rem;
        }

        .barTrack {
          height: 10px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
          overflow: hidden;
        }

        .bar {
          height: 100%;
          border-radius: inherit;
        }

        .outcomeBar {
          background: #1f6f78;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(247, 250, 246, 0.94), rgba(245, 249, 255, 0.82));
        }

        .plotBg {
          fill: rgba(255, 255, 255, 0.62);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .title,
        .nodeText,
        .nodeProb,
        .xLabel,
        .pmfValue {
          font-family: var(--font-mono);
        }

        .title {
          fill: #334150;
          font-size: 13px;
          font-weight: 700;
        }

        .outcomeNode {
          fill: rgba(226, 242, 239, 0.9);
          stroke: rgba(31, 111, 120, 0.24);
        }

        .nodeText {
          fill: #1b2430;
          font-size: 12px;
          font-weight: 700;
        }

        .nodeProb {
          fill: #4a5865;
          font-size: 11px;
        }

        .flow {
          fill: none;
          stroke: rgba(139, 94, 52, 0.38);
          stroke-width: 2;
          marker-end: url(#dist-arrow);
        }

        :global(#dist-arrow path) {
          fill: rgba(139, 94, 52, 0.62);
        }

        .xLabel {
          fill: #334150;
          font-size: 12px;
        }

        .pmfTrack {
          fill: rgba(27, 36, 48, 0.08);
        }

        .pmfBar {
          fill: #1f4b99;
          opacity: 0.45;
        }

        .pmfBar.dominant {
          fill: #1f6f78;
          opacity: 1;
        }

        .pmfValue {
          fill: #1b2430;
          font-size: 12px;
          paint-order: stroke;
          stroke: rgba(255, 255, 255, 0.82);
          stroke-width: 4px;
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .predictionPanel,
          .stage {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          label,
          .choiceRow,
          .outcome {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }

          .metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
