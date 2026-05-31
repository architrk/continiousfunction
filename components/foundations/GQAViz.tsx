'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { emitDemoState } from '../../lib/demoState'

type ArchitectureId = 'MHA' | 'GQA' | 'MQA'
type GamePhase = 'setup' | 'countdown' | 'reveal'

type GQAVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

// Challenge scenarios for architecture prediction
const ARCH_CHALLENGES = [
  { name: '🚀 Max Throughput', description: 'Maximize inference speed for high-volume serving', bestArch: 'MQA' as ArchitectureId, hint: 'Memory bandwidth is the bottleneck' },
  { name: '🎯 Quality First', description: 'Preserve model quality at any cost', bestArch: 'MHA' as ArchitectureId, hint: 'Each head attends independently' },
  { name: '⚖️ Balanced Trade-off', description: 'Good quality + reasonable memory savings', bestArch: 'GQA' as ArchitectureId, hint: 'Llama 3 chose this approach' },
  { name: '🎲 Mystery Scenario', description: '???', bestArch: 'GQA' as ArchitectureId, hint: 'Random!' },
]

function getArchPredictionFeedback(
  predicted: ArchitectureId,
  actual: ArchitectureId,
  _scenarioName: string
): string {
  const explanations: Record<ArchitectureId, string> = {
    'MHA': 'MHA gives each query head its own KV head, maximizing expressiveness. Best when quality is paramount and memory is abundant.',
    'GQA': 'GQA shares KV heads among groups of query heads. Llama-family models use this pattern to reduce KV-cache size; the exact reduction is Hq / Hkv.',
    'MQA': 'MQA uses a single KV head for ALL queries—maximum memory savings but some quality loss. Great for high-throughput serving.',
  }

  if (predicted === actual) {
    return `Correct! ${explanations[actual]}`
  }

  return `The best choice was ${actual}. ${explanations[actual]} Your pick (${predicted}): ${explanations[predicted]}`
}

interface ArchConfig {
  id: ArchitectureId
  label: string
  shortLabel: string
  description: string
  numQHeads: number
  numKVHeads: number
}

// Llama 3-ish assumptions for one attention layer
const D_MODEL = 4096
const LLAMA3_NUM_Q_HEADS = 32
const HEAD_DIM = D_MODEL / LLAMA3_NUM_Q_HEADS // 128

const ARCH_CONFIGS: ArchConfig[] = [
  {
    id: 'MHA',
    shortLabel: 'MHA',
    label: 'Multi-Head Attention',
    description: 'One KV head per query head.',
    numQHeads: 32,
    numKVHeads: 32,
  },
  {
    id: 'GQA',
    shortLabel: 'GQA',
    label: 'Grouped Query Attention',
    description: 'Groups of queries share each KV head (4:1 here).',
    numQHeads: 32,
    numKVHeads: 8,
  },
  {
    id: 'MQA',
    shortLabel: 'MQA',
    label: 'Multi-Query Attention',
    description: 'All query heads share a single KV head.',
    numQHeads: 32,
    numKVHeads: 1,
  },
]

const NOTEBOOK_HQ_OPTIONS = [16, 32, 64]
const NOTEBOOK_HEAD_DIM_OPTIONS = [64, 128]
const NOTEBOOK_CONTEXT_OPTIONS = [4096, 32768, 128000, 256000]
const NOTEBOOK_BATCH = 1
const NOTEBOOK_LAYERS = 32
const NOTEBOOK_BYTES = 2

function getKvHeadOptions(hq: number): number[] {
  return Array.from(new Set([hq, hq / 2, hq / 4, hq / 8, 1]
    .filter((value) => Number.isInteger(value) && value >= 1 && hq % value === 0)))
}

function getGroupSizeOptions(hq: number): number[] {
  return Array.from(new Set([1, 2, 4, 8, 16, 32, 64]
    .filter((value) => value <= hq && hq % value === 0)))
}

function getArchitectureClass(hq: number, hkv: number): ArchitectureId {
  if (hkv === hq) return 'MHA'
  if (hkv === 1) return 'MQA'
  return 'GQA'
}

function getKvCacheGb({
  tokens,
  layers,
  hkv,
  headDim,
  batch = NOTEBOOK_BATCH,
  bytes = NOTEBOOK_BYTES,
}: {
  tokens: number
  layers: number
  hkv: number
  headDim: number
  batch?: number
  bytes?: number
}): number {
  return batch * layers * tokens * hkv * headDim * 2 * bytes / 1e9
}

function formatGb(value: number): string {
  if (value >= 100) return `${value.toFixed(0)} GB`
  if (value >= 10) return `${value.toFixed(1)} GB`
  return `${value.toFixed(2)} GB`
}

function formatPercent(value: number): string {
  const percent = value * 100
  if (percent < 10) return `${percent.toFixed(1)}%`
  return `${percent.toFixed(0)}%`
}

function formatTokens(value: number): string {
  if (value === 4096) return '4k'
  if (value === 32768) return '32k'
  return value >= 1000 ? `${Math.round(value / 1000)}k` : String(value)
}

function formatRatioChoice(value: number): string {
  if (value === 1) return '100%'
  const inverse = 1 / value
  if (Number.isInteger(inverse)) return `1/${inverse}`
  return formatPercent(value)
}

function formatReductionFactor(value: number): string {
  return Number.isInteger(value) ? `${value}x` : `${value.toFixed(1)}x`
}

interface ParamStats {
  qParams: number
  kvParams: number
  totalParams: number
}

