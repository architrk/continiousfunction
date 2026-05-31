import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../../../../lib/demoState'

type PresetKey = 'crawl' | 'stable' | 'diverge'
type Outcome = 'slow' | 'stable' | 'unstable'

const PRESETS: Record<PresetKey, { label: string; lr: number; curvature: number }> = {
  crawl: { label: 'crawl', lr: 0.005, curvature: 20 },
  stable: { label: 'zig-zag stable', lr: 0.08, curvature: 20 },
  diverge: { label: 'too large', lr: 0.12, curvature: 20 },
}

const PREDICTIONS: Array<{ value: Outcome; label: string; note: string }> = [
  { value: 'slow', label: 'Crawl', note: 'Small eta barely changes the point.' },
  { value: 'stable', label: 'Contract', note: 'The path zig-zags but shrinks.' },
  { value: 'unstable', label: 'Escape', note: 'The steep axis amplifies.' },
]

const START = { x: 4.4, y: 2.6 }
const STEPS = 18
const RANGE = 5.5
const PLOT = {
  x: 36,
  y: 28,
  w: 560,
  h: 360,
}

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtShort(n: number) {
  const v = Math.abs(n) < 0.005 ? 0 : n
  return v.toFixed(2)
}

function outcomeLabel(effect: Outcome) {
  if (effect === 'unstable') return 'step too large'
  if (effect === 'slow') return 'safe but slow'
  return 'stable descent'
}

function loss(point: { x: number; y: number }, curvature: number) {
  return 0.5 * (point.x * point.x + curvature * point.y * point.y)
}

function grad(point: { x: number; y: number }, curvature: number) {
  return { x: point.x, y: curvature * point.y }
}

function toScreen(point: { x: number; y: number }) {
  return {
    x: PLOT.x + ((point.x + RANGE) / (2 * RANGE)) * PLOT.w,
    y: PLOT.y + ((RANGE - point.y) / (2 * RANGE)) * PLOT.h,
  }
}

function clampPoint(point: { x: number; y: number }) {
  return {
    x: Math.max(-RANGE, Math.min(RANGE, point.x)),
    y: Math.max(-RANGE, Math.min(RANGE, point.y)),
  }
}

function simulate(lr: number, curvature: number) {
  const points = [START]
  let point = START
  let clipped = false

  for (let i = 0; i < STEPS; i++) {
    const g = grad(point, curvature)
    point = { x: point.x - lr * g.x, y: point.y - lr * g.y }
    if (Math.abs(point.x) > RANGE || Math.abs(point.y) > RANGE) clipped = true
    points.push(point)
  }

  return { points, clipped }
}

function pathFor(points: Array<{ x: number; y: number }>) {
  return points
    .map(clampPoint)
    .map(toScreen)
    .map((point) => `${fmtShort(point.x)},${fmtShort(point.y)}`)
    .join(' ')
}

