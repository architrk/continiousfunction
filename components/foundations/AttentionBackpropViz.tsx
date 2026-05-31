'use client'

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { clearDemoState, emitDemoState } from '../../lib/demoState'
import { MATH_COLORS } from '../../lib/mathObjects'

type Mode = 'forward' | 'backward'

type AttentionBackpropExplorerProps = {
  conceptId?: string
}

// Scenario presets that create distinct gradient signatures (per Oracle's gamification design)
type ScenarioId = 'baseline' | 'largeK' | 'largeQ' | 'softmaxSaturation' | 'uniformAttention' | 'largeV'
type GradientCreditPrediction = 'wq' | 'wk' | 'wv' | 'softmax'

const GRADIENT_CREDIT_ACTUAL: GradientCreditPrediction = 'wq'
const GRADIENT_CREDIT_OPTIONS: Array<{
  id: GradientCreditPrediction
  label: string
  description: string
}> = [
  { id: 'wq', label: 'W_Q', description: 'Query weights' },
  { id: 'wk', label: 'W_K', description: 'Key weights' },
  { id: 'wv', label: 'W_V', description: 'Value weights' },
  { id: 'softmax', label: 'Softmax gate', description: 'Attention normalization' },
]

const GRADIENT_CREDIT_LABELS: Record<GradientCreditPrediction, string> = {
  wq: 'W_Q',
  wk: 'W_K',
  wv: 'W_V',
  softmax: 'softmax gate',
}

interface ScenarioPreset {
  id: ScenarioId
  name: string
  emoji: string
  description: string
  // Multipliers for backward magnitudes on specific edges
  multipliers: Partial<Record<string, number>>
}

const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    id: 'baseline',
    name: 'Balanced',
    emoji: '⚖️',
    description: 'Default: gradients split across Q, K, V paths',
    multipliers: {},
  },
  {
    id: 'largeK',
    name: 'Loud Keys',
    emoji: '🔑',
    description: 'Large K → W_Q gets bigger updates (counterintuitive!)',
    multipliers: { 'q-scores': 1.2, 'x-q': 1.3, 'wq-q': 1.5, 'scores-a': 0.85 },
  },
  {
    id: 'largeQ',
    name: 'Loud Queries',
    emoji: '❓',
    description: 'Large Q → W_K gets bigger updates',
    multipliers: { 'k-scores': 1.4, 'x-k': 1.3, 'wk-k': 1.5, 'scores-a': 1.2 },
  },
  {
    id: 'softmaxSaturation',
    name: 'Saturated',
    emoji: '🎯',
    description: 'Peaky attention → softmax bottleneck chokes gradients',
    multipliers: { 'scores-a': 0.25, 'q-scores': 0.4, 'k-scores': 0.4, 'wq-q': 0.35, 'wk-k': 0.35 },
  },
  {
    id: 'uniformAttention',
    name: 'Uniform',
    emoji: '🌊',
    description: 'Flat attention → gradients spread evenly',
    multipliers: { 'scores-a': 1.3, 'q-scores': 0.85, 'k-scores': 0.85, 'wq-q': 0.9, 'wk-k': 0.9, 'wv-v': 0.9 },
  },
  {
    id: 'largeV',
    name: 'Loud Values',
    emoji: '💎',
    description: 'Large V → attention weights learn more than V itself',
    multipliers: { 'a-o': 1.5, 'scores-a': 1.4, 'q-scores': 1.2, 'k-scores': 1.2, 'v-o': 0.7 },
  },
]

// Dynamic insight generator based on current scenario and mode
function getAttentionBackpropInsight(
  scenarioId: ScenarioId,
  mode: Mode,
  connections: Connection[]
): { text: string; color: string; emoji: string } {
  if (mode === 'forward') {
    return {
      emoji: '➡️',
      color: '#14b8a6',
      text: 'Forward pass: X is projected into Q, K, V. Scores = QKᵀ/√d_k measure token compatibility. Softmax normalizes into attention weights A.',
    }
  }

  // Backward mode insights based on scenario
  const wqMag = connections.find(c => c.id === 'wq-q')?.backwardMag || 0
  const wkMag = connections.find(c => c.id === 'wk-k')?.backwardMag || 0
  const wvMag = connections.find(c => c.id === 'wv-v')?.backwardMag || 0
  const softmaxMag = connections.find(c => c.id === 'scores-a')?.backwardMag || 0
  const aoMag = connections.find(c => c.id === 'a-o')?.backwardMag || 0
  const voMag = connections.find(c => c.id === 'v-o')?.backwardMag || 0

  switch (scenarioId) {
    case 'largeK':
      return {
        emoji: '🔑',
        color: '#f59e0b',
        text: `Keys amplify query gradients! ∂L/∂Q = (∂L/∂S)K/√d_k. When K is large, W_Q updates (${(wqMag * 100).toFixed(0)}%) dominate over W_K (${(wkMag * 100).toFixed(0)}%).`,
      }
    case 'largeQ':
      return {
        emoji: '❓',
        color: '#8b5cf6',
        text: `Queries amplify key gradients! ∂L/∂K = (∂L/∂S)ᵀQ/√d_k. When Q is large, W_K updates (${(wkMag * 100).toFixed(0)}%) dominate over W_Q (${(wqMag * 100).toFixed(0)}%).`,
      }
    case 'softmaxSaturation':
      return {
        emoji: '⚠️',
        color: '#ef4444',
        text: `Softmax bottleneck! When attention is peaky, J_softmax = diag(a) − aaᵀ shrinks. Gradient through softmax: only ${(softmaxMag * 100).toFixed(0)}%. Q/K barely learn.`,
      }
    case 'uniformAttention':
      return {
        emoji: '🌊',
        color: '#22c55e',
        text: `Healthy spread! Flat attention means J_softmax stays large (${(softmaxMag * 100).toFixed(0)}%). All three paths (Q/K/V) get meaningful gradients.`,
      }
    case 'largeV':
      return {
        emoji: '💎',
        color: '#a855f7',
        text: `Values shape WHERE to attend: ∂L/∂A = (∂L/∂O)Vᵀ. Large V → A gradients (${(aoMag * 100).toFixed(0)}%) exceed V gradients (${(voMag * 100).toFixed(0)}%).`,
      }
    default:
      return {
        emoji: '⚖️',
        color: '#6366f1',
        text: `Balanced gradients: W_Q (${(wqMag * 100).toFixed(0)}%), W_K (${(wkMag * 100).toFixed(0)}%), W_V (${(wvMag * 100).toFixed(0)}%). All three projections contribute to dL/dX.`,
      }
  }
}

