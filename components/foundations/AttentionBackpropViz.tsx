'use client'

import React, { useMemo, useState, useCallback, useEffect } from 'react'
import { MATH_COLORS } from '../../lib/mathObjects'

type Mode = 'forward' | 'backward'

// === Gamification Types ===
type GamePhase = 'setup' | 'countdown' | 'revealed'
type GradientPrediction = 'wq' | 'wk' | 'wv' | 'softmax' | null

interface GradientChallenge {
  name: string
  scenarioId: ScenarioId
  question: string
  answer: GradientPrediction
  explanation: string
}

const GRADIENT_CHALLENGES: GradientChallenge[] = [
  {
    name: '🎲 Loud Keys',
    scenarioId: 'largeK',
    question: 'When keys K are large, which weight matrix gets the BIGGEST gradient update?',
    answer: 'wq',
    explanation: 'Counterintuitive! ∂L/∂Q = (∂L/∂S)K/√d_k. Large K amplifies the gradient flowing into Q, so W_Q gets bigger updates than W_K. The gradient "crosses over" through the QKᵀ interaction.',
  },
  {
    name: '🎲 Loud Queries',
    scenarioId: 'largeQ',
    question: 'When queries Q are large, which weight matrix receives larger gradients?',
    answer: 'wk',
    explanation: 'Mirror effect! ∂L/∂K = (∂L/∂S)ᵀQ/√d_k. Large Q amplifies key gradients, so W_K learns more than W_Q. This Q↔K gradient symmetry is crucial for attention training dynamics.',
  },
  {
    name: '🎲 Saturated Softmax',
    scenarioId: 'softmaxSaturation',
    question: 'When attention is peaky (one token dominates), where do gradients get blocked?',
    answer: 'softmax',
    explanation: 'Vanishing gradients! The softmax Jacobian J = diag(a) − aaᵀ shrinks when attention concentrates. With a ≈ [1, 0, 0, ...], J becomes nearly zero. This is the "softmax saturation" problem.',
  },
  {
    name: '🎲 Loud Values',
    scenarioId: 'largeV',
    question: 'When value vectors V are large, what learns the most?',
    answer: 'softmax',
    explanation: 'Attention weights learn! ∂L/∂A = (∂L/∂O)Vᵀ. Large V means big gradients flow into A, which propagate through softmax to Q and K. The "what to attend to" circuit (Q/K) adapts to large values.',
  },
]

function getGradientFeedback(
  prediction: GradientPrediction,
  challenge: GradientChallenge
): string {
  if (!prediction) return ''

  const isCorrect = prediction === challenge.answer
  const names: Record<string, string> = {
    wq: 'W_Q (query weights)',
    wk: 'W_K (key weights)',
    wv: 'W_V (value weights)',
    softmax: 'Softmax/Attention',
  }

  if (isCorrect) {
    return `✅ Correct! ${challenge.explanation}`
  }

  return `❌ Not quite. You chose ${names[prediction]}, but the answer is ${names[challenge.answer!]}.\n\n${challenge.explanation}`
}

// Scenario presets that create distinct gradient signatures (per Oracle's gamification design)
type ScenarioId = 'baseline' | 'largeK' | 'largeQ' | 'softmaxSaturation' | 'uniformAttention' | 'largeV'

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
    multipliers: { 'q-scores': 1.4, 'x-q': 1.3, 'wq-q': 1.5, 'scores-a': 1.2 },
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

