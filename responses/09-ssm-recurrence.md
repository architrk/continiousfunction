Here’s a self‑contained `SSMStateSpaceExplorer` component that matches your requirements and fits into your existing explorable/visual style. It uses **TypeScript + TSX**, is **Next.js compatible**, and uses **D3.js** for the plots.

You can drop this into `components/SSMStateSpaceExplorer.tsx`:

```tsx
'use client'

import React, { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'

/**
 * Basic types
 */
type TimePoint = { t: number; value: number }
type StatePoint = { t: number; x: number; y: number }

type InputKind = 'pulse' | 'step' | 'sine'

const BG_COLOR = '#0d1219'
const INPUT_COLOR = '#9ca3af'   // gray
const STATE_COLOR = '#f59e0b'   // orange
const OUTPUT_COLOR = '#14b8a6'  // teal

interface SSMStateSpaceExplorerProps {
  length?: number // sequence length
}

/**
 * Generate simple 1D input sequences
 */
function generateInputSequence(L: number, kind: InputKind): number[] {
  const seq = new Array<number>(L).fill(0)

  if (kind === 'pulse') {
    const start = Math.floor(L * 0.2)
    const end = Math.floor(L * 0.3)
    for (let t = start; t < end && t < L; t++) seq[t] = 1
  } else if (kind === 'step') {
    const start = Math.floor(L * 0.3)
    for (let t = start; t < L; t++) seq[t] = 1
  } else if (kind === 'sine') {
    const freq = (2 * Math.PI) / (L / 4)
    for (let t = 0; t < L; t++) seq[t] = Math.sin(freq * t)
  }

  return seq
}

/**
 * Simulate discrete-time SSM:
 *   h_{t+1} = A h_t + B x_t
 *   y_t     = C h_t
 *
 * A: 2x2, B: 2x1, C: 1x2
 */
function simulateSSM(
  A: number[][],
  B: number[][],
  C: number[][],
  xSeq: number[]
): {
  xSeries: TimePoint[]
  hSeries: StatePoint[]
  ySeries: TimePoint[]
} {
  const L = xSeq.length
  const xSeries: TimePoint[] = []
  const hSeries: StatePoint[] = []
  const ySeries: TimePoint[] = []

  let h0 = 0
  let h1 = 0

  const [a00, a01] = A[0]
  const [a10, a11] = A[1]
  const b0 = (B[0]?.[0] ?? 0)
  const b1 = (B[1]?.[0] ?? 0)
  const c0 = (C[0]?.[0] ?? 0)
  const c1 = (C[0]?.[1] ?? 0)

  for (let t = 0; t < L; t++) {
    const x = xSeq[t] ?? 0

    const newH0 = a00 * h0 + a01 * h1 + b0 * x
    const newH1 = a10 * h0 + a11 * h1 + b1 * x

    h0 = newH0
    h1 = newH1

    const y = c0 * h0 + c1 * h1

    xSeries.push({ t, value: x })
    hSeries.push({ t, x: h0, y: h1 })
    ySeries.push({ t, value: y })
  }

  return { xSeries, hSeries, ySeries }
}

/**
 * Generic D3 waveform plot (for x(t) and y(t))
 */
interface WaveformPlotProps {
  data: TimePoint[]
  width?: number
  height?: number
  color: string
  label: string
  currentIndex: number
  backgroundColor?: string
}

const WaveformPlot: React.FC<WaveformPlotProps> = ({
  data,
  width = 420,
  height = 110,
  color,
  label,
  currentIndex,
  backgroundColor = BG_COLOR,
}) => {
  const margin = { top: 18, right: 12, bottom: 24, left: 36 }

  const [tMin, tMax, vMin, vMax] = useMemo(() => {
    if (data.length === 0) return [0, 1, -1, 1]
    const tExtent = d3.extent(data, d => d.t)
    const vExtent = d3.extent(data, d => d.value)
    const t0 = tExtent[0] ?? 0
    const t1 = tExtent[1] ?? 1
    let v0 = vExtent[0] ?? -1
    let v1 = vExtent[1] ?? 1
    if (v0 === v1) {
      v0 -= 1
      v1 += 1
    } else {
      const pad = (v1 - v0) * 0.1
      v0 -= pad
      v1 += pad
    }
    return [t0, t1, v0, v1]
  }, [data])

  const xScale = useMemo(
    () => d3.scaleLinear().domain([tMin, tMax]).range([margin.left, width - margin.right]),
    [tMin, tMax, width, margin.left, margin.right]
  )

  const yScale = useMemo(
    () => d3.scaleLinear().domain([vMin, vMax]).range([height - margin.bottom, margin.top]),
    [vMin, vMax, height, margin.bottom, margin.top]
  )

  const lineGen = useMemo(
    () =>
      d3
        .line<TimePoint>()
        .x(d => xScale(d.t))
        .y(d => yScale(d.value))
        .curve(d3.curveMonotoneX),
    [xScale, yScale]
  )

  const fullPath = useMemo(() => lineGen(data) ?? '', [lineGen, data])

  const visibleData = useMemo(
    () => data.filter(d => d.t <= currentIndex),
    [data, currentIndex]
  )

  const visiblePath = useMemo(
    () => lineGen(visibleData) ?? '',
    [lineGen, visibleData]
  )

  const markerPoint = visibleData.length > 0 ? visibleData[visibleData.length - 1] : data[0]

  return (
    <svg width={width} height={height} style={{ background: backgroundColor, borderRadius: 8 }}>
      {/* Axes */}
      <line
        x1={margin.left}
        x2={width - margin.right}
        y1={height - margin.bottom}
        y2={height - margin.bottom}
        stroke="#374151"
        strokeWidth={1}
      />
      <line
        x1={margin.left}
        x2={margin.left}
        y1={margin.top}
        y2={height - margin.bottom}
        stroke="#374151"
        strokeWidth={1}
      />

      {/* Zero line */}
      {0 >= vMin && 0 <= vMax && (
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke="#1f2937"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}

      {/* Full trajectory (faint) */}
      <path
        d={fullPath}
        fill="none"
        stroke="rgba(148,163,184,0.3)"
        strokeWidth={1.5}
      />

      {/* Past trajectory */}
      <path
        d={visiblePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
      />

      {/* Moving marker */}
      {markerPoint && (
        <circle
          cx={xScale(markerPoint.t)}
          cy={yScale(markerPoint.value)}
          r={4}
          fill={color}
        />
      )}

      {/* Current time vertical line */}
      {data.length > 0 && (
        <line
          x1={xScale(currentIndex)}
          x2={xScale(currentIndex)}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke="rgba(255,255,255,0.35)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
      )}

      {/* Label */}
      <text
        x={margin.left}
        y={14}
        fill="#e5e7eb"
        fontSize={12}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        {label}
      </text>

      <text
        x={width - margin.right}
        y={height - 6}
        textAnchor="end"
        fill="#6b7280"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        t
      </text>
    </svg>
  )
}

/**
 * 2D hidden state trajectory plot
 */
interface StateSpacePlotProps {
  states: StatePoint[]
  width?: number
  height?: number
  currentIndex: number
}

const StateSpacePlot: React.FC<StateSpacePlotProps> = ({
  states,
  width = 420,
  height = 260,
  currentIndex,
}) => {
  const margin = { top: 24, right: 18, bottom: 32, left: 40 }

  const [xMin, xMax, yMin, yMax] = useMemo(() => {
    if (states.length === 0) return [-1, 1, -1, 1]

    const xExtent = d3.extent(states, s => s.x)
    const yExtent = d3.extent(states, s => s.y)
    let x0 = xExtent[0] ?? -1
    let x1 = xExtent[1] ?? 1
    let y0 = yExtent[0] ?? -1
    let y1 = yExtent[1] ?? 1

    // Symmetric-ish padding
    const padX = (x1 - x0 || 2) * 0.2
    const padY = (y1 - y0 || 2) * 0.2
    x0 -= padX
    x1 += padX
    y0 -= padY
    y1 += padY

    // Ensure non-degenerate ranges
    if (x0 === x1) {
      x0 -= 1
      x1 += 1
    }
    if (y0 === y1) {
      y0 -= 1
      y1 += 1
    }

    return [x0, x1, y0, y1]
  }, [states])

  const xScale = useMemo(
    () => d3.scaleLinear().domain([xMin, xMax]).range([margin.left, width - margin.right]),
    [xMin, xMax, width, margin.left, margin.right]
  )
  const yScale = useMemo(
    () => d3.scaleLinear().domain([yMin, yMax]).range([height - margin.bottom, margin.top]),
    [yMin, yMax, height, margin.bottom, margin.top]
  )

  const lineGen = useMemo(
    () =>
      d3
        .line<StatePoint>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5)),
    [xScale, yScale]
  )

  const fullPath = useMemo(() => lineGen(states) ?? '', [lineGen, states])
  const visibleStates = useMemo(
    () => states.filter(s => s.t <= currentIndex),
    [states, currentIndex]
  )
  const visiblePath = useMemo(() => lineGen(visibleStates) ?? '', [lineGen, visibleStates])

  const current = visibleStates.length > 0 ? visibleStates[visibleStates.length - 1] : states[0]

  return (
    <svg width={width} height={height} style={{ background: BG_COLOR, borderRadius: 8 }}>
      {/* Grid */}
      {[0.25, 0.5, 0.75].map((f, i) => {
        const x = margin.left + f * (width - margin.left - margin.right)
        const y = margin.top + f * (height - margin.top - margin.bottom)
        return (
          <g key={i}>
            <line
              x1={x}
              x2={x}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#111827"
              strokeWidth={1}
            />
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y}
              y2={y}
              stroke="#111827"
              strokeWidth={1}
            />
          </g>
        )
      })}

      {/* Axes at origin */}
      {0 >= xMin && 0 <= xMax && (
        <line
          x1={xScale(0)}
          x2={xScale(0)}
          y1={margin.top}
          y2={height - margin.bottom}
          stroke="#374151"
          strokeWidth={1}
        />
      )}
      {0 >= yMin && 0 <= yMax && (
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke="#374151"
          strokeWidth={1}
        />
      )}

      {/* Full trajectory (faint) */}
      <path
        d={fullPath}
        fill="none"
        stroke="rgba(249,115,22,0.2)"
        strokeWidth={1.5}
      />

      {/* Past trajectory */}
      <path
        d={visiblePath}
        fill="none"
        stroke={STATE_COLOR}
        strokeWidth={2.5}
      />

      {/* Small faded dots along trajectory */}
      {visibleStates.map(s => (
        <circle
          key={s.t}
          cx={xScale(s.x)}
          cy={yScale(s.y)}
          r={2}
          fill="rgba(248,250,252,0.2)"
        />
      ))}

      {/* Current state marker */}
      {current && (
        <g>
          <circle
            cx={xScale(current.x)}
            cy={yScale(current.y)}
            r={7}
            fill={STATE_COLOR}
          />
          <circle
            cx={xScale(current.x)}
            cy={yScale(current.y)}
            r={11}
            fill="none"
            stroke={STATE_COLOR}
            strokeWidth={1.5}
            strokeOpacity={0.5}
          />
        </g>
      )}

      {/* Labels */}
      <text
        x={margin.left}
        y={18}
        fill="#e5e7eb"
        fontSize={12}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        Hidden state h(t) in 2D state space
      </text>

      <text
        x={width - margin.right}
        y={height - 6}
        textAnchor="end"
        fill="#6b7280"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        h₁
      </text>
      <text
        x={margin.left + 2}
        y={margin.top + 10}
        fill="#6b7280"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        h₂
      </text>
    </svg>
  )
}

/**
 * Simple matrix heatmap for A, B, C
 */
interface MatrixHeatmapProps {
  matrix: number[][]
  label: string
  width?: number
  height?: number
}

const MatrixHeatmap: React.FC<MatrixHeatmapProps> = ({
  matrix,
  label,
  width = 120,
  height = 120,
}) => {
  const rows = matrix.length
  const cols = matrix[0]?.length ?? 0
  const flat = matrix.flat()
  const maxAbs = flat.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1

  const cellWidth = width / Math.max(cols, 1)
  const cellHeight = (height - 22) / Math.max(rows, 1)

  const colorPos = d3
    .scaleLinear<number, string>()
    .domain([0, maxAbs])
    .range(['rgba(148,163,184,0.1)', STATE_COLOR])

  const colorNeg = d3
    .scaleLinear<number, string>()
    .domain([0, maxAbs])
    .range(['rgba(148,163,184,0.1)', OUTPUT_COLOR])

  const colorFor = (v: number) => {
    if (v >= 0) return colorPos(v)
    return colorNeg(-v)
  }

  return (
    <svg
      width={width}
      height={height}
      style={{ background: BG_COLOR, borderRadius: 8 }}
    >
      <text
        x={6}
        y={14}
        fill="#e5e7eb"
        fontSize={11}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        {label}
      </text>

      <g transform={`translate(0,22)`}>
        {/* Cells */}
        {matrix.map((row, i) =>
          row.map((v, j) => (
            <g key={`${i}-${j}`}>
              <rect
                x={j * cellWidth + 8}
                y={i * cellHeight + 4}
                width={cellWidth - 10}
                height={cellHeight - 6}
                fill={colorFor(v)}
                stroke="#020617"
                strokeWidth={0.5}
                rx={2}
              />
              <text
                x={j * cellWidth + cellWidth / 2}
                y={i * cellHeight + cellHeight / 2 + 3}
                textAnchor="middle"
                fill="#e5e7eb"
                fontSize={10}
                fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
              >
                {v.toFixed(2)}
              </text>
            </g>
          ))
        )}
      </g>
    </svg>
  )
}

/**
 * RNN vs SSM recurrence unrolling diagram
 */
interface RNNDiagramProps {
  length: number
  currentStep: number
}

const RNNUnrollDiagram: React.FC<RNNDiagramProps> = ({ length, currentStep }) => {
  const displayLen = Math.min(length, 8)
  const steps = Array.from({ length: displayLen }, (_, i) => i)
  const width = 420
  const height = 120
  const margin = { top: 22, right: 12, bottom: 14, left: 12 }

  const row1Y = margin.top + 18     // RNN
  const row2Y = margin.top + 60     // SSM
  const availableWidth = width - margin.left - margin.right
  const boxWidth = availableWidth / displayLen - 4
  const boxHeight = 20
  const activeIdx = currentStep % displayLen

  return (
    <svg width={width} height={height} style={{ background: BG_COLOR, borderRadius: 8 }}>
      <text
        x={margin.left}
        y={14}
        fill="#e5e7eb"
        fontSize={11}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        RNN vs SSM recurrence
      </text>

      {/* RNN row label */}
      <text
        x={margin.left}
        y={row1Y - 8}
        fill="#9ca3af"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        RNN (sequential, hₜ → hₜ₊₁)
      </text>

      {/* SSM row label */}
      <text
        x={margin.left}
        y={row2Y - 8}
        fill="#9ca3af"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        SSM (linear; parallelizable over t)
      </text>

      {steps.map(i => {
        const x = margin.left + i * (boxWidth + 4)

        return (
          <g key={i}>
            {/* RNN boxes */}
            <rect
              x={x}
              y={row1Y}
              width={boxWidth}
              height={boxHeight}
              rx={4}
              fill="rgba(15,23,42,0.9)"
              stroke={i === activeIdx ? STATE_COLOR : '#374151'}
              strokeWidth={i === activeIdx ? 2 : 1}
            />
            <text
              x={x + boxWidth / 2}
              y={row1Y + 13}
              textAnchor="middle"
              fill="#e5e7eb"
              fontSize={10}
              fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
            >
              h{i}
            </text>

            {/* RNN arrows */}
            {i < displayLen - 1 && (
              <line
                x1={x + boxWidth}
                x2={x + boxWidth + 4}
                y1={row1Y + boxHeight / 2}
                y2={row1Y + boxHeight / 2}
                stroke="#4b5563"
                strokeWidth={1}
                markerEnd="url(#arrow-rnn)"
              />
            )}

            {/* SSM boxes */}
            <rect
              x={x}
              y={row2Y}
              width={boxWidth}
              height={boxHeight}
              rx={4}
              fill="rgba(15,23,42,0.9)"
              stroke={i === activeIdx ? OUTPUT_COLOR : '#374151'}
              strokeWidth={i === activeIdx ? 2 : 1}
            />
            <text
              x={x + boxWidth / 2}
              y={row2Y + 13}
              textAnchor="middle"
              fill="#e5e7eb"
              fontSize={10}
              fontFamily="'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
            >
              y{i}
            </text>
          </g>
        )
      })}

      {/* Simple note about O(L) and parallelism */}
      <text
        x={margin.left}
        y={height - 4}
        fill="#6b7280"
        fontSize={10}
        fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
      >
        RNN requires left→right recurrence; linear SSM can be evaluated in O(L) with parallel scans.
      </text>
    </svg>
  )
}

/**
 * Main SSM explorer component
 */
const SSMStateSpaceExplorer: React.FC<SSMStateSpaceExplorerProps> = ({ length = 80 }) => {
  const L = length
  const [inputKind, setInputKind] = useState<InputKind>('pulse')
  const [rho, setRho] = useState(0.9)           // eigenvalue magnitude (spectral radius)
  const [thetaDeg, setThetaDeg] = useState(45)  // eigenvalue angle (oscillation)
  const [bGain, setBGain] = useState(0.8)       // input influence magnitude
  const [speed, setSpeed] = useState(1)         // playback speed factor
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  const thetaRad = useMemo(() => (thetaDeg * Math.PI) / 180, [thetaDeg])

  // Construct A as a damped rotation: eigenvalues ρ e^{± i θ}
  const A = useMemo(() => {
    const r = rho
    const c = Math.cos(thetaRad)
    const s = Math.sin(thetaRad)
    return [
      [r * c, -r * s],
      [r * s, r * c],
    ]
  }, [rho, thetaRad])

  // Simple input projection B and output projection C
  const B = useMemo(() => [[bGain], [0]], [bGain])
  const C = useMemo(() => [[1, 0]], [])

  const inputSeq = useMemo(
    () => generateInputSequence(L, inputKind),
    [L, inputKind]
  )

  const { xSeries, hSeries, ySeries } = useMemo(
    () => simulateSSM(A, B, C, inputSeq),
    [A, B, C, inputSeq]
  )

  // Playback animation
  useEffect(() => {
    if (!isPlaying) return

    let frameId: number
    let lastTime: number | null = null
    const baseStepsPerSecond = 40

    const loop = (time: number) => {
      if (lastTime === null) {
        lastTime = time
      }
      const dt = time - lastTime
      const stepFloat = (dt / 1000) * baseStepsPerSecond * speed
      const stepsToAdvance = Math.floor(stepFloat)

      if (stepsToAdvance > 0) {
        setCurrentStep(prev => {
          const next = prev + stepsToAdvance
          return next >= L ? next % L : next
        })
        lastTime = time
      }

      frameId = window.requestAnimationFrame(loop)
    }

    frameId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(frameId)
  }, [isPlaying, L, speed])

  const eigenString = useMemo(() => {
    const real = (rho * Math.cos(thetaRad)).toFixed(2)
    const imag = (rho * Math.sin(thetaRad)).toFixed(2)
    return `λ = ${real} ± ${imag} i`
  }, [rho, thetaRad])

  return (
    <section
      className="card interactive-card ssm-explorer"
      style={{
        background: BG_COLOR,
        borderRadius: 16,
        border: '1px solid #111827',
        padding: 16,
        color: '#e5e7eb',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 16,
          alignItems: 'stretch',
          flexWrap: 'wrap',
        }}
      >
        {/* Left: controls + explanation */}
        <div
          style={{
            flex: '0 0 280px',
            maxWidth: 320,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <h2 style={{ fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
            State Space Model Explorer
          </h2>
          <p style={{ fontSize: 13, color: '#9ca3af', lineHeight: 1.5 }}>
            SSMs evolve a hidden state with a{' '}
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular', fontSize: 12 }}>
              h&apos;(t) = A h(t) + B x(t)
            </code>{' '}
            (discretized here as hₜ₊₁ = A hₜ + B xₜ) and read out with{' '}
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular', fontSize: 12 }}>
              yₜ = C hₜ
            </code>
            .
          </p>

          <div
            style={{
              padding: 10,
              borderRadius: 10,
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid #111827',
            }}
          >
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}>
              <strong>A</strong> controls memory and oscillation:
            </p>
            <ul style={{ paddingLeft: 18, fontSize: 12, color: '#9ca3af' }}>
              <li>Magnitude ρ &lt; 1 → decaying memory (stable)</li>
              <li>Magnitude ρ &gt; 1 → exploding state</li>
              <li>Angle θ &gt; 0 → oscillatory dynamics</li>
            </ul>
            <p style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>
              <strong>B</strong> sets how strongly inputs push the state.
              <br />
              <strong>C</strong> decides how the state is read out as y(t).
            </p>
          </div>

          {/* Controls */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              marginTop: 4,
              fontSize: 12,
            }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Input sequence
              <select
                value={inputKind}
                onChange={e => setInputKind(e.target.value as InputKind)}
                style={{
                  background: '#020617',
                  borderRadius: 6,
                  border: '1px solid #1f2937',
                  padding: '4px 6px',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
              >
                <option value="pulse">Pulse</option>
                <option value="step">Step</option>
                <option value="sine">Sine wave</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              A eigenvalue magnitude ρ ({rho.toFixed(2)})
              <input
                type="range"
                min={0.2}
                max={1.4}
                step={0.02}
                value={rho}
                onChange={e => setRho(parseFloat(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              A eigenvalue angle θ ({thetaDeg.toFixed(0)}°)
              <input
                type="range"
                min={0}
                max={180}
                step={1}
                value={thetaDeg}
                onChange={e => setThetaDeg(parseFloat(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Input influence ‖B‖ ({bGain.toFixed(2)})
              <input
                type="range"
                min={0}
                max={2}
                step={0.05}
                value={bGain}
                onChange={e => setBGain(parseFloat(e.target.value))}
              />
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Playback speed ({speed.toFixed(1)}×)
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.25}
                value={speed}
                onChange={e => setSpeed(parseFloat(e.target.value))}
              />
            </label>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => setIsPlaying(p => !p)}
                style={{
                  fontSize: 12,
                  padding: '4px 10px',
                  borderRadius: 999,
                  border: '1px solid #1f2937',
                  background: isPlaying ? '#111827' : '#0b1120',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                t = {currentStep} / {L - 1}
                <br />
                {eigenString}
              </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 2 }}>
              Scrub time
              <input
                type="range"
                min={0}
                max={L - 1}
                step={1}
                value={currentStep}
                onChange={e => {
                  setCurrentStep(parseInt(e.target.value, 10))
                  setIsPlaying(false)
                }}
              />
            </label>
          </div>
        </div>

        {/* Right: plots */}
        <div
          style={{
            flex: '1 1 420px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <WaveformPlot
            data={xSeries}
            color={INPUT_COLOR}
            label="Input x(t)"
            currentIndex={currentStep}
          />

          <StateSpacePlot
            states={hSeries}
            currentIndex={currentStep}
          />

          <WaveformPlot
            data={ySeries}
            color={OUTPUT_COLOR}
            label="Output y(t)"
            currentIndex={currentStep}
          />
        </div>
      </div>

      {/* Matrices and RNN comparison */}
      <div
        style={{
          marginTop: 12,
          display: 'flex',
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          alignItems: 'flex-start',
        }}
      >
        <MatrixHeatmap matrix={A} label="A: state transition" />
        <MatrixHeatmap matrix={B} label="B: input → state" />
        <MatrixHeatmap matrix={C} label="C: state → output" />
        <div style={{ flex: '1 1 420px' }}>
          <RNNUnrollDiagram length={L} currentStep={currentStep} />
        </div>
      </div>
    </section>
  )
}

export default SSMStateSpaceExplorer
```

