import { useEffect, useMemo, useState } from 'react'

import { emitDemoState } from '../../../../../lib/demoState'

type Phase = 'forward' | 'reverse' | 'efficiency'
type CotangentPrediction = 'reinforce' | 'direct' | 'cancel'

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtSum(total: number, first: number, second: number) {
  const sign = second < 0 ? '-' : '+'
  return `${fmt(total)} = ${fmt(first)} ${sign} ${fmt(Math.abs(second))}`
}

function classifyCotangent(total: number): CotangentPrediction {
  if (total < 0.35) return 'cancel'
  if (total > 1.65) return 'reinforce'
  return 'direct'
}

const predictionChoices: Array<{
  id: CotangentPrediction
  label: string
  hint: string
}> = [
  {
    id: 'reinforce',
    label: 'Paths reinforce',
    hint: 'The direct path and sine path add into a larger cotangent.',
  },
  {
    id: 'direct',
    label: 'Direct path dominates',
    hint: 'The sine path is not strong enough to clearly reinforce or cancel the direct path.',
  },
  {
    id: 'cancel',
    label: 'Paths cancel',
    hint: 'The sine pullback nearly cancels the direct path.',
  },
]

export default function ReverseModeAutodiffViz() {
  const [x, setX] = useState(2)
  const [y, setY] = useState(3)
  const [phase, setPhase] = useState<Phase>('forward')
  const [prediction, setPrediction] = useState<CotangentPrediction | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const values = useMemo(() => {
    const a = x * y
    const b = Math.sin(a)
    const loss = a + b
    const barL = 1
    const barB = barL
    const directA = barL
    const sineA = barB * Math.cos(a)
    const barA = directA + sineA
    const barX = barA * y
    const barY = barA * x
    return { a, b, loss, barL, barB, directA, sineA, barA, barX, barY }
  }, [x, y])

  const isForward = phase === 'forward'
  const isReverse = phase === 'reverse'
  const isEfficiency = phase === 'efficiency'
  const predictionKey = `${x.toFixed(2)}:${y.toFixed(2)}`
  const isRevealed = revealedKey === predictionKey
  const cotangentClass = classifyCotangent(values.barA)
  const predictionCorrect = prediction === cotangentClass

  const setReusePreset = () => {
    setX(2)
    setY(3)
    setPhase('reverse')
    setPrediction(null)
    setRevealedKey(null)
  }

  const setCancelPreset = () => {
    setX(1.57)
    setY(2)
    setPhase('reverse')
    setPrediction(null)
    setRevealedKey(null)
  }

  const updateX = (value: number) => {
    setX(value)
    setPrediction(null)
    setRevealedKey(null)
  }

  const updateY = (value: number) => {
    setY(value)
    setPrediction(null)
    setRevealedKey(null)
  }

  const revealReverseSweep = () => {
    if (!prediction) return
    setPhase('reverse')
    setRevealedKey(predictionKey)
  }

  useEffect(() => {
    if (!isRevealed) return

    emitDemoState({
      conceptId: 'reverse-mode-autodiff',
      label: 'Reverse-mode cotangent prediction',
      summary:
        `prediction=${prediction ?? 'none'}; actual=${cotangentClass}; ` +
        `bar a=${fmt(values.barA)} from direct ${fmt(values.directA)} and sine ${fmt(values.sineA)}.`,
      values: [
        `x=${fmt(x)}`,
        `y=${fmt(y)}`,
        `a=x*y=${fmt(values.a)}`,
        `L=${fmt(values.loss)}`,
        `bar a=${fmt(values.barA)}`,
        `bar x=${fmt(values.barX)}`,
        `bar y=${fmt(values.barY)}`,
        `prediction correct=${predictionCorrect ? 'yes' : 'no'}`,
      ],
    })
  }, [
    cotangentClass,
    isRevealed,
    prediction,
    predictionCorrect,
    values.a,
    values.barA,
    values.barX,
    values.barY,
    values.directA,
    values.loss,
    values.sineA,
    x,
    y,
  ])

  const rows = [
    {
      id: 'mul',
      step: '01',
      op: 'a = x*y',
      saved: `x=${fmt(x)}, y=${fmt(y)}, a=${fmt(values.a)}`,
      backward: isRevealed
        ? `bar x += bar a*y = ${fmt(values.barX)}; bar y += bar a*x = ${fmt(values.barY)}`
        : 'bar x and bar y are hidden until you reveal the cotangent prediction',
    },
    {
      id: 'sin',
      step: '02',
      op: 'b = sin(a)',
      saved: `a=${fmt(values.a)}, b=${fmt(values.b)}`,
      backward: isRevealed ? `bar a += bar b*cos(a) = ${fmt(values.sineA)}` : 'sine-path contribution hidden before reveal',
    },
    {
      id: 'loss',
      step: '03',
      op: 'L = a+b',
      saved: `a=${fmt(values.a)}, b=${fmt(values.b)}, L=${fmt(values.loss)}`,
      backward: isRevealed ? `bar a += ${fmt(values.directA)}; bar b += ${fmt(values.barB)}` : 'direct contribution hidden before reveal',
    },
  ]

  const visibleRows = isReverse ? rows.slice().reverse() : rows

  return (
    <div className="wrap">
      <div className="controls">
        <label>
          <span>x</span>
          <input type="range" min="-3" max="3" step="0.01" value={x} onChange={(event) => updateX(Number(event.target.value))} />
          <strong>{fmt(x)}</strong>
        </label>
        <label>
          <span>y</span>
          <input type="range" min="-3" max="3" step="0.01" value={y} onChange={(event) => updateY(Number(event.target.value))} />
          <strong>{fmt(y)}</strong>
        </label>
        <div className="buttons" aria-label="Autodiff phase">
          <button type="button" aria-pressed={isForward} className={isForward ? 'selected' : ''} onClick={() => setPhase('forward')}>
            Forward tape
          </button>
          <button type="button" aria-pressed={isReverse} className={isReverse ? 'selected' : ''} onClick={() => setPhase('reverse')}>
            Reverse sweep
          </button>
          <button type="button" aria-pressed={isEfficiency} className={isEfficiency ? 'selected' : ''} onClick={() => setPhase('efficiency')}>
            Cost shape
          </button>
        </div>
        <div className="buttons presets" aria-label="Autodiff presets">
          <button type="button" onClick={setReusePreset}>
            Reuse
          </button>
          <button type="button" onClick={setCancelPreset}>
            Product sample
          </button>
        </div>
      </div>

      <section className="prediction" aria-label="Cotangent prediction">
        <div className="prediction-copy">
          <span>predict before reverse sweep</span>
          <strong>When the two paths into a are accumulated, what happens to bar a?</strong>
          <p>
            Forward values are visible. The reverse cotangents and input gradient stay hidden until you commit.
          </p>
        </div>
        <div className="prediction-actions" role="group" aria-label="Predict accumulated cotangent behavior">
          {predictionChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={prediction === choice.id ? 'selected' : ''}
              aria-pressed={prediction === choice.id}
              onClick={() => {
                setPrediction(choice.id)
                setRevealedKey(null)
              }}
            >
              <strong>{choice.label}</strong>
              <span>{choice.hint}</span>
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={!prediction} onClick={revealReverseSweep}>
          Reveal reverse sweep
        </button>
        {isRevealed ? (
          <p className={predictionCorrect ? 'feedback correct' : 'feedback'}>
            {predictionCorrect ? 'Correct.' : 'Not quite.'} bar a = {fmt(values.barA)} because the direct +1 path and
            the sine pullback {values.sineA < 0 ? 'oppose' : 'reinforce'} each other.
          </p>
        ) : null}
      </section>

      <div className="metrics">
        <div>
          <span>scalar loss</span>
          <strong>L={fmt(values.loss)}</strong>
        </div>
        <div>
          <span>seed</span>
          <strong>bar L={fmt(values.barL)}</strong>
        </div>
        <div>
          <span>accumulated</span>
          <strong>bar a={isForward || !isRevealed ? 'hidden' : fmt(values.barA)}</strong>
        </div>
        <div>
          <span>gradient</span>
          <strong>{isForward || !isRevealed ? 'hidden' : `[${fmt(values.barX)}, ${fmt(values.barY)}]`}</strong>
        </div>
      </div>

      <div className="stage">
        <section className="tape" aria-label="Recorded autodiff tape">
          <div className="panel-head">
            <span>{isReverse ? 'Reverse topological order' : 'Forward recorded tape'}</span>
            <strong>{isReverse ? 'read upward through saved operations' : 'write values once as primitives run'}</strong>
          </div>
          <div className="rows">
            {visibleRows.map((row) => (
              <article key={row.id} className={isReverse ? 'row reverse' : 'row'}>
                <span className="step">{row.step}</span>
                <div>
                  <strong>{row.op}</strong>
                  <p>{isReverse ? row.backward : row.saved}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="registers" aria-label="Cotangent registers">
          <div className="panel-head">
            <span>Cotangent registers</span>
            <strong>{isForward ? 'allocated, not filled' : 'filled by local pullbacks'}</strong>
          </div>
          <div className="register-grid">
            <div>
              <span>bar L</span>
              <strong>{isForward || !isRevealed ? 'seed waits' : fmt(values.barL)}</strong>
            </div>
            <div>
              <span>bar b</span>
              <strong>{isForward || !isRevealed ? 'hidden' : fmt(values.barB)}</strong>
            </div>
            <div>
              <span>bar a</span>
              <strong>{isForward || !isRevealed ? 'hidden until reveal' : fmtSum(values.barA, values.directA, values.sineA)}</strong>
            </div>
            <div>
              <span>bar x</span>
              <strong>{isForward || !isRevealed ? 'hidden' : fmt(values.barX)}</strong>
            </div>
            <div>
              <span>bar y</span>
              <strong>{isForward || !isRevealed ? 'hidden' : fmt(values.barY)}</strong>
            </div>
          </div>
        </section>
      </div>

      {isEfficiency ? (
        <section className="cost-shape" aria-label="Reverse mode cost shape">
          <div>
            <span>function shape</span>
            <strong>{'L: R^p -> R'}</strong>
            <p>Many input coordinates feed one scalar loss.</p>
          </div>
          <div>
            <span>reverse mode</span>
            <strong>1 reverse sweep</strong>
            <p>After the forward tape is recorded, the seed bar L=1 fills every input cotangent.</p>
          </div>
          <div>
            <span>forward mode</span>
            <strong>p directions</strong>
            <p>Recovering the full gradient needs one directional sweep per basis direction.</p>
          </div>
        </section>
      ) : null}

      <div className={isEfficiency ? 'claim efficiency' : 'claim'}>
        {isForward
          ? 'Reverse mode first records a tape of primitive operations and the values each local backward rule will need.'
          : isReverse
            ? isRevealed
              ? 'One reverse sweep starts from bar L=1, walks the tape backward, and fills every input cotangent.'
              : 'The tape order is visible, but the cotangent numbers are hidden until you predict how the paths into a accumulate.'
            : 'For a scalar loss with many inputs, reverse mode gives the whole gradient in one backward sweep; forward mode needs one directional sweep per input direction to recover the full gradient.'}
      </div>

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
          background: rgba(247, 250, 246, 0.78);
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

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .prediction {
          display: grid;
          grid-template-columns: minmax(220px, 0.75fr) minmax(0, 1.25fr) auto;
          gap: 0.7rem;
          align-items: stretch;
          border: 1px solid rgba(31, 75, 153, 0.18);
          border-radius: 8px;
          padding: 0.75rem;
          background: linear-gradient(135deg, rgba(234, 242, 255, 0.92), rgba(255, 251, 245, 0.82));
        }

        .prediction-copy span {
          display: block;
          color: #1f4b99;
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .prediction-copy strong {
          display: block;
          margin-top: 0.25rem;
          color: #1b2430;
          line-height: 1.3;
        }

        .prediction-copy p,
        .feedback {
          margin: 0.35rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .prediction-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .prediction-actions button {
          display: grid;
          gap: 0.22rem;
          height: 100%;
          text-align: left;
          white-space: normal;
        }

        .prediction-actions button span {
          color: #65717d;
          font-size: 0.75rem;
          line-height: 1.35;
        }

        .reveal {
          align-self: stretch;
          border-color: rgba(31, 75, 153, 0.35);
          background: #1f4b99;
          color: #fff;
        }

        .reveal:disabled {
          border-color: rgba(27, 36, 48, 0.12);
          background: #d7dee8;
          color: #65717d;
          cursor: not-allowed;
        }

        .feedback {
          grid-column: 1 / -1;
          border-top: 1px solid rgba(31, 75, 153, 0.14);
          padding-top: 0.55rem;
        }

        .feedback.correct {
          color: #1f6f4a;
        }

        .metrics div,
        .register-grid div,
        .row {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div {
          padding: 0.7rem;
        }

        .metrics span,
        .register-grid span,
        .panel-head span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong,
        .register-grid strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
          gap: 0.75rem;
        }

        .tape,
        .registers {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          padding: 0.8rem;
          background: linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(245, 249, 255, 0.78));
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          gap: 0.8rem;
          align-items: baseline;
          margin-bottom: 0.65rem;
        }

        .panel-head strong {
          color: #1b2430;
          font-size: 0.86rem;
          text-align: right;
        }

        .rows,
        .register-grid {
          display: grid;
          gap: 0.55rem;
        }

        .row {
          display: grid;
          grid-template-columns: 2.5rem minmax(0, 1fr);
          gap: 0.65rem;
          padding: 0.7rem;
        }

        .row.reverse {
          border-color: rgba(31, 75, 153, 0.24);
          background: #f3f7ff;
        }

        .step {
          display: grid;
          place-items: center;
          width: 2.2rem;
          height: 2.2rem;
          border-radius: 8px;
          background: #1b2430;
          color: #fffaf0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .row strong {
          color: #1b2430;
          font-family: var(--font-mono);
        }

        .row p {
          margin: 0.25rem 0 0;
          color: #4a5865;
          font-family: var(--font-mono);
          font-size: 0.78rem;
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .register-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .register-grid div {
          padding: 0.65rem;
        }

        .claim {
          margin: 0;
          padding: 0.75rem 0.85rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
          color: #334150;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        .claim.efficiency {
          border-color: rgba(31, 111, 120, 0.28);
          background: #eef8f6;
        }

        .cost-shape {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .cost-shape div {
          min-width: 0;
          border: 1px solid rgba(31, 111, 120, 0.22);
          border-radius: 8px;
          padding: 0.75rem;
          background: #eef8f6;
        }

        .cost-shape span {
          display: block;
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .cost-shape strong {
          display: block;
          margin-top: 0.25rem;
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .cost-shape p {
          margin: 0.4rem 0 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        @media (max-width: 980px) {
          .controls,
          .stage,
          .prediction {
            grid-template-columns: 1fr;
          }

          label {
            grid-template-columns: 2rem 1fr 4.5rem;
          }

          .buttons {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .buttons[aria-label='Autodiff phase'] {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .metrics,
          .register-grid,
          .cost-shape,
          .prediction-actions {
            grid-template-columns: 1fr;
          }

          .buttons,
          .buttons[aria-label='Autodiff phase'] {
            grid-template-columns: 1fr;
          }

          .panel-head {
            display: grid;
            gap: 0.25rem;
          }

          .panel-head strong {
            text-align: left;
          }
        }
      `}</style>
    </div>
  )
}