export default function AttentionBackpropExplorer() {
  const [mode, setMode] = useState<Mode>('backward')
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [activeScenario, setActiveScenario] = useState<ScenarioId>('baseline')

  // === Gamification State ===
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<GradientChallenge | null>(null)
  const [prediction, setPrediction] = useState<GradientPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

  // Start a challenge
  const startChallenge = useCallback((challenge: GradientChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setActiveScenario(challenge.scenarioId)
    setMode('backward') // Always show backward pass for gradient challenges
    setGamePhase('countdown')
    setCountdown(8) // 8 seconds to think
  }, [])

  // Submit prediction
  const submitPrediction = useCallback((pred: GradientPrediction) => {
    if (gamePhase !== 'countdown' || !selectedChallenge) return
    setPrediction(pred)
    setGamePhase('revealed')
    if (pred === selectedChallenge.answer && !completedChallenges.has(selectedChallenge.name)) {
      setScore((s) => s + 1)
      setCompletedChallenges((prev) => new Set([...prev, selectedChallenge.name]))
    }
  }, [gamePhase, selectedChallenge, completedChallenges])

  // Reset game
  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setScore(0)
    setCompletedChallenges(new Set())
  }, [])

  // Countdown timer
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setGamePhase('revealed')
      } else {
        setCountdown((c) => c - 1)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

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
  const currentInsight = useMemo(() => {
    return getAttentionBackpropInsight(activeScenario, mode, connections)
  }, [activeScenario, mode, connections])

  // Handle preset selection
  const handlePreset = useCallback((scenarioId: ScenarioId) => {
    setActiveScenario(scenarioId)
  }, [])

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
            Toggle forward vs backward pass. Thicker, brighter links carry larger
            activations/gradients. Watch how the softmax Jacobian couples
            everything together.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              setGameMode(!gameMode)
              if (gameMode) resetGame()
            }}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: gameMode ? '2px solid #22c55e' : '1px solid rgba(34,197,94,0.4)',
              background: gameMode
                ? 'linear-gradient(135deg, rgba(34,197,94,0.25), rgba(16,185,129,0.15))'
                : 'rgba(15,23,42,0.8)',
              color: gameMode ? '#e5e7eb' : '#9ca3af',
              fontSize: '0.78rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
          >
            <span>{gameMode ? '🎮' : '🎯'}</span>
            <span>{gameMode ? 'Exit Challenge' : 'Try Gradient Quiz'}</span>
          </button>
          <div className="mode-toggle" aria-label="Select visualization mode">
            <button
              type="button"
              className={mode === 'forward' ? 'active' : ''}
              onClick={() => setMode('forward')}
            >
              Forward pass
            </button>
            <button
              type="button"
              className={mode === 'backward' ? 'active' : ''}
              onClick={() => setMode('backward')}
            >
              Backward pass
            </button>
          </div>
        </div>
      </div>

      {/* Gamification Panel */}
      {gameMode && (
        <div style={{
          padding: '0.75rem',
          borderRadius: '0.75rem',
          background: 'linear-gradient(135deg, rgba(34,197,94,0.12), rgba(16,185,129,0.06))',
          border: '1px solid rgba(34,197,94,0.4)',
          marginBottom: '0.75rem',
        }}>
          {gamePhase === 'setup' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  🎯 Gradient Flow Prediction Challenge
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                  Score: {score}/{GRADIENT_CHALLENGES.length}
                </span>
              </div>
              <p style={{ margin: '0 0 0.6rem', fontSize: '0.78rem', color: '#9ca3af' }}>
                Can you predict where gradients flow in attention? The answers are often counterintuitive!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {GRADIENT_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    style={{
                      padding: '0.3rem 0.6rem',
                      borderRadius: '999px',
                      border: completedChallenges.has(challenge.name)
                        ? '1px solid rgba(34,197,94,0.6)'
                        : '1px solid rgba(148,163,184,0.3)',
                      background: completedChallenges.has(challenge.name)
                        ? 'rgba(34,197,94,0.15)'
                        : 'rgba(15,23,42,0.7)',
                      color: completedChallenges.has(challenge.name) ? '#22c55e' : '#e5e7eb',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                    }}
                  >
                    {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'countdown' && selectedChallenge && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  {selectedChallenge.name}
                </h3>
                <span style={{
                  fontSize: '1rem',
                  fontWeight: 'bold',
                  color: countdown <= 3 ? '#ef4444' : '#f59e0b',
                }}>
                  ⏱️ {countdown}s
                </span>
              </div>
              <div style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: 'rgba(15,23,42,0.6)',
                border: '1px solid rgba(148,163,184,0.2)',
                marginBottom: '0.6rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {selectedChallenge.question}
                </p>
                <p style={{ margin: '0.4rem 0 0', fontSize: '0.75rem', color: '#9ca3af', fontStyle: 'italic' }}>
                  💡 Look at the gradient flows in the diagram. Thicker = larger gradients.
                </p>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {[
                  { id: 'wq' as GradientPrediction, label: 'W_Q', desc: 'Query weights' },
                  { id: 'wk' as GradientPrediction, label: 'W_K', desc: 'Key weights' },
                  { id: 'wv' as GradientPrediction, label: 'W_V', desc: 'Value weights' },
                  { id: 'softmax' as GradientPrediction, label: 'Softmax', desc: 'Attention mechanism' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => submitPrediction(opt.id)}
                    style={{
                      padding: '0.4rem 0.7rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(245,158,11,0.5)',
                      background: 'rgba(245,158,11,0.12)',
                      color: '#e5e7eb',
                      fontSize: '0.78rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    title={opt.desc}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb' }}>
                  {selectedChallenge.name} — Result
                </h3>
                <span style={{ fontSize: '0.75rem', color: '#22c55e' }}>
                  Score: {score}/{GRADIENT_CHALLENGES.length}
                </span>
              </div>
              <div style={{
                padding: '0.6rem',
                borderRadius: '0.5rem',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34,197,94,0.15)'
                  : 'rgba(239,68,68,0.15)',
                border: `1px solid ${prediction === selectedChallenge.answer ? 'rgba(34,197,94,0.5)' : 'rgba(239,68,68,0.5)'}`,
                marginBottom: '0.6rem',
              }}>
                <p style={{ margin: 0, fontSize: '0.82rem', color: '#e5e7eb', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                  {getGradientFeedback(prediction, selectedChallenge)}
                </p>
                {!prediction && (
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#f59e0b' }}>
                    ⏰ Time's up! The answer is {selectedChallenge.answer === 'wq' ? 'W_Q' : selectedChallenge.answer === 'wk' ? 'W_K' : selectedChallenge.answer === 'wv' ? 'W_V' : 'Softmax'}.
                    <br /><br />{selectedChallenge.explanation}
                  </p>
                )}
              </div>
              <button
                onClick={() => setGamePhase('setup')}
                style={{
                  padding: '0.35rem 0.7rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(34,197,94,0.5)',
                  background: 'rgba(34,197,94,0.15)',
                  color: '#22c55e',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                ← Try Another Challenge
              </button>
            </>
          )}
        </div>
      )}

      {/* Scenario Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {SCENARIO_PRESETS.map((preset) => (
          <button
            key={preset.id}
            onClick={() => handlePreset(preset.id)}
            style={{
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: activeScenario === preset.id ? '2px solid #a855f7' : '1px solid rgba(148,163,184,0.4)',
              background: activeScenario === preset.id
                ? 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(99,102,241,0.15))'
                : 'rgba(15,23,42,0.8)',
              color: activeScenario === preset.id ? '#e5e7eb' : '#9ca3af',
              fontSize: '0.78rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
            }}
            title={preset.description}
          >
            <span>{preset.emoji}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '0.6rem 0.9rem',
          borderRadius: '0.5rem',
          background: `linear-gradient(135deg, ${currentInsight.color}22, ${currentInsight.color}08)`,
          border: `1px solid ${currentInsight.color}55`,
          marginBottom: '0.75rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
        }}
      >
        <span style={{ fontSize: '1.1rem' }}>{currentInsight.emoji}</span>
        <p style={{ margin: 0, fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.4 }}>
          {currentInsight.text}
        </p>
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
              opacity={mode === 'backward' ? 0.45 : 0.35}
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
              const magnitude =
                mode === 'forward' ? conn.forwardMag : conn.backwardMag
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
                    isSoftmaxEdge ? 'edge-softmax' : '',
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
          padding: 1.5rem;
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
      `}</style>
    </section>
  )
}
