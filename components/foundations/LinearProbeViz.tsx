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

// Direction presets representing different "concepts"
const DIRECTION_PRESETS = [
  { name: '😊 Sentiment', dx: 1.0, dy: 0.7, description: 'Positive vs negative feeling' },
  { name: '📐 Diagonal', dx: 1.0, dy: 1.0, description: 'Perfect 45° angle' },
  { name: '➡️ Horizontal', dx: 1.0, dy: 0.0, description: 'X-axis only (ignores Y)' },
  { name: '⬆️ Vertical', dx: 0.0, dy: 1.0, description: 'Y-axis only (ignores X)' },
  { name: '🔄 Opposite', dx: -1.0, dy: -0.7, description: 'Flipped sentiment' },
];

// ===== Gamification Types =====
type GamePhase = 'setup' | 'countdown' | 'revealed'
type AccuracyPrediction = '<50%' | '50-70%' | '70-90%' | '>90%' | null

interface AccuracyChallenge {
  name: string
  direction: Direction
  hint: string
  explanation: string
}

const ACCURACY_CHALLENGES: AccuracyChallenge[] = [
  {
    name: '🎲 Mystery A',
    direction: { dx: 0.0, dy: 1.0 },
    hint: 'This direction only looks at the Y coordinate...',
    explanation: '✅ About 70-90% accuracy! The Y coordinate partially separates sentiment, but not perfectly. Positive reviews cluster at higher Y, but there\'s overlap.',
  },
  {
    name: '🎲 Mystery B',
    direction: { dx: 1.0, dy: 0.7 },
    hint: 'This is the "natural" sentiment direction...',
    explanation: '🎯 >90% accuracy! This direction aligns with how the model actually represents sentiment. The Linear Representation Hypothesis: concepts ARE directions in activation space!',
  },
  {
    name: '🎲 Mystery C',
    direction: { dx: -1.0, dy: -0.7 },
    hint: 'This direction is the opposite of the sentiment direction...',
    explanation: '❌ <50% accuracy! This direction is inverted - it predicts positive as negative and vice versa. Training a probe would flip this automatically.',
  },
  {
    name: '🎲 Mystery D',
    direction: { dx: 1.0, dy: 0.0 },
    hint: 'This direction only looks at the X coordinate...',
    explanation: '🎯 About 70-90% accuracy! The X coordinate contains sentiment information but some overlap exists. Real activation spaces are much higher dimensional!',
  },
]

// Compute accuracy for a given direction
function computeAccuracy(dir: Direction): number {
  const unitDir = normalizeDirection(dir)
  let correct = 0
  SENTIMENT_POINTS.forEach((p) => {
    const score = p.x * unitDir.dx + p.y * unitDir.dy
    const predicted = score >= 0 ? 'positive' : 'negative'
    if (predicted === p.trueSentiment) correct++
  })
  return correct / SENTIMENT_POINTS.length
}

function getAccuracyRange(accuracy: number): AccuracyPrediction {
  if (accuracy < 0.5) return '<50%'
  if (accuracy < 0.7) return '50-70%'
  if (accuracy < 0.9) return '70-90%'
  return '>90%'
}

function getAccuracyFeedback(
  prediction: AccuracyPrediction,
  challenge: AccuracyChallenge
): { correct: boolean; message: string; actualAccuracy: number } {
  const actualAccuracy = computeAccuracy(challenge.direction)
  const actualRange = getAccuracyRange(actualAccuracy)

  if (!prediction) {
    return { correct: false, message: '❓ No prediction made', actualAccuracy }
  }

  if (prediction === actualRange) {
    return { correct: true, message: challenge.explanation, actualAccuracy }
  }

  return {
    correct: false,
    message: `❌ Not quite! Actual was ${(actualAccuracy * 100).toFixed(0)}% (${actualRange}). ${challenge.explanation}`,
    actualAccuracy,
  }
}