---

### How this matches your spec

* **Input waveform** `x(t)` on top: `WaveformPlot` with gray stroke (`INPUT_COLOR`).
* **Hidden state `h(t)`** as a moving point: `StateSpacePlot` shows a 2D trajectory in orange (`STATE_COLOR`) with a highlighted moving marker.
* **Output waveform** `y(t)` below: `WaveformPlot` with teal stroke (`OUTPUT_COLOR`).
* **Animation**: `useEffect` + `requestAnimationFrame` steps through time, controlled by a play/pause button and speed slider.
* **Matrices A, B, C**: `MatrixHeatmap` renders small heatmaps with numeric values, visually encoding sign and magnitude.
* **RNN comparison**: `RNNUnrollDiagram` shows a small unrolled RNN row (h₀ → h₁ → …) and a parallel SSM row (y₀ … yₜ) with a note about O(L) and parallel scans.
* **Interactive eigenvalues**: sliders for eigenvalue magnitude ρ and angle θ, with `A` parameterized as a damped rotation (complex eigenvalues ρ e^{± i θ}), so you can see stability vs oscillation.
* **Explanatory text**: inline explanation of how A (memory & oscillation), B (input influence), and C (readout) work, plus the continuous-time equation `h'(t) = A h(t) + B x(t)` and its discrete version.

You’ll just need `d3` installed:

```bash
npm install d3
# or
yarn add d3
```

and then you can use `<SSMStateSpaceExplorer />` in any Next.js page or explorable layout.
