import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

type Backend = 'dense' | 'sparse'
type Prediction = 'unstructured' | 'structured' | 'both'

const weights = [
  [0.92, -0.78, 0.64, -0.51, 0.42, -0.37, 0.28, -0.22],
  [0.18, -0.12, 0.09, -0.06, 0.05, -0.04, 0.03, -0.02],
  [0.55, -0.49, 0.36, -0.31, 0.22, -0.18, 0.14, -0.11],
  [0.08, -0.05, 0.04, -0.03, 0.02, -0.02, 0.01, -0.01],
  [0.74, -0.67, 0.53, -0.45, 0.34, -0.29, 0.19, -0.16],
  [0.29, -0.24, 0.18, -0.13, 0.1, -0.08, 0.06, -0.05],
]

const pruneOptions = [
  { label: '33%', value: 1 / 3 },
  { label: '50%', value: 0.5 },
  { label: '67%', value: 2 / 3 },
]

const flat = <T,>(rows: T[][]) => rows.flatMap((row) => row)
const norm = (values: number[]) => Math.sqrt(values.reduce((sum, value) => sum + value * value, 0))
const fmt = (value: number) => value.toFixed(value >= 10 ? 1 : 2)

function getUnstructuredMask(targetSparsity: number) {
  const indexed = flat(weights.map((row, rowIndex) => row.map((value, colIndex) => ({
    id: `${rowIndex}-${colIndex}`,
    value: Math.abs(value),
  })))).sort((a, b) => a.value - b.value)
  const pruneCount = Math.round(indexed.length * targetSparsity)
  const pruned = new Set(indexed.slice(0, pruneCount).map((item) => item.id))

  return weights.map((row, rowIndex) =>
    row.map((_, colIndex) => !pruned.has(`${rowIndex}-${colIndex}`))
  )
}

function getStructuredMask(targetSparsity: number) {
  const pruneRows = Math.round(weights.length * targetSparsity)
  const rowScores = weights
    .map((row, index) => ({ index, score: norm(row) }))
    .sort((a, b) => a.score - b.score)
  const pruned = new Set(rowScores.slice(0, pruneRows).map((row) => row.index))
  return weights.map((row, rowIndex) => row.map(() => !pruned.has(rowIndex)))
}

function summarize(mask: boolean[][], backend: Backend, structured: boolean) {
  const allWeights = flat(weights)
  const keptWeights = flat(weights.map((row, rowIndex) => row.map((value, colIndex) => (mask[rowIndex][colIndex] ? value : 0))))
  const keptCount = flat(mask).filter(Boolean).length
  const totalCount = flat(mask).length
  const sparsity = 1 - keptCount / totalCount
  const keptRows = mask.filter((row) => row.some(Boolean)).length
  const retainedNorm = norm(keptWeights) / norm(allWeights)
  const denseSpeed = structured ? weights.length / Math.max(1, keptRows) : 1
  const sparseSpeed = structured
    ? denseSpeed
    : sparsity >= 0.55
      ? 1 / Math.max(0.18, 1 - sparsity + 0.18)
      : 1
  const speed = backend === 'dense' ? denseSpeed : sparseSpeed

  return {
    keptCount,
    totalCount,
    sparsity,
    keptRows,
    retainedNorm,
    speed,
    score: retainedNorm * speed,
  }
}

function getWinner(unstructuredSpeed: number, structuredSpeed: number): Prediction {
  const uWins = unstructuredSpeed > 1.08
  const sWins = structuredSpeed > 1.08
  if (uWins && sWins) return 'both'
  if (uWins) return 'unstructured'
  return 'structured'
}

function winnerLabel(winner: Prediction) {
  if (winner === 'unstructured') return 'Unstructured zeros'
  if (winner === 'structured') return 'Structured channels'
  return 'Both patterns'
}

