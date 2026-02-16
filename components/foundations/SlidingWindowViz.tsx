'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { scaleLinear } from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'

const BACKGROUND = '#080c14'

// Toy visualization parameters
const DEFAULT_SEQ_LEN = 64            // visual "tokens" on each axis
const MIN_WINDOW_CELLS = 4
const MAX_WINDOW_CELLS = 32

const MAX_LAYERS = 32
const DEFAULT_WINDOW_CELLS = 32       // 32 visual cells * 128 tokens = 4096
const DEFAULT_LAYERS = 4

// Each visual token ≈ 128 real tokens so 32 cells ≈ 4096 tokens
const TOKENS_PER_CELL = 128

type AttentionMode = 'full' | 'sliding'

// Model-based window presets
const WINDOW_PRESETS = [
  { name: '🏃 Tiny', windowCells: 4, layers: 2, description: 'Minimal window (512 tokens), local only' },
  { name: '💬 GPT-2-style', windowCells: 8, layers: 12, description: '1024-token context, classic transformer' },
  { name: '🦙 Llama-style', windowCells: 16, layers: 24, description: '2048-token attention window' },
  { name: '🌊 Mistral', windowCells: 32, layers: 32, description: '4096 × 32 = 128K effective context' },
  { name: '🚀 Maximum', windowCells: 32, layers: 32, description: 'Full slider range exploration' },
];

// ===== Gamification Types =====
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SavingsPrediction = '2×' | '4×' | '8×' | '16×' | '32×' | null

interface SavingsChallenge {
  name: string
  windowCells: number
  seqLen: number
  hint: string
  explanation: string
}

const SAVINGS_CHALLENGES: SavingsChallenge[] = [
  {
    name: '🎲 Mystery A',
    windowCells: 32,
    seqLen: 64,
    hint: 'A long sequence with a modest window size...',
    explanation: '✅ 2× savings! With window = 32 and sequence = 64, complexity is O(64×32) = 2048 vs O(64²) = 4096. Half the compute! Not dramatic, but meaningful at scale.',
  },
  {
    name: '🎲 Mystery B',
    windowCells: 16,
    seqLen: 64,
    hint: 'A smaller window relative to sequence length...',
    explanation: '🎯 4× savings! Sliding window O(64×16) = 1024 vs full O(64²) = 4096. The savings grow as window shrinks relative to sequence length.',
  },
  {
    name: '🎲 Mystery C',
    windowCells: 8,
    seqLen: 64,
    hint: 'An even smaller window - like early efficient transformers...',
    explanation: '💰 8× savings! Sliding window O(64×8) = 512 vs full O(64²) = 4096. This is why Longformer and BigBird could handle much longer sequences!',
  },
  {
    name: '🎲 Mystery D',
    windowCells: 4,
    seqLen: 64,
    hint: 'A tiny local window - extreme efficiency...',
    explanation: '🚀 16× savings! Sliding window O(64×4) = 256 vs full O(64²) = 4096. The key insight: savings = seqLen/windowSize. Longer sequences → more savings!',
  },
]

function getSavingsFeedback(
  prediction: SavingsPrediction,
  challenge: SavingsChallenge
): { correct: boolean; message: string } {
  if (!prediction) {
    return { correct: false, message: '❓ No prediction made' }
  }

  // Calculate actual savings
  const fullComplexity = challenge.seqLen * challenge.seqLen
  const slidingComplexity = challenge.seqLen * challenge.windowCells
  const actualSavings = Math.round(fullComplexity / slidingComplexity)

  // Map prediction to number
  const predictionValue = parseInt(prediction.replace('×', ''), 10)

  if (predictionValue === actualSavings) {
    return { correct: true, message: challenge.explanation }
  }

  return {
    correct: false,
    message: `❌ Close! The actual savings was ${actualSavings}×. ${challenge.explanation}`,
  }
}

