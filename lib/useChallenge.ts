import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Game phase states for challenge-based gamification
 */
export type GamePhase = 'setup' | 'predicting' | 'countdown' | 'reveal'

/**
 * Generic challenge type that works across all gamification components
 */
export interface Challenge<T = string> {
  id: string
  name: string
  answer: T
  hint?: string
  explanation?: string
  [key: string]: unknown // Allow additional properties
}

/**
 * Configuration options for the challenge hook
 */
export interface UseChallengeOptions {
  /** Duration of countdown in seconds (default: 3) */
  countdownDuration?: number
  /** Base points per correct answer (default: 10) */
  basePoints?: number
  /** Bonus points per streak (default: 2) */
  streakBonus?: number
  /** Auto-advance to next challenge after reveal (default: false) */
  autoAdvance?: boolean
  /** Delay before auto-advance in ms (default: 3000) */
  autoAdvanceDelay?: number
}

/**
 * Return type for the useChallenge hook
 */
export interface UseChallengeReturn<T, A> {
  // State
  gamePhase: GamePhase
  currentChallenge: T | null
  prediction: A | null
  countdown: number
  score: number
  streak: number
  challengeIndex: number
  isCorrect: boolean | null

  // Actions
  startChallenge: (challenge: T) => void
  makePrediction: (answer: A) => void
  submitPrediction: () => void
  nextChallenge: () => void
  resetGame: () => void
  exitChallengeMode: () => void

  // Computed
  totalChallenges: number
}

/**
 * A reusable hook for challenge-based gamification in visualizations.
 *
 * Provides consistent behavior across all gamified components:
 * - Challenge selection and progression
 * - Countdown timer
 * - Scoring with streak bonuses
 * - State management for game phases
 *
 * @example
 * ```tsx
 * const CHALLENGES = [
 *   { id: '1', name: 'Easy', answer: 'A', hint: 'Think about...' },
 *   { id: '2', name: 'Medium', answer: 'B', hint: 'Consider...' },
 * ]
 *
 * function MyViz() {
 *   const challenge = useChallenge(CHALLENGES, (c, p) => c.answer === p)
 *
 *   return (
 *     <div>
 *       {challenge.gamePhase === 'predicting' && (
 *         <button onClick={() => challenge.makePrediction('A')}>A</button>
 *       )}
 *       {challenge.gamePhase === 'reveal' && (
 *         <div>{challenge.isCorrect ? 'Correct!' : 'Try again'}</div>
 *       )}
 *     </div>
 *   )
 * }
 * ```
 */
export function useChallenge<T extends Challenge<A>, A = string>(
  challenges: T[],
  checkAnswer: (challenge: T, prediction: A) => boolean,
  options: UseChallengeOptions = {}
): UseChallengeReturn<T, A> {
  const {
    countdownDuration = 3,
    basePoints = 10,
    streakBonus = 2,
    autoAdvance = false,
    autoAdvanceDelay = 3000,
  } = options

  // Core state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallenge, setCurrentChallenge] = useState<T | null>(null)
  const [prediction, setPrediction] = useState<A | null>(null)
  const [countdown, setCountdown] = useState(countdownDuration)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)
  const [challengeIndex, setChallengeIndex] = useState(0)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)

  // Refs for cleanup
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  const autoAdvanceRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup function
  const cleanup = useCallback(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
    if (autoAdvanceRef.current) {
      clearTimeout(autoAdvanceRef.current)
      autoAdvanceRef.current = null
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup])

  // Start a new challenge
  const startChallenge = useCallback((challenge: T) => {
    cleanup()
    setCurrentChallenge(challenge)
    setPrediction(null)
    setIsCorrect(null)
    setCountdown(countdownDuration)
    setGamePhase('predicting')
  }, [cleanup, countdownDuration])

  // Make a prediction (before submitting)
  const makePrediction = useCallback((answer: A) => {
    if (gamePhase === 'predicting') {
      setPrediction(answer)
    }
  }, [gamePhase])

  // Submit prediction and start countdown
  const submitPrediction = useCallback(() => {
    if (gamePhase !== 'predicting' || prediction === null) return

    setGamePhase('countdown')
    setCountdown(countdownDuration)

    // Start countdown timer
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          // Countdown finished - reveal result
          if (countdownRef.current) {
            clearInterval(countdownRef.current)
            countdownRef.current = null
          }

          // Calculate result
          if (currentChallenge && prediction !== null) {
            const correct = checkAnswer(currentChallenge, prediction)
            setIsCorrect(correct)

            if (correct) {
              setScore(s => s + basePoints + streak * streakBonus)
              setStreak(s => s + 1)
            } else {
              setStreak(0)
            }
          }

          setGamePhase('reveal')

          // Auto-advance if enabled
          if (autoAdvance) {
            autoAdvanceRef.current = setTimeout(() => {
              setChallengeIndex(i => (i + 1) % challenges.length)
            }, autoAdvanceDelay)
          }

          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [
    gamePhase,
    prediction,
    currentChallenge,
    checkAnswer,
    countdownDuration,
    basePoints,
    streak,
    streakBonus,
    autoAdvance,
    autoAdvanceDelay,
    challenges.length
  ])

  // Move to next challenge
  const nextChallenge = useCallback(() => {
    cleanup()
    const nextIndex = (challengeIndex + 1) % challenges.length
    setChallengeIndex(nextIndex)
    startChallenge(challenges[nextIndex])
  }, [cleanup, challengeIndex, challenges, startChallenge])

  // Reset entire game
  const resetGame = useCallback(() => {
    cleanup()
    setGamePhase('setup')
    setCurrentChallenge(null)
    setPrediction(null)
    setIsCorrect(null)
    setCountdown(countdownDuration)
    setScore(0)
    setStreak(0)
    setChallengeIndex(0)
  }, [cleanup, countdownDuration])

  // Exit challenge mode back to setup
  const exitChallengeMode = useCallback(() => {
    cleanup()
    setGamePhase('setup')
    setCurrentChallenge(null)
    setPrediction(null)
    setIsCorrect(null)
  }, [cleanup])

  return {
    // State
    gamePhase,
    currentChallenge,
    prediction,
    countdown,
    score,
    streak,
    challengeIndex,
    isCorrect,

    // Actions
    startChallenge,
    makePrediction,
    submitPrediction,
    nextChallenge,
    resetGame,
    exitChallengeMode,

    // Computed
    totalChallenges: challenges.length,
  }
}

/**
 * Helper to pick a random challenge from an array
 */
export function pickRandomChallenge<T>(challenges: T[], currentIndex?: number): T {
  if (challenges.length === 0) {
    throw new Error('Cannot pick from empty challenges array')
  }
  if (challenges.length === 1) {
    return challenges[0]
  }

  let newIndex: number
  do {
    newIndex = Math.floor(Math.random() * challenges.length)
  } while (currentIndex !== undefined && newIndex === currentIndex)

  return challenges[newIndex]
}

/**
 * Format score display with streak indicator
 */
export function formatScoreDisplay(score: number, streak: number): string {
  const streakEmoji = streak >= 5 ? '🔥🔥' : streak >= 3 ? '🔥' : streak >= 1 ? '✨' : ''
  return `${score}pts ${streakEmoji}${streak > 0 ? ` (${streak}x streak)` : ''}`
}
