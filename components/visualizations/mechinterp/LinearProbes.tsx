'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

type Sentiment = 'positive' | 'negative'
type GamePhase = 'setup' | 'countdown' | 'revealed'
type ScorePrediction = 'A' | 'B' | null

interface ProbeChallenge {
  name: string
  question: string
  // Two points to compare
  pointA: string  // id from SENTIMENT_POINTS
  pointB: string
  // Custom probe direction for this challenge
  probeDir: { dx: number; dy: number }
  // Which has higher score? 'A' or 'B'
  answer: 'A' | 'B'
  insight: string
}

const PROBE_CHALLENGES: ProbeChallenge[] = [
  {
    name: '🎲 Standard Probe',
    question: 'With probe direction (1, 0.7), which review has HIGHER sentiment score?',
    pointA: 'p1',  // "Great battery" at (1.4, 1.0)
    pointB: 'n1',  // "Terrible" at (-1.2, -0.9)
    probeDir: { dx: 1, dy: 0.7 },
    answer: 'A',
    insight: 'positive reviews project strongly in the positive direction',
  },
  {
    name: '🎲 Orthogonal Probe',
    question: 'With probe pointing UP (0, 1), which has higher score: "Amazing" or "Pretty good"?',
    pointA: 'p3',  // "Amazing" at (1.1, 1.3)
    pointB: 'p6',  // "Pretty good" at (1.2, 0.5)
    probeDir: { dx: 0, dy: 1 },
    answer: 'A',
    insight: 'vertical probe ignores x-coordinate, only y matters (1.3 > 0.5)',
  },
  {
    name: '🎲 Reversed Probe',
    question: 'With REVERSED probe (-1, -0.5), which has higher score: "Works well" or "Buggy"?',
    pointA: 'p4',  // "Works well" at (0.8, 0.9)
    pointB: 'n4',  // "Buggy" at (-0.6, -0.7)
    probeDir: { dx: -1, dy: -0.5 },
    answer: 'B',
    insight: 'reversed probe flips the sentiment—negative reviews now score higher!',
  },
  {
    name: '🎲 Diagonal Probe',
    question: 'Probe at 45° (1, 1): "Super comfy" vs "Disappointing"—which scores higher?',
    pointA: 'p2',  // "Super comfy" at (1.3, 0.7)
    pointB: 'n3',  // "Disappointing" at (-1.0, -0.4)
    probeDir: { dx: 1, dy: 1 },
    answer: 'A',
    insight: 'diagonal probe sums x+y; (1.3+0.7)=2.0 vs (-1.0-0.4)=-1.4',
  },
]

function computeDotProduct(
  pointId: string,
  dir: { dx: number; dy: number }
): number {
  const point = SENTIMENT_POINTS.find((p) => p.id === pointId)
  if (!point) return 0
  const len = Math.hypot(dir.dx, dir.dy) || 1
  return (point.x * dir.dx + point.y * dir.dy) / len
}

