'use client'

import React, { useMemo, useState, useEffect, ChangeEvent } from 'react'
import { emitDemoState } from '../../lib/demoState'

// ─────────────────────────────────────────────────────────────
// Gamification Types
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SimilarityPrediction = 'very-similar' | 'moderately-similar' | 'very-different' | null

type LayerNormVsRmsNormProps = {
  conceptId?: string
}

interface SimilarityChallenge {
  name: string
  values: string
  answer: Exclude<SimilarityPrediction, null>
  description: string
  hint: string
}

// Mystery challenges - users predict LayerNorm vs RMSNorm similarity
const SIMILARITY_CHALLENGES: SimilarityChallenge[] = [
  {
    name: '🎲 Mystery Pattern A',
    values: '1.0, -1.0, 0.5, -0.5, 0.3, -0.3, 0.2, -0.2',
    answer: 'very-similar',
    description: 'These activations sum to zero...',
    hint: 'When mean ≈ 0, centering does nothing!'
  },
  {
    name: '🎲 Mystery Pattern B',
    values: '5.0, 5.2, 4.8, 5.1, 4.9, 5.3, 5.0, 4.7',
    answer: 'very-different',
    description: 'All values cluster around 5...',
    hint: 'Large positive mean shifts everything!'
  },
  {
    name: '🎲 Mystery Pattern C',
    values: '0.1, 0.2, 0.15, 10.0, 0.18, 0.12, 0.09, 0.22',
    answer: 'moderately-similar',
    description: 'One value stands out from the rest...',
    hint: 'Outliers affect both normalization schemes'
  },
  {
    name: '🎲 Mystery Pattern D',
    values: '1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0',
    answer: 'very-different',
    description: 'All values are identical...',
    hint: 'Uniform inputs reveal the centering difference'
  },
  {
    name: '🎲 Mystery Pattern E',
    values: '2.0, -1.5, 0.8, -0.3, 1.2, -0.7, 0.4, -0.9',
    answer: 'moderately-similar',
    description: 'Mixed positive and negative, slight bias...',
    hint: 'Small mean = small centering effect'
  },
]

// Educational feedback based on prediction
function getSimilarityFeedback(
  prediction: SimilarityPrediction,
  challenge: SimilarityChallenge,
  cosineSim: number | null,
  mean: number
): string {
  const isCorrect = prediction === challenge.answer
  const _meanMag = Math.abs(mean)
  const simValue = cosineSim?.toFixed(4) ?? 'N/A'

  if (isCorrect) {
    if (challenge.answer === 'very-similar') {
      return `✅ Correct! Cosine similarity = ${simValue}. ${challenge.hint} When activations are already centered (mean ≈ ${mean.toFixed(3)}), LayerNorm's centering step has no effect, so both norms produce nearly identical outputs.`
    }
    if (challenge.answer === 'very-different') {
      return `✅ Correct! Cosine similarity = ${simValue}. ${challenge.hint} With mean = ${mean.toFixed(3)}, LayerNorm's centering fundamentally changes the vector before normalization, leading to different output directions.`
    }
    return `✅ Correct! Cosine similarity = ${simValue}. ${challenge.hint} With mean = ${mean.toFixed(3)}, there's some difference but the outputs are still reasonably aligned.`
  }

  // Wrong answers
  if (challenge.answer === 'very-similar') {
    return `❌ Not quite! These are actually very similar (cosine = ${simValue}). The key insight: mean = ${mean.toFixed(4)} ≈ 0, so LayerNorm's "subtract mean" step does almost nothing. When data is already centered, both norms behave the same!`
  }
  if (challenge.answer === 'very-different') {
    return `❌ Tricky one! These are actually very different (cosine = ${simValue}). The mean = ${mean.toFixed(3)} is significant. LayerNorm subtracts this mean before normalizing, fundamentally changing the vector's direction. RMSNorm just scales!`
  }
  return `❌ Close! These are moderately similar (cosine = ${simValue}). With mean = ${mean.toFixed(3)}, there's some centering effect but not dramatic. The key is understanding when centering matters vs. when it's negligible.`
}

