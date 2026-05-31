import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type Preset = {
  label: string
  successes: number
  theta: number
}

type Prediction = 'decrease' | 'stay' | 'increase' | null

const N = 20
const EPS = 1e-9
const PRESETS: Preset[] = [
  { label: 'case A', successes: 14, theta: 0.35 },
  { label: 'case B', successes: 14, theta: 0.7 },
  { label: 'case C', successes: 3, theta: 0.15 },
  { label: 'case D', successes: 19, theta: 0.2 },
  { label: 'case E', successes: 20, theta: 0.99 },
]

function clampTheta(theta: number) {
  return Math.min(0.99, Math.max(0.01, theta))
}

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function entropyBinary(p: number) {
  const q = 1 - p
  const terms = [p, q].filter((value) => value > 0)
  return terms.reduce((acc, value) => acc - value * Math.log(value), 0)
}

function nll(successes: number, theta: number) {
  const p = successes / N
  const t = clampTheta(theta)
  return -(p * Math.log(t) + (1 - p) * Math.log(1 - t))
}

function directionLabel(prediction: Exclude<Prediction, null>) {
  if (prediction === 'decrease') return 'decrease theta'
  if (prediction === 'increase') return 'increase theta'
  return 'stay here'
}

export default function MaximumLikelihoodViz() {
  const [successes, setSuccesses] = useState(PRESETS[0].successes)
  const [theta, setTheta] = useState(PRESETS[0].theta)
  const [activePreset, setActivePreset] = useState<string | null>(PRESETS[0].label)
  const [prediction, setPrediction] = useState<Prediction>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const pHat = successes / N
    const failures = N - successes
    const thetaClamped = clampTheta(theta)
    const entropy = entropyBinary(pHat)
    const currentNll = nll(successes, thetaClamped)
    const kl = currentNll - entropy
    const logitGradient = thetaClamped - pHat
    const curve = Array.from({ length: 99 }, (_, index) => {
      const t = 0.01 + index * 0.01
      return { theta: t, nll: nll(successes, t) }
    })
    const maxNll = Math.max(...curve.map((point) => point.nll))
    const minNll = Math.min(entropy, ...curve.map((point) => point.nll))
    const boundaryCase = pHat === 0 || pHat === 1

    return {
      pHat,
      failures,
      theta: thetaClamped,
      entropy,
      currentNll,
      kl: Math.max(0, kl),
      logitGradient,
      curve,
      maxNll,
      minNll,
      boundaryCase,
    }
  }, [successes, theta])

  const setPreset = (preset: Preset) => {
    setSuccesses(preset.successes)
    setTheta(preset.theta)
    setActivePreset(preset.label)
    setPrediction(null)
    setRevealed(false)
  }

  const updateSuccesses = (value: number) => {
    setSuccesses(value)
    setActivePreset(null)
    setPrediction(null)
    setRevealed(false)
  }

  const updateTheta = (value: number) => {
    setTheta(value)
    setActivePreset(null)
    setPrediction(null)
    setRevealed(false)
  }

  const plot = {
    x: 54,
    y: 32,
    width: 560,
    height: 250,
  }

  const xScale = (value: number) => plot.x + value * plot.width
  const yScale = (value: number) => {
    const span = Math.max(0.001, data.maxNll - data.minNll)
    return plot.y + plot.height - ((value - data.minNll) / span) * plot.height
  }

  const curvePath = data.curve
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${xScale(point.theta)} ${yScale(point.nll)}`)
    .join(' ')

  const mleX = xScale(data.pHat)
  const thetaX = xScale(data.theta)
  const thetaY = yScale(data.currentNll)
  const displayThetaY = revealed ? thetaY : plot.y + plot.height / 2
  const entropyY = yScale(data.entropy)
  const correctDirection: Exclude<Prediction, null> = Math.abs(data.pHat - data.theta) < EPS ? 'stay' : data.pHat > data.theta ? 'increase' : 'decrease'
  const predictionCorrect = prediction === correctDirection
  const klMarkerX = Math.min(Math.max(thetaX + 28, plot.x + 24), plot.x + plot.width - 24)
  const klTopY = Math.min(thetaY, entropyY)
  const klBottomY = Math.max(thetaY, entropyY)
  const svgLabel = revealed
    ? `Average negative log-likelihood curve over theta. Current theta is ${fmt(data.theta)}, MLE theta is ${fmt(data.pHat)}, average NLL is ${fmt(data.currentNll)}, entropy is ${fmt(data.entropy)}, KL mismatch is ${fmt(data.kl)}, and likelihood should ${directionLabel(correctDirection)}.`
    : `Prediction checkpoint for average negative log-likelihood. Current theta is ${fmt(data.theta)} and the observed data have ${successes} successes in ${N} trials; the curve, MLE, entropy, KL mismatch, and gradient are hidden.`

  useEffect(() => {
    emitDemoState({
      conceptId: 'maximum-likelihood',
      label: 'Prediction-first Bernoulli likelihood explorer',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : directionLabel(prediction)}; observed data has ${successes}/${N} successes, model theta is ${fmt(data.theta)}, MLE theta is ${fmt(data.pHat)}, and the likelihood wants to ${directionLabel(correctDirection)}. KL mismatch is ${fmt(data.kl)}.`
        : prediction === null
          ? `Learner has not chosen a direction yet; the NLL curve, MLE line, entropy baseline, KL mismatch, and gradient are hidden.`
          : `Learner predicted ${directionLabel(prediction)}; the NLL curve, MLE line, entropy baseline, KL mismatch, and gradient are still hidden until reveal.`,
      values: [
        `prediction: ${prediction === null ? 'none' : directionLabel(prediction)}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `observed successes: ${successes}/${N}`,
        `model theta=${fmt(data.theta)}`,
        `MLE theta=${revealed ? fmt(data.pHat) : 'hidden until reveal'}`,
        `avg NLL=${revealed ? fmt(data.currentNll) : 'hidden until reveal'}`,
        `entropy=${revealed ? fmt(data.entropy) : 'hidden until reveal'}`,
        `KL mismatch=${revealed ? fmt(data.kl) : 'hidden until reveal'}`,
        `logit gradient=${revealed ? fmt(data.logitGradient) : 'hidden until reveal'}`,
        `likelihood direction=${revealed ? directionLabel(correctDirection) : 'hidden until reveal'}`,
        activePreset ? `preset=${activePreset}` : 'custom slider state',
      ],
    })
  }, [activePreset, correctDirection, data.currentNll, data.entropy, data.kl, data.logitGradient, data.pHat, data.theta, prediction, predictionCorrect, revealed, successes])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" role="group" aria-label="Maximum likelihood presets">
          {PRESETS.map((preset) => (
            <button key={preset.label} type="button" aria-pressed={activePreset === preset.label} onClick={() => setPreset(preset)}>
              {preset.label}
            </button>
          ))}
        </div>

        <div className="sliders">
          <label>
            <span>observed successes</span>
            <input
              type="range"
              min="0"
              max={N}
              step="1"
              value={successes}
              aria-valuetext={`${successes} successes out of ${N}`}
              onChange={(event) => updateSuccesses(Number(event.target.value))}
            />
            <strong>{successes}/{N}</strong>
          </label>
          <label>
            <span>model θ</span>
            <input
              type="range"
              min="0.01"
              max="0.99"
              step="0.01"
              value={theta}
              aria-valuetext={`model theta ${fmt(data.theta)}`}
              onChange={(event) => updateTheta(Number(event.target.value))}
            />
            <strong>{fmt(data.theta)}</strong>
          </label>
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>{revealed ? 'MLE θ̂ = s/n' : 'best theta'}</span>
          <strong>{revealed ? fmt(data.pHat) : 'hidden'}</strong>
        </div>
        <div>
          <span>avg NLL at θ</span>
          <strong>{revealed ? fmt(data.currentNll) : 'hidden'}</strong>
        </div>
        <div>
          <span>{revealed ? 'empirical entropy H(p̂)' : 'entropy baseline'}</span>
          <strong>{revealed ? fmt(data.entropy) : 'hidden'}</strong>
        </div>
        <div>
          <span>KL mismatch</span>
          <strong>{revealed ? fmt(data.kl) : 'hidden'}</strong>
        </div>
        <div>
          <span>{revealed ? 'logit gradient θ - p̂' : 'direction signal'}</span>
          <strong>{revealed ? fmt(data.logitGradient) : 'hidden'}</strong>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>With the observations fixed, which way should likelihood move theta?</strong>
          <p>
            Count the successes and compare the current model probability. The curve,
            optimum, KL mismatch, and gradient stay hidden until you commit.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Maximum likelihood direction prediction">
          {(['decrease', 'stay', 'increase'] as const).map((choice) => (
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
              {directionLabel(choice)}
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={prediction === null} onClick={() => setRevealed(true)}>
          Reveal likelihood
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : `Not quite: likelihood should ${directionLabel(correctDirection)}.`}</h4>
            <p>
              You predicted {prediction === null ? 'nothing' : directionLabel(prediction)}. The MLE is θ̂={fmt(data.pHat)}, so from θ={fmt(data.theta)} likelihood should {directionLabel(correctDirection)}.
              The reported gradient is dNLL/da=θ-p̂={fmt(data.logitGradient)}; gradient descent subtracts it, so negative increases θ and positive decreases θ.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a direction to unlock the curve.' : 'Reveal the NLL curve and MLE line to test your prediction.'}</p>
        )}
      </section>

      <div className="stage">
        <div className="panel">
          <h3>observed data</h3>
          <div className="coinGrid" role="img" aria-label={`${successes} successes and ${data.failures} failures`}>
            {Array.from({ length: N }, (_, index) => (
              <span key={index} aria-hidden="true" className={index < successes ? 'coin success' : 'coin failure'}>
                {index < successes ? '1' : '0'}
              </span>
            ))}
          </div>
          <div className="bars">
            <Bar label="empirical P(1)" value={data.pHat} color="#1f6f78" />
            <Bar label="model P(1)" value={data.theta} color="#c26f34" />
          </div>
        </div>

        <svg viewBox="0 0 660 330" role="img" aria-label={svgLabel}>
          <rect x="24" y="18" width="612" height="292" rx="8" className="plotBg" />
          <text x="52" y="30" className="axisTitle">average NLL as θ moves</text>

          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1={xScale(tick)} x2={xScale(tick)} y1={plot.y} y2={plot.y + plot.height} className="grid" />
              <text x={xScale(tick)} y={plot.y + plot.height + 24} className="tick" textAnchor="middle">
                {tick.toFixed(2)}
              </text>
            </g>
          ))}

          <line x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} className="axis" />
          <line x1={plot.x} x2={plot.x} y1={plot.y} y2={plot.y + plot.height} className="axis" />
          {revealed ? (
            <>
              <line x1={plot.x} x2={plot.x + plot.width} y1={entropyY} y2={entropyY} className="entropyLine" />
              <text x={plot.x + plot.width - 8} y={Math.max(plot.y + 14, entropyY - 8)} className="entropyText" textAnchor="end">
                H(p̂)
              </text>
              <path d={curvePath} className="curve" />

              <line x1={mleX} x2={mleX} y1={plot.y} y2={plot.y + plot.height} className="mleLine" />
              <text x={mleX} y={plot.y + 18} className="mleText" textAnchor="middle">θ̂</text>
              {data.kl > 0.004 ? (
                <>
                  <line x1={klMarkerX} x2={klMarkerX} y1={klTopY} y2={klBottomY} className="klGap" />
                  <line x1={klMarkerX - 7} x2={klMarkerX + 7} y1={klTopY} y2={klTopY} className="klGap" />
                  <line x1={klMarkerX - 7} x2={klMarkerX + 7} y1={klBottomY} y2={klBottomY} className="klGap" />
                  <text x={Math.min(klMarkerX + 10, plot.x + plot.width - 34)} y={(klTopY + klBottomY) / 2 - 5} className="klText">
                    KL
                  </text>
                </>
              ) : null}
            </>
          ) : (
            <>
              <rect x="84" y="88" width="492" height="126" rx="10" className="hiddenCurve" />
              <text x={plot.x + plot.width / 2} y="142" className="hiddenText" textAnchor="middle">
                curve hidden until prediction
              </text>
              <text x={plot.x + plot.width / 2} y="170" className="hiddenSubtext" textAnchor="middle">
                commit to a direction before seeing the optimum
              </text>
            </>
          )}

          <line x1={thetaX} x2={thetaX} y1={displayThetaY} y2={plot.y + plot.height} className="thetaLine" />
          <circle cx={thetaX} cy={displayThetaY} r="6" className="thetaDot" />
          <text x={Math.min(thetaX + 12, plot.x + plot.width - 90)} y={revealed ? displayThetaY - 12 : plot.y + plot.height - 18} className="thetaText">
            θ={fmt(data.theta)}
          </text>

          <text x={plot.x + plot.width / 2} y="322" className="axisLabel" textAnchor="middle">model probability θ=P(1)</text>
        </svg>
      </div>

      <p className="claim">
        {!revealed ? (
          <>
            Maximum likelihood is a parameter-moving question: the observations stay fixed while theta is adjusted to make those observations less surprising.
          </>
        ) : data.boundaryCase ? (
          <>
            Boundary case: the closed-interval MLE is at θ̂={fmt(data.pHat)}. The slider stops short of 0 and 1 to avoid log(0), so the displayed curve approaches that boundary optimum. Moving θ away still leaves empirical entropy fixed and adds KL mismatch.
          </>
        ) : (
          <>
            MLE holds the observations fixed and moves θ. The minimum NLL occurs when the model probability matches the empirical frequency; moving away leaves empirical entropy fixed and adds KL mismatch.
          </>
        )}
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
        .sliders {
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
          grid-template-columns: 8.8rem minmax(0, 1fr) 4.7rem;
          gap: 0.55rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.8rem;
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
          grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
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

        .metrics strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .predictionPanel,
        .result {
          display: grid;
          gap: 0.7rem;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(247, 250, 246, 0.78);
        }

        .predictionPanel {
          grid-template-columns: minmax(0, 1.1fr) minmax(220px, 0.9fr) auto;
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
        .result h4 {
          color: #1b2430;
          font-size: 0.92rem;
        }

        .predictionCopy p,
        .result p {
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

        .result h4 {
          margin: 0;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(220px, 0.33fr) minmax(0, 1fr);
          gap: 0.75rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .coinGrid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.35rem;
        }

        .coin {
          min-height: 1.9rem;
          display: grid;
          place-items: center;
          border-radius: 7px;
          font-family: var(--font-mono);
          font-size: 0.8rem;
          font-weight: 700;
        }

        .success {
          background: rgba(226, 242, 239, 0.94);
          color: #1f6f78;
          border: 1px solid rgba(31, 111, 120, 0.22);
        }

        .failure {
          background: rgba(255, 246, 232, 0.96);
          color: #9a5a28;
          border: 1px solid rgba(194, 111, 52, 0.22);
        }

        .bars {
          display: grid;
          gap: 0.6rem;
          margin-top: 0.85rem;
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

        .axis,
        .grid {
          stroke: rgba(27, 36, 48, 0.16);
        }

        .grid {
          stroke-dasharray: 3 5;
        }

        .curve {
          fill: none;
          stroke: #1f6f78;
          stroke-width: 3;
          stroke-linecap: round;
        }

        .mleLine {
          stroke: rgba(31, 111, 120, 0.45);
          stroke-width: 2;
          stroke-dasharray: 6 5;
        }

        .thetaLine {
          stroke: rgba(194, 111, 52, 0.55);
          stroke-width: 2;
        }

        .thetaDot {
          fill: #c26f34;
          stroke: #fffaf0;
          stroke-width: 2;
        }

        .entropyLine {
          stroke: rgba(27, 36, 48, 0.38);
          stroke-width: 2;
          stroke-dasharray: 4 5;
        }

        .klGap {
          stroke: rgba(194, 111, 52, 0.7);
          stroke-width: 2;
          stroke-linecap: round;
        }

        .hiddenCurve {
          fill: rgba(255, 250, 240, 0.9);
          stroke: rgba(27, 36, 48, 0.12);
          stroke-dasharray: 7 6;
        }

        .axisTitle,
        .axisLabel,
        .tick,
        .mleText,
        .thetaText,
        .entropyText,
        .klText,
        .hiddenText,
        .hiddenSubtext {
          fill: #334150;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .hiddenText {
          font-family: var(--font-sans);
          font-weight: 700;
        }

        .klText {
          fill: #9a5a28;
          font-weight: 700;
        }

        .hiddenSubtext {
          fill: #65717d;
        }

        .axisTitle {
          font-family: var(--font-sans);
          font-weight: 700;
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

          .choiceRow {
            grid-template-columns: 1fr;
          }

          label {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }

          svg {
            min-height: 260px;
          }
        }
      `}</style>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="barRow">
      <div className="barHeader">
        <span>{label}</span>
        <strong>{fmtPct(value)}</strong>
      </div>
      <div
        className="track"
        role="meter"
        aria-label={`${label} ${fmt(value)}`}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-valuenow={value}
      >
        <div className="fill" style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <style jsx>{`
        .barRow {
          display: grid;
          gap: 0.25rem;
        }

        .barHeader {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          color: #4a5865;
          font-size: 0.76rem;
        }

        strong {
          color: #1b2430;
          font-family: var(--font-mono);
        }

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
