import { useMemo, useState, useEffect, useRef, useCallback } from 'react'
import { useKeyboardNav } from '@/lib/useKeyboardNav'

// Gamification: Prediction game for learning
type GamePhase = 'setup' | 'countdown' | 'reveal'
type BehaviorPrediction = 'converge_smooth' | 'converge_oscillate' | 'diverge' | 'slow'

interface PredictionChallenge {
  name: string
  lr: number
  momentum: number
  startX: number
  correctAnswer: BehaviorPrediction
  hint: string
  explanation: string
}

// Challenge scenarios for prediction game
const PREDICTION_CHALLENGES: PredictionChallenge[] = [
  {
    name: '🎯 Mystery #1',
    lr: 0.2,
    momentum: 0.0,
    startX: 5,
    correctAnswer: 'converge_smooth',
    hint: 'LR is moderate, no momentum',
    explanation: 'With LR=0.2 and no momentum, the optimizer takes conservative steps that steadily decrease loss without overshooting.'
  },
  {
    name: '🎲 Mystery #2',
    lr: 0.95,
    momentum: 0.0,
    startX: 4,
    correctAnswer: 'converge_oscillate',
    hint: 'LR is very high, approaching stability limit',
    explanation: 'LR=0.95 is near the stability threshold (2/curvature=2). The optimizer bounces across the minimum but still converges.'
  },
  {
    name: '💥 Mystery #3',
    lr: 1.0,
    momentum: 0.9,
    startX: 4,
    correctAnswer: 'diverge',
    hint: 'High LR + high momentum = ?',
    explanation: 'LR=1.0 exceeds stability limit, and momentum=0.9 amplifies each update. The optimizer diverges exponentially.'
  },
  {
    name: '🐢 Mystery #4',
    lr: 0.02,
    momentum: 0.0,
    startX: 5,
    correctAnswer: 'slow',
    hint: 'Very small LR',
    explanation: 'LR=0.02 makes tiny steps. It will converge eventually, but takes many more steps than necessary.'
  },
  {
    name: '🚀 Mystery #5',
    lr: 0.3,
    momentum: 0.85,
    startX: 5,
    correctAnswer: 'converge_smooth',
    hint: 'Moderate LR + high momentum',
    explanation: 'LR=0.3 with momentum=0.85 accelerates through shallow regions and converges quickly with minimal oscillation.'
  },
]

const BEHAVIOR_LABELS: Record<BehaviorPrediction, string> = {
  converge_smooth: '✅ Smooth convergence',
  converge_oscillate: '🔄 Oscillate then converge',
  diverge: '💥 Diverge (explode)',
  slow: '🐢 Very slow convergence',
}

// Array of behavior options for keyboard navigation
const BEHAVIOR_OPTIONS: BehaviorPrediction[] = [
  'converge_smooth',
  'converge_oscillate',
  'diverge',
  'slow',
]

const X_MIN = -2
const X_MAX = 6
const WIDTH = 320
const HEIGHT = 220
const PADDING = 24
const MAX_Y = 8

