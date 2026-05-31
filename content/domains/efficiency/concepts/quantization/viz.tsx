import { useEffect, useMemo, useState } from 'react'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

type Prediction = 'tensor' | 'channel' | 'tie'

const bitOptions = [8, 4]
const outlierOptions = [
  { label: 'none', value: 0 },
  { label: 'moderate', value: 2.8 },
  { label: 'severe', value: 7.5 },
]

const baseRows = [
  [-0.34, -0.28, -0.15, -0.05, 0.04, 0.12, 0.22, 0.31],
  [-0.52, -0.41, -0.19, -0.07, 0.08, 0.21, 0.36, 0.48],
  [-0.25, -0.16, -0.11, -0.03, 0.06, 0.11, 0.18, 0.24],
  [-0.71, -0.58, -0.32, -0.14, 0.13, 0.29, 0.47, 0.62],
]

const flatten = (rows: number[][]) => rows.flatMap((row) => row)
const rmse = (a: number[], b: number[]) => Math.sqrt(a.reduce((sum, value, index) => sum + (value - b[index]) ** 2, 0) / a.length)
const maxAbs = (values: number[]) => Math.max(...values.map((value) => Math.abs(value)), 1e-9)
const fmt = (value: number) => value.toFixed(value >= 1 ? 2 : 3)

function getWeights(outlier: number) {
  return baseRows.map((row, rowIndex) =>
    row.map((value, colIndex) => (rowIndex === 2 && colIndex === 7 ? value + outlier : value))
  )
}

function quantize(values: number[], bits: number, scale: number) {
  const qmax = 2 ** (bits - 1) - 1
  return values.map((value) => {
    const q = Math.max(-qmax, Math.min(qmax, Math.round(value / scale)))
    return q * scale
  })
}

function analyze(rows: number[][], bits: number) {
  const values = flatten(rows)
  const qmax = 2 ** (bits - 1) - 1
  const tensorScale = maxAbs(values) / qmax
  const tensorDeq = quantize(values, bits, tensorScale)
  const perChannelRows = rows.map((row) => {
    const scale = maxAbs(row) / qmax
    return {
      scale,
      deq: quantize(row, bits, scale),
      rmse: rmse(row, quantize(row, bits, scale)),
    }
  })
  const channelDeq = flatten(perChannelRows.map((row) => row.deq))
  const tensorRmse = rmse(values, tensorDeq)
  const channelRmse = rmse(values, channelDeq)
  const ratio = tensorRmse / Math.max(channelRmse, 1e-9)
  const winner: Prediction =
    tensorRmse < channelRmse * 0.88
      ? 'tensor'
      : channelRmse < tensorRmse * 0.88
        ? 'channel'
        : 'tie'

  return {
    qmax,
    tensorScale,
    tensorRmse,
    channelRmse,
    channelRows: perChannelRows,
    winner,
    ratio,
    memoryFp16: values.length * 2,
    memoryQuantized: (values.length * bits) / 8,
  }
}

function winnerLabel(winner: Prediction) {
  if (winner === 'tensor') return 'Per-tensor scale'
  if (winner === 'channel') return 'Per-channel scales'
  return 'About tied'
}