type NodeId =
  | 'X'
  | 'Q'
  | 'K'
  | 'V'
  | 'Scores'
  | 'A'
  | 'O'
  | 'L'
  | 'W_Q'
  | 'W_K'
  | 'W_V'

type NodeType = 'tensor' | 'param' | 'loss'

interface Node {
  id: NodeId
  label: string
  x: number
  y: number
  type: NodeType
}

interface Connection {
  id: string
  from: NodeId
  to: NodeId
  forwardMag: number // toy "activation magnitude"
  backwardMag: number // toy "gradient magnitude"
  forwardFormula: string
  backwardFormula: string
  note?: string
}

const NODES: Record<NodeId, Node> = {
  X: {
    id: 'X',
    label: 'Input X\n(T × d_model)',
    x: 90,
    y: 200,
    type: 'tensor',
  },
  W_Q: {
    id: 'W_Q',
    label: 'W_Q\n(d_model × d_k)',
    x: 150,
    y: 60,
    type: 'param',
  },
  W_K: {
    id: 'W_K',
    label: 'W_K\n(d_model × d_k)',
    x: 150,
    y: 200,
    type: 'param',
  },
  W_V: {
    id: 'W_V',
    label: 'W_V\n(d_model × d_v)',
    x: 150,
    y: 340,
    type: 'param',
  },
  Q: {
    id: 'Q',
    label: 'Q = X W_Q\n(T × d_k)',
    x: 270,
    y: 80,
    type: 'tensor',
  },
  K: {
    id: 'K',
    label: 'K = X W_K\n(T × d_k)',
    x: 270,
    y: 200,
    type: 'tensor',
  },
  V: {
    id: 'V',
    label: 'V = X W_V\n(T × d_v)',
    x: 270,
    y: 320,
    type: 'tensor',
  },
  Scores: {
    id: 'Scores',
    label: 'Scores S\n= Q Kᵀ / √d_k',
    x: 430,
    y: 140,
    type: 'tensor',
  },
  A: {
    id: 'A',
    label: 'Attention\nweights A',
    x: 600,
    y: 140,
    type: 'tensor',
  },
  O: {
    id: 'O',
    label: 'Output O\n= A V',
    x: 760,
    y: 200,
    type: 'tensor',
  },
  L: {
    id: 'L',
    label: 'Loss L',
    x: 880,
    y: 200,
    type: 'loss',
  },
}

