Here’s a self‑contained client component you can drop into your Next.js app. It uses SVG (no extra D3 dependency), shows all three architectures side‑by‑side, has a toggle that drives highlighting + bars + parameter table, and uses Llama‑3‑style 32 Q heads / 8 KV heads for GQA.

tsx
Copy code
'use client'

import React, { useMemo, useState } from 'react'

type ArchitectureId = 'MHA' | 'GQA' | 'MQA'

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
        flex: '1 1 0',
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
      <table
        style={{
          width: '100%',
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
  )
}

const AttentionArchitecturesExplorer: React.FC = () => {
  const [activeArch, setActiveArch] = useState<ArchitectureId>('MHA')

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

export default AttentionArchitecturesExplorer


You can mount this on any page (or inside your existing Layout / ExplorableLayout) as:

tsx
Copy code
import AttentionArchitecturesExplorer from '@/components/AttentionArchitecturesExplorer'

export default function Page() {
  return (
    <main>
      <AttentionArchitecturesExplorer />
    </main>
  )
}


It should blend reasonably well with your other interactive visualizations like GradientDescentPlayground and MuonConceptualDemo. 

attachments-bundle
