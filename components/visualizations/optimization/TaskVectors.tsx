'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import { scaleLinear } from 'd3'
import { MATH_COLORS, clamp } from '../../../lib/mathObjects'

// ----- Gamification types -----
type GamePhase = 'setup' | 'countdown' | 'revealed'
type MergePrediction = 'A' | 'B' | 'C' | null

type TaskVectorChallenge = {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  answer: 'A' | 'B' | 'C'
  insight: string
}

const TASK_VECTOR_CHALLENGES: TaskVectorChallenge[] = [
  {
    name: '🎲 Vector Addition',
    question: 'You add τ_french + τ_coding. What happens to the merged model?',
    optionA: 'Writes code in French only',
    optionB: 'Combines both capabilities',
    optionC: 'Cancels out both',
    answer: 'B',
    insight: 'Addition combines capabilities! The merged model gains BOTH skills: it writes code WITH French documentation. This is the magic of linear weight space—capabilities are surprisingly additive.'
  },
  {
    name: '🎲 Negation Effect',
    question: 'You subtract τ_pirate (negative weight). What behavior does this remove?',
    optionA: 'The model gets stuck',
    optionB: 'Pirate style is suppressed',
    optionC: 'Model forgets everything',
    answer: 'B',
    insight: 'Subtracting a task vector actively pushes the model AWAY from that behavior. This is used to remove unwanted quirks, biases, or styles that appeared during fine-tuning!'
  },
  {
    name: '🎲 Interpolation',
    question: 'With α=0.5 interpolation between coding and French, what output do you expect?',
    optionA: 'Purely English code',
    optionB: 'Purely French docs',
    optionC: 'Bilingual hybrid',
    answer: 'C',
    insight: 'Linear interpolation (1-α)·τ_coding + α·τ_french creates a smooth blend. At α=0.5, you get bilingual behavior—the model mixes both styles in its outputs!'
  },
  {
    name: '🎲 Origin Meaning',
    question: 'In task vector space, what does the ORIGIN represent?',
    optionA: 'A random model',
    optionB: 'The pretrained model',
    optionC: 'An empty model',
    answer: 'B',
    insight: 'The origin is θ_pretrained! Task vectors τ = θ_task − θ_pre are displacements FROM the pretrained model. This lets us compose capabilities without retraining from scratch.'
  }
]

