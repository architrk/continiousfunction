import { useEffect, useMemo, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type Phase = 'forward' | 'backward'
export type AccumulatorPrediction = 'lower' | 'nearly-equal' | 'higher'

const RELATION_TOLERANCE = 0.12

const PREDICTION_COPY: Record<AccumulatorPrediction, { label: string; detail: string; status: string }> = {
  lower: {
    label: 'Lower than direct',
    detail: 'The sine path subtracts from the direct path.',
    status: 'lower than direct',
  },
  'nearly-equal': {
    label: 'Nearly equal to direct',
    detail: 'The sine path contributes almost nothing.',
    status: 'nearly equal to direct',
  },
  higher: {
    label: 'Higher than direct',
    detail: 'The sine path reinforces the direct path.',
    status: 'higher than direct',
  },
}

export function classifyAccumulatorRelation(viaB: number): AccumulatorPrediction {
  if (viaB < -RELATION_TOLERANCE) return 'lower'
  if (viaB > RELATION_TOLERANCE) return 'higher'
  return 'nearly-equal'
}

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function NodeBox({
  x,
  y,
  title,
  formula,
  value,
  sensitivity,
  active,
}: {
  x: number
  y: number
  title: string
  formula: string
  value: string
  sensitivity: string
  active?: boolean
}) {
  return (
    <g className={active ? 'node active' : 'node'} transform={`translate(${x} ${y})`}>
      <rect width="150" height="92" rx="8" />
      <text x="14" y="24" className="title">
        {title}
      </text>
      <text x="14" y="43" className="formula">
        {formula}
      </text>
      <text x="14" y="62" className="value">
        {value}
      </text>
      <text x="14" y="80" className="bar">
        {sensitivity}
      </text>
    </g>
  )
}

function Edge({
  x1,
  y1,
  x2,
  y2,
  active,
  label,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  active?: boolean
  label?: string
}) {
  const midX = (x1 + x2) / 2
  const midY = (y1 + y2) / 2
  return (
    <g className={active ? 'edge active' : 'edge'}>
      <path d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`} />
      {active && label ? (
        <text x={midX} y={midY - 6} className="edge-label">
          {label}
        </text>
      ) : null}
    </g>
  )
}

export default function ComputationGraphsViz() {
  const [x, setX] = useState(2)
  const [y, setY] = useState(3)
  const [phase, setPhase] = useState<Phase>('forward')
  const [prediction, setPrediction] = useState<AccumulatorPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
    setPhase('forward')
    clearDemoState('computation-graphs')
  }

  const values = useMemo(() => {
    const a = x * y
    const b = Math.sin(a)
    const c = a + b
    const cosA = Math.cos(a)
    const directToA = 1
    const viaB = cosA
    const barA = directToA + viaB
    const barX = barA * y
    const barY = barA * x
    return { a, b, c, cosA, directToA, viaB, barA, barX, barY }
  }, [x, y])

  const isForward = phase === 'forward'
  const isBackward = revealed && phase === 'backward'
  const actualRelation = classifyAccumulatorRelation(values.viaB)
  const predictionCorrect = prediction === actualRelation
  const accumulationStatus =
    Math.abs(values.barA) < 0.1
      ? 'near cancellation'
      : actualRelation === 'higher'
        ? 'paths reinforce'
        : actualRelation === 'lower'
          ? 'paths partially cancel'
          : 'mostly direct'

  const setReuseExample = () => {
    resetReveal()
    setX(2)
    setY(3)
  }

  const setCancellationExample = () => {
    resetReveal()
    setX(1.57)
    setY(2)
  }

  useEffect(() => {
    clearDemoState('computation-graphs')
    return () => clearDemoState('computation-graphs')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction) {
      clearDemoState('computation-graphs')
      return
    }

    emitDemoState({
      conceptId: 'computation-graphs',
      label: 'Prediction-first reused-node sensitivity reveal',
      summary: `Learner predicted ${prediction}; actual ${actualRelation}; a=${fmt(values.a)}, direct ${fmt(values.directToA)} + sine path ${fmt(values.viaB)} gives bar a ${fmt(values.barA)} (${accumulationStatus}); bar x ${fmt(values.barX)}, bar y ${fmt(values.barY)}.`,
      values: [
        `prediction: ${prediction}`,
        `actual relation: ${actualRelation}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `x: ${fmt(x)}`,
        `y: ${fmt(y)}`,
        `a=x*y: ${fmt(values.a)}`,
        `b=sin(a): ${fmt(values.b)}`,
        `c=a+b: ${fmt(values.c)}`,
        `direct contribution to a: ${fmt(values.directToA)}`,
        `sine-path contribution to a: ${fmt(values.viaB)}`,
        `accumulated bar a: ${fmt(values.barA)}`,
        `bar x: ${fmt(values.barX)}`,
        `bar y: ${fmt(values.barY)}`,
        `relation tolerance: ${fmt(RELATION_TOLERANCE)}`,
        `accumulation status: ${accumulationStatus}`,
        `visible backward layer: revealed`,
      ],
    })
  }, [accumulationStatus, actualRelation, prediction, predictionCorrect, revealed, values.a, values.b, values.barA, values.barX, values.barY, values.c, values.directToA, values.viaB, x, y])

  return (
    <div className="wrap">
      <div className="controls">
        <label>
          <span>x</span>
          <input
            aria-label="x"
            type="range"
            min="-3"
            max="3"
            step="0.01"
            value={x}
            onChange={(event) => {
              resetReveal()
              setX(Number(event.target.value))
            }}
          />
          <strong>{fmt(x)}</strong>
        </label>
        <label>
          <span>y</span>
          <input
            aria-label="y"
            type="range"
            min="-3"
            max="3"
            step="0.01"
            value={y}
            onChange={(event) => {
              resetReveal()
              setY(Number(event.target.value))
            }}
          />
          <strong>{fmt(y)}</strong>
        </label>
        <div className="buttons" aria-label="Computation graph phase">
          <button type="button" aria-pressed={isForward} className={isForward ? 'selected' : ''} onClick={() => setPhase('forward')}>
            Forward
          </button>
          <button type="button" aria-pressed={isBackward} className={isBackward ? 'selected' : ''} disabled={!revealed} onClick={() => setPhase('backward')}>
            {revealed ? 'Backward' : 'Backward locked'}
          </button>
        </div>
        <div className="buttons presets" aria-label="Demo presets">
          <button type="button" onClick={setReuseExample}>
            Case A
          </button>
          <button type="button" onClick={setCancellationExample}>
            Case B
          </button>
        </div>
      </div>

      <div className="summary">
        <div>
          <span>forward output</span>
          <strong>c={fmt(values.c)}</strong>
        </div>
        <div>
          <span>stored a</span>
          <strong>a={fmt(values.a)}</strong>
        </div>
        <div>
          <span>stored b</span>
          <strong>b={fmt(values.b)}</strong>
        </div>
        <div>
          <span>direct baseline</span>
          <strong>direct dc/da={fmt(values.directToA)}</strong>
        </div>
      </div>

      <div className="accumulator">
        <span>node a sensitivity</span>
        <strong>
          {revealed
            ? `bar a = ${fmt(values.directToA)} + ${fmt(values.viaB)} = ${fmt(values.barA)}`
            : `a is stored once and has two downstream uses; sine-path contribution hidden`}
        </strong>
        <em>{revealed ? accumulationStatus : 'predict first'}</em>
      </div>

      <section className="prediction-panel">
        <div className="prediction-copy">
          <span>prediction checkpoint</span>
          <strong>What will the reused node collect?</strong>
          <p>
            The direct path from <span className="mono">c=a+b</span> contributes <span className="mono">1</span> to <span className="mono">a</span>. Before seeing the backward numbers, predict where the hidden accumulated sensitivity lands.
          </p>
        </div>

        <div className="choice-row" role="group" aria-label="Reused node accumulated sensitivity prediction">
          {(Object.keys(PREDICTION_COPY) as AccumulatorPrediction[]).map((key) => (
            <button
              key={key}
              type="button"
              className={prediction === key ? 'selected' : ''}
              aria-pressed={prediction === key}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
                setPhase('forward')
                clearDemoState('computation-graphs')
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
          Reveal reused-node sensitivity
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed && prediction ? (
          <>
            <h4>{predictionCorrect ? 'Correct.' : 'Not quite.'} The accumulated sensitivity is {PREDICTION_COPY[actualRelation].status}.</h4>
            <p>
              Prediction: {PREDICTION_COPY[prediction].label}. Actual: {PREDICTION_COPY[actualRelation].label}. The graph waits until both downstream uses have sent their local contribution, then adds them at the stored node <span className="mono">a</span>.
            </p>
            <div className="result-grid">
              <span>direct</span>
              <strong>{fmt(values.directToA)}</strong>
              <span>sine path</span>
              <strong>{fmt(values.viaB)}</strong>
              <span>bar a</span>
              <strong>{fmt(values.barA)}</strong>
              <span>status</span>
              <strong>{accumulationStatus}</strong>
            </div>
          </>
        ) : (
          <p>{prediction ? 'Reveal the backward accumulator to test your prediction.' : 'Choose lower, nearly equal, or higher to unlock the hidden backward numbers.'}</p>
        )}
      </section>

      <svg viewBox="0 0 820 360" role="img" aria-label="Computation graph for c = xy + sin(xy)">
        <defs>
          <marker id="cg-arrow-muted" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
          <marker id="cg-arrow-active" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" />
          </marker>
        </defs>

        <Edge x1={190} y1={98} x2={270} y2={148} active={isForward} label="x" />
        <Edge x1={190} y1={248} x2={270} y2={194} active={isForward} label="y" />
        <Edge x1={420} y1={148} x2={490} y2={92} active={isForward} label="sin" />
        <Edge x1={420} y1={194} x2={660} y2={194} active={isForward} label="reuse" />
        <Edge x1={640} y1={104} x2={660} y2={154} active={isForward} label="add" />

        <Edge x1={660} y1={194} x2={420} y2={194} active={isBackward} label="1" />
        <Edge x1={660} y1={154} x2={640} y2={104} active={isBackward} label="1" />
        <Edge x1={490} y1={92} x2={420} y2={148} active={isBackward} label="cos(a)" />
        <Edge x1={270} y1={148} x2={190} y2={98} active={isBackward} label="y" />
        <Edge x1={270} y1={194} x2={190} y2={248} active={isBackward} label="x" />

        <NodeBox x={40} y={52} title="x" formula="input" value={`x=${fmt(x)}`} sensitivity={isBackward ? `bar x=${fmt(values.barX)}` : 'sensitivity hidden'} active />
        <NodeBox x={40} y={202} title="y" formula="input" value={`y=${fmt(y)}`} sensitivity={isBackward ? `bar y=${fmt(values.barY)}` : 'sensitivity hidden'} active />
        <NodeBox x={270} y={126} title="a" formula="a=x*y" value={`a=${fmt(values.a)}`} sensitivity={isBackward ? `bar a=${fmt(values.barA)}` : 'stored; 2 uses'} active />
        <NodeBox x={490} y={52} title="b" formula="b=sin(a)" value={`b=${fmt(values.b)}`} sensitivity={isBackward ? 'bar b=1' : 'sensitivity hidden'} active={isBackward || isForward} />
        <NodeBox x={660} y={126} title="c" formula="c=a+b" value={`c=${fmt(values.c)}`} sensitivity={isBackward ? 'bar c=1' : 'sensitivity hidden'} active />
      </svg>

      <div className="mobile-flow">
        <div className={isForward ? 'mobile-step active' : 'mobile-step'}>
          <span>Forward</span>
          <strong>{'x,y -> a=xy -> b=sin(a) -> c=a+b'}</strong>
          <p>
            a={fmt(values.a)}, b={fmt(values.b)}, c={fmt(values.c)}
          </p>
        </div>
        <div className={isBackward ? 'mobile-step active' : 'mobile-step'}>
          <span>Backward seed</span>
          <strong>{revealed ? 'Start with bar c=1' : 'backward seed hidden'}</strong>
          <p>{revealed ? 'The add node sends one unit of sensitivity to both a and b.' : 'Reveal after predicting the reused-node relation.'}</p>
        </div>
        <div className={isBackward ? 'mobile-step active' : 'mobile-step'}>
          <span>Accumulation</span>
          <strong>{revealed ? 'bar a = direct + through sine' : 'sine-path contribution hidden'}</strong>
          <p>{revealed ? `bar a = ${fmt(values.directToA)} + ${fmt(values.viaB)} = ${fmt(values.barA)}` : 'The graph topology is visible; the numeric accumulator waits.'}</p>
        </div>
        <div className={isBackward ? 'mobile-step active' : 'mobile-step'}>
          <span>Inputs</span>
          <strong>{revealed ? 'Local slopes finish the chain' : 'input cotangents hidden'}</strong>
          <p>{revealed ? `bar x=${fmt(values.barX)}, bar y=${fmt(values.barY)}` : 'Input cotangents unlock after reveal.'}</p>
        </div>
      </div>

      <p className="claim">
        {revealed
          ? 'The backward pass adds both downstream contributions into a before sending sensitivity to x and y.'
          : 'The forward pass stores every node value once, including the reused intermediate a. Commit to the hidden accumulator before showing the backward numbers.'}
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(2, minmax(160px, 1fr)) auto auto;
          gap: 0.75rem;
          align-items: end;
          padding: 0.8rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.76);
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

        .summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .summary div {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          padding: 0.7rem;
          background: rgba(255, 255, 255, 0.62);
          min-width: 0;
        }

        .summary span {
          display: block;
          color: #65717d;
          font-size: 0.75rem;
          margin-bottom: 0.2rem;
        }

        .summary strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .accumulator {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.65rem;
          align-items: center;
          border: 1px solid rgba(31, 75, 153, 0.16);
          border-radius: 8px;
          background: rgba(234, 242, 255, 0.7);
          color: #334150;
          padding: 0.68rem 0.75rem;
        }

        .accumulator span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0;
          text-transform: uppercase;
        }

        .accumulator strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .accumulator em {
          color: #1f4b99;
          font-size: 0.78rem;
          font-style: normal;
          white-space: nowrap;
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
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .choice-row button {
          align-content: start;
          display: grid;
          gap: 0.25rem;
          min-height: 82px;
          padding: 0.65rem;
          text-align: left;
          white-space: normal;
        }

        .choice-row button strong {
          color: #1b2430;
          font-size: 0.88rem;
        }

        .choice-row button span {
          color: #65717d;
          font-size: 0.76rem;
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
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0.7rem;
        }

        .result-grid strong {
          color: #1b2430;
          font-family: var(--font-mono);
          font-size: 0.9rem;
          overflow-wrap: anywhere;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(245, 249, 255, 0.78));
        }

        .mobile-flow {
          display: none;
        }

        :global(.node rect) {
          fill: rgba(255, 255, 255, 0.84);
          stroke: rgba(27, 36, 48, 0.12);
          stroke-width: 1.2;
        }

        :global(.node.active rect) {
          fill: #fff6dc;
          stroke: rgba(221, 132, 54, 0.55);
        }

        :global(.node rect),
        :global(.edge path) {
          transition:
            fill 180ms ease,
            stroke 180ms ease,
            stroke-width 180ms ease,
            opacity 180ms ease;
        }

        :global(.title) {
          font-weight: 700;
          fill: #1b2430;
          font-size: 14px;
        }

        :global(.formula) {
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

        :global(.edge path) {
          fill: none;
          stroke: rgba(101, 113, 125, 0.28);
          stroke-width: 2;
          marker-end: url(#cg-arrow-muted);
        }

        :global(.edge.active path) {
          stroke: rgba(31, 75, 153, 0.78);
          stroke-width: 3;
          marker-end: url(#cg-arrow-active);
        }

        :global(.edge-label) {
          fill: #4c5b68;
          font-family: var(--font-mono);
          font-size: 10px;
          paint-order: stroke;
          stroke: rgba(255, 251, 245, 0.86);
          stroke-width: 4px;
        }

        :global(#cg-arrow-muted path) {
          fill: rgba(101, 113, 125, 0.34);
        }

        :global(#cg-arrow-active path) {
          fill: rgba(31, 75, 153, 0.75);
        }

        .claim {
          margin: 0;
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .controls {
            grid-template-columns: 1fr;
          }

          label {
            grid-template-columns: 2rem 1fr 4.5rem;
          }

          .buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .summary {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .accumulator {
            grid-template-columns: 1fr;
          }

          .choice-row,
          .result-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .summary {
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
            border-radius: 8px;
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