type ColorKind = 'input' | 'intermediate' | 'output'

interface VectorRowProps {
  label: string
  values: number[]
  color: ColorKind
}

interface NormResults {
  layerNorm: {
    mean: number
    std: number
    centered: number[]
    normalized: number[]
    output: number[]
  }
  rmsNorm: {
    rms: number
    normalized: number[]
    output: number[]
  }
  difference: number[]
  metrics: {
    l2: number
    l2PerDim: number
    maxDiff: number
    cosineSimilarity: number | null
  }
  ops: {
    n: number
    layerNorm: number
    rmsNorm: number
    ratio: number
  }
}

const EPS = 1e-5

// Activation presets
const ACTIVATION_PRESETS = [
  { name: '📊 Balanced', values: '1.0, 0.5, -0.2, 2.0, -1.2, 0.3, 0.7, 1.5', description: 'Typical mixed activations' },
  { name: '⬆️ All Positive', values: '0.5, 1.2, 2.0, 0.8, 1.5, 1.0, 0.3, 0.9', description: 'No negative values (mean ≠ 0)' },
  { name: '🎯 Zero Mean', values: '1.0, -1.0, 0.5, -0.5, 0.3, -0.3, 0.2, -0.2', description: 'Already centered (LN ≈ RMS)' },
  { name: '💥 Outlier', values: '0.1, 0.2, 0.15, 10.0, 0.18, 0.12, 0.09, 0.22', description: 'One extreme value' },
  { name: '📏 Uniform', values: '1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0', description: 'All same value (mean = value)' },
];

// Dynamic educational insight
function getLayerNormInsight(
  mean: number,
  std: number,
  rms: number,
  cosineSim: number | null,
  maxDiff: number,
  ops: { n: number; ratio: number }
): string {
  const meanMag = Math.abs(mean);

  if (cosineSim !== null && cosineSim > 0.999) {
    return `✨ Nearly identical outputs! Cosine similarity = ${cosineSim.toFixed(4)}. When activations are already near zero-mean, LayerNorm and RMSNorm produce almost the same result.`;
  }

  if (meanMag < 0.01) {
    return `🎯 Mean ≈ 0! When activations are zero-centered, the "subtract mean" step in LayerNorm does almost nothing. RMSNorm gives ~identical results with ${((1 - 1 / ops.ratio) * 100).toFixed(0)}% fewer ops.`;
  }

  if (maxDiff > 0.5) {
    return `⚠️ Significant difference! Max |Δ| = ${maxDiff.toFixed(3)}. The centering step in LayerNorm shifts activations away from RMSNorm's output. This happens when mean is far from zero (μ = ${mean.toFixed(3)}).`;
  }

  if (std / rms > 1.5) {
    return `📊 High relative variance! The standard deviation (${std.toFixed(3)}) is much larger than RMS (${rms.toFixed(3)}), meaning centering has a big effect on the scale.`;
  }

  if (ops.n > 4096) {
    return `🚀 For large vectors in this toy scalar count, dropping centering removes roughly half these counted operations. Real kernel/runtime effects are outside this lab.`;
  }

  return `📈 Mean = ${mean.toFixed(3)}, σ = ${std.toFixed(3)}. RMSNorm uses ${((1 - 1 / ops.ratio) * 100).toFixed(0)}% fewer ops in this toy scalar count. This lab checks finite-vector mechanics, not architecture adoption.`;
}

const COLOR_TOKENS: Record<
  ColorKind,
  { bg: string; border: string; fg: string }
> = {
  input: {
    bg: 'rgba(55, 65, 81, 0.8)', // gray
    border: '#6b7280',
    fg: '#e5e7eb',
  },
  intermediate: {
    bg: 'rgba(20, 184, 166, 0.12)', // teal
    border: '#14b8a6',
    fg: '#99f6e4',
  },
  output: {
    bg: 'rgba(245, 158, 11, 0.12)', // orange
    border: '#f59e0b',
    fg: '#fed7aa',
  },
}

