Here’s a self‑contained TSX component you can drop into your components/ folder, e.g. components/MambaSelectiveStateSpaceDemo.tsx. It uses your existing TimeSeriesPlot + MATH_COLORS and matches the “card / interactive-card” style. 

attachments-bundle

tsx
Copy code
import { useEffect, useMemo, useState } from 'react'
import TimeSeriesPlot from './TimeSeriesPlot'
import { TimeSeries, MATH_COLORS } from '../lib/mathObjects'

type TokenKind = 'noise' | 'password' | 'marker'

interface Token {
  id: number
  text: string
  kind: TokenKind
}

interface PatternConfig {
  id: string
  name: string
  description: string
  tokens: Token[]
}

interface ScanLevel {
  level: number
  segments: { start: number; end: number }[]
}

// --- Input patterns ---------------------------------------------------------

const PATTERNS: PatternConfig[] = [
  {
    id: 'middle',
    name: 'Password in the middle',
    description: 'Noise → [password] → noise',
    tokens: [
      { id: 0, text: 'r', kind: 'noise' },
      { id: 1, text: '?', kind: 'noise' },
      { id: 2, text: '[', kind: 'marker' },
      { id: 3, text: '4', kind: 'password' },
      { id: 4, text: '2', kind: 'password' },
      { id: 5, text: '7', kind: 'password' },
      { id: 6, text: '9', kind: 'password' },
      { id: 7, text: ']', kind: 'marker' },
      { id: 8, text: '#', kind: 'noise' },
      { id: 9, text: 'k', kind: 'noise' },
    ],
  },
  {
    id: 'early',
    name: 'Password at the start',
    description: '[password] → trailing noise',
    tokens: [
      { id: 0, text: '[', kind: 'marker' },
      { id: 1, text: '4', kind: 'password' },
      { id: 2, text: '2', kind: 'password' },
      { id: 3, text: '7', kind: 'password' },
      { id: 4, text: '9', kind: 'password' },
      { id: 5, text: ']', kind: 'marker' },
      { id: 6, text: 'x', kind: 'noise' },
      { id: 7, text: '?', kind: 'noise' },
      { id: 8, text: 'q', kind: 'noise' },
      { id: 9, text: '%', kind: 'noise' },
    ],
  },
  {
    id: 'two',
    name: 'Two passwords',
    description: 'Noise → [password] → noise → [password]',
    tokens: [
      { id: 0, text: 'x', kind: 'noise' },
      { id: 1, text: 'q', kind: 'noise' },
      { id: 2, text: '[', kind: 'marker' },
      { id: 3, text: '4', kind: 'password' },
      { id: 4, text: '2', kind: 'password' },
      { id: 5, text: '7', kind: 'password' },
      { id: 6, text: '9', kind: 'password' },
      { id: 7, text: ']', kind: 'marker' },
      { id: 8, text: 'z', kind: 'noise' },
      { id: 9, text: '[', kind: 'marker' },
      { id: 10, text: '4', kind: 'password' },
      { id: 11, text: '2', kind: 'password' },
      { id: 12, text: '7', kind: 'password' },
      { id: 13, text: '9', kind: 'password' },
      { id: 14, text: ']', kind: 'marker' },
    ],
  },
]

// --- Small helpers ---------------------------------------------------------

function deltaForToken(token: Token): number {
  switch (token.kind) {
    case 'password':
      return 0.9 // strong update for important tokens
    case 'marker':
      return 0.4 // moderate update at delimiters
    case 'noise':
    default:
      return 0.05 // tiny Δ: mostly copy previous state
  }
}

function computeDeltas(tokens: Token[]): number[] {
  return tokens.map(deltaForToken)
}

// Simple LTI SSM: h_{t+1} = λ h_t + β x_t with fixed parameters
function simulateLTI(tokens: Token[]): number[] {
  const lambda = 0.85
  const betaNoise = 0.05
  const betaMarker = 0.1
  const betaPassword = 0.35

  let h = 0
  const states: number[] = []

  for (const token of tokens) {
    let beta = betaNoise
    if (token.kind === 'password') beta = betaPassword
    else if (token.kind === 'marker') beta = betaMarker
    h = lambda * h + beta
    states.push(h)
  }

  return states
}

// Selective (Mamba-style) update: h_{t+1} = (1 - Δ_t) h_t + Δ_t * x_t, with input-dependent Δ_t
function simulateSelective(tokens: Token[], deltas: number[]): number[] {
  let h = 0
  const states: number[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const delta = deltas[i]
    const x = token.kind === 'password' ? 1 : 0 // toy scalar input
    h = (1 - delta) * h + delta * x
    states.push(h)
  }

  return states
}

