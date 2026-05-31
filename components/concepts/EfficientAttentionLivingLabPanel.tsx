import { useMemo, useState, type CSSProperties } from 'react'

const queryHeads = 32
const layers = 32
const batch = 1
const headDim = 128

const sequenceOptions = [
  { label: '1k', value: 1024 },
  { label: '8k', value: 8192 },
  { label: '32k', value: 32768 },
  { label: '128k', value: 131072 },
]

const groupOptions = [
  { label: '1 = MHA', value: 1 },
  { label: '2', value: 2 },
  { label: '4', value: 4 },
  { label: '8', value: 8 },
  { label: '32 = MQA', value: 32 },
]

const predictionChoices = [
  {
    id: 'same',
    label: 'It stays about the same',
    detail: 'The number of query heads is unchanged.',
  },
  {
    id: 'quarter',
    label: 'It drops to about one quarter',
    detail: 'Only 8 K/V heads are stored instead of 32.',
  },
  {
    id: 'little',
    label: 'It drops only a little',
    detail: 'Sequence length dominates everything.',
  },
  {
    id: 'increase',
    label: 'It increases',
    detail: 'Each K/V head must serve more queries.',
  },
]

const roleOptions = [
  {
    id: 'learner',
    label: 'Learner',
    frame: 'What symbol changed, and what stayed fixed?',
    next: 'Move g from 1 to 4, then say why the ratio changes before reading the invariant.',
  },
  {
    id: 'researcher',
    label: 'Researcher',
    frame: 'Which claim is supported by the equation, and which claim needs a quality experiment?',
    next: 'Keep the memory claim separate from the open model-quality question.',
  },
  {
    id: 'builder',
    label: 'Builder',
    frame: 'Which stored tensor becomes cheaper to keep and read during decoding?',
    next: 'Translate H_kv into a cache allocation and bandwidth budget.',
  },
  {
    id: 'instructor',
    label: 'Instructor',
    frame: 'Which misconception should be repaired before discussing FlashAttention?',
    next: 'Ask learners to distinguish cache size, cache reads, and attention-kernel IO.',
  },
] as const

type RoleOptionId = (typeof roleOptions)[number]['id']

function gbFor(sequenceLength: number, kvHeads: number, valueBytes: number) {
  const bytes = batch * layers * sequenceLength * 2 * kvHeads * headDim * valueBytes
  return bytes / 1_000_000_000
}

function formatGb(value: number) {
  if (value >= 100) return `${Math.round(value)} GB`
  if (value >= 10) return `${value.toFixed(1)} GB`
  return `${value.toFixed(2)} GB`
}

function sequenceLabel(value: number) {
  return sequenceOptions.find((option) => option.value === value)?.label ?? `${value}`
}