function parseActivations(text: string): number[] {
  const tokens = text.split(/[\s,]+/).filter(Boolean)
  const values = tokens
    .map((t) => Number.parseFloat(t))
    .filter((v) => Number.isFinite(v))

  return values.length > 0 ? values : [0]
}

function estimateLayerNormOps(n: number): number {
  // Rough scalar-FLOP count:
  // mean: (n - 1) adds + 1 div      ≈ n
  // subtract mean: n subs           ⇒ +n
  // variance: n mul + (n - 1) adds  ≈ +2n
  // variance + eps + sqrt           ⇒ +2
  // (x - mean)/std * gamma + beta: 4n
  // total ≈ 8n + 2
  return n > 0 ? 8 * n + 2 : 0
}

function estimateRmsNormOps(n: number): number {
  // mean square: n mul + (n - 1) adds + 1 div ≈ 2n + 1
  // + eps + sqrt                               +2
  // x / rms * gamma: 2n
  // total ≈ 4n + 3
  return n > 0 ? 4 * n + 3 : 0
}

function computeNorms(
  activations: number[],
  gamma: number,
  beta: number
): NormResults {
  const n = activations.length || 1

  // LayerNorm
  const mean =
    activations.reduce((sum, v) => sum + v, 0) / (n || 1)

  const centered = activations.map((v) => v - mean)

  const variance =
    centered.reduce((sum, v) => sum + v * v, 0) / (n || 1)

  const std = Math.sqrt(variance + EPS) || 1

  const lnNormalized = centered.map((v) => v / std)
  const lnOutput = lnNormalized.map((v) => gamma * v + beta)

  // RMSNorm
  const meanSquare =
    activations.reduce((sum, v) => sum + v * v, 0) / (n || 1)

  const rms = Math.sqrt(meanSquare + EPS) || 1

  const rmsNormalized = activations.map((v) => v / rms)
  const rmsOutput = rmsNormalized.map((v) => gamma * v)

  // Differences
  const difference = lnOutput.map(
    (v, i) => v - rmsOutput[i]
  )
  const l2 = Math.sqrt(
    difference.reduce((sum, v) => sum + v * v, 0)
  )
  const l2PerDim = l2 / (n || 1)
  const maxDiff = difference.reduce(
    (m, v) => Math.max(m, Math.abs(v)),
    0
  )

  const dot = lnOutput.reduce(
    (sum, v, i) => sum + v * rmsOutput[i],
    0
  )
  const lnNorm = Math.sqrt(
    lnOutput.reduce((sum, v) => sum + v * v, 0)
  )
  const rmsNormNorm = Math.sqrt(
    rmsOutput.reduce((sum, v) => sum + v * v, 0)
  )
  const cosineSimilarity =
    lnNorm > 0 && rmsNormNorm > 0
      ? dot / (lnNorm * rmsNormNorm)
      : null

  // Ops
  const layerNormOps = estimateLayerNormOps(n)
  const rmsNormOps = estimateRmsNormOps(n)
  const ratio =
    rmsNormOps > 0 ? layerNormOps / rmsNormOps : 1

  return {
    layerNorm: {
      mean,
      std,
      centered,
      normalized: lnNormalized,
      output: lnOutput,
    },
    rmsNorm: {
      rms,
      normalized: rmsNormalized,
      output: rmsOutput,
    },
    difference,
    metrics: {
      l2,
      l2PerDim,
      maxDiff,
      cosineSimilarity,
    },
    ops: {
      n,
      layerNorm: layerNormOps,
      rmsNorm: rmsNormOps,
      ratio,
    },
  }
}