// Expanded guided experiments with educational goals
const GUIDED_PROMPTS = [
  {
    name: 'Stable descent',
    lr: 0.2,
    momentum: 0.0,
    startX: 5,
    description: 'Smooth monotone convergence—conservative but reliable.',
    insight: 'With moderate LR and no momentum, each step shrinks the distance to the minimum.',
  },
  {
    name: 'Faster convergence',
    lr: 0.5,
    momentum: 0.0,
    startX: 5,
    description: 'Larger steps converge faster—but how close to instability?',
    insight: 'Higher LR means fewer steps to converge, but you approach the stability limit.',
  },
  {
    name: 'Overshooting',
    lr: 0.95,
    momentum: 0.0,
    startX: 4,
    description: 'Near the stability limit—oscillates but still converges.',
    insight: 'The optimizer bounces across the minimum but gradually settles.',
  },
  {
    name: 'Momentum boost',
    lr: 0.15,
    momentum: 0.85,
    startX: 5,
    description: 'Momentum accelerates through shallow regions.',
    insight: 'Velocity accumulates, helping escape plateaus and accelerate convergence.',
  },
  {
    name: 'Heavy momentum',
    lr: 0.1,
    momentum: 0.95,
    startX: 5,
    description: 'Very high momentum—watch for overshoot.',
    insight: 'High momentum can overshoot the minimum, requiring many steps to settle.',
  },
  {
    name: 'Divergence',
    lr: 1.0,
    momentum: 0.9,
    startX: 4,
    description: 'Beyond stability—loss explodes.',
    insight: 'When LR exceeds 2/curvature, updates grow instead of shrink.',
  },
  {
    name: 'Conservative',
    lr: 0.05,
    momentum: 0.0,
    startX: 5,
    description: 'Very small LR—stable but painfully slow.',
    insight: 'Leaving speed on the table. Often you can safely increase LR.',
  },
  {
    name: 'Balanced',
    lr: 0.3,
    momentum: 0.7,
    startX: 5,
    description: 'Good balance of speed and stability.',
    insight: 'Moderate LR with momentum often gives the best practical convergence.',
  },
]

function f(x: number) {
  const dx = x - 2
  return 0.5 * dx * dx
}

function gradf(x: number) {
  return x - 2
}

// Detect optimizer behavior for targeted feedback
type OptimizerState = 'idle' | 'converging' | 'slow' | 'oscillating' | 'diverging' | 'converged'

function detectState(
  x: number,
  currentY: number,
  steps: number,
  history: number[]
): OptimizerState {
  if (steps === 0) return 'idle'

  // Diverging: loss is very high or x is way out of bounds
  if (currentY > 50 || Math.abs(x) > 20) return 'diverging'

  // Converged: very close to minimum (x=2, y=0)
  if (currentY < 0.001) return 'converged'

  // Need at least 3 steps for oscillation/convergence detection
  if (history.length < 3) return 'converging'

  // Check for oscillation: sign changes in recent deltas
  const recentHistory = history.slice(-6)
  const deltas = recentHistory.slice(1).map((h, i) => h - recentHistory[i])
  const signChanges = deltas.slice(1).filter((d, i) => d * deltas[i] < 0).length

  if (signChanges >= 2) return 'oscillating'

  // Check for slow convergence: very small progress
  const avgDelta = Math.abs(deltas.reduce((a, b) => a + b, 0) / deltas.length)
  if (avgDelta < 0.01 && currentY > 0.1) return 'slow'

  return 'converging'
}

// Feedback messages for each state
const FEEDBACK: Record<OptimizerState, { message: string; suggestion: string }> = {
  idle: {
    message: '',
    suggestion: '',
  },
  converging: {
    message: 'Converging steadily toward the minimum.',
    suggestion: 'Loss is decreasing with each step.',
  },
  slow: {
    message: 'Slow convergence detected.',
    suggestion: 'Try increasing LR or adding momentum to speed up.',
  },
  oscillating: {
    message: 'Oscillating around the minimum.',
    suggestion: 'LR may be too high. Try reducing it or use momentum with lower LR.',
  },
  diverging: {
    message: 'Divergence detected—loss is exploding!',
    suggestion: 'Reduce LR significantly (often 3-10x). If using momentum, reduce that too.',
  },
  converged: {
    message: 'Converged to the minimum.',
    suggestion: 'The optimizer found the optimum where the gradient is near zero.',
  },
}