// Dynamic educational insight
function getSlidingWindowInsight(
  windowCells: number,
  numLayers: number,
  effectiveTokens: number,
  savingsFactor: number,
  activeLayer: number
): string {
  const windowTokens = windowCells * 128; // TOKENS_PER_CELL

  if (savingsFactor > 10) {
    return `💰 MASSIVE SAVINGS! Sliding window uses ${savingsFactor.toFixed(0)}× less memory than full attention. This is how Mistral processes 128K+ tokens without running out of VRAM!`;
  }

  if (numLayers === 1) {
    return `⚠️ With only 1 layer, the effective context = window size (${windowTokens.toLocaleString()} tokens). No layer stacking = no long-range propagation. Add more layers!`;
  }

  if (windowCells <= 4 && numLayers >= 8) {
    return `🔬 Tiny window (${windowTokens} tokens) with ${numLayers} layers! Information can still flow far, but it takes many hops. Each layer can only see ${windowTokens} tokens back.`;
  }

  if (effectiveTokens >= 100000) {
    return `🌟 ${effectiveTokens.toLocaleString()}-token effective context! Layer ${activeLayer} can "see" ${Math.min(activeLayer * windowTokens, effectiveTokens).toLocaleString()} tokens back. This is how modern LLMs handle long documents.`;
  }

  if (activeLayer === numLayers) {
    return `📡 At layer ${numLayers} (final), the full receptive field spans ${effectiveTokens.toLocaleString()} tokens. Information from the start of the sequence has propagated to the final token!`;
  }

  return `📊 Window: ${windowTokens.toLocaleString()} tokens × ${numLayers} layers = ${effectiveTokens.toLocaleString()} effective context. Layer ${activeLayer} reaches ${Math.min(activeLayer * windowTokens, effectiveTokens).toLocaleString()} tokens back.`;
}

interface SlidingWindowAttentionProps {
  seqLen?: number
}

