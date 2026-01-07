'use client'

import { useEffect, useMemo, useState, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Point2D } from '../../../lib/mathObjects'
import { MATH_COLORS } from '../../../lib/mathObjects'

type GamePhase = 'setup' | 'countdown' | 'revealed'
type OptimizerPrediction = 'SGD' | 'Momentum' | 'Adam' | null

interface RaceChallenge {
  name: string
  question: string
  lr: number
  momentum: number
  answer: OptimizerPrediction
  insight: string
}

const RACE_CHALLENGES: RaceChallenge[] = [
  {
    name: '🎲 Default Race',
    question: 'With lr=0.003, momentum=0.9, which optimizer reaches near-zero loss FIRST?',
    lr: 0.003,
    momentum: 0.9,
    answer: 'Adam',
    insight: 'Adam\'s per-coordinate RMS scaling helps it navigate the ill-conditioned Rosenbrock valley faster',
  },
  {
    name: '🎲 Low Momentum',
    question: 'With momentum=0, which optimizer is SLOWEST?',
    lr: 0.003,
    momentum: 0,
    answer: 'SGD',
    insight: 'without momentum, SGD zig-zags across the valley instead of accelerating along it',
  },
  {
    name: '🎲 High LR',
    question: 'With lr=0.008 (high), which is most likely to oscillate wildly?',
    lr: 0.008,
    momentum: 0.9,
    answer: 'Momentum',
    insight: 'high learning rate + momentum can cause overshooting and oscillations—momentum accumulates velocity',
  },
  {
    name: '🎲 Conservative',
    question: 'With very low lr=0.001, which makes the smoothest path to the minimum?',
    lr: 0.001,
    momentum: 0.5,
    answer: 'Adam',
    insight: 'Adam\'s adaptive scaling makes it robust even at low learning rates—it enlarges steps in flat directions',
  },
]

