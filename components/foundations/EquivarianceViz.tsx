'use client'

import React, { useEffect, useRef, useState, useMemo } from 'react'
import { gsap } from 'gsap'

// Game types for transform prediction challenge
type GamePhase = 'setup' | 'countdown' | 'revealed'
type TransformPrediction = 'rotation' | 'translation' | 'reflection' | 'identity' | 'combined' | null

interface TransformChallenge {
  name: string
  rotation: number
  tx: number
  ty: number
  reflectX: boolean
  reflectY: boolean
  question: string
  answer: TransformPrediction
  explanation: string
}

// Transform challenges for the prediction game
const TRANSFORM_CHALLENGES: TransformChallenge[] = [
  {
    name: '🎲 Mystery 1',
    rotation: 90,
    tx: 0,
    ty: 0,
    reflectX: false,
    reflectY: false,
    question: 'What type of transformation is this? (Watch the input shape!)',
    answer: 'rotation',
    explanation: '🔄 This is a pure 90° rotation (C₄ generator). Notice: the invariant output IGNORES it, but the equivariant output MATCHES it!',
  },
  {
    name: '🎲 Mystery 2',
    rotation: 0,
    tx: 50,
    ty: -30,
    reflectX: false,
    reflectY: false,
    question: 'Classify this transformation:',
    answer: 'translation',
    explanation: '↔️ Pure translation! The object moved but didn\'t rotate. Invariant networks (like classifiers) ignore position; equivariant networks (like detectors) track it.',
  },
  {
    name: '🎲 Mystery 3',
    rotation: 0,
    tx: 0,
    ty: 0,
    reflectX: true,
    reflectY: false,
    question: 'What symmetry operation is this?',
    answer: 'reflection',
    explanation: '🪞 Reflection across x-axis (σₓ)! Reflections form Z₂ subgroup - applying twice returns to identity. Combined with rotations, you get dihedral groups.',
  },
  {
    name: '🎲 Mystery 4',
    rotation: 45,
    tx: 30,
    ty: 20,
    reflectX: false,
    reflectY: false,
    question: 'This is a ___ transformation:',
    answer: 'combined',
    explanation: '🌀 Compound transform: rotation + translation! This is an element of SE(2) - the special Euclidean group. Most real-world transforms are combinations.',
  },
]

function getTransformFeedback(
  prediction: TransformPrediction,
  challenge: TransformChallenge
): string {
  const typeNames: Record<string, string> = {
    rotation: 'Rotation',
    translation: 'Translation',
    reflection: 'Reflection',
    identity: 'Identity',
    combined: 'Combined (rotation + translation)'
  }

  if (prediction === challenge.answer) {
    return `✓ Correct! ${challenge.explanation}`
  }

  return `✗ Not quite. The answer is ${typeNames[challenge.answer!]}.\n\n${challenge.explanation}`
}

// Transform group presets demonstrating different symmetry operations
const TRANSFORM_PRESETS = [
  { name: '🎯 Identity', rotation: 0, tx: 0, ty: 0, reflectX: false, reflectY: false, description: 'No transformation (e = identity element)' },
  { name: '🔄 90° CW', rotation: 90, tx: 0, ty: 0, reflectX: false, reflectY: false, description: 'Quarter turn clockwise (C₄ generator)' },
  { name: '↩️ 180°', rotation: 180, tx: 0, ty: 0, reflectX: false, reflectY: false, description: 'Half turn (order 2 element)' },
  { name: '🪞 Mirror X', rotation: 0, tx: 0, ty: 0, reflectX: true, reflectY: false, description: 'Reflection across x-axis (σₓ)' },
  { name: '↔️ Translate', rotation: 0, tx: 60, ty: -30, reflectX: false, reflectY: false, description: 'Pure translation (moves position)' },
  { name: '🌀 Random', rotation: -1, tx: -1, ty: -1, reflectX: false, reflectY: false, description: 'Random SE(2) transformation' },
]

