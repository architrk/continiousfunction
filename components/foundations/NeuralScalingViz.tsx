'use client'

import { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'

type XMode = 'compute' | 'params' | 'data'

// Game types for scaling prediction challenge
type GamePhase = 'setup' | 'countdown' | 'revealed'
type OptimalityPrediction = 'gpt3' | 'chinchilla' | 'llama65' | null

interface ScalingChallenge {
  name: string
  computeSlider: number
  question: string
  answer: OptimalityPrediction
  explanation: string
}

// Scaling law challenges - predict which model is closest to optimal
const SCALING_CHALLENGES: ScalingChallenge[] = [
  {
    name: '🎲 GPT-3 Era',
    computeSlider: 60,
    question: 'At GPT-3 compute (~3e23 FLOPs), which model training was MOST compute-efficient?',
    answer: 'chinchilla',
    explanation: 'Chinchilla is optimal! GPT-3 was 2.5× over-parameterized - it should have been ~70B params. DeepMind showed you get better results training a smaller model on more data with the same compute.',
  },
  {
    name: '🎲 Startup Budget',
    computeSlider: 35,
    question: 'With limited compute (~1e22 FLOPs), what\'s the optimal approach?',
    answer: 'llama65',
    explanation: 'LLaMA\'s approach is best at this scale! Train a modest model on LOTS of data. The optimal model here would be ~7B parameters on 140B tokens. Data beats parameters at lower budgets.',
  },
  {
    name: '🎲 Frontier Scale',
    computeSlider: 85,
    question: 'At frontier compute (~1e24 FLOPs), which model\'s STRATEGY is closest to optimal?',
    answer: 'chinchilla',
    explanation: 'Chinchilla\'s equal-scaling principle holds at all scales! The optimal model at 1e24 FLOPs would be ~200B parameters trained on ~4T tokens. GPT-3\'s strategy of "bigger is better" leaves performance on the table.',
  },
  {
    name: '🎲 The Ratio',
    computeSlider: 70,
    question: 'Which model has the best tokens-per-parameter ratio (closest to ~20:1)?',
    answer: 'chinchilla',
    explanation: 'Chinchilla achieves exactly ~20 tokens per parameter (1.4T/70B = 20:1). GPT-3 only trained on ~1.7 tokens/param (300B/175B). This ratio is key to compute-optimal training!',
  },
]

function getScalingFeedback(
  prediction: OptimalityPrediction,
  challenge: ScalingChallenge
): string {
  const modelNames: Record<string, string> = {
    gpt3: 'GPT-3',
    chinchilla: 'Chinchilla',
    llama65: 'LLaMA-65B'
  }

  if (prediction === challenge.answer) {
    return `✓ Correct! ${challenge.explanation}`
  }

  return `✗ Not quite. The answer is ${modelNames[challenge.answer!]}.\n\n${challenge.explanation}`
}

// Fun compute budget presets
const COMPUTE_PRESETS = [
  { name: '🎓 Classroom', slider: 10, description: 'Small research GPU budget (~1e21 FLOPs)' },
  { name: '🏢 Startup', slider: 40, description: 'Series A compute (~1e22 FLOPs)' },
  { name: '🔬 Research Lab', slider: 60, description: 'GPT-3 era compute (~1e23 FLOPs)' },
  { name: '🏭 Big Tech', slider: 80, description: 'Frontier model training (~1e24 FLOPs)' },
  { name: '🚀 Maximum', slider: 100, description: 'Theoretical ceiling' },
];

// Model comparison presets
const MODEL_FOCUS_PRESETS = [
  { name: '⚖️ All Models', focus: null, description: 'Compare all models on the plot' },
  { name: '🔴 GPT-3 Analysis', focus: 'gpt3', description: 'Focus on why GPT-3 is over-parameterized' },
  { name: '🟢 Chinchilla Optimal', focus: 'chinchilla', description: 'See compute-optimal training' },
  { name: '🔵 LLaMA Efficient', focus: 'llama65', description: 'Data-heavy training approach' },
];

// Educational insight based on current state
const getScalingInsight = (xMode: XMode, computeBudget: number, modelPoints: VisualModelPoint[]): string => {
  const gpt3 = modelPoints.find(m => m.id === 'gpt3');
  const chinchilla = modelPoints.find(m => m.id === 'chinchilla');

  if (xMode === 'compute') {
    if (computeBudget < 1e22) {
      return '📊 At this compute level, model size should be modest. Focus on data quality over quantity!';
    }
    if (computeBudget > 1e24) {
      return '🚀 Frontier compute territory! At this scale, the Chinchilla scaling suggests training on TRILLIONS of tokens.';
    }
    if (gpt3 && chinchilla) {
      return `💡 Notice GPT-3 sits ABOVE the optimal frontier - it had ${(gpt3.rN).toFixed(1)}× more params than optimal for its compute budget. Chinchilla used the same compute more efficiently!`;
    }
  }

  if (xMode === 'params') {
    return '🧠 Larger models learn more efficiently PER parameter, but have more parameters to train. The optimal balance depends on your compute budget.';
  }

  if (xMode === 'data') {
    return '📚 More data always helps, but with diminishing returns. The Chinchilla ratio suggests ~20 tokens per parameter is near-optimal for large models.';
  }

  return '⚖️ The key insight: for a fixed compute budget, there\'s an optimal balance between model size and training data.';
};

interface ModelPoint {
  id: string
  label: string
  N: number // parameters
  D: number // tokens
  C: number // training FLOPs
  color: string
}

// --- Approximate scaling-law exponents (Kaplan / Chinchilla-style, schematic) ---
// L(N) ≈ L0 + A_N * (N_ref / N)^α_N,      α_N ~ 0.076
// L(D) ≈ L0 + A_D * (D_ref / D)^β_D,      β_D ~ 0.095
// L(C) ≈ L0 + A_C * (C_ref / C)^γ_C,      γ_C ~ 0.05
// These are toy values for visualization, not exact fits to any single paper.
const ALPHA_N = 0.076
const BETA_D = 0.095
const GAMMA_C = 0.05

const LOSS_FLOOR = 1.0
const LOSS_SCALE_N = 2.0
const LOSS_SCALE_D = 2.0
const LOSS_SCALE_C = 3.0

const N_REF = 1e9
const D_REF = 1e10
const C_REF = 1e23

// Chinchilla-like equal scaling: N_opt ∝ C^0.5, D_opt ∝ C^0.5 citeturn3search2turn2search17
const CHINCHILLA_PARAMS = 70e9
const CHINCHILLA_TOKENS = 1.4e12
const CHINCHILLA_COMPUTE = 6 * CHINCHILLA_PARAMS * CHINCHILLA_TOKENS // ~5.9e23 FLOPs

// Rough compute range
const COMPUTE_MIN = 1e21
const COMPUTE_MAX = 3e24

// SVG layout
const SVG_WIDTH = 760
const SVG_HEIGHT = 420
const MARGIN = { top: 28, right: 28, bottom: 56, left: 88 }
const INNER_WIDTH = SVG_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = SVG_HEIGHT - MARGIN.top - MARGIN.bottom

interface VisualModelPoint extends ModelPoint {
  xVal: number
  loss: number
  x: number
  y: number
  nOpt: number
  dOpt: number
  rN: number
  rD: number
}

// Approximate GPT‑3 / Chinchilla / LLaMA‑65B stats citeturn1search0turn1search9turn1search4turn1search7turn1search22
const MODELS: ModelPoint[] = [
  {
    id: 'gpt3',
    label: 'GPT‑3 175B',
    N: 175e9,
    D: 300e9, // ~300B tokens
    C: 3.14e23, // published estimate
    color: '#ef4444', // red = over‑parameterized
  },
  {
    id: 'chinchilla',
    label: 'Chinchilla 70B',
    N: CHINCHILLA_PARAMS,
    D: CHINCHILLA_TOKENS,
    C: CHINCHILLA_COMPUTE, // ~5.9e23 FLOPs
    color: '#22c55e', // green = compute‑optimal
  },
  {
    id: 'llama65',
    label: 'LLaMA‑1 65B',
    N: 65e9,
    D: 1.4e12, // ~1.4T tokens
    C: 6 * 65e9 * 1.4e12, // same FLOPs formula
    color: '#0ea5e9', // blue
  },
]

// --- Helper functions ---

function nOpt(C: number): number {
  return CHINCHILLA_PARAMS * Math.sqrt(C / CHINCHILLA_COMPUTE)
}

function dOpt(C: number): number {
  return CHINCHILLA_TOKENS * Math.sqrt(C / CHINCHILLA_COMPUTE)
}

function lossFromParams(N: number): number {
  return LOSS_FLOOR + LOSS_SCALE_N * Math.pow(N_REF / N, ALPHA_N)
}

function lossFromData(D: number): number {
  return LOSS_FLOOR + LOSS_SCALE_D * Math.pow(D_REF / D, BETA_D)
}

function lossFromCompute(C: number): number {
  return LOSS_FLOOR + LOSS_SCALE_C * Math.pow(C_REF / C, GAMMA_C)
}

function sliderToCompute(sliderValue: number): number {
  const t = sliderValue / 100
  const logMin = Math.log10(COMPUTE_MIN)
  const logMax = Math.log10(COMPUTE_MAX)
  const logC = logMin + (logMax - logMin) * t
  return Math.pow(10, logC)
}

function formatSci(value: number): string {
  const exponent = Math.floor(Math.log10(value))
  const mantissa = value / Math.pow(10, exponent)
  return `${mantissa.toFixed(1)}e${exponent}`
}

function formatParams(N: number): string {
  if (N >= 1e12) return `${(N / 1e12).toFixed(1)}T`
  if (N >= 1e9) return `${(N / 1e9).toFixed(0)}B`
  if (N >= 1e6) return `${(N / 1e6).toFixed(0)}M`
  return N.toFixed(0)
}

function formatTokens(D: number): string {
  if (D >= 1e12) return `${(D / 1e12).toFixed(1)}T`
  if (D >= 1e9) return `${(D / 1e9).toFixed(0)}B`
  return D.toFixed(0)
}

function formatRatio(r: number): string {
  if (!isFinite(r)) return '—'
  if (r > 10 || r < 0.1) return r.toExponential(1)
  return r.toFixed(2)
}

interface PlotState {
  xLabel: string
  yLabel: string
  curveLabel: string
  lineColor: string
  curvePath: string
  xTicks: { value: number; x: number }[]
  yTicks: { value: number; y: number }[]
  modelPoints: VisualModelPoint[]
  sliderX: number
  sliderY: number
  sliderLoss: number
  verticalValue: number
}

export default function NeuralScalingLawsExplorer() {
  const [xMode, setXMode] = useState<XMode>('compute')
  const [computeSlider, setComputeSlider] = useState<number>(70) // 0–100

  // Game state for scaling prediction challenge
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<ScalingChallenge | null>(null)
  const [prediction, setPrediction] = useState<OptimalityPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())
  const computeBudget = useMemo(
    () => sliderToCompute(computeSlider),
    [computeSlider]
  )

  const currentNOpt = useMemo(() => nOpt(computeBudget), [computeBudget])
  const currentDOpt = useMemo(() => dOpt(computeBudget), [computeBudget])

  const plotState = useMemo<PlotState>(() => {
    let xLabel: string
    let yLabel = 'Loss (nats/token, schematic)'
    let curveLabel: string
    let lineColor: string

    let xDomain: [number, number]
    let samplingMin: number
    let samplingMax: number
    let verticalValue: number

    if (xMode === 'compute') {
      xLabel = 'Training compute C (FLOPs)'
      curveLabel = 'Compute‑optimal frontier  L(C) ∝ C^-γ'
      lineColor = MATH_COLORS.primary // orange
      xDomain = [COMPUTE_MIN, COMPUTE_MAX]
      samplingMin = COMPUTE_MIN
      samplingMax = COMPUTE_MAX
      verticalValue = computeBudget
    } else if (xMode === 'params') {
      xLabel = 'Model size N (parameters)'
      curveLabel = 'Loss vs model size  L(N) ∝ N^-α'
      lineColor = MATH_COLORS.secondary // teal
      const Ns = MODELS.map(m => m.N).concat([
        nOpt(COMPUTE_MIN),
        nOpt(COMPUTE_MAX),
      ])
      const minN = Math.min(...Ns) * 0.6
      const maxN = Math.max(...Ns) * 1.6
      xDomain = [minN, maxN]
      samplingMin = minN
      samplingMax = maxN
      verticalValue = nOpt(computeBudget)
    } else {
      xLabel = 'Dataset size D (tokens)'
      curveLabel = 'Loss vs data  L(D) ∝ D^-β'
      lineColor = MATH_COLORS.accent // purple
      const Ds = MODELS.map(m => m.D).concat([
        dOpt(COMPUTE_MIN),
        dOpt(COMPUTE_MAX),
      ])
      const minD = Math.min(...Ds) * 0.6
      const maxD = Math.max(...Ds) * 1.6
      xDomain = [minD, maxD]
      samplingMin = minD
      samplingMax = maxD
      verticalValue = dOpt(computeBudget)
    }

    const xScale = d3.scaleLog().domain(xDomain).range([0, INNER_WIDTH])

    // Base power-law curve for the selected view
    const numSamples = 200
    const curvePoints: { xVal: number; loss: number }[] = []
    const logMin = Math.log10(samplingMin)
    const logMax = Math.log10(samplingMax)
    for (let i = 0; i < numSamples; i++) {
      const t = i / (numSamples - 1)
      const logX = logMin + (logMax - logMin) * t
      const xVal = Math.pow(10, logX)
      let loss: number
      if (xMode === 'compute') {
        loss = lossFromCompute(xVal)
      } else if (xMode === 'params') {
        loss = lossFromParams(xVal)
      } else {
        loss = lossFromData(xVal)
      }
      curvePoints.push({ xVal, loss })
    }

    // Models with offsets that reflect how far they are from compute‑optimal
    const rawModelPoints: VisualModelPoint[] = MODELS.map(model => {
      const nOptimal = nOpt(model.C)
      const dOptimal = dOpt(model.C)
      const rN = model.N / nOptimal
      const rD = model.D / dOptimal

      let baselineLoss: number
      if (xMode === 'compute') {
        baselineLoss = lossFromCompute(model.C)
      } else if (xMode === 'params') {
        baselineLoss = lossFromParams(model.N)
      } else {
        baselineLoss = lossFromData(model.D)
      }

      // Penalize distance from the compute‑optimal frontier only in compute view
      let effectiveLoss = baselineLoss
      if (xMode === 'compute') {
        const imbalance =
          Math.abs(Math.log10(rN)) + Math.abs(Math.log10(rD)) // GPT‑3 >> others
        effectiveLoss = baselineLoss + 0.18 * imbalance
      }

      const xVal =
        xMode === 'compute'
          ? model.C
          : xMode === 'params'
          ? model.N
          : model.D

      return {
        ...model,
        xVal,
        loss: effectiveLoss,
        nOpt: nOptimal,
        dOpt: dOptimal,
        rN,
        rD,
        x: 0,
        y: 0,
      }
    })

    // Y‑axis domain from curve + models
    let minLoss = Infinity
    let maxLoss = -Infinity
    for (const p of curvePoints) {
      if (p.loss < minLoss) minLoss = p.loss
      if (p.loss > maxLoss) maxLoss = p.loss
    }
    for (const m of rawModelPoints) {
      if (m.loss < minLoss) minLoss = m.loss
      if (m.loss > maxLoss) maxLoss = m.loss
    }
    const span = maxLoss - minLoss || 1
    const yDomain: [number, number] = [
      Math.max(minLoss - 0.25 * span, 0.3),
      maxLoss + 0.25 * span,
    ]

    const yScale = d3
      .scaleLog()
      .domain(yDomain)
      .range([INNER_HEIGHT, 0])

    const lineGen = d3
      .line<{ xVal: number; loss: number }>()
      .x(d => xScale(d.xVal))
      .y(d => yScale(d.loss))
      .curve(d3.curveMonotoneX)

    const curvePath = lineGen(curvePoints) ?? ''

    const modelPoints: VisualModelPoint[] = rawModelPoints.map(m => ({
      ...m,
      x: xScale(m.xVal),
      y: yScale(m.loss),
    }))

    const sliderLoss =
      xMode === 'compute'
        ? lossFromCompute(verticalValue)
        : xMode === 'params'
        ? lossFromParams(verticalValue)
        : lossFromData(verticalValue)
    const sliderX = xScale(verticalValue)
    const sliderY = yScale(sliderLoss)

    const xTicks = xScale
      .ticks(6)
      .filter(v => v >= xDomain[0] && v <= xDomain[1])
      .map(v => ({ value: v, x: xScale(v) }))

    const yTicks = yScale
      .ticks(5)
      .filter(v => v > yDomain[0] && v < yDomain[1])
      .map(v => ({ value: v, y: yScale(v) }))

    return {
      xLabel,
      yLabel,
      curveLabel,
      lineColor,
      curvePath,
      xTicks,
      yTicks,
      modelPoints,
      sliderX,
      sliderY,
      sliderLoss,
      verticalValue,
    }
  }, [xMode, computeBudget])

  // Game control functions
  const startChallenge = (challenge: ScalingChallenge) => {
    setSelectedChallenge(challenge)
    setComputeSlider(challenge.computeSlider)
    setXMode('compute')
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(5)
  }

  const submitPrediction = (pred: OptimalityPrediction) => {
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
      className="card interactive-card neural-scaling-card"
      style={{
        backgroundColor: '#080c14',
        borderRadius: '16px',
        border: '1px solid rgba(148, 163, 184, 0.25)',
        padding: '18px 20px 20px',
      }}
    >
      <header className="neural-scaling-header" style={{ marginBottom: '12px' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>
          Neural Scaling Laws (Chinchilla View)
        </h2>
        <p
          className="muted"
          style={{ fontSize: '0.9rem', color: '#9ca3af', maxWidth: 540 }}
        >
          Loss follows power laws in model size <code>N</code>, data{' '}
          <code>D</code>, and compute <code>C</code>. Chinchilla shows that for
          a fixed compute budget, the compute‑optimal frontier roughly keeps{' '}
          <code>N</code> and <code>D</code> growing proportionally,
          i.e. <code>N_opt(C) ∝ C^0.5</code>, <code>D_opt(C) ∝ C^0.5</code>.
        </p>
      </header>

      {/* Game toggle button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
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
          {gameMode ? '🎮 Exit Quiz' : '📊 Try Scaling Quiz'}
        </button>
      </div>

      {/* Scaling Quiz Game Panel */}
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
              📊 Scaling Laws Quiz
            </span>
            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
              Score: {score}/{SCALING_CHALLENGES.length}
            </span>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.75rem' }}>
            Test your understanding of compute-optimal training! Which model would be best?
          </p>

          {/* Challenge buttons */}
          {gamePhase === 'setup' && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {SCALING_CHALLENGES.map((challenge) => (
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
                  onClick={() => submitPrediction('gpt3')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #ef4444',
                    background: prediction === 'gpt3' ? 'rgba(239, 68, 68, 0.2)' : 'transparent',
                    color: '#ef4444',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'gpt3' ? 0.5 : 1,
                  }}
                >
                  🔴 GPT-3
                </button>
                <button
                  onClick={() => submitPrediction('chinchilla')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #22c55e',
                    background: prediction === 'chinchilla' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                    color: '#22c55e',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'chinchilla' ? 0.5 : 1,
                  }}
                >
                  🟢 Chinchilla
                </button>
                <button
                  onClick={() => submitPrediction('llama65')}
                  disabled={prediction !== null}
                  style={{
                    flex: 1,
                    minWidth: '80px',
                    padding: '0.5rem',
                    borderRadius: '6px',
                    border: '1px solid #0ea5e9',
                    background: prediction === 'llama65' ? 'rgba(14, 165, 233, 0.2)' : 'transparent',
                    color: '#0ea5e9',
                    cursor: prediction ? 'default' : 'pointer',
                    opacity: prediction && prediction !== 'llama65' ? 0.5 : 1,
                  }}
                >
                  🔵 LLaMA-65B
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
                  {getScalingFeedback(prediction, selectedChallenge)}
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

      {/* Compute Budget Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {COMPUTE_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setComputeSlider(preset.slider)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: Math.abs(computeSlider - preset.slider) < 5 ? '2px solid #f59e0b' : '1px solid #374151',
              background: Math.abs(computeSlider - preset.slider) < 5
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: Math.abs(computeSlider - preset.slider) < 5 ? '#f59e0b' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: Math.abs(computeSlider - preset.slider) < 5 ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Educational Insight */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: xMode === 'compute'
          ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))'
          : xMode === 'params'
            ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.12), rgba(20, 184, 166, 0.04))'
            : 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.04))',
        border: `1px solid ${xMode === 'compute' ? '#f59e0b' : xMode === 'params' ? '#14b8a6' : '#8b5cf6'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getScalingInsight(xMode, computeBudget, plotState.modelPoints)}
      </div>

      <div
        className="neural-scaling-body"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 2.1fr) minmax(0, 1.4fr)',
          gap: '18px',
          alignItems: 'stretch',
        }}
      >
        {/* SVG Plot */}
        <div className="neural-scaling-plot-wrapper">
          <svg
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            role="img"
            aria-label="Log-log plot of loss vs compute / parameters / data with a compute-optimal frontier and famous models overlaid."
          >
            <defs>
              <linearGradient id="frontierGlow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={MATH_COLORS.primary} stopOpacity={0.9} />
                <stop offset="100%" stopColor={MATH_COLORS.primary} stopOpacity={0.2} />
              </linearGradient>
            </defs>

            <g
              transform={`translate(${MARGIN.left},${MARGIN.top})`}
              style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont' }}
            >
              {/* Plot background */}
              <rect
                x={0}
                y={0}
                width={INNER_WIDTH}
                height={INNER_HEIGHT}
                fill="rgba(15,23,42,0.9)"
                stroke="rgba(148,163,184,0.25)"
                rx={10}
              />

              {/* Grid lines */}
              {plotState.xTicks.map(tick => (
                <line
                  key={`x-grid-${tick.value}`}
                  x1={tick.x}
                  x2={tick.x}
                  y1={0}
                  y2={INNER_HEIGHT}
                  stroke="rgba(148,163,184,0.12)"
                  strokeWidth={1}
                />
              ))}
              {plotState.yTicks.map(tick => (
                <line
                  key={`y-grid-${tick.value}`}
                  x1={0}
                  x2={INNER_WIDTH}
                  y1={tick.y}
                  y2={tick.y}
                  stroke="rgba(148,163,184,0.12)"
                  strokeWidth={1}
                />
              ))}

              {/* Power-law curve for selected view */}
              <path
                d={plotState.curvePath}
                fill="none"
                stroke={
                  xMode === 'compute'
                    ? 'url(#frontierGlow)'
                    : plotState.lineColor
                }
                strokeWidth={xMode === 'compute' ? 3.2 : 2.4}
                strokeLinecap="round"
              />

              {/* Slider vertical line & optimal point */}
              <line
                x1={plotState.sliderX}
                x2={plotState.sliderX}
                y1={0}
                y2={INNER_HEIGHT}
                stroke="rgba(249,250,251,0.55)"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
              <circle
                cx={plotState.sliderX}
                cy={plotState.sliderY}
                r={6}
                fill="#0b1120"
                stroke={plotState.lineColor}
                strokeWidth={2}
              />

              {/* Model points */}
              {plotState.modelPoints.map(m => (
                <g key={m.id}>
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={6.5}
                    fill="#020617"
                    stroke={m.color}
                    strokeWidth={2}
                  />
                  <circle
                    cx={m.x}
                    cy={m.y}
                    r={10}
                    fill="none"
                    stroke={
                      m.id === 'gpt3'
                        ? 'rgba(248,113,113,0.45)'
                        : 'rgba(148,163,184,0.25)'
                    }
                    strokeWidth={m.id === 'gpt3' ? 2 : 1}
                  />
                  <text
                    x={m.x + 10}
                    y={m.y - 6}
                    fill="#e5e7eb"
                    fontSize={11}
                  >
                    {m.label}
                  </text>
                  {xMode === 'compute' && m.id === 'gpt3' && (
                    <text
                      x={m.x + 10}
                      y={m.y + 9}
                      fill="#fca5a5"
                      fontSize={10}
                    >
                      over‑parameterized for {formatSci(m.C)}
                    </text>
                  )}
                  {xMode === 'compute' && m.id === 'chinchilla' && (
                    <text
                      x={m.x + 10}
                      y={m.y + 9}
                      fill="#bbf7d0"
                      fontSize={10}
                    >
                      near compute‑optimal frontier
                    </text>
                  )}
                </g>
              ))}

              {/* Axes */}
              {/* X axis line */}
              <line
                x1={0}
                x2={INNER_WIDTH}
                y1={INNER_HEIGHT}
                y2={INNER_HEIGHT}
                stroke="rgba(209,213,219,0.9)"
                strokeWidth={1.5}
              />
              {/* X ticks & labels */}
              {plotState.xTicks.map(tick => (
                <g key={`x-axis-${tick.value}`}>
                  <line
                    x1={tick.x}
                    x2={tick.x}
                    y1={INNER_HEIGHT}
                    y2={INNER_HEIGHT + 6}
                    stroke="rgba(209,213,219,0.9)"
                    strokeWidth={1}
                  />
                  <text
                    x={tick.x}
                    y={INNER_HEIGHT + 18}
                    fill="#9ca3af"
                    fontSize={10}
                    textAnchor="middle"
                  >
                    {formatSci(tick.value)}
                  </text>
                </g>
              ))}
              <text
                x={INNER_WIDTH / 2}
                y={INNER_HEIGHT + 36}
                fill="#e5e7eb"
                fontSize={11}
                textAnchor="middle"
              >
                {plotState.xLabel}
              </text>

              {/* Y axis line */}
              <line
                x1={0}
                x2={0}
                y1={0}
                y2={INNER_HEIGHT}
                stroke="rgba(209,213,219,0.9)"
                strokeWidth={1.5}
              />
              {/* Y ticks & labels */}
              {plotState.yTicks.map(tick => (
                <g key={`y-axis-${tick.value}`}>
                  <line
                    x1={-6}
                    x2={0}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="rgba(209,213,219,0.9)"
                    strokeWidth={1}
                  />
                  <text
                    x={-10}
                    y={tick.y + 3}
                    fill="#9ca3af"
                    fontSize={10}
                    textAnchor="end"
                  >
                    {tick.value.toFixed(2)}
                  </text>
                </g>
              ))}
              <text
                x={-56}
                y={INNER_HEIGHT / 2}
                fill="#e5e7eb"
                fontSize={11}
                transform={`rotate(-90, -56, ${INNER_HEIGHT / 2})`}
                textAnchor="middle"
              >
                {plotState.yLabel}
              </text>

              {/* Curve label */}
              <text
                x={12}
                y={16}
                fill={plotState.lineColor}
                fontSize={11}
              >
                {plotState.curveLabel}
              </text>
            </g>
          </svg>
        </div>

        {/* Controls / legend / model summaries */}
        <div className="neural-scaling-controls" style={{ fontSize: '0.9rem' }}>
          {/* X-mode toggle */}
          <div
            className="ns-toggle"
            style={{
              display: 'inline-flex',
              borderRadius: '999px',
              padding: '2px',
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(148,163,184,0.4)',
              marginBottom: '12px',
            }}
          >
            {(
              [
                ['compute', 'Loss vs compute C'],
                ['params', 'Loss vs params N'],
                ['data', 'Loss vs data D'],
              ] as [XMode, string][]
            ).map(([mode, label]) => {
              const active = xMode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setXMode(mode)}
                  style={{
                    border: 'none',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    background: active
                      ? 'rgba(15,118,110,0.3)'
                      : 'transparent',
                    color: active ? '#e5e7eb' : '#9ca3af',
                    transition: 'background 120ms ease, color 120ms ease',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Equations summary */}
          <p
            style={{
              color: '#9ca3af',
              marginBottom: '10px',
              lineHeight: 1.4,
            }}
          >
            Power‑law scaling (schematic):
            <br />
            <code>{'L(N) ∝ N^{-α}'}</code>, <code>{'L(D) ∝ D^{-β}'}</code>,{' '}
            <code>{'L(C) ∝ C^{-γ}'}</code> with{' '}
            <code>α ≈ 0.08</code>, <code>β ≈ 0.10</code>,{' '}
            <code>γ ≈ 0.05</code>.
          </p>

          {/* Compute slider + optimal N,D */}
          <div
            className="ns-slider-block"
            style={{
              padding: '10px 12px',
              borderRadius: '12px',
              background:
                'radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 55%), rgba(15,23,42,0.95)',
              border: '1px solid rgba(55,65,81,0.9)',
              marginBottom: '12px',
            }}
          >
            <label
              style={{
                display: 'block',
                fontSize: '0.78rem',
                color: '#d1d5db',
                marginBottom: '4px',
              }}
            >
              Compute budget C (FLOPs):{' '}
              <span style={{ color: MATH_COLORS.primary }}>
                {formatSci(computeBudget)}
              </span>
            </label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={computeSlider}
              onChange={e => setComputeSlider(Number(e.target.value))}
              style={{ width: '100%' }}
            />
            <div
              style={{
                display: 'flex',
                gap: '8px',
                marginTop: '8px',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ flex: '1 1 120px' }}>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  Optimal parameters N<sub>opt</sub>(C)
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
                  {formatParams(currentNOpt)} params
                </div>
              </div>
              <div style={{ flex: '1 1 120px' }}>
                <div
                  style={{
                    fontSize: '0.7rem',
                    color: '#9ca3af',
                    marginBottom: 2,
                  }}
                >
                  Optimal data D<sub>opt</sub>(C)
                </div>
                <div style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
                  {formatTokens(currentDOpt)} tokens
                </div>
              </div>
            </div>
            <p
              className="caption"
              style={{
                fontSize: '0.72rem',
                color: '#9ca3af',
                marginTop: '6px',
              }}
            >
              Along the Chinchilla frontier, doubling compute roughly doubles
              both <code>N</code> and <code>D</code>, keeping{' '}
              <code>D/N ≈ 20</code> tokens per parameter for large LLMs.
            </p>
          </div>

          {/* Model summaries */}
          <div
            style={{
              padding: '8px 10px',
              borderRadius: '12px',
              background: 'rgba(15,23,42,0.9)',
              border: '1px solid rgba(55,65,81,0.9)',
              marginBottom: '8px',
            }}
          >
            {plotState.modelPoints.map(m => (
              <div
                key={m.id}
                style={{
                  borderBottom:
                    m.id === 'llama65'
                      ? 'none'
                      : '1px solid rgba(31,41,55,0.9)',
                  paddingBottom: '6px',
                  marginBottom: '6px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    marginBottom: '2px',
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '999px',
                      backgroundColor: m.color,
                    }}
                  />
                  <span style={{ color: '#e5e7eb', fontSize: '0.85rem' }}>
                    {m.label}
                  </span>
                  {m.id === 'gpt3' && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: 'rgba(248,113,113,0.18)',
                        color: '#fecaca',
                      }}
                    >
                      over‑parameterized
                    </span>
                  )}
                  {m.id === 'chinchilla' && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: 'rgba(34,197,94,0.18)',
                        color: '#bbf7d0',
                      }}
                    >
                      compute‑optimal
                    </span>
                  )}
                  {m.id === 'llama65' && (
                    <span
                      style={{
                        marginLeft: 'auto',
                        fontSize: '0.7rem',
                        padding: '1px 6px',
                        borderRadius: '999px',
                        background: 'rgba(56,189,248,0.18)',
                        color: '#bae6fd',
                      }}
                    >
                      near‑optimal
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: '0.76rem',
                    color: '#9ca3af',
                    marginBottom: '1px',
                  }}
                >
                  N = {formatParams(m.N)} params, D = {formatTokens(m.D)} tokens
                </div>
                <div style={{ fontSize: '0.76rem', color: '#9ca3af' }}>
                  N / N<sub>opt</sub> ≈{' '}
                  <span style={{ color: '#e5e7eb' }}>
                    {formatRatio(m.rN)}
                  </span>
                  , D / D<sub>opt</sub> ≈{' '}
                  <span style={{ color: '#e5e7eb' }}>
                    {formatRatio(m.rD)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <p
            className="caption"
            style={{ fontSize: '0.72rem', color: '#9ca3af' }}
          >
            In the Chinchilla picture, GPT‑3 (175B, 300B tokens) sits several×
            above the compute‑optimal frontier for its training FLOPs (too many
            parameters, not enough tokens), while Chinchilla (70B, 1.4T tokens)
            and LLaMA‑65B (65B, 1.4T tokens) are much closer to{' '}
            <code>N_opt(C)</code> and <code>D_opt(C)</code> for similar compute
            budgets.
          </p>
        </div>
      </div>
    </section>
  )
}