function computeSelections(tokens: Token[], lti: number[], deltas: number[]) {
  const maxLti = Math.max(...lti, 1e-6)
  const ltiThreshold = maxLti * 0.6

  const ltiSelected = tokens.map(
    (t, i) => t.kind !== 'marker' && lti[i] > ltiThreshold
  )

  const gateThreshold = 0.5
  const mambaSelected = tokens.map(
    (t, i) => t.kind === 'password' && deltas[i] > gateThreshold
  )

  return { ltiSelected, mambaSelected }
}

// Parallel scan levels: each level doubles the segment length
function computeScanLevels(length: number): ScanLevel[] {
  const levels: ScanLevel[] = []
  let segmentSize = 1
  let level = 0

  while (segmentSize < length) {
    const segments: { start: number; end: number }[] = []
    for (let start = 0; start < length; start += segmentSize * 2) {
      const end = Math.min(start + segmentSize * 2 - 1, length - 1)
      if (end >= start) {
        segments.push({ start, end })
      }
    }
    levels.push({ level, segments })
    segmentSize *= 2
    level += 1
  }

  return levels
}

// --- Main component --------------------------------------------------------

export default function MambaSelectiveStateSpaceDemo() {
  const [patternIndex, setPatternIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)
  const [showScan, setShowScan] = useState(false)
  const [activeScanLevel, setActiveScanLevel] = useState(0)

  const pattern = PATTERNS[patternIndex]
  const tokens = pattern.tokens

  const deltas = useMemo(() => computeDeltas(tokens), [tokens])
  const ltiState = useMemo(() => simulateLTI(tokens), [tokens])
  const selectiveState = useMemo(
    () => simulateSelective(tokens, deltas),
    [tokens, deltas]
  )

  const { ltiSelected, mambaSelected } = useMemo(
    () => computeSelections(tokens, ltiState, deltas),
    [tokens, ltiState, deltas]
  )

  const timeSeries: TimeSeries[] = useMemo(
    () => [
      {
        label: 'LTI state',
        color: '#6b7280', // gray
        data: ltiState.map((value, t) => ({ t, value })),
      },
      {
        label: 'Selective (Mamba) state',
        color: MATH_COLORS.secondary, // teal
        data: selectiveState.map((value, t) => ({ t, value })),
      },
    ],
    [ltiState, selectiveState]
  )

  const scanLevels = useMemo(
    () => computeScanLevels(tokens.length),
    [tokens.length]
  )

  useEffect(() => {
    // Reset when pattern changes
    setCurrentStep(0)
    setActiveScanLevel(0)
  }, [patternIndex, tokens.length])

  const maxStep = Math.max(tokens.length - 1, 0)

  return (
    <section
      className="card interactive-card"
      style={{
        backgroundColor: '#080c14',
        borderColor: 'rgba(148, 163, 184, 0.3)',
      }}
    >
      <div className="mamba-header">
        <h2>Mamba&apos;s Selective State Space (Toy Demo)</h2>
        <p className="muted">
          Unlike S4 with fixed A, B, C, this toy Mamba uses input-dependent
          B, C, and Δ. Large Δ focuses on the current token; small Δ
          mostly copies the previous state.
        </p>
      </div>

      <div
        className="mamba-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1.4fr)',
          gap: '1.5rem',
          alignItems: 'flex-start',
        }}
      >
        {/* Left: controls + sequence + Δ visualization */}
        <div className="mamba-left">
          <div
            className="mamba-controls"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              marginBottom: '1rem',
            }}
          >
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: '#e5e7eb',
              }}
            >
              Input pattern
              <select
                value={patternIndex}
                onChange={(e) => setPatternIndex(Number(e.target.value))}
                style={{
                  backgroundColor: '#020617',
                  borderRadius: '0.5rem',
                  border: '1px solid #374151',
                  padding: '0.35rem 0.6rem',
                  fontSize: '0.875rem',
                  color: '#e5e7eb',
                }}
              >
                {PATTERNS.map((p, idx) => (
                  <option key={p.id} value={idx}>
                    {p.name}
                  </option>
                ))}
              </select>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                {pattern.description}
              </span>
            </label>

            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: '#e5e7eb',
              }}
            >
              Step through the sequence (t = {currentStep})
              <input
                type="range"
                min={0}
                max={maxStep || 0}
                value={currentStep}
                onChange={(e) => setCurrentStep(Number(e.target.value))}
              />
            </label>
          </div>

          {/* Token row + Δ bars */}
          <div
            className="mamba-sequence"
            style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto' }}
          >
            {tokens.map((token, idx) => {
              const delta = deltas[idx]
              const isCurrent = idx === currentStep
              const baseBg =
                token.kind === 'password'
                  ? MATH_COLORS.primary
                  : token.kind === 'noise'
                  ? '#111827'
                  : '#1f2937'
              const textColor =
                token.kind === 'password' ? '#111827' : '#e5e7eb'
              const borderColor = isCurrent ? MATH_COLORS.secondary : '#374151'
              const boxShadow = isCurrent
                ? '0 0 16px rgba(20, 184, 166, 0.9)'
                : 'none'
              const barHeight = 8 + delta * 52 // 8–60 px

              return (
                <div
                  key={`${pattern.id}-${token.id}`}
                  style={{
                    minWidth: '40px',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {/* Δ bar */}
                  <div
                    aria-label={`Delta for token ${idx}: ${delta.toFixed(2)}`}
                    style={{
                      width: '10px',
                      height: `${barHeight}px`,
                      borderRadius: '999px',
                      background:
                        token.kind === 'password'
                          ? 'linear-gradient(to top, #f97316, #facc15)'
                          : 'linear-gradient(to top, #4b5563, #9ca3af)',
                      opacity: token.kind === 'noise' ? 0.85 : 1,
                    }}
                  />
                  {/* Token pill */}
                  <div
                    style={{
                      padding: '0.25rem 0.6rem',
                      borderRadius: '999px',
                      backgroundColor: baseBg,
                      color: textColor,
                      border: `1px solid ${borderColor}`,
                      boxShadow,
                      fontSize: '0.875rem',
                      lineHeight: 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {token.text}
                  </div>
                  {/* Kind / Δ label */}
                  <div
                    style={{
                      fontSize: '0.7rem',
                      color: '#9ca3af',
                      textAlign: 'center',
                    }}
                  >
                    Δ={delta.toFixed(2)}
                  </div>
                </div>
              )
            })}
          </div>

          <p
            style={{
              marginTop: '0.75rem',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}
          >
            Orange tokens are the password. Δ bars rise sharply on those tokens
            (selective update) and stay small on gray noise tokens (copy state).
          </p>
        </div>

        {/* Right: hidden state + selective copying task */}
        <div className="mamba-right" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="mamba-state-chart">
            <TimeSeriesPlot
              series={timeSeries}
              width={420}
              height={240}
              xLabel="time step t"
              yLabel="hidden state h_t"
              showLegend={true}
              currentTime={currentStep}
              animate={false}
            />
            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              LTI: fixed dynamics blurs everything together.
              Selective Mamba: big jumps only on orange password
              tokens, tiny changes on gray noise → memory is used where it matters.
            </p>
          </div>

          {/* Selective copying task */}
          <div
            className="mamba-copy-task"
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #374151',
              padding: '0.75rem 0.9rem',
              background:
                'linear-gradient(to bottom right, rgba(15,23,42,0.9), rgba(15,23,42,0.6))',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '0.5rem',
                gap: '0.5rem',
              }}
            >
              <strong style={{ fontSize: '0.875rem', color: '#e5e7eb' }}>
                Selective Copying: recover the password, ignore noise
              </strong>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
              >
                Output length = password length
              </span>
            </div>

            {/* Input row */}
            <Row
              label="Input"
              tokens={tokens}
              selected={tokens.map((t) => t.kind === 'password')}
              mode="input"
            />

            {/* LTI output row */}
            <Row
              label="LTI output"
              tokens={tokens}
              selected={ltiSelected}
              mode="lti"
            />

            {/* Selective Mamba output row */}
            <Row
              label="Selective (Mamba)"
              tokens={tokens}
              selected={mambaSelected}
              mode="mamba"
            />

            <p
              style={{
                marginTop: '0.5rem',
                fontSize: '0.75rem',
                color: '#9ca3af',
              }}
            >
              LTI (fixed A, B, C) tends to light up extra nearby tokens and
              leak across noise. The selective model uses Δ as a gate so only
              the password tokens are copied out cleanly.
            </p>
          </div>
        </div>
      </div>

      {/* Optional advanced view: parallel scan animation */}
      <div
        className="mamba-scan-advanced"
        style={{ marginTop: '1.5rem', borderTop: '1px solid #1f2937', paddingTop: '1rem' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            marginBottom: '0.5rem',
          }}
        >
          <button
            type="button"
            onClick={() => setShowScan((s) => !s)}
            style={{
              fontSize: '0.8rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '999px',
              border: '1px solid #4b5563',
              backgroundColor: showScan ? '#0f172a' : '#020617',
              color: '#e5e7eb',
            }}
          >
            {showScan ? 'Hide' : 'Show'} parallel scan (advanced)
          </button>
          {showScan && (
            <>
              <button
                type="button"
                onClick={() =>
                  setActiveScanLevel((l) => Math.max(l - 1, 0))
                }
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                }}
              >
                ◀
              </button>
              <button
                type="button"
                onClick={() =>
                  setActiveScanLevel((l) =>
                    Math.min(l + 1, Math.max(scanLevels.length - 1, 0))
                  )
                }
                style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '999px',
                  border: '1px solid #4b5563',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                }}
              >
                ▶
              </button>
              <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                Phase {scanLevels.length === 0 ? 0 : activeScanLevel + 1} of{' '}
                {scanLevels.length || 1}
              </span>
            </>
          )}
        </div>

        {showScan && (
          <div
            style={{
              borderRadius: '0.75rem',
              border: '1px solid #1f2937',
              padding: '0.75rem 0.9rem',
              background:
                'linear-gradient(to right, rgba(15,23,42,0.9), rgba(15,23,42,0.8))',
            }}
          >
            <p
              style={{
                fontSize: '0.75rem',
                color: '#9ca3af',
                marginBottom: '0.75rem',
              }}
            >
              The state-space recurrence can be evaluated in parallel with a
              scan: each phase combines longer and longer spans of tokens.
              All segments in the same row can be computed simultaneously.
            </p>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
              }}
            >
              {scanLevels.map((level, idx) => {
                const isActive = idx === activeScanLevel
                const isPast = idx < activeScanLevel

                return (
                  <div key={level.level} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '90px',
                        fontSize: '0.7rem',
                        color: isActive
                          ? MATH_COLORS.secondary
                          : '#9ca3af',
                      }}
                    >
                      Phase {idx + 1}
                    </div>
                    <div
                      style={{
                        flex: 1,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${tokens.length}, minmax(0, 1fr))`,
                        gap: '2px',
                      }}
                    >
                      {level.segments.map((seg) => (
                        <div
                          key={`${level.level}-${seg.start}-${seg.end}`}
                          style={{
                            gridColumn: `${seg.start + 1} / ${seg.end + 2}`,
                            height: '12px',
                            borderRadius: '999px',
                            backgroundColor: isActive
                              ? 'rgba(20, 184, 166, 0.9)'
                              : isPast
                              ? 'rgba(20, 184, 166, 0.4)'
                              : 'rgba(148, 163, 184, 0.4)',
                            boxShadow: isActive
                              ? '0 0 12px rgba(20,184,166,0.9)'
                              : 'none',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

// --- Small presentational subcomponent for the copy task rows ---------------

interface RowProps {
  label: string
  tokens: Token[]
  selected: boolean[]
  mode: 'input' | 'lti' | 'mamba'
}

function Row({ label, tokens, selected, mode }: RowProps) {
  const baseLabelColor =
    mode === 'mamba'
      ? MATH_COLORS.secondary
      : mode === 'lti'
      ? '#9ca3af'
      : '#e5e7eb'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.75rem',
        marginTop: '0.25rem',
      }}
    >
      <div
        style={{
          width: '100px',
          fontSize: '0.75rem',
          color: baseLabelColor,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          gap: '0.35rem',
          flexWrap: 'wrap',
        }}
      >
        {tokens.map((token, idx) => {
          const isSelected = selected[idx]
          const isPassword = token.kind === 'password'

          let bg = 'transparent'
          let color = '#6b7280'
          let border = '1px dashed #374151'

          if (mode === 'input') {
            if (isPassword) {
              bg = MATH_COLORS.primary
              color = '#111827'
              border = '1px solid #fbbf24'
            } else if (token.kind === 'marker') {
              bg = '#111827'
              color = '#9ca3af'
              border = '1px solid #4b5563'
            } else {
              bg = '#020617'
              color = '#6b7280'
              border = '1px solid #1f2937'
            }
          } else {
            if (isSelected && mode === 'mamba') {
              bg = MATH_COLORS.secondary
              color = '#0f172a'
              border = '1px solid #5eead4'
            } else if (isSelected && mode === 'lti') {
              bg = '#1f2937'
              color = '#e5e7eb'
              border = '1px solid #9ca3af'
            } else {
              // not selected → blank slot
              bg = '#020617'
              color = '#4b5563'
              border = '1px dashed #1f2937'
            }
          }

          const content =
            mode === 'input'
              ? token.text
              : isSelected && token.kind === 'password'
              ? token.text
              : isSelected && mode === 'lti'
              ? token.text // possibly spurious extra copies
              : '·'

          return (
            <div
              key={`${label}-${idx}`}
              style={{
                minWidth: '28px',
                padding: '0.15rem 0.45rem',
                borderRadius: '999px',
                backgroundColor: bg,
                color,
                border,
                fontSize: '0.8rem',
                textAlign: 'center',
              }}
            >
              {content}
            </div>
          )
        })}
      </div>
    </div>
  )
}
