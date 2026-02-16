'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { scaleLinear } from 'd3'
import { MATH_COLORS } from '../../../lib/mathObjects'

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

// ─────────────────────────────────────────────────────────────
// Gamification: "Window Challenge" – predict sliding window behavior
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SlidingWindowPrediction = 'A' | 'B' | 'C' | null

interface SlidingWindowChallenge {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  answer: 'A' | 'B' | 'C'
  insight: string
}

const SLIDING_WINDOW_CHALLENGES: SlidingWindowChallenge[] = [
  {
    name: '🎲 Complexity Class',
    question: 'Why is sliding window attention O(L×W) instead of O(L²)?',
    optionA: 'Each token only stores W key-value pairs instead of all L',
    optionB: 'The window slides so some computations are shared',
    optionC: 'GPUs can parallelize window operations better',
    answer: 'A',
    insight: 'Each query only attends to W keys instead of all L previous tokens. So for L queries, we do L×W attention computations and store L×W KV entries. This is LINEAR in sequence length when W is fixed!'
  },
  {
    name: '🎲 Propagation Depth',
    question: 'With W=4096 tokens and L=32 layers, how far back can information flow to the last token?',
    optionA: '4096 tokens (limited by single window)',
    optionB: '~131K tokens (L × W)',
    optionC: 'Unlimited (information propagates infinitely)',
    answer: 'B',
    insight: 'Each layer extends the receptive field by W tokens. After L layers, token t can receive information from tokens as far back as t - L×W. With L=32, W=4096: effective context = 131,072 tokens. This is Mistral\'s core insight!'
  },
  {
    name: '🎲 Failure Mode',
    question: 'When might sliding window attention FAIL compared to full attention?',
    optionA: 'When the sequence is shorter than the window size',
    optionB: 'When important information is farther than L×W tokens away',
    optionC: 'When running on TPUs instead of GPUs',
    answer: 'B',
    insight: 'If a critical piece of information (like instructions at the start of a 200K context) is beyond the L×W effective receptive field, the model literally cannot access it. This is why some tasks need full attention or very deep networks.'
  },
  {
    name: '🎲 Memory Savings',
    question: 'For a 32K sequence with window size 4K, roughly how much memory does sliding window save?',
    optionA: '~2× less memory',
    optionB: '~8× less memory',
    optionC: '~32× less memory',
    answer: 'B',
    insight: 'Full attention: 32K × 32K = 1B entries. Sliding window: 32K × 4K = 128M entries. That\'s 1B/128M = 8× savings! The savings factor equals L/W when L >> W. This enables fitting much longer sequences in GPU memory.'
  }
]

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

  // ─── Game state ───
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallengeIdx, setActiveChallengeIdx] = useState<number | null>(null)
  const [prediction, setPrediction] = useState<SlidingWindowPrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  const activeChallenge = activeChallengeIdx !== null ? SLIDING_WINDOW_CHALLENGES[activeChallengeIdx] : null

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

  // ─── Game control functions ───
  const startChallenge = (idx: number) => {
    setActiveChallengeIdx(idx)
    setPrediction(null)
    setGamePhase('setup')
    setCountdown(3)
  }

  const submitPrediction = (choice: 'A' | 'B' | 'C') => {
    setPrediction(choice)
    setGamePhase('countdown')
    setCountdown(3)
  }

  const resetGame = () => {
    setActiveChallengeIdx(null)
    setPrediction(null)
    setGamePhase('setup')
    setCountdown(3)
    setScore({ correct: 0, total: 0 })
  }

  // ─── Countdown effect ───
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      if (activeChallenge && prediction === activeChallenge.answer) {
        setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }))
      } else {
        setScore((s) => ({ ...s, total: s.total + 1 }))
      }
      return
    }
    const tid = window.setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => window.clearTimeout(tid)
  }, [gamePhase, countdown, activeChallenge, prediction])

  const windowTokens = windowSizeCells * TOKENS_PER_CELL
  const effectiveContextTokens = numLayers * windowTokens
  const _approximateK = effectiveContextTokens / 1024
  const seqTokens = seqLen * TOKENS_PER_CELL
  const clampedEffective = Math.min(effectiveContextTokens, seqTokens)

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

  const fullComplexity = seqLen * seqLen
  const slidingComplexity = seqLen * windowSizeCells
  const savingsFactor =
    slidingComplexity > 0 ? fullComplexity / slidingComplexity : 1

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
            Load "Mistral-ish" preset (W≈4096, L=32)
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
            Each layer can only "see" a local window of size W. But the result
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

      {/* ─────────────────────────────────────────────────────────────
          GAME PANEL: Window Challenge
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(24,24,27,0.95))',
        border: '1px solid rgba(148,163,184,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>🎮 Window Challenge</h3>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
            {score.total > 0 && (
              <button
                onClick={resetGame}
                style={{
                  marginLeft: 8,
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: 'rgba(15,23,42,0.8)',
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Challenge selection */}
        {activeChallengeIdx === null && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 10 }}>
              Test your understanding of sliding window attention:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {SLIDING_WINDOW_CHALLENGES.map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => startChallenge(idx)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(245,158,11,0.5)',
                    background: 'rgba(245,158,11,0.1)',
                    color: '#f59e0b',
                    cursor: 'pointer'
                  }}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active challenge */}
        {activeChallenge && gamePhase === 'setup' && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: 12, color: '#e5e7eb' }}>
              {activeChallenge.question}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['A', 'B', 'C'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => submitPrediction(opt)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(15,23,42,0.9)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <strong>{opt}.</strong>{' '}
                  {opt === 'A' ? activeChallenge.optionA : opt === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveChallengeIdx(null)}
              style={{
                marginTop: 10,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'transparent',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              ← Back to challenges
            </button>
          </div>
        )}

        {/* Countdown */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#f59e0b' }}>
              {countdown}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Your prediction: <strong>{prediction}</strong>
            </p>
          </div>
        )}

        {/* Revealed */}
        {gamePhase === 'revealed' && activeChallenge && (
          <div>
            <div style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
              background: prediction === activeChallenge.answer
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(239,68,68,0.15)',
              border: `1px solid ${prediction === activeChallenge.answer ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>
                {prediction === activeChallenge.answer ? '✓ Correct!' : '✗ Not quite'}
              </div>
              <p style={{ fontSize: '0.85rem', margin: 0, color: '#e5e7eb' }}>
                The answer is <strong>{activeChallenge.answer}</strong>:{' '}
                {activeChallenge.answer === 'A' ? activeChallenge.optionA : activeChallenge.answer === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
              </p>
            </div>
            <div style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(8,145,178,0.1)',
              border: '1px solid rgba(8,145,178,0.3)'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0891b2', marginBottom: 4 }}>
                💡 Insight
              </div>
              <p style={{ fontSize: '0.85rem', margin: 0, color: '#e5e7eb' }}>
                {activeChallenge.insight}
              </p>
            </div>
            <button
              onClick={() => setActiveChallengeIdx(null)}
              style={{
                marginTop: 12,
                fontSize: '0.8rem',
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid rgba(245,158,11,0.5)',
                background: 'rgba(245,158,11,0.1)',
                color: '#f59e0b',
                cursor: 'pointer'
              }}
            >
              Try another challenge
            </button>
          </div>
        )}
      </div>
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
          // Draw a very faint background cell to hint at the "missing" attention
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
      <svg width={width} height={height} role="img">
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
