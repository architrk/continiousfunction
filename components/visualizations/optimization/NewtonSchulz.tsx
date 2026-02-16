'use client'

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { gsap } from 'gsap'
import TimeSeriesPlot from '../../TimeSeriesPlot'
import {
  MATH_COLORS,
  matmul,
  frobeniusNorm,
  mapRange,
} from '../../../lib/mathObjects'
import type { TimeSeries } from '../../../lib/mathObjects'

// ----- Gamification types -----
type GamePhase = 'setup' | 'countdown' | 'revealed'
type ConvergencePrediction = 'A' | 'B' | 'C' | null

type NewtonSchulzChallenge = {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  answer: 'A' | 'B' | 'C'
  insight: string
}

const NEWTON_SCHULZ_CHALLENGES: NewtonSchulzChallenge[] = [
  {
    name: '🎲 Convergence Speed',
    question: 'For a moderately skewed matrix, how many Newton-Schulz iterations typically reach near-orthogonal?',
    optionA: '1-2 iterations',
    optionB: '3-5 iterations',
    optionC: '10+ iterations',
    answer: 'B',
    insight: 'Newton-Schulz has QUADRATIC convergence: each step roughly squares the error. Starting from ‖XᵀX - I‖ ≈ 0.5, after 3-5 steps error is < 10⁻⁴!'
  },
  {
    name: '🎲 What XᵀX = I Means',
    question: 'When XᵀX approaches I (identity), what property does X have?',
    optionA: 'Columns are orthonormal',
    optionB: 'Determinant is 1',
    optionC: 'X equals identity',
    answer: 'A',
    insight: 'XᵀX = I means the columns of X are orthonormal: each column has length 1 (XᵀX diagonal = 1) and columns are perpendicular (XᵀX off-diagonal = 0). This preserves lengths and angles!'
  },
  {
    name: '🎲 Update Formula',
    question: 'The Newton-Schulz update is X_{k+1} = 0.5·X_k·(3I - XᵀX). What is this computing?',
    optionA: 'Gradient descent on ‖X‖',
    optionB: 'Newton\'s method for X⁻¹ = Xᵀ',
    optionC: 'SVD decomposition',
    answer: 'B',
    insight: 'Newton-Schulz is Newton\'s method solving XᵀX = I, i.e., finding X such that its inverse equals its transpose. This is the definition of an orthogonal matrix! No explicit matrix inversion needed.'
  },
  {
    name: '🎲 Muon Connection',
    question: 'Muon optimizer uses Newton-Schulz to orthogonalize weight updates. Why is this beneficial?',
    optionA: 'Reduces memory usage',
    optionB: 'Prevents row/column coupling',
    optionC: 'Increases learning rate',
    answer: 'B',
    insight: 'In Muon, orthogonalizing the gradient update prevents different rows of a weight matrix from interfering with each other. This "decorrelates" the update directions, enabling faster, more stable training.'
  }
]