const SlidingWindowAttentionDemo: React.FC<SlidingWindowAttentionProps> = ({
  seqLen = DEFAULT_SEQ_LEN,
}) => {
  const [windowSizeCells, setWindowSizeCells] = useState<number>(DEFAULT_WINDOW_CELLS)
  const [numLayers, setNumLayers] = useState<number>(DEFAULT_LAYERS)
  const [activeLayer, setActiveLayer] = useState<number>(1)
  const [autoPlay, setAutoPlay] = useState<boolean>(true)

  // ===== Game State =====
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0)
  const [prediction, setPrediction] = useState<SavingsPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set())

  const currentChallenge = SAVINGS_CHALLENGES[currentChallengeIdx]
  const gameFeedback = gamePhase === 'revealed' && currentChallenge
    ? getSavingsFeedback(prediction, currentChallenge)
    : null

  // ===== Game Control Functions =====
  const startChallenge = (idx: number) => {
    setCurrentChallengeIdx(idx)
    setPrediction(null)
    setGamePhase('setup')
    setGameMode(true)
    setAutoPlay(false)
    // Set window size to mystery value
    const challenge = SAVINGS_CHALLENGES[idx]
    setWindowSizeCells(challenge.windowCells)
    setNumLayers(4) // Default layers
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
    setWindowSizeCells(DEFAULT_WINDOW_CELLS)
    setNumLayers(DEFAULT_LAYERS)
    setAutoPlay(true)
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
    if (currentChallenge && gameFeedback?.correct) {
      setScore(s => s + 1)
      setCompletedChallenges(prev => new Set([...prev, currentChallengeIdx]))
    }
  }, [gamePhase, countdown, currentChallenge, currentChallengeIdx, gameFeedback?.correct])

  const targetIndex = seqLen - 1

  // Keep activeLayer in range when numLayers changes
  useEffect(() => {
    if (activeLayer > numLayers) {
      setActiveLayer(numLayers)
    }
  }, [numLayers, activeLayer])

  // Simple autoplay for the propagation animation
  useEffect(() => {
    if (!autoPlay || numLayers <= 0) return

    const id = window.setInterval(() => {
      setActiveLayer((prev) => (prev >= numLayers ? 1 : prev + 1))
    }, 1000)

    return () => window.clearInterval(id)
  }, [autoPlay, numLayers])

  const windowTokens = windowSizeCells * TOKENS_PER_CELL
  const effectiveContextTokens = numLayers * windowTokens
  const _approximateK = effectiveContextTokens / 1024
  const seqTokens = seqLen * TOKENS_PER_CELL
  const clampedEffective = Math.min(effectiveContextTokens, seqTokens)

  // Calculate savings factor early for insight
  const fullComplexity = seqLen * seqLen
  const slidingComplexity = seqLen * windowSizeCells
  const savingsFactor = slidingComplexity > 0 ? fullComplexity / slidingComplexity : 1

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getSlidingWindowInsight(
      windowSizeCells,
      numLayers,
      effectiveContextTokens,
      savingsFactor,
      activeLayer
    );
  }, [windowSizeCells, numLayers, effectiveContextTokens, savingsFactor, activeLayer]);

  // Handle preset selection
  const handlePreset = (preset: typeof WINDOW_PRESETS[0]) => {
    setWindowSizeCells(preset.windowCells);
    setNumLayers(preset.layers);
    setActiveLayer(1);
    setAutoPlay(true);
  };

  const propagationRanges = useMemo(
    () =>
      Array.from({ length: numLayers }, (_, i) => {
        const layer = i + 1
        const spanCells = layer * windowSizeCells
        const start = Math.max(0, targetIndex - spanCells + 1)
        const end = targetIndex
        return { layer, start, end }
      }),
    [numLayers, windowSizeCells, targetIndex]
  )

  const mistralEffective = 32 * 4096 // 131072

  return (
    <section
      className="card interactive-card"
      style={{
        background: BACKGROUND,
        color: '#e5e7eb',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <header>
        <h2 style={{ fontSize: '1.25rem', marginBottom: 4 }}>
          Sliding Window Attention Explorer
        </h2>
        <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
          Compare full quadratic attention to a local sliding window, and see
          how stacked layers propagate information over long ranges.
        </p>
      </header>

      {/* ===== Game Mode Panel ===== */}
      <div
        style={{
          padding: '0.75rem',
          borderRadius: '8px',
          marginBottom: '0.5rem',
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
              🎯 Try Savings Quiz
            </button>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Predict memory savings from window size!
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
                  Score: {score}/{SAVINGS_CHALLENGES.length}
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
              {SAVINGS_CHALLENGES.map((ch, idx) => (
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
                      Window = {currentChallenge.windowCells} cells, Sequence = {currentChallenge.seqLen} cells. How much memory does sliding window save vs full attention?
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {(['2×', '4×', '8×', '16×', '32×'] as const).map((savings) => (
                        <button
                          key={savings}
                          type="button"
                          onClick={() => setPrediction(savings)}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            border: prediction === savings
                              ? '1px solid rgba(251, 191, 36, 0.8)'
                              : '1px solid rgba(75, 85, 99, 0.5)',
                            background: prediction === savings
                              ? 'rgba(251, 191, 36, 0.2)'
                              : 'rgba(15, 23, 42, 0.8)',
                            color: prediction === savings ? '#fbbf24' : '#e5e7eb',
                            cursor: 'pointer',
                          }}
                        >
                          {savings}
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
                    {currentChallengeIdx < SAVINGS_CHALLENGES.length - 1 && (
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
                    {completedChallenges.size === SAVINGS_CHALLENGES.length && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(251, 191, 36, 0.2)', borderRadius: '6px' }}>
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                          🏆 All challenges complete! You understand O(L×W) vs O(L²)!
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

      {/* Model Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.5rem' }}>
        {WINDOW_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            style={{
              fontSize: '0.8rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: windowSizeCells === preset.windowCells && numLayers === preset.layers
                ? '1px solid rgba(20, 184, 166, 0.7)'
                : '1px solid rgba(148, 163, 184, 0.35)',
              background: windowSizeCells === preset.windowCells && numLayers === preset.layers
                ? 'rgba(20, 184, 166, 0.25)'
                : 'rgba(15, 23, 42, 0.8)',
              color: windowSizeCells === preset.windowCells && numLayers === preset.layers
                ? '#5eead4'
                : '#e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderRadius: '10px',
          marginBottom: '0.5rem',
          fontSize: '0.88rem',
          lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.9)',
          background: savingsFactor > 10
            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.05))'
            : currentInsight.includes('⚠️')
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
          border: savingsFactor > 10
            ? '1px solid rgba(52, 211, 153, 0.3)'
            : currentInsight.includes('⚠️')
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      {/* Controls */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label className="slider-label" style={{ fontSize: '0.85rem' }}>
            Window size W (visual cells)
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 4,
              }}
            >
              <input
                type="range"
                min={MIN_WINDOW_CELLS}
                max={MAX_WINDOW_CELLS}
                step={1}
                value={windowSizeCells}
                onChange={(e) =>
                  setWindowSizeCells(parseInt(e.target.value, 10))
                }
                style={{ flex: 1 }}
              />
              <span
                style={{
                  minWidth: 64,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.85rem',
                }}
              >
                {windowSizeCells} cells
              </span>
            </div>
            <div
              style={{
                marginTop: 4,
                fontSize: '0.8rem',
                color: '#9ca3af',
              }}
            >
              Each cell ≈ {TOKENS_PER_CELL} tokens, so W ≈{' '}
              {windowTokens.toLocaleString()} tokens.
            </div>
          </label>

          <label className="slider-label" style={{ fontSize: '0.85rem' }}>
            Number of layers L
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                marginTop: 4,
              }}
            >
              <input
                type="range"
                min={1}
                max={MAX_LAYERS}
                step={1}
                value={numLayers}
                onChange={(e) => setNumLayers(parseInt(e.target.value, 10))}
                style={{ flex: 1 }}
              />
              <span
                style={{
                  minWidth: 64,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: '0.85rem',
                }}
              >
                {numLayers} layers
              </span>
            </div>
          </label>
        </div>

        <div
          style={{
            borderRadius: 10,
            padding: 10,
            background:
              'radial-gradient(circle at top left, rgba(8,145,178,0.35), transparent 55%), rgba(15,23,42,0.95)',
            border: '1px solid rgba(148,163,184,0.35)',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Effective receptive field</strong>
          </div>
          <div
            style={{
              fontVariantNumeric: 'tabular-nums',
              marginBottom: 4,
            }}
          >
            L × W = {numLayers.toLocaleString()} ×{' '}
            {windowTokens.toLocaleString()} ≈{' '}
            {effectiveContextTokens.toLocaleString()} tokens
            {effectiveContextTokens > seqTokens && (
              <>
                {' '}
                (clamped to visible sequence ≈{' '}
                {clampedEffective.toLocaleString()})
              </>
            )}
          </div>
          <div style={{ color: '#9ca3af' }}>
            Mistral-style example: W = 4096, L = 32 ⇒{' '}
            {mistralEffective.toLocaleString()} ≈ 128K effective tokens.
          </div>
          <button
            type="button"
            onClick={() => {
              setWindowSizeCells(DEFAULT_WINDOW_CELLS)
              setNumLayers(32)
              setActiveLayer(1)
              setAutoPlay(true)
            }}
            style={{
              marginTop: 8,
              fontSize: '0.78rem',
              padding: '4px 8px',
              borderRadius: 999,
              border: '1px solid rgba(148,163,184,0.6)',
              background: 'rgba(15,23,42,0.8)',
              cursor: 'pointer',
            }}
          >
            Load “Mistral-ish” preset (W≈4096, L=32)
          </button>
        </div>
      </div>

      {/* Attention matrices: full vs sliding window */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        <AttentionMatrixView
          title="Full attention (O(L²))"
          subtitle="Each token attends to all previous tokens."
          mode="full"
          seqLen={seqLen}
        />
        <AttentionMatrixView
          title="Sliding window attention (O(L×W))"
          subtitle="Each token attends only to a fixed-width window."
          mode="sliding"
          seqLen={seqLen}
          windowSizeCells={windowSizeCells}
        />
      </div>

      {/* Info propagation animation */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <LayerPropagationView
          seqLen={seqLen}
          targetIndex={targetIndex}
          ranges={propagationRanges}
          activeLayer={activeLayer}
        />
        <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
          <div style={{ marginBottom: 6 }}>
            <strong>How long-range information propagates</strong>
          </div>
          <p style={{ marginBottom: 6 }}>
            Each layer can only “see” a local window of size W. But the result
            of one layer becomes input to the next, so information from tokens
            farther and farther in the past can flow forward.
          </p>
          <p style={{ marginBottom: 6 }}>
            In the diagram, we track which earlier tokens can ultimately
            influence the <span style={{ color: MATH_COLORS.secondary }}>
              last token
            </span>{' '}
            after each layer. As layers stack, the orange band grows by
            roughly W tokens per layer.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 8,
            }}
          >
            <button
              type="button"
              onClick={() => setAutoPlay((v) => !v)}
              style={{
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid rgba(148,163,184,0.6)',
                background: autoPlay
                  ? 'rgba(34,197,94,0.12)'
                  : 'rgba(15,23,42,0.8)',
                cursor: 'pointer',
              }}
            >
              {autoPlay ? 'Pause animation' : 'Play animation'}
            </button>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              Layer {activeLayer} reach ≈{' '}
              {Math.min(activeLayer * windowTokens, seqTokens).toLocaleString()}{' '}
              tokens back
            </span>
          </div>
        </div>
      </div>

      {/* Memory / complexity comparison */}
      <MemoryBarChart
        seqLen={seqLen}
        windowSizeCells={windowSizeCells}
        fullComplexity={fullComplexity}
        slidingComplexity={slidingComplexity}
        savingsFactor={savingsFactor}
      />

      <footer
        style={{
          marginTop: 4,
          fontSize: '0.78rem',
          color: '#6b7280',
        }}
      >
        In practice, models like Mistral use sliding-window attention with
        relatively large windows (e.g. W = 4096). Stacking many layers lets
        information propagate across very long contexts without paying the
        full O(L²) memory cost at each layer.
      </footer>
    </section>
  )
}

// ---------- Attention matrix (full vs sliding window) ----------

interface AttentionMatrixViewProps {
  title: string
  subtitle: string
  mode: AttentionMode
  seqLen: number
  windowSizeCells?: number
}

const AttentionMatrixView: React.FC<AttentionMatrixViewProps> = ({
  title,
  subtitle,
  mode,
  seqLen,
  windowSizeCells = MIN_WINDOW_CELLS,
}) => {
  const width = 260
  const height = 260

  const cellW = width / seqLen
  const cellH = height / seqLen

  const cells = useMemo(() => {
    const result: JSX.Element[] = []

    for (let q = 0; q < seqLen; q++) {
      for (let k = 0; k <= q; k++) {
        let insideWindow = true
        if (mode === 'sliding' && k < q - windowSizeCells + 1) {
          insideWindow = false
        }

        if (mode === 'sliding' && !insideWindow) {
          // Draw a very faint background cell to hint at the “missing” attention
          const x = k * cellW
          const y = q * cellH
          result.push(
            <rect
              key={`${q}-${k}-off`}
              x={x}
              y={y}
              width={cellW + 0.5}
              height={cellH + 0.5}
              fill="rgba(15,23,42,0.9)"
            />
          )
          continue
        }

        const dist = q - k
        const maxDist =
          mode === 'sliding'
            ? Math.max(1, Math.min(windowSizeCells - 1, q))
            : Math.max(1, q)
        const t = 1 - dist / (maxDist + 1) // closer tokens -> larger weight
        const weight = Math.max(0.1, t)

        const alpha = 0.15 + weight * 0.85
        const fill = `rgba(245, 158, 11, ${alpha.toFixed(3)})`

        const x = k * cellW
        const y = q * cellH
        const isBoundary =
          mode === 'sliding' &&
          k === Math.max(0, q - windowSizeCells + 1) &&
          q > 0

        result.push(
          <rect
            key={`${q}-${k}`}
            x={x}
            y={y}
            width={cellW + 0.5}
            height={cellH + 0.5}
            fill={fill}
            stroke={isBoundary ? MATH_COLORS.secondary : 'none'}
            strokeWidth={isBoundary ? 0.8 : 0}
          />
        )
      }
    }

    return result
  }, [seqLen, mode, windowSizeCells, cellW, cellH])

  return (
    <div
      style={{
        background: 'rgba(15,23,42,0.9)',
        borderRadius: 10,
        padding: 10,
        border: '1px solid rgba(31,41,55,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.9rem',
            marginBottom: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <span>{title}</span>
          <span
            style={{
              fontSize: '0.75rem',
              color: mode === 'full' ? '#f97316' : MATH_COLORS.secondary,
            }}
          >
            {mode === 'full' ? 'expensive' : 'cheap'}
          </span>
        </div>
        <p style={{ fontSize: '0.78rem', color: '#9ca3af' }}>{subtitle}</p>
      </div>
      <div style={{ position: 'relative' }}>
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={`${title} attention pattern`}
          style={{
            borderRadius: 8,
            background:
              'linear-gradient(135deg, rgba(15,23,42,1), rgba(8,47,73,1))',
          }}
        >
          {/* Cells */}
          {cells}

          {/* Axes labels */}
          <text
            x={width / 2}
            y={height - 4}
            textAnchor="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            Keys (past tokens)
          </text>
          <text
            x={10}
            y={height / 2}
            transform={`rotate(-90 10 ${height / 2})`}
            textAnchor="middle"
            fontSize={10}
            fill="#9ca3af"
          >
            Queries (current tokens)
          </text>
        </svg>
      </div>
    </div>
  )
}

// ---------- Layer-wise propagation view ----------

interface LayerPropagationViewProps {
  seqLen: number
  targetIndex: number
  ranges: { layer: number; start: number; end: number }[]
  activeLayer: number
}

const LayerPropagationView: React.FC<LayerPropagationViewProps> = ({
  seqLen,
  targetIndex,
  ranges,
  activeLayer,
}) => {
  const width = 420
  const height = 150

  const numLayers = ranges.length || 1
  const cellW = width / seqLen
  const cellH = height / numLayers

  const tokens = useMemo(
    () => Array.from({ length: seqLen }, (_, i) => i),
    [seqLen]
  )

  return (
    <div>
      <div
        style={{
          marginBottom: 4,
          fontSize: '0.9rem',
        }}
      >
        Layer-wise effective receptive field
      </div>
      <svg
        width={width}
        height={height}
        role="img"
        aria-label="Layer-wise propagation of information through sliding-window attention"
        style={{
          borderRadius: 8,
          background:
            'linear-gradient(135deg, rgba(12,10,9,1), rgba(15,23,42,1))',
          border: '1px solid rgba(31,41,55,1)',
        }}
      >
        {/* Rows: one per layer */}
        {ranges.map((range) => {
          const y = (range.layer - 1) * cellH
          const isActive = range.layer === activeLayer

          return (
            <g key={range.layer}>
              {tokens.map((t) => {
                const x = t * cellW
                const inReach = t >= range.start && t <= range.end
                const isTarget = t === targetIndex
                const isBoundary = t === range.start && inReach

                const baseFill = inReach
                  ? isActive
                    ? `rgba(245,158,11,0.95)`
                    : `rgba(245,158,11,0.45)`
                  : `rgba(15,23,42,0.9)`

                const strokeColor = isTarget
                  ? MATH_COLORS.secondary
                  : isBoundary
                  ? MATH_COLORS.secondary
                  : 'none'

                const strokeWidth = isTarget ? 1.5 : isBoundary ? 1 : 0

                return (
                  <rect
                    key={`${range.layer}-${t}`}
                    x={x}
                    y={y}
                    width={cellW + 0.5}
                    height={cellH + 0.5}
                    fill={baseFill}
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    opacity={range.layer <= activeLayer ? 1 : 0.25}
                  />
                )
              })}

              {/* Layer label */}
              <text
                x={4}
                y={y + cellH / 2 + 3}
                fontSize={9}
                fill="#9ca3af"
              >
                L{range.layer}
              </text>
            </g>
          )
        })}

        {/* token index ticks along x axis */}
        {tokens.filter((t) => t % 8 === 0 || t === seqLen - 1).map((t) => {
          const x = (t + 0.5) * cellW
          return (
            <text
              key={`tick-${t}`}
              x={x}
              y={height - 2}
              fontSize={8}
              fill="#9ca3af"
              textAnchor="middle"
            >
              {t}
            </text>
          )
        })}

        {/* Axis labels */}
        <text
          x={width / 2}
          y={10}
          fontSize={10}
          fill="#9ca3af"
          textAnchor="middle"
        >
          Earlier tokens → (rightmost is the current/last token)
        </text>
      </svg>
    </div>
  )
}

// ---------- Memory / complexity bar chart (uses D3 scaleLinear) ----------

interface MemoryBarChartProps {
  seqLen: number
  windowSizeCells: number
  fullComplexity: number
  slidingComplexity: number
  savingsFactor: number
}

const MemoryBarChart: React.FC<MemoryBarChartProps> = ({
  seqLen,
  windowSizeCells: _windowSizeCells,
  fullComplexity,
  slidingComplexity,
  savingsFactor,
}) => {
  const width = 420
  const height = 160
  const padding = { top: 20, right: 16, bottom: 40, left: 40 }

  const data = [
    {
      name: 'Full attention',
      detail: 'O(L²)',
      value: fullComplexity,
      color: `rgba(245,158,11,0.85)`,
    },
    {
      name: 'Sliding window',
      detail: 'O(L×W)',
      value: slidingComplexity,
      color: `rgba(20,184,166,0.9)`,
    },
  ]

  const maxValue = Math.max(...data.map((d) => d.value), 1)
  const yScale = scaleLinear()
    .domain([0, maxValue])
    .range([0, height - padding.top - padding.bottom])

  const barWidth = (width - padding.left - padding.right) / data.length - 24

  return (
    <div
      style={{
        borderRadius: 10,
        padding: 10,
        background:
          'linear-gradient(135deg, rgba(15,23,42,1), rgba(24,24,27,1))',
        border: '1px solid rgba(31,41,55,1)',
      }}
    >
      <div
        style={{
          fontSize: '0.9rem',
          marginBottom: 2,
        }}
      >
        Memory / compute comparison
      </div>
      <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: 8 }}>
        For a sequence of length L = {seqLen}, full attention stores a dense
        L×L matrix. Sliding-window attention only stores L×W entries, where W
        is the window size.
      </p>
      <svg width={width} height={height} role="img" aria-label="Memory comparison: full attention L×L matrix vs sliding window L×W entries">
        {/* Axes baseline */}
        <line
          x1={padding.left}
          y1={height - padding.bottom}
          x2={width - padding.right}
          y2={height - padding.bottom}
          stroke="rgba(55,65,81,1)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const barHeight = yScale(d.value)
          const x =
            padding.left +
            i * (barWidth + 32) +
            16
          const y = height - padding.bottom - barHeight

          return (
            <g key={d.name}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={d.color}
                rx={6}
              />
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 14}
                fontSize={10}
                fill="#e5e7eb"
                textAnchor="middle"
              >
                {d.name}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 26}
                fontSize={9}
                fill="#9ca3af"
                textAnchor="middle"
              >
                {d.detail}
              </text>
            </g>
          )
        })}

        {/* Y-axis label */}
        <text
          x={14}
          y={height / 2}
          fontSize={10}
          fill="#9ca3af"
          textAnchor="middle"
          transform={`rotate(-90 14 ${height / 2})`}
        >
          entries ∝ memory / FLOPs
        </text>
      </svg>
      <div
        style={{
          fontSize: '0.78rem',
          color: '#9ca3af',
          marginTop: 4,
        }}
      >
        With these settings, sliding-window attention uses roughly{' '}
        <span style={{ color: MATH_COLORS.secondary }}>
          {savingsFactor.toFixed(1)}×
        </span>{' '}
        fewer attention entries than full attention (for the same sequence
        length).
      </div>
    </div>
  )
}

export default SlidingWindowAttentionDemo
