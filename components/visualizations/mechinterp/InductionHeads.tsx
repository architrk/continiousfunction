'use client'

import React, { useMemo, useState } from 'react'

function softmax(logits: number[]): number[] {
  if (logits.length === 0) return []
  const maxLogit = Math.max(...logits)
  const exps = logits.map(l => Math.exp(l - maxLogit))
  const sumExps = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sumExps)
}

const PREVIOUS_HEAD_COLOR = '#14b8a6' // teal
const INDUCTION_HEAD_COLOR = '#f59e0b' // orange
const BG_COLOR = '#0d1219'

type HeadType = 'previous' | 'induction'
type Step = 1 | 2 | 3

type TokenRole = 'none' | 'A-first' | 'A-second' | 'B' | 'target'

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed'

// Mystery challenges with hidden patterns
const INDUCTION_CHALLENGES = [
  {
    name: '🎲 Name Pattern',
    sequence: 'Alice Bob went to town . Alice ?',
    answer: 'Bob',
    description: 'A name appears twice—what follows it the first time?',
  },
  {
    name: '🎲 Code Pattern',
    sequence: 'if x == 0 : return 1 elif x == 0 : ?',
    answer: 'return',
    description: 'Programming repetition—what did "x == 0" lead to before?',
  },
  {
    name: '🎲 Story Pattern',
    sequence: 'The wizard cast magic . The wizard ?',
    answer: 'cast',
    description: 'Narrative repetition—what action follows "The wizard"?',
  },
  {
    name: '🎲 Math Pattern',
    sequence: 'f ( x ) = 2x + 1 g ( x ) = ?',
    answer: '2x',
    description: 'Function patterns—what might come after "( x ) ="?',
  },
];

// Feedback based on prediction
const getInductionFeedback = (
  predicted: string,
  actual: string,
  tokenA: string
): string => {
  const isCorrect = predicted.toLowerCase() === actual.toLowerCase();

  if (isCorrect) {
    return `🎯 Correct! The induction circuit found the earlier "${tokenA}" and copied what followed it: "${actual}". This is exactly how transformers do in-context learning—by completing patterns seen earlier in the context.`;
  }

  return `❌ The answer was "${actual}". The induction head searched for earlier occurrences of "${tokenA}" and found that "${actual}" followed it. This "[A][B]...[A][?]→[B]" pattern is fundamental to how transformers learn in-context!`;
};

interface AttentionEdge {
  id: string
  from: number
  to: number
  head: HeadType
  kind:
    | 'prev-chain'
    | 'prev-query'
    | 'prev-target'
    | 'prev-b'
    | 'ind-main'
    | 'ind-secondary'
  baseWeight: number
}

interface InductionPattern {
  targetIndex: number // position t (the "?" slot where we want to predict B)
  queryIndex: number  // position t-1 (current A, e.g. the second "Harry")
  tokenA: string
  previousMatches: number[] // all earlier positions with token A
  previousIndex: number      // last earlier A
  predictedIndex?: number    // index of B after the first A
  predictedToken?: string
}

/**
 * Simple whitespace tokenizer – good enough for explorable demo.
 */
