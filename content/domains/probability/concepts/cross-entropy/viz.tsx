import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type PresetKey = 'calibrated' | 'diffuse' | 'wrong' | 'soft'
type Prediction = number | null

type Preset = {
  label: string
  target: number[]
  logits: number[]
}

const CATEGORIES = ['correct token', 'near synonym', 'distractor', 'rare token']
const EPS = 1e-12
const WIDTH = 720
const HEIGHT = 390
const PLOT = { x: 44, y: 42, w: 632, h: 220 }

const PRESETS: Record<PresetKey, Preset> = {
  calibrated: {
    label: 'matched soft target',
    target: [0.7, 0.2, 0.08, 0.02],
    logits: [2.643, 1.391, 0.474, -0.912],
  },
  diffuse: {
    label: 'too diffuse',
    target: [1, 0, 0, 0],
    logits: [0.35, 0.25, 0.1, -0.05],
  },
  wrong: {
    label: 'wrong confidence',
    target: [1, 0, 0, 0],
    logits: [-2.2, 2.4, 0.8, -0.6],
  },
  soft: {
    label: 'soft target mismatch',
    target: [0.7, 0.2, 0.08, 0.02],
    logits: [1.2, 0.4, -0.3, -1.1],
  },
}

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function gradAction(n: number) {
  if (Math.abs(n) < 0.0005) return 'no logit change'
  return n < 0 ? 'raise logit' : 'lower logit'
}

function gradTone(n: number) {
  if (Math.abs(n) < 0.0005) return 'neutral'
  return n < 0 ? 'raise' : 'lower'
}

function softmax(logits: number[]) {
  const maxLogit = Math.max(...logits)
  const exp = logits.map((v) => Math.exp(v - maxLogit))
  const sum = exp.reduce((acc, v) => acc + v, 0)
  return exp.map((v) => v / sum)
}

function entropy(p: number[]) {
  return p.reduce((acc, v) => (v > 0 ? acc - v * Math.log(v) : acc), 0)
}

function crossEntropy(p: number[], q: number[]) {
  return p.reduce((acc, v, i) => acc - v * Math.log(Math.max(q[i], EPS)), 0)
}

function contribution(p: number[], q: number[]) {
  return p.map((v, i) => -v * Math.log(Math.max(q[i], EPS)))
}