const CONNECTIONS: Connection[] = [
  // Projections: X -> Q,K,V
  {
    id: 'x-q',
    from: 'X',
    to: 'Q',
    forwardMag: 0.6,
    backwardMag: 0.7,
    forwardFormula: 'Q = X W_Q',
    backwardFormula: '∂L/∂X  ⊕=  (∂L/∂Q) W_Qᵀ',
    note: 'Input-to-query path; gradients mix across d_k via W_Qᵀ.',
  },
  {
    id: 'x-k',
    from: 'X',
    to: 'K',
    forwardMag: 0.5,
    backwardMag: 0.65,
    forwardFormula: 'K = X W_K',
    backwardFormula: '∂L/∂X  ⊕=  (∂L/∂K) W_Kᵀ',
    note: 'Input-to-key path; couples every token to every other via QKᵀ.',
  },
  {
    id: 'x-v',
    from: 'X',
    to: 'V',
    forwardMag: 0.5,
    backwardMag: 0.55,
    forwardFormula: 'V = X W_V',
    backwardFormula: '∂L/∂X  ⊕=  (∂L/∂V) W_Vᵀ',
    note: 'Input-to-value path; carries content used for weighted sum.',
  },

  // Parameter connections (for showing dW)
  {
    id: 'wq-q',
    from: 'W_Q',
    to: 'Q',
    forwardMag: 0.6,
    backwardMag: 0.8,
    forwardFormula: 'Q = X W_Q',
    backwardFormula: '∂L/∂W_Q = Xᵀ (∂L/∂Q)',
    note: 'Each query weight sees gradients summed over all tokens.',
  },
  {
    id: 'wk-k',
    from: 'W_K',
    to: 'K',
    forwardMag: 0.5,
    backwardMag: 0.8,
    forwardFormula: 'K = X W_K',
    backwardFormula: '∂L/∂W_K = Xᵀ (∂L/∂K)',
    note: 'Key weights feel gradients from every query-key interaction.',
  },
  {
    id: 'wv-v',
    from: 'W_V',
    to: 'V',
    forwardMag: 0.5,
    backwardMag: 0.7,
    forwardFormula: 'V = X W_V',
    backwardFormula: '∂L/∂W_V = Xᵀ (∂L/∂V)',
    note: 'Value weights aggregate gradients through attention weights.',
  },

  // Q,K -> Scores
  {
    id: 'q-scores',
    from: 'Q',
    to: 'Scores',
    forwardMag: 0.8,
    backwardMag: 0.9,
    forwardFormula: 'S = (Q Kᵀ) / √d_k',
    backwardFormula: '∂L/∂Q = (∂L/∂S) K / √d_k',
    note: 'Each query token interacts with all keys: O(T²) couplings.',
  },
  {
    id: 'k-scores',
    from: 'K',
    to: 'Scores',
    forwardMag: 0.8,
    backwardMag: 0.9,
    forwardFormula: 'S = (Q Kᵀ) / √d_k',
    backwardFormula: '∂L/∂K = (∂L/∂S)ᵀ Q / √d_k',
    note: 'Key gradients come from all queries simultaneously.',
  },

  // Scores -> A (softmax)
  {
    id: 'scores-a',
    from: 'Scores',
    to: 'A',
    forwardMag: 1.0,
    backwardMag: 1.0,
    forwardFormula: 'A = softmax_row(S)',
    backwardFormula: '∂L/∂S = (diag(a) − a aᵀ) (∂L/∂A)   (row-wise)',
    note: 'Softmax Jacobian is dense: each weight’s gradient depends on every other weight in its row.',
  },

  // Attention weights & values -> output
  {
    id: 'a-o',
    from: 'A',
    to: 'O',
    forwardMag: 0.7,
    backwardMag: 0.85,
    forwardFormula: 'O = A V',
    backwardFormula: '∂L/∂A = (∂L/∂O) Vᵀ',
    note: 'Changing one attention weight redistributes value contribution across tokens.',
  },
  {
    id: 'v-o',
    from: 'V',
    to: 'O',
    forwardMag: 0.7,
    backwardMag: 0.7,
    forwardFormula: 'O = A V',
    backwardFormula: '∂L/∂V = Aᵀ (∂L/∂O)',
    note: 'Value gradients are attention-weighted mixes of output gradients.',
  },

  // Output -> loss
  {
    id: 'o-l',
    from: 'O',
    to: 'L',
    forwardMag: 0.9,
    backwardMag: 0.9,
    forwardFormula: 'L = loss(O, target)',
    backwardFormula: '∂L/∂O = ∂ loss / ∂O',
    note: 'Loss supplies the initial gradient that flows back through attention.',
  },
]

function getNode(id: NodeId): Node {
  return NODES[id]
}

function splitLabel(label: string): string[] {
  return label.split('\n')
}