function getRaceFeedback(
  predicted: OptimizerPrediction,
  challenge: RaceChallenge
): string {
  const isCorrect = predicted === challenge.answer
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}.`
  }
  return `✗ The answer is ${challenge.answer}. ${challenge.insight}.`
}

/**
 * 3D Loss Landscape Explorer
 *
 * - Surface: Rosenbrock "banana" function
 * - Trajectories: SGD, Momentum, Adam‑style (RMSProp-like) optimizer
 * - Controls: camera, learning rate, momentum, gradient vectors, play/pause
 *
 * Coordinate system inside the rotating group:
 *   x, y  -> parameter space
 *   z     -> loss height (scaled)
 */

const DOMAIN = {
  x: [-2, 2] as [number, number],
  y: [-2, 2] as [number, number],
}

const SURFACE_RESOLUTION = 160
const HEIGHT_SCALE = 0.02
const MAX_STEPS = 260

type OptimizerKind = 'SGD' | 'Momentum' | 'Adam'

interface OptimizerTrajectory {
  optimizer: OptimizerKind
  points: Point2D[]
  losses: number[]
  hyperparams: Record<string, number>
}

const OPTIMIZER_COLORS: Record<OptimizerKind, string> = {
  SGD: MATH_COLORS.primary,
  Momentum: MATH_COLORS.secondary,
  Adam: MATH_COLORS.accent,
}

// --- Loss function (Rosenbrock) & gradient -----------------------------------

function rosenbrockLoss(x: number, y: number, a = 1, b = 100): number {
  return (a - x) ** 2 + b * (y - x * x) ** 2
}

function rosenbrockGrad(x: number, y: number, a = 1, b = 100): Point2D {
  const dfdx = 2 * (x - a) - 4 * b * x * (y - x * x)
  const dfdy = 2 * b * (y - x * x)
  return [dfdx, dfdy]
}

function clampToDomain(value: number, [min, max]: [number, number]) {
  return Math.min(max, Math.max(min, value))
}

// --- Optimizer simulations ---------------------------------------------------

const START_POINT: Point2D = [-1.5, 1.5]

function simulateSGD(lr: number): OptimizerTrajectory {
  let [x, y] = START_POINT
  const points: Point2D[] = [[x, y]]
  const losses: number[] = [rosenbrockLoss(x, y)]

  for (let i = 0; i < MAX_STEPS; i++) {
    const [gx, gy] = rosenbrockGrad(x, y)
    x -= lr * gx
    y -= lr * gy

    if (!Number.isFinite(x) || !Number.isFinite(y)) break
    x = clampToDomain(x, DOMAIN.x)
    y = clampToDomain(y, DOMAIN.y)

    const loss = rosenbrockLoss(x, y)
    points.push([x, y])
    losses.push(loss)
    if (loss < 1e-4) break
  }

  return {
    optimizer: 'SGD',
    points,
    losses,
    hyperparams: { lr },
  }
}

function simulateMomentum(lr: number, momentum: number): OptimizerTrajectory {
  let [x, y] = START_POINT
  let vx = 0
  let vy = 0
  const points: Point2D[] = [[x, y]]
  const losses: number[] = [rosenbrockLoss(x, y)]

  const beta = momentum

  for (let i = 0; i < MAX_STEPS; i++) {
    const [gx, gy] = rosenbrockGrad(x, y)
    vx = beta * vx + (1 - beta) * gx
    vy = beta * vy + (1 - beta) * gy

    x -= lr * vx
    y -= lr * vy

    if (!Number.isFinite(x) || !Number.isFinite(y)) break
    x = clampToDomain(x, DOMAIN.x)
    y = clampToDomain(y, DOMAIN.y)

    const loss = rosenbrockLoss(x, y)
    points.push([x, y])
    losses.push(loss)
    if (loss < 1e-4) break
  }

  return {
    optimizer: 'Momentum',
    points,
    losses,
    hyperparams: { lr, momentum: beta },
  }
}

// Adam-ish optimizer: per-coordinate RMS scaling (RMSProp-like)
// This makes steps larger in flat directions and smaller where gradients explode.
function simulateAdamish(lr: number, beta1: number, beta2 = 0.99): OptimizerTrajectory {
  let [x, y] = START_POINT
  let mX = 0
  let mY = 0
  let vX = 0
  let vY = 0
  const eps = 1e-8

  const points: Point2D[] = [[x, y]]
  const losses: number[] = [rosenbrockLoss(x, y)]

  for (let t = 1; t <= MAX_STEPS; t++) {
    const [gx, gy] = rosenbrockGrad(x, y)

    mX = beta1 * mX + (1 - beta1) * gx
    mY = beta1 * mY + (1 - beta1) * gy

    vX = beta2 * vX + (1 - beta2) * gx * gx
    vY = beta2 * vY + (1 - beta2) * gy * gy

    const stepX = mX / (Math.sqrt(vX) + eps)
    const stepY = mY / (Math.sqrt(vY) + eps)

    x -= lr * stepX
    y -= lr * stepY

    if (!Number.isFinite(x) || !Number.isFinite(y)) break
    x = clampToDomain(x, DOMAIN.x)
    y = clampToDomain(y, DOMAIN.y)

    const loss = rosenbrockLoss(x, y)
    points.push([x, y])
    losses.push(loss)
    if (loss < 1e-4) break
  }

  return {
    optimizer: 'Adam',
    points,
    losses,
    hyperparams: { lr, beta1, beta2 },
  }
}

function simulateOptimizers(baseLr: number, momentum: number): OptimizerTrajectory[] {
  // Gentle scaling: SGD slow, Momentum moderate, Adam-ish aggressive
  const lrSGD = baseLr * 0.6
  const lrMomentum = baseLr
  const lrAdam = baseLr * 1.8

  return [
    simulateSGD(lrSGD),
    simulateMomentum(lrMomentum, momentum),
    simulateAdamish(lrAdam, momentum, 0.99),
  ]
}

// --- Surface mesh ------------------------------------------------------------

function LossSurface() {
  const geometryRef = useRef<THREE.PlaneGeometry | null>(null)

  useEffect(() => {
    const geometry = geometryRef.current
    if (!geometry) return

    const positions = geometry.attributes.position as THREE.BufferAttribute
    const vertexCount = positions.count

    const rawHeights = new Float32Array(vertexCount)
    let minH = Infinity
    let maxH = -Infinity

    // First pass: compute raw heights and bounds
    for (let i = 0; i < vertexCount; i++) {
      const x = positions.getX(i) // in [-2, 2]
      const y = positions.getY(i) // in [-2, 2]
      const h = rosenbrockLoss(x, y)
      rawHeights[i] = h
      if (h < minH) minH = h
      if (h > maxH) maxH = h
    }

    const colors = new Float32Array(vertexCount * 3)
    const color = new THREE.Color()

    // Second pass: set z positions and vertex colors
    for (let i = 0; i < vertexCount; i++) {
      const h = rawHeights[i]
      const z = h * HEIGHT_SCALE
      positions.setZ(i, z)

      // Normalize height to [0, 1] for color map
      const t = (h - minH) / (maxH - minH || 1)
      // High = red (hue ~ 0), low = blue (hue ~ 0.6)
      const hue = (1 - t) * 0.6
      color.setHSL(hue, 0.9, 0.5)

      colors[i * 3 + 0] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    positions.needsUpdate = true
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.computeVertexNormals()
  }, [])

  return (
    <mesh receiveShadow castShadow>
      {/* Plane spans the domain [-2, 2] x [-2, 2] in parameter space */}
      <planeGeometry
        ref={geometryRef}
        args={[
          DOMAIN.x[1] - DOMAIN.x[0],
          DOMAIN.y[1] - DOMAIN.y[0],
          SURFACE_RESOLUTION,
          SURFACE_RESOLUTION,
        ]}
      />
      <meshPhongMaterial
        vertexColors
        side={THREE.DoubleSide}
        shininess={40}
        specular={new THREE.Color('#ffffff')}
        transparent
        opacity={0.95}
      />
    </mesh>
  )
}

// --- Trajectories & gradient vectors ----------------------------------------

interface Trajectories3DProps {
  trajectories: OptimizerTrajectory[]
  currentStep: number
  showGradients: boolean
}

function pointTo3D([x, y]: Point2D): [number, number, number] {
  const z = rosenbrockLoss(x, y) * HEIGHT_SCALE
  return [x, y, z]
}

function Trajectories3D({ trajectories, currentStep, showGradients }: Trajectories3DProps) {
  const threeTrajs = useMemo(
    () =>
      trajectories.map((traj) => ({
        ...traj,
        points3: traj.points.map(pointTo3D),
      })),
    [trajectories]
  )

  return (
    <>
      {threeTrajs.map((traj) => {
        const color = OPTIMIZER_COLORS[traj.optimizer]
        if (traj.points3.length === 0) return null

        const idx = Math.min(currentStep, traj.points3.length - 1)
        const visiblePoints = traj.points3.slice(0, idx + 1)
        const current3D = traj.points3[idx]
        const current2D = traj.points[idx]

        const [gx, gy] = rosenbrockGrad(current2D[0], current2D[1])
        const gradNorm = Math.hypot(gx, gy) || 1
        const stepLen = 0.4 // visual length of gradient arrow in parameter space
        const dirScale = stepLen / gradNorm

        const gradEnd: [number, number, number] = [
          current3D[0] - gx * dirScale,
          current3D[1] - gy * dirScale,
          current3D[2],
        ]

        return (
          <group key={traj.optimizer}>
            {/* Trajectory line */}
            {visiblePoints.length > 1 && (
              <Line
                points={visiblePoints}
                color={color}
                lineWidth={2}
                transparent
                opacity={0.9}
              />
            )}

            {/* Current point marker */}
            <mesh position={current3D}>
              <sphereGeometry args={[0.05, 24, 24]} />
              <meshStandardMaterial
                color={color}
                emissive={color}
                emissiveIntensity={0.65}
              />
            </mesh>

            {/* Local negative gradient (descent) direction */}
            {showGradients && (
              <Line
                points={[current3D, gradEnd]}
                color={color}
                lineWidth={1}
                dashed
                dashSize={0.08}
                gapSize={0.06}
                transparent
                opacity={0.85}
              />
            )}
          </group>
        )
      })}
    </>
  )
}

// --- Scene wrapper (rotates math coords into 3D "ground") --------------------

interface LossSceneProps {
  trajectories: OptimizerTrajectory[]
  currentStep: number
  showGradients: boolean
}

function LossScene({ trajectories, currentStep, showGradients }: LossSceneProps) {
  return (
    // Rotate so that:
    //   x -> world X
    //   y -> world Z
    //   loss (z) -> world Y (up)
    <group rotation-x={-Math.PI / 2}>
      <LossSurface />
      <Trajectories3D
        trajectories={trajectories}
        currentStep={currentStep}
        showGradients={showGradients}
      />
    </group>
  )
}

// --- Main component ----------------------------------------------------------

export default function LossLandscape3D() {
  const [learningRate, setLearningRate] = useState(0.003)
  const [momentum, setMomentum] = useState(0.9)
  const [showGradients, setShowGradients] = useState(true)
  const [isPlaying, setIsPlaying] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<RaceChallenge | null>(null)
  const [prediction, setPrediction] = useState<OptimizerPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [gameScore, setGameScore] = useState({ correct: 0, total: 0 })

  // Game control functions
  function startChallenge(challenge: RaceChallenge) {
    setActiveChallenge(challenge)
    setLearningRate(challenge.lr)
    setMomentum(challenge.momentum)
    setCurrentStep(0)
    setIsPlaying(false)
    setPrediction(null)
    setGamePhase('setup')
  }

  function submitPrediction(pred: OptimizerPrediction) {
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
  }

  // Countdown timer effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      setIsPlaying(true)  // Start the race animation on reveal
      if (activeChallenge && prediction) {
        const isCorrect = prediction === activeChallenge.answer
        setGameScore((s) => ({
          correct: s.correct + (isCorrect ? 1 : 0),
          total: s.total + 1,
        }))
      }
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, activeChallenge, prediction])

  const trajectories = useMemo(
    () => simulateOptimizers(learningRate, momentum),
    [learningRate, momentum]
  )

  const maxSteps = useMemo(
    () => trajectories.reduce((max, t) => Math.max(max, t.points.length), 0),
    [trajectories]
  )

  // Reset animation when hyperparameters change
  useEffect(() => {
    setCurrentStep(0)
  }, [learningRate, momentum])

  // Simple "race" animation: advance one step every ~60ms while playing
  useEffect(() => {
    if (!isPlaying || maxSteps <= 1) return

    const intervalMs = 60
    const id = window.setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= maxSteps - 1) {
          return prev
        }
        return prev + 1
      })
    }, intervalMs)

    return () => window.clearInterval(id)
  }, [isPlaying, maxSteps])

  const stats = useMemo(
    () =>
      trajectories.map((traj) => {
        const idx = Math.min(currentStep, traj.losses.length - 1)
        return {
          optimizer: traj.optimizer,
          loss: traj.losses[idx],
          step: idx,
          totalSteps: traj.losses.length - 1,
          color: OPTIMIZER_COLORS[traj.optimizer],
        }
      }),
    [trajectories, currentStep]
  )

  const handlePlayPause = () => {
    if (isPlaying) {
      setIsPlaying(false)
    } else {
      if (currentStep >= maxSteps - 1) {
        setCurrentStep(0)
      }
      setIsPlaying(true)
    }
  }

  const handleReset = () => {
    setCurrentStep(0)
    setIsPlaying(false)
  }

  return (
    <section
      className="card interactive-card loss-landscape-card"
      style={{
        background: '#080c14',
        borderRadius: '16px',
        padding: '1.25rem',
        border: '1px solid rgba(148,163,184,0.35)',
      }}
    >
      <header style={{ marginBottom: '0.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '0.25rem' }}>
          3D Loss Landscape Explorer
        </h2>
        <p className="muted" style={{ fontSize: '0.9rem', maxWidth: '36rem' }}>
          Rotate, zoom, and watch SGD, Momentum, and Adam chase the same Rosenbrock
          valley. Tweak the learning rate and momentum to feel how each optimizer
          navigates curvature.
        </p>
      </header>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.3fr) minmax(0, 1.4fr)',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* 3D viewport */}
        <div
          className="loss-landscape-canvas-wrapper"
          style={{
            position: 'relative',
            minHeight: '420px',
            borderRadius: '12px',
            overflow: 'hidden',
            background: '#020617',
          }}
        >
          <Canvas camera={{ position: [4.2, 3.3, 4.2], fov: 45 }}>
            <color attach="background" args={['#020617']} />
            <ambientLight intensity={0.4} />
            <directionalLight position={[5, 8, 5]} intensity={0.85} />
            <directionalLight position={[-4, -6, -3]} intensity={0.35} />
            <LossScene
              trajectories={trajectories}
              currentStep={currentStep}
              showGradients={showGradients}
            />
            <OrbitControls
              enablePan
              enableZoom
              enableRotate
              minDistance={2.4}
              maxDistance={12}
            />
          </Canvas>
        </div>

        {/* Controls + stats */}
        <aside
          className="loss-landscape-controls"
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
        >
          {/* Animation controls */}
          <div
            className="gd-buttons"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <button onClick={handlePlayPause}>
              {isPlaying ? 'Pause race' : 'Play race'}
            </button>
            <button onClick={handleReset} className="ghost">
              Reset
            </button>
            <span
              style={{
                marginLeft: 'auto',
                fontSize: '0.75rem',
                color: '#9ca3af',
                fontFamily: 'JetBrains Mono, monospace',
              }}
            >
              Step {Math.min(currentStep + 1, maxSteps)} / {maxSteps || '–'}
            </span>
          </div>

          {/* Hyperparameter sliders */}
          <div className="gd-controls" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label className="slider-label" style={{ fontSize: '0.85rem' }}>
              Learning rate ({learningRate.toFixed(4)})
              <input
                type="range"
                min={0.0005}
                max={0.01}
                step={0.0005}
                value={learningRate}
                onChange={(e) => setLearningRate(parseFloat(e.target.value))}
              />
            </label>
            <label className="slider-label" style={{ fontSize: '0.85rem' }}>
              Momentum / β₁ ({momentum.toFixed(2)})
              <input
                type="range"
                min={0}
                max={0.99}
                step={0.01}
                value={momentum}
                onChange={(e) => setMomentum(parseFloat(e.target.value))}
              />
            </label>

            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                marginTop: '0.25rem',
                fontSize: '0.8rem',
              }}
            >
              <input
                type="checkbox"
                checked={showGradients}
                onChange={(e) => setShowGradients(e.target.checked)}
              />
              <span>Show gradient vectors at the heads</span>
            </label>
          </div>

          {/* Current loss values */}
          <div
            className="gd-stats"
            style={{
              marginTop: '0.4rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.6rem',
              background: 'rgba(15,23,42,0.7)',
              border: '1px solid rgba(148,163,184,0.35)',
              fontSize: '0.8rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.3rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.25rem',
              }}
            >
              <span
                style={{
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: '0.7rem',
                  color: '#9ca3af',
                }}
              >
                Current loss snapshot
              </span>
            </div>
            {stats.map((s) => (
              <div
                key={s.optimizer}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.5rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span
                    style={{
                      width: '0.55rem',
                      height: '0.55rem',
                      borderRadius: '999px',
                      background: s.color,
                      boxShadow: `0 0 6px ${s.color}`,
                    }}
                  />
                  <span style={{ fontWeight: 500 }}>{s.optimizer}</span>
                </div>
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    color: '#e5e7eb',
                    display: 'flex',
                    gap: '0.75rem',
                  }}
                >
                  <span>
                    loss:{' '}
                    <span style={{ color: '#fbbf24' }}>
                      {Number.isFinite(s.loss) ? s.loss.toFixed(3) : '—'}
                    </span>
                  </span>
                  <span>
                    step: {s.step}/{s.totalSteps}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p className="caption" style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            SGD (orange) takes small, sometimes zig‑zaggy steps along the curved valley.
            Momentum (teal) smooths this but can overshoot. Adam (purple) rescales its
            steps per dimension, often cutting more directly through poorly conditioned
            regions of the landscape.
          </p>

          {/* Game Panel */}
          <div
            style={{
              marginTop: '0.75rem',
              padding: '0.6rem 0.75rem',
              borderRadius: '0.6rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              background: 'rgba(245, 158, 11, 0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>
                🎯 Optimizer Race Challenge
              </div>
              {gameScore.total > 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  Score: {gameScore.correct}/{gameScore.total}
                </span>
              )}
            </div>

            {!activeChallenge ? (
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.4rem' }}>
                  Predict which optimizer wins or struggles:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                  {RACE_CHALLENGES.map((ch) => (
                    <button
                      key={ch.name}
                      onClick={() => startChallenge(ch)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.35rem',
                        border: '1px solid rgba(245, 158, 11, 0.5)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        fontSize: '0.7rem',
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
                <p style={{ color: '#e5e7eb', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  {activeChallenge.question}
                </p>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {(['SGD', 'Momentum', 'Adam'] as const).map((opt) => (
                    <button
                      key={opt}
                      onClick={() => submitPrediction(opt)}
                      style={{
                        flex: 1,
                        padding: '0.4rem',
                        borderRadius: '0.4rem',
                        border: 'none',
                        background: OPTIMIZER_COLORS[opt],
                        color: 'white',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            ) : gamePhase === 'countdown' ? (
              <div style={{ textAlign: 'center', padding: '0.5rem 0' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                    textShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                  }}
                >
                  {countdown}
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.2rem' }}>
                  You predicted: {prediction}
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    color: prediction === activeChallenge.answer ? '#10b981' : '#ef4444',
                    fontSize: '0.75rem',
                    marginBottom: '0.4rem',
                    lineHeight: 1.4,
                  }}
                >
                  {getRaceFeedback(prediction, activeChallenge)}
                </p>
                <button
                  onClick={resetGame}
                  style={{
                    width: '100%',
                    padding: '0.4rem',
                    borderRadius: '0.4rem',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Try Another Challenge
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}
