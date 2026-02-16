Here’s a drop‑in client component that hits all your requirements: 2D activation space, draggable concept direction, dot‑product projection, sentiment example, and a small “King − Man + Woman ≈ Queen” inset.

 

You can save this as components/LinearProbeVisualizer.tsx in a Next.js app.

tsx
Copy code
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

type Sentiment = 'positive' | 'negative'

interface ActivationPoint {
  id: string
  x: number
  y: number
  label: string
  text: string
  trueSentiment: Sentiment
}

interface Direction {
  dx: number
  dy: number
}

const SENTIMENT_POINTS: ActivationPoint[] = [
  {
    id: 'p1',
    x: 1.4,
    y: 1.0,
    label: 'Great battery',
    text: 'Love this phone, battery lasts all day.',
    trueSentiment: 'positive',
  },
  {
    id: 'p2',
    x: 1.3,
    y: 0.7,
    label: 'Super comfy',
    text: 'These headphones are super comfortable.',
    trueSentiment: 'positive',
  },
  {
    id: 'p3',
    x: 1.1,
    y: 1.3,
    label: 'Amazing',
    text: 'Absolutely amazing customer support.',
    trueSentiment: 'positive',
  },
  {
    id: 'p4',
    x: 0.8,
    y: 0.9,
    label: 'Works well',
    text: 'Works well for my daily use.',
    trueSentiment: 'positive',
  },
  {
    id: 'p5',
    x: 1.6,
    y: 1.2,
    label: 'Love it',
    text: 'I love how fast this laptop feels.',
    trueSentiment: 'positive',
  },
  {
    id: 'p6',
    x: 1.2,
    y: 0.5,
    label: 'Pretty good',
    text: 'Pretty good, would recommend to a friend.',
    trueSentiment: 'positive',
  },
  {
    id: 'n1',
    x: -1.2,
    y: -0.9,
    label: 'Terrible',
    text: 'Terrible quality, broke after a week.',
    trueSentiment: 'negative',
  },
  {
    id: 'n2',
    x: -0.8,
    y: -1.1,
    label: 'Hate it',
    text: 'I hate using this app every day.',
    trueSentiment: 'negative',
  },
  {
    id: 'n3',
    x: -1.0,
    y: -0.4,
    label: 'Disappointing',
    text: 'Really disappointing performance overall.',
    trueSentiment: 'negative',
  },
  {
    id: 'n4',
    x: -0.6,
    y: -0.7,
    label: 'Buggy',
    text: 'The UI is so buggy and slow.',
    trueSentiment: 'negative',
  },
  {
    id: 'n5',
    x: -1.5,
    y: -1.3,
    label: 'Worst ever',
    text: 'Worst purchase I have made in years.',
    trueSentiment: 'negative',
  },
  {
    id: 'n6',
    x: -1.1,
    y: -0.8,
    label: 'Not great',
    text: 'Not great, wouldn’t buy again.',
    trueSentiment: 'negative',
  },
]

const INITIAL_DIRECTION: Direction = { dx: 1, dy: 0.7 }

const WIDTH = 520
const HEIGHT = 360
const MARGIN = { top: 24, right: 24, bottom: 40, left: 40 }
const BG = '#0d1219'
const TEAL = '#14b8a6'
const RED = '#ef4444'
const ORANGE = '#f59e0b'
const X_EXTENT: [number, number] = [-2, 2]
const Y_EXTENT: [number, number] = [-2, 2]

function normalizeDirection(dir: Direction): Direction & { length: number } {
  const length = Math.hypot(dir.dx, dir.dy) || 1
  return {
    dx: dir.dx / length,
    dy: dir.dy / length,
    length,
  }
}