function getTaskVectorFeedback(predicted: MergePrediction, challenge: TaskVectorChallenge): string {
  if (!predicted) return ''
  const isCorrect = predicted === challenge.answer
  const correctLabel = challenge.answer === 'A' ? challenge.optionA : challenge.answer === 'B' ? challenge.optionB : challenge.optionC
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}`
  }
  return `✗ The answer is "${correctLabel}". ${challenge.insight}`
}

type Vec2 = [number, number]
type TaskKey = 'french' | 'coding' | 'pirate'
type Mode = 'addition' | 'subtraction' | 'interpolation'

const SVG_WIDTH = 420
const SVG_HEIGHT = 360
const PADDING = { top: 32, right: 32, bottom: 40, left: 40 }

const X_MIN = -3
const X_MAX = 3
const Y_MIN = -3
const Y_MAX = 3

const ORIGIN: Vec2 = [0, 0]

const TASK_LABELS: Record<TaskKey, string> = {
  french: 'French docs',
  coding: 'Coding style',
  pirate: 'Pirate style',
}

const TASK_COLORS: Record<TaskKey, string> = {
  french: '#22c55e',              // green
  coding: MATH_COLORS.secondary,   // teal
  pirate: MATH_COLORS.accent,      // purple
}

const PRETRAINED_COLOR = MATH_COLORS.neutral
const COMBINED_COLOR = MATH_COLORS.primary

type OutputExample = {
  title: string
  description: string
  comment: string
}

const BASE_SNIPPET = `function add(a: number, b: number) {
  return a + b;
}`

function addVec(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]]
}

function scaleVec(v: Vec2, s: number): Vec2 {
  return [v[0] * s, v[1] * s]
}

function arrowHeadPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size = 8
): string {
  const angle = Math.atan2(y2 - y1, x2 - x1)
  const p1x = x2 - size * Math.cos(angle - Math.PI / 6)
  const p1y = y2 - size * Math.sin(angle - Math.PI / 6)
  const p2x = x2 - size * Math.cos(angle + Math.PI / 6)
  const p2y = y2 - size * Math.sin(angle + Math.PI / 6)
  return `${x2},${y2} ${p1x},${p1y} ${p2x},${p2y}`
}

function getMergedExample(mode: Mode, alpha: number, pirateWeight: number): OutputExample {
  if (mode === 'addition') {
    return {
      title: 'Addition: French + Coding → French code comments',
      description:
        'We add the "French docs" task vector to the "coding style" vector. The merged model writes structured code comments directly in French.',
      comment: `// Ajoute deux nombres et retourne le résultat.\n// a : premier nombre\n// b : second nombre`,
    }
  }

  if (mode === 'subtraction') {
    if (pirateWeight > 0.35) {
      return {
        title: 'Add pirate style (positive weight)',
        description:
          'Adding the pirate-style task vector induces a strong stylistic quirk in the output.',
        comment: `// Arrr, adds two numbers fer ye matey!\n// Returns the loot o' their sum.`,
      }
    } else if (pirateWeight < -0.35) {
      return {
        title: 'Subtract pirate style (negative weight)',
        description:
          'Subtracting the pirate vector removes the unwanted quirk, pushing the model toward a neutral, formal tone.',
        comment: `// Adds two numbers and returns the sum.\n// Neutral, professional tone.`,
      }
    } else {
      return {
        title: 'Near zero pirate weight',
        description:
          'With the pirate vector close to zero, the model behaves like the base model with only mild stylistic influence.',
        comment: `// Adds two numbers and returns the result.`,
      }
    }
  }

  // interpolation
  if (alpha < 0.33) {
    return {
      title: 'Interpolation: mostly Coding (α ≈ 0)',
      description:
        'The model is close to the pure coding-style fine-tune: English comments oriented around types and APIs.',
      comment: `// Adds two numbers and returns their sum.\n// Good for API-style documentation.`,
    }
  } else if (alpha > 0.67) {
    return {
      title: 'Interpolation: mostly French (α ≈ 1)',
      description:
        'The model behaves like the pure French-docs fine-tune: comments are entirely in French.',
      comment: `// Ajoute deux nombres et renvoie la somme.\n// Idéal pour un public francophone.`,
    }
  } else {
    return {
      title: 'Interpolation: bilingual blend (0 < α < 1)',
      description:
        'A convex combination of task vectors yields a hybrid behavior: bilingual comments mixing French and English.',
      comment: `// Ajoute deux nombres (adds two numbers)\n// Retourne la somme (returns the sum).`,
    }
  }
}