export default function PruningConceptViz() {
  const [targetSparsity, setTargetSparsity] = useState(0.5)
  const [backend, setBackend] = useState<Backend>('dense')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const analysis = useMemo(() => {
    const unstructuredMask = getUnstructuredMask(targetSparsity)
    const structuredMask = getStructuredMask(targetSparsity)
    const unstructured = summarize(unstructuredMask, backend, false)
    const structured = summarize(structuredMask, backend, true)
    const winner = getWinner(unstructured.speed, structured.speed)
    return {
      unstructuredMask,
      structuredMask,
      unstructured,
      structured,
      winner,
    }
  }, [backend, targetSparsity])

  const maxAbs = Math.max(...flat(weights).map((value) => Math.abs(value)))
  const predictionCorrect = prediction === analysis.winner

  useEffect(() => {
    emitDemoState({
      conceptId: 'pruning',
      label: 'Pruning structured-vs-unstructured demo',
      summary: revealed
        ? `${Math.round(targetSparsity * 100)}% pruning on ${backend} backend: ${winnerLabel(analysis.winner)} gives the visible speedup signal; unstructured speed ${fmt(analysis.unstructured.speed)}x, structured speed ${fmt(analysis.structured.speed)}x.`
        : `Learner is predicting whether individual zero masks or whole-channel pruning produce real speedup on a ${backend} backend.`,
      values: [
        `target sparsity: ${Math.round(targetSparsity * 100)}%`,
        `backend: ${backend}`,
        `prediction: ${prediction ?? 'none'}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `unstructured retained norm: ${fmt(analysis.unstructured.retainedNorm)}`,
        `structured retained norm: ${fmt(analysis.structured.retainedNorm)}`,
      ],
    })
  }, [
    analysis.structured.retainedNorm,
    analysis.structured.speed,
    analysis.unstructured.retainedNorm,
    analysis.unstructured.speed,
    analysis.winner,
    backend,
    prediction,
    revealed,
    targetSparsity,
  ])

  const resetReveal = () => setRevealed(false)

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Pruning: predict when zeros become speed"
      subtitle="Choose a pruning budget and backend, then predict whether unstructured zeros or structured channel removal has the clearer speedup path in this toy backend model."
      metrics={['mask M', 'sparsity', 'retained norm', 'dense shape']}
      challenge={
        <p>
          Before reveal, commit to the pruning pattern that should have the
          clearer speedup path on the selected backend. Storage sparsity and
          wall-clock speed are not the same thing.
        </p>
      }
      notes={
        <p>
          This toy uses retained weight norm as a quality proxy and a simple
          backend model for speed. Real pruning requires fine-tuning, kernel
          support, activation shapes, and hardware-aware benchmarking.
        </p>
      }
    >
      <VizStageAdapter padding="normal">
        <div className="pruning-demo">
          <div className="controls" aria-label="Pruning demo controls">
            <div className="control-group">
              <span>Pruning budget</span>
              <div className="segmented">
                {pruneOptions.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    className={targetSparsity === option.value ? 'active' : ''}
                    onClick={() => {
                      setTargetSparsity(option.value)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Backend</span>
              <div className="segmented">
                {[
                  ['dense', 'dense GPU'],
                  ['sparse', 'sparse kernel'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={backend === value ? 'active' : ''}
                    onClick={() => {
                      setBackend(value as Backend)
                      resetReveal()
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section className="prediction-panel">
            <h4>Predict which pattern becomes faster</h4>
            <div className="choice-row" role="group" aria-label="Pruning speedup prediction">
              {[
                ['unstructured', 'unstructured zeros'],
                ['structured', 'structured channels'],
                ['both', 'both patterns'],
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
            <MaskPanel
              title="Unstructured magnitude mask"
              subtitle="individual weights"
              mask={analysis.unstructuredMask}
              revealed={revealed}
              maxAbs={maxAbs}
            />
            <MaskPanel
              title="Structured channel mask"
              subtitle="whole rows"
              mask={analysis.structuredMask}
              revealed={revealed}
              maxAbs={maxAbs}
            />
            <section className="reveal-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>Backend</dt>
                  <dd>{backend === 'dense' ? 'dense GPU' : 'sparse kernel'}</dd>
                </div>
                <div>
                  <dt>Winner</dt>
                  <dd>{revealed ? winnerLabel(analysis.winner) : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>Kept rows</dt>
                  <dd>{revealed ? `${analysis.structured.keptRows}/${weights.length}` : 'Hidden'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                disabled={!prediction}
                onClick={() => setRevealed(true)}
              >
                Reveal speed path
              </button>
              {!prediction ? <p className="hint">Choose a prediction to unlock the reveal.</p> : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>{predictionCorrect ? 'Prediction matches.' : 'The deployment invariant is visible.'}</h4>
                  <p>
                    On a {backend === 'dense' ? 'dense GPU' : 'sparse-kernel backend'}, {winnerLabel(analysis.winner)}
                    {' '}has the visible speedup path. Unstructured pruning can preserve
                    more weight norm because it removes tiny weights first, but dense
                    matmul still sees the same matrix shape unless the backend exploits
                    sparse zeros.
                  </p>
                </div>
                <div className="metric-table" role="table" aria-label="Pruning metric comparison">
                  <div className="table-row head" role="row">
                    <span>strategy</span>
                    <span>sparsity</span>
                    <span>norm</span>
                    <span>speed</span>
                  </div>
                  <div className={analysis.winner === 'unstructured' || analysis.winner === 'both' ? 'table-row best' : 'table-row'} role="row">
                    <span>unstructured</span>
                    <span>{fmt(analysis.unstructured.sparsity * 100)}%</span>
                    <span>{fmt(analysis.unstructured.retainedNorm)}</span>
                    <span>{fmt(analysis.unstructured.speed)}x</span>
                  </div>
                  <div className={analysis.winner === 'structured' || analysis.winner === 'both' ? 'table-row best' : 'table-row'} role="row">
                    <span>structured</span>
                    <span>{fmt(analysis.structured.sparsity * 100)}%</span>
                    <span>{fmt(analysis.structured.retainedNorm)}</span>
                    <span>{fmt(analysis.structured.speed)}x</span>
                  </div>
                </div>
              </>
            ) : (
              <p>
                The masks and metrics are hidden until you commit. Magnitude
                pruning and shape pruning solve different deployment problems.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .pruning-demo {
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
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(220px, 0.75fr);
          }

          .control-group,
          .prediction-panel,
          .mask-panel,
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
            gap: 0.35rem;
          }

          .weight-row {
            display: grid;
            grid-template-columns: repeat(8, minmax(16px, 1fr));
            gap: 0.25rem;
          }

          .cell {
            display: grid;
            place-items: center;
            min-height: 28px;
            border-radius: 6px;
            background: rgba(27, 113, 128, calc(0.12 + var(--intensity) * 0.58));
            border: 1px solid rgba(24, 34, 45, 0.09);
            color: transparent;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            font-weight: 800;
          }

          .cell.pruned {
            background: #ede3d5;
            color: #8f3d2b;
            text-decoration: line-through;
          }

          .mask-panel p,
          .hint,
          .result p {
            margin: 0.7rem 0 0;
            color: #52606c;
            font-size: 0.86rem;
            line-height: 1.55;
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
            grid-template-columns: minmax(0, 1fr) minmax(320px, 0.9fr);
            gap: 0.85rem;
          }

          .result h4 {
            margin: 0;
            color: #1d5f68;
          }

          .metric-table {
            display: grid;
            gap: 0.25rem;
            align-content: start;
            min-width: 0;
          }

          .table-row {
            display: grid;
            grid-template-columns: 1fr 0.8fr 0.65fr 0.65fr;
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

          @media (max-width: 900px) {
            .controls,
            .stage-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 520px) {
            .weight-row {
              grid-template-columns: repeat(4, minmax(28px, 1fr));
            }

            .metric-table {
              overflow-x: auto;
            }

            .table-row {
              min-width: 420px;
            }
          }
        `}</style>
      </VizStageAdapter>
    </VizShell>
  )
}

function MaskPanel({
  title,
  subtitle,
  mask,
  revealed,
  maxAbs,
}: {
  title: string
  subtitle: string
  mask: boolean[][]
  revealed: boolean
  maxAbs: number
}) {
  return (
    <section className="mask-panel">
      <div className="panel-head">
        <h4>{title}</h4>
        <span>{subtitle}</span>
      </div>
      <div className="weight-grid" aria-label={title}>
        {weights.map((row, rowIndex) => (
          <div className="weight-row" key={rowIndex}>
            {row.map((value, colIndex) => {
              const kept = mask[rowIndex][colIndex]
              const visible = revealed ? kept : true
              return (
                <span
                  key={`${rowIndex}-${colIndex}`}
                  className={visible ? 'cell' : 'cell pruned'}
                  style={{ '--intensity': Math.min(1, Math.abs(value) / maxAbs).toString() } as CSSProperties}
                  title={`w=${fmt(value)}`}
                >
                  {visible ? '' : '0'}
                </span>
              )
            })}
          </div>
        ))}
      </div>
      <p>{revealed ? 'Pruned entries are shown as zeros.' : 'Mask is hidden until reveal.'}</p>

      <style jsx>{`
        .mask-panel {
          border: 1px solid rgba(24, 34, 45, 0.1);
          background: rgba(255, 253, 248, 0.8);
          border-radius: 14px;
          padding: 0.85rem;
          min-width: 0;
        }

        .panel-head {
          display: flex;
          justify-content: space-between;
          gap: 0.6rem;
          align-items: baseline;
          margin-bottom: 0.7rem;
          color: #30404f;
          font-size: 0.82rem;
        }

        .panel-head h4 {
          margin: 0;
          color: #30404f;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .panel-head span {
          color: #66727d;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .weight-grid {
          display: grid;
          gap: 0.35rem;
        }

        .weight-row {
          display: grid;
          grid-template-columns: repeat(8, minmax(16px, 1fr));
          gap: 0.25rem;
        }

        .cell {
          display: grid;
          place-items: center;
          min-height: 28px;
          border-radius: 6px;
          background: rgba(27, 113, 128, calc(0.12 + var(--intensity) * 0.58));
          border: 1px solid rgba(24, 34, 45, 0.09);
          color: transparent;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 800;
        }

        .cell.pruned {
          background: #ede3d5;
          color: #8f3d2b;
          text-decoration: line-through;
        }

        p {
          margin: 0.7rem 0 0;
          color: #52606c;
          font-size: 0.86rem;
          line-height: 1.55;
        }

        @media (max-width: 520px) {
          .weight-row {
            grid-template-columns: repeat(4, minmax(28px, 1fr));
          }
        }
      `}</style>
    </section>
  )
}
