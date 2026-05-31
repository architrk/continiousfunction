import { useEffect, useMemo, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type Phase = 'forward' | 'backward' | 'update'
type PresetKey = 'normal' | 'large_lr' | 'saturated'
export type HiddenSignalPrediction = 'h1' | 'h2' | 'h3' | 'no-clear-signal'

type Model = {
  x: [number, number]
  y: number
  W1: [number, number][]
  b1: number[]
  W2: [number, number, number]
  b2: number
}

export const VANISHING_ROW_NORM = 1e-4
export const NEAR_TIE_RELATIVE_GAP = 0.1

const PREDICTION_COPY: Record<HiddenSignalPrediction, { label: string; detail: string; status: string }> = {
  h1: {
    label: 'Hidden unit H1',
    detail: 'The first hidden row carries the strongest usable signal.',
    status: 'H1 carries the strongest usable signal',
  },
  h2: {
    label: 'Hidden unit H2',
    detail: 'The second hidden row carries the strongest usable signal.',
    status: 'H2 carries the strongest usable signal',
  },
  h3: {
    label: 'Hidden unit H3',
    detail: 'The third hidden row carries the strongest usable signal.',
    status: 'H3 carries the strongest usable signal',
  },
  'no-clear-signal': {
    label: 'No clear usable signal',
    detail: 'The hidden rows are tied or effectively gated shut.',
    status: 'there is no clear usable hidden signal',
  },
}

export const BACKPROP_PRESETS: Record<PresetKey, { label: string; revealLabel: string; lr: number; model: Model }> = {
  normal: {
    label: 'Case A',
    revealLabel: 'baseline step',
    lr: 0.15,
    model: {
      x: [1, 2],
      y: 1,
      W1: [
        [0.2, -0.1],
        [0.4, 0.3],
        [-0.5, 0.2],
      ],
      b1: [0, 0, 0],
      W2: [0.3, -0.2, 0.1],
      b2: 0.05,
    },
  },
  large_lr: {
    label: 'Case B',
    revealLabel: 'large learning-rate step',
    lr: 2,
    model: {
      x: [1, 2],
      y: 1,
      W1: [
        [0.2, -0.1],
        [0.4, 0.3],
        [-0.5, 0.2],
      ],
      b1: [0, 0, 0],
      W2: [0.3, -0.2, 0.1],
      b2: 0.05,
    },
  },
  saturated: {
    label: 'Case C',
    revealLabel: 'saturated hidden gates',
    lr: 0.15,
    model: {
      x: [1.4, 1.6],
      y: 1,
      W1: [
        [2.8, 2.4],
        [-2.7, -2.2],
        [2.5, 2.3],
      ],
      b1: [0.4, -0.3, 0.2],
      W2: [0.3, -0.2, 0.1],
      b2: 0.05,
    },
  },
}

function dot2(w: [number, number], x: [number, number]) {
  return w[0] * x[0] + w[1] * x[1]
}

function forward(model: Model) {
  const z1 = model.W1.map((row, i) => dot2(row, model.x) + model.b1[i])
  const h1 = z1.map((z) => Math.tanh(z))
  const pred = model.W2.reduce((sum, w, i) => sum + w * h1[i], model.b2)
  const err = pred - model.y
  const loss = 0.5 * err * err
  return { z1, h1, pred, err, loss }
}

function backward(model: Model) {
  const fwd = forward(model)
  const delta2 = fwd.err
  const dW2 = fwd.h1.map((h) => delta2 * h)
  const db2 = delta2
  const dh1 = model.W2.map((w) => w * delta2)
  const delta1 = dh1.map((d, i) => d * (1 - fwd.h1[i] * fwd.h1[i]))
  const dW1 = delta1.map((d) => [d * model.x[0], d * model.x[1]] as [number, number])
  const db1 = delta1
  return { ...fwd, delta2, dW2, db2, dh1, delta1, dW1, db1 }
}

function updatedModel(model: Model, lr: number): Model {
  const bwd = backward(model)
  return {
    ...model,
    W1: model.W1.map((row, i) => [row[0] - lr * bwd.dW1[i][0], row[1] - lr * bwd.dW1[i][1]]),
    b1: model.b1.map((b, i) => b - lr * bwd.db1[i]),
    W2: model.W2.map((w, i) => w - lr * bwd.dW2[i]) as [number, number, number],
    b2: model.b2 - lr * bwd.db2,
  }
}

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtVec(values: number[]) {
  return `[${values.map(fmt).join(', ')}]`
}

function fmtShort(n: number) {
  const v = Math.abs(n) < 0.005 ? 0 : n
  return v.toFixed(2)
}

function fmtVecShort(values: number[]) {
  return `[${values.map(fmtShort).join(', ')}]`
}

function maxAbsLabeled(entries: Array<{ label: string; value: number }>) {
  return entries.reduce(
    (best, entry) => (Math.abs(entry.value) > Math.abs(best.value) ? entry : best),
    entries[0] ?? { label: 'none', value: 0 },
  )
}

export function classifyHiddenSignal({
  delta1,
  x,
}: {
  delta1: number[]
  x: [number, number]
}): HiddenSignalPrediction {
  const inputNorm = Math.hypot(x[0], x[1])
  const rowNorms = delta1.map((d) => Math.abs(d) * inputNorm)
  const ranked = rowNorms
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  const runnerUp = ranked[1]

  if (!top || top.score < VANISHING_ROW_NORM) return 'no-clear-signal'

  const relativeGap = runnerUp ? (top.score - runnerUp.score) / Math.max(top.score, 1e-12) : 1
  if (relativeGap < NEAR_TIE_RELATIVE_GAP) return 'no-clear-signal'

  if (top.index === 0) return 'h1'
  if (top.index === 1) return 'h2'
  return 'h3'
}

export function getHiddenSignalDiagnostics(model: Model) {
  const bwd = backward(model)
  const rawHiddenSignal = model.W2.map((w) => w * bwd.delta2)
  const tanhGates = bwd.h1.map((h) => 1 - h * h)
  const rowNorms = bwd.delta1.map((d) => Math.abs(d) * Math.hypot(model.x[0], model.x[1]))
  const actual = classifyHiddenSignal({ delta1: bwd.delta1, x: model.x })

  return { rawHiddenSignal, tanhGates, rowNorms, actual }
}

function NodeBox({
  x,
  y,
  title,
  shape,
  value,
  bar,
  active,
}: {
  x: number
  y: number
  title: string
  shape: string
  value: string
  bar?: string
  active?: boolean
}) {
  return (
    <g className={active ? 'node active' : 'node'} transform={`translate(${x} ${y})`}>
      <rect width="160" height="96" rx="14" />
      <text x="14" y="24" className="title">
        {title}
      </text>
      <text x="14" y="44" className="shape">
        {shape}
      </text>
      <text x="14" y="64" className="value">
        {value}
      </text>
      {bar ? (
        <text x="14" y="82" className="bar">
          {bar}
        </text>
      ) : null}
    </g>
  )
}

function Edge({ x1, y1, x2, y2, active }: { x1: number; y1: number; x2: number; y2: number; active?: boolean }) {
  return <path className={active ? 'edge active' : 'edge'} d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1}, ${(x1 + x2) / 2} ${y2}, ${x2} ${y2}`} />
}

export default function BackpropagationViz() {
  const [preset, setPreset] = useState<PresetKey>('normal')
  const [phase, setPhase] = useState<Phase>('forward')
  const [lr, setLr] = useState(BACKPROP_PRESETS.normal.lr)
  const [prediction, setPrediction] = useState<HiddenSignalPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const model = BACKPROP_PRESETS[preset].model
  const bwd = useMemo(() => backward(model), [model])
  const after = useMemo(() => forward(updatedModel(model, lr)), [model, lr])
  const lossDelta = after.loss - bwd.loss
  const effectTone = lossDelta < -1e-9 ? 'good' : lossDelta > 1e-9 ? 'bad' : 'neutral'
  const effectLabel =
    lossDelta < -1e-9 ? 'loss decreases' : lossDelta > 1e-9 ? 'loss increases' : 'loss unchanged'
  const hiddenSignal = useMemo(() => getHiddenSignalDiagnostics(model), [model])
  const maxHiddenDelta = Math.max(...bwd.delta1.map((d) => Math.abs(d)))
  const dominantGradient = maxAbsLabeled([
    ...bwd.dW2.map((value, i) => ({ label: `dW2[${i}]`, value })),
    ...bwd.dW1.flatMap((row, i) => row.map((value, j) => ({ label: `dW1[${i},${j}]`, value }))),
    { label: 'db2', value: bwd.db2 },
    ...bwd.db1.map((value, i) => ({ label: `db1[${i}]`, value })),
  ])
  const predictionCorrect = prediction === hiddenSignal.actual
  const learningSignal =
    !revealed || phase === 'forward'
      ? `prediction ${fmt(bwd.pred)} vs target ${fmt(model.y)} gives loss ${fmt(bwd.loss)}`
      : phase === 'backward'
        ? `delta2 ${fmt(bwd.delta2)} flows through tanh gates; max |delta1| ${fmt(maxHiddenDelta)}`
        : `eta ${fmt(lr)} changes loss before ${fmt(bwd.loss)} to loss after update ${fmt(after.loss)}; loss delta ${fmt(lossDelta)} (${effectLabel})`

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
    setPhase('forward')
    clearDemoState('backpropagation')
  }

  const resetPreset = (key: PresetKey) => {
    setPreset(key)
    setLr(BACKPROP_PRESETS[key].lr)
    resetReveal()
  }

  const isForward = phase === 'forward'
  const isBackward = revealed && phase === 'backward'
  const isUpdate = revealed && phase === 'update'

  useEffect(() => {
    clearDemoState('backpropagation')
    return () => clearDemoState('backpropagation')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction) {
      clearDemoState('backpropagation')
      return
    }

    emitDemoState({
      conceptId: 'backpropagation',
      label: 'Prediction-first hidden learning-signal reveal',
      summary:
        `Predicted ${prediction}; actual ${hiddenSignal.actual}; ` +
        `delta2=${fmt(bwd.delta2)}, delta1=${fmtVecShort(bwd.delta1)}, ` +
        `row norms=${fmtVecShort(hiddenSignal.rowNorms)}, ` +
        `loss ${fmt(bwd.loss)} -> ${fmt(after.loss)} (${effectLabel}).`,
      values: [
        `prediction: ${prediction}`,
        `actual hidden signal: ${hiddenSignal.actual}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `preset: ${BACKPROP_PRESETS[preset].label}`,
        `revealed preset: ${BACKPROP_PRESETS[preset].revealLabel}`,
        `phase: ${phase}`,
        `x: ${fmtVecShort(model.x)}`,
        `target: ${fmt(model.y)}`,
        `learning rate eta: ${fmt(lr)}`,
        `prediction yhat: ${fmt(bwd.pred)}`,
        `error / delta2: ${fmt(bwd.delta2)}`,
        `loss before: ${fmt(bwd.loss)}`,
        `loss after update: ${fmt(after.loss)}`,
        `loss delta: ${fmt(lossDelta)}`,
        `hidden activations h1: ${fmtVecShort(bwd.h1)}`,
        `tanh gates phi prime: ${fmtVecShort(hiddenSignal.tanhGates)}`,
        `raw hidden signal W2*delta2: ${fmtVecShort(hiddenSignal.rawHiddenSignal)}`,
        `hidden deltas delta1: ${fmtVecShort(bwd.delta1)}`,
        `first-layer row gradient norms: ${fmtVecShort(hiddenSignal.rowNorms)}`,
        `dominant gradient: ${dominantGradient.label}=${fmt(dominantGradient.value)}`,
        `update effect: ${effectLabel}`,
        `visible backward/update layer: revealed`,
      ],
    })
  }, [
    after.loss,
    bwd.delta1,
    bwd.delta2,
    bwd.h1,
    bwd.loss,
    bwd.pred,
    dominantGradient.label,
    dominantGradient.value,
    effectLabel,
    hiddenSignal,
    learningSignal,
    lossDelta,
    lr,
    model.y,
    model.x,
    phase,
    prediction,
    predictionCorrect,
    preset,
    revealed,
  ])

  return (
    <div className="wrap">
      <div className="controls">
        <label className="control">
          <span>Preset</span>
          <select value={preset} onChange={(e) => resetPreset(e.target.value as PresetKey)}>
            {Object.entries(BACKPROP_PRESETS).map(([key, spec]) => (
              <option key={key} value={key}>
                {spec.label}
              </option>
            ))}
          </select>
        </label>

        <label className="control lr">
          <span>Learning rate eta</span>
          <input
            aria-label="Learning rate eta"
            type="range"
            min="0"
            max="2"
            step="0.01"
            value={lr}
            onChange={(e) => {
              resetReveal()
              setLr(Number(e.target.value))
            }}
          />
          <strong>{fmt(lr)}</strong>
        </label>

        <div className="steps" aria-label="Demo phase">
          <button type="button" className={isForward ? 'selected' : ''} onClick={resetReveal}>
            Forward
          </button>
          <button type="button" className={isBackward ? 'selected' : ''} disabled={!revealed} onClick={() => setPhase('backward')}>
            {revealed ? 'Backward' : 'Backward locked'}
          </button>
          <button type="button" className={isUpdate ? 'selected' : ''} disabled={!revealed} onClick={() => setPhase('update')}>
            {revealed ? 'Update' : 'Update locked'}
          </button>
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>input x</span>
          <strong>{fmtVecShort(model.x)}</strong>
        </div>
        <div>
          <span>loss before</span>
          <strong>{fmt(bwd.loss)}</strong>
        </div>
        <div>
          <span>yhat vs target</span>
          <strong>{fmt(bwd.pred)} {'->'} {fmt(model.y)}</strong>
        </div>
        <div>
          <span>{revealed ? 'loss after update' : 'readout W2'}</span>
          <strong className={revealed ? effectTone : ''}>{revealed ? fmt(after.loss) : fmtVecShort(model.W2)}</strong>
        </div>
        <div>
          <span>{revealed ? 'update effect' : 'update result'}</span>
          <strong className={revealed ? effectTone : ''}>{revealed ? effectLabel : 'hidden until reveal'}</strong>
        </div>
      </div>

      <div className="learning-signal">
        <span>learning signal</span>
        <strong>{learningSignal}</strong>
        <em className={revealed ? effectTone : ''}>
          {revealed ? (phase === 'backward' ? `${dominantGradient.label}=${fmt(dominantGradient.value)}` : effectLabel) : 'predict first'}
        </em>
      </div>

      <section className="prediction-panel">
        <div className="prediction-copy">
          <span>prediction checkpoint</span>
          <strong>Which hidden unit gets the usable learning signal?</strong>
          <p>
            The forward pass has stored <span className="mono">h</span>, <span className="mono">yhat</span>, the target, and the readout weights. The output error will move backward through <span className="mono">W2</span>, then each tanh gate will scale it. Predict the strongest hidden signal before seeing deltas or gradients.
          </p>
        </div>

        <div className="choice-row" role="group" aria-label="Hidden learning-signal prediction">
          {(Object.keys(PREDICTION_COPY) as HiddenSignalPrediction[]).map((key) => (
            <button
              key={key}
              type="button"
              className={prediction === key ? 'selected' : ''}
              aria-pressed={prediction === key}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
                setPhase('forward')
                clearDemoState('backpropagation')
              }}
            >
              <strong>{PREDICTION_COPY[key].label}</strong>
              <span>{PREDICTION_COPY[key].detail}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="reveal"
          disabled={!prediction}
          onClick={() => {
            if (!prediction) return
            setRevealed(true)
            setPhase('backward')
          }}
        >
          Reveal hidden learning signal
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed && prediction ? (
          <>
            <h4>{predictionCorrect ? 'Correct.' : 'Not quite.'} {PREDICTION_COPY[hiddenSignal.actual].status}.</h4>
            <p>
              Prediction: {PREDICTION_COPY[prediction].label}. Actual: {PREDICTION_COPY[hiddenSignal.actual].label}. Backprop multiplies the output error by each readout weight, then the local tanh gate decides how much of that signal can reach the hidden row.
            </p>
            <div className="result-grid">
              <span>delta2</span>
              <strong>{fmt(bwd.delta2)}</strong>
              <span>tanh gates</span>
              <strong>{fmtVecShort(hiddenSignal.tanhGates)}</strong>
              <span>delta1</span>
              <strong>{fmtVecShort(bwd.delta1)}</strong>
              <span>row norms</span>
              <strong>{fmtVecShort(hiddenSignal.rowNorms)}</strong>
              <span>loss after</span>
              <strong>{fmt(after.loss)}</strong>
              <span>effect</span>
              <strong>{effectLabel}</strong>
            </div>
          </>
        ) : (
          <p>{prediction ? 'Reveal the backward pass to test your hidden-signal prediction.' : 'Choose a hidden unit or no clear usable signal to unlock deltas, gates, row norms, and update outcome.'}</p>
        )}
      </section>

      <div className="mobile-flow" aria-label="Backpropagation computation flow">
        <div className={isForward ? 'mobile-step active' : 'mobile-step'}>
          <span>Forward pass</span>
          <strong>{'x -> z1 -> h1 -> yhat -> J'}</strong>
          <p>
            h={fmtVecShort(bwd.h1)}, yhat={fmt(bwd.pred)}, J={fmt(bwd.loss)}
          </p>
        </div>
        <div className={isBackward ? 'mobile-step active' : 'mobile-step'}>
          <span>Reverse pass</span>
          <strong>{revealed ? 'bar J -> bar yhat -> bar z1' : 'backward signal hidden'}</strong>
          <p>{revealed ? `bar yhat=${fmt(bwd.delta2)}, bar z1=${fmtVecShort(bwd.delta1)}` : 'Reveal after predicting the strongest hidden learning signal.'}</p>
        </div>
        <div className={isBackward ? 'mobile-step active' : 'mobile-step'}>
          <span>Parameter gradients</span>
          <strong>{revealed ? 'local VJPs become gradients' : 'gradient rows hidden'}</strong>
          <p>{revealed ? `row norms=${fmtVecShort(hiddenSignal.rowNorms)}` : 'First-layer row-gradient norms unlock after reveal.'}</p>
        </div>
        <div className={isUpdate ? 'mobile-step active' : 'mobile-step'}>
          <span>Optimizer step</span>
          <strong>{revealed ? 'theta <- theta - eta grad' : 'update result hidden'}</strong>
          <p>{revealed ? `eta=${fmt(lr)}, Delta J=${fmt(lossDelta)}` : 'Update result hidden until reveal.'}</p>
        </div>
      </div>

      <svg viewBox="0 0 810 410" role="img" aria-label="Backpropagation computation graph demo">
        <defs>
          <marker id="bp-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        <Edge x1={170} y1={98} x2={220} y2={98} active={isForward} />
        <Edge x1={380} y1={98} x2={430} y2={98} active={isForward} />
        <Edge x1={590} y1={98} x2={640} y2={98} active={isForward} />

        <Edge x1={640} y1={98} x2={590} y2={98} active={isBackward} />
        <Edge x1={510} y1={146} x2={510} y2={198} active={isBackward} />
        <Edge x1={430} y1={246} x2={380} y2={246} active={isBackward} />
        <Edge x1={220} y1={246} x2={170} y2={246} active={isBackward} />

        <NodeBox x={10} y={50} title="x" shape="(2, 1)" value={fmtVec(model.x)} active={isForward} />
        <NodeBox x={220} y={50} title="z1 -> h1" shape="z1,h1 in R^3" value={`h=${fmtVecShort(bwd.h1)}`} bar={revealed ? `bar z1=${fmtVecShort(bwd.delta1)}` : 'hidden signal'} active={isForward || isBackward} />
        <NodeBox x={430} y={50} title="yhat" shape="(1, 1)" value={fmt(bwd.pred)} bar={revealed ? `bar yhat=${fmt(bwd.delta2)}` : 'hidden signal'} active={isForward || isBackward} />
        <NodeBox x={640} y={50} title="J" shape="scalar" value={fmt(bwd.loss)} bar={revealed ? 'bar J=1' : 'backward seed hidden'} active={isForward || isBackward} />

        <NodeBox x={10} y={198} title="W1, b1" shape="3 hidden units" value="uses x row-wise" bar={revealed ? 'bar W1=bar z1 x^T' : 'gradient rows hidden'} active={isBackward || isUpdate} />
        <NodeBox x={220} y={198} title="tanh local rule" shape="diag phi'(z1)" value={revealed ? `phi'=${fmtVecShort(hiddenSignal.tanhGates)}` : 'gate values hidden'} active={isBackward} />
        <NodeBox x={430} y={198} title="W2, b2" shape="linear readout" value={`W2=${fmtVecShort(model.W2)}`} bar={revealed ? 'bar W2=bar yhat h^T' : 'readout visible, gradient hidden'} active={isBackward || isUpdate} />
        <NodeBox x={640} y={198} title="update" shape="gradient step" value={`eta=${fmt(lr)}`} bar={revealed ? `Delta J=${fmt(lossDelta)}` : 'update result hidden'} active={isUpdate} />
      </svg>

      <p className="claim">
        {!revealed
          ? 'Forward stores values on the graph: z1, h1, yhat, and the scalar loss J. Commit to the hidden learning-signal path before showing the backward values.'
          : isBackward
            ? 'Backward moves cotangents right to left: local VJPs produce delta1, dW1, dW2, and db terms.'
            : isUpdate
              ? 'The optimizer step uses those gradients; the same correct gradient can still be too large after it is scaled by eta.'
              : 'Forward mode has been reset; make a fresh hidden-signal prediction before reading backward values.'}
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls {
          display: grid;
          grid-template-columns: minmax(150px, 0.8fr) minmax(230px, 1.4fr) auto;
          gap: 0.75rem;
          align-items: end;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.76);
        }

        .control {
          display: grid;
          gap: 0.35rem;
          font-size: 0.78rem;
          color: #4a5865;
        }

        .control select,
        .control input {
          width: 100%;
        }

        .lr {
          grid-template-columns: 1fr auto;
          column-gap: 0.6rem;
        }

        .lr span,
        .lr input {
          grid-column: 1 / -1;
        }

        .steps {
          display: inline-flex;
          gap: 0.35rem;
        }

        button {
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 999px;
          background: #fffaf0;
          color: #1b2430;
          min-height: 34px;
          padding: 0 0.7rem;
          font-size: 0.82rem;
          cursor: pointer;
        }

        button.selected {
          border-color: rgba(31, 75, 153, 0.35);
          background: #eaf2ff;
          color: #1f4b99;
        }

        button:disabled {
          color: #8a96a3;
          cursor: not-allowed;
          opacity: 0.72;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
          gap: 0.6rem;
        }

        .metrics div {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 14px;
          padding: 0.7rem;
          background: rgba(255, 255, 255, 0.62);
        }

        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.75rem;
          margin-bottom: 0.2rem;
        }

        .metrics strong {
          color: #1b2430;
          font-family: var(--font-mono);
        }

        .metrics .good {
          color: #1b7f56;
        }

        .metrics .bad {
          color: #b54735;
        }

        .metrics .neutral {
          color: #65717d;
        }

        .learning-signal {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.65rem;
          align-items: center;
          border: 1px solid rgba(31, 75, 153, 0.16);
          border-radius: 14px;
          background: rgba(234, 242, 255, 0.7);
          color: #334150;
          padding: 0.68rem 0.75rem;
        }

        .learning-signal span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .learning-signal strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .learning-signal em {
          font-size: 0.78rem;
          font-style: normal;
          white-space: nowrap;
        }

        .learning-signal .good {
          color: #1b7f56;
        }

        .learning-signal .bad {
          color: #b54735;
        }

        .learning-signal .neutral {
          color: #65717d;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .prediction-panel,
        .result {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.62);
          padding: 0.8rem;
        }

        .prediction-panel {
          display: grid;
          gap: 0.7rem;
        }

        .prediction-copy {
          display: grid;
          gap: 0.28rem;
        }

        .prediction-copy span,
        .result span {
          color: #65717d;
          font-size: 0.74rem;
          text-transform: uppercase;
        }

        .prediction-copy strong,
        .result h4 {
          color: #1b2430;
          font-size: 1rem;
          margin: 0;
        }

        .prediction-copy p,
        .result p {
          color: #4a5865;
          font-size: 0.9rem;
          line-height: 1.5;
          margin: 0;
        }

        .choice-row {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }

        .choice-row button {
          align-content: start;
          display: grid;
          gap: 0.25rem;
          min-height: 90px;
          padding: 0.65rem;
          text-align: left;
          white-space: normal;
        }

        .choice-row button strong {
          color: #1b2430;
          font-size: 0.86rem;
        }

        .choice-row button span {
          color: #65717d;
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .choice-row button.selected {
          border-color: rgba(31, 75, 153, 0.4);
          box-shadow: 0 0 0 1px rgba(31, 75, 153, 0.14);
        }

        .reveal {
          border-color: rgba(31, 75, 153, 0.3);
          background: #eaf2ff;
          color: #1f4b99;
          font-weight: 700;
          min-height: 40px;
          width: 100%;
        }

        .result {
          min-height: 62px;
        }

        .result.shown {
          border-color: rgba(31, 75, 153, 0.2);
        }

        .result-grid {
          display: grid;
          gap: 0.45rem 0.7rem;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          margin-top: 0.7rem;
        }

        .result-grid strong {
          color: #1b2430;
          font-family: var(--font-mono);
          font-size: 0.86rem;
          overflow-wrap: anywhere;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 18px;
          background: linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(245, 249, 255, 0.78));
        }

        .mobile-flow {
          display: none;
        }

        :global(.node rect) {
          fill: rgba(255, 255, 255, 0.82);
          stroke: rgba(27, 36, 48, 0.12);
          stroke-width: 1.2;
        }

        :global(.node.active rect) {
          fill: #fff6dc;
          stroke: rgba(221, 132, 54, 0.55);
        }

        :global(.title) {
          font-weight: 700;
          fill: #1b2430;
          font-size: 14px;
        }

        :global(.shape) {
          fill: #65717d;
          font-size: 11px;
          font-family: var(--font-mono);
        }

        :global(.value),
        :global(.bar) {
          fill: #263545;
          font-size: 10px;
          font-family: var(--font-mono);
        }

        :global(.bar) {
          fill: #1f4b99;
        }

        :global(.edge) {
          fill: none;
          stroke: rgba(101, 113, 125, 0.32);
          stroke-width: 2;
          marker-end: url(#bp-arrow);
        }

        :global(.edge.active) {
          stroke: rgba(31, 75, 153, 0.75);
          stroke-width: 3;
        }

        :global(marker path) {
          fill: rgba(31, 75, 153, 0.75);
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 760px) {
          .controls {
            grid-template-columns: 1fr;
          }

          .steps {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
          }

          .metrics {
            grid-template-columns: 1fr;
          }

          .learning-signal {
            grid-template-columns: 1fr;
          }

          .choice-row,
          .result-grid {
            grid-template-columns: 1fr;
          }

          svg {
            display: none;
          }

          .mobile-flow {
            display: grid;
            gap: 0.6rem;
          }

          .mobile-step {
            padding: 0.75rem;
            border-radius: 14px;
            border: 1px solid rgba(27, 36, 48, 0.1);
            background: rgba(255, 255, 255, 0.68);
          }

          .mobile-step.active {
            border-color: rgba(221, 132, 54, 0.5);
            background: #fff6dc;
          }

          .mobile-step span {
            display: block;
            margin-bottom: 0.25rem;
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            letter-spacing: 0;
            text-transform: uppercase;
          }

          .mobile-step strong {
            display: block;
            color: #1b2430;
            line-height: 1.3;
          }

          .mobile-step p {
            margin: 0.35rem 0 0;
            color: #4a5865;
            font-family: var(--font-mono);
            font-size: 0.72rem;
            line-height: 1.45;
            overflow-wrap: anywhere;
          }
        }
      `}</style>
    </div>
  )
}
