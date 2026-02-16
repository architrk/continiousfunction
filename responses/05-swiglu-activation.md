This component is designed to plug into the same “card / dark canvas” style as your other interactive components. 

attachments-bundle

tsx
Copy code
'use client'

import React, { useMemo, useState } from 'react'
import * as d3 from 'd3'
import { MATH_COLORS } from '../lib/mathObjects'

const WIDTH = 520
const HEIGHT = 320
const PADDING = { top: 24, right: 16, bottom: 36, left: 40 }

const BRANCH_WIDTH = 360
const BRANCH_HEIGHT = 180
const BRANCH_PADDING = { top: 20, right: 16, bottom: 28, left: 36 }

const X_MIN = -3
const X_MAX = 3
const NUM_SAMPLES = 256

type Point = { x: number; y: number }

const COLORS = {
  relu: '#6b7280',
  gelu: '#3b82f6',
  silu: '#8b5cf6',
  swiglu: '#f59e0b',
}

// --- Activation functions ----------------------------------------------------

function relu(x: number): number {
  return x > 0 ? x : 0
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function gelu(x: number): number {
  // Gaussian Error Linear Unit (tanh approximation)
  const c = Math.sqrt(2 / Math.PI)
  const inner = c * (x + 0.044715 * Math.pow(x, 3))
  return 0.5 * x * (1 + Math.tanh(inner))
}

function silu(x: number): number {
  return x * sigmoid(x)
}

// 1D toy SwiGLU: value(x) ⊙ gate(x), where gate uses Swish/SiLU
function swigluValueBranch(x: number): number {
  return x
}

function swigluGateBranch(x: number): number {
  // Swish gate
  return silu(x)
}

function swigluCombined(x: number): number {
  return swigluValueBranch(x) * swigluGateBranch(x)
}

function generateSamples(fn: (x: number) => number): Point[] {
  const samples: Point[] = []
  for (let i = 0; i <= NUM_SAMPLES; i++) {
    const t = i / NUM_SAMPLES
    const x = X_MIN + (X_MAX - X_MIN) * t
    samples.push({ x, y: fn(x) })
  }
  return samples
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

// --- Main component ---------------------------------------------------------

export default function ActivationFunctionExplorer() {
  const [hoverX, setHoverX] = useState(0)
  const [dModel, setDModel] = useState(1024)

  // Sample curves
  const reluSamples = useMemo(() => generateSamples(relu), [])
  const geluSamples = useMemo(() => generateSamples(gelu), [])
  const siluSamples = useMemo(() => generateSamples(silu), [])
  const swigluSamples = useMemo(() => generateSamples(swigluCombined), [])
  const valueBranchSamples = useMemo(() => generateSamples(swigluValueBranch), [])
  const gateBranchSamples = useMemo(() => generateSamples(swigluGateBranch), [])

  // Shared y-domain for main chart (includes SwiGLU, which has largest magnitude)
  const [yMin, yMax] = useMemo(() => {
    const all = [...reluSamples, ...geluSamples, ...siluSamples, ...swigluSamples]
    let min = Infinity
    let max = -Infinity
    all.forEach(p => {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
    })
    const pad = (max - min) * 0.1 || 1
    return [min - pad, max + pad]
  }, [reluSamples, geluSamples, siluSamples, swigluSamples])

  // Scales for main chart
  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([X_MIN, X_MAX])
        .range([PADDING.left, WIDTH - PADDING.right]),
    []
  )

  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([HEIGHT - PADDING.bottom, PADDING.top]),
    [yMin, yMax]
  )

  const lineMain = useMemo(
    () =>
      d3
        .line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom),
    [xScale, yScale]
  )

  const xTicks = useMemo(() => d3.ticks(X_MIN, X_MAX, 6), [])
  const yTicks = useMemo(() => d3.ticks(yMin, yMax, 5), [yMin, yMax])

  // SwiGLU branch chart scales
  const branchYDomain = useMemo(() => {
    const all = [...valueBranchSamples, ...gateBranchSamples, ...swigluSamples]
    let min = Infinity
    let max = -Infinity
    all.forEach(p => {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
    })
    const pad = (max - min) * 0.1 || 1
    return [min - pad, max + pad]
  }, [valueBranchSamples, gateBranchSamples, swigluSamples])

  const branchXScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([X_MIN, X_MAX])
        .range([BRANCH_PADDING.left, BRANCH_WIDTH - BRANCH_PADDING.right]),
    []
  )

  const branchYScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(branchYDomain)
        .range([BRANCH_HEIGHT - BRANCH_PADDING.bottom, BRANCH_PADDING.top]),
    [branchYDomain]
  )

  const lineBranch = useMemo(
    () =>
      d3
        .line<Point>()
        .x(d => branchXScale(d.x))
        .y(d => branchYScale(d.y))
        .curve(d3.curveCatmullRom),
    [branchXScale, branchYScale]
  )

  // Values at current x
  const x = hoverX
  const reluVal = relu(x)
  const geluVal = gelu(x)
  const sigVal = sigmoid(x)
  const siluVal = silu(x)
  const valueBranchVal = swigluValueBranch(x)
  const gateBranchVal = swigluGateBranch(x)
  const swigluVal = swigluCombined(x)

  // Gate "openness" for metaphor (normalized 0-1 via sigmoid)
  const gateOpen = sigmoid(x)

  // Param-count comparison (2/3 hidden dim scaling)
  const ffnMultiplier = 4 // standard Transformer FFN expansion
  const dFFReLU = ffnMultiplier * dModel
  const paramsReLU = 2 * dModel * dFFReLU // W1 + W2
  const dFFSwiGLU = Math.round((2 / 3) * dFFReLU)
  const paramsSwiGLU = 3 * dModel * dFFSwiGLU // Wv, Wg, Wo
  const paramRatio = paramsSwiGLU / paramsReLU

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
    const px = event.clientX - rect.left
    const clamped = Math.max(PADDING.left, Math.min(WIDTH - PADDING.right, px))
    const domainX = xScale.invert(clamped)
    setHoverX(domainX)
  }

  const handleMouseLeave = () => {
    // Snap back to center when leaving the chart
    setHoverX(0)
  }

  return (
    <section className="card interactive-card activation-functions-card" style={{ background: MATH_COLORS.surface }}>
      <h2>Activation Functions: ReLU, GELU, SiLU &amp; SwiGLU</h2>
      <p className="muted">
        Compare classic activations with SwiGLU, treating it not just as a new curve but as a
        <strong> learned gate</strong> where one projection modulates another.
      </p>

      {/* Main layout: chart + readout */}
      <div className="activation-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* Main SVG chart */}
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="activation-chart"
          role="img"
          aria-label="Activation functions plotted from -3 to 3"
          style={{ borderRadius: 12, background: '#020617' }}
        >
          {/* Grid */}
          <g>
            {xTicks.map(t => {
              const xPos = xScale(t)
              return (
                <line
                  key={`x-grid-${t}`}
                  x1={xPos}
                  y1={PADDING.top}
                  x2={xPos}
                  y2={HEIGHT - PADDING.bottom}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth={1}
                />
              )
            })}
            {yTicks.map(t => {
              const yPos = yScale(t)
              return (
                <line
                  key={`y-grid-${t}`}
                  x1={PADDING.left}
                  y1={yPos}
                  x2={WIDTH - PADDING.right}
                  y2={yPos}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth={1}
                />
              )
            })}
          </g>

          {/* Axes */}
          <line
            x1={PADDING.left}
            y1={yScale(0)}
            x2={WIDTH - PADDING.right}
            y2={yScale(0)}
            stroke="rgba(148, 163, 184, 0.7)"
            strokeWidth={1.5}
          />
          <line
            x1={xScale(0)}
            y1={PADDING.top}
            x2={xScale(0)}
            y2={HEIGHT - PADDING.bottom}
            stroke="rgba(148, 163, 184, 0.7)"
            strokeWidth={1.5}
          />

          {/* Axis labels */}
          <text
            x={WIDTH - PADDING.right}
            y={yScale(0) + 16}
            fill="#9ca3af"
            fontSize={11}
            textAnchor="end"
          >
            x
          </text>
          <text
            x={xScale(0) - 8}
            y={PADDING.top + 4}
            fill="#9ca3af"
            fontSize={11}
            textAnchor="end"
          >
            f(x)
          </text>

          {/* Ticks text */}
          <g>
            {xTicks.map(t => (
              <text
                key={`x-tick-${t}`}
                x={xScale(t)}
                y={HEIGHT - PADDING.bottom + 18}
                fill="#6b7280"
                fontSize={10}
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {yTicks.map(t => (
              <text
                key={`y-tick-${t}`}
                x={PADDING.left - 6}
                y={yScale(t) + 3}
                fill="#6b7280"
                fontSize={10}
                textAnchor="end"
              >
                {t.toFixed(1)}
              </text>
            ))}
          </g>

          {/* Activation curves */}
          <path
            d={lineMain(reluSamples) || undefined}
            fill="none"
            stroke={COLORS.relu}
            strokeWidth={2}
          />
          <path
            d={lineMain(geluSamples) || undefined}
            fill="none"
            stroke={COLORS.gelu}
            strokeWidth={2}
          />
          <path
            d={lineMain(siluSamples) || undefined}
            fill="none"
            stroke={COLORS.silu}
            strokeWidth={2}
          />
          <path
            d={lineMain(swigluSamples) || undefined}
            fill="none"
            stroke={COLORS.swiglu}
            strokeWidth={2.3}
          />

          {/* Hover line + markers */}
          {Number.isFinite(x) && (
            <g>
              {/* Vertical hover line */}
              <line
                x1={xScale(x)}
                y1={PADDING.top}
                x2={xScale(x)}
                y2={HEIGHT - PADDING.bottom}
                stroke="rgba(248, 250, 252, 0.5)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              {/* Markers on each curve */}
              {[
                { y: reluVal, color: COLORS.relu },
                { y: geluVal, color: COLORS.gelu },
                { y: siluVal, color: COLORS.silu },
                { y: swigluVal, color: COLORS.swiglu },
              ].map((p, idx) => (
                <circle
                  key={idx}
                  cx={xScale(x)}
                  cy={yScale(p.y)}
                  r={5}
                  fill="#020617"
                  stroke={p.color}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {/* Interaction capture */}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={WIDTH - PADDING.left - PADDING.right}
            height={HEIGHT - PADDING.top - PADDING.bottom}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>

        {/* Sidebar: numeric readout & formulas */}
        <div className="activation-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            className="current-x"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(75, 85, 99, 0.7)',
            }}
          >
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>Input</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18 }}>
              x = <span style={{ color: '#e5e7eb' }}>{x.toFixed(3)}</span>
            </div>
          </div>

          <div className="activation-values" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              {
                name: 'ReLU',
                color: COLORS.relu,
                value: reluVal,
                formula: 'max(0, x)',
              },
              {
                name: 'GELU',
                color: COLORS.gelu,
                value: geluVal,
                formula: '0.5·x·(1 + erf(x / √2))',
              },
              {
                name: 'SiLU (Swish)',
                color: COLORS.silu,
                value: siluVal,
                formula: 'x·σ(x)',
              },
              {
                name: 'SwiGLU (toy)',
                color: COLORS.swiglu,
                value: swigluVal,
                formula: 'value(x)·gate(x)',
              },
            ].map(row => (
              <div
                key={row.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '999px',
                      background: row.color,
                    }}
                  />
                  <span style={{ color: '#e5e7eb' }}>{row.name}</span>
                </div>
                <span style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.value.toFixed(4)}
                </span>
              </div>
            ))}
          </div>

          {/* Formula block that updates with x */}
          <div
            className="activation-formulas"
            style={{
              marginTop: 4,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(12, 10, 9, 0.9)',
              border: '1px solid rgba(55, 65, 81, 0.7)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: '#d1d5db',
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: '#9ca3af', marginBottom: 4 }}>Formulas at this x</div>
            <div>ReLU(x) = max(0, x) = max(0, {x.toFixed(3)}) = {reluVal.toFixed(4)}</div>
            <div>
              GELU(x) ≈ 0.5·x·(1 + tanh(√(2/π)(x + 0.044715x³))) = {geluVal.toFixed(4)}
            </div>
            <div>
              σ(x) = 1 / (1 + e<sup>-x</sup>) = {sigVal.toFixed(4)}
            </div>
            <div>
              SiLU(x) = x·σ(x) = {x.toFixed(3)}·{sigVal.toFixed(4)} = {siluVal.toFixed(4)}
            </div>
            <div style={{ marginTop: 4, color: COLORS.swiglu }}>
              SwiGLU(x) (toy) = value(x)·gate(x) = {valueBranchVal.toFixed(3)} ·{' '}
              {gateBranchVal.toFixed(4)} = {swigluVal.toFixed(4)}
            </div>
          </div>

          {/* Gate metaphor */}
          <div
            className="gate-metaphor"
            style={{
              marginTop: 4,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(55, 65, 81, 0.8)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 4,
                color: '#9ca3af',
              }}
            >
              <span>Gate openness (σ(x))</span>
              <span>{(gateOpen * 100).toFixed(0)}%</span>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 16,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(15, 23, 42, 1)',
                border: '1px solid rgba(75, 85, 99, 0.9)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${gateOpen * 100}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #3b82f6)',
                  transition: 'width 160ms ease-out',
                }}
              />
              {/* A "door" sliding as the gate opens */}
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  bottom: -4,
                  width: 4,
                  left: `${gateOpen * 100}%`,
                  background: '#0f172a',
                  boxShadow: '0 0 10px rgba(15, 23, 42, 0.8)',
                  transition: 'left 160ms ease-out',
                }}
              />
            </div>
            <p className="caption" style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
              SwiGLU lets a <span style={{ color: COLORS.swiglu }}>value projection</span> through a
              gate whose openness is controlled by a <span style={{ color: COLORS.silu }}>gating projection</span>.
            </p>
          </div>
        </div>
      </div>

      {/* SwiGLU branch visualization */}
      <div
        className="swiglu-section"
        style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.25rem' }}
      >
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>SwiGLU as two branches</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            Toy 1D picture of SwiGLU: one linear branch produces a{' '}
            <span style={{ color: COLORS.swiglu }}>value</span>, another produces a{' '}
            <span style={{ color: COLORS.silu }}>gate</span>; their product is the output.
          </p>

          <svg
            width={BRANCH_WIDTH}
            height={BRANCH_HEIGHT}
            viewBox={`0 0 ${BRANCH_WIDTH} ${BRANCH_HEIGHT}`}
            style={{ borderRadius: 10, background: '#020617' }}
          >
            {/* Axes */}
            <line
              x1={BRANCH_PADDING.left}
              y1={branchYScale(0)}
              x2={BRANCH_WIDTH - BRANCH_PADDING.right}
              y2={branchYScale(0)}
              stroke="rgba(148, 163, 184, 0.8)"
              strokeWidth={1.5}
            />
            <line
              x1={branchXScale(0)}
              y1={BRANCH_PADDING.top}
              x2={branchXScale(0)}
              y2={BRANCH_HEIGHT - BRANCH_PADDING.bottom}
              stroke="rgba(148, 163, 184, 0.8)"
              strokeWidth={1.5}
            />

            {/* Branch curves */}
            <path
              d={lineBranch(valueBranchSamples) || undefined}
              fill="none"
              stroke={COLORS.swiglu}
              strokeWidth={2}
            />
            <path
              d={lineBranch(gateBranchSamples) || undefined}
              fill="none"
              stroke={COLORS.silu}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            <path
              d={lineBranch(swigluSamples) || undefined}
              fill="none"
              stroke={COLORS.swiglu}
              strokeWidth={2.5}
              strokeOpacity={0.8}
            />

            {/* Live markers at current x */}
            <g>
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(valueBranchVal)}
                r={4.5}
                fill="#020617"
                stroke={COLORS.swiglu}
                strokeWidth={1.8}
              />
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(gateBranchVal)}
                r={4.5}
                fill="#020617"
                stroke={COLORS.silu}
                strokeWidth={1.8}
              />
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(swigluVal)}
                r={5}
                fill="#020617"
                stroke={COLORS.swiglu}
                strokeWidth={2}
              />
            </g>

            {/* Legend */}
            <g transform={`translate(${BRANCH_PADDING.left}, ${BRANCH_PADDING.top})`} fontSize={10}>
              <g transform="translate(0, 0)">
                <rect width={10} height={2} fill={COLORS.swiglu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  value(x)
                </text>
              </g>
              <g transform="translate(80, 0)">
                <rect width={10} height={2} fill={COLORS.silu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  gate(x) = Swish
                </text>
              </g>
              <g transform="translate(200, 0)">
                <rect width={10} height={2} fill={COLORS.swiglu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  value·gate
                </text>
              </g>
            </g>
          </svg>

          <p className="caption" style={{ fontSize: 11, marginTop: 6, color: '#9ca3af' }}>
            In real models, <code>value(x)</code> and <code>gate(x)</code> are separate linear projections
            of the hidden state. Here we show a 1D toy: value(x) = x, gate(x) = Swish(x).
          </p>
        </div>

        {/* Parameter-count comparison */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Why 2/3 hidden dimension for SwiGLU?</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            A SwiGLU feedforward block uses <strong>three</strong> matrices instead of two, but shrinks the
            hidden dimension to keep parameter count on par with a ReLU block.
          </p>

          <label style={{ display: 'block', fontSize: 12, color: '#e5e7eb', marginBottom: 4 }}>
            Model width <span style={{ color: '#9ca3af' }}>(d_model)</span>: {formatNumber(dModel)}
            <input
              type="range"
              min={128}
              max={4096}
              step={64}
              value={dModel}
              onChange={e => setDModel(parseInt(e.target.value, 10))}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '0.5rem',
              marginTop: 8,
              fontSize: 12,
            }}
          >
            <div
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                background: 'rgba(12, 10, 9, 0.9)',
                border: '1px solid rgba(75, 85, 99, 0.8)',
              }}
            >
              <div style={{ color: '#9ca3af', marginBottom: 2 }}>ReLU FFN</div>
              <div>hidden dim d_ff = {ffnMultiplier}·d_model = {formatNumber(dFFReLU)}</div>
              <div>params ≈ 2·d_model·d_ff</div>
              <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', color: '#e5e7eb' }}>
                ≈ {formatNumber(paramsReLU)}
              </div>
            </div>

            <div
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                background: 'rgba(12, 10, 9, 0.9)',
                border: '1px solid rgba(75, 85, 99, 0.8)',
              }}
            >
              <div style={{ color: '#9ca3af', marginBottom: 2 }}>SwiGLU FFN</div>
              <div>hidden dim d_ff&apos; = (2/3)·d_ff ≈ {formatNumber(dFFSwiGLU)}</div>
              <div>params ≈ 3·d_model·d_ff&apos;</div>
              <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', color: COLORS.swiglu }}>
                ≈ {formatNumber(paramsSwiGLU)}{' '}
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  ({(paramRatio * 100).toFixed(1)}% of ReLU)
                </span>
              </div>
            </div>
          </div>

          <p className="caption" style={{ fontSize: 11, marginTop: 8, color: '#9ca3af' }}>
            In a standard Transformer FFN, ReLU uses two matrices: W₁ ∈ ℝ<sup>d_model×d_ff</sup>,
            W₂ ∈ ℝ<sup>d_ff×d_model</sup>. SwiGLU splits the first into two projections (Wᵥ, Wg),
            and adds a gate:
            <br />
            <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              ReLU: x → W₁ → ReLU → W₂
            </code>
            <br />
            <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              SwiGLU: x → [Wᵥ, Wg] → (xWᵥ) ⊙ Swish(xWg) → Wₒ
            </code>
            <br />
            Choosing d_ff&apos; = (2/3)·d_ff keeps 3·d_model·d_ff&apos; ≈ 2·d_model·d_ff, so SwiGLU
            behaves like a gated ReLU block at roughly the same parameter cost.
          </p>
        </div>
      </div>
    </section>
  )
}