// Dynamic educational insights based on current transform state
function getEquivarianceInsight(
  rotation: number,
  tx: number,
  ty: number,
  reflectX: boolean,
  reflectY: boolean
): string {
  // Check for identity
  const isIdentity = rotation === 0 && tx === 0 && ty === 0 && !reflectX && !reflectY;
  if (isIdentity) {
    return "🎯 Identity transform: f(e · x) = e · f(x). Both networks output the same as input - the identity element leaves everything unchanged!";
  }

  // Pure rotation
  if (rotation !== 0 && tx === 0 && ty === 0 && !reflectX && !reflectY) {
    if (rotation === 90 || rotation === 270) {
      return `🔄 ${rotation}° rotation (C₄ subgroup). Invariant: class stays "arrow". Equivariant: bounding box rotates with the object!`;
    }
    if (rotation === 180) {
      return "↩️ 180° rotation has order 2 (applying twice = identity). Notice the equivariant output tracks the flip perfectly!";
    }
    return `🔄 ${rotation}° rotation ∈ SO(2). The classification is blind to orientation, but object detection preserves it.`;
  }

  // Pure translation
  if (rotation === 0 && (tx !== 0 || ty !== 0) && !reflectX && !reflectY) {
    const distance = Math.sqrt(tx * tx + ty * ty).toFixed(0);
    return `↔️ Pure translation (${distance}px). CNNs with global pooling gain invariance; detection heads remain equivariant to position.`;
  }

  // Reflection
  if (reflectX || reflectY) {
    const axis = reflectX && reflectY ? 'both axes' : reflectX ? 'x-axis' : 'y-axis';
    return `🪞 Reflection across ${axis}! Reflections form Z₂ subgroup. Combined with rotation = dihedral group D_n.`;
  }

  // Combined transform
  const parts = [];
  if (rotation !== 0) parts.push(`${rotation}° rotation`);
  if (tx !== 0 || ty !== 0) parts.push('translation');
  if (reflectX || reflectY) parts.push('reflection');

  return `🌀 Compound transform: ${parts.join(' + ')}. This is an element of SE(2) × Z₂² (special Euclidean group with reflections).`;
}

// You can swap these for imports from ../lib/mathObjects if you prefer.
const COLORS = {
  background: '#0d1219',
  input: '#14b8a6', // teal
  output: '#f59e0b', // orange
  arrows: '#9ca3af', // gray-400
  text: '#e5e7eb',
  subtle: '#6b7280',
}

const MAX_TRANSLATE = 80

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function buildTransform(
  rotationDeg: number,
  translation: { x: number; y: number },
  reflection: { x: boolean; y: boolean },
  scale = 1
): string {
  const sx = reflection.x ? -scale : scale
  const sy = reflection.y ? -scale : scale
  const { x, y } = translation
  return `translate(${x}px, ${y}px) rotate(${rotationDeg}deg) scale(${sx}, ${sy})`
}