export default function TaskVectorPlayground() {
  const [mode, setMode] = useState<Mode>('addition')
  const [alpha, setAlpha] = useState(0.5) // interpolation weight
  const [pirateWeight, setPirateWeight] = useState(0.8)

  const [frenchVec, setFrenchVec] = useState<Vec2>([1.6, 0.4])
  const [codingVec, setCodingVec] = useState<Vec2>([0.4, 1.6])
  const [pirateVec, setPirateVec] = useState<Vec2>([-1.2, 0.9])

  const [draggingTask, setDraggingTask] = useState<TaskKey | null>(null)
  const svgRef = useRef<SVGSVGElement | null>(null)

  // ----- Gamification state -----
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<TaskVectorChallenge | null>(null)
  const [prediction, setPrediction] = useState<MergePrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  // Game control functions
  function startChallenge(challenge: TaskVectorChallenge) {
    setActiveChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
  }

  function submitPrediction() {
    if (!prediction || !activeChallenge) return
    setGamePhase('countdown')
    setCountdown(3)
  }

  function resetGame() {
    setActiveChallenge(null)
    setPrediction(null)
    setGamePhase('setup')
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      if (activeChallenge && prediction) {
        const isCorrect = prediction === activeChallenge.answer
        setScore(prev => ({
          correct: prev.correct + (isCorrect ? 1 : 0),
          total: prev.total + 1
        }))
      }
      return
    }
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, activeChallenge, prediction])

  const xScale = useMemo(
    () =>
      scaleLinear()
        .domain([X_MIN, X_MAX])
        .range([PADDING.left, SVG_WIDTH - PADDING.right]),
    []
  )

  const yScale = useMemo(
    () =>
      scaleLinear()
        .domain([Y_MIN, Y_MAX])
        .range([SVG_HEIGHT - PADDING.bottom, PADDING.top]),
    []
  )

  const toSvg = (v: Vec2): [number, number] => [xScale(v[0]), yScale(v[1])]

  const combinedVec: Vec2 = useMemo(() => {
    switch (mode) {
      case 'addition':
        // τ_french + τ_coding
        return addVec(frenchVec, codingVec)
      case 'subtraction':
        // ± τ_pirate
        return scaleVec(pirateVec, pirateWeight)
      case 'interpolation':
      default:
        // (1 - α) * τ_coding + α * τ_french
        return addVec(scaleVec(codingVec, 1 - alpha), scaleVec(frenchVec, alpha))
    }
  }, [mode, alpha, pirateWeight, frenchVec, codingVec, pirateVec])

  const originSvg = toSvg(ORIGIN)
  const frenchSvg = toSvg(frenchVec)
  const codingSvg = toSvg(codingVec)
  const pirateSvg = toSvg(pirateVec)
  const combinedSvg = toSvg(combinedVec)

  const example = getMergedExample(mode, alpha, pirateWeight)

  const handlePointerDown =
    (task: TaskKey) => (event: React.PointerEvent<SVGCircleElement>) => {
      event.preventDefault()
      setDraggingTask(task)
    }

  const stopDragging = () => {
    setDraggingTask(null)
  }

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!draggingTask || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const px = event.clientX - rect.left
    const py = event.clientY - rect.top

    const xVal = xScale.invert(px)
    const yVal = yScale.invert(py)

    const clampedX = clamp(xVal, X_MIN, X_MAX)
    const clampedY = clamp(yVal, Y_MIN, Y_MAX)
    const next: Vec2 = [clampedX, clampedY]

    if (draggingTask === 'french') {
      setFrenchVec(next)
    } else if (draggingTask === 'coding') {
      setCodingVec(next)
    } else if (draggingTask === 'pirate') {
      setPirateVec(next)
    }
  }

  const formatVec = (v: Vec2) => `(${v[0].toFixed(2)}, ${v[1].toFixed(2)})`

  const gridTicks = [-3, -2, -1, 0, 1, 2, 3]

  return (
    <section
      className="card interactive-card task-vector-playground"
      style={{
        background: '#080c14',
        borderRadius: '16px',
        padding: '20px',
      }}
    >
      <h2>Task Vectors & Model Merging</h2>
      <p className="muted">
        Pretrained parameters live at the origin. Each fine-tune creates a task vector
        τ = θ<span style={{ verticalAlign: 'sub', fontSize: '0.8em' }}>task</span> − θ
        <span style={{ verticalAlign: 'sub', fontSize: '0.8em' }}>pre</span>. Drag vectors,
        add/subtract them, and interpolate with α to see how merged models move in
        parameter space.
      </p>

      <div className="tv-layout" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
        {/* Left: geometric view */}
        <svg
          ref={svgRef}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          className="tv-chart"
          style={{ borderRadius: '12px', background: '#020617', flex: '0 0 auto' }}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerLeave={stopDragging}
        >
          {/* Grid */}
          {gridTicks.map((t) => {
            const x = xScale(t)
            return (
              <line
                key={`vx-${t}`}
                x1={x}
                y1={PADDING.top}
                x2={x}
                y2={SVG_HEIGHT - PADDING.bottom}
                stroke={MATH_COLORS.grid}
                strokeWidth={1}
              />
            )
          })}
          {gridTicks.map((t) => {
            const y = yScale(t)
            return (
              <line
                key={`hy-${t}`}
                x1={PADDING.left}
                y1={y}
                x2={SVG_WIDTH - PADDING.right}
                y2={y}
                stroke={MATH_COLORS.grid}
                strokeWidth={1}
              />
            )
          })}

          {/* Axes */}
          <line
            x1={PADDING.left}
            y1={yScale(0)}
            x2={SVG_WIDTH - PADDING.right}
            y2={yScale(0)}
            stroke={PRETRAINED_COLOR}
            strokeWidth={1.5}
          />
          <line
            x1={xScale(0)}
            y1={PADDING.top}
            x2={xScale(0)}
            y2={SVG_HEIGHT - PADDING.bottom}
            stroke={PRETRAINED_COLOR}
            strokeWidth={1.5}
          />

          {/* Origin / pretrained model */}
          <circle
            cx={originSvg[0]}
            cy={originSvg[1]}
            r={6}
            fill={PRETRAINED_COLOR}
          />
          <text
            x={originSvg[0] + 8}
            y={originSvg[1] - 6}
            fill="#e5e7eb"
            fontSize={11}
          >
            θ₀ (pretrained)
          </text>

          {/* Task vectors */}
          {/* French */}
          <g>
            <line
              x1={originSvg[0]}
              y1={originSvg[1]}
              x2={frenchSvg[0]}
              y2={frenchSvg[1]}
              stroke={TASK_COLORS.french}
              strokeWidth={2}
            />
            <polygon
              points={arrowHeadPoints(
                originSvg[0],
                originSvg[1],
                frenchSvg[0],
                frenchSvg[1]
              )}
              fill={TASK_COLORS.french}
            />
            <circle
              cx={frenchSvg[0]}
              cy={frenchSvg[1]}
              r={7}
              fill={TASK_COLORS.french}
              onPointerDown={handlePointerDown('french')}
              style={{ cursor: 'grab' }}
            />
            <text
              x={frenchSvg[0] + 8}
              y={frenchSvg[1] - 6}
              fill={TASK_COLORS.french}
              fontSize={11}
            >
              τ_french
            </text>
          </g>

          {/* Coding */}
          <g>
            <line
              x1={originSvg[0]}
              y1={originSvg[1]}
              x2={codingSvg[0]}
              y2={codingSvg[1]}
              stroke={TASK_COLORS.coding}
              strokeWidth={2}
            />
            <polygon
              points={arrowHeadPoints(
                originSvg[0],
                originSvg[1],
                codingSvg[0],
                codingSvg[1]
              )}
              fill={TASK_COLORS.coding}
            />
            <circle
              cx={codingSvg[0]}
              cy={codingSvg[1]}
              r={7}
              fill={TASK_COLORS.coding}
              onPointerDown={handlePointerDown('coding')}
              style={{ cursor: 'grab' }}
            />
            <text
              x={codingSvg[0] + 8}
              y={codingSvg[1] - 6}
              fill={TASK_COLORS.coding}
              fontSize={11}
            >
              τ_coding
            </text>
          </g>

          {/* Pirate style */}
          <g>
            <line
              x1={originSvg[0]}
              y1={originSvg[1]}
              x2={pirateSvg[0]}
              y2={pirateSvg[1]}
              stroke={TASK_COLORS.pirate}
              strokeWidth={2}
              strokeDasharray="4 3"
            />
            <polygon
              points={arrowHeadPoints(
                originSvg[0],
                originSvg[1],
                pirateSvg[0],
                pirateSvg[1]
              )}
              fill={TASK_COLORS.pirate}
            />
            <circle
              cx={pirateSvg[0]}
              cy={pirateSvg[1]}
              r={7}
              fill={TASK_COLORS.pirate}
              onPointerDown={handlePointerDown('pirate')}
              style={{ cursor: 'grab' }}
            />
            <text
              x={pirateSvg[0] + 8}
              y={pirateSvg[1] - 6}
              fill={TASK_COLORS.pirate}
              fontSize={11}
            >
              τ_pirate
            </text>
          </g>

          {/* Combined / merged model vector */}
          <g>
            <line
              x1={originSvg[0]}
              y1={originSvg[1]}
              x2={combinedSvg[0]}
              y2={combinedSvg[1]}
              stroke={COMBINED_COLOR}
              strokeWidth={3}
            />
            <polygon
              points={arrowHeadPoints(
                originSvg[0],
                originSvg[1],
                combinedSvg[0],
                combinedSvg[1],
                10
              )}
              fill={COMBINED_COLOR}
            />
            <circle
              cx={combinedSvg[0]}
              cy={combinedSvg[1]}
              r={6}
              fill={COMBINED_COLOR}
            />
            <text
              x={combinedSvg[0] + 8}
              y={combinedSvg[1] - 6}
              fill={COMBINED_COLOR}
              fontSize={11}
            >
              θ_merge
            </text>
          </g>

          {/* Axis labels */}
          <text
            x={SVG_WIDTH - PADDING.right + 8}
            y={yScale(0) + 4}
            fill={MATH_COLORS.neutral}
            fontSize={11}
          >
            dim 1
          </text>
          <text
            x={xScale(0)}
            y={PADDING.top - 10}
            fill={MATH_COLORS.neutral}
            fontSize={11}
          >
            dim 2
          </text>
        </svg>

        {/* Right: controls + examples */}
        <div
          className="tv-controls"
          style={{
            flex: '1 1 260px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
          }}
        >
          <div className="tv-modes">
            <div className="label" style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.06 }}>
              Mode
            </div>
            <div
              style={{
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                marginTop: 4,
              }}
            >
              <button
                type="button"
                className={mode === 'addition' ? 'pill active' : 'pill'}
                onClick={() => setMode('addition')}
              >
                Addition (τ_french + τ_coding)
              </button>
              <button
                type="button"
                className={mode === 'subtraction' ? 'pill active' : 'pill'}
                onClick={() => setMode('subtraction')}
              >
                Subtraction (± τ_pirate)
              </button>
              <button
                type="button"
                className={mode === 'interpolation' ? 'pill active' : 'pill'}
                onClick={() => setMode('interpolation')}
              >
                Interpolation (α blend)
              </button>
            </div>
          </div>

          {mode === 'interpolation' && (
            <label className="slider-label" style={{ marginTop: 4 }}>
              α blend between Coding (0) and French (1) &nbsp;
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                α = {alpha.toFixed(2)}
              </span>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={alpha}
                onChange={(e) => setAlpha(parseFloat(e.target.value))}
              />
            </label>
          )}

          {mode === 'subtraction' && (
            <label className="slider-label" style={{ marginTop: 4 }}>
              Pirate style weight (subtract &lt; 0, add &gt; 0) &nbsp;
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>
                w = {pirateWeight.toFixed(2)}
              </span>
              <input
                type="range"
                min={-1}
                max={1}
                step={0.05}
                value={pirateWeight}
                onChange={(e) => setPirateWeight(parseFloat(e.target.value))}
              />
            </label>
          )}

          <div
            className="tv-vector-readout"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              lineHeight: 1.4,
              background: 'rgba(15, 23, 42, 0.7)',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div style={{ marginBottom: 4 }}>Task vectors τ = θ_task − θ_pre:</div>
            <div style={{ color: TASK_COLORS.french }}>
              τ_french = {formatVec(frenchVec)} &nbsp; ({TASK_LABELS.french})
            </div>
            <div style={{ color: TASK_COLORS.coding }}>
              τ_coding = {formatVec(codingVec)} &nbsp; ({TASK_LABELS.coding})
            </div>
            <div style={{ color: TASK_COLORS.pirate }}>
              τ_pirate = {formatVec(pirateVec)} &nbsp; ({TASK_LABELS.pirate})
            </div>
            <div style={{ marginTop: 6, color: COMBINED_COLOR }}>
              θ_merge = θ₀ + linear_combo(τ_task) = {formatVec(combinedVec)}
            </div>
          </div>

          <div
            className="tv-output"
            style={{
              marginTop: 4,
              background: 'rgba(12, 10, 9, 0.9)',
              borderRadius: 8,
              padding: '10px 12px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500 }}>
              Toy outputs as you merge models
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr)',
                gap: 6,
              }}
            >
              <div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Base code</div>
                <pre
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#020617',
                    borderRadius: 6,
                    padding: '6px 8px',
                    overflowX: 'auto',
                  }}
                >
                  {BASE_SNIPPET}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: 11, color: TASK_COLORS.french }}>
                  French docs task
                </div>
                <pre
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#020617',
                    borderRadius: 6,
                    padding: '4px 8px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {/* τ_french alone */}
                  {'// Explique ce que fait cette fonction en français.'}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: 11, color: TASK_COLORS.coding }}>
                  Coding style task
                </div>
                <pre
                  style={{
                    margin: 0,
                    marginTop: 2,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#020617',
                    borderRadius: 6,
                    padding: '4px 8px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {'// Adds two numbers and returns the sum.\n// Typed, API-style comment.'}
                </pre>
              </div>

              <div>
                <div style={{ fontSize: 11, color: COMBINED_COLOR }}>
                  Current merged model
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: '#e5e7eb',
                    marginTop: 2,
                    marginBottom: 4,
                  }}
                >
                  {example.title}
                  <br />
                  <span style={{ color: '#9ca3af' }}>{example.description}</span>
                </div>
                <pre
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontFamily: 'JetBrains Mono, monospace',
                    background: '#020617',
                    borderRadius: 6,
                    padding: '4px 8px',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {example.comment}
                </pre>
              </div>
            </div>

            <p className="caption" style={{ fontSize: 11, color: '#9ca3af', margin: 0 }}>
              This is the same idea behind practical model merging methods (TIES, DARE, etc.):
              operate directly on task vectors in weight space instead of re-training from scratch
              for every combination of capabilities.
            </p>
          </div>

          {/* Game Panel */}
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.7rem 0.9rem',
              borderRadius: '0.7rem',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f9fafb' }}>🎮 Merging Challenge</span>
              {score.total > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#14b8a6', fontWeight: 500 }}>
                  Score: {score.correct}/{score.total}
                </span>
              )}
            </div>

            {!activeChallenge ? (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 0.5rem' }}>Test your understanding of task vectors:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {TASK_VECTOR_CHALLENGES.map((ch, idx) => (
                    <button
                      key={idx}
                      onClick={() => startChallenge(ch)}
                      style={{
                        padding: '0.35rem 0.7rem',
                        fontSize: '0.75rem',
                        background: 'rgba(59, 130, 246, 0.15)',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: '999px',
                        color: '#93c5fd',
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
                <p style={{ fontSize: '0.85rem', color: '#f9fafb', margin: '0 0 0.6rem', lineHeight: 1.4 }}>{activeChallenge.question}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '0.6rem' }}>
                  {(['A', 'B', 'C'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => setPrediction(opt)}
                      style={{
                        padding: '0.4rem 0.7rem',
                        fontSize: '0.78rem',
                        background: prediction === opt ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.8)',
                        border: `1px solid ${prediction === opt ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                        borderRadius: '0.5rem',
                        color: prediction === opt ? '#fbbf24' : '#e5e7eb',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      {opt === 'A' ? activeChallenge.optionA : opt === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={submitPrediction}
                    disabled={!prediction}
                    style={{
                      flex: 1,
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      background: 'rgba(245, 158, 11, 0.2)',
                      border: '1px solid rgba(245, 158, 11, 0.5)',
                      borderRadius: '0.5rem',
                      color: '#fbbf24',
                      cursor: prediction ? 'pointer' : 'not-allowed',
                      opacity: prediction ? 1 : 0.5,
                    }}
                  >
                    Submit
                  </button>
                  <button
                    onClick={resetGame}
                    style={{
                      padding: '0.4rem 0.8rem',
                      fontSize: '0.8rem',
                      background: 'transparent',
                      border: '1px solid rgba(148, 163, 184, 0.3)',
                      borderRadius: '0.5rem',
                      color: '#9ca3af',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : gamePhase === 'countdown' ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0.8rem' }}>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: '#f59e0b' }}>{countdown}</span>
                <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Revealing...</span>
              </div>
            ) : (
              <div style={{ padding: '0.4rem 0' }}>
                <p style={{ fontSize: '0.82rem', lineHeight: 1.5, color: '#e5e7eb', margin: '0 0 0.6rem' }}>
                  {getTaskVectorFeedback(prediction, activeChallenge)}
                </p>
                <button
                  onClick={resetGame}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.8rem',
                    fontSize: '0.8rem',
                    background: 'rgba(20, 184, 166, 0.2)',
                    border: '1px solid rgba(20, 184, 166, 0.5)',
                    borderRadius: '0.5rem',
                    color: '#2dd4bf',
                    cursor: 'pointer',
                  }}
                >
                  Try Another Challenge
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