function getProbeFeedback(
  predicted: ScorePrediction,
  challenge: ProbeChallenge
): string {
  const scoreA = computeDotProduct(challenge.pointA, challenge.probeDir)
  const scoreB = computeDotProduct(challenge.pointB, challenge.probeDir)
  const pointA = SENTIMENT_POINTS.find((p) => p.id === challenge.pointA)
  const pointB = SENTIMENT_POINTS.find((p) => p.id === challenge.pointB)
  const isCorrect = predicted === challenge.answer

  const comparison = `Score A (${pointA?.label}): ${scoreA.toFixed(2)}, Score B (${pointB?.label}): ${scoreB.toFixed(2)}`

  if (isCorrect) {
    return `✓ Correct! ${comparison}. ${challenge.insight}. The dot product s = w · h directly computes how much the activation aligns with the probe direction.`
  }
  return `✗ Not quite. ${comparison}. ${challenge.insight}. Remember: the dot product measures alignment—a positive review in a positive-pointing probe direction gives a high score.`
}

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
    text: "Not great, wouldn't buy again.",
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

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<ProbeChallenge | null>(null)
  const [prediction, setPrediction] = useState<ScorePrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })
  const [highlightedPoints, setHighlightedPoints] = useState<string[]>([])

  // Game control functions
  function startChallenge(challenge: ProbeChallenge) {
    setActiveChallenge(challenge)
    setDirection(challenge.probeDir)  // Set probe to challenge direction
    setHighlightedPoints([challenge.pointA, challenge.pointB])
    setPrediction(null)
    setGamePhase('setup')
  }

  function submitPrediction(pred: ScorePrediction) {
    if (!activeChallenge || gamePhase !== 'setup') return
    setPrediction(pred)
    setGamePhase('countdown')
    setCountdown(3)
  }

  function resetGame() {
    setGamePhase('setup')
    setActiveChallenge(null)
    setPrediction(null)
    setCountdown(3)
    setHighlightedPoints([])
    setDirection(INITIAL_DIRECTION)
  }

  // Countdown timer effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      if (activeChallenge && prediction) {
        const isCorrect = prediction === activeChallenge.answer
        setScore((s) => ({
          correct: s.correct + (isCorrect ? 1 : 0),
          total: s.total + 1,
        }))
      }
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, activeChallenge, prediction])

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

    // Highlight challenge points
    if (highlightedPoints.includes(p.id)) {
      return '#fbbf24'  // Yellow for highlighted
    }

    const base = score >= 0 ? TEAL : RED
    const c = d3.color(base)
    if (!c) return base
    const rgb = c.rgb()
    const alpha = 0.25 + 0.55 * intensity
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
  }

  function pointStroke(p: ActivationPoint): string {
    // Highlight challenge points
    if (highlightedPoints.includes(p.id)) {
      return '#f59e0b'  // Orange border for highlighted
    }
    const score = scoreById.get(p.id) ?? 0
    return score >= 0 ? TEAL : RED
  }

  function pointRadius(p: ActivationPoint): number {
    // Make challenge points larger
    if (highlightedPoints.includes(p.id)) {
      return 10
    }
    const score = scoreById.get(p.id) ?? 0
    const intensity = Math.min(Math.abs(score) / maxAbsScore, 1)
    return 5 + 4 * intensity
  }

  // Get point labels for challenge UI
  const pointALabel = activeChallenge
    ? SENTIMENT_POINTS.find((p) => p.id === activeChallenge.pointA)?.label
    : null
  const pointBLabel = activeChallenge
    ? SENTIMENT_POINTS.find((p) => p.id === activeChallenge.pointB)?.label
    : null

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
                  "{selectedPoint.label}"
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

        {/* Game Panel */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            borderRadius: 12,
            padding: '12px 14px',
            border: '1px solid rgba(55, 65, 81, 0.7)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ color: '#e5e7eb', fontSize: '0.95rem', margin: 0 }}>
              🎯 Probe Direction Challenge
            </h3>
            {score.total > 0 && (
              <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
                Score: {score.correct}/{score.total}
              </span>
            )}
          </div>

          {!activeChallenge ? (
            <div>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginBottom: 8 }}>
                Test your understanding of dot products as projections. Pick a challenge:
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PROBE_CHALLENGES.map((ch) => (
                  <button
                    key={ch.name}
                    onClick={() => startChallenge(ch)}
                    style={{
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      background: 'rgba(245, 158, 11, 0.15)',
                      color: '#f59e0b',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
          ) : gamePhase === 'setup' ? (
            <div>
              <p style={{ color: '#e5e7eb', fontSize: '0.85rem', marginBottom: 8 }}>
                {activeChallenge.question}
              </p>
              <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: 8 }}>
                Look at the highlighted yellow points in the visualization.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => submitPrediction('A')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  A: "{pointALabel}"
                </button>
                <button
                  onClick={() => submitPrediction('B')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: 'none',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                    color: 'white',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  B: "{pointBLabel}"
                </button>
              </div>
            </div>
          ) : gamePhase === 'countdown' ? (
            <div style={{ textAlign: 'center', padding: '16px 0' }}>
              <div
                style={{
                  fontSize: '2.5rem',
                  fontWeight: 700,
                  color: '#f59e0b',
                  textShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                }}
              >
                {countdown}
              </div>
              <p style={{ color: '#9ca3af', fontSize: '0.8rem', marginTop: 4 }}>
                You predicted: {prediction === 'A' ? pointALabel : pointBLabel}
              </p>
            </div>
          ) : (
            <div>
              <p
                style={{
                  color: prediction === activeChallenge.answer ? '#10b981' : '#ef4444',
                  fontSize: '0.85rem',
                  marginBottom: 8,
                  lineHeight: 1.4,
                }}
              >
                {getProbeFeedback(prediction, activeChallenge)}
              </p>
              <button
                onClick={resetGame}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid rgba(245, 158, 11, 0.5)',
                  background: 'rgba(245, 158, 11, 0.15)',
                  color: '#f59e0b',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Try Another Challenge
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
