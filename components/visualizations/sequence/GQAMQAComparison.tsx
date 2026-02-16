'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'

type ArchitectureId = 'MHA' | 'GQA' | 'MQA'
type GamePhase = 'setup' | 'countdown' | 'reveal'

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
    'GQA': 'GQA shares KV heads among groups of query heads. This is the "Goldilocks" choice—Llama 3 uses GQA-8 for great quality with 8× KV cache reduction.',
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
          <div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: predictionCorrect
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
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

export default AttentionArchitecturesExplorer