function getNewtonSchulzFeedback(predicted: ConvergencePrediction, challenge: NewtonSchulzChallenge): string {
  if (!predicted) return ''
  const isCorrect = predicted === challenge.answer
  const correctLabel = challenge.answer === 'A' ? challenge.optionA : challenge.answer === 'B' ? challenge.optionB : challenge.optionC
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}`
  }
  return `✗ The answer is "${correctLabel}". ${challenge.insight}`
}

type Vec2 = [number, number]
type Matrix2 = [[number, number], [number, number]]

interface GridLine {
  id: string
  from: Vec2
  to: Vec2
}

const IDENTITY_2: Matrix2 = [
  [1, 0],
  [0, 1],
]

const SVG_SIZE = 320
const PADDING = 32
const WORLD_MIN = -1.4
const WORLD_MAX = 1.4
const MAX_ITER = 5
const TOL = 1e-4

// Mildly skewed / squished default transform
const DEFAULT_INITIAL: Matrix2 = [
  [1.2, 0.4],
  [0.1, 0.8],
]

// Grid in logical (x, y) space before transformation
const GRID_COORDS = [-1, -0.5, 0, 0.5, 1]
const GRID_LINES: GridLine[] = [
  // Vertical lines
  ...GRID_COORDS.map((x) => ({
    id: `v-${x}`,
    from: [x, -1] as Vec2,
    to: [x, 1] as Vec2,
  })),
  // Horizontal lines
  ...GRID_COORDS.map((y) => ({
    id: `h-${y}`,
    from: [-1, y] as Vec2,
    to: [1, y] as Vec2,
  })),
]

// ----------- Linear algebra helpers (2×2) -----------

function transpose2(m: Matrix2): Matrix2 {
  return [
    [m[0][0], m[1][0]],
    [m[0][1], m[1][1]],
  ]
}

function multiply2(a: Matrix2, b: Matrix2): Matrix2 {
  const res = matmul(a as number[][], b as number[][])
  return [
    [res[0][0], res[0][1]],
    [res[1][0], res[1][1]],
  ]
}

function scaleMatrix(m: Matrix2, s: number): Matrix2 {
  return [
    [m[0][0] * s, m[0][1] * s],
    [m[1][0] * s, m[1][1] * s],
  ]
}

function subtractMatrices(a: Matrix2, b: Matrix2): Matrix2 {
  return [
    [a[0][0] - b[0][0], a[0][1] - b[0][1]],
    [a[1][0] - b[1][0], a[1][1] - b[1][1]],
  ]
}

function applyMatrixToPoint(m: Matrix2, p: Vec2): Vec2 {
  return [
    m[0][0] * p[0] + m[0][1] * p[1],
    m[1][0] * p[0] + m[1][1] * p[1],
  ]
}

function computeXTXAndError(X: Matrix2): { XTX: Matrix2; error: number } {
  const XT = transpose2(X)
  const XTX = multiply2(XT, X)
  const error = frobeniusNorm(XTX as number[][], IDENTITY_2 as number[][])
  return { XTX, error }
}

// Newton–Schulz step: X_{k+1} = 0.5 * X_k * (3I - X_k^T X_k)
function newtonSchulzStep(X: Matrix2): Matrix2 {
  const XT = transpose2(X)
  const XTX = multiply2(XT, X)
  const threeI = scaleMatrix(IDENTITY_2, 3)
  const inner = subtractMatrices(threeI, XTX)
  const prod = multiply2(X, inner)
  return scaleMatrix(prod, 0.5)
}

// A random-but-not-insane skew matrix for resets
function makeRandomSkew(): Matrix2 {
  const angle = (Math.random() - 0.5) * (Math.PI / 2) // ±45°
  const c = Math.cos(angle)
  const s = Math.sin(angle)
  const R: Matrix2 = [
    [c, -s],
    [s, c],
  ]
  const sx = 0.7 + Math.random() * 0.6
  const sy = 0.7 + Math.random() * 0.6
  const shear = (Math.random() - 0.5) * 0.8
  const S: Matrix2 = [
    [sx, shear],
    [0, sy],
  ]
  return multiply2(R, S)
}

// ----------- Coordinate mapping -----------

function worldToSvg(p: Vec2): Vec2 {
  const [wx, wy] = p
  const x = mapRange(wx, WORLD_MIN, WORLD_MAX, PADDING, SVG_SIZE - PADDING)
  // Flip Y so up in world is up in SVG
  const y = mapRange(wy, WORLD_MAX, WORLD_MIN, PADDING, SVG_SIZE - PADDING)
  return [x, y]
}

function svgToWorld(x: number, y: number): Vec2 {
  const wx = mapRange(x, PADDING, SVG_SIZE - PADDING, WORLD_MIN, WORLD_MAX)
  const wy = mapRange(y, SVG_SIZE - PADDING, PADDING, WORLD_MIN, WORLD_MAX)
  return [wx, wy]
}

// ----------- Component -----------

export default function NewtonSchulzOrthogonalizationDemo() {
  const [_initialMatrix, setInitialMatrix] =
    useState<Matrix2>(DEFAULT_INITIAL)
  const [currentMatrix, setCurrentMatrix] =
    useState<Matrix2>(DEFAULT_INITIAL)
  const [iteration, setIteration] = useState(0)
  const [errorHistory, setErrorHistory] = useState<number[]>(() => {
    const { error } = computeXTXAndError(DEFAULT_INITIAL)
    return [error]
  })
  // Path of the e1 column endpoint through iterations (for the orange "animated path")
  const [basisPath, setBasisPath] = useState<Vec2[]>(() => [
    applyMatrixToPoint(DEFAULT_INITIAL, [1, 0]),
  ])

  const [draggingHandle, setDraggingHandle] = useState<
    null | 'e1' | 'e2'
  >(null)

  // ----- Gamification state -----
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<NewtonSchulzChallenge | null>(null)
  const [prediction, setPrediction] = useState<ConvergencePrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  // Game control functions
  function startChallenge(challenge: NewtonSchulzChallenge) {
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
      // Update score
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

  // Refs for GSAP + state mirrors
  const svgRef = useRef<SVGSVGElement | null>(null)
  const gridLineRefs = useRef<(SVGLineElement | null)[]>([])
  const basisE1Ref = useRef<SVGLineElement | null>(null)
  const basisE2Ref = useRef<SVGLineElement | null>(null)

  const currentMatrixRef = useRef<Matrix2>(DEFAULT_INITIAL)
  const iterationRef = useRef<number>(0)
  const errorHistoryRef = useRef<number[]>(errorHistory)

  useEffect(() => {
    currentMatrixRef.current = currentMatrix
  }, [currentMatrix])

  useEffect(() => {
    iterationRef.current = iteration
  }, [iteration])

  useEffect(() => {
    errorHistoryRef.current = errorHistory
  }, [errorHistory])

  // Current XᵀX and error
  const { XTX, error: currentError } = useMemo(
    () => computeXTXAndError(currentMatrix),
    [currentMatrix]
  )

  const format = (x: number) => x.toFixed(3)

  const errorSeries: TimeSeries[] = useMemo(
    () => [
      {
        label: '‖XᵀX − I‖₍F₎',
        data: errorHistory.map((value, t) => ({ t, value })),
        color: '#f97316', // orange path color
      },
    ],
    [errorHistory]
  )

  // Set grid + basis positions for a given matrix (instant or animated)
  const setGridAndBasisPositions = (
    matrix: Matrix2,
    opts?: { immediate?: boolean }
  ) => {
    const immediate = opts?.immediate ?? false
    const duration = immediate ? 0 : 0.5
    const ease = 'power2.out'

    const originWorld: Vec2 = [0, 0]
    const [ox, oy] = worldToSvg(originWorld)
    const e1World = applyMatrixToPoint(matrix, [1, 0])
    const e2World = applyMatrixToPoint(matrix, [0, 1])
    const [e1x, e1y] = worldToSvg(e1World)
    const [e2x, e2y] = worldToSvg(e2World)

    gridLineRefs.current.forEach((el, index) => {
      if (!el) return
      const line = GRID_LINES[index]
      const p1World = applyMatrixToPoint(matrix, line.from)
      const p2World = applyMatrixToPoint(matrix, line.to)
      const [x1, y1] = worldToSvg(p1World)
      const [x2, y2] = worldToSvg(p2World)

      if (immediate) {
        gsap.set(el, {
          attr: { x1, y1, x2, y2 },
        })
      } else {
        gsap.to(el, {
          duration,
          ease,
          attr: { x1, y1, x2, y2 },
        })
      }
    })

    if (basisE1Ref.current) {
      if (immediate) {
        gsap.set(basisE1Ref.current, {
          attr: { x1: ox, y1: oy, x2: e1x, y2: e1y },
        })
      } else {
        gsap.to(basisE1Ref.current, {
          duration,
          ease,
          attr: { x1: ox, y1: oy, x2: e1x, y2: e1y },
        })
      }
    }

    if (basisE2Ref.current) {
      if (immediate) {
        gsap.set(basisE2Ref.current, {
          attr: { x1: ox, y1: oy, x2: e2x, y2: e2y },
        })
      } else {
        gsap.to(basisE2Ref.current, {
          duration,
          ease,
          attr: { x1: ox, y1: oy, x2: e2x, y2: e2y },
        })
      }
    }
  }

  // Animate a Newton–Schulz step and update state
  const performStep = (opts?: { onComplete?: () => void }) => {
    const Xk = currentMatrixRef.current
    const Xnext = newtonSchulzStep(Xk)
    const { error: nextError } = computeXTXAndError(Xnext)

    // Animate grid & basis to the next matrix
    const immediate = false
    if (immediate) {
      setGridAndBasisPositions(Xnext, { immediate: true })
      opts?.onComplete?.()
    } else {
      const originWorld: Vec2 = [0, 0]
      const [ox, oy] = worldToSvg(originWorld)
      const e1World = applyMatrixToPoint(Xnext, [1, 0])
      const e2World = applyMatrixToPoint(Xnext, [0, 1])
      const [e1x, e1y] = worldToSvg(e1World)
      const [e2x, e2y] = worldToSvg(e2World)

      const tl = gsap.timeline({
        defaults: { duration: 0.5, ease: 'power2.out' },
        onComplete: opts?.onComplete,
      })

      GRID_LINES.forEach((line, index) => {
        const el = gridLineRefs.current[index]
        if (!el) return
        const p1World = applyMatrixToPoint(Xnext, line.from)
        const p2World = applyMatrixToPoint(Xnext, line.to)
        const [x1, y1] = worldToSvg(p1World)
        const [x2, y2] = worldToSvg(p2World)

        tl.to(
          el,
          {
            attr: { x1, y1, x2, y2 },
          },
          0
        )
      })

      if (basisE1Ref.current) {
        tl.to(
          basisE1Ref.current,
          {
            attr: { x1: ox, y1: oy, x2: e1x, y2: e1y },
          },
          0
        )
      }
      if (basisE2Ref.current) {
        tl.to(
          basisE2Ref.current,
          {
            attr: { x1: ox, y1: oy, x2: e2x, y2: e2y },
          },
          0
        )
      }
    }

    // Update state & path
    currentMatrixRef.current = Xnext
    setCurrentMatrix(Xnext)
    setIteration((prev) => prev + 1)
    setErrorHistory((prev) => [...prev, nextError])

    const e1WorldForPath = applyMatrixToPoint(Xnext, [1, 0])
    setBasisPath((prev) => [...prev, e1WorldForPath])
  }

  const runToConvergence = () => {
    const run = () => {
      const k = iterationRef.current
      const lastError =
        errorHistoryRef.current[errorHistoryRef.current.length - 1]
      if (k >= MAX_ITER || lastError < TOL) return
      performStep({ onComplete: run })
    }
    run()
  }

  const resetRandom = () => {
    const X0 = makeRandomSkew()
    const { error } = computeXTXAndError(X0)
    currentMatrixRef.current = X0
    setInitialMatrix(X0)
    setCurrentMatrix(X0)
    setIteration(0)
    setErrorHistory([error])
    setBasisPath([applyMatrixToPoint(X0, [1, 0])])
    setGridAndBasisPositions(X0, { immediate: true })
  }

  // Initial placement of transformed grid / basis
  useLayoutEffect(() => {
    setGridAndBasisPositions(currentMatrixRef.current, { immediate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----------- Pointer / drag handlers -----------

  const handleBasisHandleDown =
    (handle: 'e1' | 'e2') =>
    (e: ReactPointerEvent<SVGCircleElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (svgRef.current) {
        try {
          svgRef.current.setPointerCapture(e.pointerId)
        } catch {
          // ignore
        }
      }
      setDraggingHandle(handle)
    }

  const handleSvgPointerMove = (
    e: ReactPointerEvent<SVGSVGElement>
  ): void => {
    if (!draggingHandle || !svgRef.current) return

    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const [wx, wy] = svgToWorld(x, y)

    // Clamp basis vector length so the iteration stays sane
    const maxRadius = 1.6
    const minRadius = 0.25
    const len = Math.hypot(wx, wy)

    let newVec: Vec2
    if (len < 1e-6) {
      newVec = [minRadius, 0]
    } else {
      const clamped = Math.min(Math.max(len, minRadius), maxRadius)
      newVec = [(wx / len) * clamped, (wy / len) * clamped]
    }

    const prev = currentMatrixRef.current
    const next: Matrix2 =
      draggingHandle === 'e1'
        ? [
            [newVec[0], prev[0][1]],
            [newVec[1], prev[1][1]],
          ]
        : [
            [prev[0][0], newVec[0]],
            [prev[1][0], newVec[1]],
          ]

    currentMatrixRef.current = next
    setInitialMatrix(next)
    setCurrentMatrix(next)
    setIteration(0)

    const { error } = computeXTXAndError(next)
    setErrorHistory([error])
    setBasisPath([applyMatrixToPoint(next, [1, 0])])
    setGridAndBasisPositions(next, { immediate: true })
  }

  const handleSvgPointerUp = (
    e: ReactPointerEvent<SVGSVGElement>
  ): void => {
    if (!draggingHandle || !svgRef.current) return
    try {
      svgRef.current.releasePointerCapture(e.pointerId)
    } catch {
      // ignore
    }
    setDraggingHandle(null)
  }

  // ----------- Derived SVG data -----------

  const identityGridLines = useMemo(
    () =>
      GRID_LINES.map((line) => {
        const [x1, y1] = worldToSvg(line.from)
        const [x2, y2] = worldToSvg(line.to)
        return { ...line, x1, y1, x2, y2 }
      }),
    []
  )

  const e1CurrentWorld = applyMatrixToPoint(currentMatrix, [1, 0])
  const e2CurrentWorld = applyMatrixToPoint(currentMatrix, [0, 1])
  const [e1cx, e1cy] = worldToSvg(e1CurrentWorld)
  const [e2cx, e2cy] = worldToSvg(e2CurrentWorld)
  const [originX, originY] = worldToSvg([0, 0])

  const basisPathPoints = basisPath
    .map((p) => {
      const [x, y] = worldToSvg(p)
      return `${x},${y}`
    })
    .join(' ')

  return (
    <section className="card interactive-card">
      <h2>Newton–Schulz Matrix Orthogonalization</h2>
      <p className="muted">
        Drag the teal basis &ldquo;corners&rdquo; to create a squished or
        skewed 2&times;2 matrix. Then run the Newton–Schulz iteration to
        watch the grid snap back toward an orthogonal transform in just a
        few steps.
      </p>

      <div
        className="newton-layout"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1fr)',
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        {/* Left: Grid visualization */}
        <svg
          ref={svgRef}
          width={SVG_SIZE}
          height={SVG_SIZE}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onPointerLeave={handleSvgPointerUp}
          role="img"
          aria-label="2D grid showing Newton–Schulz orthogonalization of a 2x2 matrix"
          style={{
            background: '#0d1219',
            borderRadius: '0.75rem',
            border: '1px solid rgba(148, 163, 184, 0.35)',
            touchAction: 'none',
          }}
        >
          {/* Background grid (identity) in gray */}
          {identityGridLines.map((line) => (
            <line
              key={`id-${line.id}`}
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke="#4b5563"
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.6}
            />
          ))}

          {/* Axes */}
          <line
            x1={PADDING}
            y1={originY}
            x2={SVG_SIZE - PADDING}
            y2={originY}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth={1}
          />
          <line
            x1={originX}
            y1={PADDING}
            x2={originX}
            y2={SVG_SIZE - PADDING}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth={1}
          />

          {/* Animated transformed grid in teal (#14b8a6) */}
          {GRID_LINES.map((line, index) => {
            // Give a sane initial position (DEFAULT_INITIAL) so SSR/hydration looks okay.
            const p1World = applyMatrixToPoint(DEFAULT_INITIAL, line.from)
            const p2World = applyMatrixToPoint(DEFAULT_INITIAL, line.to)
            const [x1, y1] = worldToSvg(p1World)
            const [x2, y2] = worldToSvg(p2World)
            return (
              <line
                key={`tx-${line.id}`}
                ref={(el) => {
                  gridLineRefs.current[index] = el
                }}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={MATH_COLORS.secondary}
                strokeWidth={1.5}
                opacity={0.95}
              />
            )
          })}

          {/* Orange path of the e1 column through iterations */}
          {basisPath.length > 1 && (
            <polyline
              points={basisPathPoints}
              fill="none"
              stroke={MATH_COLORS.primary}
              strokeWidth={2}
              strokeDasharray="4 4"
              opacity={0.9}
            />
          )}

          {/* Basis vectors (current columns of X) */}
          <line
            ref={basisE1Ref}
            x1={originX}
            y1={originY}
            x2={e1cx}
            y2={e1cy}
            stroke={MATH_COLORS.primary}
            strokeWidth={2.4}
          />
          <line
            ref={basisE2Ref}
            x1={originX}
            y1={originY}
            x2={e2cx}
            y2={e2cy}
            stroke={MATH_COLORS.primary}
            strokeWidth={2}
            opacity={0.7}
          />

          {/* Drag handles at the basis endpoints (user-distorted "corners") */}
          <circle
            cx={e1cx}
            cy={e1cy}
            r={8}
            fill={MATH_COLORS.primary}
            stroke="#0f172a"
            strokeWidth={2}
            onPointerDown={handleBasisHandleDown('e1')}
          />
          <circle
            cx={e2cx}
            cy={e2cy}
            r={8}
            fill={MATH_COLORS.primary}
            stroke="#0f172a"
            strokeWidth={2}
            onPointerDown={handleBasisHandleDown('e2')}
          />

          {/* Labels */}
          <text
            x={SVG_SIZE - PADDING + 12}
            y={originY + 4}
            fill="#9ca3af"
            fontSize={12}
          >
            x
          </text>
          <text
            x={originX - 4}
            y={PADDING - 12}
            fill="#9ca3af"
            fontSize={12}
          >
            y
          </text>
        </svg>

        {/* Right: matrices, stats, and convergence plot */}
        <div
          className="newton-side"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div className="ns-matrices">
            <div
              className="ns-matrix"
              style={{
                marginBottom: '0.75rem',
              }}
            >
              <div
                className="ns-matrix-title"
                style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}
              >
                X (current 2 &times; 2 transform)
              </div>
              <table
                style={{
                  borderCollapse: 'collapse',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: '#e5e7eb',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 12 }}>[
                    </td>
                    <td style={{ paddingRight: 8 }}>{format(currentMatrix[0][0])}</td>
                    <td style={{ paddingRight: 8 }}>{format(currentMatrix[0][1])}</td>
                    <td>]</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 12 }}>
                      [
                    </td>
                    <td style={{ paddingRight: 8 }}>{format(currentMatrix[1][0])}</td>
                    <td style={{ paddingRight: 8 }}>{format(currentMatrix[1][1])}</td>
                    <td>]</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="ns-matrix">
              <div
                className="ns-matrix-title"
                style={{ fontSize: 12, color: '#9ca3af', marginBottom: 4 }}
              >
                XᵀX (should approach identity I)
              </div>
              <table
                style={{
                  borderCollapse: 'collapse',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 12,
                  color: '#e5e7eb',
                }}
              >
                <tbody>
                  <tr>
                    <td style={{ paddingRight: 12 }}>[
                    </td>
                    <td style={{ paddingRight: 8 }}>{format(XTX[0][0])}</td>
                    <td style={{ paddingRight: 8 }}>{format(XTX[0][1])}</td>
                    <td>]</td>
                  </tr>
                  <tr>
                    <td style={{ paddingRight: 12 }}>
                      [
                    </td>
                    <td style={{ paddingRight: 8 }}>{format(XTX[1][0])}</td>
                    <td style={{ paddingRight: 8 }}>{format(XTX[1][1])}</td>
                    <td>]</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div
            className="ns-stats"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.75rem',
              fontSize: 13,
              color: '#d1d5db',
            }}
          >
            <div>
              <span style={{ color: '#9ca3af' }}>Iteration:</span>{' '}
              <strong>{iteration}</strong>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>‖XᵀX − I‖₍F₎:</span>{' '}
              <strong>{currentError.toExponential(3)}</strong>
            </div>
            <div>
              <span style={{ color: '#9ca3af' }}>Typical convergence:</span>{' '}
              <span>3–5 steps</span>
            </div>
          </div>

          <div
            className="ns-controls"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginTop: '0.25rem',
            }}
          >
            <button
              type="button"
              onClick={() => performStep()}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                border: '1px solid rgba(248, 250, 252, 0.2)',
                background:
                  'linear-gradient(to right, rgba(248,250,252,0.12), rgba(148,163,184,0.15))',
                color: '#f9fafb',
                fontSize: 13,
              }}
            >
              Step Newton–Schulz
            </button>
            <button
              type="button"
              onClick={runToConvergence}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                border: '1px solid rgba(56,189,248,0.4)',
                background:
                  'linear-gradient(to right, rgba(45,212,191,0.15), rgba(56,189,248,0.15))',
                color: '#e0f2fe',
                fontSize: 13,
              }}
            >
              Run 3–5 steps
            </button>
            <button
              type="button"
              onClick={resetRandom}
              style={{
                padding: '0.35rem 0.75rem',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.35)',
                background: 'transparent',
                color: '#e5e7eb',
                fontSize: 13,
                opacity: 0.85,
              }}
            >
              Reset to random skew
            </button>
          </div>

          <div
            className="ns-chart"
            style={{
              marginTop: '0.5rem',
              background: 'rgba(15,23,42,0.8)',
              borderRadius: '0.75rem',
              padding: '0.5rem',
              border: '1px solid rgba(148,163,184,0.3)',
            }}
          >
            <TimeSeriesPlot
              series={errorSeries}
              width={360}
              height={180}
              xLabel="iteration k"
              yLabel="‖XᵀX − I‖₍F₎"
              showLegend={false}
              animate={false}
            />
            <p
              className="caption"
              style={{
                fontSize: 11,
                color: '#9ca3af',
                marginTop: 4,
              }}
            >
              Newton–Schulz rapidly shrinks ‖XᵀX − I‖, driving X towards an
              orthogonal matrix that preserves lengths and angles.
            </p>
          </div>

          {/* Game Panel */}
          <div
            className="ns-game-panel"
            style={{
              marginTop: '0.75rem',
              padding: '0.7rem 0.9rem',
              borderRadius: '0.7rem',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(148, 163, 184, 0.2)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f9fafb' }}>🎮 Orthogonalization Challenge</span>
              {score.total > 0 && (
                <span style={{ fontSize: '0.75rem', color: '#14b8a6', fontWeight: 500 }}>
                  Score: {score.correct}/{score.total}
                </span>
              )}
            </div>

            {!activeChallenge ? (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 0.5rem' }}>Test your understanding of Newton-Schulz:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {NEWTON_SCHULZ_CHALLENGES.map((ch, idx) => (
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
                  <button
                    onClick={() => setPrediction('A')}
                    style={{
                      padding: '0.4rem 0.7rem',
                      fontSize: '0.78rem',
                      background: prediction === 'A' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.8)',
                      border: `1px solid ${prediction === 'A' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                      borderRadius: '0.5rem',
                      color: prediction === 'A' ? '#fbbf24' : '#e5e7eb',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {activeChallenge.optionA}
                  </button>
                  <button
                    onClick={() => setPrediction('B')}
                    style={{
                      padding: '0.4rem 0.7rem',
                      fontSize: '0.78rem',
                      background: prediction === 'B' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.8)',
                      border: `1px solid ${prediction === 'B' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                      borderRadius: '0.5rem',
                      color: prediction === 'B' ? '#fbbf24' : '#e5e7eb',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {activeChallenge.optionB}
                  </button>
                  <button
                    onClick={() => setPrediction('C')}
                    style={{
                      padding: '0.4rem 0.7rem',
                      fontSize: '0.78rem',
                      background: prediction === 'C' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(31, 41, 55, 0.8)',
                      border: `1px solid ${prediction === 'C' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(148, 163, 184, 0.3)'}`,
                      borderRadius: '0.5rem',
                      color: prediction === 'C' ? '#fbbf24' : '#e5e7eb',
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    {activeChallenge.optionC}
                  </button>
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
                    Submit Prediction
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
                  {getNewtonSchulzFeedback(prediction, activeChallenge)}
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