export default function GradientDescentPlayground() {
  const [lr, setLr] = useState(0.2)
  const [momentum, setMomentum] = useState(0.8)
  const [x, setX] = useState(4)
  const [v, setV] = useState(0)
  const [steps, setSteps] = useState(0)
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const [xHistory, setXHistory] = useState<number[]>([4])

  // Gamification state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallenge, setCurrentChallenge] = useState<PredictionChallenge | null>(null)
  const [prediction, setPrediction] = useState<BehaviorPrediction | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [showChallengeMode, setShowChallengeMode] = useState(false)
  const autoRunRef = useRef<NodeJS.Timeout | null>(null)

  // Keyboard navigation for prediction options
  const predictionNav = useKeyboardNav({
    options: BEHAVIOR_OPTIONS,
    onSelect: (behavior) => setPrediction(behavior),
    onEscape: () => {
      setShowChallengeMode(false)
      setCurrentChallenge(null)
      setGamePhase('setup')
    },
    enabled: showChallengeMode && gamePhase === 'setup',
  })

  const applyPrompt = (prompt: typeof GUIDED_PROMPTS[0]) => {
    setLr(prompt.lr)
    setMomentum(prompt.momentum)
    setX(prompt.startX)
    setV(0)
    setSteps(0)
    setActivePrompt(prompt.name)
    setXHistory([prompt.startX])
  }

  const samples = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const n = 120
    for (let i = 0; i <= n; i++) {
      const xp = X_MIN + ((X_MAX - X_MIN) * i) / n
      pts.push({ x: xp, y: f(xp) })
    }
    return pts
  }, [])

  const xToSvg = (xv: number) => {
    const t = (xv - X_MIN) / (X_MAX - X_MIN)
    return PADDING + t * (WIDTH - 2 * PADDING)
  }

  const yToSvg = (yv: number) => {
    const clamped = Math.min(yv, MAX_Y)
    const t = clamped / MAX_Y
    return HEIGHT - PADDING - t * (HEIGHT - 2 * PADDING)
  }

  const pathD = useMemo(() => {
    if (samples.length === 0) return ''
    return samples
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToSvg(p.x)} ${yToSvg(p.y)}`)
      .join(' ')
  }, [samples])

  const stepOnce = () => {
    const g = gradf(x)
    const newV = momentum * v - lr * g
    const newX = x + newV
    setV(newV)
    setX(newX)
    setSteps((s) => s + 1)
    setXHistory((h) => [...h.slice(-10), newX])
  }

  const reset = () => {
    setX(4)
    setV(0)
    setSteps(0)
    setXHistory([4])
  }

  // Game functions
  const startChallenge = useCallback((challenge: PredictionChallenge) => {
    setCurrentChallenge(challenge)
    setLr(challenge.lr)
    setMomentum(challenge.momentum)
    setX(challenge.startX)
    setV(0)
    setSteps(0)
    setXHistory([challenge.startX])
    setGamePhase('setup')
    setPrediction(null)
    setActivePrompt(null)
  }, [])

  const submitPrediction = useCallback(() => {
    if (!prediction || !currentChallenge) return
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction, currentChallenge])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('reveal')
      // Auto-run the optimizer for 25 steps
      let stepCount = 0
      autoRunRef.current = setInterval(() => {
        setX(prevX => {
          const g = gradf(prevX)
          setV(prevV => {
            const newV = (currentChallenge?.momentum ?? 0) * prevV - (currentChallenge?.lr ?? 0.2) * g
            return newV
          })
          return prevX
        })
        // Actually update state properly
        stepCount++
        if (stepCount >= 25 || Math.abs(x - 2) < 0.001 || Math.abs(x) > 20) {
          if (autoRunRef.current) clearInterval(autoRunRef.current)
        }
      }, 100)
    }
    return () => {
      if (autoRunRef.current) clearInterval(autoRunRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- x accessed via stale closure for convergence check; refactoring deferred
  }, [gamePhase, countdown, currentChallenge])

  // Auto-run when in reveal phase with proper cleanup
  useEffect(() => {
    if (gamePhase !== 'reveal') return

    let cancelled = false
    const runSteps = async () => {
      for (let i = 0; i < 25; i++) {
        if (cancelled) break // Check cancellation before each iteration
        await new Promise(resolve => setTimeout(resolve, 80))
        if (cancelled) break // Check cancellation after timeout
        stepOnce()
        // Stop early if converged or diverged
        if (Math.abs(x - 2) < 0.001 || currentY > 50 || Math.abs(x) > 20) break
      }
    }
    runSteps()

    // Cleanup: cancel async loop if component unmounts or gamePhase changes
    return () => {
      cancelled = true
    }
  }, [gamePhase]) // eslint-disable-line react-hooks/exhaustive-deps

  const _checkResult = useCallback(() => {
    if (!prediction || !currentChallenge) return null
    const isCorrect = prediction === currentChallenge.correctAnswer
    if (isCorrect) {
      setScore(s => s + 10 + streak * 2)
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }
    return isCorrect
  }, [prediction, currentChallenge, streak])

  const nextChallenge = useCallback(() => {
    const currentIndex = currentChallenge
      ? PREDICTION_CHALLENGES.findIndex(c => c.name === currentChallenge.name)
      : -1
    const nextIndex = (currentIndex + 1) % PREDICTION_CHALLENGES.length
    startChallenge(PREDICTION_CHALLENGES[nextIndex])
  }, [currentChallenge, startChallenge])

  const currentY = f(x)
  const optimizerState = detectState(x, currentY, steps, xHistory)
  const feedback = FEEDBACK[optimizerState]
  const activeInsight = GUIDED_PROMPTS.find((p) => p.name === activePrompt)?.insight

  return (
    <section className="card interactive-card">
      <div className="playground-header">
        <h2>Gradient Descent Playground</h2>
        <button
          onClick={() => {
            setShowChallengeMode(!showChallengeMode)
            if (!showChallengeMode) {
              startChallenge(PREDICTION_CHALLENGES[0])
            } else {
              setCurrentChallenge(null)
              setGamePhase('setup')
            }
          }}
          className={`challenge-toggle ${showChallengeMode ? 'active' : ''}`}
        >
          {showChallengeMode ? '📚 Explore Mode' : '🎮 Challenge Mode'}
        </button>
      </div>

      {/* Challenge Mode UI */}
      {showChallengeMode && currentChallenge && (
        <div className="challenge-panel" role="region" aria-label="Gradient descent challenge">
          <div className="challenge-header">
            <div className="challenge-stats" role="status" aria-live="polite">
              <span className="stat" aria-label={`Score: ${score} points`}>🏆 Score: {score}</span>
              <span className="stat" aria-label={`Streak: ${streak} correct`}>🔥 Streak: {streak}</span>
            </div>
          </div>

          <div className="challenge-scenario">
            <h4>{currentChallenge.name}</h4>
            <p className="challenge-hint">💡 Hint: {currentChallenge.hint}</p>
            <div className="challenge-params">
              <span>LR = {currentChallenge.lr}</span>
              <span>Momentum = {currentChallenge.momentum}</span>
            </div>
          </div>

          {gamePhase === 'setup' && (
            <div className="prediction-selection">
              <p className="prediction-prompt">What will happen when we run this optimizer?</p>
              <p className="sr-only">Use arrow keys to navigate options, Enter to select, Escape to exit</p>
              <div
                className="prediction-options"
                {...predictionNav.containerProps}
              >
                {BEHAVIOR_OPTIONS.map((behavior, index) => (
                  <button
                    key={behavior}
                    {...predictionNav.getOptionProps(behavior, index)}
                    className={`prediction-btn ${prediction === behavior ? 'selected' : ''} ${predictionNav.focusedIndex === index ? 'kb-focused' : ''}`}
                  >
                    {BEHAVIOR_LABELS[behavior]}
                  </button>
                ))}
              </div>
              {prediction && (
                <button onClick={submitPrediction} className="submit-prediction">
                  Lock in Prediction →
                </button>
              )}
            </div>
          )}

          {gamePhase === 'countdown' && (
            <div className="countdown-display" role="timer" aria-live="assertive" aria-atomic="true">
              <span className="countdown-number" aria-label={`${countdown} seconds remaining`}>{countdown}</span>
              <p>Running in...</p>
            </div>
          )}

          {gamePhase === 'reveal' && (
            <div className="result-panel" role="status" aria-live="polite" aria-atomic="true">
              <div className={`result-badge ${prediction === currentChallenge.correctAnswer ? 'correct' : 'incorrect'}`}>
                {prediction === currentChallenge.correctAnswer ? '✅ Correct!' : '❌ Not quite'}
              </div>
              <p className="result-explanation">
                <strong>Answer:</strong> {BEHAVIOR_LABELS[currentChallenge.correctAnswer]}
              </p>
              <p className="challenge-explanation">{currentChallenge.explanation}</p>
              <button onClick={nextChallenge} className="next-challenge">
                Next Challenge →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Original Explore Mode */}
      {!showChallengeMode && (
        <p className="muted">
          Adjust the learning rate and momentum to see how the optimizer moves
          along a simple 1D loss landscape.
        </p>
      )}
      <div className="guided-prompts" style={{ display: showChallengeMode ? 'none' : 'flex' }}>
        <span className="guided-label">Try:</span>
        {GUIDED_PROMPTS.map((prompt) => (
          <button
            key={prompt.name}
            onClick={() => applyPrompt(prompt)}
            className={`guided-btn ${activePrompt === prompt.name ? 'active' : ''}`}
            title={prompt.description}
          >
            {prompt.name}
          </button>
        ))}
      </div>
      {activePrompt && (
        <p className="guided-description">
          {GUIDED_PROMPTS.find((p) => p.name === activePrompt)?.description}
        </p>
      )}
      <div className="gd-layout">
        <svg width={WIDTH} height={HEIGHT} className="gd-chart" role="img" aria-label="Interactive gradient descent visualization showing a loss function curve with draggable point and optimization trajectory">
          <title>Gradient Descent Playground: drag the point to explore how gradient descent finds minima</title>
          <line
            x1={xToSvg(X_MIN)}
            y1={yToSvg(0)}
            x2={xToSvg(X_MAX)}
            y2={yToSvg(0)}
            className="axis-line"
          />
          <line
            x1={xToSvg(2)}
            y1={yToSvg(0)}
            x2={xToSvg(2)}
            y2={yToSvg(MAX_Y)}
            className="axis-line axis-center"
          />
          <path d={pathD} className="gd-curve" />
          <circle
            cx={xToSvg(x)}
            cy={yToSvg(currentY)}
            r={6}
            className="gd-point"
          />
        </svg>
        <div className="gd-controls">
          <label className="slider-label">
            Learning rate ({lr.toFixed(2)})
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.02}
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
            />
          </label>
          <label className="slider-label">
            Momentum ({momentum.toFixed(2)})
            <input
              type="range"
              min={0}
              max={0.99}
              step={0.01}
              value={momentum}
              onChange={(e) => setMomentum(parseFloat(e.target.value))}
            />
          </label>
          <div className="gd-stats">
            <div>
              <span className="label">Step:</span> {steps}
            </div>
            <div>
              <span className="label">x:</span> {x.toFixed(3)}
            </div>
            <div>
              <span className="label">Loss:</span> {currentY.toFixed(4)}
            </div>
          </div>
          <div className="gd-buttons">
            <button onClick={stepOnce}>Step once</button>
            <button onClick={reset} className="ghost">
              Reset
            </button>
          </div>

          {/* Dynamic feedback based on optimizer state */}
          {feedback.message && (
            <div className={`gd-feedback gd-feedback-${optimizerState}`}>
              <p className="feedback-message">{feedback.message}</p>
              <p className="feedback-suggestion">{feedback.suggestion}</p>
            </div>
          )}

          {/* Insight from selected preset */}
          {activeInsight && !feedback.message && (
            <p className="caption">{activeInsight}</p>
          )}

          {/* Default caption when no specific state */}
          {!feedback.message && !activeInsight && (
            <p className="caption">
              Too large a learning rate overshoots the minimum; low momentum gives
              a wiggly path, high momentum smooths it.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
