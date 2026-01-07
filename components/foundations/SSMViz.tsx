'use client'

import React, { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'

/**
 * Basic types
 */
type TimePoint = { t: number; value: number }
type StatePoint = { t: number; x: number; y: number }

type InputKind = 'pulse' | 'step' | 'sine'

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed'
type StabilityPrediction = 'stable' | 'oscillating' | 'explosive' | null

// Mystery challenges for the prediction game
const STABILITY_CHALLENGES = [
  {
    name: '🎲 Mystery A',
    rho: 0.85,
    theta: 0,
    bGain: 0.8,
    answer: 'stable' as const,
    description: 'Can you predict this system\'s long-term behavior?',
  },
  {
    name: '🎲 Mystery B',
    rho: 0.92,
    theta: 60,
    bGain: 0.7,
    answer: 'oscillating' as const,
    description: 'Watch for complex eigenvalues...',
  },
  {
    name: '🎲 Mystery C',
    rho: 1.1,
    theta: 30,
    bGain: 0.4,
    answer: 'explosive' as const,
    description: 'Something dangerous lurks here...',
  },
  {
    name: '🎲 Mystery D',
    rho: 0.98,
    theta: 45,
    bGain: 0.5,
    answer: 'oscillating' as const,
    description: 'Near the critical boundary...',
  },
  {
    name: '🎲 Mystery E',
    rho: 0.5,
    theta: 0,
    bGain: 1.0,
    answer: 'stable' as const,
    description: 'How fast will this forget?',
  },
];

// Feedback based on prediction accuracy
const getStabilityFeedback = (
  predicted: StabilityPrediction,
  actual: string,
  rho: number,
  thetaDeg: number
): string => {
  const correct = predicted === actual;

  if (correct) {
    if (actual === 'explosive') {
      return `🎯 Correct! With ρ = ${rho.toFixed(2)} > 1, eigenvalues escape the unit circle. The state grows without bound. Real SSMs require careful initialization to avoid this!`;
    }
    if (actual === 'oscillating') {
      return `🎯 Correct! θ = ${thetaDeg}° means complex eigenvalues λ = ρe^{±iθ}, creating spiraling trajectories. This is how SSMs model periodic patterns!`;
    }
    return `🎯 Correct! With ρ = ${rho.toFixed(2)} < 1 and θ ≈ 0°, this is pure exponential decay. The system quickly "forgets" old inputs—useful for local context.`;
  }

  // Wrong predictions - explain what actually happened
  if (actual === 'explosive') {
    return `❌ Unstable! ρ = ${rho.toFixed(2)} > 1 means |λ| > 1, so the state explodes. The unit circle |λ| = 1 is the critical stability boundary.`;
  }
  if (actual === 'oscillating') {
    return `❌ It oscillates! θ = ${thetaDeg}° creates complex eigenvalues. Even with ρ < 1 (stable), the trajectory spirals rather than decaying directly.`;
  }
  return `❌ It's purely damped! With θ ≈ 0°, there's no oscillation—just smooth exponential decay toward zero.`;
};

const BG_COLOR = '#0d1219'
const INPUT_COLOR = '#9ca3af'   // gray
const STATE_COLOR = '#f59e0b'   // orange
const OUTPUT_COLOR = '#14b8a6'  // teal

// System behavior presets
const BEHAVIOR_PRESETS = [
  { name: '🎯 Stable', rho: 0.85, theta: 0, bGain: 0.8, description: 'Quickly converges to equilibrium' },
  { name: '🌊 Oscillating', rho: 0.92, theta: 60, bGain: 0.7, description: 'Damped oscillations (complex eigenvalues)' },
  { name: '💫 Resonant', rho: 0.98, theta: 45, bGain: 0.5, description: 'Long-lived oscillations (near unit circle)' },
  { name: '💥 Explosive', rho: 1.1, theta: 30, bGain: 0.4, description: 'Unbounded growth (|λ| > 1)' },
  { name: '🐢 Overdamped', rho: 0.7, theta: 0, bGain: 1.0, description: 'Slow, non-oscillatory decay' },
];

// Dynamic educational insights based on system state
const getSSMInsight = (rho: number, thetaDeg: number, bGain: number): string => {
  const theta = thetaDeg * Math.PI / 180;

  if (rho > 1.0) {
    return `💥 UNSTABLE! |λ| = ${rho.toFixed(2)} > 1 means the state explodes exponentially. Real SSMs use careful initialization and normalization to stay stable.`;
  }
  if (rho > 0.98) {
    if (thetaDeg > 20) {
      return `💫 Near the unit circle with θ = ${thetaDeg.toFixed(0)}°! Long memory but risk of instability. Mamba uses selective gating to control this dynamically.`;
    }
    return `📏 Very long memory (ρ ≈ 1). The system remembers far into the past. This is what S4 achieves with HiPPO initialization!`;
  }
  if (rho < 0.5) {
    return `⚡ Very short memory (ρ = ${rho.toFixed(2)}). State decays quickly - only recent inputs matter. Good for local patterns, bad for long dependencies.`;
  }
  if (thetaDeg > 90) {
    return `🎭 High oscillation frequency (θ = ${thetaDeg.toFixed(0)}°). The state alternates rapidly. This can model periodic patterns in sequences.`;
  }
  if (thetaDeg > 30) {
    return `🌊 Oscillatory dynamics (θ = ${thetaDeg.toFixed(0)}°). Complex eigenvalues create spiraling state trajectories. Watch the 2D state space!`;
  }
  if (thetaDeg < 10 && rho > 0.8) {
    return `🐢 Purely decaying (θ ≈ 0). No oscillation, just exponential decay. This is like a simple lowpass filter on the input.`;
  }
  return `📊 Balanced system: ρ = ${rho.toFixed(2)}, θ = ${thetaDeg.toFixed(0)}°. The eigenvalue controls both memory length and oscillation character.`;
};

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

  const colorPos = (d3.scaleLinear() as any)
    .domain([0, maxAbs])
    .range(['rgba(148,163,184,0.1)', STATE_COLOR])

  const colorNeg = (d3.scaleLinear() as any)
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

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof STABILITY_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<StabilityPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })

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

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getSSMInsight(rho, thetaDeg, bGain);
  }, [rho, thetaDeg, bGain]);

  // Stability indicator
  const stabilityStatus = useMemo(() => {
    if (rho > 1.0) return { text: 'UNSTABLE', color: '#ef4444' };
    if (rho > 0.98) return { text: 'CRITICAL', color: '#f59e0b' };
    if (rho > 0.85) return { text: 'STABLE', color: '#22c55e' };
    return { text: 'HIGHLY STABLE', color: '#14b8a6' };
  }, [rho]);

  // Game control functions
  const startChallenge = (challenge: typeof STABILITY_CHALLENGES[0]) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setGamePhase('setup');
    setCurrentStep(0);
    setIsPlaying(false);
  };

  const submitPrediction = (pred: StabilityPrediction) => {
    if (!selectedChallenge || !pred) return;
    setPrediction(pred);
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setGamePhase('setup');
    setSelectedChallenge(null);
    setPrediction(null);
    setCurrentStep(0);
    setIsPlaying(true);
  };

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Reveal phase - apply the challenge parameters and simulate
          if (selectedChallenge) {
            setRho(selectedChallenge.rho);
            setThetaDeg(selectedChallenge.theta);
            setBGain(selectedChallenge.bGain);
            setCurrentStep(0);
            setIsPlaying(true);

            // Update score
            const correct = prediction === selectedChallenge.answer;
            setScore(prev => ({
              correct: prev.correct + (correct ? 1 : 0),
              total: prev.total + 1,
            }));
          }
          setGamePhase('revealed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, selectedChallenge, prediction]);

  // Handle preset selection
  const handlePreset = (preset: typeof BEHAVIOR_PRESETS[0]) => {
    setRho(preset.rho);
    setThetaDeg(preset.theta);
    setBGain(preset.bGain);
    setCurrentStep(0);
  };

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

          {/* Game Mode Toggle */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <button
              onClick={() => {
                setGameMode(!gameMode);
                if (!gameMode) resetGame();
              }}
              style={{
                fontSize: 11,
                padding: '4px 12px',
                borderRadius: 999,
                border: gameMode ? '1px solid #f59e0b' : '1px solid #374151',
                background: gameMode
                  ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                  : 'rgba(15, 23, 42, 0.9)',
                color: gameMode ? '#fbbf24' : '#e5e7eb',
                cursor: 'pointer',
                fontWeight: gameMode ? 600 : 400,
              }}
            >
              {gameMode ? '🎮 Challenge Mode' : '🎮 Try Challenge'}
            </button>
            {gameMode && score.total > 0 && (
              <span style={{ fontSize: 11, color: '#9ca3af' }}>
                Score: {score.correct}/{score.total}
              </span>
            )}
          </div>

          {/* Game Panel */}
          {gameMode && (
            <div style={{
              padding: 12,
              borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(20, 184, 166, 0.1))',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              marginBottom: 12,
            }}>
              {gamePhase === 'setup' && !selectedChallenge && (
                <>
                  <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 8, fontWeight: 600 }}>
                    🎯 Stability Prediction Challenge
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 8 }}>
                    Select a mystery system and predict: will it be stable, oscillating, or explosive?
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {STABILITY_CHALLENGES.map((challenge) => (
                      <button
                        key={challenge.name}
                        onClick={() => startChallenge(challenge)}
                        title={challenge.description}
                        style={{
                          fontSize: 11,
                          padding: '6px 10px',
                          borderRadius: 6,
                          border: '1px solid #374151',
                          background: 'rgba(15, 23, 42, 0.9)',
                          color: '#e5e7eb',
                          cursor: 'pointer',
                        }}
                      >
                        {challenge.name}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {gamePhase === 'setup' && selectedChallenge && (
                <>
                  <p style={{ fontSize: 12, color: '#fbbf24', marginBottom: 6, fontWeight: 600 }}>
                    {selectedChallenge.name}
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                    {selectedChallenge.description}
                  </p>
                  <p style={{ fontSize: 11, color: '#e5e7eb', marginBottom: 8 }}>
                    What will happen when we run this system?
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => submitPrediction('stable')}
                      style={{
                        fontSize: 11,
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid #22c55e',
                        background: 'rgba(34, 197, 94, 0.15)',
                        color: '#22c55e',
                        cursor: 'pointer',
                      }}
                    >
                      🐢 Stable (decays)
                    </button>
                    <button
                      onClick={() => submitPrediction('oscillating')}
                      style={{
                        fontSize: 11,
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid #3b82f6',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#3b82f6',
                        cursor: 'pointer',
                      }}
                    >
                      🌊 Oscillating (spirals)
                    </button>
                    <button
                      onClick={() => submitPrediction('explosive')}
                      style={{
                        fontSize: 11,
                        padding: '8px 14px',
                        borderRadius: 6,
                        border: '1px solid #ef4444',
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: '#ef4444',
                        cursor: 'pointer',
                      }}
                    >
                      💥 Explosive (grows)
                    </button>
                  </div>
                </>
              )}

              {gamePhase === 'countdown' && (
                <div style={{ textAlign: 'center', padding: '20px 0' }}>
                  <p style={{ fontSize: 14, color: '#fbbf24', marginBottom: 8 }}>
                    You predicted: <strong>{prediction}</strong>
                  </p>
                  <p style={{ fontSize: 32, color: '#e5e7eb', fontWeight: 700 }}>
                    {countdown}
                  </p>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>Revealing system...</p>
                </div>
              )}

              {gamePhase === 'revealed' && selectedChallenge && (
                <>
                  <div style={{
                    padding: 10,
                    borderRadius: 8,
                    background: prediction === selectedChallenge.answer
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(239, 68, 68, 0.15)',
                    border: prediction === selectedChallenge.answer
                      ? '1px solid rgba(34, 197, 94, 0.3)'
                      : '1px solid rgba(239, 68, 68, 0.3)',
                    marginBottom: 10,
                  }}>
                    <p style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.5 }}>
                      {getStabilityFeedback(prediction, selectedChallenge.answer, selectedChallenge.rho, selectedChallenge.theta)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                    <span>ρ = {selectedChallenge.rho.toFixed(2)}</span>
                    <span>θ = {selectedChallenge.theta}°</span>
                    <span>Answer: <strong style={{ color: '#fbbf24' }}>{selectedChallenge.answer}</strong></span>
                  </div>
                  <button
                    onClick={resetGame}
                    style={{
                      fontSize: 11,
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1px solid #374151',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    Try Another
                  </button>
                </>
              )}
            </div>
          )}

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

          {/* Behavior Presets */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {BEHAVIOR_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => handlePreset(preset)}
                title={preset.description}
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 999,
                  border: '1px solid #374151',
                  background: rho === preset.rho && thetaDeg === preset.theta
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(15, 23, 42, 0.9)',
                  color: rho === preset.rho && thetaDeg === preset.theta
                    ? '#fbbf24'
                    : '#e5e7eb',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease-out',
                }}
              >
                {preset.name}
              </button>
            ))}
          </div>

          {/* Stability indicator */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 10px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.3)',
            border: `1px solid ${stabilityStatus.color}40`,
          }}>
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: stabilityStatus.color,
              boxShadow: `0 0 8px ${stabilityStatus.color}`,
            }} />
            <span style={{ fontSize: 11, color: stabilityStatus.color, fontWeight: 600 }}>
              {stabilityStatus.text}
            </span>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>|λ| = {rho.toFixed(2)}</span>
          </div>

          {/* Dynamic Insight */}
          <div style={{
            padding: '8px 10px',
            borderRadius: 8,
            background: rho > 1.0
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
            border: rho > 1.0
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
            fontSize: 11,
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.5,
          }}>
            {currentInsight}
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