export default function EfficientAttentionLivingLabPanel() {
  const [sequenceLength, setSequenceLength] = useState(32768)
  const [groupSize, setGroupSize] = useState(4)
  const [valueBytes, setValueBytes] = useState(2)
  const [prediction, setPrediction] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [role, setRole] = useState<RoleOptionId>('learner')

  const kvHeads = Math.max(1, queryHeads / groupSize)
  const memoryGb = gbFor(sequenceLength, kvHeads, valueBytes)
  const mhaMemoryGb = gbFor(sequenceLength, queryHeads, valueBytes)
  const reduction = mhaMemoryGb / memoryGb
  const pressure = Math.max(6, Math.round((kvHeads / queryHeads) * 100))
  const predictionCorrect = prediction === 'quarter'
  const activeRole = roleOptions.find((option) => option.id === role) ?? roleOptions[0]

  const queryLaneGroups = useMemo(
    () =>
      Array.from({ length: queryHeads }, (_, index) => ({
        id: `q${index + 1}`,
        group: Math.floor(index / groupSize),
      })),
    [groupSize]
  )

  const kvLanes = useMemo(
    () =>
      Array.from({ length: kvHeads }, (_, index) => ({
        id: `kv${index + 1}`,
      })),
    [kvHeads]
  )

  function commitPrediction(choiceId: string) {
    setPrediction(choiceId)
    setRevealed(true)
  }

  return (
    <section id="efficient-attention-living-lab" className="efficient-lab" aria-labelledby="efficient-lab-title">
      <aside className="efficient-lab-spine" aria-label="Efficient Attention learning loop">
        <p>Living Notebook Lab</p>
        <strong>Why does GQA reduce KV-cache pressure?</strong>
        <div className="role-lenses" aria-label="Role lenses">
          {roleOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              className={role === option.id ? 'active' : undefined}
              aria-pressed={role === option.id}
              onClick={() => setRole(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <ol>
          {['Question', 'Object', 'Prediction', 'Manipulation', 'Evidence', 'Invariant', 'Next Move'].map((step) => (
            <li key={step} className={step === 'Prediction' ? 'active' : undefined}>
              {step}
            </li>
          ))}
        </ol>
      </aside>

      <div className="efficient-lab-room">
        <div className="efficient-object-label">
          <span>Selected object</span>
          <h2 id="efficient-lab-title">KV-cache memory equation</h2>
          <p>Explains why sharing K/V heads reduces decode-time memory pressure.</p>
        </div>

        <div className="efficient-equation" aria-label="KV cache memory equation">
          <code>
            M_KV = B * L * <mark className="term-t">T</mark> * 2 * <mark className="term-h">H_kv</mark> * d *{' '}
            <mark className="term-s">s</mark>
          </code>
          <code>
            H_kv = H_q / <mark className="term-g">g</mark>
          </code>
        </div>

        <div className="efficient-constants" aria-label="Locked constants">
          <span>B = {batch}</span>
          <span>L = {layers}</span>
          <span>H_q = {queryHeads}</span>
          <span>d = {headDim}</span>
          <span>s = {valueBytes} bytes</span>
        </div>

        <div className="efficient-prediction">
          <div>
            <span>Prediction</span>
            <strong>
              If 32 query heads share K/V heads in groups of 4, what happens to KV-cache memory compared with ordinary
              multi-head attention?
            </strong>
          </div>
          <div className="prediction-grid">
            {predictionChoices.map((choice) => (
              <button
                type="button"
                key={choice.id}
                className={prediction === choice.id ? 'selected' : undefined}
                aria-pressed={prediction === choice.id}
                onClick={() => commitPrediction(choice.id)}
              >
                <strong>{choice.label}</strong>
                <span>{choice.detail}</span>
              </button>
            ))}
          </div>
          {revealed ? (
            <p className={`prediction-result ${predictionCorrect ? 'correct' : 'missed'}`}>
              {predictionCorrect ? 'Correct.' : 'Model repair.'} With g = {groupSize}, H_kv changes from {queryHeads} to{' '}
              {kvHeads}, so the KV cache becomes {reduction.toFixed(1)}x smaller at the same sequence length.
            </p>
          ) : (
            <p className="prediction-result">Commit a prediction to reveal the measured memory.</p>
          )}
        </div>

        <div className="efficient-controls" aria-label="Manipulation bench">
          <label>
            <span>Sequence length T</span>
            <select value={sequenceLength} onChange={(event) => setSequenceLength(Number(event.target.value))}>
              {sequenceOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <div className="segmented-control" aria-label="KV sharing group size g">
            <span>KV sharing group size g</span>
            <div>
              {groupOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={groupSize === option.value ? 'active' : undefined}
                  aria-pressed={groupSize === option.value}
                  onClick={() => setGroupSize(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="segmented-control" aria-label="Value precision s">
            <span>Value precision s</span>
            <div>
              <button
                type="button"
                className={valueBytes === 2 ? 'active' : undefined}
                aria-pressed={valueBytes === 2}
                onClick={() => setValueBytes(2)}
              >
                FP16/BF16
              </button>
              <button
                type="button"
                className={valueBytes === 1 ? 'active' : undefined}
                aria-pressed={valueBytes === 1}
                onClick={() => setValueBytes(1)}
              >
                INT8 cache
              </button>
            </div>
          </div>
        </div>

        <div className="cache-witness" aria-label="Cache lane witness">
          <div className="lane-block">
            <span>32 query heads stay visible</span>
            <div className="query-lanes">
              {queryLaneGroups.map((lane) => (
                <i key={lane.id} style={{ '--lane-group': lane.group } as CSSProperties} />
              ))}
            </div>
          </div>
          <div className="lane-block">
            <span>{kvHeads} stored K/V heads after grouping</span>
            <div className="kv-lanes">
              {kvLanes.map((lane) => (
                <i key={lane.id} />
              ))}
            </div>
          </div>
        </div>

        <div className="measurement-strip" aria-label="Measured cache state">
          <span>
            <strong>{kvHeads}</strong>
            KV heads
          </span>
          <span>
            <strong>{revealed ? formatGb(memoryGb) : 'hidden'}</strong>
            cache at {sequenceLabel(sequenceLength)}
          </span>
          <span>
            <strong>{revealed ? `${reduction.toFixed(1)}x` : 'hidden'}</strong>
            reduction vs MHA
          </span>
          <span className="pressure">
            <strong>{revealed ? `${pressure}%` : 'hidden'}</strong>
            bandwidth pressure
          </span>
        </div>
      </div>

      <aside className="efficient-evidence" aria-label="Pinned evidence and next move">
        <article>
          <span>Pinned evidence for M_KV</span>
          <strong>GQA changes H_kv, not H_q.</strong>
          <p>Use the cache equation and live lane count to separate memory pressure from query-head count.</p>
        </article>
        <article className="lens-card">
          <span>{activeRole.label} lens</span>
          <strong>{activeRole.frame}</strong>
          <p>{activeRole.next}</p>
        </article>
        <article className="invariant-card">
          <span>Invariant</span>
          <strong>
            For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.
          </strong>
        </article>
        {revealed ? (
          <article className="observation-card">
            <span>Observation ledger</span>
            <p>What changed: g = {groupSize} gives H_kv = {kvHeads}.</p>
            <p>What stayed true: memory changes linearly with H_kv.</p>
            <p>Next: raise T to 128k and check whether the {reduction.toFixed(1)}x ratio survives.</p>
          </article>
        ) : null}
        <article className="next-card">
          <span>Next move</span>
          <strong>{activeRole.next}</strong>
        </article>
      </aside>

      <style jsx>{`
        .efficient-lab {
          display: grid;
          grid-template-columns: minmax(180px, 0.55fr) minmax(0, 1.55fr) minmax(240px, 0.72fr);
          gap: 0.85rem;
          align-items: stretch;
          margin: 1rem 0;
          scroll-margin-top: 9rem;
          color: #14212f;
        }

        .efficient-lab-spine,
        .efficient-lab-room,
        .efficient-evidence article {
          border: 1px solid rgba(22, 33, 45, 0.14);
          border-radius: 12px;
          background: rgba(255, 251, 245, 0.88);
          box-shadow: 0 18px 42px rgba(7, 16, 28, 0.08);
        }

        .efficient-lab-spine {
          padding: 0.85rem;
        }

        .efficient-lab-spine p,
        .efficient-object-label span,
        .efficient-prediction span,
        .efficient-controls span,
        .cache-witness span,
        .efficient-evidence span {
          margin: 0;
          color: #1f6f78;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .efficient-lab-spine strong {
          display: block;
          margin-top: 0.45rem;
          font-size: 1rem;
          line-height: 1.25;
        }

        .efficient-lab-spine ol {
          display: grid;
          gap: 0.4rem;
          margin: 0.85rem 0 0;
          padding: 0;
          list-style: none;
        }

        .role-lenses {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.8rem;
        }

        .role-lenses button {
          min-height: 34px;
          border: 1px solid rgba(31, 111, 120, 0.18);
          border-radius: 999px;
          padding: 0.32rem 0.56rem;
          color: #304352;
          background: rgba(255, 255, 255, 0.58);
          font-size: 0.74rem;
          font-weight: 850;
          cursor: pointer;
        }

        .role-lenses button.active {
          border-color: rgba(31, 111, 120, 0.42);
          color: #0f4f57;
          background: rgba(127, 202, 196, 0.24);
        }

        .efficient-lab-spine li {
          border-left: 3px solid rgba(31, 75, 153, 0.14);
          padding: 0.34rem 0 0.34rem 0.55rem;
          color: #5c6b78;
          font-size: 0.82rem;
          font-weight: 800;
        }

        .efficient-lab-spine li.active {
          border-left-color: #d7a741;
          color: #172330;
          background: rgba(215, 167, 65, 0.12);
        }

        .efficient-lab-room {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
          padding: 0.95rem;
          background:
            linear-gradient(135deg, rgba(20, 33, 47, 0.94), rgba(20, 44, 58, 0.9)),
            #14212f;
          color: #fff8eb;
        }

        .efficient-object-label h2 {
          margin: 0.2rem 0;
          color: #fff8eb;
          font-family: Georgia, 'Times New Roman', serif;
          font-size: clamp(1.55rem, 3.2vw, 2.55rem);
          line-height: 1;
        }

        .efficient-object-label p {
          margin: 0;
          color: rgba(255, 248, 235, 0.78);
          line-height: 1.45;
        }

        .efficient-equation {
          display: grid;
          gap: 0.45rem;
          border: 1px solid rgba(255, 248, 235, 0.18);
          border-radius: 12px;
          padding: 0.85rem;
          background: rgba(255, 248, 235, 0.08);
        }

        .efficient-equation code {
          overflow-wrap: anywhere;
          color: #fff8eb;
          font-size: clamp(1rem, 1.6vw, 1.42rem);
          line-height: 1.35;
        }

        mark {
          border-radius: 6px;
          padding: 0.05rem 0.18rem;
          color: #1c2530;
          background: #d7a741;
        }

        .efficient-constants,
        .measurement-strip {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .efficient-constants span,
        .measurement-strip span {
          border: 1px solid rgba(255, 248, 235, 0.15);
          border-radius: 9px;
          padding: 0.55rem;
          color: rgba(255, 248, 235, 0.78);
          background: rgba(255, 248, 235, 0.07);
          font-size: 0.78rem;
          font-weight: 800;
        }

        .measurement-strip strong {
          display: block;
          color: #7fcac4;
          font-size: 1.1rem;
        }

        .efficient-prediction {
          display: grid;
          gap: 0.7rem;
        }

        .efficient-prediction strong {
          display: block;
          margin-top: 0.2rem;
          color: #fff8eb;
          line-height: 1.35;
        }

        .prediction-grid button strong {
          color: #fff8eb;
        }

        .prediction-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .prediction-grid button,
        .segmented-control button {
          min-height: 44px;
          border: 1px solid rgba(255, 248, 235, 0.18);
          border-radius: 9px;
          color: #fff8eb;
          background: rgba(255, 248, 235, 0.08);
          text-align: left;
          cursor: pointer;
        }

        .prediction-grid button {
          display: grid;
          gap: 0.25rem;
          padding: 0.62rem;
        }

        .prediction-grid button.selected,
        .segmented-control button.active {
          border-color: rgba(215, 167, 65, 0.82);
          background: rgba(215, 167, 65, 0.18);
        }

        .prediction-grid span {
          color: rgba(255, 248, 235, 0.72);
          font-size: 0.78rem;
          letter-spacing: 0;
          text-transform: none;
        }

        .prediction-result {
          margin: 0;
          border-radius: 9px;
          padding: 0.62rem;
          color: rgba(255, 248, 235, 0.78);
          background: rgba(255, 248, 235, 0.08);
          line-height: 1.45;
        }

        .prediction-result.correct {
          color: #dff7f2;
          background: rgba(31, 111, 120, 0.32);
        }

        .prediction-result.missed {
          color: #fff1e2;
          background: rgba(184, 91, 69, 0.28);
        }

        .efficient-controls {
          display: grid;
          grid-template-columns: minmax(130px, 0.7fr) minmax(0, 1.45fr) minmax(0, 0.9fr);
          gap: 0.6rem;
        }

        .efficient-controls label,
        .segmented-control {
          display: grid;
          gap: 0.38rem;
          min-width: 0;
        }

        .efficient-controls select {
          min-height: 44px;
          border: 1px solid rgba(255, 248, 235, 0.18);
          border-radius: 9px;
          padding: 0.55rem;
          color: #fff8eb;
          background: rgba(255, 248, 235, 0.08);
          font-weight: 800;
        }

        .segmented-control div {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .segmented-control button {
          padding: 0.46rem 0.58rem;
          text-align: center;
          font-weight: 800;
        }

        .cache-witness {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.65rem;
        }

        .lane-block {
          display: grid;
          gap: 0.45rem;
        }

        .query-lanes,
        .kv-lanes {
          display: grid;
          grid-template-columns: repeat(16, minmax(2px, 1fr));
          gap: 3px;
          min-height: 68px;
          align-items: stretch;
          border-radius: 10px;
          padding: 0.45rem;
          background: rgba(255, 248, 235, 0.08);
        }

        .query-lanes i,
        .kv-lanes i {
          border-radius: 999px;
          background: #d7a741;
        }

        .kv-lanes {
          grid-template-columns: repeat(auto-fit, minmax(8px, 1fr));
        }

        .kv-lanes i {
          background: #7fcac4;
        }

        .efficient-evidence {
          display: grid;
          gap: 0.65rem;
          min-width: 0;
        }

        .efficient-evidence article {
          display: grid;
          gap: 0.42rem;
          padding: 0.78rem;
        }

        .efficient-evidence strong {
          line-height: 1.25;
        }

        .efficient-evidence p {
          margin: 0;
          color: #5c6b78;
          line-height: 1.42;
        }

        .invariant-card {
          border-left: 4px solid #1f6f78 !important;
        }

        .lens-card {
          border-left: 4px solid #7fcac4 !important;
        }

        .observation-card {
          border-left: 4px solid #d7a741 !important;
        }

        .next-card {
          border-left: 4px solid #1f4b99 !important;
        }

        @media (max-width: 1120px) {
          .efficient-lab {
            grid-template-columns: 1fr;
          }

          .efficient-lab-spine ol {
            grid-template-columns: repeat(7, minmax(0, 1fr));
          }

          .efficient-lab-spine li {
            border-left: 0;
            border-top: 3px solid rgba(31, 75, 153, 0.14);
            padding: 0.45rem 0.25rem;
          }
        }

        @media (max-width: 620px) {
          .efficient-lab {
            margin-inline: -0.35rem;
          }

          .efficient-lab-spine,
          .efficient-lab-room,
          .efficient-evidence article {
            border-radius: 10px;
          }

          .efficient-lab-spine ol {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .efficient-constants,
          .measurement-strip,
          .prediction-grid,
          .efficient-controls,
          .cache-witness {
            grid-template-columns: 1fr;
          }

          .efficient-equation code {
            font-size: 0.96rem;
          }
        }
      `}</style>
    </section>
  )
}
