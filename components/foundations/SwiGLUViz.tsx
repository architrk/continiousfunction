'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import * as d3 from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'
import { emitDemoState } from '../../lib/demoState'

type GamePhase = 'setup' | 'countdown' | 'reveal'
type ActivationType = 'relu' | 'gelu' | 'silu' | 'swiglu'
type GateRegime = 'suppress' | 'pass' | 'amplify'
type NotebookPrediction = GateRegime | null

type SwiGLUVizProps = {
  chrome?: 'legacy' | 'notebook'
  conceptId?: string
}

// Challenge scenarios for activation prediction
const ACTIVATION_CHALLENGES = [
  { name: '🔢 x = -1.5', x: -1.5, hint: 'Negative input - how do gates behave?' },
  { name: '⚡ x = 0.5', x: 0.5, hint: 'Small positive - which wins?' },
  { name: '🚀 x = 2.0', x: 2.0, hint: 'Larger positive - does gating help?' },
  { name: '🎲 Mystery x', x: -999, hint: 'Random challenge!' },
]

function getActivationPredictionFeedback(
  predicted: ActivationType,
  actual: ActivationType,
  x: number
): string {
  const explanations: Record<ActivationType, string> = {
    'relu': 'ReLU simply clips negative values to 0. For positive x, it\'s linear (output = x).',
    'gelu': 'GELU is smooth everywhere. It allows small negative flow and matches ReLU asymptotically for large x.',
    'silu': 'SiLU (Swish) = x·σ(x). The sigmoid gate smoothly modulates the linear part.',
    'swiglu': 'SwiGLU multiplies value × gate, creating a parabolic shape that grows faster than others for larger x.',
  }

  if (predicted === actual) {
    return `Correct! ${explanations[actual]} At x=${x.toFixed(1)}, this gives the highest output.`
  }

  return `Not quite! ${actual.toUpperCase()} wins here. ${explanations[actual]}`
}

const WIDTH = 520
const HEIGHT = 320
const PADDING = { top: 24, right: 16, bottom: 36, left: 40 }

const BRANCH_WIDTH = 360
const BRANCH_HEIGHT = 180
const BRANCH_PADDING = { top: 20, right: 16, bottom: 28, left: 36 }

const X_MIN = -3
const X_MAX = 3
const NUM_SAMPLES = 256

type Point = { x: number; y: number }

const COLORS = {
  relu: '#6b7280',
  gelu: '#3b82f6',
  silu: '#8b5cf6',
  swiglu: '#f59e0b',
}

const NOTEBOOK_PRESETS = [
  {
    id: 'token-a',
    label: 'Token A',
    prompt: 'Residual stream has a faint syntax feature and a strong local noun signal.',
    channels: [
      { id: 'c1', label: 'channel 1', feature: 'syntax feature', v: 1.12, g: -1.45 },
      { id: 'c2', label: 'channel 2', feature: 'noun feature', v: 0.82, g: 0.95 },
      { id: 'c3', label: 'channel 3', feature: 'rare pattern feature', v: 0.64, g: 1.82 },
    ],
  },
  {
    id: 'token-b',
    label: 'Token B',
    prompt: 'Residual stream carries a negation cue and a weak entity feature.',
    channels: [
      { id: 'c1', label: 'channel 1', feature: 'negation feature', v: -0.94, g: 0.18 },
      { id: 'c2', label: 'channel 2', feature: 'entity feature', v: 0.76, g: 1.08 },
      { id: 'c3', label: 'channel 3', feature: 'template feature', v: -0.58, g: 1.64 },
    ],
  },
  {
    id: 'token-c',
    label: 'Token C',
    prompt: 'Residual stream has an arithmetic feature competing with a discourse feature.',
    channels: [
      { id: 'c1', label: 'channel 1', feature: 'arithmetic feature', v: 1.26, g: 0.72 },
      { id: 'c2', label: 'channel 2', feature: 'discourse feature', v: -0.72, g: -0.82 },
      { id: 'c3', label: 'channel 3', feature: 'copy feature', v: 0.88, g: 1.46 },
    ],
  },
] as const

const GATE_CHOICES: Array<{ id: GateRegime; label: string; detail: string }> = [
  {
    id: 'suppress',
    label: 'suppress',
    detail: 'The multiplier is below 0.55x, or the gate is small or sign-flipping.',
  },
  {
    id: 'pass',
    label: 'pass',
    detail: 'The multiplier stays in the 0.55x to 1.10x pass band.',
  },
  {
    id: 'amplify',
    label: 'amplify',
    detail: 'The multiplier is above 1.10x, so the value proposal grows.',
  },
]

// --- Activation functions ----------------------------------------------------

function relu(x: number): number {
  return x > 0 ? x : 0
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function gelu(x: number): number {
  // Gaussian Error Linear Unit (tanh approximation)
  const c = Math.sqrt(2 / Math.PI)
  const inner = c * (x + 0.044715 * Math.pow(x, 3))
  return 0.5 * x * (1 + Math.tanh(inner))
}

function silu(x: number): number {
  return x * sigmoid(x)
}

// 1D toy SwiGLU: value(x) ⊙ gate(x), where gate uses Swish/SiLU
function swigluValueBranch(x: number): number {
  return x
}

function swigluGateBranch(x: number): number {
  // Swish gate
  return silu(x)
}

function swigluCombined(x: number): number {
  return swigluValueBranch(x) * swigluGateBranch(x)
}

function generateSamples(fn: (x: number) => number): Point[] {
  const samples: Point[] = []
  for (let i = 0; i <= NUM_SAMPLES; i++) {
    const t = i / NUM_SAMPLES
    const x = X_MIN + (X_MAX - X_MIN) * t
    samples.push({ x, y: fn(x) })
  }
  return samples
}

function formatNumber(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 })
}

function fmtNotebook(n: number, digits = 3): string {
  const clean = Math.abs(n) < 0.0005 ? 0 : n
  return clean.toFixed(digits)
}