function VectorRow({
  label,
  values,
  color,
}: VectorRowProps) {
  const palette = COLOR_TOKENS[color]

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        style={{
          fontSize: 12,
          color: '#9ca3af',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 4,
        }}
      >
        {values.map((v, idx) => (
          <span
            key={idx}
            style={{
              padding: '2px 6px',
              borderRadius: 6,
              backgroundColor: palette.bg,
              border: `1px solid ${palette.border}`,
              color: palette.fg,
              fontSize: 12,
              fontFamily:
                'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            }}
          >
            {v.toFixed(3)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function LayerNormVsRmsNorm({ conceptId = 'layer-normalization' }: LayerNormVsRmsNormProps) {
  const [inputText, setInputText] = useState(
    '1.0, 0.5, -0.2, 2.0, -1.2, 0.3, 0.7, 1.5'
  )
  const [gamma, setGamma] = useState(1.0)
  const [beta, setBeta] = useState(0.0)

  // ─────────────────────────────────────────────────────────────
  // Gamification State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<SimilarityChallenge | null>(null)
  const [prediction, setPrediction] = useState<SimilarityPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])

  // Game control functions
  const startChallenge = (challenge: SimilarityChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(3)
  }

  const submitPrediction = (pred: SimilarityPrediction) => {
    if (!selectedChallenge || gamePhase !== 'countdown') return
    setPrediction(pred)
    // Load the challenge values to reveal
    setInputText(selectedChallenge.values)
    setGamePhase('revealed')
    // Score
    if (pred === selectedChallenge.answer) {
      setScore((s) => s + 1)
    }
    if (!completedChallenges.includes(selectedChallenge.name)) {
      setCompletedChallenges((c) => [...c, selectedChallenge.name])
    }
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(3)
  }

  const _exitGameMode = () => {
    setGameMode(false)
    resetGame()
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  const activations = useMemo(
    () => parseActivations(inputText),
    [inputText]
  )

  const results = useMemo(
    () => computeNorms(activations, gamma, beta),
    [activations, gamma, beta]
  )

  const { layerNorm, rmsNorm, difference, metrics, ops } =
    results

  // Dynamic insight
  const currentInsight = useMemo(() => {
    return getLayerNormInsight(
      layerNorm.mean,
      layerNorm.std,
      rmsNorm.rms,
      metrics.cosineSimilarity,
      metrics.maxDiff,
      ops
    );
  }, [layerNorm.mean, layerNorm.std, rmsNorm.rms, metrics.cosineSimilarity, metrics.maxDiff, ops]);

  const cosineLabel = metrics.cosineSimilarity !== null ? metrics.cosineSimilarity.toFixed(4) : 'undefined'
  const opsReductionPct = (1 - 1 / ops.ratio) * 100

  useEffect(() => {
    emitDemoState({
      conceptId,
      label: 'LayerNorm vs RMSNorm normalization state',
      summary: `Vector dim ${ops.n} has mean ${layerNorm.mean.toFixed(3)}, std ${layerNorm.std.toFixed(3)}, RMS ${rmsNorm.rms.toFixed(3)}, and LayerNorm/RMSNorm cosine similarity ${cosineLabel}; RMSNorm uses ${opsReductionPct.toFixed(1)}% fewer scalar ops in this toy count.`,
      values: [
        `dimension n: ${ops.n}`,
        `LayerNorm mean mu: ${layerNorm.mean.toFixed(4)}`,
        `LayerNorm std sigma: ${layerNorm.std.toFixed(4)}`,
        `RMSNorm rms: ${rmsNorm.rms.toFixed(4)}`,
        `output cosine similarity: ${cosineLabel}`,
        `max output delta: ${metrics.maxDiff.toFixed(4)}`,
        `ops: LayerNorm ${ops.layerNorm}, RMSNorm ${ops.rmsNorm}, reduction ${opsReductionPct.toFixed(1)}%`,
        gameMode
          ? `challenge phase: ${gamePhase}${selectedChallenge ? `, ${selectedChallenge.name}` : ''}${prediction ? `, prediction ${prediction}` : ''}`
          : 'challenge phase: setup',
      ],
    })
  }, [
    conceptId,
    cosineLabel,
    gameMode,
    gamePhase,
    layerNorm.mean,
    layerNorm.std,
    metrics.maxDiff,
    ops.layerNorm,
    ops.n,
    ops.rmsNorm,
    opsReductionPct,
    prediction,
    rmsNorm.rms,
    selectedChallenge,
  ])

  const handleGammaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    if (!Number.isNaN(value)) setGamma(value)
  }

  const handleBetaChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value)
    if (!Number.isNaN(value)) setBeta(value)
  }

  const barMax = ops.layerNorm
  const lnWidth =
    barMax > 0
      ? `${(ops.layerNorm / barMax) * 100}%`
      : '0%'
  const rmsWidth =
    barMax > 0
      ? `${(ops.rmsNorm / barMax) * 100}%`
      : '0%'

  return (
    <section
      style={{
        backgroundColor: '#0d1219',
        borderRadius: 16,
        border: '1px solid #111827',
        padding: 20,
        color: '#e5e7eb',
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        boxShadow:
          '0 24px 60px rgba(0, 0, 0, 0.45)',
      }}
    >
      <header
        style={{
          marginBottom: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <h2
          style={{
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          LayerNorm vs RMSNorm
        </h2>
        <p
          style={{
            fontSize: 13,
            color: '#9ca3af',
          }}
        >
          LayerNorm centers and scales activations; RMSNorm
          omits centering and divides by the root-mean-square.
          In this toy lab, compare when that omission changes
          the output direction and the rough scalar-op count.
        </p>

        {/* Activation Presets */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
          {ACTIVATION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => setInputText(preset.values)}
              title={preset.description}
              style={{
                fontSize: 11,
                padding: '4px 10px',
                borderRadius: 999,
                border: inputText === preset.values
                  ? '1px solid #14b8a6'
                  : '1px solid #374151',
                background: inputText === preset.values
                  ? 'rgba(20, 184, 166, 0.2)'
                  : 'rgba(15, 23, 42, 0.9)',
                color: inputText === preset.values
                  ? '#5eead4'
                  : '#e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
              }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Dynamic Insight */}
        <div
          style={{
            marginTop: 12,
            padding: '10px 12px',
            borderRadius: 10,
            background: metrics.cosineSimilarity !== null && metrics.cosineSimilarity > 0.99
              ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
            border: metrics.cosineSimilarity !== null && metrics.cosineSimilarity > 0.99
              ? '1px solid rgba(52, 211, 153, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
            fontSize: 12,
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.5,
          }}
        >
          {currentInsight}
        </div>

        {/* Gamification Toggle */}
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            onClick={() => setGameMode(!gameMode)}
            style={{
              fontSize: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: gameMode ? '1px solid #f59e0b' : '1px solid #374151',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.1))'
                : 'rgba(15, 23, 42, 0.9)',
              color: gameMode ? '#fcd34d' : '#e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.2s ease-out',
              fontWeight: 500,
            }}
          >
            {gameMode ? '🎮 Exit Challenge Mode' : '🎯 Try Similarity Challenge'}
          </button>
          {score > 0 && (
            <span style={{ marginLeft: 12, fontSize: 12, color: '#fcd34d' }}>
              Score: {score}/{completedChallenges.length}
            </span>
          )}
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────────
          Gamification Panel
         ───────────────────────────────────────────────────────────── */}
      {gameMode && (
        <div
          style={{
            marginTop: 16,
            marginBottom: 16,
            padding: 16,
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.05))',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fcd34d', margin: 0 }}>
              🎯 Similarity Prediction Challenge
            </h3>
            {gamePhase !== 'setup' && (
              <button
                type="button"
                onClick={resetGame}
                style={{
                  fontSize: 11,
                  padding: '4px 10px',
                  borderRadius: 6,
                  border: '1px solid #6b7280',
                  background: 'rgba(55, 65, 81, 0.5)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                ← Back to Challenges
              </button>
            )}
          </div>

          {gamePhase === 'setup' && (
            <>
              <p style={{ fontSize: 12, color: '#d1d5db', marginBottom: 12 }}>
                Can you predict whether LayerNorm and RMSNorm will produce <strong>similar</strong> or <strong>different</strong> outputs?
                The key insight: it depends on how far the mean is from zero!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {SIMILARITY_CHALLENGES.map((challenge) => {
                  const isCompleted = completedChallenges.includes(challenge.name)
                  return (
                    <button
                      key={challenge.name}
                      type="button"
                      onClick={() => startChallenge(challenge)}
                      style={{
                        fontSize: 12,
                        padding: '8px 14px',
                        borderRadius: 8,
                        border: isCompleted ? '1px solid #22c55e' : '1px solid #6b7280',
                        background: isCompleted
                          ? 'rgba(34, 197, 94, 0.15)'
                          : 'rgba(55, 65, 81, 0.5)',
                        color: isCompleted ? '#86efac' : '#e5e7eb',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease-out',
                      }}
                    >
                      {isCompleted ? '✓ ' : ''}{challenge.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {gamePhase === 'countdown' && selectedChallenge && (
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: '#fcd34d', marginBottom: 8, fontWeight: 500 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: 12, color: '#d1d5db', marginBottom: 16, fontStyle: 'italic' }}>
                &ldquo;{selectedChallenge.description}&rdquo;
              </p>

              <p style={{ fontSize: 14, color: '#e5e7eb', marginBottom: 12 }}>
                Will LayerNorm and RMSNorm outputs be...
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginBottom: 16 }}>
                {[
                  { value: 'very-similar' as const, label: '🟢 Very Similar', desc: 'cosine > 0.99' },
                  { value: 'moderately-similar' as const, label: '🟡 Moderate', desc: '0.9 < cosine < 0.99' },
                  { value: 'very-different' as const, label: '🔴 Very Different', desc: 'cosine < 0.9' },
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => submitPrediction(option.value)}
                    style={{
                      fontSize: 12,
                      padding: '10px 16px',
                      borderRadius: 10,
                      border: '1px solid #6b7280',
                      background: 'rgba(55, 65, 81, 0.7)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease-out',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontWeight: 500 }}>{option.label}</div>
                    <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{option.desc}</div>
                  </button>
                ))}
              </div>

              {countdown > 0 && (
                <div style={{ fontSize: 11, color: '#9ca3af' }}>
                  Make your prediction! ({countdown}s to think...)
                </div>
              )}
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <div>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: prediction === selectedChallenge.answer
                    ? 'rgba(34, 197, 94, 0.15)'
                    : 'rgba(239, 68, 68, 0.15)',
                  border: prediction === selectedChallenge.answer
                    ? '1px solid rgba(34, 197, 94, 0.4)'
                    : '1px solid rgba(239, 68, 68, 0.4)',
                  marginBottom: 12,
                }}
              >
                <p style={{ fontSize: 12, color: '#e5e7eb', lineHeight: 1.6, margin: 0 }}>
                  {getSimilarityFeedback(prediction, selectedChallenge, metrics.cosineSimilarity, layerNorm.mean)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#9ca3af' }}>
                <div>
                  Your prediction: <span style={{ color: prediction === selectedChallenge.answer ? '#86efac' : '#fca5a5' }}>
                    {prediction === 'very-similar' ? '🟢 Very Similar' : prediction === 'moderately-similar' ? '🟡 Moderate' : '🔴 Very Different'}
                  </span>
                </div>
                <div>
                  Actual: <span style={{ color: '#fcd34d' }}>
                    {selectedChallenge.answer === 'very-similar' ? '🟢 Very Similar' : selectedChallenge.answer === 'moderately-similar' ? '🟡 Moderate' : '🔴 Very Different'}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 11, color: '#6b7280', marginTop: 12, marginBottom: 0 }}>
                👆 Scroll down to see the actual activations and how both normalizations processed them!
              </p>
            </div>
          )}
        </div>
      )}

      {/* Controls + High-level summary */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          gap: 20,
          alignItems: 'flex-start',
        }}
      >
        {/* Left: input & global metrics */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 12,
                marginBottom: 4,
                color: '#9ca3af',
              }}
            >
              Activations vector (editable)
            </label>
            <textarea
              value={inputText}
              onChange={(e) =>
                setInputText(e.target.value)
              }
              rows={3}
              style={{
                width: '100%',
                resize: 'vertical',
                padding: 8,
                borderRadius: 8,
                border: '1px solid #1f2937',
                backgroundColor: '#020617',
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 12,
              }}
              placeholder="e.g. 1.0, 0.5, -0.2, 2.0, -1.2, 0.3, 0.7, 1.5"
            />
            <p
              style={{
                marginTop: 4,
                fontSize: 11,
                color: '#6b7280',
              }}
            >
              Separate numbers with commas or spaces.
              Both norms operate over this single
              activation vector.
            </p>
          </div>

          <div
            style={{
              display: 'flex',
              gap: 12,
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  color: '#9ca3af',
                }}
              >
                Scale γ (shared)
              </label>
              <input
                type="number"
                step="0.1"
                value={gamma}
                onChange={handleGammaChange}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid #1f2937',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: 12,
                  marginBottom: 4,
                  color: '#9ca3af',
                }}
              >
                Shift β (LayerNorm only)
              </label>
              <input
                type="number"
                step="0.1"
                value={beta}
                onChange={handleBetaChange}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 8,
                  border: '1px solid #1f2937',
                  backgroundColor: '#020617',
                  color: '#e5e7eb',
                  fontSize: 12,
                }}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 8,
              padding: 10,
              borderRadius: 10,
              background:
                'radial-gradient(circle at top left, rgba(34, 197, 235, 0.2), transparent 55%), radial-gradient(circle at bottom right, rgba(249, 115, 22, 0.2), transparent 55%)',
              border: '1px solid rgba(31, 41, 55, 1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8,
                marginBottom: 6,
                fontSize: 12,
              }}
            >
              <span
                style={{
                  color: '#e5e7eb',
                  fontWeight: 500,
                }}
              >
                Output similarity
              </span>
              <span
                style={{
                  color: '#a5b4fc',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                dim = {ops.n}
              </span>
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(3, minmax(0, 1fr))',
                gap: 8,
                fontSize: 11,
              }}
            >
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  Cosine sim
                </div>
                <div
                  style={{
                    color: '#f97316',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.cosineSimilarity !== null
                    ? metrics.cosineSimilarity.toFixed(3)
                    : '—'}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  L2 / dim
                </div>
                <div
                  style={{
                    color: '#14b8a6',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.l2PerDim.toFixed(4)}
                </div>
              </div>
              <div>
                <div
                  style={{
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  max |Δ|
                </div>
                <div
                  style={{
                    color: '#e5e7eb',
                    fontFamily:
                      'JetBrains Mono, ui-monospace',
                  }}
                >
                  {metrics.maxDiff.toFixed(4)}
                </div>
              </div>
            </div>
            <p
              style={{
                marginTop: 6,
                fontSize: 11,
                color: '#9ca3af',
              }}
            >
              For typical LLM activations the two
              normalizations produce very similar
              directions, even though LayerNorm also
              subtracts the mean.
            </p>
          </div>
        </div>

        {/* Right: ops comparison */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 6,
            }}
          >
            Computational cost (per vector)
          </h3>
          <p
            style={{
              fontSize: 12,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            Approximate scalar operations for norm over{' '}
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              n = {ops.n}
            </span>{' '}
            activations:
          </p>
          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ color: '#e5e7eb' }}>
                LayerNorm
              </span>
              <span
                style={{
                  color: '#f97316',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                ≈ 8n + 2 = {ops.layerNorm}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: '#020617',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: lnWidth,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #14b8a6, #f97316)',
                }}
              />
            </div>
          </div>

          <div
            style={{
              fontSize: 12,
              marginBottom: 8,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 4,
              }}
            >
              <span style={{ color: '#e5e7eb' }}>
                RMSNorm
              </span>
              <span
                style={{
                  color: '#22c55e',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                ≈ 4n + 3 = {ops.rmsNorm}
              </span>
            </div>
            <div
              style={{
                height: 6,
                borderRadius: 999,
                backgroundColor: '#020617',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: rmsWidth,
                  height: '100%',
                  background:
                    'linear-gradient(90deg, #22c55e, #4ade80)',
                }}
              />
            </div>
          </div>

          <p
            style={{
              marginTop: 6,
              fontSize: 11,
              color: '#9ca3af',
            }}
          >
            For this vector, RMSNorm uses roughly{' '}
            <span
              style={{
                color: '#22c55e',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              {(
                (1 - 1 / ops.ratio) *
                100
              ).toFixed(1)}
              % fewer
            </span>{' '}
            scalar ops than LayerNorm.
          </p>
        </div>
      </div>

      {/* Step-by-step panels */}
      <div
        style={{
          marginTop: 20,
          display: 'grid',
          gridTemplateColumns:
            'repeat(2, minmax(0, 1fr))',
          gap: 16,
        }}
      >
        {/* LayerNorm */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            LayerNorm
          </h3>
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              y = γ · (x − μ) / σ + β
            </span>{' '}
            — centers activations then rescales & shifts.
          </p>

          <VectorRow
            label="1. Input x"
            values={activations}
            color="input"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 8,
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                Mean μ =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {layerNorm.mean.toFixed(4)}
              </span>
            </div>
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                Std σ =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {layerNorm.std.toFixed(4)}
              </span>
            </div>
          </div>
          <VectorRow
            label="2. Subtract mean: x − μ"
            values={layerNorm.centered}
            color="intermediate"
          />
          <VectorRow
            label="3. Normalize: (x − μ) / σ"
            values={layerNorm.normalized}
            color="intermediate"
          />
          <VectorRow
            label="4. Output: γ · (x̂) + β"
            values={layerNorm.output}
            color="output"
          />
        </div>

        {/* RMSNorm */}
        <div
          style={{
            padding: 12,
            borderRadius: 12,
            border: '1px solid #1f2937',
            backgroundColor: 'rgba(15, 23, 42, 0.8)',
          }}
        >
          <h3
            style={{
              fontSize: 14,
              fontWeight: 500,
              marginBottom: 8,
            }}
          >
            RMSNorm
          </h3>
          <p
            style={{
              fontSize: 11,
              color: '#9ca3af',
              marginBottom: 10,
            }}
          >
            <span
              style={{
                color: '#e5e7eb',
                fontFamily:
                  'JetBrains Mono, ui-monospace',
              }}
            >
              y = γ · x / RMS(x)
            </span>{' '}
            — no centering step; just divide by the
            root-mean-square.
          </p>

          <VectorRow
            label="1. Input x"
            values={activations}
            color="input"
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: 8,
              fontSize: 11,
              marginBottom: 6,
            }}
          >
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                E[x²] =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {(
                  Math.pow(rmsNorm.rms, 2) - EPS
                ).toFixed(4)}
              </span>
            </div>
            <div>
              <span
                style={{ color: '#9ca3af' }}
              >
                RMS(x) =
              </span>{' '}
              <span
                style={{
                  color: '#14b8a6',
                  fontFamily:
                    'JetBrains Mono, ui-monospace',
                }}
              >
                {rmsNorm.rms.toFixed(4)}
              </span>
            </div>
          </div>
          <VectorRow
            label="2. Normalize: x / RMS(x)"
            values={rmsNorm.normalized}
            color="intermediate"
          />
          <VectorRow
            label="3. Output: γ · x̂"
            values={rmsNorm.output}
            color="output"
          />
        </div>
      </div>

      {/* Direct comparison of outputs */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 12,
          borderTop: '1px solid #1f2937',
        }}
      >
        <h3
          style={{
            fontSize: 13,
            fontWeight: 500,
            marginBottom: 8,
          }}
        >
          Side-by-side outputs
        </h3>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(3, minmax(0, 1fr))',
            gap: 12,
          }}
        >
          <VectorRow
            label="LayerNorm output"
            values={layerNorm.output}
            color="output"
          />
          <VectorRow
            label="RMSNorm output"
            values={rmsNorm.output}
            color="output"
          />
          <VectorRow
            label="Difference: LayerNorm − RMSNorm"
            values={difference}
            color="intermediate"
          />
        </div>
        <p
          style={{
            marginTop: 8,
            fontSize: 11,
            color: '#9ca3af',
          }}
        >
          Try modifying the activations above. You&apos;ll
          see that LayerNorm and RMSNorm follow different
          math: centering vs. pure RMS scaling. Near-zero-mean
          vectors can be close; nonzero-mean or uniform vectors
          can change direction. The cost bars are a toy scalar-op
          count, not a runtime benchmark.
        </p>
      </div>
    </section>
  )
}