export default function QuantizationConceptViz() {
  const [bits, setBits] = useState(4)
  const [outlier, setOutlier] = useState(7.5)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const weights = useMemo(() => getWeights(outlier), [outlier])
  const stats = useMemo(() => analyze(weights, bits), [bits, weights])
  const allValues = useMemo(() => flatten(weights), [weights])
  const displayMax = maxAbs(allValues)
  const predictionCorrect = prediction === stats.winner
  const ordinaryRowScale = stats.channelRows[0]?.scale ?? 0

  useEffect(() => {
    emitDemoState({
      conceptId: 'quantization',
      label: 'Quantization outlier scaling demo',
      summary: revealed
        ? `${bits}-bit quantization with ${outlierLabel(outlier)} outlier: per-tensor RMSE ${fmt(stats.tensorRmse)}, per-channel RMSE ${fmt(stats.channelRmse)}, winner ${winnerLabel(stats.winner)}.`
        : `${bits}-bit quantization challenge with ${outlierLabel(outlier)} outlier. Learner is predicting whether one global scale or per-channel scales preserve more resolution.`,
      values: [
        `bits: ${bits}`,
        `q range: -${stats.qmax}..${stats.qmax}`,
        `outlier: ${outlierLabel(outlier)}`,
        `prediction: ${prediction ?? 'none'}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `fp16 bytes: ${stats.memoryFp16}`,
        `quantized value bytes: ${stats.memoryQuantized}`,
      ],
    })
  }, [
    bits,
    outlier,
    prediction,
    revealed,
    stats.channelRmse,
    stats.memoryFp16,
    stats.memoryQuantized,
    stats.qmax,
    stats.tensorRmse,
    stats.winner,
  ])

  const resetReveal = () => setRevealed(false)

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Quantization: predict how the outlier steals resolution"
      subtitle="Choose the bit width and outlier strength, then predict whether one shared scale or per-channel scales give lower reconstruction error."
      metrics={['q range', 'scale Delta', 'RMSE', 'value bytes']}
      challenge={
        <p>
          Before reveal, commit to the scaling strategy that should preserve the
          ordinary rows when one channel contains a large activation or weight.
        </p>
      }
      notes={
        <p>
          This is symmetric uniform quantization for a tiny weight matrix. Real
          LLM quantizers add calibration data, outlier routing, grouping, and
          second-order error compensation, but the scale-resolution tradeoff is
          the same mechanism.
        </p>
      }
    >
      <VizStageAdapter padding="normal">
        <div className="quant-demo">
          <div className="controls" aria-label="Quantization demo controls">
            <div className="control-group">
              <span>Bit width</span>
              <div className="segmented">
                {bitOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={bits === option ? 'active' : ''}
                    onClick={() => {
                      setBits(option)
                      resetReveal()
                    }}
                  >
                    INT{option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Outlier</span>
              <div className="segmented">
                {outlierOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={outlier === option.value ? 'active' : ''}
                    onClick={() => {
                      setOutlier(option.value)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="prediction-panel">
            <h4>Predict the lower-error strategy</h4>
            <div className="choice-row" role="group" aria-label="Quantization strategy prediction">
              {[
                ['tensor', 'One global scale'],
                ['channel', 'Per-channel scales'],
                ['tie', 'About tied'],
              ].map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={prediction === value ? 'selected' : ''}
                  onClick={() => {
                    setPrediction(value as Prediction)
                    resetReveal()
                  }}
                  aria-pressed={prediction === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <div className="stage-grid">
            <section className="weights-panel" aria-label="Toy weight matrix">
              <div className="panel-head">
                <h4>Weights before quantization</h4>
                <span>4 channels x 8 weights</span>
              </div>
              <div className="weight-grid">
                {weights.map((row, rowIndex) => (
                  <div className="weight-row" key={rowIndex}>
                    <span className="row-label">ch {rowIndex}</span>
                    <div className="cells">
                      {row.map((value, colIndex) => (
                        <span
                          key={`${rowIndex}-${colIndex}`}
                          className={Math.abs(value) > 1 ? 'cell outlier' : 'cell'}
                          style={{ '--intensity': Math.min(1, Math.abs(value) / displayMax).toString() } as React.CSSProperties}
                          title={`w=${fmt(value)}`}
                        >
                          {Math.abs(value) > 1 ? '!' : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p>
                A large outlier increases the shared scale, so small ordinary
                values land on fewer integer levels.
              </p>
            </section>

            <section className="scale-panel">
              <div className="panel-head">
                <h4>Scale comparison</h4>
                <span>{revealed ? `qmax ${stats.qmax}` : 'hidden until reveal'}</span>
              </div>
              <div className="scale-bars">
                <div>
                  <span>global Delta</span>
                  <strong>{revealed ? fmt(stats.tensorScale) : '???'}</strong>
                  <div className="bar">
                    <i style={{ width: revealed ? '100%' : '36%' }} />
                  </div>
                </div>
                <div>
                  <span>ordinary channel Delta</span>
                  <strong>{revealed ? fmt(ordinaryRowScale) : '???'}</strong>
                  <div className="bar channel">
                    <i
                      style={{
                        width: revealed
                          ? `${Math.max(8, Math.min(100, (ordinaryRowScale / stats.tensorScale) * 100))}%`
                          : '36%',
                      }}
                    />
                  </div>
                </div>
              </div>
              <p>
                The question is whether the smaller per-channel step lowers
                reconstruction error. Real systems also account for scale
                metadata, kernels, grouping, and calibration.
              </p>
            </section>

            <section className="reveal-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>FP16 storage</dt>
                  <dd>{stats.memoryFp16} B</dd>
                </div>
                <div>
                  <dt>INT{bits} value bytes</dt>
                  <dd>{stats.memoryQuantized.toFixed(bits === 4 ? 1 : 0)} B</dd>
                </div>
                <div>
                  <dt>Winner</dt>
                  <dd>{revealed ? winnerLabel(stats.winner) : 'Hidden'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                disabled={!prediction}
                onClick={() => setRevealed(true)}
              >
                Reveal error
              </button>
              {!prediction ? <p className="hint">Choose a prediction to unlock the reveal.</p> : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>{predictionCorrect ? 'Prediction matches.' : 'The scale invariant is visible.'}</h4>
                  <p>
                    With {outlierLabel(outlier)} outlier and INT{bits}, the
                    global scale must cover the largest value in the entire
                    matrix. Per-channel scales let ordinary channels use a
                    smaller Delta, so their small weights do not collapse onto
                    coarse integer bins.
                  </p>
                </div>
                <div className="error-table" role="table" aria-label="Quantization error comparison">
                  <div className="table-row head" role="row">
                    <span>strategy</span>
                    <span>scale</span>
                    <span>RMSE</span>
                  </div>
                  <div className={stats.winner === 'tensor' ? 'table-row best' : 'table-row'} role="row">
                    <span>global</span>
                    <span>{fmt(stats.tensorScale)}</span>
                    <span>{fmt(stats.tensorRmse)}</span>
                  </div>
                  <div className={stats.winner === 'channel' ? 'table-row best' : 'table-row'} role="row">
                    <span>per-channel</span>
                    <span>{fmt(ordinaryRowScale)}...</span>
                    <span>{fmt(stats.channelRmse)}</span>
                  </div>
                  <div className="table-row" role="row">
                    <span>error ratio</span>
                    <span>global/channel</span>
                    <span>{fmt(stats.ratio)}x</span>
                  </div>
                </div>
              </>
            ) : (
              <p>
                The error table is hidden until you commit. Watch the matrix:
                if one value sets the global range, the ordinary rows lose
                effective resolution.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .quant-demo {
            display: grid;
            gap: 1rem;
            color: #18222d;
          }

          .controls,
          .stage-grid {
            display: grid;
            gap: 0.75rem;
          }

          .controls {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .stage-grid {
            grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.95fr) minmax(220px, 0.8fr);
          }

          .control-group,
          .prediction-panel,
          .weights-panel,
          .scale-panel,
          .reveal-panel,
          .result {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: rgba(255, 253, 248, 0.8);
            border-radius: 14px;
            padding: 0.85rem;
            min-width: 0;
          }

          h4,
          .control-group > span,
          .panel-head {
            color: #30404f;
            font-size: 0.82rem;
          }

          h4,
          .control-group > span {
            display: block;
            margin: 0 0 0.55rem;
            font-weight: 800;
          }

          .segmented,
          .choice-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.45rem;
          }

          button {
            min-height: 34px;
            border: 1px solid rgba(24, 34, 45, 0.14);
            border-radius: 999px;
            background: #fffaf0;
            color: #293947;
            font: inherit;
            font-size: 0.78rem;
            font-weight: 700;
            padding: 0.45rem 0.7rem;
            cursor: pointer;
          }

          button:hover,
          button:focus-visible {
            border-color: #1b7180;
            outline: none;
          }

          button.active,
          button.selected {
            background: #1b7180;
            border-color: #1b7180;
            color: #ffffff;
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 0.6rem;
            align-items: baseline;
            margin-bottom: 0.7rem;
          }

          .panel-head h4 {
            margin: 0;
          }

          .panel-head span {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .weight-grid {
            display: grid;
            gap: 0.45rem;
          }

          .weight-row {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr);
            align-items: center;
            gap: 0.45rem;
          }

          .row-label {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .cells {
            display: grid;
            grid-template-columns: repeat(8, minmax(16px, 1fr));
            gap: 4px;
          }

          .cell {
            display: grid;
            place-items: center;
            min-height: 30px;
            border-radius: 6px;
            background: rgba(27, 113, 128, calc(0.16 + var(--intensity) * 0.58));
            border: 1px solid rgba(24, 34, 45, 0.1);
            color: #ffffff;
            font-size: 0.8rem;
            font-weight: 900;
          }

          .cell.outlier {
            background: rgba(188, 73, 47, calc(0.45 + var(--intensity) * 0.45));
          }

          .weights-panel p,
          .scale-panel p,
          .hint,
          .result p {
            margin: 0.7rem 0 0;
            color: #52606c;
            font-size: 0.86rem;
            line-height: 1.55;
          }

          .scale-bars {
            display: grid;
            gap: 0.85rem;
          }

          .scale-bars span,
          .scale-bars strong {
            display: block;
          }

          .scale-bars span {
            color: #66727d;
            font-size: 0.78rem;
          }

          .scale-bars strong {
            margin: 0.2rem 0 0.35rem;
            color: #263642;
            font-family: var(--font-mono);
            font-size: 0.86rem;
          }

          .bar {
            height: 12px;
            border-radius: 999px;
            background: #e5d9c8;
            overflow: hidden;
          }

          .bar i {
            display: block;
            height: 100%;
            border-radius: inherit;
            background: #bc492f;
          }

          .bar.channel i {
            background: #1b7180;
          }

          dl {
            display: grid;
            gap: 0.55rem;
            margin: 0 0 0.8rem;
          }

          dl div {
            display: flex;
            justify-content: space-between;
            gap: 0.65rem;
            border-bottom: 1px solid rgba(24, 34, 45, 0.08);
            padding-bottom: 0.45rem;
          }

          dt {
            color: #66727d;
            font-size: 0.78rem;
          }

          dd {
            margin: 0;
            color: #24313d;
            font-family: var(--font-mono);
            font-size: 0.78rem;
            text-align: right;
          }

          .reveal {
            width: 100%;
            border-radius: 10px;
            background: #24313d;
            border-color: #24313d;
            color: #ffffff;
          }

          .result {
            background: rgba(245, 248, 246, 0.92);
          }

          .result.shown {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(280px, 0.9fr);
            gap: 0.85rem;
          }

          .result h4 {
            margin: 0;
            color: #1d5f68;
          }

          .error-table {
            display: grid;
            gap: 0.25rem;
            align-content: start;
            min-width: 0;
          }

          .table-row {
            display: grid;
            grid-template-columns: 1fr 0.8fr 0.7fr;
            gap: 0.45rem;
            padding: 0.5rem 0.55rem;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.74);
            color: #344654;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .table-row.head {
            background: transparent;
            color: #66727d;
            font-weight: 800;
          }

          .table-row.best {
            background: #e6f2f1;
            color: #155d68;
            font-weight: 800;
          }

          @media (max-width: 860px) {
            .controls,
            .stage-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 520px) {
            .weight-row {
              grid-template-columns: 1fr;
            }

            .cells {
              grid-template-columns: repeat(4, minmax(28px, 1fr));
            }

            .error-table {
              overflow-x: auto;
            }

            .table-row {
              min-width: 330px;
            }
          }
        `}</style>
      </VizStageAdapter>
    </VizShell>
  )
}

function outlierLabel(value: number) {
  if (value === 0) return 'no'
  if (value < 5) return 'moderate'
  return 'severe'
}