function fmtSigned(n: number, digits = 3): string {
  const clean = Math.abs(n) < 0.0005 ? 0 : n
  return `${clean > 0 ? '+' : ''}${clean.toFixed(digits)}`
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function rangePercent(value: number, min: number, max: number): number {
  return clamp01((value - min) / (max - min)) * 100
}

function classifyGateRegime(gateCoefficient: number): GateRegime {
  if (gateCoefficient < 0.55) return 'suppress'
  if (gateCoefficient > 1.1) return 'amplify'
  return 'pass'
}

function gateRegimeSentence(regime: GateRegime): string {
  if (regime === 'suppress') {
    return 'The gate coefficient is small, so the product is damped before the output projection.'
  }
  if (regime === 'amplify') {
    return 'The SiLU gate is above 1.10x, so the product is larger than the raw value proposal.'
  }
  return 'The gate coefficient sits near one, so the value proposal mostly passes through.'
}

function gateRegimeLabel(regime: GateRegime): string {
  if (regime === 'suppress') return 'suppressed'
  if (regime === 'amplify') return 'amplified'
  return 'passed'
}

// --- Main component ---------------------------------------------------------

export default function ActivationFunctionExplorer({
  chrome = 'legacy',
  conceptId = 'swiglu',
}: SwiGLUVizProps = {}) {
  const isNotebook = chrome === 'notebook'
  const [hoverX, setHoverX] = useState(0)
  const [dModel, setDModel] = useState(1024)

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof ACTIVATION_CHALLENGES[0] | null>(null)
  const [challengeX, setChallengeX] = useState(0)
  const [userPrediction, setUserPrediction] = useState<ActivationType | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [feedback, setFeedback] = useState('')
  const [notebookPresetId, setNotebookPresetId] = useState<string>(NOTEBOOK_PRESETS[0].id)
  const [notebookChannelId, setNotebookChannelId] = useState<string>(NOTEBOOK_PRESETS[0].channels[0].id)
  const [notebookPrediction, setNotebookPrediction] = useState<NotebookPrediction>(null)
  const [revealedSelectionKey, setRevealedSelectionKey] = useState<string | null>(null)

  const notebookPreset = useMemo(
    () => NOTEBOOK_PRESETS.find((preset) => preset.id === notebookPresetId) ?? NOTEBOOK_PRESETS[0],
    [notebookPresetId]
  )
  const notebookChannel = useMemo(
    () => notebookPreset.channels.find((channel) => channel.id === notebookChannelId) ?? notebookPreset.channels[0],
    [notebookChannelId, notebookPreset]
  )

  const resetNotebookReveal = useCallback((clearPrediction = true) => {
    if (clearPrediction) setNotebookPrediction(null)
    setRevealedSelectionKey(null)
  }, [])

  const applyNotebookPreset = useCallback((presetId: string) => {
    const nextPreset = NOTEBOOK_PRESETS.find((preset) => preset.id === presetId) ?? NOTEBOOK_PRESETS[0]
    setNotebookPresetId(nextPreset.id)
    setNotebookChannelId(nextPreset.channels[0].id)
    resetNotebookReveal()
  }, [resetNotebookReveal])

  const applyNotebookChannel = useCallback((channelId: string) => {
    setNotebookChannelId(channelId)
    resetNotebookReveal()
  }, [resetNotebookReveal])

  // Determine which activation wins at a given x value
  const getWinningActivation = useCallback((x: number): ActivationType => {
    const values = {
      relu: relu(x),
      gelu: gelu(x),
      silu: silu(x),
      swiglu: swigluCombined(x)
    }
    let maxKey: ActivationType = 'relu'
    let maxVal = values.relu
    for (const [key, val] of Object.entries(values) as [ActivationType, number][]) {
      if (val > maxVal) {
        maxVal = val
        maxKey = key
      }
    }
    return maxKey
  }, [])

  // Apply a challenge scenario
  const applyChallenge = useCallback((challenge: typeof ACTIVATION_CHALLENGES[0]) => {
    setSelectedChallenge(challenge)
    let x = challenge.x
    if (challenge.name.includes('Mystery')) {
      // Random x from interesting range
      const options = [-2.0, -1.0, 0.3, 1.0, 1.5, 2.5]
      x = options[Math.floor(Math.random() * options.length)]
    }
    setChallengeX(x)
    setUserPrediction(null)
    setFeedback('')
    setGamePhase('setup')
  }, [])

  // Start the prediction game
  const startChallenge = useCallback(() => {
    if (!userPrediction) return
    setGamePhase('countdown')
    setCountdown(3)
  }, [userPrediction])

  // Reset the game
  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setUserPrediction(null)
    setFeedback('')
    setChallengeX(0)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 800)
      return () => clearTimeout(timer)
    } else {
      // Reveal the answer
      const winner = getWinningActivation(challengeX)
      setFeedback(getActivationPredictionFeedback(userPrediction!, winner, challengeX))
      setHoverX(challengeX) // Move the visualization to the challenge x
      setGamePhase('reveal')
    }
  }, [gamePhase, countdown, challengeX, userPrediction, getWinningActivation])

  // Sample curves
  const reluSamples = useMemo(() => generateSamples(relu), [])
  const geluSamples = useMemo(() => generateSamples(gelu), [])
  const siluSamples = useMemo(() => generateSamples(silu), [])
  const swigluSamples = useMemo(() => generateSamples(swigluCombined), [])
  const valueBranchSamples = useMemo(() => generateSamples(swigluValueBranch), [])
  const gateBranchSamples = useMemo(() => generateSamples(swigluGateBranch), [])

  // Shared y-domain for main chart (includes SwiGLU, which has largest magnitude)
  const [yMin, yMax] = useMemo(() => {
    const all = [...reluSamples, ...geluSamples, ...siluSamples, ...swigluSamples]
    let min = Infinity
    let max = -Infinity
    all.forEach(p => {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
    })
    const pad = (max - min) * 0.1 || 1
    return [min - pad, max + pad]
  }, [reluSamples, geluSamples, siluSamples, swigluSamples])

  // Scales for main chart
  const xScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([X_MIN, X_MAX])
        .range([PADDING.left, WIDTH - PADDING.right]),
    []
  )

  const yScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([HEIGHT - PADDING.bottom, PADDING.top]),
    [yMin, yMax]
  )

  const lineMain = useMemo(
    () =>
      d3
        .line<Point>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom),
    [xScale, yScale]
  )

  const xTicks = useMemo(() => d3.ticks(X_MIN, X_MAX, 6), [])
  const yTicks = useMemo(() => d3.ticks(yMin, yMax, 5), [yMin, yMax])

  // SwiGLU branch chart scales
  const branchYDomain = useMemo(() => {
    const all = [...valueBranchSamples, ...gateBranchSamples, ...swigluSamples]
    let min = Infinity
    let max = -Infinity
    all.forEach(p => {
      if (p.y < min) min = p.y
      if (p.y > max) max = p.y
    })
    const pad = (max - min) * 0.1 || 1
    return [min - pad, max + pad]
  }, [valueBranchSamples, gateBranchSamples, swigluSamples])

  const branchXScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain([X_MIN, X_MAX])
        .range([BRANCH_PADDING.left, BRANCH_WIDTH - BRANCH_PADDING.right]),
    []
  )

  const branchYScale = useMemo(
    () =>
      d3
        .scaleLinear()
        .domain(branchYDomain)
        .range([BRANCH_HEIGHT - BRANCH_PADDING.bottom, BRANCH_PADDING.top]),
    [branchYDomain]
  )

  const lineBranch = useMemo(
    () =>
      d3
        .line<Point>()
        .x(d => branchXScale(d.x))
        .y(d => branchYScale(d.y))
        .curve(d3.curveCatmullRom),
    [branchXScale, branchYScale]
  )

  // Values at current x
  const x = hoverX
  const reluVal = relu(x)
  const geluVal = gelu(x)
  const sigVal = sigmoid(x)
  const siluVal = silu(x)
  const valueBranchVal = swigluValueBranch(x)
  const gateBranchVal = swigluGateBranch(x)
  const swigluVal = swigluCombined(x)

  // Gate "openness" for metaphor (normalized 0-1 via sigmoid)
  const gateOpen = sigmoid(x)

  // Param-count comparison (2/3 hidden dim scaling)
  const ffnMultiplier = 4 // standard Transformer FFN expansion
  const dFFReLU = ffnMultiplier * dModel
  const paramsReLU = 2 * dModel * dFFReLU // W1 + W2
  const dFFSwiGLU = Math.round((2 / 3) * dFFReLU)
  const paramsSwiGLU = 3 * dModel * dFFSwiGLU // Wv, Wg, Wo
  const paramRatio = paramsSwiGLU / paramsReLU
  const notebookSelectionKey = `${notebookPreset.id}:${notebookChannel.id}:${dModel}`
  const notebookRevealed = revealedSelectionKey === notebookSelectionKey
  const notebookGateCoefficient = silu(notebookChannel.g)
  const notebookProduct = notebookChannel.v * notebookGateCoefficient
  const notebookRegime = classifyGateRegime(notebookGateCoefficient)
  const notebookPredictionCorrect = notebookRevealed && notebookPrediction
    ? notebookPrediction === notebookRegime
    : null
  const notebookWrite = useMemo(
    () => [
      notebookProduct * 0.58,
      notebookProduct * -0.34,
      notebookProduct * 0.22,
    ],
    [notebookProduct]
  )
  const notebookProductRatio = Math.abs(notebookProduct) / Math.max(0.01, Math.abs(notebookChannel.v))

  useEffect(() => {
    if (!isNotebook) return

    const values = [
      `preset: ${notebookPreset.label}`,
      `channel: ${notebookChannel.label}`,
      `visible value v_i: ${fmtSigned(notebookChannel.v)}`,
      `visible gate logit g_i: ${fmtSigned(notebookChannel.g)}`,
      `prediction: ${notebookPrediction ?? 'none'}`,
      `revealed: ${notebookRevealed ? 'yes' : 'no'}`,
    ]

    if (notebookRevealed) {
      values.push(
        `actual gate regime: ${notebookRegime}`,
        `SiLU(g_i): ${fmtNotebook(notebookGateCoefficient)}`,
        `v_i * SiLU(g_i): ${fmtSigned(notebookProduct)}`,
        `selected-channel contribution: [${notebookWrite.map((value) => fmtSigned(value)).join(', ')}]`,
        `parameter-budget ratio: ${(paramRatio * 100).toFixed(1)}%`
      )
    }

    emitDemoState({
      conceptId,
      label: 'SwiGLU gated-MLP prediction',
      summary: notebookRevealed
        ? `${notebookPreset.label} ${notebookChannel.label} was ${gateRegimeLabel(notebookRegime)}: product ${fmtSigned(notebookProduct)} after SiLU gate ${fmtNotebook(notebookGateCoefficient)}.`
        : 'Predict whether the visible value proposal will be suppressed, passed, or amplified by the hidden SiLU gate.',
      values,
    })
  }, [
    conceptId,
    isNotebook,
    notebookChannel.g,
    notebookChannel.label,
    notebookChannel.v,
    notebookGateCoefficient,
    notebookPrediction,
    notebookPreset.label,
    notebookProduct,
    notebookRegime,
    notebookRevealed,
    notebookWrite,
    paramRatio,
  ])

  const handleMouseMove = (event: React.MouseEvent<SVGRectElement, MouseEvent>) => {
    const rect = (event.currentTarget as SVGRectElement).getBoundingClientRect()
    const px = event.clientX - rect.left
    const clamped = Math.max(PADDING.left, Math.min(WIDTH - PADDING.right, px))
    const domainX = xScale.invert(clamped)
    setHoverX(domainX)
  }

  const handleMouseLeave = () => {
    // Snap back to center when leaving the chart
    setHoverX(0)
  }

  if (isNotebook) {
    const valuePercent = rangePercent(notebookChannel.v, -1.5, 1.5)
    const gatePercent = rangePercent(notebookChannel.g, -2, 2)
    const coeffPercent = rangePercent(notebookGateCoefficient, -0.35, 1.8)
    const productPercent = rangePercent(notebookProduct, -1.4, 1.4)

    return (
      <div className="demo swiglu-notebook" data-swiglu-notebook="true">
        <div className="preset-grid" role="group" aria-label="SwiGLU token presets">
          {NOTEBOOK_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              aria-pressed={notebookPreset.id === preset.id}
              onClick={() => applyNotebookPreset(preset.id)}
            >
              <span>{preset.label}</span>
              <small>{preset.prompt}</small>
            </button>
          ))}
        </div>

        <div className="channel-strip" role="group" aria-label="Choose highlighted MLP channel">
          {notebookPreset.channels.map((channel) => (
            <button
              key={channel.id}
              type="button"
              aria-pressed={notebookChannel.id === channel.id}
              onClick={() => applyNotebookChannel(channel.id)}
            >
              <span>{channel.label}</span>
              <small>{channel.feature}</small>
            </button>
          ))}
        </div>

        <div className="stage-grid">
          <section className="panel branch-panel" aria-label="Visible value and gate branches">
            <div className="panel-heading">
              <p className="eyebrow">selected channel</p>
              <h3>{notebookPreset.label} / {notebookChannel.label}</h3>
              <p>{notebookChannel.feature}</p>
            </div>

            <div className="branch-row">
              <div>
                <span>value branch</span>
                <strong>v_i = {fmtSigned(notebookChannel.v)}</strong>
              </div>
              <div className="axis-bar" aria-hidden="true">
                <span className="zero" style={{ left: `${rangePercent(0, -1.5, 1.5)}%` }} />
                <span className="marker value" style={{ left: `${valuePercent}%` }} />
              </div>
            </div>

            <div className="branch-row">
              <div>
                <span>gate logit</span>
                <strong>g_i = {fmtSigned(notebookChannel.g)}</strong>
              </div>
              <div className="axis-bar" aria-hidden="true">
                <span className="zero" style={{ left: `${rangePercent(0, -2, 2)}%` }} />
                <span className="marker gate" style={{ left: `${gatePercent}%` }} />
              </div>
            </div>

            <div className="pipeline" aria-label="SwiGLU channel pipeline">
              <svg viewBox="0 0 620 190" role="img" aria-label="Value and gate projections multiply before the output projection">
                <defs>
                  <marker id="swiglu-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
                    <path d="M0,0 L8,4 L0,8 Z" fill="#536170" />
                  </marker>
                </defs>
                <g className="pipe-lines" fill="none" stroke="#536170" strokeWidth="2" markerEnd="url(#swiglu-arrow)">
                  <path d="M104 64 H170" />
                  <path d="M104 126 H170" />
                  <path d="M272 64 C338 64 390 82 440 92" />
                  <path d="M272 126 H330" />
                  <path d="M416 126 C434 126 440 110 444 101" />
                  <path d="M484 96 H526" />
                </g>
                <g className="pipe-node input">
                  <rect x="24" y="76" width="80" height="40" rx="8" />
                  <text x="64" y="101">x</text>
                </g>
                <g className="pipe-node value">
                  <rect x="170" y="42" width="102" height="44" rx="8" />
                  <text x="221" y="61">xW_v</text>
                  <text x="221" y="77">{fmtSigned(notebookChannel.v)}</text>
                </g>
                <g className="pipe-node gate">
                  <rect x="170" y="104" width="102" height="44" rx="8" />
                  <text x="221" y="123">xW_g</text>
                  <text x="221" y="139">{fmtSigned(notebookChannel.g)}</text>
                </g>
                <g className={`pipe-node hidden ${notebookRevealed ? 'revealed' : ''}`}>
                  <rect x="330" y="104" width="86" height="44" rx="8" />
                  <text x="373" y="123">SiLU(g_i)</text>
                  <text x="373" y="139">{notebookRevealed ? fmtNotebook(notebookGateCoefficient) : 'hidden'}</text>
                </g>
                <g className="pipe-node multiply">
                  <circle cx="462" cy="96" r="22" />
                  <text x="462" y="101">mul</text>
                </g>
                <g className={`pipe-node product ${notebookRevealed ? 'revealed' : ''}`}>
                  <rect x="526" y="74" width="82" height="44" rx="8" />
                  <text x="567" y="93">v_i * gate</text>
                  <text x="567" y="110">{notebookRevealed ? fmtSigned(notebookProduct) : 'locked'}</text>
                </g>
              </svg>
            </div>
          </section>

          <section className="panel predict-panel">
            <p className="eyebrow">prediction check</p>
            <h3>What will the gate do to the value?</h3>
            <p className="rubric">
              Judge by |v_i * SiLU(g_i)| / |v_i|: suppress below 0.55x,
              pass from 0.55x to 1.10x, amplify above 1.10x. A negative
              SiLU gate can flip sign and still counts as suppression here.
            </p>
            <div className="prediction-grid" role="group" aria-label="Predict SwiGLU gate regime">
              {GATE_CHOICES.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={notebookPrediction === choice.id}
                  onClick={() => {
                    setNotebookPrediction(choice.id)
                    setRevealedSelectionKey(null)
                  }}
                >
                  <span>{choice.label}</span>
                  <small>{choice.detail}</small>
                </button>
              ))}
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={!notebookPrediction}
                onClick={() => setRevealedSelectionKey(notebookSelectionKey)}
              >
                Reveal gate
              </button>
              <button type="button" className="ghost" onClick={() => resetNotebookReveal()}>
                Reset
              </button>
            </div>

            <div
              className={`reveal-readout ${notebookRevealed ? 'shown' : ''}`}
              role="status"
              aria-live="polite"
            >
              {notebookRevealed ? (
                <>
                  <strong>
                    {notebookPredictionCorrect ? 'Prediction matched: ' : 'Prediction missed: '}
                    the channel was {gateRegimeLabel(notebookRegime)}.
                  </strong>
                  <p>{gateRegimeSentence(notebookRegime)}</p>
                </>
              ) : (
                <p>SiLU(g_i), the product, and the selected-channel contribution are hidden until reveal.</p>
              )}
            </div>
          </section>
        </div>

        <div className="outcome-grid">
          <section className="panel coefficient-panel">
            <p className="eyebrow">hidden transform</p>
            <h3>Gate coefficient and product</h3>
            <div className="metric-row">
              <span>SiLU(g_i)</span>
              <strong>{notebookRevealed ? fmtNotebook(notebookGateCoefficient) : 'hidden'}</strong>
            </div>
            {notebookRevealed ? (
              <div className="axis-bar outcome" aria-label={`SiLU coefficient ${fmtNotebook(notebookGateCoefficient)}`}>
                <span className="zero" style={{ left: `${rangePercent(0, -0.35, 1.8)}%` }} />
                <span className="marker gate" style={{ left: `${coeffPercent}%` }} />
              </div>
            ) : null}

            <div className="metric-row">
              <span>v_i * SiLU(g_i)</span>
              <strong>{notebookRevealed ? fmtSigned(notebookProduct) : 'hidden'}</strong>
            </div>
            {notebookRevealed ? (
              <div className="axis-bar outcome" aria-label={`SwiGLU product ${fmtSigned(notebookProduct)}`}>
                <span className="zero" style={{ left: `${rangePercent(0, -1.4, 1.4)}%` }} />
                <span className="marker product" style={{ left: `${productPercent}%` }} />
              </div>
            ) : null}

            <p className="small-copy">
              {notebookRevealed
                ? `Magnitude ratio |product| / |value| = ${fmtNotebook(notebookProductRatio, 2)}.`
                : 'Before reveal, the chart uses fixed public ranges and does not encode the hidden product.'}
            </p>
          </section>

          <section className="panel write-panel">
            <p className="eyebrow">selected-channel contribution</p>
            <h3>This channel fans out through the output projection</h3>
            {notebookRevealed ? (
              <>
                <div className="write-bars" aria-label="Toy selected-channel output-projection contribution vector">
                  {notebookWrite.map((value, index) => (
                    <div key={index} className="write-row">
                      <span>delta h{index + 1}</span>
                      <div className="track">
                        <span className="zero" style={{ left: '50%' }} />
                        <span
                          className={`fill ${value >= 0 ? 'pos' : 'neg'}`}
                          style={{
                            left: value >= 0 ? '50%' : `${50 - Math.min(48, Math.abs(value) * 36)}%`,
                            width: `${Math.min(48, Math.abs(value) * 36)}%`,
                          }}
                        />
                      </div>
                      <code>{fmtSigned(value)}</code>
                    </div>
                  ))}
                </div>
                <p className="small-copy">
                  This is one selected channel's contribution. A full MLP write sums contributions from all hidden channels.
                </p>
              </>
            ) : (
              <p className="small-copy">
                This is one selected channel's contribution. A full MLP write sums contributions from all hidden channels.
              </p>
            )}
          </section>

          <section className="panel budget-panel">
            <p className="eyebrow">parameter budget</p>
            <h3>Why the hidden width is often scaled down</h3>
            <label>
              <span>d_model: {formatNumber(dModel)}</span>
              <input
                type="range"
                min={128}
                max={4096}
                step={64}
                value={dModel}
                onChange={(event) => {
                  resetNotebookReveal(false)
                  setDModel(parseInt(event.target.value, 10))
                }}
              />
            </label>
            <div className="budget-comparison">
              <div>
                <span>2-matrix FFN</span>
                <strong>{formatNumber(paramsReLU)}</strong>
                <small>2 * d_model * d_ff</small>
              </div>
              <div>
                <span>SwiGLU FFN</span>
                <strong>{formatNumber(paramsSwiGLU)}</strong>
                <small>3 * d_model * d_ff'</small>
              </div>
            </div>
            <p className="small-copy">
              With d_ff' about two thirds of a 4x FFN, this toy budget is {(paramRatio * 100).toFixed(1)}% of the two-matrix block.
            </p>
          </section>
        </div>

        <style jsx>{`
          .swiglu-notebook {
            display: grid;
            gap: 0.75rem;
            min-width: 0;
            padding: 0.75rem;
            color: #17202a;
          }

          .preset-grid,
          .channel-strip,
          .prediction-grid {
            display: grid;
            gap: 0.55rem;
          }

          .preset-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .channel-strip,
          .prediction-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          button {
            min-width: 0;
            border: 1px solid rgba(27, 36, 48, 0.12);
            border-radius: 8px;
            background: rgba(255, 252, 246, 0.9);
            color: #1b2430;
            cursor: pointer;
            font: inherit;
            padding: 0.6rem;
            text-align: left;
          }

          button[aria-pressed='true'] {
            border-color: rgba(31, 111, 120, 0.46);
            background: rgba(31, 111, 120, 0.12);
          }

          button:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          button span {
            display: block;
            font-size: 0.82rem;
            font-weight: 800;
            line-height: 1.22;
          }

          button small {
            display: block;
            margin-top: 0.28rem;
            color: #65717d;
            font-size: 0.7rem;
            line-height: 1.32;
          }

          .stage-grid,
          .outcome-grid {
            display: grid;
            gap: 0.75rem;
            min-width: 0;
          }

          .stage-grid {
            grid-template-columns: minmax(0, 1.3fr) minmax(16rem, 0.7fr);
          }

          .outcome-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .panel {
            min-width: 0;
            border: 1px solid rgba(27, 36, 48, 0.1);
            border-radius: 8px;
            background: rgba(255, 252, 246, 0.86);
            padding: 0.75rem;
            overflow-wrap: anywhere;
          }

          .panel-heading,
          .predict-panel,
          .coefficient-panel,
          .write-panel,
          .budget-panel {
            display: grid;
            gap: 0.58rem;
          }

          .eyebrow {
            margin: 0;
            color: #1f6f78;
            font-family: var(--font-mono);
            font-size: 0.68rem;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
          }

          h3,
          p {
            margin: 0;
          }

          h3 {
            color: #17202a;
            font-size: 0.96rem;
            line-height: 1.25;
          }

          .panel-heading p:not(.eyebrow),
          .rubric,
          .small-copy,
          .reveal-readout p {
            color: #536170;
            font-size: 0.78rem;
            line-height: 1.45;
          }

          .branch-row,
          .metric-row {
            display: grid;
            gap: 0.5rem;
            grid-template-columns: minmax(8rem, 0.58fr) minmax(0, 1fr);
            align-items: center;
          }

          .branch-row span,
          .metric-row span,
          label span,
          .budget-comparison span {
            display: block;
            color: #65717d;
            font-size: 0.7rem;
          }

          .branch-row strong,
          .metric-row strong,
          .budget-comparison strong {
            display: block;
            color: #17202a;
            font-family: var(--font-mono);
            font-size: 0.86rem;
          }

          .axis-bar {
            position: relative;
            min-width: 0;
            height: 0.78rem;
            border-radius: 999px;
            background: linear-gradient(90deg, rgba(180, 75, 59, 0.14), rgba(31, 111, 120, 0.12), rgba(111, 95, 191, 0.16));
            border: 1px solid rgba(27, 36, 48, 0.1);
          }

          .axis-bar.outcome {
            margin-top: -0.18rem;
          }

          .axis-bar .zero,
          .track .zero {
            position: absolute;
            top: -0.22rem;
            bottom: -0.22rem;
            width: 1px;
            background: rgba(27, 36, 48, 0.24);
          }

          .marker {
            position: absolute;
            top: 50%;
            width: 0.86rem;
            height: 0.86rem;
            border-radius: 999px;
            transform: translate(-50%, -50%);
            box-shadow: 0 0 0 3px rgba(255, 252, 246, 0.95);
          }

          .marker.value {
            background: #1f6f78;
          }

          .marker.gate {
            background: #6f5fbf;
          }

          .marker.product {
            background: #b44b3b;
          }

          .pipeline {
            border: 1px solid rgba(27, 36, 48, 0.08);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.52);
            padding: 0.3rem;
          }

          svg {
            display: block;
            width: 100%;
            height: auto;
          }

          .pipe-node rect,
          .pipe-node circle {
            fill: #fffaf3;
            stroke: rgba(27, 36, 48, 0.16);
            stroke-width: 1.4;
          }

          .pipe-node.value rect {
            stroke: rgba(31, 111, 120, 0.42);
          }

          .pipe-node.gate rect {
            stroke: rgba(111, 95, 191, 0.42);
          }

          .pipe-node.hidden rect,
          .pipe-node.product rect {
            fill: rgba(243, 236, 223, 0.86);
          }

          .pipe-node.hidden.revealed rect {
            fill: rgba(111, 95, 191, 0.12);
          }

          .pipe-node.product.revealed rect {
            fill: rgba(180, 75, 59, 0.1);
          }

          .pipe-node.multiply circle {
            fill: rgba(31, 111, 120, 0.1);
            stroke: rgba(31, 111, 120, 0.4);
          }

          .pipe-node text {
            fill: #17202a;
            font-family: var(--font-mono);
            font-size: 13px;
            text-anchor: middle;
          }

          .pipe-node text + text {
            fill: #536170;
            font-size: 12px;
          }

          .actions {
            display: flex;
            flex-wrap: wrap;
            gap: 0.55rem;
          }

          .actions button {
            width: auto;
            background: #1f6f78;
            color: white;
            font-weight: 800;
            text-align: center;
          }

          .actions .ghost {
            background: white;
            color: #334150;
          }

          .reveal-readout {
            border-left: 3px solid #1f6f78;
            border-radius: 0 8px 8px 0;
            background: rgba(31, 111, 120, 0.08);
            padding: 0.65rem 0.72rem;
          }

          .reveal-readout.shown {
            background: rgba(255, 252, 246, 0.92);
          }

          .reveal-readout strong {
            display: block;
            color: #17202a;
            font-size: 0.82rem;
            line-height: 1.34;
            margin-bottom: 0.25rem;
          }

          .write-bars,
          .budget-comparison {
            display: grid;
            gap: 0.5rem;
          }

          .write-row {
            display: grid;
            grid-template-columns: 4.4rem minmax(0, 1fr) 4rem;
            gap: 0.5rem;
            align-items: center;
            color: #536170;
            font-size: 0.72rem;
          }

          .write-row code {
            color: #17202a;
            font-family: var(--font-mono);
            font-size: 0.72rem;
          }

          .track {
            position: relative;
            min-width: 0;
            height: 0.62rem;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(27, 36, 48, 0.08);
          }

          .fill {
            position: absolute;
            top: 0;
            bottom: 0;
            border-radius: inherit;
          }

          .fill.pos {
            background: #1f6f78;
          }

          .fill.neg {
            background: #b44b3b;
          }

          label {
            display: grid;
            gap: 0.35rem;
          }

          input {
            min-width: 0;
            width: 100%;
          }

          .budget-comparison {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .budget-comparison div {
            min-width: 0;
            border: 1px solid rgba(27, 36, 48, 0.08);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.56);
            padding: 0.55rem;
          }

          .budget-comparison small {
            display: block;
            margin-top: 0.2rem;
            color: #65717d;
            font-family: var(--font-mono);
            font-size: 0.64rem;
          }

          .swiglu-notebook button:focus-visible,
          .swiglu-notebook input:focus-visible {
            outline: 2px solid #1f6f78;
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(31, 111, 120, 0.18);
          }

          @media (max-width: 980px) {
            .stage-grid,
            .outcome-grid,
            .preset-grid,
            .channel-strip,
            .prediction-grid {
              grid-template-columns: 1fr;
            }
          }

          @media (max-width: 560px) {
            .swiglu-notebook {
              padding: 0.62rem;
            }

            .branch-row,
            .metric-row,
            .write-row,
            .budget-comparison {
              grid-template-columns: 1fr;
            }
          }
        `}</style>
      </div>
    )
  }

  return (
    <section className="card interactive-card activation-functions-card" style={{ background: MATH_COLORS.surface, color: '#e5e7eb' }}>
      <h2 style={{ color: '#f8fafc' }}>Activation Functions: ReLU, GELU, SiLU &amp; SwiGLU</h2>
      <p className="muted">
        Compare classic activations with SwiGLU, treating it not just as a new curve but as a
        <strong> learned gate</strong> where one projection modulates another.
      </p>

      {/* Main layout: chart + readout */}
      <div className="activation-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: '1.25rem', alignItems: 'stretch' }}>
        {/* Main SVG chart */}
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="activation-chart"
          role="img"
          aria-label="Activation functions plotted from -3 to 3"
          style={{ borderRadius: 12, background: '#020617' }}
        >
          {/* Grid */}
          <g>
            {xTicks.map(t => {
              const xPos = xScale(t)
              return (
                <line
                  key={`x-grid-${t}`}
                  x1={xPos}
                  y1={PADDING.top}
                  x2={xPos}
                  y2={HEIGHT - PADDING.bottom}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth={1}
                />
              )
            })}
            {yTicks.map(t => {
              const yPos = yScale(t)
              return (
                <line
                  key={`y-grid-${t}`}
                  x1={PADDING.left}
                  y1={yPos}
                  x2={WIDTH - PADDING.right}
                  y2={yPos}
                  stroke="rgba(148, 163, 184, 0.15)"
                  strokeWidth={1}
                />
              )
            })}
          </g>

          {/* Axes */}
          <line
            x1={PADDING.left}
            y1={yScale(0)}
            x2={WIDTH - PADDING.right}
            y2={yScale(0)}
            stroke="rgba(148, 163, 184, 0.7)"
            strokeWidth={1.5}
          />
          <line
            x1={xScale(0)}
            y1={PADDING.top}
            x2={xScale(0)}
            y2={HEIGHT - PADDING.bottom}
            stroke="rgba(148, 163, 184, 0.7)"
            strokeWidth={1.5}
          />

          {/* Axis labels */}
          <text
            x={WIDTH - PADDING.right}
            y={yScale(0) + 16}
            fill="#9ca3af"
            fontSize={11}
            textAnchor="end"
          >
            x
          </text>
          <text
            x={xScale(0) - 8}
            y={PADDING.top + 4}
            fill="#9ca3af"
            fontSize={11}
            textAnchor="end"
          >
            f(x)
          </text>

          {/* Ticks text */}
          <g>
            {xTicks.map(t => (
              <text
                key={`x-tick-${t}`}
                x={xScale(t)}
                y={HEIGHT - PADDING.bottom + 18}
                fill="#6b7280"
                fontSize={10}
                textAnchor="middle"
              >
                {t}
              </text>
            ))}
            {yTicks.map(t => (
              <text
                key={`y-tick-${t}`}
                x={PADDING.left - 6}
                y={yScale(t) + 3}
                fill="#6b7280"
                fontSize={10}
                textAnchor="end"
              >
                {t.toFixed(1)}
              </text>
            ))}
          </g>

          {/* Activation curves */}
          <path
            d={lineMain(reluSamples) || undefined}
            fill="none"
            stroke={COLORS.relu}
            strokeWidth={2}
          />
          <path
            d={lineMain(geluSamples) || undefined}
            fill="none"
            stroke={COLORS.gelu}
            strokeWidth={2}
          />
          <path
            d={lineMain(siluSamples) || undefined}
            fill="none"
            stroke={COLORS.silu}
            strokeWidth={2}
          />
          <path
            d={lineMain(swigluSamples) || undefined}
            fill="none"
            stroke={COLORS.swiglu}
            strokeWidth={2.3}
          />

          {/* Hover line + markers */}
          {Number.isFinite(x) && (
            <g>
              {/* Vertical hover line */}
              <line
                x1={xScale(x)}
                y1={PADDING.top}
                x2={xScale(x)}
                y2={HEIGHT - PADDING.bottom}
                stroke="rgba(248, 250, 252, 0.5)"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              {/* Markers on each curve */}
              {[
                { y: reluVal, color: COLORS.relu },
                { y: geluVal, color: COLORS.gelu },
                { y: siluVal, color: COLORS.silu },
                { y: swigluVal, color: COLORS.swiglu },
              ].map((p, idx) => (
                <circle
                  key={idx}
                  cx={xScale(x)}
                  cy={yScale(p.y)}
                  r={5}
                  fill="#020617"
                  stroke={p.color}
                  strokeWidth={2}
                />
              ))}
            </g>
          )}

          {/* Interaction capture */}
          <rect
            x={PADDING.left}
            y={PADDING.top}
            width={WIDTH - PADDING.left - PADDING.right}
            height={HEIGHT - PADDING.top - PADDING.bottom}
            fill="transparent"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          />
        </svg>

        {/* Sidebar: numeric readout & formulas */}
        <div className="activation-sidebar" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            className="current-x"
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(75, 85, 99, 0.7)',
            }}
          >
            <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>Input</div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18 }}>
              x = <span style={{ color: '#e5e7eb' }}>{x.toFixed(3)}</span>
            </div>
          </div>

          <div className="activation-values" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[
              {
                name: 'ReLU',
                color: COLORS.relu,
                value: reluVal,
                formula: 'max(0, x)',
              },
              {
                name: 'GELU',
                color: COLORS.gelu,
                value: geluVal,
                formula: '0.5·x·(1 + erf(x / √2))',
              },
              {
                name: 'SiLU (Swish)',
                color: COLORS.silu,
                value: siluVal,
                formula: 'x·σ(x)',
              },
              {
                name: 'SwiGLU (toy)',
                color: COLORS.swiglu,
                value: swigluVal,
                formula: 'value(x)·gate(x)',
              },
            ].map(row => (
              <div
                key={row.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '999px',
                      background: row.color,
                    }}
                  />
                  <span style={{ color: '#e5e7eb' }}>{row.name}</span>
                </div>
                <span style={{ color: '#9ca3af', fontFamily: 'JetBrains Mono, monospace' }}>
                  {row.value.toFixed(4)}
                </span>
              </div>
            ))}
          </div>

          {/* Formula block that updates with x */}
          <div
            className="activation-formulas"
            style={{
              marginTop: 4,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(12, 10, 9, 0.9)',
              border: '1px solid rgba(55, 65, 81, 0.7)',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 11,
              color: '#d1d5db',
              lineHeight: 1.5,
            }}
          >
            <div style={{ color: '#9ca3af', marginBottom: 4 }}>Formulas at this x</div>
            <div>ReLU(x) = max(0, x) = max(0, {x.toFixed(3)}) = {reluVal.toFixed(4)}</div>
            <div>
              GELU(x) ≈ 0.5·x·(1 + tanh(√(2/π)(x + 0.044715x³))) = {geluVal.toFixed(4)}
            </div>
            <div>
              σ(x) = 1 / (1 + e<sup>-x</sup>) = {sigVal.toFixed(4)}
            </div>
            <div>
              SiLU(x) = x·σ(x) = {x.toFixed(3)}·{sigVal.toFixed(4)} = {siluVal.toFixed(4)}
            </div>
            <div style={{ marginTop: 4, color: COLORS.swiglu }}>
              SwiGLU(x) (toy) = value(x)·gate(x) = {valueBranchVal.toFixed(3)} ·{' '}
              {gateBranchVal.toFixed(4)} = {swigluVal.toFixed(4)}
            </div>
          </div>

          {/* Gate metaphor */}
          <div
            className="gate-metaphor"
            style={{
              marginTop: 4,
              padding: '0.5rem 0.75rem',
              borderRadius: 8,
              background: 'rgba(15, 23, 42, 0.9)',
              border: '1px solid rgba(55, 65, 81, 0.8)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 11,
                marginBottom: 4,
                color: '#9ca3af',
              }}
            >
              <span>Gate openness (σ(x))</span>
              <span>{(gateOpen * 100).toFixed(0)}%</span>
            </div>
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 16,
                borderRadius: 999,
                overflow: 'hidden',
                background: 'rgba(15, 23, 42, 1)',
                border: '1px solid rgba(75, 85, 99, 0.9)',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: `${gateOpen * 100}%`,
                  background: 'linear-gradient(90deg, #f59e0b, #3b82f6)',
                  transition: 'width 160ms ease-out',
                }}
              />
              {/* A "door" sliding as the gate opens */}
              <div
                style={{
                  position: 'absolute',
                  top: -4,
                  bottom: -4,
                  width: 4,
                  left: `${gateOpen * 100}%`,
                  background: '#0f172a',
                  boxShadow: '0 0 10px rgba(15, 23, 42, 0.8)',
                  transition: 'left 160ms ease-out',
                }}
              />
            </div>
            <p className="caption" style={{ marginTop: 6, fontSize: 11, color: '#9ca3af' }}>
              SwiGLU lets a <span style={{ color: COLORS.swiglu }}>value projection</span> through a
              gate whose openness is controlled by a <span style={{ color: COLORS.silu }}>gating projection</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Activation Challenge Game */}
      <div
        className="activation-challenge"
        style={{
          marginTop: '1.5rem',
          padding: '1rem',
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h3 style={{ fontSize: 14, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>🎯</span> Activation Challenge
          </h3>
          {gamePhase === 'reveal' && (
            <button
              onClick={resetGame}
              style={{
                padding: '4px 10px',
                borderRadius: 6,
                border: '1px solid rgba(156, 163, 175, 0.5)',
                background: 'transparent',
                color: '#9ca3af',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Try Again
            </button>
          )}
        </div>

        {!selectedChallenge ? (
          // Challenge selection
          <div>
            <p className="muted" style={{ fontSize: 13, marginBottom: '0.75rem' }}>
              Pick a challenge: at a specific x value, which activation produces the <strong>highest output</strong>?
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ACTIVATION_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  onClick={() => applyChallenge(challenge)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid rgba(75, 85, 99, 0.8)',
                    background: 'rgba(15, 23, 42, 0.8)',
                    color: '#e5e7eb',
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  {challenge.name}
                </button>
              ))}
            </div>
          </div>
        ) : gamePhase === 'setup' ? (
          // Prediction phase
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: '0.75rem' }}>
              <span
                style={{
                  padding: '4px 10px',
                  borderRadius: 6,
                  background: 'rgba(245, 158, 11, 0.2)',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  fontSize: 13,
                  color: COLORS.swiglu,
                }}
              >
                {selectedChallenge.name}
              </span>
              <span style={{ fontSize: 13, color: '#9ca3af' }}>{selectedChallenge.hint}</span>
            </div>

            <p style={{ fontSize: 13, marginBottom: '0.5rem', color: '#e5e7eb' }}>
              At <strong>x = {challengeX.toFixed(1)}</strong>, which activation gives the highest output?
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: '0.75rem' }}>
              {(['relu', 'gelu', 'silu', 'swiglu'] as ActivationType[]).map((act) => (
                <button
                  key={act}
                  onClick={() => setUserPrediction(act)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `2px solid ${userPrediction === act ? COLORS[act] : 'rgba(75, 85, 99, 0.6)'}`,
                    background: userPrediction === act ? `${COLORS[act]}22` : 'rgba(15, 23, 42, 0.8)',
                    color: userPrediction === act ? COLORS[act] : '#e5e7eb',
                    fontSize: 13,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[act] }} />
                  {act.toUpperCase()}
                </button>
              ))}
            </div>

            <button
              onClick={startChallenge}
              disabled={!userPrediction}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: userPrediction ? 'linear-gradient(135deg, #f59e0b, #d97706)' : 'rgba(75, 85, 99, 0.5)',
                color: userPrediction ? '#020617' : '#9ca3af',
                fontSize: 13,
                fontWeight: 600,
                cursor: userPrediction ? 'pointer' : 'not-allowed',
              }}
            >
              Lock In Prediction →
            </button>
          </div>
        ) : gamePhase === 'countdown' ? (
          // Countdown phase
          <div style={{ textAlign: 'center', padding: '1rem' }}>
            <div style={{ fontSize: 48, fontFamily: 'JetBrains Mono, monospace', color: COLORS.swiglu }}>
              {countdown}
            </div>
            <p style={{ fontSize: 13, color: '#9ca3af' }}>
              Computing f({challengeX.toFixed(1)}) for all activations...
            </p>
          </div>
        ) : (
          // Reveal phase
          <div>
            <div
              style={{
                padding: '0.75rem 1rem',
                borderRadius: 8,
                background: feedback.startsWith('Correct')
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: feedback.startsWith('Correct')
                  ? '1px solid rgba(34, 197, 94, 0.4)'
                  : '1px solid rgba(239, 68, 68, 0.4)',
                marginBottom: '0.75rem',
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4, color: feedback.startsWith('Correct') ? '#22c55e' : '#ef4444' }}>
                {feedback.startsWith('Correct') ? '✓ Correct!' : '✗ Not quite!'}
              </div>
              <p style={{ fontSize: 13, color: '#e5e7eb', margin: 0 }}>
                {feedback.replace('Correct! ', '').replace('Not quite! ', '')}
              </p>
            </div>

            <div style={{ fontSize: 12, color: '#9ca3af' }}>
              The chart is now set to x = {challengeX.toFixed(1)}. Compare the dot positions to see which activation wins.
            </div>
          </div>
        )}
      </div>

      {/* SwiGLU branch visualization */}
      <div
        className="swiglu-section"
        style={{ marginTop: '1.5rem', display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: '1.25rem' }}
      >
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>SwiGLU as two branches</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            Toy 1D picture of SwiGLU: one linear branch produces a{' '}
            <span style={{ color: COLORS.swiglu }}>value</span>, another produces a{' '}
            <span style={{ color: COLORS.silu }}>gate</span>; their product is the output.
          </p>

          <svg
            width={BRANCH_WIDTH}
            height={BRANCH_HEIGHT}
            viewBox={`0 0 ${BRANCH_WIDTH} ${BRANCH_HEIGHT}`}
            style={{ borderRadius: 10, background: '#020617' }}
          >
            {/* Axes */}
            <line
              x1={BRANCH_PADDING.left}
              y1={branchYScale(0)}
              x2={BRANCH_WIDTH - BRANCH_PADDING.right}
              y2={branchYScale(0)}
              stroke="rgba(148, 163, 184, 0.8)"
              strokeWidth={1.5}
            />
            <line
              x1={branchXScale(0)}
              y1={BRANCH_PADDING.top}
              x2={branchXScale(0)}
              y2={BRANCH_HEIGHT - BRANCH_PADDING.bottom}
              stroke="rgba(148, 163, 184, 0.8)"
              strokeWidth={1.5}
            />

            {/* Branch curves */}
            <path
              d={lineBranch(valueBranchSamples) || undefined}
              fill="none"
              stroke={COLORS.swiglu}
              strokeWidth={2}
            />
            <path
              d={lineBranch(gateBranchSamples) || undefined}
              fill="none"
              stroke={COLORS.silu}
              strokeWidth={2}
              strokeDasharray="5 3"
            />
            <path
              d={lineBranch(swigluSamples) || undefined}
              fill="none"
              stroke={COLORS.swiglu}
              strokeWidth={2.5}
              strokeOpacity={0.8}
            />

            {/* Live markers at current x */}
            <g>
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(valueBranchVal)}
                r={4.5}
                fill="#020617"
                stroke={COLORS.swiglu}
                strokeWidth={1.8}
              />
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(gateBranchVal)}
                r={4.5}
                fill="#020617"
                stroke={COLORS.silu}
                strokeWidth={1.8}
              />
              <circle
                cx={branchXScale(x)}
                cy={branchYScale(swigluVal)}
                r={5}
                fill="#020617"
                stroke={COLORS.swiglu}
                strokeWidth={2}
              />
            </g>

            {/* Legend */}
            <g transform={`translate(${BRANCH_PADDING.left}, ${BRANCH_PADDING.top})`} fontSize={10}>
              <g transform="translate(0, 0)">
                <rect width={10} height={2} fill={COLORS.swiglu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  value(x)
                </text>
              </g>
              <g transform="translate(80, 0)">
                <rect width={10} height={2} fill={COLORS.silu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  gate(x) = Swish
                </text>
              </g>
              <g transform="translate(200, 0)">
                <rect width={10} height={2} fill={COLORS.swiglu} y={4} />
                <text x={16} y={8} fill="#e5e7eb">
                  value·gate
                </text>
              </g>
            </g>
          </svg>

          <p className="caption" style={{ fontSize: 11, marginTop: 6, color: '#9ca3af' }}>
            In real models, <code>value(x)</code> and <code>gate(x)</code> are separate linear projections
            of the hidden state. Here we show a 1D toy: value(x) = x, gate(x) = Swish(x).
          </p>
        </div>

        {/* Parameter-count comparison */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Why 2/3 hidden dimension for SwiGLU?</h3>
          <p className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            A SwiGLU feedforward block uses <strong>three</strong> matrices instead of two, but shrinks the
            hidden dimension to keep parameter count on par with a ReLU block.
          </p>

          <label style={{ display: 'block', fontSize: 12, color: '#e5e7eb', marginBottom: 4 }}>
            Model width <span style={{ color: '#9ca3af' }}>(d_model)</span>: {formatNumber(dModel)}
            <input
              type="range"
              min={128}
              max={4096}
              step={64}
              value={dModel}
              onChange={e => setDModel(parseInt(e.target.value, 10))}
              style={{ width: '100%', marginTop: 4 }}
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: '0.5rem',
              marginTop: 8,
              fontSize: 12,
            }}
          >
            <div
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                background: 'rgba(12, 10, 9, 0.9)',
                border: '1px solid rgba(75, 85, 99, 0.8)',
              }}
            >
              <div style={{ color: '#9ca3af', marginBottom: 2 }}>ReLU FFN</div>
              <div>hidden dim d_ff = {ffnMultiplier}·d_model = {formatNumber(dFFReLU)}</div>
              <div>params ≈ 2·d_model·d_ff</div>
              <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', color: '#e5e7eb' }}>
                ≈ {formatNumber(paramsReLU)}
              </div>
            </div>

            <div
              style={{
                padding: '0.5rem 0.6rem',
                borderRadius: 8,
                background: 'rgba(12, 10, 9, 0.9)',
                border: '1px solid rgba(75, 85, 99, 0.8)',
              }}
            >
              <div style={{ color: '#9ca3af', marginBottom: 2 }}>SwiGLU FFN</div>
              <div>hidden dim d_ff&apos; = (2/3)·d_ff ≈ {formatNumber(dFFSwiGLU)}</div>
              <div>params ≈ 3·d_model·d_ff&apos;</div>
              <div style={{ marginTop: 4, fontFamily: 'JetBrains Mono, monospace', color: COLORS.swiglu }}>
                ≈ {formatNumber(paramsSwiGLU)}{' '}
                <span style={{ color: '#9ca3af', fontSize: 11 }}>
                  ({(paramRatio * 100).toFixed(1)}% of ReLU)
                </span>
              </div>
            </div>
          </div>

          <p className="caption" style={{ fontSize: 11, marginTop: 8, color: '#9ca3af' }}>
            In a standard Transformer FFN, ReLU uses two matrices: W₁ ∈ ℝ<sup>d_model×d_ff</sup>,
            W₂ ∈ ℝ<sup>d_ff×d_model</sup>. SwiGLU splits the first into two projections (Wᵥ, Wg),
            and adds a gate:
            <br />
            <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              ReLU: x → W₁ → ReLU → W₂
            </code>
            <br />
            <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>
              SwiGLU: x → [Wᵥ, Wg] → (xWᵥ) ⊙ Swish(xWg) → Wₒ
            </code>
            <br />
            Choosing d_ff&apos; = (2/3)·d_ff keeps 3·d_model·d_ff&apos; ≈ 2·d_model·d_ff, so SwiGLU
            behaves like a gated ReLU block at roughly the same parameter cost.
          </p>
        </div>
      </div>
    </section>
  )
}