export default function GradientDescentViz() {
  const [lr, setLr] = useState(PRESETS.stable.lr)
  const [curvature, setCurvature] = useState(PRESETS.stable.curvature)
  const [prediction, setPrediction] = useState<Outcome | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [playing, setPlaying] = useState(false)

  const data = useMemo(() => {
    const sim = simulate(lr, curvature)
    const startLoss = loss(START, curvature)
    const finalLoss = loss(sim.points[sim.points.length - 1], curvature)
    const lambdaMax = Math.max(1, curvature)
    const stableBound = 2 / lambdaMax
    const firstGrad = grad(START, curvature)
    const firstStep = { x: START.x - lr * firstGrad.x, y: START.y - lr * firstGrad.y }
    const firstLoss = loss(firstStep, curvature)
    const firstLossDelta = firstLoss - startLoss
    const stableMargin = stableBound - lr
    const spectralRadius = Math.max(Math.abs(1 - lr), Math.abs(1 - lr * curvature))
    const highCurvatureFactor = 1 - lr * curvature
    const effect: Outcome = lr >= stableBound ? 'unstable' : lr < stableBound * 0.22 ? 'slow' : 'stable'
    return {
      ...sim,
      startLoss,
      finalLoss,
      lambdaMax,
      stableBound,
      stableMargin,
      spectralRadius,
      highCurvatureFactor,
      firstGrad,
      firstStep,
      firstLoss,
      firstLossDelta,
      effect,
    }
  }, [lr, curvature])

  const resetTrace = () => {
    setPrediction(null)
    setRevealed(false)
    setStepIndex(0)
    setPlaying(false)
  }

  const applyPreset = (key: PresetKey) => {
    resetTrace()
    setLr(PRESETS[key].lr)
    setCurvature(PRESETS[key].curvature)
  }

  const updateLr = (value: number) => {
    resetTrace()
    setLr(value)
  }

  const updateCurvature = (value: number) => {
    resetTrace()
    setCurvature(value)
  }

  useEffect(() => {
    if (!revealed || !playing) return

    const timer = window.setInterval(() => {
      setStepIndex((current) => {
        if (current >= STEPS) {
          setPlaying(false)
          return STEPS
        }
        return current + 1
      })
    }, 360)

    return () => window.clearInterval(timer)
  }, [playing, revealed])

  const activeStep = revealed ? stepIndex : Math.min(1, data.points.length - 1)
  const visiblePoints = revealed ? data.points.slice(0, Math.max(1, activeStep) + 1) : data.points.slice(0, 2)
  const path = pathFor(visiblePoints)
  const startScreen = toScreen(START)
  const firstStepScreen = toScreen(clampPoint(data.firstStep))
  const activePoint = data.points[activeStep] ?? START
  const activeScreen = toScreen(clampPoint(activePoint))
  const activeLoss = loss(activePoint, curvature)
  const finalScreen = toScreen(clampPoint(data.points[data.points.length - 1]))
  const statusText = outcomeLabel(data.effect)
  const predictionCorrect = prediction === data.effect
  const motionText =
    data.effect === 'unstable'
      ? 'The high-curvature coordinate grows in magnitude because |1 - eta lambda_max| is at least 1.'
      : data.effect === 'slow'
        ? 'The local step is safe, but the flat direction contracts so slowly that visible progress is tiny.'
        : 'The high-curvature coordinate flips sign while its magnitude contracts, so the path zig-zags inward.'
  const revealedOutcome = data.clipped ? 'escapes the plot' : `reaches loss ${fmt(data.finalLoss)}`

  useEffect(() => {
    emitDemoState({
      conceptId: 'gradient-descent',
      label: 'Prediction-first quadratic descent explorer',
      summary: revealed
        ? `Learner predicted ${prediction ?? 'none'}; learning rate ${fmt(lr)} with curvature ${fmtShort(curvature)} is ${statusText}; after ${STEPS} steps the path ${revealedOutcome}; animated trace is at step ${activeStep}.`
        : `Learner is predicting whether eta ${fmt(lr)} with curvature ${fmtShort(curvature)} will crawl, contract, or escape before revealing the full trace.`,
      values: [
        `prediction: ${prediction ?? 'none'}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `effect: ${data.effect} (${statusText})`,
        `learning rate eta: ${fmt(lr)}`,
        `curvature lambda max: ${fmtShort(curvature)}`,
        `stable bound eta < ${fmt(data.stableBound)}`,
        `stable margin: ${fmt(data.stableMargin)}`,
        `spectral radius max |1 - eta lambda_i|: ${fmt(data.spectralRadius)}`,
        `high-curvature factor 1 - eta lambda max: ${fmt(data.highCurvatureFactor)}`,
        `start loss: ${fmt(data.startLoss)}`,
        `first loss: ${fmt(data.firstLoss)}`,
        `first loss delta: ${fmt(data.firstLossDelta)}`,
        `current trace step: ${activeStep}/${STEPS}`,
        `current trace loss: ${fmt(activeLoss)}`,
        `final loss after ${STEPS}: ${data.clipped ? 'escaped plot' : fmt(data.finalLoss)}`,
        `first gradient: [${fmt(data.firstGrad.x)}, ${fmt(data.firstGrad.y)}]`,
        `first update: [${fmt(data.firstStep.x)}, ${fmt(data.firstStep.y)}]`,
      ],
    })
  }, [
    activeLoss,
    activeStep,
    curvature,
    data.clipped,
    data.effect,
    data.finalLoss,
    data.firstGrad.x,
    data.firstGrad.y,
    data.firstLoss,
    data.firstLossDelta,
    data.firstStep.x,
    data.firstStep.y,
    data.highCurvatureFactor,
    data.spectralRadius,
    data.stableBound,
    data.stableMargin,
    data.startLoss,
    lr,
    prediction,
    revealed,
    revealedOutcome,
    statusText,
  ])

  return (
    <div className="wrap">
      <div className="controls">
        <label>
          <span>learning rate</span>
          <input type="range" min="0.005" max="0.28" step="0.005" value={lr} onChange={(event) => updateLr(Number(event.target.value))} />
          <strong>{fmt(lr)}</strong>
        </label>
        <label>
          <span>curvature</span>
          <input type="range" min="2" max="24" step="1" value={curvature} onChange={(event) => updateCurvature(Number(event.target.value))} />
          <strong>{fmtShort(curvature)}</strong>
        </label>
        <div className="buttons" aria-label="Gradient descent presets">
          {Object.entries(PRESETS).map(([key, preset]) => (
            <button
              type="button"
              key={key}
              aria-pressed={lr === preset.lr && curvature === preset.curvature}
              onClick={() => applyPreset(key as PresetKey)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      <div className="metrics">
        <div>
          <span>loss before</span>
          <strong>{fmt(data.startLoss)}</strong>
        </div>
        <div>
          <span>loss after 18 steps</span>
          <strong className={data.effect === 'unstable' ? 'bad' : 'good'}>{revealed ? (data.clipped ? 'escaped' : fmt(data.finalLoss)) : 'hidden'}</strong>
        </div>
        <div>
          <span>stable bound</span>
          <strong>eta &lt; {fmt(data.stableBound)}</strong>
        </div>
        <div>
          <span>diagnosis</span>
          <strong className={revealed ? (data.effect === 'unstable' ? 'bad' : data.effect === 'slow' ? 'slow' : 'good') : ''}>{revealed ? statusText : 'predict first'}</strong>
        </div>
      </div>

      <section className="prediction-panel">
        <div className="prediction-copy">
          <span>prediction checkpoint</span>
          <strong>Before the full trace, what will the update do?</strong>
          <p>
            Compare eta with the stability bound, then commit. The reveal animates the repeated local
            update instead of showing the destination immediately.
          </p>
        </div>
        <div className="choice-row" role="group" aria-label="Gradient descent outcome prediction">
          {PREDICTIONS.map((choice) => (
            <button
              key={choice.value}
              type="button"
              aria-pressed={prediction === choice.value}
              className={prediction === choice.value ? 'selected' : ''}
              onClick={() => {
                setPrediction(choice.value)
                setRevealed(false)
                setStepIndex(0)
                setPlaying(false)
              }}
            >
              <strong>{choice.label}</strong>
              <span>{choice.note}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="reveal"
          disabled={!prediction}
          onClick={() => {
            setRevealed(true)
            setStepIndex(0)
            setPlaying(true)
          }}
        >
          Reveal trace
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed ? (
          <>
            <h4>{predictionCorrect ? 'Prediction matches.' : 'The curvature test is now visible.'}</h4>
            <p>
              {statusText}: eta {fmt(lr)} gives high-axis factor {fmt(data.highCurvatureFactor)} and
              spectral radius {fmt(data.spectralRadius)}. After {STEPS} steps the path {revealedOutcome}.
            </p>
          </>
        ) : (
          <p>{prediction ? 'Reveal the trace to compare your prediction with the repeated updates.' : 'Choose crawl, contract, or escape to unlock the animated trace.'}</p>
        )}
      </section>

      <div className="stage">
        <div className="visual">
          <svg viewBox="0 0 632 416" role="img" aria-label="Gradient descent path on a stretched quadratic bowl">
            <defs>
              <marker id="gd-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" />
              </marker>
            </defs>
            <rect x={PLOT.x} y={PLOT.y} width={PLOT.w} height={PLOT.h} rx="8" className="plot-bg" />
            {[6, 14, 28, 50, 78].map((level) => {
              const rx = Math.sqrt(2 * level)
              const ry = Math.sqrt((2 * level) / curvature)
              return (
                <ellipse
                  key={level}
                  cx={toScreen({ x: 0, y: 0 }).x}
                  cy={toScreen({ x: 0, y: 0 }).y}
                  rx={(rx / (2 * RANGE)) * PLOT.w}
                  ry={(ry / (2 * RANGE)) * PLOT.h}
                  className="contour"
                />
              )
            })}
            <line x1={PLOT.x} y1={toScreen({ x: 0, y: 0 }).y} x2={PLOT.x + PLOT.w} y2={toScreen({ x: 0, y: 0 }).y} className="axis" />
            <line x1={toScreen({ x: 0, y: 0 }).x} y1={PLOT.y} x2={toScreen({ x: 0, y: 0 }).x} y2={PLOT.y + PLOT.h} className="axis" />
            {revealed ? <polyline points={pathFor(data.points)} className="path ghost" /> : null}
            <polyline points={path} className={data.effect === 'unstable' ? 'path unstable' : 'path'} />
            <line x1={startScreen.x} y1={startScreen.y} x2={firstStepScreen.x} y2={firstStepScreen.y} className="first-step" />
            {visiblePoints.slice(0, 12).map((point, index) => {
              const screen = toScreen(clampPoint(point))
              return <circle key={index} cx={screen.x} cy={screen.y} r={index === 0 ? 5 : 3.5} className={index === 0 ? 'dot start' : 'dot'} />
            })}
            <circle cx={activeScreen.x} cy={activeScreen.y} r="6.5" className={data.effect === 'unstable' && revealed ? 'dot active bad' : 'dot active'} />
            {revealed && stepIndex >= STEPS ? <circle cx={finalScreen.x} cy={finalScreen.y} r="5" className={data.effect === 'unstable' ? 'dot final bad' : 'dot final'} /> : null}
            <text x={startScreen.x + 8} y={startScreen.y - 8} className="label">
              start
            </text>
            {revealed && stepIndex >= STEPS ? (
              <text x={finalScreen.x + 8} y={finalScreen.y + 16} className="label">
                {data.clipped ? 'escaped plot' : 'after 18'}
              </text>
            ) : null}
            <text x={activeScreen.x + 8} y={activeScreen.y + 18} className="label active-label">
              step {activeStep}
            </text>
          </svg>

          <div className="trace-controls">
            <button type="button" disabled={!revealed} onClick={() => setPlaying((current) => !current)}>
              {playing ? 'Pause trace' : 'Run trace'}
            </button>
            <label className="scrubber">
              <span>step</span>
              <input
                type="range"
                min="0"
                max={STEPS}
                step="1"
                value={activeStep}
                disabled={!revealed}
                onChange={(event) => {
                  setPlaying(false)
                  setStepIndex(Number(event.target.value))
                }}
              />
              <strong>{activeStep}/{STEPS}</strong>
            </label>
            <div className="progress" aria-hidden="true">
              <i style={{ width: `${Math.max(4, (activeStep / STEPS) * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="readout">
          <div>
            <span>first gradient</span>
            <strong>[{fmt(data.firstGrad.x)}, {fmt(data.firstGrad.y)}]</strong>
            <p>The steep direction is dominated by the high-curvature axis.</p>
          </div>
          <div>
            <span>first update</span>
            <strong>[{fmt(data.firstStep.x)}, {fmt(data.firstStep.y)}]</strong>
            <p>The arrow shows theta_1 = theta_0 - eta grad. A larger eta trusts this local slope farther.</p>
          </div>
          <div>
            <span>curvature test</span>
            <strong>{fmt(lr)} {lr < data.stableBound ? '<' : '>='} {fmt(data.stableBound)}</strong>
            <p>For this quadratic, fixed-step descent is stable only below the bound.</p>
          </div>
          <div>
            <span>animated trace</span>
            <strong>{revealed ? `step ${activeStep}: loss ${fmt(activeLoss)}` : 'locked until reveal'}</strong>
            <p>{revealed ? motionText : 'The first arrow is visible. Commit to the long-run behavior before exposing the repeated updates.'}</p>
          </div>
        </div>
      </div>

      <p className="claim">
        Gradient descent is local: the gradient gives a direction, while the learning rate decides how far to trust that direction before measuring again.
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(170px, 1fr)) auto;
          gap: 0.75rem;
          align-items: end;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.78);
        }

        label {
          display: grid;
          grid-template-columns: auto 1fr auto;
          gap: 0.5rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.78rem;
        }

        input {
          width: 100%;
        }

        label strong {
          min-width: 4.5rem;
          color: #1b2430;
          font-family: var(--font-mono);
          text-align: right;
        }

        .buttons {
          display: inline-flex;
          gap: 0.35rem;
        }

        button {
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #fffaf0;
          color: #1b2430;
          min-height: 34px;
          padding: 0 0.68rem;
          font-size: 0.82rem;
          cursor: pointer;
          white-space: nowrap;
        }

        button[aria-pressed='true'],
        button.selected {
          border-color: rgba(31, 111, 120, 0.42);
          background: #eef8f5;
          box-shadow: 0 0 0 2px rgba(31, 111, 120, 0.1);
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

        .metrics .good {
          color: #1f6f78;
        }

        .metrics .slow {
          color: #8b5e34;
        }

        .metrics .bad {
          color: #b33a2f;
        }

        .prediction-panel {
          display: grid;
          grid-template-columns: minmax(210px, 0.9fr) minmax(260px, 1.3fr) auto;
          gap: 0.75rem;
          align-items: stretch;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(255, 255, 255, 0.82), rgba(238, 248, 245, 0.72));
        }

        .prediction-copy {
          min-width: 0;
        }

        .prediction-copy span,
        .result h4 {
          color: #1f6f78;
          font-size: 0.74rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .prediction-copy strong {
          display: block;
          margin-top: 0.22rem;
          color: #1b2430;
          font-size: 0.94rem;
          line-height: 1.3;
        }

        .prediction-copy p,
        .result p {
          margin: 0.38rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .choice-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .choice-row button {
          display: grid;
          gap: 0.18rem;
          min-height: 68px;
          align-content: center;
          text-align: left;
          white-space: normal;
        }

        .choice-row strong {
          color: #1b2430;
          font-size: 0.86rem;
        }

        .choice-row span {
          color: #65717d;
          font-size: 0.72rem;
          line-height: 1.25;
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
          grid-template-columns: minmax(0, 1fr) minmax(230px, 0.35fr);
          gap: 0.75rem;
        }

        .visual {
          display: grid;
          gap: 0.55rem;
          min-width: 0;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(247, 250, 246, 0.94), rgba(245, 249, 255, 0.82));
        }

        .plot-bg {
          fill: rgba(255, 255, 255, 0.64);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .contour {
          fill: none;
          stroke: rgba(31, 111, 120, 0.22);
          stroke-width: 1.6;
        }

        .axis {
          stroke: rgba(27, 36, 48, 0.14);
          stroke-width: 1;
        }

        .path {
          fill: none;
          stroke: #1f4b99;
          stroke-width: 3;
          stroke-linejoin: round;
          stroke-linecap: round;
        }

        .path.ghost {
          stroke: rgba(74, 88, 101, 0.22);
          stroke-width: 2;
          stroke-dasharray: 5 7;
        }

        .path.unstable {
          stroke: #b33a2f;
        }

        .first-step {
          stroke: #8b5e34;
          stroke-width: 2.5;
          marker-end: url(#gd-arrow);
        }

        :global(#gd-arrow path) {
          fill: #8b5e34;
        }

        .dot {
          fill: #1f4b99;
          stroke: white;
          stroke-width: 1.5;
        }

        .dot.start {
          fill: #1b2430;
        }

        .dot.final {
          fill: #1f6f78;
        }

        .dot.active {
          fill: #d17a22;
          stroke: white;
          stroke-width: 2.2;
        }

        .dot.bad {
          fill: #b33a2f;
        }

        .label {
          fill: #4a5865;
          font-family: var(--font-mono);
          font-size: 11px;
          paint-order: stroke;
          stroke: rgba(255, 255, 255, 0.82);
          stroke-width: 4px;
        }

        .active-label {
          fill: #1b2430;
        }

        .trace-controls {
          display: grid;
          grid-template-columns: auto minmax(190px, 1fr);
          gap: 0.5rem 0.65rem;
          align-items: center;
          padding: 0.65rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .scrubber {
          grid-template-columns: auto minmax(120px, 1fr) 4.8rem;
        }

        .progress {
          grid-column: 1 / -1;
          height: 7px;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.1);
        }

        .progress i {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #1f6f78, #d17a22);
          transition: width 180ms ease;
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
          .prediction-panel,
          .stage {
            grid-template-columns: 1fr;
          }

          label {
            grid-template-columns: 6.5rem 1fr 4.5rem;
          }

          .buttons {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .metrics {
            grid-template-columns: 1fr;
          }

          .choice-row,
          .trace-controls {
            grid-template-columns: 1fr;
          }

          label {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }

          .buttons {
            grid-template-columns: 1fr;
          }

          .progress {
            grid-column: auto;
          }
        }
      `}</style>
    </div>
  )
}