export default function LinearProbeVisualizer() {
  const [direction, setDirection] = useState<Direction>(INITIAL_DIRECTION)
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const xAxisRef = useRef<SVGGElement | null>(null)
  const yAxisRef = useRef<SVGGElement | null>(null)

  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(X_EXTENT)
        .range([MARGIN.left, WIDTH - MARGIN.right]),
    []
  )

  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(Y_EXTENT)
        .range([HEIGHT - MARGIN.bottom, MARGIN.top]),
    []
  )

  // Normalize direction and compute dot-product scores for each point
  const { unitDir, scores, maxAbsScore } = useMemo(() => {
    const unitDir = normalizeDirection(direction)
    const scores = SENTIMENT_POINTS.map((p) => {
      const score = p.x * unitDir.dx + p.y * unitDir.dy
      return { id: p.id, score }
    })
    const maxAbsScore = scores.reduce(
      (acc, s) => Math.max(acc, Math.abs(s.score)),
      0.0001
    )
    return { unitDir, scores, maxAbsScore }
  }, [direction])

  const scoreById = useMemo(() => {
    const m = new Map<string, number>()
    scores.forEach((s) => m.set(s.id, s.score))
    return m
  }, [scores])

  const selectedPoint = useMemo(
    () => SENTIMENT_POINTS.find((p) => p.id === hoveredId) || null,
    [hoveredId]
  )

  const selectedScore = selectedPoint
    ? scoreById.get(selectedPoint.id) ?? 0
    : null

  // Axes (D3 axis generators)
  useEffect(() => {
    if (!xAxisRef.current || !yAxisRef.current) return

    const xAxis = d3.axisBottom(xScale).ticks(5).tickSizeOuter(0)
    const yAxis = d3.axisLeft(yScale).ticks(5).tickSizeOuter(0)

    d3.select(xAxisRef.current).call(xAxis as any)
    d3.select(yAxisRef.current).call(yAxis as any)

    d3.select(xAxisRef.current)
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .style('font-size', '10px')

    d3.select(yAxisRef.current)
      .selectAll('text')
      .attr('fill', '#9ca3af')
      .style('font-size', '10px')

    d3.select(xAxisRef.current)
      .selectAll('line,path')
      .attr('stroke', '#4b5563')

    d3.select(yAxisRef.current)
      .selectAll('line,path')
      .attr('stroke', '#4b5563')
  }, [xScale, yScale])

  // Draggable concept direction handle (D3 drag)
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return

    const handle = svg.querySelector<SVGCircleElement>('#direction-handle')
    if (!handle) return

    const dragBehavior = d3
      .drag<SVGCircleElement, unknown>()
      .on('drag', (event) => {
        const { x, y } = event
        const newX = xScale.invert(x)
        const newY = yScale.invert(y)
        setDirection({ dx: newX, dy: newY })
      })

    d3.select(handle).call(dragBehavior as any)
  }, [xScale, yScale])

  const directionEnd = {
    x: xScale(unitDir.dx * 1.6),
    y: yScale(unitDir.dy * 1.6),
  }

  const directionOrigin = {
    x: xScale(0),
    y: yScale(0),
  }

  // Projection of hovered point onto the direction (dot product)
  const projectionPoint =
    selectedPoint && selectedScore != null
      ? {
          x: xScale(unitDir.dx * selectedScore),
          y: yScale(unitDir.dy * selectedScore),
        }
      : null

  const originProjection =
    selectedPoint && selectedScore != null
      ? {
          x: xScale(selectedPoint.x),
          y: yScale(selectedPoint.y),
        }
      : null

  function pointFill(p: ActivationPoint): string {
    const score = scoreById.get(p.id) ?? 0
    const intensity = Math.min(Math.abs(score) / maxAbsScore, 1)

    const base = score >= 0 ? TEAL : RED
    const c = d3.color(base)
    if (!c) return base
    const rgb = c.rgb()
    const alpha = 0.25 + 0.55 * intensity
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }

  function pointStroke(p: ActivationPoint): string {
    const score = scoreById.get(p.id) ?? 0
    return score >= 0 ? TEAL : RED
  }

  function pointRadius(p: ActivationPoint): number {
    const score = scoreById.get(p.id) ?? 0
    const intensity = Math.min(Math.abs(score) / maxAbsScore, 1)
    return 5 + 4 * intensity
  }

  // Small word-vector inset: King - Man + Woman ≈ Queen
  const wordSpace = {
    width: 260,
    height: 220,
    margin: { top: 24, right: 16, bottom: 32, left: 32 },
  }

  const wordXs = d3
    .scaleLinear()
    .domain([-1, 3])
    .range([wordSpace.margin.left, wordSpace.width - wordSpace.margin.right])

  const wordYs = d3
    .scaleLinear()
    .domain([-1, 3])
    .range([wordSpace.height - wordSpace.margin.bottom, wordSpace.margin.top])

  const wordPoints = [
    { id: 'man', x: 0, y: 0, label: 'man' },
    { id: 'woman', x: 0, y: 1.6, label: 'woman' },
    { id: 'king', x: 2.3, y: 0.2, label: 'king' },
    { id: 'queen', x: 2.3, y: 1.8, label: 'queen' },
  ]

  const kingMinusMan = {
    x1: wordXs(0),
    y1: wordYs(0),
    x2: wordXs(2.3),
    y2: wordYs(0.2),
  }

  const queenMinusWoman = {
    x1: wordXs(0),
    y1: wordYs(1.6),
    x2: wordXs(2.3),
    y2: wordYs(1.8),
  }

  return (
    <section
      className="card interactive-card"
      style={{
        background: BG,
        borderRadius: '16px',
        padding: '20px',
        border: '1px solid #1f2933',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1.4fr)',
        gap: '20px',
      }}
    >
      {/* Left: 2D activation space + draggable concept direction */}
      <div>
        <h2 style={{ color: '#e5e7eb', fontSize: '1.15rem', marginBottom: 4 }}>
          Linear probes as directions in activation space
        </h2>
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 12 }}>
          Drag the <span style={{ color: ORANGE }}>orange arrow</span> to
          change the probe direction. Points are activations for short reviews;
          a one-layer linear probe reads out a{' '}
          <span style={{ color: TEAL }}>sentiment score</span> via the dot
          product with this direction — a concrete picture of the Linear
          Representation Hypothesis.
        </p>

        <svg
          ref={svgRef}
          width={WIDTH}
          height={HEIGHT}
          style={{
            width: '100%',
            height: 'auto',
            background: 'radial-gradient(circle at top, #111827, #020617)',
            borderRadius: '12px',
          }}
        >
          <defs>
            <marker
              id="arrow-head"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill={ORANGE} />
            </marker>
          </defs>

          {/* Axes with tick labels (D3) */}
          <g
            transform={`translate(0, ${HEIGHT - MARGIN.bottom})`}
            ref={xAxisRef}
          />
          <g transform={`translate(${MARGIN.left}, 0)`} ref={yAxisRef} />

          {/* Zero axes lines */}
          <line
            x1={xScale(X_EXTENT[0])}
            y1={yScale(0)}
            x2={xScale(X_EXTENT[1])}
            y2={yScale(0)}
            stroke="#374151"
            strokeWidth={1}
          />
          <line
            x1={xScale(0)}
            y1={yScale(Y_EXTENT[0])}
            x2={xScale(0)}
            y2={yScale(Y_EXTENT[1])}
            stroke="#374151"
            strokeWidth={1}
          />

          {/* Concept direction (linear probe weight vector) */}
          <line
            x1={directionOrigin.x}
            y1={directionOrigin.y}
            x2={directionEnd.x}
            y2={directionEnd.y}
            stroke={ORANGE}
            strokeWidth={2}
            markerEnd="url(#arrow-head)"
          />

          {/* Draggable endpoint of the concept direction */}
          <circle
            id="direction-handle"
            cx={directionEnd.x}
            cy={directionEnd.y}
            r={8}
            fill={ORANGE}
            stroke="#000"
            strokeWidth={1}
            style={{ cursor: 'grab' }}
          />

          <text
            x={directionEnd.x + 10}
            y={directionEnd.y - 6}
            fill={ORANGE}
            fontSize={11}
          >
            concept direction
          </text>

          {/* Review activations: points in 2D activation space */}
          {SENTIMENT_POINTS.map((p) => (
            <g key={p.id}>
              <circle
                cx={xScale(p.x)}
                cy={yScale(p.y)}
                r={pointRadius(p)}
                fill={pointFill(p)}
                stroke={pointStroke(p)}
                strokeWidth={hoveredId === p.id ? 2.4 : 1.6}
                onMouseEnter={() => setHoveredId(p.id)}
                onMouseLeave={() =>
                  setHoveredId((id) => (id === p.id ? null : id))
                }
              />
            </g>
          ))}

          {/* Projection of hovered point onto concept direction (dot product) */}
          {projectionPoint && originProjection && (
            <>
              <line
                x1={originProjection.x}
                y1={originProjection.y}
                x2={projectionPoint.x}
                y2={projectionPoint.y}
                stroke="#6b7280"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
              <circle
                cx={projectionPoint.x}
                cy={projectionPoint.y}
                r={4}
                fill="#e5e7eb"
              />
            </>
          )}
        </svg>
      </div>

      {/* Right: probe readout + word-vector analogy */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Linear probe readout panel */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            borderRadius: 12,
            padding: '12px 14px',
            border: '1px solid rgba(55, 65, 81, 0.7)',
          }}
        >
          <h3
            style={{
              color: '#e5e7eb',
              fontSize: '0.95rem',
              marginBottom: 4,
            }}
          >
            Linear probe readout
          </h3>
          <p
            style={{
              color: '#9ca3af',
              fontSize: '0.85rem',
              marginBottom: 8,
            }}
          >
            A linear probe computes a concept score{' '}
            <code
              style={{
                fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular',
                fontSize: '0.8rem',
                background: '#020617',
                padding: '1px 4px',
                borderRadius: 4,
              }}
            >
              s = w · h
            </code>
            , where <code>w</code> is the orange direction and{' '}
            <code>h</code> is the activation vector for a review.
          </p>

          {selectedPoint ? (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                borderRadius: 8,
                background: 'rgba(15, 118, 110, 0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                  alignItems: 'baseline',
                }}
              >
                <span
                  style={{
                    color: '#e5e7eb',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                  }}
                >
                  “{selectedPoint.label}”
                </span>
                <span
                  style={{
                    color:
                      (scoreById.get(selectedPoint.id) ?? 0) >= 0
                        ? TEAL
                        : RED,
                    fontFamily:
                      'JetBrains Mono, ui-monospace, SFMono-Regular',
                    fontSize: '0.8rem',
                  }}
                >
                  score ≈ {selectedScore?.toFixed(2)}
                </span>
              </div>
              <p
                style={{
                  color: '#9ca3af',
                  fontSize: '0.8rem',
                  marginBottom: 6,
                }}
              >
                {selectedPoint.text}
              </p>
              <div
                style={{
                  position: 'relative',
                  height: 12,
                  background: '#020617',
                  borderRadius: 999,
                  overflow: 'hidden',
                }}
              >
                {selectedScore !== null && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: 0,
                      width: `${Math.min(
                        Math.abs(selectedScore) / maxAbsScore,
                        1
                      ) * 100}%`,
                      background:
                        selectedScore >= 0
                          ? 'linear-gradient(to right, rgba(20,184,166,0.2), rgba(20,184,166,0.9))'
                          : 'linear-gradient(to right, rgba(248,113,113,0.2), rgba(239,68,68,0.9))',
                    }}
                  />
                )}
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginTop: 4,
                  fontSize: '0.75rem',
                  color: '#6b7280',
                }}
              >
                <span>low magnitude</span>
                <span>high magnitude</span>
              </div>
            </div>
          ) : (
            <p
              style={{
                color: '#6b7280',
                fontSize: '0.8rem',
                marginTop: 8,
              }}
            >
              Hover a point in the activation space to see its projection onto
              the concept direction and the resulting sentiment score.
            </p>
          )}
        </div>

        {/* Word vector analogy panel */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            borderRadius: 12,
            padding: '12px 14px',
            border: '1px solid rgba(55, 65, 81, 0.7)',
          }}
        >
          <h3
            style={{
              color: '#e5e7eb',
              fontSize: '0.95rem',
              marginBottom: 4,
            }}
          >
            Word-vector analogy: King − Man + Woman ≈ Queen
          </h3>
          <p
            style={{
              color: '#9ca3af',
              fontSize: '0.8rem',
              marginBottom: 8,
            }}
          >
            In word embeddings, relationships are also encoded as directions. The
            vector from <span style={{ color: '#e5e7eb' }}>man → king</span>{' '}
            aligns with <span style={{ color: '#e5e7eb' }}>woman → queen</span>.
          </p>
          <svg
            width={wordSpace.width}
            height={wordSpace.height}
            style={{ width: '100%', height: 'auto' }}
          >
            <defs>
              <marker
                id="arrow-small"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5"
                markerHeight="5"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={ORANGE} />
              </marker>
            </defs>
            <rect
              x={0}
              y={0}
              width={wordSpace.width}
              height={wordSpace.height}
              rx={10}
              fill="#020617"
            />
            <line
              x1={wordSpace.margin.left}
              y1={wordYs(0)}
              x2={wordSpace.width - wordSpace.margin.right}
              y2={wordYs(0)}
              stroke="#374151"
              strokeWidth={1}
            />
            <line
              x1={wordSpace.margin.left}
              y1={wordYs(0)}
              x2={wordSpace.margin.left}
              y2={wordSpace.margin.top}
              stroke="#374151"
              strokeWidth={1}
            />
            {wordPoints.map((p) => (
              <g key={p.id}>
                <circle
                  cx={wordXs(p.x)}
                  cy={wordYs(p.y)}
                  r={5}
                  fill="#e5e7eb"
                />
                <text
                  x={wordXs(p.x) + 8}
                  y={wordYs(p.y) - 4}
                  fill="#e5e7eb"
                  fontSize={11}
                >
                  {p.label}
                </text>
              </g>
            ))}
            <line
              x1={kingMinusMan.x1}
              y1={kingMinusMan.y1}
              x2={kingMinusMan.x2}
              y2={kingMinusMan.y2}
              stroke={ORANGE}
              strokeWidth={1.8}
              markerEnd="url(#arrow-small)"
            />
            <line
              x1={queenMinusWoman.x1}
              y1={queenMinusWoman.y1}
              x2={queenMinusWoman.x2}
              y2={queenMinusWoman.y2}
              stroke={ORANGE}
              strokeWidth={1.8}
              markerEnd="url(#arrow-small)"
              strokeDasharray="4 3"
            />
          </svg>
        </div>
      </div>
    </section>
  )
}


You can now import and use it anywhere in your app, e.g.:

tsx
Copy code
import LinearProbeVisualizer from '@/components/LinearProbeVisualizer'

export default function Page() {
  return (
    <main>
      <LinearProbeVisualizer />
    </main>
  )
}


This should visually match your palette and card style, and it uses D3 for scales, axes, and the draggable interaction. 

attachments-bundle