// Dynamic educational insight
function getProbeInsight(
  unitDir: { dx: number; dy: number },
  accuracy: number,
  hoveredPoint: ActivationPoint | null,
  selectedScore: number | null
): string {
  if (hoveredPoint && selectedScore !== null) {
    const predictedSentiment = selectedScore >= 0 ? 'positive' : 'negative';
    const isCorrect = predictedSentiment === hoveredPoint.trueSentiment;
    if (isCorrect) {
      return `✅ "${hoveredPoint.label}": The probe correctly predicts ${predictedSentiment}! Score = ${selectedScore.toFixed(2)}. The dot product of the activation with your direction is ${selectedScore > 0 ? 'positive' : 'negative'}.`;
    } else {
      return `❌ "${hoveredPoint.label}": Misclassified as ${predictedSentiment} (actually ${hoveredPoint.trueSentiment}). Try rotating the direction to fix this! The current probe direction doesn't separate this point correctly.`;
    }
  }

  if (accuracy === 1.0) {
    return `🎯 PERFECT! 100% accuracy. Your probe direction perfectly separates positive and negative reviews. The Linear Representation Hypothesis in action: concepts ARE directions in activation space!`;
  }

  if (accuracy >= 0.9) {
    return `🌟 ${(accuracy * 100).toFixed(0)}% accuracy! Great separation. A few points are misclassified—try fine-tuning the direction by dragging the orange handle.`;
  }

  if (accuracy < 0.5) {
    return `⚠️ ${(accuracy * 100).toFixed(0)}% accuracy—worse than random! Your direction might be inverted. Positive reviews should project to positive scores. Try rotating the arrow.`;
  }

  return `📊 ${(accuracy * 100).toFixed(0)}% accuracy. Drag the orange arrow to find a direction that better separates positive (teal) from negative (red) reviews. The goal: positive reviews → positive scores.`;
}

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

  // ===== Game State =====
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0)
  const [prediction, setPrediction] = useState<AccuracyPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set())

  const currentChallenge = ACCURACY_CHALLENGES[currentChallengeIdx]
  const gameFeedback = gamePhase === 'revealed' && currentChallenge
    ? getAccuracyFeedback(prediction, currentChallenge)
    : null

  // ===== Game Control Functions =====
  const startChallenge = (idx: number) => {
    setCurrentChallengeIdx(idx)
    setPrediction(null)
    setGamePhase('setup')
    setGameMode(true)
    // Set direction to mystery value
    const challenge = ACCURACY_CHALLENGES[idx]
    setDirection(challenge.direction)
  }

  const submitPrediction = () => {
    if (!prediction) return
    setGamePhase('countdown')
    setCountdown(3)
  }

  const resetGame = () => {
    setGameMode(false)
    setGamePhase('setup')
    setPrediction(null)
    setScore(0)
    setCompletedChallenges(new Set())
    setDirection(INITIAL_DIRECTION)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
    // Reveal result
    setGamePhase('revealed')
    if (currentChallenge) {
      const fb = getAccuracyFeedback(prediction, currentChallenge)
      if (fb.correct) {
        setScore(s => s + 1)
        setCompletedChallenges(prev => new Set([...prev, currentChallengeIdx]))
      }
    }
  }, [gamePhase, countdown, prediction, currentChallenge, currentChallengeIdx])

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

  // Compute accuracy: how many points are correctly classified?
  const accuracy = useMemo(() => {
    let correct = 0;
    SENTIMENT_POINTS.forEach((p) => {
      const score = scoreById.get(p.id) ?? 0;
      const predicted = score >= 0 ? 'positive' : 'negative';
      if (predicted === p.trueSentiment) correct++;
    });
    return correct / SENTIMENT_POINTS.length;
  }, [scoreById]);

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getProbeInsight(unitDir, accuracy, selectedPoint, selectedScore);
  }, [unitDir, accuracy, selectedPoint, selectedScore]);

  // Handle preset selection
  const handlePreset = (preset: typeof DIRECTION_PRESETS[0]) => {
    setDirection({ dx: preset.dx, dy: preset.dy });
  };

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
        <p style={{ color: '#9ca3af', fontSize: '0.9rem', marginBottom: 8 }}>
          Drag the <span style={{ color: ORANGE }}>orange arrow</span> to
          change the probe direction. Points are activations for short reviews;
          a one-layer linear probe reads out a{' '}
          <span style={{ color: TEAL }}>sentiment score</span> via the dot
          product with this direction — a concrete picture of the Linear
          Representation Hypothesis.
        </p>

        {/* ===== Game Mode Panel ===== */}
        <div
          style={{
            padding: '0.75rem',
            borderRadius: '8px',
            marginBottom: '0.75rem',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05))'
              : 'rgba(15, 23, 42, 0.5)',
            border: gameMode
              ? '1px solid rgba(124, 58, 237, 0.4)'
              : '1px solid rgba(75, 85, 99, 0.3)',
          }}
        >
          {!gameMode ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => startChallenge(0)}
                style={{
                  fontSize: '0.85rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid rgba(124, 58, 237, 0.5)',
                  background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(124, 58, 237, 0.1))',
                  color: '#c4b5fd',
                  cursor: 'pointer',
                  fontWeight: 500,
                }}
              >
                🎯 Try Accuracy Quiz
              </button>
              <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
                Predict classification accuracy from direction!
              </span>
            </div>
          ) : (
            <div>
              {/* Game Header with Score */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#c4b5fd' }}>
                  🎮 Challenge Mode ON
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
                    Score: {score}/{ACCURACY_CHALLENGES.length}
                  </span>
                  <button
                    type="button"
                    onClick={resetGame}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      background: 'transparent',
                      color: '#f87171',
                      cursor: 'pointer',
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>

              {/* Challenge Selector */}
              <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                {ACCURACY_CHALLENGES.map((ch, idx) => (
                  <button
                    key={ch.name}
                    type="button"
                    onClick={() => startChallenge(idx)}
                    disabled={gamePhase === 'countdown'}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.35rem 0.7rem',
                      borderRadius: '999px',
                      border: completedChallenges.has(idx)
                        ? '1px solid rgba(34, 197, 94, 0.5)'
                        : currentChallengeIdx === idx
                          ? '1px solid rgba(124, 58, 237, 0.8)'
                          : '1px solid rgba(75, 85, 99, 0.5)',
                      background: completedChallenges.has(idx)
                        ? 'rgba(34, 197, 94, 0.2)'
                        : currentChallengeIdx === idx
                          ? 'rgba(124, 58, 237, 0.3)'
                          : 'rgba(15, 23, 42, 0.8)',
                      color: completedChallenges.has(idx) ? '#4ade80' : '#e5e7eb',
                      cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                      opacity: gamePhase === 'countdown' ? 0.5 : 1,
                    }}
                  >
                    {completedChallenges.has(idx) ? '✓' : ''} {ch.name}
                  </button>
                ))}
              </div>

              {/* Challenge Content */}
              {currentChallenge && (
                <div style={{ marginTop: '0.5rem' }}>
                  {gamePhase === 'setup' && (
                    <>
                      <p style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                        💡 {currentChallenge.hint}
                      </p>
                      <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        Look at how this direction separates the points. What accuracy will it achieve?
                      </p>
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                        {(['<50%', '50-70%', '70-90%', '>90%'] as const).map((range) => (
                          <button
                            key={range}
                            type="button"
                            onClick={() => setPrediction(range)}
                            style={{
                              fontSize: '0.8rem',
                              padding: '0.4rem 0.8rem',
                              borderRadius: '6px',
                              border: prediction === range
                                ? '1px solid rgba(251, 191, 36, 0.8)'
                                : '1px solid rgba(75, 85, 99, 0.5)',
                              background: prediction === range
                                ? 'rgba(251, 191, 36, 0.2)'
                                : 'rgba(15, 23, 42, 0.8)',
                              color: prediction === range ? '#fbbf24' : '#e5e7eb',
                              cursor: 'pointer',
                            }}
                          >
                            {range}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={submitPrediction}
                        disabled={!prediction}
                        style={{
                          fontSize: '0.85rem',
                          padding: '0.5rem 1.5rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(34, 197, 94, 0.5)',
                          background: prediction
                            ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.1))'
                            : 'rgba(15, 23, 42, 0.5)',
                          color: prediction ? '#4ade80' : '#6b7280',
                          cursor: prediction ? 'pointer' : 'not-allowed',
                          fontWeight: 500,
                        }}
                      >
                        Lock In Prediction
                      </button>
                    </>
                  )}

                  {gamePhase === 'countdown' && (
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fbbf24' }}>
                        {countdown}
                      </div>
                      <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
                        You predicted: <strong style={{ color: '#fbbf24' }}>{prediction}</strong>
                      </p>
                    </div>
                  )}

                  {gamePhase === 'revealed' && gameFeedback && (
                    <div
                      style={{
                        padding: '0.75rem',
                        borderRadius: '8px',
                        background: gameFeedback.correct
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(239, 68, 68, 0.15)',
                        border: gameFeedback.correct
                          ? '1px solid rgba(34, 197, 94, 0.4)'
                          : '1px solid rgba(239, 68, 68, 0.4)',
                      }}
                    >
                      <p style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                        {gameFeedback.message}
                      </p>
                      <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                        Actual accuracy: <strong style={{ color: '#60a5fa' }}>
                          {(gameFeedback.actualAccuracy * 100).toFixed(0)}%
                        </strong>
                      </p>
                      {currentChallengeIdx < ACCURACY_CHALLENGES.length - 1 && (
                        <button
                          type="button"
                          onClick={() => startChallenge(currentChallengeIdx + 1)}
                          style={{
                            fontSize: '0.85rem',
                            padding: '0.5rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid rgba(59, 130, 246, 0.5)',
                            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1))',
                            color: '#93c5fd',
                            cursor: 'pointer',
                            fontWeight: 500,
                          }}
                        >
                          Next Challenge →
                        </button>
                      )}
                      {completedChallenges.size === ACCURACY_CHALLENGES.length && (
                        <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(251, 191, 36, 0.2)', borderRadius: '6px' }}>
                          <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                            🏆 All challenges complete! You understand the Linear Representation Hypothesis!
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Direction Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
          {DIRECTION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => handlePreset(preset)}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.6rem',
                borderRadius: '999px',
                border: Math.abs(direction.dx - preset.dx) < 0.1 && Math.abs(direction.dy - preset.dy) < 0.1
                  ? '1px solid rgba(245, 158, 11, 0.7)'
                  : '1px solid rgba(75, 85, 99, 0.5)',
                background: Math.abs(direction.dx - preset.dx) < 0.1 && Math.abs(direction.dy - preset.dy) < 0.1
                  ? 'rgba(245, 158, 11, 0.2)'
                  : 'rgba(15, 23, 42, 0.8)',
                color: '#e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
              }}
              title={preset.description}
            >
              {preset.name}
            </button>
          ))}
          <span style={{
            marginLeft: 'auto',
            fontSize: '0.8rem',
            color: accuracy >= 0.9 ? TEAL : accuracy < 0.5 ? RED : ORANGE,
            fontWeight: 600,
          }}>
            {(accuracy * 100).toFixed(0)}% accuracy
          </span>
        </div>

        {/* Dynamic Insight */}
        <div
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            marginBottom: '0.75rem',
            fontSize: '0.82rem',
            lineHeight: 1.5,
            color: 'rgba(255, 255, 255, 0.9)',
            background: accuracy >= 0.9
              ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
              : currentInsight.includes('❌')
                ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
                : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
            border: accuracy >= 0.9
              ? '1px solid rgba(20, 184, 166, 0.3)'
              : currentInsight.includes('❌')
                ? '1px solid rgba(239, 68, 68, 0.3)'
                : '1px solid rgba(96, 165, 250, 0.3)',
          }}
        >
          {currentInsight}
        </div>

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
