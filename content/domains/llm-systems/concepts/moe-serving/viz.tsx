import { useEffect, useMemo, useState } from 'react'
import VizStageAdapter from '@/components/viz/VizStageAdapter'
import { emitDemoState } from '../../../../../lib/demoState'

type Prediction = 'straggler' | 'communication' | 'balanced'
type Network = 'fast' | 'slow'
type Skew = 'balanced' | 'moderate' | 'hot'

const tokenOptions = [512, 2048, 4096]
const expertOptions = [8, 16, 32]
const topKOptions = [1, 2]
const skewOptions: Array<{ value: Skew; label: string }> = [
  { value: 'balanced', label: 'balanced' },
  { value: 'moderate', label: 'moderate skew' },
  { value: 'hot', label: 'hot expert' },
]
const networkOptions: Array<{ value: Network; label: string; gbps: number }> = [
  { value: 'fast', label: 'fast fabric', gbps: 900 },
  { value: 'slow', label: 'tight fabric', gbps: 120 },
]

const MOE_SERVING_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    text: 'Pick hot expert, dispatch bytes, or tied latency before metrics unlock.',
  },
  {
    label: 'Observe',
    text: 'Reveal expert loads, all-to-all payload, and proxy layer time.',
  },
  {
    label: 'Ground',
    text: 'Compare max expert time with communication time.',
  },
  {
    label: 'Carry',
    text: 'Sparse compute helps only when routing and fabric stay balanced.',
  },
] as const

const dModel = 4096
const bytesPerElement = 2
const expertTokenMicros = 0.075

const fmt = (value: number) => value.toFixed(value >= 10 ? 1 : 2)
const fmtBytes = (bytes: number) => {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GiB`
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`
  return `${bytes.toFixed(0)} B`
}

function getWeights(experts: number, skew: Skew) {
  return Array.from({ length: experts }, (_, index) => {
    if (skew === 'balanced') return 1 + ((index * 7) % 5) * 0.04
    if (skew === 'moderate') return index === 0 ? 3.2 : index === 1 ? 1.9 : 0.9 + ((index * 5) % 7) * 0.05
    return index === 0 ? 8.5 : index === 1 ? 2.4 : index === 2 ? 1.5 : 0.72 + ((index * 3) % 5) * 0.06
  })
}

function largestRemainderCounts(total: number, weights: number[]) {
  const sum = weights.reduce((acc, value) => acc + value, 0)
  const raw = weights.map((weight) => (weight / sum) * total)
  const counts = raw.map(Math.floor)
  let remaining = total - counts.reduce((acc, value) => acc + value, 0)
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac)
  for (let i = 0; i < remaining; i += 1) counts[order[i % order.length].index] += 1
  return counts
}

function analyze(tokens: number, experts: number, topK: number, skew: Skew, network: Network) {
  const assignments = tokens * topK
  const counts = largestRemainderCounts(assignments, getWeights(experts, skew))
  const avg = assignments / experts
  const maxLoad = Math.max(...counts)
  const minLoad = Math.min(...counts)
  const stragglerFactor = maxLoad / avg
  const commBytes = 2 * tokens * topK * dModel * bytesPerElement
  const gbps = networkOptions.find((option) => option.value === network)?.gbps ?? networkOptions[0].gbps
  const commMs = (commBytes / (gbps * 1e9)) * 1000
  const expertMs = (maxLoad * expertTokenMicros) / 1000
  const layerMs = Math.max(commMs, expertMs)
  const winner: Prediction =
    commMs > expertMs * 1.15
      ? 'communication'
      : expertMs > commMs * 1.15
        ? 'straggler'
        : 'balanced'

  return {
    assignments,
    counts,
    avg,
    maxLoad,
    minLoad,
    stragglerFactor,
    commBytes,
    commMs,
    expertMs,
    layerMs,
    winner,
    gbps,
  }
}

function winnerLabel(winner: Prediction) {
  if (winner === 'straggler') return 'Hot expert straggler'
  if (winner === 'communication') return 'All-to-all communication'
  return 'Balanced / tied'
}

