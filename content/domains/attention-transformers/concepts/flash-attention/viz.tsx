import { useEffect, useMemo, useState } from 'react'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

type Prediction = 'scores' | 'qkv' | 'same'
type MergePrediction = 'keep' | 'rescale' | 'store'

const sequenceOptions = [512, 1024, 2048, 4096]
const dimOptions = [64, 128]
const tileOptions = [32, 64, 128, 256]
const bytesPerValue = 2

const rowBlocks = [
  { label: 'tile A', scores: [1.2, 0.6], values: [0.1, 0.4] },
  { label: 'tile B', scores: [2.4, 1.0], values: [0.8, -0.2] },
  { label: 'tile C', scores: [0.2, 1.8], values: [-0.1, 0.5] },
]

const formatBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${bytes.toFixed(0)} B`
}

const mergeBlocks = (count: number) => {
  let m = -Infinity
  let l = 0
  let o = 0

  const rows = rowBlocks.slice(0, count).map((block) => {
    const oldM = m
    const oldL = l
    const oldO = o
    const blockM = Math.max(...block.scores)
    const expScores = block.scores.map((score) => Math.exp(score - blockM))
    const blockL = expScores.reduce((sum, value) => sum + value, 0)
    const blockO = expScores.reduce((sum, value, index) => sum + value * block.values[index], 0)
    const nextM = Math.max(oldM, blockM)
    const oldScale = Number.isFinite(oldM) ? Math.exp(oldM - nextM) : 0
    const blockScale = Math.exp(blockM - nextM)

    l = oldScale * oldL + blockScale * blockL
    o = oldScale * oldO + blockScale * blockO
    m = nextM

    return {
      ...block,
      oldM,
      blockM,
      nextM,
      oldScale,
      blockScale,
      l,
      output: o / l,
      hadNewMax: blockM > oldM,
    }
  })

  return rows
}

export default function FlashAttentionConceptViz() {
  const [tokens, setTokens] = useState(2048)
  const [headDim, setHeadDim] = useState(64)
  const [tile, setTile] = useState(128)
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [mergePrediction, setMergePrediction] = useState<MergePrediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const metrics = useMemo(() => {
    const scoreMatrixBytes = tokens * tokens * bytesPerValue
    const qkvBytes = 3 * tokens * headDim * bytesPerValue
    const tileScoreBytes = tile * tile * bytesPerValue
    const tilesPerAxis = Math.ceil(tokens / tile)
    const storedRatio = scoreMatrixBytes / tileScoreBytes
    const dominant: Prediction = scoreMatrixBytes > qkvBytes * 1.1 ? 'scores' : qkvBytes > scoreMatrixBytes * 1.1 ? 'qkv' : 'same'

    return {
      scoreMatrixBytes,
      qkvBytes,
      tileScoreBytes,
      tilesPerAxis,
      storedRatio,
      dominant,
    }
  }, [headDim, tile, tokens])

  const streamedRows = useMemo(() => mergeBlocks(revealed ? rowBlocks.length : 1), [revealed])
  const blockB = useMemo(() => mergeBlocks(2)[1], [])
  const predictionCorrect = prediction === metrics.dominant
  const mergeCorrect = mergePrediction === 'rescale'

  useEffect(() => {
    const neutralValues = [
      `tokens: ${tokens}`,
      `head dim: ${headDim}`,
      `tile: ${tile}`,
      `prediction: ${prediction ?? 'none'}`,
      `merge prediction: ${mergePrediction ?? 'none'}`,
      'measured bytes: locked until reveal',
      'online softmax table: locked until reveal',
      'revealed: no',
    ]
    const revealedValues = [
      `tokens: ${tokens}`,
      `head dim: ${headDim}`,
      `tile: ${tile}`,
      `prediction: ${prediction ?? 'none'}`,
      `actual dominant object: ${dominantLabel(metrics.dominant)}`,
      `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
      `merge prediction: ${mergePrediction ?? 'none'}`,
      `merge rule actual: rescale old l,o`,
      `merge prediction correct: ${mergeCorrect ? 'yes' : 'no'}`,
      `naive score matrix: ${formatBytes(metrics.scoreMatrixBytes)}`,
      `QKV tensors: ${formatBytes(metrics.qkvBytes)}`,
      `single score tile: ${formatBytes(metrics.tileScoreBytes)}`,
      `stored-score ratio: ${metrics.storedRatio.toFixed(0)}x`,
      `tile B old scale: ${blockB.oldScale.toFixed(2)}`,
      `tile B l: ${blockB.l.toFixed(2)}`,
      `tile B out: ${blockB.output.toFixed(2)}`,
      'revealed: yes',
    ]

    emitDemoState({
      conceptId: 'flash-attention',
      label: 'FlashAttention IO-aware tiling demo',
      summary: revealed
        ? `For T=${tokens}, d=${headDim}, a naive stored score matrix is ${formatBytes(metrics.scoreMatrixBytes)} while one ${tile}x${tile} score tile is ${formatBytes(metrics.tileScoreBytes)}. The online softmax reveal shows old l and o rescaled when tile B raises the row max.`
        : `Learner is choosing whether stored T x T scores or QKV tensors dominate for T=${tokens}, d=${headDim}, tile=${tile}. Measured bytes and merge-state numbers stay locked until reveal.`,
      values: revealed ? revealedValues : neutralValues,
    })
  }, [
    blockB.l,
    blockB.oldScale,
    blockB.output,
    headDim,
    mergeCorrect,
    mergePrediction,
    metrics.dominant,
    metrics.qkvBytes,
    metrics.scoreMatrixBytes,
    metrics.storedRatio,
    metrics.tileScoreBytes,
    predictionCorrect,
    prediction,
    revealed,
    tile,
    tokens,
  ])

  const resetReveal = () => {
    setRevealed(false)
  }

  return (
    <VizShell
      eyebrow="Interactive demo"
      title="FlashAttention: predict the IO bottleneck"
      subtitle="Commit to the memory bottleneck, then reveal how tiled online softmax keeps exact attention without storing a full T x T probability matrix."
      metrics={['T x T score matrix', 'tile in SRAM', 'running m, l, o', 'exact attention output']}
      challenge={
        <p>
          Before reveal, choose the largest stored object and the online-softmax
          merge rule when a later tile has a larger row max.
        </p>
      }
      notes={
        <p>
          This toy isolates one attention head and stored score/probability
          memory. Real kernels also optimize memory traffic, parallelism, masks,
          backward pass, and hardware-specific scheduling.
        </p>
      }
    >
      <VizStageAdapter padding="normal">
        <div className="flash-demo">
          <div className="controls" aria-label="FlashAttention demo controls">
            <div className="control-group">
              <span>Tokens T</span>
              <div className="segmented">
                {sequenceOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={tokens === option ? 'active' : ''}
                    onClick={() => {
                      setTokens(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Head dim d</span>
              <div className="segmented">
                {dimOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={headDim === option ? 'active' : ''}
                    onClick={() => {
                      setHeadDim(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Score tile</span>
              <div className="segmented">
                {tileOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={tile === option ? 'active' : ''}
                    onClick={() => {
                      setTile(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="prediction-grid">
            <section className="prediction-panel">
              <h4>1. Predict the largest stored object</h4>
              <div className="choice-row" role="group" aria-label="Memory bottleneck prediction">
                {[
                  ['scores', 'T x T scores'],
                  ['qkv', 'Q,K,V tensors'],
                  ['same', 'About tied'],
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

            <section className="prediction-panel">
              <h4>2. Predict the tile-B merge rule</h4>
              <div className="choice-row" role="group" aria-label="Online softmax merge prediction">
                {[
                  ['keep', 'Keep old l,o'],
                  ['rescale', 'Rescale old l,o'],
                  ['store', 'Store old probabilities'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={mergePrediction === value ? 'selected' : ''}
                    onClick={() => {
                      setMergePrediction(value as MergePrediction)
                      resetReveal()
                    }}
                    aria-pressed={mergePrediction === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="memory-grid">
            <section className="matrix-panel" aria-label="Naive score matrix">
              <div className="panel-head">
                <h4>Naive attention</h4>
                <strong>{revealed ? formatBytes(metrics.scoreMatrixBytes) : 'Locked until reveal'}</strong>
              </div>
              <div className="matrix">
                {Array.from({ length: 64 }).map((_, index) => (
                  <span key={index} className={index % 9 === 0 ? 'hot' : ''} />
                ))}
              </div>
              <p>Stores or rereads a dense T x T score/probability object.</p>
            </section>

            <section className="matrix-panel flash" aria-label="FlashAttention tiled score block">
              <div className="panel-head">
                <h4>FlashAttention tile</h4>
                <strong>{revealed ? formatBytes(metrics.tileScoreBytes) : 'Locked until reveal'}</strong>
              </div>
              <div className="tile-stage">
                <div className="tile-grid">
                  {Array.from({ length: 16 }).map((_, index) => (
                    <span key={index} className={index === 5 ? 'active-tile' : ''} />
                  ))}
                </div>
                <div className="state-stack">
                  <span>m</span>
                  <span>l</span>
                  <span>o</span>
                </div>
              </div>
              <p>
                Visits about {metrics.tilesPerAxis * metrics.tilesPerAxis} score
                tiles, but only keeps a tile plus row statistics on chip.
              </p>
            </section>

            <section className="readout-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>Q,K,V memory</dt>
                  <dd>{revealed ? formatBytes(metrics.qkvBytes) : 'Computed after prediction'}</dd>
                </div>
                <div>
                  <dt>Stored-score ratio</dt>
                  <dd>{revealed ? `${metrics.storedRatio.toFixed(0)}x` : 'Computed after prediction'}</dd>
                </div>
                <div>
                  <dt>Dominant object</dt>
                  <dd>{revealed ? dominantLabel(metrics.dominant) : 'Locked until reveal'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                onClick={() => setRevealed(true)}
                disabled={!prediction || !mergePrediction}
              >
                Reveal invariant
              </button>
              {!prediction || !mergePrediction ? (
                <p className="hint">Choose both predictions to unlock the reveal.</p>
              ) : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>
                    {predictionCorrect && mergeCorrect
                      ? 'Both predictions match the invariant.'
                      : 'The invariant is now visible.'}
                  </h4>
                  <p>
                    Tile B has max {blockB.blockM.toFixed(1)}, larger than the
                    previous running max {blockB.oldM.toFixed(1)}. The old
                    normalizer and output accumulator must be multiplied by
                    exp(old_m - new_m) = {blockB.oldScale.toFixed(2)} before
                    adding tile B. That is why FlashAttention can stream blocks
                    exactly instead of storing old probabilities.
                  </p>
                </div>
                <div className="state-table" role="table" aria-label="Online softmax running state">
                  <div role="row" className="table-head">
                    <span>block</span>
                    <span>m</span>
                    <span>old scale</span>
                    <span>l</span>
                    <span>out</span>
                  </div>
                  {streamedRows.map((row) => (
                    <div role="row" key={row.label} className={row.hadNewMax ? 'new-max' : ''}>
                      <span>{row.label}</span>
                      <span>{row.nextM.toFixed(1)}</span>
                      <span>{row.oldScale.toFixed(2)}</span>
                      <span>{row.l.toFixed(2)}</span>
                      <span>{row.output.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p>
                Prediction is locked before the numbers are shown. The hidden
                check asks which object dominates memory, and whether online
                softmax can merge a later larger-max tile without storing old
                probabilities.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .flash-demo {
            display: grid;
            gap: 1rem;
            color: #18222d;
          }

          .controls,
          .prediction-grid,
          .memory-grid {
            display: grid;
            gap: 0.75rem;
          }

          .controls {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .control-group,
          .prediction-panel,
          .matrix-panel,
          .readout-panel,
          .result {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: rgba(255, 253, 248, 0.78);
            border-radius: 14px;
            padding: 0.85rem;
            min-width: 0;
          }

          .control-group > span,
          .panel-head,
          h4 {
            font-size: 0.82rem;
            color: #30404f;
          }

          .control-group > span,
          h4 {
            display: block;
            margin: 0 0 0.55rem;
            font-weight: 700;
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
            color: #ffffff;
            border-color: #1b7180;
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }

          .prediction-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .memory-grid {
            grid-template-columns: minmax(0, 1.1fr) minmax(0, 1.1fr) minmax(220px, 0.8fr);
            align-items: stretch;
          }

          .panel-head {
            display: flex;
            justify-content: space-between;
            gap: 0.6rem;
            margin-bottom: 0.65rem;
          }

          .panel-head h4 {
            margin: 0;
          }

          .panel-head strong {
            color: #8f3d2b;
            font-family: var(--font-mono);
            font-size: 0.82rem;
          }

          .matrix {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            gap: 3px;
            aspect-ratio: 1;
            max-height: 220px;
          }

          .matrix span,
          .tile-grid span {
            border-radius: 4px;
            background: #e4d8c6;
            border: 1px solid rgba(24, 34, 45, 0.08);
          }

          .matrix span.hot {
            background: #d26a4c;
          }

          .tile-stage {
            display: grid;
            grid-template-columns: minmax(120px, 1fr) 72px;
            gap: 0.8rem;
            align-items: center;
          }

          .tile-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
            aspect-ratio: 1;
            max-height: 220px;
          }

          .tile-grid span.active-tile {
            background: #1b7180;
            box-shadow: 0 0 0 3px rgba(27, 113, 128, 0.14);
          }

          .state-stack {
            display: grid;
            gap: 0.45rem;
          }

          .state-stack span {
            display: grid;
            place-items: center;
            min-height: 42px;
            border-radius: 10px;
            background: #f0f6f4;
            border: 1px solid rgba(27, 113, 128, 0.18);
            color: #155d68;
            font-family: var(--font-mono);
            font-weight: 800;
          }

          .matrix-panel p,
          .hint,
          .result p {
            margin: 0.65rem 0 0;
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
            grid-template-columns: minmax(0, 1fr) minmax(280px, 0.92fr);
            gap: 0.85rem;
          }

          .result h4 {
            margin: 0;
            color: #1d5f68;
          }

          .state-table {
            display: grid;
            gap: 0.25rem;
            align-content: start;
            min-width: 0;
          }

          .state-table [role='row'] {
            display: grid;
            grid-template-columns: 1fr 0.6fr 0.8fr 0.7fr 0.7fr;
            gap: 0.4rem;
            align-items: center;
            padding: 0.48rem 0.55rem;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.74);
            color: #344654;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .state-table .table-head {
            color: #66727d;
            background: transparent;
            font-weight: 800;
          }

          .state-table .new-max {
            background: #e6f2f1;
            color: #155d68;
          }

          @media (max-width: 860px) {
            .controls,
            .prediction-grid,
            .memory-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }

            .matrix,
            .tile-grid {
              max-height: none;
            }
          }

          @media (max-width: 520px) {
            .tile-stage {
              grid-template-columns: 1fr;
            }

            .state-stack {
              grid-template-columns: repeat(3, 1fr);
            }

            .state-table {
              overflow-x: auto;
            }

            .state-table [role='row'] {
              min-width: 420px;
            }
          }
        `}</style>
      </VizStageAdapter>
    </VizShell>
  )
}

function dominantLabel(prediction: Prediction) {
  if (prediction === 'scores') return 'T x T scores'
  if (prediction === 'qkv') return 'Q,K,V tensors'
  return 'About tied'
}
