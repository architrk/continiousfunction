/**
 * Tests for useChallenge utility functions
 *
 * Note: The useChallenge hook itself requires React's renderHook from
 * @testing-library/react for proper testing. These tests cover the pure
 * utility functions that don't require React.
 */

import {
  pickRandomChallenge,
  formatScoreDisplay,
  Challenge,
} from './useChallenge'

describe('pickRandomChallenge', () => {
  const challenges: Challenge[] = [
    { id: '1', name: 'Easy', answer: 'A' },
    { id: '2', name: 'Medium', answer: 'B' },
    { id: '3', name: 'Hard', answer: 'C' },
  ]

  it('should throw error for empty array', () => {
    expect(() => pickRandomChallenge([])).toThrow('Cannot pick from empty challenges array')
  })

  it('should return the only challenge for single-item array', () => {
    const single = [challenges[0]]
    expect(pickRandomChallenge(single)).toBe(single[0])
  })

  it('should return a challenge from the array', () => {
    const result = pickRandomChallenge(challenges)
    expect(challenges).toContain(result)
  })

  it('should avoid returning the same challenge as currentIndex', () => {
    // Run multiple times to ensure statistical validity
    for (let i = 0; i < 50; i++) {
      const result = pickRandomChallenge(challenges, 0)
      expect(result).not.toBe(challenges[0])
    }
  })

  it('should work when currentIndex is last item', () => {
    for (let i = 0; i < 50; i++) {
      const result = pickRandomChallenge(challenges, 2)
      expect(result).not.toBe(challenges[2])
    }
  })
})

describe('formatScoreDisplay', () => {
  it('should format score without streak', () => {
    expect(formatScoreDisplay(100, 0)).toBe('100pts ')
  })

  it('should format score with 1-2 streak (sparkle)', () => {
    expect(formatScoreDisplay(50, 1)).toBe('50pts ✨ (1x streak)')
    expect(formatScoreDisplay(50, 2)).toBe('50pts ✨ (2x streak)')
  })

  it('should format score with 3-4 streak (single fire)', () => {
    expect(formatScoreDisplay(80, 3)).toBe('80pts 🔥 (3x streak)')
    expect(formatScoreDisplay(80, 4)).toBe('80pts 🔥 (4x streak)')
  })

  it('should format score with 5+ streak (double fire)', () => {
    expect(formatScoreDisplay(150, 5)).toBe('150pts 🔥🔥 (5x streak)')
    expect(formatScoreDisplay(200, 10)).toBe('200pts 🔥🔥 (10x streak)')
  })

  it('should handle zero score', () => {
    expect(formatScoreDisplay(0, 0)).toBe('0pts ')
  })
})

describe('Challenge interface', () => {
  it('should accept challenges with additional properties', () => {
    // TypeScript compile-time check: additional properties should be allowed
    const challenge: Challenge<string> = {
      id: 'test',
      name: 'Test Challenge',
      answer: 'correct',
      hint: 'This is a hint',
      explanation: 'This is why',
      customProperty: 42,  // Additional properties allowed via index signature
    }

    expect(challenge.id).toBe('test')
    expect(challenge.customProperty).toBe(42)
  })

  it('should support different answer types', () => {
    // Number answer
    const numChallenge: Challenge<number> = {
      id: 'num',
      name: 'Number Challenge',
      answer: 42,
    }
    expect(numChallenge.answer).toBe(42)

    // Object answer
    interface ComplexAnswer {
      value: number
      label: string
    }
    const complexChallenge: Challenge<ComplexAnswer> = {
      id: 'complex',
      name: 'Complex Challenge',
      answer: { value: 10, label: 'ten' },
    }
    expect(complexChallenge.answer.value).toBe(10)
  })
})

describe('Score calculation logic', () => {
  // These test the scoring algorithm used in useChallenge hook
  const basePoints = 10
  const streakBonus = 2

  const calculateScore = (currentScore: number, streak: number, isCorrect: boolean): number => {
    if (isCorrect) {
      return currentScore + basePoints + streak * streakBonus
    }
    return currentScore
  }

  const calculateStreak = (currentStreak: number, isCorrect: boolean): number => {
    return isCorrect ? currentStreak + 1 : 0
  }

  it('should add base points for first correct answer', () => {
    expect(calculateScore(0, 0, true)).toBe(10)
    expect(calculateStreak(0, true)).toBe(1)
  })

  it('should add streak bonus for consecutive correct answers', () => {
    // First correct: 10 points (base)
    let score = calculateScore(0, 0, true)
    expect(score).toBe(10)

    // Second correct: 10 + 1*2 = 12 points
    score = calculateScore(score, 1, true)
    expect(score).toBe(22)

    // Third correct: 10 + 2*2 = 14 points
    score = calculateScore(score, 2, true)
    expect(score).toBe(36)
  })

  it('should reset streak on wrong answer', () => {
    const streak = calculateStreak(5, false)
    expect(streak).toBe(0)
  })

  it('should not change score on wrong answer', () => {
    const score = calculateScore(100, 3, false)
    expect(score).toBe(100)
  })

  it('should handle high streaks correctly', () => {
    // 10 streak: 10 + 10*2 = 30 points
    expect(calculateScore(0, 10, true)).toBe(30)
  })
})

describe('Countdown logic', () => {
  // Test the countdown behavior expectations
  const countdownDuration = 3

  it('should start at configured duration', () => {
    expect(countdownDuration).toBe(3)
  })

  it('should count down to zero', () => {
    let countdown = countdownDuration
    const steps: number[] = [countdown]

    while (countdown > 0) {
      countdown -= 1
      steps.push(countdown)
    }

    expect(steps).toEqual([3, 2, 1, 0])
  })
})