export default function MoEServingConceptViz() {
  const [tokens, setTokens] = useState(2048)
  const [experts, setExperts] = useState(16)
  const [topK, setTopK] = useState(2)
  const [skew, setSkew] = useState<Skew>('hot')
  const [network, setNetwork] = useState<Network>('fast')
  const [prediction, setPrediction] = useState<Prediction | null>(null)
  const [revealed, setRevealed] = useState(false)

  const stats = useMemo(() => analyze(tokens, experts, topK, skew, network), [experts, network, skew, tokens, topK])
  const predictionCorrect = prediction === stats.winner
  const evidenceActiveIndex = revealed ? 3 : prediction ? 1 : 0
  const evidencePhase = MOE_SERVING_EVIDENCE_STEPS[evidenceActiveIndex]?.label ?? 'Predict'

  useEffect(() => {
    const visibleValues = revealed
      ? [
          'evidence loop: predict -> observe -> ground -> carry',
          `evidence phase: ${evidencePhase}`,
          `tokens: ${tokens}`,
          `experts: ${experts}`,
          `top-k: ${topK}`,
          `skew: ${skew}`,
          `fabric: ${network} (${stats.gbps}Gbps)`,
          `prediction: ${prediction ? winnerLabel(prediction) : 'none'}`,
          `winner: ${winnerLabel(stats.winner)}`,
          `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
          `max/mean load: ${fmt(stats.stragglerFactor)}x`,
          `max expert load: ${stats.maxLoad}`,
          `all-to-all bytes: ${fmtBytes(stats.commBytes)}`,
          `communication time: ${fmt(stats.commMs)} ms`,
          `expert straggler time: ${fmt(stats.expertMs)} ms`,
          `layer proxy: ${fmt(stats.layerMs)} ms`,
          `revealed: yes`,
        ]
      : [
          'evidence loop: predict -> observe -> ground -> carry',
          `evidence phase: ${evidencePhase}`,
          `tokens: ${tokens}`,
          `experts: ${experts}`,
          `top-k: ${topK}`,
          `skew: ${skew}`,
          `network: ${network}`,
          `prediction: ${prediction ?? 'none'}`,
          `revealed: no`,
        ]

    emitDemoState({
      conceptId: 'moe-serving',
      label: 'MoE serving routing-skew demo',
      summary: revealed
        ? `${tokens} tokens, E=${experts}, top-k=${topK}, ${skew} routing: winner ${winnerLabel(stats.winner)}, max/mean load ${fmt(stats.stragglerFactor)}x, communication ${fmtBytes(stats.commBytes)}.`
        : `Learner is predicting whether routing skew or token-dispatch traffic bottlenecks MoE layer latency.`,
      values: visibleValues,
    })
  }, [
    evidencePhase,
    experts,
    network,
    prediction,
    predictionCorrect,
    revealed,
    skew,
    stats.commBytes,
    stats.commMs,
    stats.expertMs,
    stats.gbps,
    stats.layerMs,
    stats.maxLoad,
    stats.stragglerFactor,
    stats.winner,
    tokens,
    topK,
  ])

  const resetReveal = () => setRevealed(false)
  const maxLoad = Math.max(...stats.counts)

  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable MoE serving bottleneck visualization"
    >
        <div className="moe-demo">
          <div className="controls" aria-label="MoE serving demo controls">
            <div className="control-group">
              <span>Tokens T</span>
              <div className="segmented">
                {tokenOptions.map((option) => (
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
              <span>Experts E</span>
              <div className="segmented">
                {expertOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={experts === option ? 'active' : ''}
                    onClick={() => {
                      setExperts(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Top-k</span>
              <div className="segmented">
                {topKOptions.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={topK === option ? 'active' : ''}
                    onClick={() => {
                      setTopK(option)
                      resetReveal()
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Routing skew</span>
              <div className="segmented">
                {skewOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={skew === option.value ? 'active' : ''}
                    onClick={() => {
                      setSkew(option.value)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="control-group">
              <span>Fabric</span>
              <div className="segmented">
                {networkOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={network === option.value ? 'active' : ''}
                    onClick={() => {
                      setNetwork(option.value)
                      resetReveal()
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <section
            className="prediction-panel"
            data-child-demo-gate="moe-serving-bottleneck"
          >
            <h4>Predict the bottleneck</h4>
            <div className="choice-row" role="group" aria-label="MoE serving bottleneck prediction">
              {[
                ['straggler', 'hot expert straggler'],
                ['communication', 'dispatch bytes'],
                ['balanced', 'balanced / tied'],
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
            <div className="evidence-strip" aria-label="MoE serving evidence loop">
              {MOE_SERVING_EVIDENCE_STEPS.map((step, index) => (
                <div
                  key={step.label}
                  className={index <= evidenceActiveIndex ? 'evidence-step active' : 'evidence-step'}
                >
                  <strong>{step.label}</strong>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="stage-grid">
            <section className="load-panel">
              <div className="panel-head">
                <h4>Expert loads</h4>
                <span>{revealed ? `max/mean ${fmt(stats.stragglerFactor)}x` : 'hidden until reveal'}</span>
              </div>
              <div
                className="expert-grid"
                aria-label="Per-expert token assignments"
                style={{ gridTemplateColumns: `repeat(${experts > 16 ? 16 : 8}, minmax(28px, 1fr))` }}
              >
                {stats.counts.map((count, index) => {
                  const hot = count === stats.maxLoad
                  return (
                    <div key={index} className={hot && revealed ? 'expert hot' : 'expert'}>
                      <span>E{index}</span>
                      <i style={{ height: revealed ? `${Math.max(8, (count / maxLoad) * 100)}%` : '30%' }} />
                      <strong>{revealed ? count : '??'}</strong>
                    </div>
                  )
                })}
              </div>
              <p>Layer time waits for the slowest expert, not the average expert.</p>
            </section>

            <section className="dispatch-panel">
              <div className="panel-head">
                <h4>Dispatch + combine</h4>
                <span>{revealed ? fmtBytes(stats.commBytes) : 'bytes hidden'}</span>
              </div>
              <div className="flow-lanes" aria-label="Token dispatch all-to-all diagram">
                <div className="pool attention">attention GPUs</div>
                <div className="lane">
                  <span style={{ width: revealed ? `${Math.min(100, 35 + topK * 22)}%` : '38%' }} />
                  <span style={{ width: revealed ? `${Math.min(100, 30 + (tokens / 4096) * 55)}%` : '38%' }} />
                </div>
                <div className="pool experts">expert GPUs</div>
              </div>
              <p>
                Bytes scale with 2 x T x k x d_model x bytes: dispatch out,
                combine back.
              </p>
            </section>

            <section className="reveal-panel">
              <h4>Reveal</h4>
              <dl>
                <div>
                  <dt>Expert time</dt>
                  <dd>{revealed ? `${fmt(stats.expertMs)} ms` : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>Comm time</dt>
                  <dd>{revealed ? `${fmt(stats.commMs)} ms` : 'Hidden'}</dd>
                </div>
                <div>
                  <dt>Layer proxy</dt>
                  <dd>{revealed ? `${fmt(stats.layerMs)} ms` : 'Hidden'}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="reveal"
                disabled={!prediction}
                onClick={() => setRevealed(true)}
              >
                Reveal bottleneck
              </button>
              {!prediction ? <p className="hint">Choose a bottleneck prediction to unlock the reveal.</p> : null}
            </section>
          </div>

          <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
            {revealed ? (
              <>
                <div className="result-copy">
                  <h4>{predictionCorrect ? 'Prediction matches.' : 'The serving invariant is visible.'}</h4>
                  <p>
                    {winnerLabel(stats.winner)} dominates this configuration. MoE
                    reduces activated compute, but the serving layer still pays
                    for token dispatch and the hottest expert. The useful mental
                    model is max expert load plus dispatch bytes, not average
                    FLOPs alone.
                  </p>
                </div>
                <div className="metric-table" role="table" aria-label="MoE serving metric comparison">
                  <div className="table-row head" role="row">
                    <span>term</span>
                    <span>value</span>
                    <span>meaning</span>
                  </div>
                  <div className={stats.winner === 'straggler' ? 'table-row best' : 'table-row'} role="row">
                    <span>max n_e</span>
                    <span>{stats.maxLoad}</span>
                    <span>straggler expert</span>
                  </div>
                  <div className={stats.winner === 'communication' ? 'table-row best' : 'table-row'} role="row">
                    <span>all-to-all</span>
                    <span>{fmtBytes(stats.commBytes)}</span>
                    <span>dispatch + combine</span>
                  </div>
                  <div className={stats.winner === 'balanced' ? 'table-row best' : 'table-row'} role="row">
                    <span>proxy</span>
                    <span>{fmt(stats.layerMs)} ms</span>
                    <span>max(comm, expert)</span>
                  </div>
                </div>
              </>
            ) : (
              <p>
                The loads and times are hidden until you commit. Sparse compute
                is only useful if routing and communication keep the serving
                system balanced.
              </p>
            )}
          </section>
        </div>

        <style jsx>{`
          .moe-demo {
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
            grid-template-columns: repeat(5, minmax(0, 1fr));
          }

          .stage-grid {
            grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) minmax(220px, 0.78fr);
          }

          .control-group,
          .prediction-panel,
          .load-panel,
          .dispatch-panel,
          .reveal-panel,
          .result {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: rgba(255, 253, 248, 0.8);
            border-radius: 8px;
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

          .evidence-strip {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 0.5rem;
            margin-top: 0.72rem;
            padding: 0.58rem;
            border-radius: 10px;
            border: 1px solid rgba(27, 113, 128, 0.18);
            background:
              linear-gradient(135deg, rgba(27, 113, 128, 0.18), rgba(24, 34, 45, 0.93)),
              #18222d;
          }

          .evidence-step {
            display: grid;
            gap: 0.22rem;
            min-width: 0;
            padding: 0.58rem;
            border-radius: 8px;
            border: 1px solid rgba(255, 255, 255, 0.12);
            background: rgba(255, 255, 255, 0.06);
            opacity: 0.58;
          }

          .evidence-step.active {
            opacity: 1;
            border-color: rgba(121, 216, 230, 0.28);
            background: rgba(27, 113, 128, 0.28);
          }

          .evidence-step strong {
            color: #ecfeff;
            font-size: 0.72rem;
            line-height: 1.2;
          }

          .evidence-step span {
            color: #d6e7e8;
            font-size: 0.7rem;
            line-height: 1.34;
            overflow-wrap: anywhere;
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

          .expert-grid {
            display: grid;
            grid-template-columns: repeat(8, minmax(34px, 1fr));
            gap: 0.35rem;
            align-items: end;
            min-height: 150px;
          }

          .expert {
            display: grid;
            grid-template-rows: auto 1fr auto;
            gap: 0.25rem;
            align-items: end;
            min-height: 128px;
          }

          .expert span,
          .expert strong {
            color: #66727d;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            text-align: center;
          }

          .expert i {
            display: block;
            width: 100%;
            border-radius: 6px 6px 3px 3px;
            background: #1b7180;
            min-height: 8px;
          }

          .expert.hot i {
            background: #8f3d2b;
          }

          .flow-lanes {
            display: grid;
            grid-template-columns: 1fr;
            gap: 0.8rem;
            padding: 0.2rem 0;
          }

          .pool {
            border: 1px solid rgba(24, 34, 45, 0.1);
            background: #fffaf0;
            border-radius: 8px;
            padding: 0.75rem;
            color: #30404f;
            font-weight: 800;
            text-align: center;
          }

          .pool.experts {
            background: #eef6f4;
          }

          .lane {
            display: grid;
            gap: 0.35rem;
          }

          .lane span {
            display: block;
            height: 11px;
            border-radius: 999px;
            background: #8f3d2b;
            justify-self: center;
          }

          .lane span:last-child {
            background: #1b7180;
          }

          .load-panel p,
          .dispatch-panel p,
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
            border-radius: 8px;
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
            grid-template-columns: 0.78fr 0.78fr 1.2fr;
            gap: 0.45rem;
            padding: 0.5rem 0.55rem;
            border-radius: 8px;
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

          @media (max-width: 1080px) {
            .controls {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }

            .stage-grid,
            .result.shown {
              grid-template-columns: 1fr;
            }

            .evidence-strip {
              grid-template-columns: repeat(2, minmax(0, 1fr));
            }
          }

          @media (max-width: 520px) {
            .controls {
              grid-template-columns: 1fr;
            }

            .evidence-strip {
              grid-template-columns: 1fr;
            }

            .expert-grid {
              grid-template-columns: repeat(4, minmax(34px, 1fr)) !important;
            }

            .expert {
              min-height: 104px;
            }

            .metric-table {
              overflow-x: auto;
            }

            .table-row {
              min-width: 430px;
            }
          }
        `}</style>
    </VizStageAdapter>
  )
}