// Only Q/K/V projections; shared output projection is ignored (same across all)
function getParamStats(config: ArchConfig): ParamStats {
  const qParams = D_MODEL * (config.numQHeads * HEAD_DIM)
  const kParams = D_MODEL * (config.numKVHeads * HEAD_DIM)
  const vParams = D_MODEL * (config.numKVHeads * HEAD_DIM)
  const kvParams = kParams + vParams
  const totalParams = qParams + kvParams
  return { qParams, kvParams, totalParams }
}

// Very rough KV cache footprint per token, in "elements"
function getKvCachePerToken(config: ArchConfig): number {
  return 2 * config.numKVHeads * HEAD_DIM // K + V
}

function formatParams(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toString()
}

interface ArchitectureDiagramColumnProps {
  config: ArchConfig
  isActive: boolean
}

const ArchitectureDiagramColumn: React.FC<ArchitectureDiagramColumnProps> = ({
  config,
  isActive,
}) => {
  const width = 260
  const height = 260
  const paddingTop = 26
  const paddingBottom = 26
  const qX = 70
  const kvX = 190

  const qSpacing =
    (height - paddingTop - paddingBottom) / (config.numQHeads - 1)
  const kvSpacing =
    config.numKVHeads > 1
      ? (height - paddingTop - paddingBottom) / (config.numKVHeads - 1)
      : 0

  const qNodes = useMemo(
    () =>
      Array.from({ length: config.numQHeads }, (_, i) => ({
        index: i,
        x: qX,
        y: paddingTop + i * qSpacing,
      })),
    [config.numQHeads, qX, paddingTop, qSpacing],
  )

  const kvNodes = useMemo(
    () =>
      Array.from({ length: config.numKVHeads }, (_, i) => ({
        index: i,
        x: kvX,
        y:
          config.numKVHeads === 1
            ? height / 2
            : paddingTop + i * kvSpacing,
      })),
    [config.numKVHeads, kvX, height, paddingTop, kvSpacing],
  )

  const edges = useMemo(() => {
    const groupSize =
      config.numKVHeads === config.numQHeads
        ? 1
        : config.numKVHeads === 1
        ? config.numQHeads
        : config.numQHeads / config.numKVHeads

    return qNodes.map(q => {
      let groupIndex: number
      if (config.numKVHeads === config.numQHeads) {
        // MHA: one KV per Q
        groupIndex = q.index
      } else if (config.numKVHeads === 1) {
        // MQA: all Qs share single KV
        groupIndex = 0
      } else {
        // GQA: groups of Q share a KV head
        groupIndex = Math.floor(q.index / groupSize)
      }
      const kv = kvNodes[Math.min(config.numKVHeads - 1, groupIndex)]
      return {
        id: `${config.id}-edge-${q.index}`,
        x1: q.x,
        y1: q.y,
        x2: kv.x,
        y2: kv.y,
      }
    })
  }, [config.id, config.numQHeads, config.numKVHeads, qNodes, kvNodes])

  return (
    <div
      style={{
        flex: '1 1 15rem',
        minWidth: 'min(100%, 15rem)',
        borderRadius: '0.75rem',
        border: isActive
          ? '1px solid rgba(249, 115, 22, 0.9)'
          : '1px solid rgba(31, 41, 55, 1)',
        padding: '0.75rem 0.75rem 0.9rem',
        background:
          'radial-gradient(circle at top left, rgba(15,23,42,0.8), rgba(15,23,42,1))',
        transform: isActive ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: isActive
          ? '0 18px 45px rgba(0,0,0,0.75)'
          : '0 8px 24px rgba(0,0,0,0.45)',
        opacity: isActive ? 1 : 0.7,
        transition: 'all 0.35s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      data-active={isActive}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: '0.4rem',
        }}
      >
        <div>
          <div
            style={{
              fontSize: '0.75rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'rgba(148, 163, 184, 0.9)',
            }}
          >
            {config.shortLabel}
          </div>
          <div
            style={{
              fontSize: '0.9rem',
              fontWeight: 600,
              color: '#e5e7eb',
            }}
          >
            {config.label}
          </div>
        </div>
        <div
          style={{
            fontSize: '0.7rem',
            color: 'rgba(148, 163, 184, 0.85)',
            textAlign: 'right',
          }}
        >
          {config.numQHeads} Q heads
          <br />
          {config.numKVHeads} KV heads
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Grouped Query Attention visualization showing query heads sharing key-value heads for memory efficiency"
        style={{
          display: 'block',
          borderRadius: '0.5rem',
          background:
            'linear-gradient(to bottom, rgba(15,23,42,0.8), rgba(15,23,42,1))',
        }}
      >
        {/* Connections */}
        <g stroke="rgba(148, 163, 184, 0.45)" strokeWidth={0.7}>
          {edges.map(e => (
            <line
              key={e.id}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              style={{
                transition: 'stroke 0.3s ease, opacity 0.3s ease',
                opacity: isActive ? 0.85 : 0.4,
              }}
            />
          ))}
        </g>

        {/* Query heads (orange circles) */}
        <g>
          {qNodes.map(q => {
            const lightness =
              45 + (q.index / (config.numQHeads - 1)) * 20
            const fill = `hsl(27, 96%, ${lightness}%)`
            return (
              <circle
                key={`q-${q.index}`}
                cx={q.x}
                cy={q.y}
                r={4}
                fill={fill}
                stroke="rgba(250, 250, 249, 0.7)"
                strokeWidth={0.7}
              />
            )
          })}
        </g>

        {/* KV heads (teal squares) */}
        <g>
          {kvNodes.map(kv => {
            const lightness =
              40 + (kv.index / Math.max(1, config.numKVHeads - 1)) * 15
            const fill = `hsl(172, 66%, ${lightness}%)`
            const size = 9
            return (
              <rect
                key={`kv-${kv.index}`}
                x={kv.x - size / 2}
                y={kv.y - size / 2}
                width={size}
                height={size}
                rx={1.5}
                ry={1.5}
                fill={fill}
                stroke="rgba(15, 23, 42, 0.8)"
                strokeWidth={0.8}
              />
            )
          })}
        </g>

        {/* Axis labels */}
        <text
          x={qX}
          y={16}
          textAnchor="middle"
          fill="rgba(148, 163, 184, 0.9)"
          fontSize="8"
        >
          Query heads (Q)
        </text>
        <text
          x={kvX}
          y={16}
          textAnchor="middle"
          fill="rgba(148, 163, 184, 0.9)"
          fontSize="8"
        >
          Shared KV heads
        </text>
      </svg>

      <div
        style={{
          fontSize: '0.72rem',
          color: 'rgba(148, 163, 184, 0.9)',
          marginTop: '0.35rem',
        }}
      >
        {config.description}
      </div>
    </div>
  )
}

