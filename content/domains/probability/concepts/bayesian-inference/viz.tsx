import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type PresetKey = 'balanced' | 'strongPrior' | 'dataWins' | 'noData'
type PredictionKey = 'prior' | 'data' | 'compromise' | 'unchanged'

const PRESETS: Record<PresetKey, { label: string; alpha: number; beta: number; heads: number; tails: number }> = {
  balanced: { label: 'balanced update', alpha: 2, beta: 2, heads: 8, tails: 2 },
  strongPrior: { label: 'strong prior, little data', alpha: 12, beta: 3, heads: 1, tails: 3 },
  dataWins: { label: 'data wins', alpha: 2, beta: 2, heads: 32, tails: 8 },
  noData: { label: 'no data', alpha: 3, beta: 6, heads: 0, tails: 0 },
}

const PREDICTIONS: Record<PredictionKey, { label: string; response: string }> = {
  prior: {
    label: 'Prior still wins',
    response: 'The posterior stays closer to the prior mean because prior pseudo-counts outweigh the data.',
  },
  data: {
    label: 'Data pulls hardest',
    response: 'The posterior moves close to the MLE because observed data outweighs the prior.',
  },
  compromise: {
    label: 'Weighted compromise',
    response: 'The posterior lands between prior mean and MLE because both prior mass and data count matter.',
  },
  unchanged: {
    label: 'No update',
    response: 'With no observations, likelihood adds no preference, so posterior equals prior.',
  },
}

const WIDTH = 680
const HEIGHT = 360
const PLOT = { x: 54, y: 36, w: 570, h: 250 }
const GRID = Array.from({ length: 99 }, (_, i) => 0.01 + i * 0.01)

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function logGamma(z: number): number {
  const coeff = [
    676.5203681218851,
    -1259.1392167224028,
    771.3234287776531,
    -176.6150291621406,
    12.507343278686905,
    -0.13857109526572012,
    9.984369578019572e-6,
    1.5056327351493116e-7,
  ]

  if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - logGamma(1 - z)

  let x = 0.9999999999998099
  const shifted = z - 1
  for (let i = 0; i < coeff.length; i += 1) x += coeff[i] / (shifted + i + 1)
  const t = shifted + coeff.length - 0.5
  return 0.5 * Math.log(2 * Math.PI) + (shifted + 0.5) * Math.log(t) - t + Math.log(x)
}

function logBeta(a: number, b: number) {
  return logGamma(a) + logGamma(b) - logGamma(a + b)
}

function betaPdf(theta: number, alpha: number, beta: number) {
  const logDensity = (alpha - 1) * Math.log(theta) + (beta - 1) * Math.log(1 - theta) - logBeta(alpha, beta)
  return Math.exp(logDensity)
}

function logLikelihood(theta: number, heads: number, tails: number) {
  if (heads + tails === 0) return 0
  return heads * Math.log(theta) + tails * Math.log(1 - theta)
}