export default function AttentionBackpropExplorer({ conceptId = 'attention-transformers' }: AttentionBackpropExplorerProps) {
  const [mode, setMode] = useState<Mode>('backward')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<GradientCreditPrediction | null>(null)
  const [revealed, setRevealed] = useState(false)
  const conceptIdRef = useRef(conceptId)
  const conceptChanged = conceptIdRef.current !== conceptId
  const revealVisible = revealed && !conceptChanged
  const activeScenario: ScenarioId = 'largeK'

  const resetReveal = useCallback((clearPrediction = true) => {
    if (clearPrediction) setPrediction(null)
    setRevealed(false)
    clearDemoState(conceptId)
  }, [conceptId])

  const choosePrediction = useCallback((nextPrediction: GradientCreditPrediction) => {
    setPrediction(nextPrediction)
    if (revealed) {
      setRevealed(false)
      clearDemoState(conceptId)
    }
  }, [conceptId, revealed])

  const revealGradientCredit = useCallback(() => {
    if (!prediction) return
    setMode('backward')
    setRevealed(true)
  }, [prediction])

  const changeMode = useCallback((nextMode: Mode) => {
    setMode(nextMode)
    resetReveal()
  }, [resetReveal])

  // Apply scenario multipliers to connections
  const connections = useMemo(() => {
    const scenario = SCENARIO_PRESETS.find(s => s.id === activeScenario)
    if (!scenario) return CONNECTIONS

    return CONNECTIONS.map(conn => {
      const multiplier = scenario.multipliers[conn.id] ?? 1
      return {
        ...conn,
        backwardMag: Math.min(1.5, conn.backwardMag * multiplier),
      }
    })
  }, [activeScenario])

  const hoveredConn = useMemo(
    () => connections.find((c) => c.id === hoveredId),
    [hoveredId, connections]
  )

  // Dynamic insight based on scenario and mode
  const measuredInsight = useMemo(() => {
    return getAttentionBackpropInsight(activeScenario, mode, connections)
  }, [activeScenario, mode, connections])
  const visibleInsight = revealVisible
    ? measuredInsight
    : {
        emoji: '🔎',
        color: '#8b5cf6',
        text:
          'Key-scale stress: K vectors are larger; Q, V, and the loss seed are held fixed. Use the QKᵀ formulas to predict which backward-credit path is amplified.',
      }

  const dominantConnection = useMemo(
    () =>
      connections.reduce(
        (best, conn) => (conn.backwardMag > best.backwardMag ? conn : best),
        connections[0]
      ),
    [connections]
  )
  const wqMag = connections.find((conn) => conn.id === 'wq-q')?.backwardMag ?? 0
  const wkMag = connections.find((conn) => conn.id === 'wk-k')?.backwardMag ?? 0
  const wvMag = connections.find((conn) => conn.id === 'wv-v')?.backwardMag ?? 0
  const softmaxMag = connections.find((conn) => conn.id === 'scores-a')?.backwardMag ?? 0
  const attentionToOutputMag = connections.find((conn) => conn.id === 'a-o')?.backwardMag ?? 0
  const valueToOutputMag = connections.find((conn) => conn.id === 'v-o')?.backwardMag ?? 0
  const dominantParam = useMemo(
    () =>
      [
        { id: 'W_Q', magnitude: wqMag },
        { id: 'W_K', magnitude: wkMag },
        { id: 'W_V', magnitude: wvMag },
      ].reduce((best, item) => (item.magnitude > best.magnitude ? item : best)),
    [wkMag, wqMag, wvMag]
  )
  const predictionCorrect = prediction !== null && prediction === GRADIENT_CREDIT_ACTUAL
  const actualLabel = GRADIENT_CREDIT_LABELS[GRADIENT_CREDIT_ACTUAL]
  const predictionLabel = prediction ? GRADIENT_CREDIT_LABELS[prediction] : 'none'
  const parameterCreditPath = connections.find((conn) => conn.id === 'wq-q') ?? dominantConnection
  const gradientEvidenceSteps = [
    {
      title: 'Predict',
      detail:
        prediction === null
          ? 'Commit to the hidden parameter that receives the most credit.'
          : `Committed to ${predictionLabel}.`,
    },
    {
      title: 'Observe',
      detail: revealVisible
        ? `Measured winner: ${actualLabel}.`
        : 'Gradient magnitudes stay neutral until reveal.',
    },
    {
      title: 'Ground',
      detail: revealVisible
        ? 'dL/dQ = (dL/dS)K explains the W_Q crossover.'
        : 'Use the visible backward formulas before revealing.',
    },
    {
      title: 'Carry',
      detail: revealVisible
        ? `${predictionCorrect ? 'Matched' : 'Missed'}; carry W_Q, W_K, W_V, and softmax gate.`
        : 'Research Room receives the compact gradient evidence.',
    },
  ]
  const gradientActiveEvidenceIndex = revealVisible ? 3 : 0

  useEffect(() => {
    conceptIdRef.current = conceptId
    setPrediction(null)
    setRevealed(false)
    clearDemoState(conceptId)
    return () => clearDemoState(conceptId)
  }, [conceptId])

  useEffect(() => {
    if (!revealVisible || prediction === null) return

    emitDemoState({
      conceptId,
      label: 'Attention backprop gradient-credit reveal',
      summary: `Key-scale stress in backward mode: learner predicted ${predictionLabel}; strongest hidden parameter credit is ${actualLabel}; prediction ${predictionCorrect ? 'matched' : 'missed'}.`,
      values: [
        'slice: attention-backprop-prediction-first-gradient-credit-reveal',
        'scenario: Key-scale stress (largeK)',
        'mode: backward',
        'held fixed: Q scale, V scale, loss seed',
        `prediction: ${predictionLabel}`,
        `actual strongest credit: ${actualLabel}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `dominant parameter update: ${dominantParam.id} at ${(dominantParam.magnitude * 100).toFixed(0)}%`,
        `parameter credit path: ${parameterCreditPath.id} (${parameterCreditPath.from}->${parameterCreditPath.to}) at ${(parameterCreditPath.backwardMag * 100).toFixed(0)}%`,
        `W_Q gradient magnitude: ${(wqMag * 100).toFixed(0)}%`,
        `W_K gradient magnitude: ${(wkMag * 100).toFixed(0)}%`,
        `W_V gradient magnitude: ${(wvMag * 100).toFixed(0)}%`,
        `softmax Jacobian gradient gate: ${(softmaxMag * 100).toFixed(0)}%`,
        `attention-to-output gradient: ${(attentionToOutputMag * 100).toFixed(0)}%`,
        `value-to-output gradient: ${(valueToOutputMag * 100).toFixed(0)}%`,
        'formula witness: dL/dQ = (dL/dS)K / sqrt(d_k)',
        'invariant: Large K amplifies dL/dQ, so W_Q receives the strongest parameter-gradient norm.',
        'visible layers: gradient edge magnitudes, parameter norm readout, correctness copy',
        'evidence loop: predict -> observe -> ground -> carry',
      ],
    })
  }, [
    attentionToOutputMag,
    actualLabel,
    conceptId,
    dominantParam,
    parameterCreditPath,
    prediction,
    predictionCorrect,
    predictionLabel,
    revealVisible,
    softmaxMag,
    valueToOutputMag,
    wkMag,
    wqMag,
    wvMag,
  ])

  const softmaxRegion = useMemo(() => {
    const scores = getNode('Scores')
    const A = getNode('A')
    const paddingX = 30
    const paddingY = 60
    const x = Math.min(scores.x, A.x) - paddingX
    const width = Math.abs(scores.x - A.x) + 2 * paddingX
    const y = scores.y - paddingY
    const height = paddingY * 2
    return { x, y, width, height }
  }, [])

  const forwardColor = '#14b8a6' // teal
  const backwardColor = '#f59e0b' // orange

  return (
    <section className="card interactive-card attention-backprop-card">
      <div className="attention-header">
        <div>
          <h2>Backpropagation Through an Attention Layer</h2>
          <p className="muted">
            Inspect the topology and formulas first. Gradient magnitudes stay
            neutral until you commit to where the key-scale stress sends credit.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="mode-toggle" aria-label="Select visualization mode">
            <button
              type="button"
              className={mode === 'forward' ? 'active' : ''}
              onClick={() => changeMode('forward')}
            >
              Forward pass
            </button>
            <button
              type="button"
              className={mode === 'backward' ? 'active' : ''}
              onClick={() => changeMode('backward')}
            >
              Backward pass
            </button>
          </div>
        </div>
      </div>

      <section className="credit-panel" aria-live="polite" data-child-demo-gate="attention-backprop-gradient-credit">
        <div className="credit-copy">
          <span>prediction checkpoint</span>
          <strong>When keys are scaled up, where does hidden backward credit land?</strong>
          <p>
            Key-scale stress: K vectors are larger; Q, V, and the loss seed are held fixed. Use the
            QKᵀ gradient formulas before revealing the measured gradient-credit path.
          </p>
        </div>
        <div className="credit-choices" role="group" aria-label="Gradient credit prediction">
          {GRADIENT_CREDIT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={prediction === option.id}
              className={prediction === option.id ? 'selected' : ''}
              onClick={() => choosePrediction(option.id)}
              title={option.description}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="credit-evidence-strip" aria-label="Attention backprop evidence loop">
          {gradientEvidenceSteps.map((step, index) => (
            <div
              key={step.title}
              className={`credit-evidence-step ${index === gradientActiveEvidenceIndex ? 'active' : ''}`}
            >
              <div className="credit-evidence-title">
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </div>
              <p>{step.detail}</p>
            </div>
          ))}
        </div>
        <div className="credit-actions">
          <button
            type="button"
            className="reveal-credit"
            disabled={prediction === null || revealVisible}
            onClick={revealGradientCredit}
          >
            Reveal gradient credit
          </button>
          {revealVisible && (
            <button type="button" className="reset-credit" onClick={() => resetReveal()}>
              Reset reveal
            </button>
          )}
          {revealVisible && (
            <span className={predictionCorrect ? 'credit-result correct' : 'credit-result missed'}>
              {predictionCorrect ? 'Prediction matched.' : `Prediction missed. Actual: ${actualLabel}.`}
            </span>
          )}
        </div>
      </section>

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '0.6rem 0.9rem',
          borderRadius: '0.5rem',
          background: `linear-gradient(135deg, ${visibleInsight.color}22, ${visibleInsight.color}08)`,
          border: `1px solid ${visibleInsight.color}55`,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{visibleInsight.emoji}</span>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.4 }}>
          {visibleInsight.text}
        </p>
      </div>

      {revealVisible ? (
        <div className="credit-readout">
          <strong>Revealed gradient credit:</strong> {actualLabel} receives the strongest hidden parameter update.{' '}
          <span>W_Q gradient magnitude: {(wqMag * 100).toFixed(0)}%. </span>
          <span>W_K gradient magnitude: {(wkMag * 100).toFixed(0)}%. </span>
          <span>W_V gradient magnitude: {(wvMag * 100).toFixed(0)}%. </span>
          <span>Softmax Jacobian gradient gate: {(softmaxMag * 100).toFixed(0)}%.</span>
        </div>
      ) : (
        <div className="credit-readout locked">
          Measured credit, edge strength, and correctness are locked until reveal.
        </div>
      )}

      <div className="formula-witness" aria-label="Accessible gradient formulas">
        <strong>Reason with the backward formulas:</strong>
        <code>dL/dQ = (dL/dS)K / sqrt(d_k)</code>
        <code>dL/dK = (dL/dS)^T Q / sqrt(d_k)</code>
        <code>dL/dW_Q = X^T(dL/dQ)</code>
        <code>dL/dW_K = X^T(dL/dK)</code>
        <code>dL/dW_V = X^T(dL/dV)</code>
      </div>

      <div className="attention-layout">
        <svg
          viewBox="0 0 940 420"
          className="attention-svg"
          role="img"
          aria-label="Computation graph of an attention layer with forward and backward flows"
        >
          <defs>
            <linearGradient id="softmax-glow" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.25" />
              <stop offset="50%" stopColor="#8b5cf6" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.25" />
            </linearGradient>

            <marker
              id="arrow-forward"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,3 L0,6 z" fill={forwardColor} />
            </marker>
            <marker
              id="arrow-backward"
              markerWidth="10"
              markerHeight="10"
              refX="8"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L8,3 L0,6 z" fill={backwardColor} />
            </marker>
          </defs>

          {/* Background */}
          <rect
            x={0}
            y={0}
            width={940}
            height={420}
            fill="#080c14"
            rx={16}
          />

          {/* Softmax Jacobian region */}
          <g className="softmax-region">
            <rect
              x={softmaxRegion.x}
              y={softmaxRegion.y}
              width={softmaxRegion.width}
              height={softmaxRegion.height}
              fill="url(#softmax-glow)"
              opacity={revealVisible ? (mode === 'backward' ? 0.45 : 0.35) : 0.12}
              rx={18}
            />
            <rect
              x={softmaxRegion.x}
              y={softmaxRegion.y}
              width={softmaxRegion.width}
              height={softmaxRegion.height}
              fill="none"
              stroke={mode === 'backward' ? backwardColor : forwardColor}
              strokeWidth={2}
              strokeDasharray="6 6"
              opacity={0.9}
            />
            <text
              x={softmaxRegion.x + softmaxRegion.width / 2}
              y={softmaxRegion.y + 18}
              textAnchor="middle"
              fill="#e5e7eb"
              fontSize={12}
            >
              Softmax Jacobian
            </text>
            <text
              x={softmaxRegion.x + softmaxRegion.width / 2}
              y={softmaxRegion.y + 34}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize={11}
            >
              J_softmax = diag(a) − a aᵀ  (per query row)
            </text>
          </g>

          {/* Edges (connections) */}
          <g className="edges-layer">
            {connections.map((conn) => {
              const fromNode =
                mode === 'forward' ? getNode(conn.from) : getNode(conn.to)
              const toNode =
                mode === 'forward' ? getNode(conn.to) : getNode(conn.from)

              const isSoftmaxEdge = conn.id === 'scores-a'
              const rawMagnitude =
                mode === 'forward' ? conn.forwardMag : conn.backwardMag
              const magnitude = revealVisible ? rawMagnitude : 0.58
              const color = mode === 'forward' ? forwardColor : backwardColor

              const strokeWidth = 1.2 + 3.2 * magnitude
              const opacity = 0.18 + 0.78 * magnitude

              const dx = toNode.x - fromNode.x
              const dy = toNode.y - fromNode.y
              const len = Math.sqrt(dx * dx + dy * dy) || 1
              const ux = dx / len
              const uy = dy / len
              const startX = fromNode.x + ux * 32
              const startY = fromNode.y + uy * 24
              const endX = toNode.x - ux * 32
              const endY = toNode.y - uy * 24

              return (
                <line
                  key={`${conn.id}-${mode}`}
                  x1={startX}
                  y1={startY}
                  x2={endX}
                  y2={endY}
                  stroke={color}
                  strokeWidth={strokeWidth}
                  strokeOpacity={opacity}
                  className={[
                    'attention-edge',
                    mode === 'forward'
                      ? 'edge-forward'
                      : 'edge-backward',
                    hoveredId === conn.id ? 'edge-hovered' : '',
                    revealVisible && isSoftmaxEdge ? 'edge-softmax' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  markerEnd={
                    mode === 'forward'
                      ? 'url(#arrow-forward)'
                      : 'url(#arrow-backward)'
                  }
                  onMouseEnter={() => setHoveredId(conn.id)}
                  onMouseLeave={() => setHoveredId(null)}
                />
              )
            })}
          </g>

          {/* Nodes */}
          <g className="nodes-layer">
            {Object.values(NODES).map((node) => {
              const lines = splitLabel(node.label)
              const width =
                node.type === 'loss'
                  ? 90
                  : node.type === 'param'
                  ? 120
                  : 130
              const height =
                node.type === 'tensor'
                  ? 56
                  : node.type === 'param'
                  ? 52
                  : 46
              const x = node.x - width / 2
              const y = node.y - height / 2

              let fill = '#020617'
              let stroke = '#1f2937'
              if (node.type === 'tensor') {
                fill = '#020617'
                stroke = '#111827'
              } else if (node.type === 'param') {
                fill = '#0b1120'
                stroke = '#1f2937'
              } else if (node.type === 'loss') {
                fill = '#111827'
                stroke = backwardColor
              }

              return (
                <g key={node.id} className={`node node-${node.type}`}>
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    rx={12}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={1.5}
                    opacity={0.96}
                  />
                  <rect
                    x={x + 0.5}
                    y={y + 0.5}
                    width={width - 1}
                    height={height - 1}
                    rx={11}
                    fill="none"
                    stroke="rgba(15,23,42,0.9)"
                    strokeWidth={1}
                  />
                  {node.type === 'param' && (
                    <rect
                      x={x}
                      y={y + height - 6}
                      width={width}
                      height={6}
                      rx={0}
                      fill={backwardColor}
                      opacity={0.35}
                    />
                  )}
                  {node.type === 'tensor' && (
                    <rect
                      x={x}
                      y={y}
                      width={4}
                      height={height}
                      rx={4}
                      fill={MATH_COLORS.secondary}
                      opacity={0.6}
                    />
                  )}
                  <text
                    x={node.x}
                    y={node.y - 6}
                    textAnchor="middle"
                    fill="#e5e7eb"
                    fontSize={12}
                  >
                    {lines[0]}
                  </text>
                  {lines[1] && (
                    <text
                      x={node.x}
                      y={node.y + 10}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize={11}
                    >
                      {lines[1]}
                    </text>
                  )}
                  {lines[2] && (
                    <text
                      x={node.x}
                      y={node.y + 24}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize={11}
                    >
                      {lines[2]}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>

        <aside className="attention-info">
          <h3>
            {hoveredConn
              ? 'Gradient formula'
              : mode === 'backward'
              ? 'Why attention is hard to train'
              : 'Forward pass summary'}
          </h3>

          {hoveredConn ? (
            <div className="formula-panel">
              <div className="formula-pass">
                <div className="pill pill-forward">forward</div>
                <code>{hoveredConn.forwardFormula}</code>
              </div>
              <div className="formula-pass">
                <div className="pill pill-backward">backward</div>
                <code>{hoveredConn.backwardFormula}</code>
              </div>
              {hoveredConn.note && (
                <p className="formula-note">{hoveredConn.note}</p>
              )}
            </div>
          ) : mode === 'backward' ? (
            <ul className="aha-list">
              <li>
                <strong>Softmax Jacobian is dense.</strong> Changing one logit
                perturbs all attention weights in that row via
                J = diag(a) − a aᵀ.
              </li>
              <li>
                <strong>O(T²) interactions.</strong> Gradients from a single
                token backprop through QKᵀ into <em>all</em> queries and keys.
              </li>
              <li>
                <strong>Three coupled projections.</strong> dL/dX receives
                contributions through Q, K, and V paths, all tugging parameters
                in different directions.
              </li>
              <li>
                Compared to an MLP (mostly local and layerwise), attention’s
                gradients are <em>global, entangled, and highly correlated</em>,
                which makes optimization trickier.
              </li>
            </ul>
          ) : (
            <ul className="aha-list">
              <li>
                X is projected into Q, K, V by three separate weight matrices
                (W_Q, W_K, W_V).
              </li>
              <li>
                Scores S = QKᵀ / √d_k measure pairwise token compatibility.
              </li>
              <li>
                Softmax turns each row of S into attention weights A that sum to
                1.
              </li>
              <li>
                Output O is a weighted sum of values V, then fed into the loss.
              </li>
            </ul>
          )}
        </aside>
      </div>

      <style jsx>{`
        .attention-backprop-card {
          background: transparent;
          box-sizing: border-box;
          width: 100%;
          padding: clamp(0.65rem, 3vw, 1.5rem);
        }

        .attention-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 1.5rem;
          margin-bottom: 1rem;
        }

        .attention-header h2 {
          font-size: 1.25rem;
          margin-bottom: 0.25rem;
        }

        .attention-header .muted {
          max-width: 38rem;
        }

        .credit-panel {
          margin-bottom: 0.75rem;
          padding: 0.9rem;
          border-radius: 0.75rem;
          background: linear-gradient(135deg, #fffaf0, #f8f4ea);
          border: 1px solid #d6c7ad;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
        }

        .credit-copy {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          margin-bottom: 0.75rem;
        }

        .credit-copy span {
          color: #7c2d12;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .credit-copy strong {
          color: #1f2937;
          font-size: 0.95rem;
        }

        .credit-copy p {
          margin: 0;
          color: #4b5563;
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .credit-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .credit-choices {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
          gap: 0.5rem;
          margin-bottom: 0.75rem;
        }

        .credit-choices button,
        .reveal-credit,
        .reset-credit {
          border-radius: 999px;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 700;
        }

        .credit-choices button {
          padding: 0.4rem 0.75rem;
          border: 1px solid #d6c7ad;
          background: #fffaf0;
          color: #1f2937;
        }

        .credit-choices button.selected {
          border: 2px solid #7c3aed;
          background: #ede9fe;
          color: #5b21b6;
        }

        .credit-evidence-strip {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
          gap: 0.5rem;
          margin-bottom: 0.75rem;
          padding: 0.6rem;
          border-radius: 0.65rem;
          background: #0f172a;
          border: 1px solid #334155;
        }

        .credit-evidence-step {
          min-height: 82px;
          padding: 0.6rem;
          border-radius: 0.55rem;
          background: #111827;
          border: 1px solid #1f2937;
          color: #d1d5db;
        }

        .credit-evidence-step.active {
          background: #fff7ed;
          border-color: #f59e0b;
          color: #1f2937;
        }

        .credit-evidence-title {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          margin-bottom: 0.35rem;
        }

        .credit-evidence-title span {
          width: 1.35rem;
          height: 1.35rem;
          border-radius: 999px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: #334155;
          color: #f8fafc;
          font-size: 0.72rem;
          font-weight: 800;
          flex: 0 0 auto;
        }

        .credit-evidence-step.active .credit-evidence-title span {
          background: #f59e0b;
          color: #111827;
        }

        .credit-evidence-title strong {
          color: #f8fafc;
          font-size: 0.78rem;
        }

        .credit-evidence-step.active .credit-evidence-title strong {
          color: #111827;
        }

        .credit-evidence-step p {
          margin: 0;
          color: #cbd5e1;
          font-size: 0.74rem;
          line-height: 1.35;
        }

        .credit-evidence-step.active p {
          color: #374151;
        }

        .reveal-credit {
          padding: 0.45rem 0.95rem;
          border: none;
          background: linear-gradient(90deg, #f59e0b, #fbbf24);
          color: #111827;
        }

        .reveal-credit:disabled {
          background: rgba(75, 85, 99, 0.55);
          color: #6b7280;
          cursor: not-allowed;
        }

        .reset-credit {
          padding: 0.45rem 0.8rem;
          border: 1px solid rgba(148, 163, 184, 0.45);
          background: rgba(15, 23, 42, 0.7);
          color: #d1d5db;
        }

        .credit-result {
          padding: 0.42rem 0.7rem;
          border-radius: 0.5rem;
          font-size: 0.82rem;
          font-weight: 700;
        }

        .credit-result.correct {
          color: #bbf7d0;
          background: rgba(34, 197, 94, 0.16);
          border: 1px solid rgba(34, 197, 94, 0.42);
        }

        .credit-result.missed {
          color: #fed7aa;
          background: rgba(251, 146, 60, 0.14);
          border: 1px solid rgba(251, 146, 60, 0.36);
        }

        .credit-readout {
          margin-bottom: 0.85rem;
          padding: 0.75rem 0.9rem;
          border-radius: 0.75rem;
          background: rgba(15, 23, 42, 0.82);
          border: 1px solid rgba(31, 41, 55, 0.9);
          color: #d1d5db;
          font-size: 0.82rem;
          line-height: 1.55;
        }

        .credit-readout.locked {
          color: #9ca3af;
        }

        .formula-witness {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
          gap: 0.45rem;
          margin-bottom: 0.9rem;
          padding: 0.75rem 0.9rem;
          border-radius: 0.75rem;
          background: rgba(2, 6, 23, 0.7);
          border: 1px solid rgba(55, 65, 81, 0.8);
          color: #cbd5e1;
          font-size: 0.78rem;
        }

        .formula-witness strong {
          grid-column: 1 / -1;
          color: #e5e7eb;
          font-size: 0.82rem;
        }

        .formula-witness code {
          display: block;
          padding: 0.35rem 0.45rem;
          border-radius: 0.45rem;
          background: rgba(15, 23, 42, 0.86);
          border: 1px solid rgba(31, 41, 55, 0.9);
          color: #bfdbfe;
          font-size: 0.74rem;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .mode-toggle {
          display: inline-flex;
          padding: 0.2rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.3);
        }

        .mode-toggle button {
          position: relative;
          border: none;
          background: transparent;
          color: #9ca3af;
          font-size: 0.85rem;
          padding: 0.3rem 0.8rem;
          border-radius: 999px;
          cursor: pointer;
          transition: color 0.15s ease, background 0.15s ease;
        }

        .mode-toggle button.active {
          color: #f9fafb;
          background: radial-gradient(
            circle at 0% 0%,
            rgba(20, 184, 166, 0.3),
            transparent 60%
          );
        }

        .attention-layout {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 1.5rem;
          align-items: stretch;
        }

        .attention-svg {
          width: 100%;
          height: auto;
          border-radius: 1rem;
          box-shadow: 0 14px 40px rgba(15, 23, 42, 0.8);
        }

        .attention-info {
          background: radial-gradient(
              circle at top left,
              rgba(56, 189, 248, 0.16),
              transparent 55%
            ),
            radial-gradient(
              circle at bottom right,
              rgba(245, 158, 11, 0.25),
              transparent 55%
            ),
            #020617;
          border-radius: 1rem;
          border: 1px solid rgba(148, 163, 184, 0.35);
          padding: 1rem 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .attention-info h3 {
          font-size: 0.95rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: #e5e7eb;
        }

        .formula-panel {
          font-size: 0.8rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .formula-pass {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .formula-pass code {
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular,
            Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New',
            monospace;
          font-size: 0.78rem;
          background: rgba(15, 23, 42, 0.9);
          padding: 0.3rem 0.5rem;
          border-radius: 0.35rem;
          border: 1px solid rgba(31, 41, 55, 0.9);
          color: #e5e7eb;
        }

        .pill {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          white-space: nowrap;
        }

        .pill-forward {
          border-color: rgba(45, 212, 191, 0.7);
          color: #6ee7b7;
        }

        .pill-backward {
          border-color: rgba(251, 191, 36, 0.7);
          color: #fbbf24;
        }

        .formula-note {
          font-size: 0.78rem;
          color: #d1d5db;
          margin-top: 0.25rem;
        }

        .formula-note em {
          color: #a5b4fc;
        }

        .aha-list {
          font-size: 0.8rem;
          color: #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding-left: 1rem;
        }

        .aha-list li {
          list-style: disc;
        }

        .aha-list strong {
          color: #facc15;
        }

        .aha-list em {
          color: #a5b4fc;
        }

        .attention-edge {
          stroke-linecap: round;
          stroke-linejoin: round;
          transition: stroke-opacity 0.15s ease, stroke-width 0.15s ease;
        }

        .edge-forward {
          stroke-dasharray: 8 12;
          animation: flowForward 3.2s linear infinite;
        }

        .edge-backward {
          stroke-dasharray: 8 12;
          animation: flowBackward 3s linear infinite;
        }

        .edge-softmax {
          filter: drop-shadow(0 0 10px rgba(139, 92, 246, 0.7));
        }

        .edge-hovered {
          stroke-opacity: 1 !important;
          filter: drop-shadow(0 0 12px rgba(248, 250, 252, 0.9));
        }

        .softmax-region {
          mix-blend-mode: screen;
        }

        @keyframes flowForward {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: -80;
          }
        }

        @keyframes flowBackward {
          0% {
            stroke-dashoffset: 0;
          }
          100% {
            stroke-dashoffset: 80;
          }
        }

        @media (max-width: 1024px) {
          .attention-layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .attention-backprop-card {
            padding: 1rem;
          }

          .attention-header {
            flex-direction: column;
            align-items: stretch;
          }

          .attention-header > div:last-child {
            width: 100%;
            flex-wrap: wrap;
            justify-content: flex-start;
            align-items: stretch !important;
          }

          .mode-toggle {
            display: flex;
            width: 100%;
          }

          .mode-toggle button {
            flex: 1 1 0;
            padding-inline: 0.45rem;
            text-align: center;
          }
        }
      `}</style>
    </section>
  )
}