export default function CrossEntropyViz() {
  const [target, setTarget] = useState(PRESETS.calibrated.target)
  const [logits, setLogits] = useState(PRESETS.calibrated.logits)
  const [activePreset, setActivePreset] = useState<PresetKey | null>('calibrated')
  const [prediction, setPrediction] = useState<Prediction>(null)
  const [revealed, setRevealed] = useState(false)

  const data = useMemo(() => {
    const q = softmax(logits)
    const hTarget = entropy(target)
    const ce = crossEntropy(target, q)
    const kl = ce - hTarget
    const ceParts = contribution(target, q)
    const grad = q.map((v, i) => v - target[i])
    const maxPart = Math.max(...ceParts, 0.001)
    const maxGrad = Math.max(...grad.map((v) => Math.abs(v)), 0.001)
    const topIndex = q.reduce((best, v, i) => (v > q[best] ? i : best), 0)
    const targetIndex = target.reduce((best, v, i) => (v > target[best] ? i : best), 0)
    const dominantLossIndex = ceParts.reduce((best, v, i) => (v > ceParts[best] ? i : best), 0)
    const raiseIndex = grad.reduce((best, v, i) => (v < grad[best] ? i : best), 0)
    const topMatchesTarget = topIndex === targetIndex
    const diagnosis =
      q[targetIndex] < 0.12
        ? 'target mass meets low model probability'
        : ce < hTarget + 0.08
          ? 'model is close to the target'
          : 'loss is still mostly mismatch'

    return { q, hTarget, ce, kl, ceParts, grad, maxPart, maxGrad, topIndex, targetIndex, dominantLossIndex, raiseIndex, topMatchesTarget, diagnosis }
  }, [logits, target])

  const resetPrediction = () => {
    setPrediction(null)
    setRevealed(false)
  }

  const applyPreset = (key: PresetKey) => {
    resetPrediction()
    setTarget(PRESETS[key].target)
    setLogits(PRESETS[key].logits)
    setActivePreset(key)
  }

  const updateLogit = (index: number, value: number) => {
    resetPrediction()
    setLogits((prev) => {
      const next = [...prev]
      next[index] = value
      return next
    })
    setActivePreset(null)
  }

  const groupWidth = PLOT.w / CATEGORIES.length
  const baseY = PLOT.y + PLOT.h
  const maxBarHeight = 170
  const predictionCorrect = prediction === data.dominantLossIndex
  const dominantCategory = CATEGORIES[data.dominantLossIndex]
  const raiseCategory = CATEGORIES[data.raiseIndex]

  useEffect(() => {
    emitDemoState({
      conceptId: 'cross-entropy',
      label: 'Prediction-first cross-entropy surprise map',
      summary: revealed
        ? `Learner predicted ${prediction === null ? 'none' : CATEGORIES[prediction]}; dominant target-weighted surprise is ${dominantCategory} with contribution ${fmt(data.ceParts[data.dominantLossIndex])}; H(p,q)=${fmt(data.ce)}, H(p)=${fmt(data.hTarget)}, KL=${fmt(data.kl)}; strongest raise-logit pressure is ${raiseCategory}.`
        : `Learner is predicting which token dominates cross-entropy before loss contributions and gradient directions are revealed.`,
      values: [
        `prediction: ${prediction === null ? 'none' : CATEGORIES[prediction]}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `prediction correct: ${revealed && prediction !== null ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `target p: [${target.map(fmt).join(', ')}]`,
        `model q: [${data.q.map(fmt).join(', ')}]`,
        `cross entropy H(p,q): ${revealed ? fmt(data.ce) : 'hidden until reveal'}`,
        `target entropy H(p): ${fmt(data.hTarget)}`,
        `KL(p||q): ${revealed ? fmt(data.kl) : 'hidden until reveal'}`,
        `dominant loss contribution: ${revealed ? `${dominantCategory}=${fmt(data.ceParts[data.dominantLossIndex])}` : 'hidden until reveal'}`,
        `model top class: ${CATEGORIES[data.topIndex]} (${fmtPct(data.q[data.topIndex])})`,
        `largest target mass: ${CATEGORIES[data.targetIndex]} (${fmtPct(target[data.targetIndex])})`,
        `strongest raise-logit pressure: ${revealed ? `${raiseCategory}; gradient=${fmt(data.grad[data.raiseIndex])}` : 'hidden until reveal'}`,
        `softmax gradient q-p: ${revealed ? `[${data.grad.map(fmt).join(', ')}]` : 'hidden until reveal'}`,
      ],
    })
  }, [
    data.ce,
    data.ceParts,
    data.dominantLossIndex,
    data.grad,
    data.hTarget,
    data.kl,
    data.q,
    data.raiseIndex,
    data.targetIndex,
    data.topIndex,
    dominantCategory,
    prediction,
    predictionCorrect,
    raiseCategory,
    revealed,
    target,
  ])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" aria-label="Cross-entropy presets">
          {(Object.keys(PRESETS) as PresetKey[]).map((key) => (
            <button
              type="button"
              key={key}
              aria-pressed={activePreset === key}
              onClick={() => applyPreset(key)}
            >
              {PRESETS[key].label}
            </button>
          ))}
        </div>

        <div className="sliders">
          {CATEGORIES.map((label, index) => (
            <label key={label}>
              <span>{label}</span>
              <input
                type="range"
                min="-3"
                max="3"
                step="0.05"
                value={logits[index]}
                onChange={(event) => updateLogit(index, Number(event.target.value))}
              />
              <strong>{fmt(logits[index])}</strong>
            </label>
          ))}
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>cross-entropy H(p,q)</span>
          <strong>{revealed ? `${fmt(data.ce)} nats` : 'hidden'}</strong>
        </div>
        <div>
          <span>target entropy H(p)</span>
          <strong>{fmt(data.hTarget)} nats</strong>
        </div>
        <div>
          <span>mismatch KL(p||q)</span>
          <strong>{revealed ? `${fmt(data.kl)} nats` : 'hidden'}</strong>
        </div>
        <div>
          <span>diagnosis</span>
          <strong>{revealed ? data.diagnosis : 'predict first'}</strong>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Which token will dominate the loss?</strong>
          <p>
            Target mass decides where surprise matters. Before revealing the orange loss bars,
            choose the token that contributes most to H(p,q).
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Cross-entropy dominant surprise prediction">
          {CATEGORIES.map((label, index) => (
            <button
              key={label}
              type="button"
              className={prediction === index ? 'selected' : ''}
              aria-pressed={prediction === index}
              onClick={() => {
                setPrediction(index)
                setRevealed(false)
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="reveal"
          disabled={prediction === null}
          onClick={() => setRevealed(true)}
        >
          Reveal surprise
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : 'The target-weighted surprise is visible.'}</h4>
            <p>
              {dominantCategory} contributes {fmt(data.ceParts[data.dominantLossIndex])} nats to H(p,q).
              The strongest raise-logit pressure is on {raiseCategory}, because q - p = {fmt(data.grad[data.raiseIndex])}.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a token to unlock the loss contributions and gradient directions.' : 'Reveal the contribution bars to test your prediction.'}</p>
        )}
      </section>

      <div className="stage">
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Cross-entropy bars showing target probabilities, model probabilities, relative loss contributions, and logit gradients.">
          <rect x={PLOT.x} y={PLOT.y} width={PLOT.w} height={PLOT.h} rx="8" className="plotBg" />
          <line x1={PLOT.x} y1={baseY} x2={PLOT.x + PLOT.w} y2={baseY} className="axis" />
          <text x={PLOT.x} y="24" className="legend target">target p</text>
          <text x={PLOT.x + 86} y="24" className="legend model">model q</text>
          <text x={PLOT.x + 178} y="24" className="legend loss">relative loss contribution</text>

          {CATEGORIES.map((label, index) => {
            const cx = PLOT.x + groupWidth * index + groupWidth / 2
            const pHeight = target[index] * maxBarHeight
            const qHeight = data.q[index] * maxBarHeight
            const contribHeight = revealed ? (data.ceParts[index] / data.maxPart) * 52 : 9
            return (
              <g key={label}>
                <rect x={cx - 31} y={baseY - pHeight} width="22" height={pHeight} rx="4" className="bar target" />
                <rect x={cx - 4} y={baseY - qHeight} width="22" height={qHeight} rx="4" className="bar model" />
                <rect x={cx + 23} y={baseY - contribHeight} width="16" height={contribHeight} rx="4" className={revealed && index === data.dominantLossIndex ? 'bar loss dominant' : 'bar loss'} />
                <text x={cx - 20} y={baseY - pHeight - 7} className="value" textAnchor="middle">
                  {target[index] > 0.005 ? fmtPct(target[index]) : ''}
                </text>
                <text x={cx + 7} y={baseY - qHeight - 7} className="value" textAnchor="middle">
                  {fmtPct(data.q[index])}
                </text>
                <text x={cx} y={baseY + 26} className="category" textAnchor="middle">
                  {label}
                </text>
              </g>
            )
          })}

          <g transform="translate(44 312)">
            <text x="0" y="-18" className="rowLabel">softmax logit gradient: q - p</text>
            {CATEGORIES.map((label, index) => {
              const rowY = index * 18
              const center = 196
              const width = (data.grad[index] / data.maxGrad) * 120
              const x = width < 0 ? center + width : center
              return (
                <g key={`grad-${label}`} transform={`translate(0 ${rowY})`}>
                  <text x="0" y="5" className="gradLabel">{label}</text>
                  <line x1={center - 126} y1="0" x2={center + 126} y2="0" className="gradAxis" />
                  <line x1={center} y1="-6" x2={center} y2="6" className="gradZero" />
                  <rect x={x} y="-5" width={Math.abs(width)} height="10" rx="5" className={data.grad[index] < 0 ? 'gradRaise' : 'gradLower'} />
                  <text x="342" y="5" className={`gradText ${gradTone(data.grad[index])}`}>
                    {revealed ? `${fmt(data.grad[index])} ${gradAction(data.grad[index])}` : 'hidden until reveal'}
                  </text>
                </g>
              )
            })}
          </g>
        </svg>

        <div className="readout">
          <div>
            <span>largest target mass</span>
            <strong>{CATEGORIES[data.targetIndex]}</strong>
            <p>The loss mostly cares where the target distribution places probability.</p>
          </div>
          <div>
            <span>model top class</span>
            <strong>{CATEGORIES[data.topIndex]} ({fmtPct(data.q[data.topIndex])})</strong>
            <p>
              {data.topMatchesTarget
                ? 'The model top class agrees with the largest target mass; remaining loss comes from distributional mismatch.'
                : 'A confident wrong top class creates a large negative log-probability for target-heavy outcomes.'}
            </p>
          </div>
          <div>
            <span>identity check</span>
            <strong>{revealed ? `${fmt(data.ce)} = ${fmt(data.hTarget)} + ${fmt(data.kl)}` : `${fmt(data.hTarget)} + hidden KL`}</strong>
            <p>Only the KL term changes when the target is fixed and the model moves.</p>
          </div>
        </div>
      </div>

      <p className="claim">
        Cross-entropy is not just an accuracy score. It is a smooth pressure field on probabilities: target mass says where surprise matters, and the softmax gradient turns that surprise into logit updates.
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

        .presetGroup {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.35rem;
          align-content: start;
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

        button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .sliders {
          display: grid;
          gap: 0.42rem;
        }

        label {
          display: grid;
          grid-template-columns: 8.2rem minmax(0, 1fr) 4.6rem;
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

        .metrics div,
        .readout div {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div {
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

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(220px, 0.8fr) minmax(260px, 1.2fr) auto;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .choiceRow button {
          min-height: 54px;
          text-align: center;
          white-space: normal;
        }

        .choiceRow button.selected {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.9);
          box-shadow: 0 0 0 2px rgba(31, 111, 120, 0.1);
        }

        .reveal {
          align-self: center;
          min-height: 46px;
          background: #1b2430;
          color: white;
          text-align: center;
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

        .axis,
        .gradAxis {
          stroke: rgba(27, 36, 48, 0.14);
          stroke-width: 1;
        }

        .gradZero {
          stroke: rgba(27, 36, 48, 0.36);
          stroke-width: 1.2;
        }

        .bar.target {
          fill: #1f6f78;
        }

        .bar.model {
          fill: #1f4b99;
        }

        .bar.loss {
          fill: #b67828;
          opacity: 0.5;
        }

        .bar.loss.dominant {
          fill: #d17a22;
          opacity: 1;
        }

        .legend,
        .category,
        .value,
        .rowLabel,
        .gradLabel,
        .gradText {
          font-family: var(--font-mono);
        }

        .legend,
        .rowLabel {
          fill: #334150;
          font-size: 12px;
          font-weight: 700;
        }

        .legend.target {
          fill: #1f6f78;
        }

        .legend.model {
          fill: #1f4b99;
        }

        .legend.loss {
          fill: #8b5e34;
        }

        .category,
        .gradLabel {
          fill: #4a5865;
          font-size: 11px;
        }

        .value {
          fill: #1b2430;
          font-size: 10px;
          paint-order: stroke;
          stroke: rgba(255, 255, 255, 0.86);
          stroke-width: 4px;
        }

        .gradRaise {
          fill: #1f6f78;
        }

        .gradLower {
          fill: #b33a2f;
        }

        .gradText {
          font-size: 11px;
        }

        .gradText.raise {
          fill: #1f6f78;
        }

        .gradText.lower {
          fill: #b33a2f;
        }

        .gradText.neutral {
          fill: #4a5865;
        }

        .readout {
          display: grid;
          gap: 0.6rem;
        }

        .readout div {
          padding: 0.75rem;
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
          .predictionPanel,
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
      `}</style>
    </div>
  )
}
