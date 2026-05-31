import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import LivingNotebookLabShell, {
  type LivingNotebookLabAction,
  type LivingNotebookLabPrediction,
  type LivingNotebookLabStep,
} from '../product/LivingNotebookLabShell'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'

const queryHeads = 32
const layers = 32
const batch = 1
const headDim = 128
export const efficientAttentionWorkbenchLabId = 'efficient-attention-kv-cache-workbench'
export const efficientAttentionWorkbenchLabVersion = '2026-05-31'

const sequenceOptions = [
  { label: '2k', value: 2048 },
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
    label: 'It drops by the sharing factor',
    detail: 'Only H_q / g K/V heads are stored instead of all query heads.',
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

export type EfficientAttentionWorkbenchObservation = {
  predictionId: string
  predictionLabel: string
  roleLabel: string
  roleQuestion: string
  sequenceLength: number
  groupSize: number
  valueBytes: number
  queryHeads: number
  kvHeads: number
  layers: number
  batch: number
  headDim: number
  memoryGb: number
  mhaMemoryGb: number
  reduction: number
  pressure: number
  memoryLabel: string
  invariant: string
  evidence: string
  nextMove: string
}

type EfficientAttentionLivingLabPanelProps = {
  savedRouteSnapshot?: LearningRouteSnapshot | null
  onSaveObservation?: (observation: EfficientAttentionWorkbenchObservation) => boolean | void
}

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

export default function EfficientAttentionLivingLabPanel({
  savedRouteSnapshot,
  onSaveObservation,
}: EfficientAttentionLivingLabPanelProps) {
  const [sequenceLength, setSequenceLength] = useState(32768)
  const [groupSize, setGroupSize] = useState(4)
  const [valueBytes, setValueBytes] = useState(2)
  const [prediction, setPrediction] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [role, setRole] = useState<RoleOptionId>('learner')
  const [routeSaveStatus, setRouteSaveStatus] = useState<
    'idle' | 'needs-prediction' | 'revealed-unsaved' | 'carried' | 'dirty' | 'restored' | 'restore-mismatch' | 'error'
  >('idle')

  const kvHeads = Math.max(1, queryHeads / groupSize)
  const memoryGb = gbFor(sequenceLength, kvHeads, valueBytes)
  const mhaMemoryGb = gbFor(sequenceLength, queryHeads, valueBytes)
  const reduction = mhaMemoryGb / memoryGb
  const pressure = Math.max(6, Math.round((kvHeads / queryHeads) * 100))
  const expectedPrediction = groupSize === 1 ? 'same' : 'quarter'
  const predictionCorrect = prediction === expectedPrediction
  const activeRole = roleOptions.find((option) => option.id === role) ?? roleOptions[0]
  const activePredictionChoice = predictionChoices.find((choice) => choice.id === prediction)
  const predictionResult = revealed
    ? `${predictionCorrect ? 'Correct.' : 'Model repair.'} With g = ${groupSize}, H_kv changes from ${queryHeads} to ${kvHeads}, so the KV cache becomes ${reduction.toFixed(1)}x smaller at the same sequence length.`
    : 'Commit a prediction to reveal the measured memory.'
  const invariant =
    'For fixed B, L, T, d, and s, KV-cache memory scales linearly with stored K/V heads, not query heads.'
  const evidence = `g = ${groupSize} gives H_kv = ${kvHeads}, ${formatGb(memoryGb)} cache at ${sequenceLabel(sequenceLength)}, and ${reduction.toFixed(1)}x reduction vs ordinary MHA.`

  useEffect(() => {
    const observation = savedRouteSnapshot?.lastObservation
    const workbench = observation?.workbench
    const labState = workbench?.lab.state ?? observation?.labState
    const matchesCurrentWorkbench = workbench
      ? workbench.lab.id === efficientAttentionWorkbenchLabId &&
        workbench.lab.version === efficientAttentionWorkbenchLabVersion
      : Boolean(
          observation?.detail?.includes(`labId=${efficientAttentionWorkbenchLabId}`) &&
            observation.detail.includes(`labVersion=${efficientAttentionWorkbenchLabVersion}`)
        )

    if (
      savedRouteSnapshot?.mappingId !== 'concept:efficient-attention' ||
      !observation ||
      observation?.label !== 'Efficient attention workbench' ||
      observation.source !== 'kv-memory-lab' ||
      !labState ||
      !matchesCurrentWorkbench
    ) {
      if (observation?.label === 'Efficient attention workbench') {
        setRouteSaveStatus('restore-mismatch')
      }
      return
    }

    const savedGroupSize = queryHeads / labState.kvHeads
    if (groupOptions.some((option) => option.value === savedGroupSize)) {
      setGroupSize(savedGroupSize)
    }
    if (sequenceOptions.some((option) => option.value === labState.context)) {
      setSequenceLength(labState.context)
    }
    if (labState.bytes === 1 || labState.bytes === 2) {
      setValueBytes(labState.bytes)
    }

    const savedPredictionId = workbench?.committedPrediction.id ?? observation.detail?.match(/predictionId=([a-z-]+)/)?.[1]
    if (savedPredictionId && predictionChoices.some((choice) => choice.id === savedPredictionId)) {
      setPrediction(savedPredictionId)
    }
    setRevealed(true)
    setRouteSaveStatus('restored')
  }, [savedRouteSnapshot])

  function markRouteObservationDirty() {
    setRouteSaveStatus((status) => {
      if (status === 'carried' || status === 'restored') return 'dirty'
      if (status === 'error' || status === 'needs-prediction' || status === 'restore-mismatch') return status
      return revealed ? 'revealed-unsaved' : 'idle'
    })
  }

  const labPredictions: LivingNotebookLabPrediction[] = [
    {
      id: 'same',
      label: 'Same cache',
      claim: 'Query heads stay fixed, so the cache might look unchanged.',
      accent: '#1f4b99',
    },
    {
      id: 'quarter',
      label: 'Sharing-factor drop',
      claim: 'Only H_q / g K/V heads are stored, so memory should shrink by the grouping factor.',
      accent: '#1f6f78',
    },
    {
      id: 'little',
      label: 'Small drop',
      claim: 'Sequence length dominates the equation, so sharing heads might only help a little.',
      accent: '#7a5ea8',
    },
    {
      id: 'increase',
      label: 'Increase',
      claim: 'Each stored K/V head serves more query heads, so the cache might grow.',
      accent: '#b85b45',
    },
  ]

  const labSteps: LivingNotebookLabStep[] = [
    {
      key: 'question',
      label: 'Question',
      value: activeRole.frame,
      detail: activeRole.label,
    },
    {
      key: 'object',
      label: 'Object',
      value: 'KV-cache memory equation',
      detail: 'M_KV = B * L * T * 2 * H_kv * d * s',
    },
    {
      key: 'prediction',
      label: 'Prediction',
      value: activePredictionChoice?.label ?? 'Commit a memory prediction.',
      detail: activePredictionChoice?.detail ?? 'No prediction committed yet.',
    },
    {
      key: 'manipulation',
      label: 'Manipulation',
      value: `T = ${sequenceLabel(sequenceLength)}, g = ${groupSize}, s = ${valueBytes} bytes`,
      detail: `H_kv = ${kvHeads}`,
    },
    {
      key: 'evidence',
      label: 'Evidence',
      value: revealed ? `${formatGb(memoryGb)} cache, ${reduction.toFixed(1)}x reduction vs MHA` : 'Hidden until prediction.',
      detail: `${kvHeads} stored K/V heads`,
    },
    {
      key: 'invariant',
      label: 'Invariant',
      value: 'KV-cache memory scales linearly with stored K/V heads.',
      detail: 'Query heads stay visible.',
    },
    {
      key: 'next',
      label: 'Next',
      value: activeRole.next,
      detail: 'Carry this into long context and FlashAttention.',
    },
  ]

  const labActions: LivingNotebookLabAction[] = [
    {
      id: 'save-observation',
      label:
        routeSaveStatus === 'carried' || routeSaveStatus === 'restored'
          ? 'Observation carried'
          : routeSaveStatus === 'dirty'
            ? 'Update carried observation'
          : routeSaveStatus === 'needs-prediction'
            ? 'Reveal first'
          : routeSaveStatus === 'error'
            ? 'Save failed'
              : routeSaveStatus === 'restore-mismatch'
                ? 'Start fresh observation'
                : 'Carry observation',
      onClick: saveWorkbenchObservation,
      variant: revealed ? 'primary' : 'secondary',
    },
    {
      id: 'reveal-measurement',
      label: revealed ? 'Measurement revealed' : 'Reveal measurement',
      onClick: () => {
        if (!prediction) setPrediction('quarter')
        setRevealed(true)
        setRouteSaveStatus('revealed-unsaved')
      },
      variant: revealed ? 'secondary' : 'primary',
    },
    {
      id: 'open-full-demo',
      label: 'Open full KV demo',
      href: '#interactive-demo',
    },
    {
      id: 'ask-research-room',
      label: 'Ask research room',
      href: '#research-reading-room',
    },
  ]

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
    setRouteSaveStatus('revealed-unsaved')
  }

  function saveWorkbenchObservation() {
    if (!onSaveObservation) return
    const selectedPrediction = predictionChoices.find((choice) => choice.id === prediction)
    if (!revealed || !selectedPrediction) {
      setRouteSaveStatus('needs-prediction')
      return
    }

    const saved = onSaveObservation({
      predictionId: selectedPrediction.id,
      predictionLabel: selectedPrediction.label,
      roleLabel: activeRole.label,
      roleQuestion: activeRole.frame,
      sequenceLength,
      groupSize,
      valueBytes,
      queryHeads,
      kvHeads,
      layers,
      batch,
      headDim,
      memoryGb,
      mhaMemoryGb,
      reduction,
      pressure,
      memoryLabel: formatGb(memoryGb),
      invariant,
      evidence,
      nextMove: activeRole.next,
    })
    setRouteSaveStatus(saved === false ? 'error' : 'carried')
  }

  return (
    <LivingNotebookLabShell
      id="efficient-attention-living-lab"
      eyebrow="Efficient Attention Workbench"
      title="Make the KV-cache equation behave like an object."
      intro="Keep the equation fixed, choose the role lens, predict what grouping changes, then reveal the memory witness."
      selectedObject={{
        typeLabel: 'Selected equation',
        title: 'M_KV = B * L * T * 2 * H_kv * d * s',
        lensLabel: `${activeRole.label} lens`,
      }}
      steps={labSteps}
      predictionPrompt={`If ${queryHeads} query heads share K/V heads in groups of ${groupSize}, what happens to KV-cache memory compared with ordinary multi-head attention?`}
      predictions={labPredictions}
      activePredictionId={prediction || undefined}
      onSelectPrediction={commitPrediction}
      invariant={{
        title: invariant,
        detail:
          routeSaveStatus === 'carried'
            ? `${predictionResult} Carried into your route.`
            : routeSaveStatus === 'restored'
              ? `${predictionResult} Restored local lab note from your route.`
              : routeSaveStatus === 'dirty'
                ? `${predictionResult} This lab state changed since the carried observation.`
                : routeSaveStatus === 'revealed-unsaved'
                  ? `${predictionResult} Carry this observation to keep the route connected.`
            : routeSaveStatus === 'needs-prediction'
              ? `${predictionResult} Commit a prediction before saving this route observation.`
              : routeSaveStatus === 'error'
                ? `${predictionResult} Save failed in this browser.`
                : routeSaveStatus === 'restore-mismatch'
                  ? `${predictionResult} A saved note exists, but this lab version changed. Start fresh before carrying it.`
                  : predictionResult,
        accent: revealed ? '#1f6f78' : '#d7a741',
      }}
      actions={labActions}
    >
      <div className="efficient-lab-extension">
        <section className="role-lens-panel" aria-label="Role lenses">
          <div>
            <p className="panel-kicker">{activeRole.label} lens</p>
            <strong>{activeRole.frame}</strong>
            <span>{activeRole.next}</span>
          </div>
          <div className="role-lenses">
            {roleOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={role === option.id ? 'active' : undefined}
                aria-pressed={role === option.id}
                onClick={() => {
                  setRole(option.id)
                  markRouteObservationDirty()
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>

        <section className="equation-bench" aria-label="KV-cache equation manipulation bench">
          <div className="efficient-equation" aria-label="KV cache memory equation">
            <code>
              M_KV = B * L * <mark>T</mark> * 2 * <mark>H_kv</mark> * d * <mark>s</mark>
            </code>
            <code>
              H_kv = H_q / <mark>g</mark>
            </code>
          </div>

          <div className="efficient-constants" aria-label="Locked constants">
            <span>B = {batch}</span>
            <span>L = {layers}</span>
            <span>H_q = {queryHeads}</span>
            <span>d = {headDim}</span>
            <span>s = {valueBytes} bytes</span>
          </div>

          <div className="efficient-controls" aria-label="Manipulation bench">
            <label>
              <span>Sequence length T</span>
              <select
                value={sequenceLength}
                onChange={(event) => {
                  setSequenceLength(Number(event.target.value))
                  markRouteObservationDirty()
                }}
              >
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
                    onClick={() => {
                      setGroupSize(option.value)
                      markRouteObservationDirty()
                    }}
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
                  onClick={() => {
                    setValueBytes(2)
                    markRouteObservationDirty()
                  }}
                >
                  FP16/BF16
                </button>
                <button
                  type="button"
                  className={valueBytes === 1 ? 'active' : undefined}
                  aria-pressed={valueBytes === 1}
                  onClick={() => {
                    setValueBytes(1)
                    markRouteObservationDirty()
                  }}
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
        </section>

        <section className="evidence-grid" aria-label="Pinned evidence and next move">
          <article>
            <span>Pinned evidence for M_KV</span>
            <strong>GQA changes H_kv, not H_q.</strong>
            <p>Use the cache equation and live lane count to separate memory pressure from query-head count.</p>
          </article>
          {revealed ? (
            <article className="observation-card">
              <span>
                {routeSaveStatus === 'carried' || routeSaveStatus === 'restored'
                  ? 'Observation ledger carried'
                  : routeSaveStatus === 'dirty'
                    ? 'Observation ledger changed'
                    : 'Observation ledger'}
              </span>
              <p>What changed: g = {groupSize} gives H_kv = {kvHeads}.</p>
              <p>What stayed true: memory changes linearly with H_kv.</p>
              <p>Next: raise T to 128k and check whether the {reduction.toFixed(1)}x ratio survives.</p>
            </article>
          ) : (
            <article className="observation-card muted">
              <span>Observation ledger</span>
              <p>Hidden until the prediction is committed.</p>
            </article>
          )}
          <article className="next-card">
            <span>Next move</span>
            <strong>{activeRole.next}</strong>
          </article>
        </section>
      </div>

      <style jsx>{`
        .role-lenses {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.8rem;
        }

        .role-lenses button {
          min-height: 44px;
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

        .segmented-control button {
          min-height: 44px;
          border: 1px solid rgba(255, 248, 235, 0.18);
          border-radius: 9px;
          color: #fff8eb;
          background: rgba(255, 248, 235, 0.08);
          text-align: left;
          cursor: pointer;
        }

        .segmented-control button.active {
          border-color: rgba(215, 167, 65, 0.82);
          background: rgba(215, 167, 65, 0.18);
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

        @media (max-width: 620px) {
          .efficient-constants,
          .measurement-strip,
          .efficient-controls,
          .cache-witness {
            grid-template-columns: 1fr;
          }

          .efficient-equation code {
            font-size: 0.96rem;
          }
        }

        .efficient-lab-extension {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
        }

        .role-lens-panel,
        .equation-bench,
        .evidence-grid article {
          min-width: 0;
          border: 1px solid rgba(22, 33, 45, 0.12);
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.86);
          box-shadow: 0 14px 30px rgba(7, 16, 28, 0.06);
        }

        .role-lens-panel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.8rem;
          align-items: center;
          padding: 0.85rem;
        }

        .role-lens-panel strong,
        .evidence-grid strong {
          display: block;
          color: #172330;
          line-height: 1.3;
        }

        .role-lens-panel span,
        .evidence-grid p {
          display: block;
          margin-top: 0.28rem;
          color: #5c6b78;
          line-height: 1.45;
        }

        .panel-kicker,
        .role-lens-panel .panel-kicker,
        .efficient-controls span,
        .cache-witness span,
        .evidence-grid span {
          margin: 0 0 0.28rem;
          color: #1f6f78;
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .role-lenses {
          justify-content: flex-end;
          margin-top: 0;
        }

        .role-lenses button {
          min-height: 44px;
          background: rgba(255, 255, 255, 0.78);
        }

        .equation-bench {
          display: grid;
          gap: 0.85rem;
          padding: 0.95rem;
          background:
            linear-gradient(135deg, rgba(20, 33, 47, 0.94), rgba(20, 44, 58, 0.9)),
            #14212f;
          color: #fff8eb;
        }

        .efficient-controls {
          grid-template-columns: minmax(130px, 0.72fr) minmax(0, 1.45fr) minmax(0, 0.92fr);
        }

        .efficient-controls select,
        .segmented-control button {
          color: #fff8eb;
          background: rgba(255, 248, 235, 0.08);
        }

        .evidence-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          min-width: 0;
        }

        .evidence-grid article {
          display: grid;
          align-content: start;
          gap: 0.35rem;
          padding: 0.8rem;
        }

        .observation-card {
          border-left: 4px solid #d7a741 !important;
        }

        .observation-card.muted {
          border-left-color: rgba(31, 111, 120, 0.24) !important;
        }

        .next-card {
          border-left: 4px solid #1f4b99 !important;
        }

        @media (max-width: 760px) {
          .role-lens-panel,
          .evidence-grid,
          .efficient-controls,
          .cache-witness,
          .efficient-constants,
          .measurement-strip {
            grid-template-columns: 1fr;
          }

          .role-lenses {
            justify-content: stretch;
          }

          .role-lenses button {
            flex: 1 1 8rem;
          }
        }
      `}</style>
    </LivingNotebookLabShell>
  )
}