function tokenize(input: string): string[] {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

/**
 * Infer the [A][B] ... [A][?] induction pattern from tokens.
 * We treat the last token as the "?" (prediction slot) and the previous token as A.
 */
function inferPattern(tokens: string[]): InductionPattern | null {
  if (tokens.length < 3) return null

  const targetIndex = tokens.length - 1 // "?" position
  const queryIndex = Math.max(0, targetIndex - 1) // the second A
  const tokenA = tokens[queryIndex]
  if (!tokenA) return null

  const previousMatches: number[] = []
  for (let i = 0; i < queryIndex; i++) {
    if (tokens[i] === tokenA) {
      previousMatches.push(i)
    }
  }

  if (previousMatches.length === 0) return null

  const previousIndex = previousMatches[previousMatches.length - 1]
  const predictedIndex = previousIndex + 1 < tokens.length ? previousIndex + 1 : undefined
  const predictedToken = predictedIndex !== undefined ? tokens[predictedIndex] : undefined

  return {
    targetIndex,
    queryIndex,
    tokenA,
    previousMatches,
    previousIndex,
    predictedIndex,
    predictedToken,
  }
}

/**
 * Build attention edges for the two-head circuit.
 */
function buildEdges(tokens: string[], pattern: InductionPattern | null): AttentionEdge[] {
  const edges: AttentionEdge[] = []
  const n = tokens.length
  if (n <= 1) return edges

  // Previous-token head: query at position i attends to i-1
  for (let i = 1; i < n; i++) {
    let kind: AttentionEdge['kind'] = 'prev-chain'
    if (pattern) {
      if (i === pattern.targetIndex) kind = 'prev-target'
      else if (pattern.predictedIndex !== undefined && i === pattern.predictedIndex) kind = 'prev-b'
      else if (i === pattern.queryIndex) kind = 'prev-query'
    }

    const baseWeight =
      kind === 'prev-chain'
        ? 0.18
        : kind === 'prev-b'
        ? 0.9
        : kind === 'prev-target'
        ? 0.9
        : 0.5

    edges.push({
      id: `prev-${i}-${i - 1}`,
      from: i,
      to: i - 1,
      head: 'previous',
      kind,
      baseWeight,
    })
  }

  // Induction head: query at current A (queryIndex) attends to earlier A's
  if (pattern && pattern.previousMatches.length > 0) {
    const { queryIndex, previousMatches, previousIndex } = pattern
    const logits = previousMatches.map(idx => -(queryIndex - idx))
    const weights = softmax(logits)

    previousMatches.forEach((idx, k) => {
      const kind: AttentionEdge['kind'] = idx === previousIndex ? 'ind-main' : 'ind-secondary'
      edges.push({
        id: `ind-${queryIndex}-${idx}`,
        from: queryIndex,
        to: idx,
        head: 'induction',
        kind,
        baseWeight: weights[k],
      })
    })
  }

  return edges
}

function edgeVisual(edge: AttentionEdge, step: Step) {
  let emphasis = 0.2
  let animated = false

  if (step === 1) {
    // Step 1 – find earlier [A]
    if (edge.head === 'induction') {
      emphasis = edge.kind === 'ind-main' ? 1.0 : 0.6
      animated = true
    } else {
      emphasis = edge.kind === 'prev-query' ? 0.4 : 0.15
    }
  } else if (step === 2) {
    // Step 2 – look at what followed that earlier [A] (its [B])
    if (edge.head === 'previous') {
      if (edge.kind === 'prev-b') {
        emphasis = 1.0
        animated = true
      } else if (edge.kind === 'prev-chain' || edge.kind === 'prev-query') {
        emphasis = 0.3
      }
    } else {
      emphasis = edge.kind === 'ind-main' ? 0.45 : 0.2
    }
  } else {
    // Step 3 – use that to predict [B] now
    if (edge.head === 'previous' && edge.kind === 'prev-target') {
      emphasis = 1.0
      animated = true
    } else if (edge.kind === 'ind-main') {
      emphasis = 0.5
    } else {
      emphasis = 0.15
    }
  }

  const width = 0.6 + edge.baseWeight * 5 * emphasis
  const opacity = 0.15 + edge.baseWeight * 0.9 * emphasis

  return { width, opacity, animated }
}

function tokenRole(index: number, pattern: InductionPattern | null): TokenRole {
  if (!pattern) return 'none'
  if (index === pattern.targetIndex) return 'target'
  if (pattern.predictedIndex !== undefined && index === pattern.predictedIndex) return 'B'
  if (index === pattern.queryIndex) return 'A-second'
  if (index === pattern.previousIndex) return 'A-first'
  return 'none'
}

function tokenVisual(role: TokenRole) {
  switch (role) {
    case 'A-first':
      return {
        fill: 'rgba(245, 158, 11, 0.15)',
        stroke: INDUCTION_HEAD_COLOR,
        strokeWidth: 1.5,
        text: '#e5e7eb',
      }
    case 'A-second':
      return {
        fill: 'rgba(245, 158, 11, 0.22)',
        stroke: INDUCTION_HEAD_COLOR,
        strokeWidth: 2,
        text: '#fefce8',
      }
    case 'B':
      return {
        fill: 'rgba(20, 184, 166, 0.22)',
        stroke: PREVIOUS_HEAD_COLOR,
        strokeWidth: 2,
        text: '#f0fdf4',
      }
    case 'target':
      return {
        fill: 'rgba(148, 163, 184, 0.22)',
        stroke: '#e5e7eb',
        strokeWidth: 2,
        text: '#e5e7eb',
      }
    case 'none':
    default:
      return {
        fill: 'rgba(15, 23, 42, 0.85)',
        stroke: 'rgba(148, 163, 184, 0.5)',
        strokeWidth: 1,
        text: '#e5e7eb',
      }
  }
}

export default function InductionHeadsPlayground() {
  const [rawInput, setRawInput] = useState(
    // "Harry Potter ... Harry ?" pattern out of the box
    'Harry Potter went to Hogwarts . Harry ?'
  )
  const [step, setStep] = useState<Step>(1)

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof INDUCTION_CHALLENGES[0] | null>(null)
  const [userGuess, setUserGuess] = useState('')
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const tokens = useMemo(() => tokenize(rawInput), [rawInput])
  const pattern = useMemo(() => inferPattern(tokens), [tokens])
  const edges = useMemo(() => buildEdges(tokens, pattern), [tokens, pattern])

  // Positions of tokens along the x-axis
  const positions = useMemo(() => {
    const n = tokens.length
    const width = 800
    const margin = 70
    if (n === 0) return [] as { x: number }[]
    if (n === 1) return [{ x: width / 2 }]

    const usable = width - margin * 2
    const stepX = usable / (n - 1)
    return tokens.map((_, i) => ({ x: margin + stepX * i }))
  }, [tokens])

  const aToken = pattern?.tokenA
  const bToken = pattern?.predictedToken

  const stepLabel =
    step === 1
      ? '1. Find earlier [A]'
      : step === 2
      ? '2. Look at what followed'
      : '3. Predict [B] now'

  const stepExplanation =
    step === 1
      ? `The induction head at the current "${aToken ?? 'A'}" looks back over the context and locks onto an earlier "${aToken ?? 'A'}".`
      : step === 2
      ? `The previous-token head remembers what followed that earlier "${aToken ?? 'A'}" — the "${bToken ?? 'B'}" token right after it.`
      : `Combining both heads, the model completes the pattern: "I saw [${aToken ?? 'A'}][${bToken ?? 'B'}] before. I see [${aToken ?? 'A'}] now. Predict [${bToken ?? 'B'}]."`

  const hasPattern = Boolean(pattern && bToken)

  // Game control functions
  const startChallenge = (challenge: typeof INDUCTION_CHALLENGES[0]) => {
    setSelectedChallenge(challenge)
    setUserGuess('')
    setGamePhase('setup')
    // Set the sequence but hide what [B] should be
    setRawInput(challenge.sequence)
    setStep(1)
  }

  const submitGuess = () => {
    if (!selectedChallenge || !userGuess.trim()) return
    setGamePhase('countdown')
    setCountdown(3)
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setUserGuess('')
  }

  // Countdown effect
  React.useEffect(() => {
    if (gamePhase !== 'countdown') return

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer)
          // Reveal phase
          if (selectedChallenge) {
            const isCorrect = userGuess.toLowerCase().trim() === selectedChallenge.answer.toLowerCase()
            setScore(prev => ({
              correct: prev.correct + (isCorrect ? 1 : 0),
              total: prev.total + 1,
            }))
            // Run through the steps to show the circuit
            setStep(3)
          }
          setGamePhase('revealed')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [gamePhase, selectedChallenge, userGuess])

  return (
    <section className="induction-card">
      <header className="induction-header">
        <div>
          <h2>Induction Heads: Pattern Completion Circuit</h2>
          <p className="muted">
            Two attention heads implement in-context pattern completion:
            <span className="formula">
              &ldquo;I saw [A][B] before. I see [A] now. Predict [B].&rdquo;
            </span>
          </p>
        </div>
        <div className="legend">
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: PREVIOUS_HEAD_COLOR }}
            />
            Previous-token head
          </span>
          <span className="legend-item">
            <span
              className="legend-dot"
              style={{ backgroundColor: INDUCTION_HEAD_COLOR }}
            />
            Induction head
          </span>
        </div>
      </header>

      {/* Game Mode Toggle & UI */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode)
            if (!gameMode) resetGame()
          }}
          style={{
            fontSize: '0.78rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            border: gameMode ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
              : 'rgba(15, 23, 42, 0.9)',
            color: gameMode ? '#fed7aa' : '#e5e7eb',
            cursor: 'pointer',
            fontWeight: gameMode ? 600 : 400,
          }}
        >
          {gameMode ? '🎮 Challenge Mode' : '🎮 Pattern Challenge'}
        </button>
        {gameMode && score.total > 0 && (
          <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
          </span>
        )}
      </div>

      {/* Game Panel */}
      {gameMode && (
        <div style={{
          padding: '0.85rem',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(20, 184, 166, 0.1))',
          border: '1px solid rgba(245, 158, 11, 0.3)',
        }}>
          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.5rem', fontWeight: 600 }}>
                🎯 Pattern Completion Challenge
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                See a sequence with [A]...[A][?]. Predict what token [B] the induction circuit will complete!
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {INDUCTION_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    title={challenge.description}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#fed7aa', marginBottom: '0.4rem', fontWeight: 600 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                {selectedChallenge.description}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                What token will complete the pattern at "?"?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  value={userGuess}
                  onChange={(e) => setUserGuess(e.target.value)}
                  placeholder="Type your prediction..."
                  style={{
                    padding: '0.45rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(148, 163, 184, 0.5)',
                    background: 'rgba(15, 23, 42, 0.95)',
                    color: '#e5e7eb',
                    fontSize: '0.85rem',
                    minWidth: '150px',
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGuess()
                  }}
                />
                <button
                  onClick={submitGuess}
                  disabled={!userGuess.trim()}
                  style={{
                    fontSize: '0.78rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '999px',
                    border: 'none',
                    background: userGuess.trim()
                      ? 'linear-gradient(90deg, #f59e0b, #facc15)'
                      : 'rgba(107, 114, 128, 0.5)',
                    color: userGuess.trim() ? '#111827' : '#9ca3af',
                    cursor: userGuess.trim() ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                  }}
                >
                  Predict "{userGuess || '...'}"
                </button>
              </div>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.95rem', color: '#fed7aa', marginBottom: '0.5rem' }}>
                You predicted: <strong>"{userGuess}"</strong>
              </p>
              <p style={{ fontSize: '2.2rem', color: '#e5e7eb', fontWeight: 700 }}>
                {countdown}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Running induction circuit...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{
                padding: '0.65rem',
                borderRadius: '8px',
                background: userGuess.toLowerCase().trim() === selectedChallenge.answer.toLowerCase()
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: userGuess.toLowerCase().trim() === selectedChallenge.answer.toLowerCase()
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '0.65rem',
              }}>
                <p style={{ fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getInductionFeedback(userGuess, selectedChallenge.answer, aToken ?? 'A')}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                Try Another
              </button>
            </>
          )}
        </div>
      )}

      <div className="controls">
        <label className="input-label">
          Sequence (last token is the prediction slot):
          <input
            type="text"
            value={rawInput}
            onChange={e => {
              setRawInput(e.target.value)
              setStep(1)
            }}
            spellCheck={false}
            className="sequence-input"
            placeholder='Try: "Alice Bob ... Alice ?"'
          />
        </label>
        <div className="preset-row">
          <span className="preset-label">Examples:</span>
          <button
            type="button"
            onClick={() => {
              setRawInput('Harry Potter ... Harry ?')
              setStep(1)
            }}
          >
            Harry Potter ... Harry ?
          </button>
          <button
            type="button"
            onClick={() => {
              setRawInput('Alice Bob went home . Alice ?')
              setStep(1)
            }}
          >
            Alice Bob ... Alice ?
          </button>
          <button
            type="button"
            onClick={() => {
              setRawInput('if x == 0 : return 1 else if x == 0 : ?')
              setStep(1)
            }}
          >
            if x == 0 ... if x == 0 ?
          </button>
        </div>
      </div>

      <div className="stepper">
        {[1, 2, 3].map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setStep(s as Step)}
            className={`step-btn ${step === s ? 'active' : ''}`}
            aria-pressed={step === s}
          >
            {s}.
            {s === 1 && ' Match earlier [A]'}
            {s === 2 && ' Follow to [B]'}
            {s === 3 && ' Predict [B]'}
          </button>
        ))}
      </div>

      <p className="step-explainer">
        <span className="step-label">{stepLabel}</span> {stepExplanation}
      </p>

      <div className="visual-wrapper">
        <svg
          className="attention-svg"
          viewBox="0 0 800 260"
          role="img"
          aria-label="Two-head induction circuit over the token sequence"
        >
          <defs>
            <marker
              id="arrow-prev"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L6,3 z" fill={PREVIOUS_HEAD_COLOR} />
            </marker>
            <marker
              id="arrow-ind"
              markerWidth="8"
              markerHeight="8"
              refX="6"
              refY="3"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L0,6 L6,3 z" fill={INDUCTION_HEAD_COLOR} />
            </marker>
          </defs>

          {/* Token timeline axis */}
          <line
            x1={40}
            y1={190}
            x2={760}
            y2={190}
            stroke="rgba(148, 163, 184, 0.4)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {/* Attention edges */}
          {edges.map(edge => {
            const posFrom = positions[edge.from]
            const posTo = positions[edge.to]
            if (!posFrom || !posTo) return null

            const baseY = 150
            const arcHeight =
              edge.head === 'previous'
                ? 40
                : 80 // induction arcs are taller
            const controlY = baseY - arcHeight

            const { width, opacity, animated } = edgeVisual(edge, step)

            const d = `M ${posFrom.x} ${baseY}
                       C ${posFrom.x} ${controlY},
                         ${posTo.x} ${controlY},
                         ${posTo.x} ${baseY}`

            return (
              <path
                key={edge.id}
                d={d}
                fill="none"
                stroke={
                  edge.head === 'previous'
                    ? PREVIOUS_HEAD_COLOR
                    : INDUCTION_HEAD_COLOR
                }
                strokeWidth={width}
                opacity={opacity}
                className={`attention-edge ${
                  animated ? 'attention-edge-animated' : ''
                }`}
                markerEnd={
                  edge.head === 'previous'
                    ? 'url(#arrow-prev)'
                    : 'url(#arrow-ind)'
                }
              />
            )
          })}

          {/* Tokens */}
          {tokens.map((tok, i) => {
            const pos = positions[i]
            if (!pos) return null

            const role = tokenRole(i, pattern)
            const visual = tokenVisual(role)
            const width = 70
            const height = 28
            const x = pos.x - width / 2
            const y = 190 - height / 2

            return (
              <g key={`${tok}-${i}`}>
                <rect
                  x={x}
                  y={y}
                  width={width}
                  height={height}
                  rx={8}
                  ry={8}
                  fill={visual.fill}
                  stroke={visual.stroke}
                  strokeWidth={visual.strokeWidth}
                  className={`token-rect token-${role}`}
                />
                <text
                  x={pos.x}
                  y={190 + 1}
                  textAnchor="middle"
                  alignmentBaseline="middle"
                  fontSize={12}
                  fontFamily='"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace'
                  fill={visual.text}
                >
                  {tok}
                </text>
                <text
                  x={pos.x}
                  y={210}
                  textAnchor="middle"
                  alignmentBaseline="hanging"
                  fontSize={10}
                  fill="rgba(148, 163, 184, 0.8)"
                >
                  t={i}
                </text>
              </g>
            )
          })}
        </svg>

        <aside className="sidebar">
          <h3>Current circuit view</h3>
          {hasPattern ? (
            <>
              <p>
                Detected pattern:&nbsp;
                <code className="code-pill">
                  [A] = {aToken} &nbsp; [B] = {bToken}
                </code>
              </p>
              <ul className="bullet">
                <li>
                  <span className="bullet-label">Previous-token head</span>{' '}
                  (teal) at each position copies information from the previous
                  token <em>t&nbsp;-&nbsp;1</em> to position <em>t</em>.
                </li>
                <li>
                  <span className="bullet-label">Induction head</span>{' '}
                  (orange) at the second <code>{aToken}</code> searches backward
                  for earlier <code>{aToken}</code> tokens and locks onto the
                  one that was followed by <code>{bToken}</code>.
                </li>
                <li>
                  Together, they implement:&nbsp;
                  <code className="code-pill">
                    I saw [{aToken}] [{bToken}] before. I see [{aToken}] now.
                    Predict [{bToken}].
                  </code>
                </li>
              </ul>
            </>
          ) : (
            <p className="muted">
              To see the induction circuit, include a repeated token before the
              last position, like:
              <br />
              <code className="code-pill">
                Alice Bob went home . Alice ?
              </code>
            </p>
          )}
        </aside>
      </div>

      <style jsx>{`
        .induction-card {
          background: ${BG_COLOR};
          border-radius: 1rem;
          padding: 1.5rem 1.75rem;
          border: 1px solid rgba(148, 163, 184, 0.4);
          color: #e5e7eb;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .induction-header {
          display: flex;
          justify-content: space-between;
          gap: 1.5rem;
          align-items: flex-start;
        }

        h2 {
          font-size: 1.25rem;
          font-weight: 600;
          letter-spacing: 0.02em;
        }

        .muted {
          margin-top: 0.25rem;
          font-size: 0.875rem;
          color: rgba(148, 163, 184, 0.9);
        }

        .formula {
          display: inline-block;
          margin-left: 0.4rem;
          padding: 0.1rem 0.4rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.3);
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
            Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem 1rem;
          font-size: 0.8rem;
          align-items: center;
          color: rgba(209, 213, 219, 0.9);
        }

        .legend-item {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
        }

        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          box-shadow: 0 0 6px rgba(248, 250, 252, 0.35);
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .input-label {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
          font-size: 0.8rem;
          color: rgba(209, 213, 219, 0.9);
        }

        .sequence-input {
          padding: 0.55rem 0.7rem;
          border-radius: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.95);
          color: #e5e7eb;
          font-size: 0.85rem;
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
            Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }

        .sequence-input:focus {
          outline: none;
          border-color: ${INDUCTION_HEAD_COLOR};
          box-shadow: 0 0 0 1px rgba(245, 158, 11, 0.4);
        }

        .preset-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
          font-size: 0.8rem;
        }

        .preset-label {
          color: rgba(148, 163, 184, 0.9);
        }

        .preset-row button {
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          padding: 0.25rem 0.65rem;
          font-size: 0.75rem;
          cursor: pointer;
        }

        .preset-row button:hover {
          border-color: ${INDUCTION_HEAD_COLOR};
          background: rgba(24, 24, 27, 0.95);
        }

        .stepper {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .step-btn {
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.95);
          color: rgba(229, 231, 235, 0.9);
          padding: 0.25rem 0.75rem;
          font-size: 0.78rem;
          cursor: pointer;
        }

        .step-btn.active {
          border-color: ${INDUCTION_HEAD_COLOR};
          background: radial-gradient(
            circle at top left,
            rgba(245, 158, 11, 0.22),
            rgba(15, 23, 42, 0.98)
          );
        }

        .step-explainer {
          font-size: 0.85rem;
          color: rgba(209, 213, 219, 0.92);
          line-height: 1.5;
        }

        .step-label {
          font-weight: 600;
          color: ${INDUCTION_HEAD_COLOR};
        }

        .visual-wrapper {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
          gap: 1.25rem;
          align-items: flex-start;
        }

        @media (max-width: 900px) {
          .visual-wrapper {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .attention-svg {
          width: 100%;
          height: auto;
          border-radius: 0.75rem;
          background: radial-gradient(
              circle at top left,
              rgba(148, 163, 184, 0.08),
              transparent
            ),
            radial-gradient(
              circle at bottom right,
              rgba(56, 189, 248, 0.08),
              transparent
            );
        }

        .attention-edge {
          stroke-linecap: round;
          transition: stroke-width 240ms ease, opacity 240ms ease;
        }

        .attention-edge-animated {
          stroke-dasharray: 6 6;
          animation: dash 1.6s linear infinite;
        }

        @keyframes dash {
          to {
            stroke-dashoffset: -12;
          }
        }

        .token-rect {
          filter: drop-shadow(0 8px 18px rgba(15, 23, 42, 0.9));
        }

        .sidebar {
          border-radius: 0.75rem;
          background: radial-gradient(
              circle at top left,
              rgba(245, 158, 11, 0.12),
              transparent
            ),
            rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.5);
          padding: 0.9rem 1rem;
          font-size: 0.82rem;
          color: rgba(229, 231, 235, 0.95);
        }

        .sidebar h3 {
          font-size: 0.9rem;
          font-weight: 600;
          margin-bottom: 0.35rem;
        }

        .code-pill {
          display: inline-block;
          padding: 0.1rem 0.45rem;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.6);
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
            Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-size: 0.75rem;
        }

        .bullet {
          list-style: disc;
          padding-left: 1.1rem;
          margin-top: 0.35rem;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .bullet-label {
          font-weight: 600;
        }

        code {
          font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
            Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
        }
      `}</style>
    </section>
  )
}