interface MemoryBarChartProps {
  configs: ArchConfig[]
  activeId: ArchitectureId
}

const MemoryBarChart: React.FC<MemoryBarChartProps> = ({
  configs,
  activeId,
}) => {
  const memoryData = configs.map(c => ({
    id: c.id,
    label: c.shortLabel,
    kvHeads: c.numKVHeads,
    cachePerToken: getKvCachePerToken(c),
  }))

  const maxValue = Math.max(...memoryData.map(d => d.cachePerToken))
  const mhaValue =
    memoryData.find(d => d.id === 'MHA')?.cachePerToken ?? maxValue

  return (
    <div>
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#e5e7eb',
          marginBottom: '0.5rem',
        }}
      >
        KV cache memory per token
      </div>
      <div
        style={{
          fontSize: '0.72rem',
          color: 'rgba(148, 163, 184, 0.9)',
          marginBottom: '0.6rem',
        }}
      >
        Normalized KV cache size for a single token (higher bar = more
        memory).
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {memoryData.map(d => {
          const isActive = d.id === activeId
          const ratio = d.cachePerToken / maxValue
          const relativeToMha = d.cachePerToken / mhaValue
          return (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontSize: '0.75rem',
              }}
            >
              <div
                style={{
                  width: '2.5rem',
                  color: 'rgba(148, 163, 184, 0.95)',
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {d.label}
              </div>
              <div
                style={{
                  flex: 1,
                  background: 'rgba(15,23,42,0.9)',
                  borderRadius: 999,
                  overflow: 'hidden',
                  height: '0.7rem',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(4, ratio * 100)}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: isActive
                      ? 'linear-gradient(to right, #f97316, #facc15)'
                      : 'linear-gradient(to right, rgba(249,115,22,0.6), rgba(45,212,191,0.7))',
                    boxShadow: isActive
                      ? '0 0 0 1px rgba(250, 250, 249, 0.15)'
                      : 'none',
                    transition:
                      'width 0.45s ease, background 0.3s ease, box-shadow 0.3s ease',
                  }}
                />
              </div>
              <div
                style={{
                  width: '5.5rem',
                  textAlign: 'left',
                  color: 'rgba(148, 163, 184, 0.95)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {(relativeToMha * 100).toFixed(0)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

interface ParameterPanelProps {
  configs: ArchConfig[]
  statsById: Record<ArchitectureId, ParamStats>
  activeId: ArchitectureId
}

const ParameterPanel: React.FC<ParameterPanelProps> = ({
  configs,
  statsById,
  activeId,
}) => {
  const baselineTotal = statsById['MHA'].totalParams

  return (
    <div>
      <div
        style={{
          fontSize: '0.9rem',
          fontWeight: 600,
          color: '#e5e7eb',
          marginBottom: '0.5rem',
        }}
      >
        Projection parameter counts (Q + K + V)
      </div>
      <div
        style={{
          fontSize: '0.72rem',
          color: 'rgba(148, 163, 184, 0.9)',
          marginBottom: '0.4rem',
        }}
      >
        Approximate parameters for Q / K / V projections for a Llama&nbsp;3
        style layer (32 Q heads, grouped KV heads).
      </div>
      <div
        style={{
          maxWidth: '100%',
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
          paddingBottom: '0.25rem',
        }}
        aria-label="Projection parameter counts table"
      >
        <table
          style={{
            width: '100%',
            minWidth: '28rem',
            borderCollapse: 'collapse',
            fontSize: '0.75rem',
          }}
        >
          <thead>
            <tr
              style={{
                color: 'rgba(148,163,184,0.95)',
                textAlign: 'left',
              }}
            >
              <th style={{ padding: '0.35rem 0.35rem' }}>Arch</th>
              <th style={{ padding: '0.35rem 0.35rem' }}>Q heads</th>
              <th style={{ padding: '0.35rem 0.35rem' }}>KV heads</th>
              <th style={{ padding: '0.35rem 0.35rem' }}>KV params</th>
              <th style={{ padding: '0.35rem 0.35rem' }}>Total (Q+KV)</th>
              <th style={{ padding: '0.35rem 0.35rem' }}>vs MHA</th>
            </tr>
          </thead>
          <tbody>
            {configs.map(c => {
              const s = statsById[c.id]
              const isActive = c.id === activeId
              const rel = s.totalParams / baselineTotal
              return (
                <tr
                  key={c.id}
                  style={{
                    backgroundColor: isActive
                      ? 'rgba(249, 115, 22, 0.12)'
                      : 'transparent',
                    color: '#e5e7eb',
                  }}
                >
                  <td
                    style={{
                      padding: '0.28rem 0.35rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        marginRight: '0.25rem',
                      }}
                    >
                      {c.shortLabel}
                    </span>
                    <span
                      style={{
                        color: 'rgba(148,163,184,0.95)',
                      }}
                    >
                      {c.label}
                    </span>
                  </td>
                  <td style={{ padding: '0.28rem 0.35rem' }}>
                    {c.numQHeads}
                  </td>
                  <td style={{ padding: '0.28rem 0.35rem' }}>
                    {c.numKVHeads}
                  </td>
                  <td
                    style={{
                      padding: '0.28rem 0.35rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatParams(s.kvParams)}
                  </td>
                  <td
                    style={{
                      padding: '0.28rem 0.35rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatParams(s.totalParams)}
                  </td>
                  <td
                    style={{
                      padding: '0.28rem 0.35rem',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {(rel * 100).toFixed(0)}%
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const GQANotebookExplorer: React.FC<{ conceptId: string }> = ({ conceptId }) => {
  const [hq, setHq] = useState(32)
  const [hkv, setHkv] = useState(8)
  const [tokens, setTokens] = useState(128000)
  const [headDim, setHeadDim] = useState(128)
  const [selectedQ, setSelectedQ] = useState(9)
  const [predictedGroupSize, setPredictedGroupSize] = useState<number | null>(null)
  const [predictedRatio, setPredictedRatio] = useState<number | null>(null)
  const [revealed, setRevealed] = useState(false)

  const kvOptions = useMemo(() => getKvHeadOptions(hq), [hq])
  const groupSizeOptions = useMemo(() => getGroupSizeOptions(hq), [hq])
  const ratioOptions = useMemo(
    () => kvOptions.map((kvHeads) => kvHeads / hq),
    [hq, kvOptions]
  )

  const groupSize = hq / hkv
  const selectedKv = Math.min(hkv - 1, Math.floor(selectedQ / groupSize))
  const architecture = getArchitectureClass(hq, hkv)
  const ratio = hkv / hq
  const reductionFactor = hq / hkv
  const kvCacheGb = getKvCacheGb({
    tokens,
    layers: NOTEBOOK_LAYERS,
    hkv,
    headDim,
  })
  const mhaCacheGb = getKvCacheGb({
    tokens,
    layers: NOTEBOOK_LAYERS,
    hkv: hq,
    headDim,
  })
  const groupPredictionCorrect = predictedGroupSize === groupSize
  const ratioPredictionCorrect =
    predictedRatio !== null && Math.abs(predictedRatio - ratio) < 1e-9
  const canReveal = predictedGroupSize !== null && predictedRatio !== null

  const qNodes = useMemo(() => {
    const top = 26
    const bottom = 26
    const height = 272
    const spacing = hq > 1 ? (height - top - bottom) / (hq - 1) : 0
    return Array.from({ length: hq }, (_, index) => ({
      index,
      x: 92,
      y: top + index * spacing,
    }))
  }, [hq])

  const kvNodes = useMemo(() => {
    const top = 26
    const bottom = 26
    const height = 272
    const spacing = hkv > 1 ? (height - top - bottom) / (hkv - 1) : 0
    return Array.from({ length: hkv }, (_, index) => ({
      index,
      x: 402,
      y: hkv === 1 ? height / 2 : top + index * spacing,
    }))
  }, [hkv])

  const kvPlaceholderNodes = useMemo(() => {
    const columns = hkv > 16 ? 4 : hkv > 4 ? 2 : 1
    const rows = Math.ceil(hkv / columns)
    const xStart = 402 - (columns - 1) * 18
    const yStart = 136 - (rows - 1) * 11

    return Array.from({ length: hkv }, (_, index) => ({
      index,
      x: xStart + (index % columns) * 36,
      y: yStart + Math.floor(index / columns) * 22,
    }))
  }, [hkv])

  const edges = useMemo(
    () =>
      qNodes.map((q) => {
        const kvIndex = Math.min(hkv - 1, Math.floor(q.index / groupSize))
        const kv = kvNodes[kvIndex]
        return {
          id: `q-${q.index}-kv-${kvIndex}`,
          q,
          kv,
          kvIndex,
        }
      }),
    [groupSize, hkv, kvNodes, qNodes]
  )

  const resetReveal = () => {
    setRevealed(false)
  }

  const resetPredictions = () => {
    setPredictedGroupSize(null)
    setPredictedRatio(null)
    setRevealed(false)
  }

  const applyHq = (nextHq: number) => {
    const nextKvOptions = getKvHeadOptions(nextHq)
    setHq(nextHq)
    setHkv((current) =>
      nextKvOptions.includes(current) ? current : nextKvOptions[Math.min(1, nextKvOptions.length - 1)]
    )
    setSelectedQ((current) => Math.min(current, nextHq - 1))
    resetPredictions()
  }

  const applyHkv = (nextHkv: number) => {
    setHkv(nextHkv)
    resetPredictions()
  }

  const applyTokens = (nextTokens: number) => {
    setTokens(nextTokens)
    resetPredictions()
  }

  const applyHeadDim = (nextHeadDim: number) => {
    setHeadDim(nextHeadDim)
    resetPredictions()
  }

  useEffect(() => {
    const values = [
      `query heads Hq: ${hq}`,
      `KV heads Hkv: ${hkv}`,
      `context length T: ${tokens}`,
      `head dimension d_head: ${headDim}`,
      `batch: ${NOTEBOOK_BATCH}`,
      `layers: ${NOTEBOOK_LAYERS}`,
      `bytes per element: ${NOTEBOOK_BYTES}`,
      `selected query head: Q${selectedQ}`,
      `predicted group size: ${predictedGroupSize ?? 'none'}`,
      `predicted KV-cache ratio: ${predictedRatio === null ? 'none' : formatRatioChoice(predictedRatio)}`,
      `revealed: ${revealed ? 'yes' : 'no'}`,
    ]

    if (revealed) {
      values.push(
        `architecture: ${architecture}`,
        `actual group size: ${groupSize}`,
        `selected mapping: Q${selectedQ} -> KV${selectedKv}`,
        `KV cache: ${formatGb(kvCacheGb)}`,
        `MHA KV cache baseline: ${formatGb(mhaCacheGb)}`,
        `ratio vs MHA: ${formatPercent(ratio)}`,
        `reduction factor: ${formatReductionFactor(reductionFactor)}`
      )
    }

    emitDemoState({
      conceptId,
      label: 'Grouped-query attention sharing prediction',
      summary: revealed
        ? `${architecture} maps Q${selectedQ} to KV${selectedKv}; KV cache is ${formatGb(kvCacheGb)}, ${formatPercent(ratio)} of MHA.`
        : 'Predict the KV sharing pattern and memory ratio from the visible head and cache settings.',
      values,
    })
  }, [
    architecture,
    conceptId,
    groupSize,
    headDim,
    hkv,
    hq,
    kvCacheGb,
    mhaCacheGb,
    predictedGroupSize,
    predictedRatio,
    ratio,
    reductionFactor,
    revealed,
    selectedKv,
    selectedQ,
    tokens,
  ])

  return (
    <div className="gqa-notebook" data-gqa-notebook="true">
      <div className="control-strip" aria-label="Visible attention head configuration">
        <div className="control-group">
          <span>Hq</span>
          <div className="segment" role="group" aria-label="Query head count">
            {NOTEBOOK_HQ_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={hq === option}
                onClick={() => applyHq(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span>Hkv</span>
          <div className="segment" role="group" aria-label="Key value head count">
            {kvOptions.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={hkv === option}
                onClick={() => applyHkv(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span>T</span>
          <div className="segment" role="group" aria-label="Context length">
            {NOTEBOOK_CONTEXT_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={tokens === option}
                onClick={() => applyTokens(option)}
              >
                {formatTokens(option)}
              </button>
            ))}
          </div>
        </div>

        <div className="control-group">
          <span>d_head</span>
          <div className="segment" role="group" aria-label="Attention head dimension">
            {NOTEBOOK_HEAD_DIM_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={headDim === option}
                onClick={() => applyHeadDim(option)}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="stage-grid">
        <section className="panel diagram-panel">
          <div className="panel-heading">
            <p className="eyebrow">head sharing</p>
            <h3>Query heads read from fewer KV heads</h3>
            <p>
              Public cache assumptions: batch {NOTEBOOK_BATCH}, {NOTEBOOK_LAYERS} layers,
              fp16/bf16 cache elements, K and V stored for each token.
            </p>
          </div>

          <label className="q-slider">
            <span>Selected query head: Q{selectedQ}</span>
            <input
              type="range"
              min={0}
              max={hq - 1}
              step={1}
              value={selectedQ}
              onChange={(event) => {
                setSelectedQ(Number(event.target.value))
                resetReveal()
              }}
            />
          </label>

          <svg
            viewBox="0 0 496 272"
            role="img"
            aria-label="Query heads and key value head placeholders"
            className="head-map"
          >
            <g className="column-labels">
              <text x="92" y="14">Q heads</text>
              <text x="402" y="14">KV heads</text>
            </g>

            {revealed ? (
              <g className="revealed-edges">
                {edges.map((edge) => {
                  const isSelected = edge.q.index === selectedQ
                  return (
                    <line
                      key={edge.id}
                      x1={edge.q.x + 9}
                      y1={edge.q.y}
                      x2={edge.kv.x - 10}
                      y2={edge.kv.y}
                      className={isSelected ? 'selected' : ''}
                    />
                  )
                })}
              </g>
            ) : null}

            <g>
              {qNodes.map((node) => (
                <circle
                  key={`q-${node.index}`}
                  cx={node.x}
                  cy={node.y}
                  r={node.index === selectedQ ? 7 : 5}
                  className={node.index === selectedQ ? 'q-node selected' : 'q-node'}
                />
              ))}
            </g>

            <g>
              {(revealed ? kvNodes : kvPlaceholderNodes).map((node) => (
                <rect
                  key={`kv-${node.index}`}
                  x={node.x - 7}
                  y={node.y - 7}
                  width={14}
                  height={14}
                  rx={2}
                  className={revealed && node.index === selectedKv ? 'kv-node selected' : 'kv-node'}
                />
              ))}
            </g>
          </svg>
        </section>

        <section className="panel prediction-panel">
          <p className="eyebrow">prediction</p>
          <h3>Commit the sharing invariant before reveal</h3>

          <div className="prediction-block">
            <span>Query heads per KV head</span>
            <div className="prediction-grid" role="group" aria-label="Predict query heads per key value head">
              {groupSizeOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={predictedGroupSize === option}
                  onClick={() => {
                    setPredictedGroupSize(option)
                    resetReveal()
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>

          <div className="prediction-block">
            <span>KV cache as fraction of MHA</span>
            <div className="prediction-grid" role="group" aria-label="Predict key value cache ratio">
              {ratioOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  aria-pressed={predictedRatio !== null && Math.abs(predictedRatio - option) < 1e-9}
                  onClick={() => {
                    setPredictedRatio(option)
                    resetReveal()
                  }}
                >
                  {formatRatioChoice(option)}
                </button>
              ))}
            </div>
          </div>

          <div className="actions">
            <button
              type="button"
              disabled={!canReveal}
              onClick={() => setRevealed(true)}
            >
              Reveal
            </button>
            <button
              type="button"
              className="ghost"
              onClick={resetPredictions}
            >
              Reset
            </button>
          </div>

          <div className={`reveal-readout ${revealed ? 'shown' : ''}`} role="status" aria-live="polite">
            {revealed ? (
              <>
                <strong>
                  {groupPredictionCorrect && ratioPredictionCorrect
                    ? 'Both predictions matched.'
                    : 'Compare the invariant to the cache ratio.'}
                </strong>
                <p>
                  {architecture}: each KV head serves {groupSize} query head
                  {groupSize === 1 ? '' : 's'}, so Q{selectedQ} reads KV{selectedKv}.
                </p>
                <div className="diagnostic-grid">
                  <span>Group size</span>
                  <code>
                    predicted {predictedGroupSize ?? 'none'} / actual {groupSize}
                    {groupPredictionCorrect ? ' correct' : ' missed'}
                  </code>
                  <span>Cache ratio</span>
                  <code>
                    predicted {predictedRatio === null ? 'none' : formatRatioChoice(predictedRatio)} / actual {formatRatioChoice(ratio)}
                    {ratioPredictionCorrect ? ' correct' : ' missed'}
                  </code>
                </div>
              </>
            ) : (
              <p>Group size, Q-to-KV mapping, cache size, and ratio are locked until reveal.</p>
            )}
          </div>
        </section>
      </div>

      <div className="metric-grid">
        <section className="panel metric-panel">
          <span>Architecture</span>
          <strong>{revealed ? architecture : 'locked'}</strong>
        </section>
        <section className="panel metric-panel">
          <span>Group size</span>
          <strong>{revealed ? `${groupSize}:1` : 'locked'}</strong>
        </section>
        <section className="panel metric-panel">
          <span>Selected mapping</span>
          <strong>{revealed ? `Q${selectedQ} -> KV${selectedKv}` : 'locked'}</strong>
        </section>
        <section className="panel metric-panel">
          <span>KV cache</span>
          <strong>{revealed ? formatGb(kvCacheGb) : 'locked'}</strong>
        </section>
        <section className="panel metric-panel">
          <span>vs MHA cache</span>
          <strong>{revealed ? formatPercent(ratio) : 'locked'}</strong>
        </section>
        <section className="panel metric-panel">
          <span>Reduction</span>
          <strong>{revealed ? formatReductionFactor(reductionFactor) : 'locked'}</strong>
        </section>
      </div>

      <style jsx>{`
        .gqa-notebook {
          min-width: min(100%, 780px);
          background: #f9f4eb;
          color: #17202a;
          padding: 1rem;
        }

        .control-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.7rem;
          margin-bottom: 0.8rem;
        }

        .control-group,
        .panel {
          border: 1px solid rgba(31, 44, 56, 0.12);
          border-radius: 8px;
          background: rgba(255, 253, 248, 0.82);
        }

        .control-group {
          padding: 0.65rem;
        }

        .control-group > span,
        .prediction-block > span,
        .metric-panel > span {
          display: block;
          margin-bottom: 0.4rem;
          color: #596977;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .segment,
        .prediction-grid,
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        button {
          min-height: 40px;
          border: 1px solid rgba(31, 44, 56, 0.14);
          border-radius: 7px;
          background: #fffaf1;
          color: #24313d;
          cursor: pointer;
          font: inherit;
          font-size: 0.78rem;
        }

        button[aria-pressed='true'] {
          background: #1f6f78;
          border-color: #1f6f78;
          color: #ffffff;
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }

        button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.42);
          outline-offset: 2px;
        }

        .stage-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.85fr);
          gap: 0.8rem;
          align-items: stretch;
        }

        .panel {
          padding: 0.85rem;
        }

        .panel-heading {
          display: grid;
          gap: 0.25rem;
          margin-bottom: 0.7rem;
        }

        .eyebrow {
          margin: 0;
          color: #b75f25;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        h3 {
          margin: 0;
          color: #17202a;
          font-size: 1rem;
          letter-spacing: 0;
        }

        p {
          margin: 0;
          color: #566574;
          font-size: 0.86rem;
          line-height: 1.55;
        }

        .q-slider {
          display: grid;
          gap: 0.4rem;
          margin-bottom: 0.65rem;
          color: #344451;
          font-family: var(--font-mono);
          font-size: 0.76rem;
        }

        .q-slider input {
          width: 100%;
          accent-color: #1f6f78;
        }

        .head-map {
          width: 100%;
          min-width: 520px;
          height: auto;
          display: block;
          border-radius: 8px;
          background:
            linear-gradient(90deg, rgba(249, 250, 251, 0.96), rgba(237, 246, 244, 0.92));
          border: 1px solid rgba(31, 44, 56, 0.1);
        }

        .column-labels text {
          fill: #596977;
          font-family: var(--font-mono);
          font-size: 11px;
          text-anchor: middle;
        }

        .revealed-edges line {
          stroke: rgba(31, 111, 120, 0.38);
          stroke-width: 1.2;
        }

        .revealed-edges line.selected {
          stroke: #b75f25;
          stroke-width: 3;
        }

        .q-node {
          fill: #d97932;
          stroke: #fffaf1;
          stroke-width: 1.5;
        }

        .q-node.selected {
          fill: #b75f25;
          stroke: #17202a;
          stroke-width: 2;
        }

        .kv-node {
          fill: #1f6f78;
          stroke: #fffaf1;
          stroke-width: 1.5;
        }

        .kv-node.selected {
          fill: #103f47;
          stroke: #b75f25;
          stroke-width: 2;
        }

        .prediction-panel {
          display: grid;
          align-content: start;
          gap: 0.8rem;
        }

        .prediction-block {
          display: grid;
          gap: 0.35rem;
        }

        .prediction-grid button {
          flex: 1 1 56px;
        }

        .actions button {
          flex: 1 1 100px;
          background: #b75f25;
          border-color: #b75f25;
          color: #ffffff;
          font-weight: 650;
        }

        .actions .ghost {
          background: #fffaf1;
          color: #344451;
          border-color: rgba(31, 44, 56, 0.14);
          font-weight: 500;
        }

        .reveal-readout {
          min-height: 104px;
          border-radius: 8px;
          border: 1px solid rgba(31, 44, 56, 0.1);
          background: rgba(249, 244, 235, 0.78);
          padding: 0.75rem;
        }

        .reveal-readout.shown {
          border-color: rgba(31, 111, 120, 0.34);
          background: rgba(232, 247, 244, 0.85);
        }

        .reveal-readout strong {
          display: block;
          margin-bottom: 0.35rem;
          color: #17202a;
        }

        .diagnostic-grid {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          gap: 0.35rem 0.55rem;
          margin-top: 0.6rem;
          align-items: center;
        }

        .diagnostic-grid span {
          color: #596977;
          font-family: var(--font-mono);
          font-size: 0.7rem;
        }

        .diagnostic-grid code {
          min-width: 0;
          color: #24313d;
          background: rgba(255, 250, 241, 0.9);
          border-radius: 6px;
          padding: 0.28rem 0.4rem;
          font-size: 0.72rem;
          overflow-wrap: anywhere;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.65rem;
          margin-top: 0.8rem;
        }

        .metric-panel {
          min-height: 74px;
          display: grid;
          align-content: center;
        }

        .metric-panel strong {
          color: #17202a;
          font-size: 1rem;
          font-variant-numeric: tabular-nums;
          overflow-wrap: anywhere;
        }

        @media (max-width: 980px) {
          .control-strip,
          .stage-grid,
          .metric-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .diagram-panel {
            grid-column: 1 / -1;
            overflow-x: auto;
          }
        }

        @media (max-width: 620px) {
          .gqa-notebook {
            padding: 0.75rem;
          }

          .control-strip,
          .stage-grid,
          .metric-grid {
            grid-template-columns: 1fr;
          }

          .head-map {
            min-width: 480px;
          }
        }
      `}</style>
    </div>
  )
}

const LegacyAttentionArchitecturesExplorer: React.FC = () => {
  const [activeArch, setActiveArch] = useState<ArchitectureId>('MHA')

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<ArchitectureId | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<ArchitectureId | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<typeof ARCH_CHALLENGES[number] | null>(null)
  const [countdown, setCountdown] = useState(0)

  // Game handlers
  const applyChallenge = useCallback((challenge: typeof ARCH_CHALLENGES[number]) => {
    let actualChallenge = challenge
    if (challenge.name === '🎲 Mystery Scenario') {
      const randomIdx = Math.floor(Math.random() * 3) // Pick from first 3
      actualChallenge = { ...ARCH_CHALLENGES[randomIdx], name: '🎲 Mystery Scenario' }
    }
    setActiveChallenge(actualChallenge)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
  }, [])

  const startChallenge = useCallback(() => {
    if (!prediction) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setActiveChallenge(null)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      setActiveArch(activeChallenge?.bestArch ?? 'GQA')
      setGamePhase('reveal')
    }
  }, [gamePhase, countdown, activeChallenge])

  const predictionCorrect = lockedPrediction === activeChallenge?.bestArch

  const statsById: Record<ArchitectureId, ParamStats> = useMemo(() => {
    const record = {} as Record<ArchitectureId, ParamStats>
    ARCH_CONFIGS.forEach(c => {
      record[c.id] = getParamStats(c)
    })
    return record
  }, [])

  const activeConfig =
    ARCH_CONFIGS.find(c => c.id === activeArch) ?? ARCH_CONFIGS[0]

  return (
    <section
      style={{
        backgroundColor: '#0d1219',
        borderRadius: '1rem',
        padding: '1.4rem 1.6rem',
        border: '1px solid rgba(15, 23, 42, 1)',
        color: '#e5e7eb',
        boxShadow: '0 24px 80px rgba(0,0,0,0.75)',
      }}
    >
      <header
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        <div>
          <h2
            style={{
              fontSize: '1.1rem',
              fontWeight: 600,
              margin: 0,
              letterSpacing: '0.02em',
            }}
          >
            MHA vs MQA vs GQA (Llama&nbsp;3-style)
          </h2>
          <p
            style={{
              marginTop: '0.3rem',
              fontSize: '0.8rem',
              color: 'rgba(148,163,184,0.95)',
              maxWidth: '32rem',
            }}
          >
            Visualize how query heads connect to key/value heads, how KV
            sharing reduces KV cache memory, and how parameter counts change
            when moving from classic multi-head attention to grouped and
            multi-query variants.
          </p>
        </div>
        <div
          style={{
            display: 'inline-flex',
            padding: '0.15rem',
            borderRadius: 999,
            background: 'rgba(15,23,42,0.9)',
            border: '1px solid rgba(31,41,55,1)',
          }}
          role="tablist"
          aria-label="Attention architecture"
        >
          {ARCH_CONFIGS.map(c => {
            const isActive = c.id === activeArch
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveArch(c.id)}
                role="tab"
                aria-selected={isActive}
                style={{
                  border: 'none',
                  outline: 'none',
                  cursor: 'pointer',
                  padding: '0.3rem 0.75rem',
                  borderRadius: 999,
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: isActive
                    ? '#020617'
                    : 'rgba(148,163,184,0.95)',
                  background: isActive
                    ? 'linear-gradient(to right, #f97316, #facc15)'
                    : 'transparent',
                  boxShadow: isActive
                    ? '0 0 0 1px rgba(15,23,42,0.9)'
                    : 'none',
                  transition:
                    'background 0.25s ease, color 0.25s ease, transform 0.2s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {c.shortLabel}
              </button>
            )
          })}
        </div>
      </header>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(45, 212, 191, 0.05))',
        border: '1px solid rgba(249, 115, 22, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: 'rgba(148, 163, 184, 0.9)', marginRight: '8px' }}>
            🏗️ <strong>Architecture Challenge:</strong> Pick a scenario:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {ARCH_CHALLENGES.map(challenge => (
              <button
                key={challenge.name}
                onClick={() => applyChallenge(challenge)}
                disabled={gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge?.name === challenge.name
                    ? 'rgba(249, 115, 22, 0.3)'
                    : 'rgba(249, 115, 22, 0.1)',
                  border: `1px solid ${activeChallenge?.name === challenge.name ? '#f97316' : 'rgba(249, 115, 22, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={challenge.hint}
              >
                {challenge.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📋 <strong>Scenario:</strong> {activeChallenge.description}
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>Which attention architecture should you choose?</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {ARCH_CONFIGS.map(config => (
                <button
                  key={config.id}
                  onClick={() => setPrediction(config.id)}
                  style={{
                    padding: '10px 20px',
                    background: prediction === config.id
                      ? 'rgba(249, 115, 22, 0.3)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${prediction === config.id ? '#f97316' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '0.9rem',
                    fontWeight: prediction === config.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {config.shortLabel} — {config.numKVHeads} KV heads
                </button>
              ))}
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #f97316, #facc15)'
                  : 'rgba(249, 115, 22, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#020617' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              ⚡ Reveal Best Architecture!
            </button>
          </div>
        )}

        {/* No challenge selected */}
        {gamePhase === 'setup' && !activeChallenge && (
          <p style={{ fontSize: '0.9rem', color: 'rgba(148, 163, 184, 0.9)', textAlign: 'center', padding: '12px' }}>
            👆 Select a deployment scenario to test your architecture intuition!
          </p>
        )}

        {/* Countdown */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#f97316',
              textShadow: '0 0 30px rgba(249, 115, 22, 0.5)',
            }}>
              {countdown === 0 ? 'ANALYZING...' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: 'rgba(148, 163, 184, 0.9)' }}>
              Your pick: <strong style={{ color: '#f97316' }}>{lockedPrediction}</strong>
            </p>
          </div>
        )}

        {/* Revealed */}
        {gamePhase === 'reveal' && activeChallenge && (
          <div role="status" aria-live="polite" aria-atomic="true">
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: predictionCorrect
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              borderRadius: '10px',
              marginBottom: '12px',
            }}
              aria-label={predictionCorrect ? 'Correct prediction' : 'Incorrect prediction'}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }} aria-hidden="true">
                {predictionCorrect ? '🎉' : '🤔'}
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: predictionCorrect ? '#22c55e' : '#ef4444',
                marginBottom: '8px',
              }}>
                {predictionCorrect ? 'Perfect Choice!' : 'Good thinking, but...'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                Best architecture: <strong style={{ color: '#f97316' }}>{activeChallenge.bestArch}</strong>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'rgba(148, 163, 184, 0.9)',
            }}>
              💡 {getArchPredictionFeedback(lockedPrediction!, activeChallenge.bestArch, activeChallenge.name)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(249, 115, 22, 0.2)',
                border: '1px solid rgba(249, 115, 22, 0.4)',
                borderRadius: '8px',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Another Scenario
            </button>
          </div>
        )}
      </div>

      {/* Side-by-side architecture diagrams */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          marginBottom: '1rem',
        }}
      >
        {ARCH_CONFIGS.map(c => (
          <ArchitectureDiagramColumn
            key={c.id}
            config={c}
            isActive={c.id === activeArch}
          />
        ))}
      </div>

      {/* Memory bar chart + parameter table */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1.2rem',
          alignItems: 'stretch',
          marginTop: '0.75rem',
        }}
      >
        <div style={{ flex: '1 1 14rem', minWidth: '12rem' }}>
          <MemoryBarChart
            configs={ARCH_CONFIGS}
            activeId={activeArch}
          />
        </div>
        <div style={{ flex: '1 1 18rem', minWidth: '16rem' }}>
          <ParameterPanel
            configs={ARCH_CONFIGS}
            statsById={statsById}
            activeId={activeArch}
          />
        </div>
      </div>

      <footer
        style={{
          marginTop: '0.9rem',
          fontSize: '0.75rem',
          color: 'rgba(148,163,184,0.85)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          flexWrap: 'wrap',
        }}
      >
        <span>
          Active:{' '}
          <strong>{activeConfig.shortLabel}</strong> &mdash;{' '}
          {activeConfig.label}
        </span>
        <span>
          Q heads are orange circles; KV heads are teal squares. Lines
          show which query heads share KV projections in each
          architecture.
        </span>
      </footer>
    </section>
  )
}

const AttentionArchitecturesExplorer: React.FC<GQAVizProps> = ({
  chrome = 'legacy',
  conceptId = 'grouped-query-attention',
}) => {
  if (chrome === 'notebook') {
    return <GQANotebookExplorer conceptId={conceptId} />
  }

  return <LegacyAttentionArchitecturesExplorer />
}

export default AttentionArchitecturesExplorer
