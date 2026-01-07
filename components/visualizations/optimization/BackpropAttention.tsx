'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { MATH_COLORS } from '../../../lib/mathObjects'

// ----- Gamification types -----
type GamePhase = 'setup' | 'countdown' | 'revealed'
type BackpropPrediction = 'A' | 'B' | 'C' | null

type BackpropChallenge = {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC: string
  answer: 'A' | 'B' | 'C'
  insight: string
}

const BACKPROP_CHALLENGES: BackpropChallenge[] = [
  {
    name: '🎲 Softmax Jacobian',
    question: 'The softmax Jacobian is J = diag(a) − aaᵀ. What makes backprop through softmax challenging?',
    optionA: 'J is a sparse diagonal',
    optionB: 'J is a dense matrix',
    optionC: 'J is always zero',
    answer: 'B',
    insight: 'The Jacobian J = diag(a) − aaᵀ is DENSE: changing any logit affects ALL attention weights in that row. The aaᵀ term creates off-diagonal couplings between every pair of weights.'
  },
  {
    name: '🎲 Gradient Complexity',
    question: 'How does gradient complexity scale with sequence length T for attention?',
    optionA: 'O(T) like MLP',
    optionB: 'O(T²) from QKᵀ',
    optionC: 'O(log T)',
    answer: 'B',
    insight: 'The QKᵀ term creates O(T²) gradient interactions! Each query interacts with every key, so gradients from one token flow through ALL other tokens. This is why attention training can be unstable.'
  },
  {
    name: '🎲 Input Gradient',
    question: '∂L/∂X receives contributions from which paths?',
    optionA: 'Only through Q path',
    optionB: 'Q, K, and V paths',
    optionC: 'Only through V path',
    answer: 'B',
    insight: 'Gradients flow back through ALL three projections: ∂L/∂X = (∂L/∂Q)W_Qᵀ + (∂L/∂K)W_Kᵀ + (∂L/∂V)W_Vᵀ. These three contributions tug parameters in different directions, making optimization complex.'
  },
  {
    name: '🎲 MLP vs Attention',
    question: 'Compared to MLPs, why are attention gradients harder to train with?',
    optionA: 'More parameters',
    optionB: 'Global & entangled',
    optionC: 'Larger activations',
    answer: 'B',
    insight: 'MLP gradients are relatively local and layerwise. Attention gradients are GLOBAL (every token affects every other), ENTANGLED (through QKᵀ and softmax), and highly CORRELATED across positions.'
  }
]

function getBackpropFeedback(predicted: BackpropPrediction, challenge: BackpropChallenge): string {
  if (!predicted) return ''
  const isCorrect = predicted === challenge.answer
  const correctLabel = challenge.answer === 'A' ? challenge.optionA : challenge.answer === 'B' ? challenge.optionB : challenge.optionC
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}`
  }
  return `✗ The answer is "${correctLabel}". ${challenge.insight}`
}

type Mode = 'forward' | 'backward'

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
    note: "Softmax Jacobian is dense: each weight's gradient depends on every other weight in its row.",
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

  // ----- Gamification state -----
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<BackpropChallenge | null>(null)
  const [prediction, setPrediction] = useState<BackpropPrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  function startChallenge(challenge: BackpropChallenge) {
    setActiveChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
    setMode('backward') // Show backward pass for gradient questions
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

  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
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

  const hoveredConn = useMemo(
    () => CONNECTIONS.find((c) => c.id === hoveredId),
    [hoveredId]
  )

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
            {CONNECTIONS.map((conn) => {
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
                Compared to an MLP (mostly local and layerwise), attention's
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

      {/* Game Panel */}
      <div className="backprop-game-panel">
        <div className="game-header">
          <span className="game-title">🎮 Gradient Challenge</span>
          {score.total > 0 && (
            <span className="game-score">Score: {score.correct}/{score.total}</span>
          )}
        </div>

        {!activeChallenge ? (
          <div className="challenge-select">
            <p className="challenge-prompt">Test your understanding of attention backprop:</p>
            <div className="challenge-buttons">
              {BACKPROP_CHALLENGES.map((ch, idx) => (
                <button key={idx} className="challenge-btn" onClick={() => startChallenge(ch)}>
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        ) : gamePhase === 'setup' ? (
          <div className="game-active">
            <p className="game-question">{activeChallenge.question}</p>
            <div className="prediction-buttons">
              {(['A', 'B', 'C'] as const).map((opt) => (
                <button
                  key={opt}
                  className={`pred-btn ${prediction === opt ? 'selected' : ''}`}
                  onClick={() => setPrediction(opt)}
                >
                  {opt === 'A' ? activeChallenge.optionA : opt === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
                </button>
              ))}
            </div>
            <div className="game-actions">
              <button className="submit-btn" onClick={submitPrediction} disabled={!prediction}>Submit</button>
              <button className="reset-btn" onClick={resetGame}>Cancel</button>
            </div>
          </div>
        ) : gamePhase === 'countdown' ? (
          <div className="countdown-display">
            <span className="countdown-number">{countdown}</span>
            <span className="countdown-label">Revealing...</span>
          </div>
        ) : (
          <div className="feedback-panel">
            <p className="feedback-text">{getBackpropFeedback(prediction, activeChallenge)}</p>
            <button className="next-btn" onClick={resetGame}>Try Another Challenge</button>
          </div>
        )}
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

        /* ----- Game Panel Styles ----- */
        .backprop-game-panel {
          margin-top: 1rem;
          padding: 0.8rem 1rem;
          border-radius: 0.75rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.6rem;
        }

        .game-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: #f9fafb;
        }

        .game-score {
          font-size: 0.8rem;
          color: #14b8a6;
          font-weight: 500;
        }

        .challenge-prompt {
          font-size: 0.85rem;
          color: #9ca3af;
          margin: 0 0 0.6rem;
        }

        .challenge-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .challenge-btn {
          padding: 0.4rem 0.8rem;
          font-size: 0.8rem;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 999px;
          color: #93c5fd;
          cursor: pointer;
        }

        .game-question {
          font-size: 0.9rem;
          color: #f9fafb;
          margin: 0 0 0.7rem;
          line-height: 1.4;
        }

        .prediction-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          margin-bottom: 0.7rem;
        }

        .pred-btn {
          padding: 0.5rem 0.8rem;
          font-size: 0.85rem;
          background: rgba(31, 41, 55, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 0.5rem;
          color: #e5e7eb;
          cursor: pointer;
          text-align: left;
        }

        .pred-btn.selected {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.6);
          color: #fbbf24;
        }

        .game-actions {
          display: flex;
          gap: 0.6rem;
        }

        .submit-btn {
          flex: 1;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.5);
          border-radius: 0.5rem;
          color: #fbbf24;
          cursor: pointer;
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .reset-btn {
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 0.5rem;
          color: #9ca3af;
          cursor: pointer;
        }

        .countdown-display {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem;
        }

        .countdown-number {
          font-size: 2.2rem;
          font-weight: 700;
          color: #f59e0b;
        }

        .countdown-label {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .feedback-text {
          font-size: 0.88rem;
          line-height: 1.5;
          color: #e5e7eb;
          margin: 0 0 0.7rem;
        }

        .next-btn {
          width: 100%;
          padding: 0.5rem 1rem;
          font-size: 0.85rem;
          background: rgba(20, 184, 166, 0.2);
          border: 1px solid rgba(20, 184, 166, 0.5);
          border-radius: 0.5rem;
          color: #2dd4bf;
          cursor: pointer;
        }
      `}</style>
    </section>
  )
}