export default function EquivarianceInvarianceDemo() {
  const [rotation, setRotation] = useState(0)
  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [reflectX, setReflectX] = useState(false)
  const [reflectY, setReflectY] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Game state for transform prediction challenge
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<TransformChallenge | null>(null)
  const [prediction, setPrediction] = useState<TransformPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

  const dragStartRef = useRef<{
    x: number
    y: number
    tx: number
    ty: number
  } | null>(null)

  const inputShapeRef = useRef<HTMLDivElement | null>(null)
  const invariantShapeRef = useRef<HTMLDivElement | null>(null)
  const equivariantShapeRef = useRef<HTMLDivElement | null>(null)

  // Animate transforms with GSAP
  useEffect(() => {
    const translation = { x: tx, y: ty }
    const reflection = { x: reflectX, y: reflectY }

    const inputTransform = buildTransform(rotation, translation, reflection, 1)
    const equivTransform = buildTransform(rotation, translation, reflection, 1)
    const invariantTransform = buildTransform(0, { x: 0, y: 0 }, { x: false, y: false }, 1)

    if (inputShapeRef.current) {
      gsap.to(inputShapeRef.current, {
        transform: inputTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    if (equivariantShapeRef.current) {
      gsap.to(equivariantShapeRef.current, {
        transform: equivTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    if (invariantShapeRef.current) {
      gsap.to(invariantShapeRef.current, {
        transform: invariantTransform,
        duration: 0.35,
        ease: 'power2.out',
      })
    }

    // Cleanup: kill any running tweens on unmount to prevent memory leaks
    return () => {
      if (inputShapeRef.current) gsap.killTweensOf(inputShapeRef.current)
      if (equivariantShapeRef.current) gsap.killTweensOf(equivariantShapeRef.current)
      if (invariantShapeRef.current) gsap.killTweensOf(invariantShapeRef.current)
    }
  }, [rotation, tx, ty, reflectX, reflectY])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      tx,
      ty,
    }
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartRef.current) return
    const dx = event.clientX - dragStartRef.current.x
    const dy = event.clientY - dragStartRef.current.y
    setTx(clamp(dragStartRef.current.tx + dx, -MAX_TRANSLATE, MAX_TRANSLATE))
    setTy(clamp(dragStartRef.current.ty + dy, -MAX_TRANSLATE, MAX_TRANSLATE))
  }

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    setIsDragging(false)
    dragStartRef.current = null
  }

  const handleReset = () => {
    setRotation(0)
    setTx(0)
    setTy(0)
    setReflectX(false)
    setReflectY(false)
  }

  // Apply transform preset
  const handlePreset = (preset: typeof TRANSFORM_PRESETS[0]) => {
    if (preset.rotation === -1) {
      // Random transform
      setRotation(Math.floor(Math.random() * 360))
      setTx(Math.floor(Math.random() * 160) - 80)
      setTy(Math.floor(Math.random() * 160) - 80)
      setReflectX(Math.random() > 0.5)
      setReflectY(Math.random() > 0.5)
    } else {
      setRotation(preset.rotation)
      setTx(preset.tx)
      setTy(preset.ty)
      setReflectX(preset.reflectX)
      setReflectY(preset.reflectY)
    }
  }

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getEquivarianceInsight(rotation, tx, ty, reflectX, reflectY);
  }, [rotation, tx, ty, reflectX, reflectY]);

  const poseSummary = `pos=(${tx.toFixed(0)}, ${ty.toFixed(
    0
  )}) · rot=${rotation.toFixed(0)}° · flip=[x:${reflectX ? 'on' : 'off'}, y:${
    reflectY ? 'on' : 'off'
  }]`

  // Game control functions
  const startChallenge = (challenge: TransformChallenge) => {
    setSelectedChallenge(challenge)
    setRotation(challenge.rotation)
    setTx(challenge.tx)
    setTy(challenge.ty)
    setReflectX(challenge.reflectX)
    setReflectY(challenge.reflectY)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(4)
  }

  const submitPrediction = (pred: TransformPrediction) => {
    if (gamePhase !== 'countdown' || !selectedChallenge) return
    setPrediction(pred)
    setGamePhase('revealed')

    if (pred === selectedChallenge.answer && !completedChallenges.has(selectedChallenge.name)) {
      setScore(s => s + 1)
      setCompletedChallenges(prev => new Set([...prev, selectedChallenge.name]))
    }
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(0)
  }

  // Countdown timer for game
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown(c => c - 1)
    }, 1000)

    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  // Auto-reveal when countdown reaches 0
  useEffect(() => {
    if (gamePhase === 'countdown' && countdown === 0 && !prediction) {
      setGamePhase('revealed')
    }
  }, [gamePhase, countdown, prediction])

  return (
    <section
      className="equivariance-demo card interactive-card"
      style={{
        backgroundColor: COLORS.background,
        borderRadius: '1rem',
        padding: '1.5rem',
        color: COLORS.text,
        border: '1px solid rgba(148,163,184,0.3)',
      }}
    >
      <header style={{ marginBottom: '1rem' }}>
        <h2 style={{ fontSize: '1.35rem', fontWeight: 600, marginBottom: '0.25rem' }}>
          Equivariance vs Invariance (Vision Intuition)
        </h2>
        <p style={{ fontSize: '0.9rem', color: COLORS.subtle, maxWidth: 640 }}>
          Drag or rotate the teal arrow (input). A classification network wants invariance
          (orange output doesn&apos;t move), while an object detection network wants equivariance
          (orange output moves in sync).
        </p>
      </header>

      {/* Game toggle button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode)
            if (gameMode) resetGame()
          }}
          style={{
            fontSize: '0.75rem',
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border: gameMode ? '1px solid rgba(139, 92, 246, 0.6)' : '1px solid rgba(75, 85, 99, 0.5)',
            background: gameMode ? 'rgba(139, 92, 246, 0.2)' : 'rgba(15, 23, 42, 0.8)',
            color: '#e5e7eb',
            cursor: 'pointer',
          }}
        >
          {gameMode ? '🎮 Exit Quiz' : '🔄 Try Transform Quiz'}
        </button>
      </div>

      {/* Transform Quiz Game Panel */}
      {gameMode && (
        <div
          style={{
            padding: '1rem',
            marginBottom: '1rem',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))',
            border: '1px solid rgba(139, 92, 246, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, color: '#8b5cf6' }}>
              🔄 Transform Classification Quiz
            </span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              Score: {score}/{TRANSFORM_CHALLENGES.length}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' }}>
            Watch the input shape transform, then classify it! Is it rotation, translation, reflection, or combined?
          </p>

          {/* Challenge buttons */}
          {gamePhase === 'setup' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {TRANSFORM_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  onClick={() => startChallenge(challenge)}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.4rem 0.7rem',
                    borderRadius: '6px',
                    border: completedChallenges.has(challenge.name)
                      ? '1px solid rgba(34, 197, 94, 0.5)'
                      : '1px solid rgba(139, 92, 246, 0.4)',
                    background: completedChallenges.has(challenge.name)
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(139, 92, 246, 0.1)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                  }}
                >
                  {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                </button>
              ))}
            </div>
          )}

          {/* Active challenge - countdown and prediction */}
          {gamePhase === 'countdown' && selectedChallenge && (
            <div>
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>
                  {selectedChallenge.question}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)' }}>
                  ⏱️ Time remaining: {countdown}s
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('rotation')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '70px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #14b8a6',
                    background: prediction === 'rotation' ? 'rgba(20, 184, 166, 0.2)' : 'transparent',
                    color: '#14b8a6',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'rotation' ? 0.5 : 1,
                    fontSize: '0.75rem',
                  }}
                >
                  🔄 Rotation
                </button>
                <button
                  onClick={() => submitPrediction('translation')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '70px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    background: prediction === 'translation' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    color: '#f59e0b',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'translation' ? 0.5 : 1,
                    fontSize: '0.75rem',
                  }}
                >
                  ↔️ Translation
                </button>
                <button
                  onClick={() => submitPrediction('reflection')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '70px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #8b5cf6',
                    background: prediction === 'reflection' ? 'rgba(139, 92, 246, 0.2)' : 'transparent',
                    color: '#8b5cf6',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'reflection' ? 0.5 : 1,
                    fontSize: '0.75rem',
                  }}
                >
                  🪞 Reflection
                </button>
                <button
                  onClick={() => submitPrediction('combined')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '70px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #ef4444',
                    background: prediction === 'combined' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: '#ef4444',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'combined' ? 0.5 : 1,
                    fontSize: '0.75rem',
                  }}
                >
                  🌀 Combined
                </button>
              </div>
            </div>
          )}

          {/* Results panel */}
          {gamePhase === 'revealed' && selectedChallenge && (
            <div>
              <div style={{
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34, 197, 94, 0.4)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                padding: '0.75rem',
                borderRadius: '8px',
                marginBottom: '0.75rem',
              }}>
                <div style={{ fontSize: '0.85rem', whiteSpace: 'pre-line' }}>
                  {getTransformFeedback(prediction, selectedChallenge)}
                </div>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.8rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(139, 92, 246, 0.4)',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                ← Try Another Challenge
              </button>
            </div>
          )}
        </div>
      )}

      {/* Transform Group Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {TRANSFORM_PRESETS.map((preset) => {
          const isActive = preset.rotation !== -1 &&
            rotation === preset.rotation &&
            tx === preset.tx &&
            ty === preset.ty &&
            reflectX === preset.reflectX &&
            reflectY === preset.reflectY;
          return (
            <button
              key={preset.name}
              onClick={() => handlePreset(preset)}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '999px',
                border: isActive
                  ? '1px solid rgba(20, 184, 166, 0.7)'
                  : '1px solid rgba(75, 85, 99, 0.5)',
                background: isActive
                  ? 'rgba(20, 184, 166, 0.2)'
                  : 'rgba(15, 23, 42, 0.8)',
                color: '#e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
              }}
              title={preset.description}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.9)',
          background: reflectX || reflectY
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
            : rotation !== 0
              ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
              : tx !== 0 || ty !== 0
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
                : 'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(75, 85, 99, 0.05))',
          border: reflectX || reflectY
            ? '1px solid rgba(139, 92, 246, 0.3)'
            : rotation !== 0
              ? '1px solid rgba(20, 184, 166, 0.3)'
              : tx !== 0 || ty !== 0
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : '1px solid rgba(75, 85, 99, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      {/* Main visual panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* INPUT PANEL */}
        <div
          style={{
            background: 'radial-gradient(circle at top, rgba(15,23,42,1), rgba(15,23,42,0.2))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Input pattern</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>
              teal arrow ∈ ℝ² (position, rotation, flips)
            </span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 30% 20%, rgba(15,118,110,0.35), transparent 55%)',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'grab',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onPointerLeave={(e) => {
              if (isDragging) endDrag(e)
            }}
          >
            {/* Drag hint */}
            <div
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                fontSize: '0.7rem',
                color: COLORS.subtle,
                backgroundColor: 'rgba(15,23,42,0.85)',
                padding: '0.2rem 0.4rem',
                borderRadius: '999px',
                border: '1px solid rgba(75,85,99,0.8)',
                pointerEvents: 'none',
              }}
            >
              drag to translate
            </div>

            {/* Transformation arrows (gray) */}
            <svg
              viewBox="0 0 120 120"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.35,
                pointerEvents: 'none',
              }}
            >
              {/* horizontal arrow */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="5"
                  markerHeight="5"
                  refX="0"
                  refY="2.5"
                  orient="auto"
                >
                  <polygon points="0 0, 5 2.5, 0 5" fill={COLORS.arrows} />
                </marker>
              </defs>
              <line
                x1="15"
                y1="60"
                x2="105"
                y2="60"
                stroke={COLORS.arrows}
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              {/* vertical arrow */}
              <line
                x1="60"
                y1="105"
                x2="60"
                y2="15"
                stroke={COLORS.arrows}
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
              {/* rotation arc */}
              <path
                d="M75 40 A20 20 0 1 1 50 35"
                fill="none"
                stroke={COLORS.arrows}
                strokeWidth="2"
              />
              <polygon points="49 35, 55 37, 52 30" fill={COLORS.arrows} />
            </svg>

            {/* Arrow shape wrapper that GSAP rotates/translates */}
            <div
              ref={inputShapeRef}
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                width: 90,
                height: 90,
                transformOrigin: '50% 50%',
              }}
            >
              <svg viewBox="0 0 100 100" width="100%" height="100%">
                <polygon
                  points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                  fill="rgba(20,184,166,0.14)"
                  stroke={COLORS.input}
                  strokeWidth={4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <p style={{ fontSize: '0.8rem', color: COLORS.subtle, marginTop: '0.2rem' }}>
            We apply a group of transformations to the input: rotation, translation, and
            reflections across the x/y axes.
          </p>
        </div>

        {/* INVARIANT NETWORK PANEL */}
        <div
          style={{
            background: 'linear-gradient(140deg, rgba(15,23,42,0.9), rgba(24,24,27,0.9))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Invariant network</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>classification</span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 50% 0%, rgba(245,158,11,0.26), rgba(15,23,42,0.9))',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {/* Canonical representation of the class */}
              <div
                ref={invariantShapeRef}
                style={{
                  width: 70,
                  height: 70,
                  transformOrigin: '50% 50%',
                }}
              >
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <polygon
                    points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                    fill="rgba(245,158,11,0.16)"
                    stroke={COLORS.output}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Class logits box */}
              <div
                style={{
                  flex: 1,
                  marginLeft: '0.5rem',
                  fontSize: '0.78rem',
                  backgroundColor: 'rgba(15,23,42,0.9)',
                  borderRadius: '0.6rem',
                  padding: '0.6rem 0.7rem',
                  border: '1px solid rgba(75,85,99,0.9)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.25rem',
                    color: COLORS.subtle,
                  }}
                >
                  <span>Class scores</span>
                  <span style={{ fontSize: '0.72rem' }}>invariant</span>
                </div>
                <div style={{ display: 'grid', gap: '0.22rem' }}>
                  {['background', 'triangle', 'arrow', 'square'].map((label, idx) => {
                    const isArrow = label === 'arrow'
                    return (
                      <div
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.4rem',
                        }}
                      >
                        <div
                          style={{
                            height: 6,
                            borderRadius: '999px',
                            flex: 1,
                            background: isArrow
                              ? `linear-gradient(90deg, ${COLORS.output}, rgba(245,158,11,0.1))`
                              : 'linear-gradient(90deg, rgba(55,65,81,0.9), rgba(31,41,55,0.9))',
                            opacity: isArrow ? 1 : 0.6,
                          }}
                        />
                        <span
                          style={{
                            width: 64,
                            textAlign: 'right',
                            fontSize: '0.7rem',
                            color: isArrow ? COLORS.output : COLORS.subtle,
                          }}
                        >
                          {label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <p
              style={{
                fontSize: '0.78rem',
                color: COLORS.subtle,
                marginTop: '0.5rem',
              }}
            >
              No matter how you move the input arrow, the predicted label remains{' '}
              <span style={{ color: COLORS.output }}>“arrow”</span>. The network is{' '}
              <strong>invariant</strong> to these transforms — pose information is discarded.
            </p>
          </div>
        </div>

        {/* EQUIVARIANT NETWORK PANEL */}
        <div
          style={{
            background: 'linear-gradient(200deg, rgba(15,23,42,0.9), rgba(24,24,27,0.9))',
            borderRadius: '0.9rem',
            padding: '0.75rem 0.75rem 0.9rem',
            border: '1px solid rgba(55,65,81,0.9)',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
          }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: COLORS.subtle,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: '0.5rem',
            }}
          >
            <span>Equivariant network</span>
            <span style={{ fontSize: '0.7rem', opacity: 0.8 }}>object detection</span>
          </div>

          <div
            style={{
              position: 'relative',
              flex: 1,
              minHeight: 180,
              borderRadius: '0.75rem',
              background:
                'radial-gradient(circle at 60% 0%, rgba(245,158,11,0.26), rgba(15,23,42,0.9))',
              boxShadow: '0 10px 35px rgba(15,23,42,0.9)',
              overflow: 'hidden',
              padding: '0.75rem',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            {/* Grid to hint at feature map */}
            <svg
              viewBox="0 0 120 120"
              preserveAspectRatio="xMidYMid meet"
              style={{
                position: 'absolute',
                inset: 0,
                opacity: 0.15,
                pointerEvents: 'none',
              }}
            >
              {Array.from({ length: 5 }).map((_, i) => {
                const t = (i + 1) * (120 / 6)
                return (
                  <React.Fragment key={i}>
                    <line
                      x1={t}
                      y1={10}
                      x2={t}
                      y2={110}
                      stroke="rgba(148,163,184,0.6)"
                      strokeWidth="0.5"
                    />
                    <line
                      x1={10}
                      y1={t}
                      x2={110}
                      y2={t}
                      stroke="rgba(148,163,184,0.6)"
                      strokeWidth="0.5"
                    />
                  </React.Fragment>
                )
              })}
            </svg>

            {/* Arrow + bounding box that move equivariantly */}
            <div
              style={{
                position: 'relative',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <div
                ref={equivariantShapeRef}
                style={{
                  position: 'relative',
                  width: 90,
                  height: 90,
                  transformOrigin: '50% 50%',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: '-10%',
                    borderRadius: '0.6rem',
                    border: `1.5px solid ${COLORS.output}`,
                    boxShadow: '0 0 0 1px rgba(15,23,42,0.9)',
                  }}
                />
                <svg viewBox="0 0 100 100" width="100%" height="100%">
                  <polygon
                    points="50,10 90,50 70,50 70,90 30,90 30,50 10,50"
                    fill="rgba(245,158,11,0.16)"
                    stroke={COLORS.output}
                    strokeWidth={4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* Pose + detection style readout */}
            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.78rem',
                display: 'grid',
                gap: '0.25rem',
                zIndex: 2,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  color: COLORS.subtle,
                }}
              >
                <span>Detection head (equivariant)</span>
                <span style={{ fontSize: '0.72rem' }}>bounding box + class + pose</span>
              </div>
              <div
                style={{
                  borderRadius: '0.6rem',
                  border: '1px solid rgba(75,85,99,0.9)',
                  backgroundColor: 'rgba(15,23,42,0.9)',
                  padding: '0.4rem 0.55rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.25rem',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.76rem',
                  }}
                >
                  <span style={{ color: COLORS.output }}>class: arrow</span>
                  <span style={{ color: COLORS.subtle }}>equivariant features</span>
                </div>
                <div
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.72rem',
                    color: COLORS.text,
                    opacity: 0.9,
                  }}
                >
                  {poseSummary}
                </div>
              </div>
              <p style={{ fontSize: '0.78rem', color: COLORS.subtle }}>
                When the input moves, the predicted{' '}
                <span style={{ color: COLORS.output }}>bounding box</span> and pose move
                with it. The mapping is <strong>equivariant</strong>: transforms of the
                input induce matching transforms of the output.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '0.9rem',
          borderTop: '1px solid rgba(55,65,81,0.9)',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.2fr) minmax(0, 1.1fr)',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {/* Rotation */}
          <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
            <span
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: COLORS.subtle,
              }}
            >
              <span>Rotation</span>
              <span>{rotation.toFixed(0)}°</span>
            </span>
            <input
              type="range"
              min={0}
              max={360}
              value={rotation}
              onChange={(e) => setRotation(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>

          {/* Translation sliders */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: '0.75rem',
            }}
          >
            <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: COLORS.subtle,
                }}
              >
                <span>Translate X</span>
                <span>{tx.toFixed(0)} px</span>
              </span>
              <input
                type="range"
                min={-MAX_TRANSLATE}
                max={MAX_TRANSLATE}
                value={tx}
                onChange={(e) => setTx(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ fontSize: '0.8rem', display: 'grid', gap: '0.25rem' }}>
              <span
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: COLORS.subtle,
                }}
              >
                <span>Translate Y</span>
                <span>{ty.toFixed(0)} px</span>
              </span>
              <input
                type="range"
                min={-MAX_TRANSLATE}
                max={MAX_TRANSLATE}
                value={ty}
                onChange={(e) => setTy(Number(e.target.value))}
                style={{ width: '100%' }}
              />
            </label>
          </div>
        </div>

        {/* Reflection + reset + legend */}
        <div
          style={{
            display: 'grid',
            gap: '0.6rem',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setReflectX((v) => !v)}
              style={{
                flex: 1,
                padding: '0.45rem 0.7rem',
                borderRadius: '999px',
                border: `1px solid ${
                  reflectX ? COLORS.input : 'rgba(75,85,99,0.9)'
                }`,
                backgroundColor: reflectX
                  ? 'rgba(20,184,166,0.1)'
                  : 'rgba(15,23,42,0.9)',
                color: reflectX ? COLORS.input : COLORS.subtle,
              }}
            >
              Flip across x‑axis
            </button>
            <button
              type="button"
              onClick={() => setReflectY((v) => !v)}
              style={{
                flex: 1,
                padding: '0.45rem 0.7rem',
                borderRadius: '999px',
                border: `1px solid ${
                  reflectY ? COLORS.input : 'rgba(75,85,99,0.9)'
                }`,
                backgroundColor: reflectY
                  ? 'rgba(20,184,166,0.1)'
                  : 'rgba(15,23,42,0.9)',
                color: reflectY ? COLORS.input : COLORS.subtle,
              }}
            >
              Flip across y‑axis
            </button>
          </div>

          <button
            type="button"
            onClick={handleReset}
            style={{
              justifySelf: 'flex-start',
              padding: '0.35rem 0.8rem',
              borderRadius: '999px',
              border: '1px solid rgba(75,85,99,0.9)',
              backgroundColor: 'transparent',
              color: COLORS.subtle,
              fontSize: '0.78rem',
            }}
          >
            Reset transform
          </button>

          <p style={{ color: COLORS.subtle, fontSize: '0.78rem' }}>
            <span style={{ color: COLORS.input }}>Equivariance</span> preserves pose
            information and is ideal for tasks like{' '}
            <span style={{ color: COLORS.output }}>object detection</span>.{' '}
            <span style={{ color: COLORS.output }}>Invariance</span> throws away pose but
            simplifies decisions for tasks like image{' '}
            <span style={{ color: COLORS.output }}>classification</span>.
          </p>
        </div>
      </div>
    </section>
  )
}