function pathFor(values: number[], maxValue: number) {
  return values
    .map((value, index) => {
      const theta = GRID[index]
      const x = PLOT.x + theta * PLOT.w
      const y = PLOT.y + PLOT.h - (value / maxValue) * PLOT.h
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

export default function BayesianInferenceViz() {
  const [alpha, setAlpha] = useState(PRESETS.balanced.alpha)
  const [beta, setBeta] = useState(PRESETS.balanced.beta)
  const [heads, setHeads] = useState(PRESETS.balanced.heads)
  const [tails, setTails] = useState(PRESETS.balanced.tails)
  const [activePreset, setActivePreset] = useState<PresetKey | null>('balanced')
  const [prediction, setPrediction] = useState<PredictionKey | null>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const postAlpha = alpha + heads
    const postBeta = beta + tails
    const n = heads + tails
    const mle = n > 0 ? heads / n : null
    const priorMean = alpha / (alpha + beta)
    const posteriorMean = postAlpha / (postAlpha + postBeta)

    const prior = GRID.map((theta) => betaPdf(theta, alpha, beta))
    const logLike = GRID.map((theta) => logLikelihood(theta, heads, tails))
    const posterior = GRID.map((theta) => betaPdf(theta, postAlpha, postBeta))

    const maxPriorPosterior = Math.max(...prior, ...posterior, 0.001)
    const maxLogLikelihood = Math.max(...logLike)
    const likelihoodScaled = logLike.map((v) => Math.exp(v - maxLogLikelihood) * maxPriorPosterior)
    const logEvidence = logBeta(postAlpha, postBeta) - logBeta(alpha, beta)

    const priorStrength = alpha + beta
    const priorDataGap = mle === null ? 0 : Math.abs(priorMean - mle)
    const posteriorPriorGap = Math.abs(posteriorMean - priorMean)
    const posteriorDataGap = mle === null ? 0 : Math.abs(posteriorMean - mle)
    const classification: PredictionKey =
      n === 0 || mle === null
        ? 'unchanged'
        : posteriorDataGap <= priorDataGap * 0.25
          ? 'data'
          : posteriorPriorGap <= priorDataGap * 0.25
            ? 'prior'
            : 'compromise'
    const diagnosis =
      n === 0
        ? 'posterior equals prior'
        : n < priorStrength
          ? 'prior still visibly matters'
          : n < 4 * priorStrength
            ? 'data and prior both matter'
            : 'data dominates the update'

    return {
      postAlpha,
      postBeta,
      n,
      mle,
      priorMean,
      posteriorMean,
      prior,
      likelihoodScaled,
      posterior,
      maxPriorPosterior,
      logEvidence,
      priorDataGap,
      posteriorPriorGap,
      posteriorDataGap,
      classification,
      diagnosis,
    }
  }, [alpha, beta, heads, tails])

  const applyPreset = (key: PresetKey) => {
    const preset = PRESETS[key]
    setAlpha(preset.alpha)
    setBeta(preset.beta)
    setHeads(preset.heads)
    setTails(preset.tails)
    setActivePreset(key)
    setPrediction(null)
    setRevealed(false)
  }

  const update = (setter: (value: number) => void, value: number) => {
    setter(value)
    setActivePreset(null)
    setPrediction(null)
    setRevealed(false)
  }

  const predictionCorrect = prediction !== null && prediction === data.classification
  const classificationLabel = PREDICTIONS[data.classification].label
  const priorPath = pathFor(data.prior, data.maxPriorPosterior)
  const likePath = pathFor(data.likelihoodScaled, data.maxPriorPosterior)
  const postPath = pathFor(data.posterior, data.maxPriorPosterior)

  useEffect(() => {
    emitDemoState({
      conceptId: 'bayesian-inference',
      label: 'Prediction-first posterior update',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : PREDICTIONS[prediction].label}; posterior result is ${classificationLabel}. Prior mean ${fmt(data.priorMean)}, MLE ${data.mle === null ? 'undefined' : fmt(data.mle)}, posterior mean ${fmt(data.posteriorMean)}.`
        : 'Learner is predicting whether the posterior will stay near the prior, move toward the MLE, compromise, or remain unchanged before the posterior is revealed.',
      values: [
        `prediction: ${prediction === null ? 'none' : PREDICTIONS[prediction].label}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `preset: ${activePreset ? PRESETS[activePreset].label : 'custom'}`,
        `prior alpha: ${fmt(alpha)}`,
        `prior beta: ${fmt(beta)}`,
        `observed heads: ${heads}`,
        `observed tails: ${tails}`,
        `data count: ${data.n}`,
        `prior mean: ${fmt(data.priorMean)}`,
        `MLE: ${data.mle === null ? 'undefined' : fmt(data.mle)}`,
        `posterior mean: ${revealed ? fmt(data.posteriorMean) : 'hidden until reveal'}`,
        `posterior: ${revealed ? `Beta(${fmt(data.postAlpha)}, ${fmt(data.postBeta)})` : 'hidden until reveal'}`,
        `posterior result: ${revealed ? classificationLabel : 'hidden until reveal'}`,
        `posterior distance to prior mean: ${revealed ? fmt(data.posteriorPriorGap) : 'hidden until reveal'}`,
        `posterior distance to MLE: ${revealed ? (data.mle === null ? 'undefined' : fmt(data.posteriorDataGap)) : 'hidden until reveal'}`,
        `log evidence for observed sequence: ${revealed ? fmt(data.logEvidence) : 'hidden until reveal'}`,
      ],
    })
  }, [
    activePreset,
    alpha,
    beta,
    classificationLabel,
    data.logEvidence,
    data.mle,
    data.n,
    data.postAlpha,
    data.postBeta,
    data.posteriorDataGap,
    data.posteriorMean,
    data.posteriorPriorGap,
    data.priorMean,
    heads,
    prediction,
    predictionCorrect,
    revealed,
    tails,
  ])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" aria-label="Bayesian inference presets">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button key={key} type="button" aria-pressed={activePreset === key} onClick={() => applyPreset(key)}>
              {PRESETS[key].label}
            </button>
          ))}
        </div>
        <div className="sliders">
          <label>
            <span>prior alpha</span>
            <input type="range" min="1" max="20" step="0.5" value={alpha} onChange={(event) => update(setAlpha, Number(event.target.value))} />
            <strong>{fmt(alpha)}</strong>
          </label>
          <label>
            <span>prior beta</span>
            <input type="range" min="1" max="20" step="0.5" value={beta} onChange={(event) => update(setBeta, Number(event.target.value))} />
            <strong>{fmt(beta)}</strong>
          </label>
          <label>
            <span>heads h</span>
            <input type="range" min="0" max="40" step="1" value={heads} onChange={(event) => update(setHeads, Number(event.target.value))} />
            <strong>{heads}</strong>
          </label>
          <label>
            <span>tails t</span>
            <input type="range" min="0" max="40" step="1" value={tails} onChange={(event) => update(setTails, Number(event.target.value))} />
            <strong>{tails}</strong>
          </label>
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>MLE</span>
          <strong>{data.mle === null ? 'undefined' : fmt(data.mle)}</strong>
        </div>
        <div>
          <span>prior mean</span>
          <strong>{fmt(data.priorMean)}</strong>
        </div>
        <div>
          <span>posterior mean</span>
          <strong>{revealed ? fmt(data.posteriorMean) : 'hidden'}</strong>
        </div>
        <div>
          <span>posterior</span>
          <strong>{revealed ? `Beta(${fmt(data.postAlpha)}, ${fmt(data.postBeta)})` : 'hidden'}</strong>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>After prior and data combine, where will the posterior land?</strong>
          <p>
            The prior contributes pseudo-counts. The likelihood contributes observed heads and tails.
            Commit to which force controls the normalized posterior before revealing it.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Posterior update prediction">
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
          Reveal posterior
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `${classificationLabel} is the posterior result.`}</h4>
            <p>
              {PREDICTIONS[data.classification].response} The posterior mean is {fmt(data.posteriorMean)}, compared with
              prior mean {fmt(data.priorMean)} and {data.mle === null ? 'an undefined MLE' : `MLE ${fmt(data.mle)}`}.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a posterior behavior to unlock the posterior curve.' : 'Reveal the posterior to test your update prediction.'}</p>
        )}
      </section>

      <div className="stage">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Prior density, normalized likelihood shape, posterior density, MLE, prior mean, and posterior mean over coin head probability theta.">
          <rect x={PLOT.x} y={PLOT.y} width={PLOT.w} height={PLOT.h} rx="8" className="plotBg" />
          <line x1={PLOT.x} y1={PLOT.y + PLOT.h} x2={PLOT.x + PLOT.w} y2={PLOT.y + PLOT.h} className="axis" />
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={PLOT.x + tick * PLOT.w} y1={PLOT.y + PLOT.h} x2={PLOT.x + tick * PLOT.w} y2={PLOT.y + PLOT.h + 6} className="axis" />
              <text x={PLOT.x + tick * PLOT.w} y={PLOT.y + PLOT.h + 24} className="tick" textAnchor="middle">{tick.toFixed(2)}</text>
            </g>
          ))}
          <text x={PLOT.x + PLOT.w / 2} y={PLOT.y + PLOT.h + 52} className="axisLabel" textAnchor="middle">coin head probability theta</text>

          <path d={priorPath} className="curve prior" />
          <path d={likePath} className="curve likelihood" />
          {revealed ? <path d={postPath} className="curve posterior revealed" /> : null}

          <line x1={PLOT.x + data.priorMean * PLOT.w} y1={PLOT.y} x2={PLOT.x + data.priorMean * PLOT.w} y2={PLOT.y + PLOT.h} className="priorMeanLine" />
          {data.mle !== null && (
            <line x1={PLOT.x + data.mle * PLOT.w} y1={PLOT.y} x2={PLOT.x + data.mle * PLOT.w} y2={PLOT.y + PLOT.h} className="mleLine" />
          )}
          {revealed ? (
            <line x1={PLOT.x + data.posteriorMean * PLOT.w} y1={PLOT.y} x2={PLOT.x + data.posteriorMean * PLOT.w} y2={PLOT.y + PLOT.h} className="postMeanLine" />
          ) : (
            <g className="posteriorGate">
              <rect x="408" y="126" width="142" height="42" rx="8" />
              <text x="479" y="151" textAnchor="middle">posterior hidden</text>
            </g>
          )}

          <g transform="translate(70 58)">
            <text className="legend prior" x="0" y="0">prior density</text>
            <text className="legend likelihood" x="0" y="20">likelihood shape</text>
            <text className="legend posterior" x="0" y="40">{revealed ? 'posterior density' : 'posterior hidden'}</text>
            <text className="legend priorMean" x="360" y="0">prior mean</text>
            <text className="legend mle" x="360" y="20">MLE</text>
            <text className="legend postMean" x="360" y="40">{revealed ? 'posterior mean' : 'reveal mean'}</text>
          </g>
        </svg>

        <div className="readout">
          <div>
            <span>update rule</span>
            <strong>posterior proportional to likelihood * prior</strong>
            <p>The likelihood is shaped by observed heads and tails; the posterior becomes a normalized distribution over theta.</p>
          </div>
          <div>
            <span>data count</span>
            <strong>{data.n}</strong>
            <p>{revealed ? data.diagnosis : 'posterior diagnosis hidden until reveal'}</p>
          </div>
          <div>
            <span>contrast</span>
            <strong>{data.mle === null ? 'MLE undefined' : `MLE ${fmt(data.mle)}`}</strong>
            <p>{revealed ? 'The MLE is one parameter value. The posterior keeps uncertainty over nearby values.' : 'Use the prior mean and MLE to predict where posterior mass should land.'}</p>
          </div>
        </div>
      </div>

      <p className="claim">
        Bayesian inference does not replace likelihood; it uses likelihood as the data-fit term inside a normalized posterior distribution over unknowns.
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
        .readout {
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
          grid-template-columns: 7rem minmax(0, 1fr) 4.4rem;
          gap: 0.5rem;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding: 0.86rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.8);
        }

        .predictionCopy {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
        }

        .predictionCopy span,
        .result span {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0;
          color: #1f6f78;
        }

        .predictionCopy strong {
          color: #17202a;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .predictionCopy p,
        .result p {
          margin: 0;
          color: #4a5865;
          line-height: 1.52;
        }

        .choiceRow {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .choiceRow button {
          min-height: 2.8rem;
          font-weight: 800;
          text-align: center;
        }

        .choiceRow button.selected {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.94);
        }

        .reveal {
          justify-self: start;
          min-height: 2.7rem;
          border-color: rgba(31, 111, 120, 0.6);
          background: #1f6f78;
          color: #fffaf2;
          font-weight: 850;
          text-align: center;
        }

        .reveal:disabled {
          opacity: 0.58;
          cursor: not-allowed;
        }

        .result {
          min-height: 5.2rem;
          background: rgba(239, 247, 245, 0.62);
        }

        .result.shown {
          border-color: rgba(194, 74, 45, 0.2);
          background: rgba(255, 247, 236, 0.9);
        }

        .result h4 {
          margin: 0;
          color: #17202a;
          font-size: 1rem;
          line-height: 1.28;
        }

        .metrics div,
        .readout div {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div,
        .readout div {
          padding: 0.7rem;
        }

        .metrics span,
        .readout span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong,
        .readout strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.34fr);
          gap: 0.75rem;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(247, 250, 246, 0.94), rgba(245, 249, 255, 0.82));
        }

        .plotBg {
          fill: rgba(255, 255, 255, 0.64);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .axis {
          stroke: rgba(27, 36, 48, 0.18);
          stroke-width: 1;
        }

        .tick,
        .axisLabel,
        .legend {
          font-family: var(--font-mono);
        }

        .tick {
          fill: #65717d;
          font-size: 10px;
        }

        .axisLabel {
          fill: #4a5865;
          font-size: 12px;
        }

        .curve {
          fill: none;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .curve.prior {
          stroke: #1f6f78;
        }

        .curve.likelihood {
          stroke: #8b5e34;
          stroke-dasharray: 7 5;
        }

        .curve.posterior {
          stroke: #1f4b99;
        }

        .curve.revealed {
          stroke-dasharray: 760;
          animation: drawPosterior 1.2s ease-out both;
        }

        .mleLine {
          stroke: rgba(179, 58, 47, 0.65);
          stroke-width: 2;
          stroke-dasharray: 5 5;
        }

        .priorMeanLine {
          stroke: rgba(31, 111, 120, 0.5);
          stroke-width: 2;
          stroke-dasharray: 2 5;
        }

        .postMeanLine {
          stroke: rgba(31, 75, 153, 0.55);
          stroke-width: 2;
        }

        .legend {
          font-size: 12px;
          font-weight: 700;
        }

        .legend.prior {
          fill: #1f6f78;
        }

        .legend.likelihood {
          fill: #8b5e34;
        }

        .legend.posterior {
          fill: #1f4b99;
        }

        .legend.priorMean {
          fill: #1f6f78;
        }

        .legend.mle {
          fill: #b33a2f;
        }

        .legend.postMean {
          fill: #1f4b99;
        }

        .posteriorGate rect {
          fill: rgba(255, 251, 245, 0.82);
          stroke: rgba(31, 75, 153, 0.18);
        }

        .posteriorGate text {
          fill: #52606b;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .readout p {
          margin: 0.35rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 980px) {
          .controls,
          .stage {
            grid-template-columns: 1fr;
          }

          .presetGroup {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 680px) {
          .metrics {
            grid-template-columns: 1fr;
          }

          .choiceRow {
            grid-template-columns: 1fr;
          }

          .presetGroup {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          label {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }
        }

        @keyframes drawPosterior {
          from {
            stroke-dashoffset: 760;
          }
          to {
            stroke-dashoffset: 0;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .curve.revealed {
            animation: none;
          }
        }
      `}</style>
    </div>
  )
}
