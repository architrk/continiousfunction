import { useEffect, useMemo, useState } from 'react'

// --- Gamification types and data ---------------------------------------------

type GamePhase = 'setup' | 'countdown' | 'revealed'
type HackingPrediction = 'hacks' | 'improves' | 'neutral' | null

interface HackingChallenge {
  name: string
  beta: number
  samples: number
  imperfect: boolean
  answer: Exclude<HackingPrediction, null>
  description: string
}

const HACKING_CHALLENGES: HackingChallenge[] = [
  { name: '🎲 Safe Config', beta: 0.7, samples: 10, imperfect: false, answer: 'improves', description: 'High KL penalty with perfect reward model - what happens?' },
  { name: '🎲 Balanced Risk', beta: 0.25, samples: 8, imperfect: true, answer: 'improves', description: 'Standard production settings - will it hack or improve?' },
  { name: '🎲 Low Data', beta: 0.3, samples: 3, imperfect: true, answer: 'neutral', description: 'Few preference samples means a weak reward model...' },
  { name: '🎲 Aggressive', beta: 0.08, samples: 4, imperfect: true, answer: 'hacks', description: 'Very low KL penalty, limited data - danger zone?' },
  { name: '🎲 Perfect Model', beta: 0.05, samples: 2, imperfect: false, answer: 'improves', description: 'Low KL but perfect reward - can it still hack?' },
]

const getHackingFeedback = (prediction: HackingPrediction, challenge: HackingChallenge): string => {
  const correct = prediction === challenge.answer
  const betaDesc = challenge.beta < 0.1 ? 'very low' : challenge.beta < 0.3 ? 'moderate' : 'high'

  if (correct) {
    if (challenge.answer === 'hacks') {
      return `💡 Correct! With β=${challenge.beta} (${betaDesc}) and imperfect reward model trained on only ${challenge.samples} samples, the policy finds loopholes. The proxy reward rises but true quality drops - classic reward hacking!`
    }
    if (challenge.answer === 'improves') {
      if (!challenge.imperfect) {
        return `💡 Correct! With a perfect reward model (proxy = true reward), there's no gap to exploit. Even low β just pushes toward genuinely better responses.`
      }
      return `💡 Correct! β=${challenge.beta} and ${challenge.samples} preference samples create a good balance. The KL constraint keeps the policy from straying into loophole territory.`
    }
    return `💡 Correct! With only ${challenge.samples} samples, the reward model is too weak to guide improvement OR hacking. The policy barely moves from the base model.`
  }

  // Incorrect predictions with educational feedback
  if (prediction === 'hacks' && challenge.answer === 'improves') {
    if (!challenge.imperfect) {
      return `🔄 Not quite! With a perfect reward model, hacking is impossible - there's no gap between proxy and true reward to exploit.`
    }
    return `🔄 Close! This configuration is safer than it looks. β=${challenge.beta} provides enough KL constraint to prevent hacking despite the imperfect model.`
  }
  if (prediction === 'improves' && challenge.answer === 'hacks') {
    return `⚠️ Dangerous assumption! β=${challenge.beta} is too low to constrain the policy. With an imperfect reward model, it will find and exploit loopholes.`
  }
  return `🔄 The actual outcome differs. Key factors: β strength (${challenge.beta}), reward model quality (${challenge.imperfect ? 'imperfect' : 'perfect'}), and training data (${challenge.samples} samples).`
}

// Training regime presets
const RLHF_PRESETS = [
  { name: '🛡️ Conservative', beta: 0.7, samples: 10, imperfect: false, description: 'High KL penalty, near-perfect reward - safest alignment' },
  { name: '⚖️ Balanced', beta: 0.25, samples: 8, imperfect: true, description: 'Standard RLHF with realistic reward model' },
  { name: '🚀 Aggressive', beta: 0.1, samples: 4, imperfect: true, description: 'Low KL penalty, limited data - faster but risky' },
  { name: '💀 Hacking-prone', beta: 0.05, samples: 2, imperfect: true, description: 'Very low KL, poor reward model - triggers hacking' },
]

// Dynamic educational insights based on state
function getRLHFInsight(
  beta: number,
  hasOptimized: boolean,
  rewardHacking: boolean,
  kl: number,
  useImperfectReward: boolean
): string {
  if (!hasOptimized) {
    return "🎮 Click 'Run RL optimization step' to see how the policy shifts toward higher reward. Use presets to explore different training regimes!";
  }

  if (rewardHacking) {
    return "💀 REWARD HACKING DETECTED! The policy found loopholes: high proxy reward but lower true quality. Solutions: higher β, better reward model, or constitutional constraints.";
  }

  if (beta > 0.5) {
    return "🛡️ Conservative regime: High β keeps the policy close to the base model. Safe but limited improvement - this is where 'alignment tax' comes from.";
  }

  if (beta < 0.1 && useImperfectReward) {
    return "⚠️ Danger zone! Very low β with an imperfect reward model. Keep optimizing and you'll likely see reward hacking emerge.";
  }

  if (kl > 0.5) {
    return "🔄 High KL divergence: The policy has moved significantly from the base model. Watch the 'loophole' responses (orange points) - are they gaining mass?";
  }

  if (!useImperfectReward) {
    return "✨ Perfect reward model mode: No gap between proxy and true reward. Real RLHF doesn't have this luxury - toggle 'imperfect' to see realistic dynamics.";
  }

  return "⚖️ Balanced training: The policy improves on the reward model while the KL penalty prevents it from straying too far. Compare the decision boundaries!";
}

const MATH_COLORS = {
  primary: '#f59e0b', // reward model / learned reward
  secondary: '#14b8a6', // true reward / ground truth
  accent: '#8b5cf6', // KL, shift indicators
} as const

export function softmax(values: number[]): number[] {
  if (values.length === 0) return []
  const max = Math.max(...values)
  const exps = values.map((v) => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0) || 1
  return exps.map((e) => e / sum)
}

type WeightVector = [number, number, number]
type ResponseGroup = 'train' | 'heldout' | 'loophole'

interface ResponsePoint {
  id: number
  helpfulness: number // x-axis
  harmlessness: number // y-axis (safety)
  group: ResponseGroup
  label: string
}

const TRUE_WEIGHTS: WeightVector = [-1.3, 1.8, 2.4] // bias, w_help, w_safe
const INITIAL_IMPERFECT_WEIGHTS: WeightVector = [-0.2, 2.4, 0.2]

// Simulated response space: helpfulness vs harmlessness
const RESPONSES: ResponsePoint[] = [
  {
    id: 0,
    helpfulness: 0.2,
    harmlessness: 0.9,
    group: 'train',
    label: 'Very cautious, short answer.',
  },
  {
    id: 1,
    helpfulness: 0.4,
    harmlessness: 0.8,
    group: 'train',
    label: 'Some detail, quite safe.',
  },
  {
    id: 2,
    helpfulness: 0.6,
    harmlessness: 0.75,
    group: 'train',
    label: 'Helpful but still politely hedged.',
  },
  {
    id: 3,
    helpfulness: 0.7,
    harmlessness: 0.7,
    group: 'train',
    label: 'Direct answer with normal safety.',
  },
  {
    id: 4,
    helpfulness: 0.85,
    harmlessness: 0.8,
    group: 'train',
    label: 'Long, clear, and safe explanation.',
  },
  {
    id: 5,
    helpfulness: 0.5,
    harmlessness: 0.95,
    group: 'train',
    label: 'Gentle step-by-step with safety reminders.',
  },
  {
    id: 6,
    helpfulness: 0.3,
    harmlessness: 0.6,
    group: 'train',
    label: 'A bit vague but safe.',
  },
  {
    id: 7,
    helpfulness: 0.75,
    harmlessness: 0.55,
    group: 'train',
    label: 'Direct answer with some edgy details.',
  },
  {
    id: 8,
    helpfulness: 0.55,
    harmlessness: 0.65,
    group: 'train',
    label: 'Balanced, medium-length answer.',
  },
  {
    id: 9,
    helpfulness: 0.95,
    harmlessness: 0.2,
    group: 'loophole',
    label: 'Extremely detailed, includes risky instructions.',
  },
  {
    id: 10,
    helpfulness: 0.9,
    harmlessness: 0.15,
    group: 'loophole',
    label: 'Tries to bypass safety rules with detailed advice.',
  },
  {
    id: 11,
    helpfulness: 0.6,
    harmlessness: 0.3,
    group: 'loophole',
    label: 'Rough sketch of a risky approach.',
  },
  {
    id: 12,
    helpfulness: 0.15,
    harmlessness: 1.0,
    group: 'heldout',
    label: 'Refuses to help and only warns you.',
  },
]

// Synthetic preference dataset (train-only)
const PREF_PAIRS: { a: number; b: number }[] = [
  { a: 0, b: 1 },
  { a: 1, b: 2 },
  { a: 2, b: 3 },
  { a: 3, b: 4 },
  { a: 6, b: 2 },
  { a: 6, b: 5 },
  { a: 7, b: 3 },
  { a: 8, b: 4 },
  { a: 0, b: 5 },
  { a: 1, b: 5 },
  { a: 2, b: 4 },
  { a: 3, b: 5 },
]

const TRAIN_INDICES = RESPONSES.filter((r) => r.group === 'train').map((r) => r.id)
const HELDOUT_INDICES = RESPONSES.filter((r) => r.group !== 'train').map((r) => r.id)

function trueReward(r: ResponsePoint): number {
  const [b, wh, ws] = TRUE_WEIGHTS
  return b + wh * r.helpfulness + ws * r.harmlessness
}

function rewardFromWeights(r: ResponsePoint, w: WeightVector): number {
  const [b, wh, ws] = w
  return b + wh * r.helpfulness + ws * r.harmlessness
}

function constitutionScore(r: ResponsePoint): number {
  // "Constitutional AI" prioritizes safety a bit more than helpfulness.
  const bias = -0.8
  const wHelp = 1.1
  const wSafe = 2.2
  return bias + wHelp * r.helpfulness + wSafe * r.harmlessness
}

// Base (pre-RLHF) policy: prefers high true reward, rarely chooses loopholes
const BASE_LOGITS = RESPONSES.map((r) => {
  const base = trueReward(r)
  const penalty =
    r.group === 'loophole' ? -2.5 : r.group === 'heldout' ? -1.0 : 0.0
  return base + penalty
})

const BASE_POLICY = softmax(BASE_LOGITS)

const BASE_TRUE_REWARD = RESPONSES.reduce(
  (sum, r, i) => sum + BASE_POLICY[i] * trueReward(r),
  0,
)

const BASE_AVG_HELPFULNESS = RESPONSES.reduce(
  (sum, r, i) => sum + BASE_POLICY[i] * r.helpfulness,
  0,
)

const BASE_AVG_HARMLESSNESS = RESPONSES.reduce(
  (sum, r, i) => sum + BASE_POLICY[i] * r.harmlessness,
  0,
)

const BASE_TRAIN_TRUE_REWARD = (() => {
  let mass = 0
  let acc = 0
  for (const idx of TRAIN_INDICES) {
    const p = BASE_POLICY[idx]
    mass += p
    acc += p * trueReward(RESPONSES[idx])
  }
  return mass > 0 ? acc / mass : 0
})()

const BASE_HELDOUT_TRUE_REWARD = (() => {
  let mass = 0
  let acc = 0
  for (const idx of HELDOUT_INDICES) {
    const p = BASE_POLICY[idx]
    mass += p
    acc += p * trueReward(RESPONSES[idx])
  }
  return mass > 0 ? acc / mass : 0
})()

function klDiv(p: number[], q: number[]): number {
  let s = 0
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]
    const qi = q[i]
    if (pi <= 0 || qi <= 0) continue
    s += pi * Math.log(pi / qi)
  }
  return s
}

interface RLHFResult {
  probs: number[]
  kl: number
  expectedTrue: number
  expectedModel: number
  avgHelpfulness: number
  avgHarmlessness: number
}

function solveRLHF(
  beta: number,
  rewardWeights: WeightVector,
  useImperfectReward: boolean,
): RLHFResult {
  const rewardUsed = RESPONSES.map((r) =>
    useImperfectReward ? rewardFromWeights(r, rewardWeights) : trueReward(r),
  )

  const logBase = BASE_POLICY.map((p) => Math.log(p + 1e-12))
  const combinedLogits = logBase.map(
    (lb, i) => lb + rewardUsed[i] / Math.max(beta, 1e-3),
  )
  const probs = softmax(combinedLogits)

  let expectedTrue = 0
  let expectedModel = 0
  let avgHelp = 0
  let avgSafe = 0

  for (let i = 0; i < RESPONSES.length; i++) {
    const p = probs[i]
    const r = RESPONSES[i]
    expectedTrue += p * trueReward(r)
    expectedModel += p * rewardUsed[i]
    avgHelp += p * r.helpfulness
    avgSafe += p * r.harmlessness
  }

  const kl = klDiv(probs, BASE_POLICY)

  return {
    probs,
    kl,
    expectedTrue,
    expectedModel,
    avgHelpfulness: avgHelp,
    avgHarmlessness: avgSafe,
  }
}

const SAMPLE_BETAS = [0.05, 0.08, 0.12, 0.18, 0.25, 0.35, 0.5, 0.7, 0.9, 1.0]

function addWeights(a: WeightVector, b: WeightVector): WeightVector {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
}

function simulateOfflineRewardTraining(numSamples: number): WeightVector {
  const capped = Math.max(0, Math.min(numSamples, PREF_PAIRS.length))
  let w: WeightVector = [...INITIAL_IMPERFECT_WEIGHTS]
  const lr = 0.4

  for (let i = 0; i < capped; i++) {
    const { a, b } = PREF_PAIRS[i]
    const ra = trueReward(RESPONSES[a])
    const rb = trueReward(RESPONSES[b])
    const y = ra >= rb ? 1 : 0

    const fa: WeightVector = [1, RESPONSES[a].helpfulness, RESPONSES[a].harmlessness]
    const fb: WeightVector = [1, RESPONSES[b].helpfulness, RESPONSES[b].harmlessness]
    const df: WeightVector = [fa[0] - fb[0], fa[1] - fb[1], fa[2] - fb[2]]

    const dot = df[0] * w[0] + df[1] * w[1] + df[2] * w[2]
    const p = 1 / (1 + Math.exp(-dot))
    const gradScale = y - p

    w = [
      w[0] + lr * gradScale * df[0],
      w[1] + lr * gradScale * df[1],
      w[2] + lr * gradScale * df[2],
    ]
  }

  return w
}

function getDecisionLine(
  w: WeightVector,
): { p1: [number, number]; p2: [number, number] } | null {
  const [b, wH, wS] = w
  const eps = 1e-6
  const candidates: [number, number][] = []

  if (Math.abs(wS) > eps) {
    const sAtH0 = -b / wS
    const sAtH1 = -(b + wH) / wS
    candidates.push([0, sAtH0], [1, sAtH1])
  }

  if (Math.abs(wH) > eps) {
    const hAtS0 = -b / wH
    const hAtS1 = -(b + wS) / wH
    candidates.push([hAtS0, 0], [hAtS1, 1])
  }

  const inside = candidates.filter(
    ([h, s]) => h >= 0 && h <= 1 && s >= 0 && s <= 1,
  )

  if (inside.length < 2) return null
  return { p1: inside[0], p2: inside[1] }
}

function formatNumber(v: number, digits = 2) {
  if (!Number.isFinite(v)) return '–'
  return v.toFixed(digits)
}

export default function RLHFDemo() {
  const [beta, setBeta] = useState(0.25)
  const [prefSamples, setPrefSamples] = useState(6)
  const [useImperfectReward, setUseImperfectReward] = useState(true)
  const [offlineWeights, setOfflineWeights] = useState<WeightVector>(
    INITIAL_IMPERFECT_WEIGHTS,
  )
  const [userDelta, setUserDelta] = useState<WeightVector>([0, 0, 0])
  const [currentPairIndex, setCurrentPairIndex] = useState(0)
  const [hasOptimized, setHasOptimized] = useState(false)

  // Gamification state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<HackingChallenge | null>(null)
  const [prediction, setPrediction] = useState<HackingPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)

  // Offline "other annotators" preference data
  useEffect(() => {
    const w = simulateOfflineRewardTraining(prefSamples)
    setOfflineWeights(w)
  }, [prefSamples])

  const activeWeights: WeightVector = useImperfectReward
    ? addWeights(offlineWeights, userDelta)
    : TRUE_WEIGHTS

  const baseModelReward = useMemo(() => {
    if (!useImperfectReward) return BASE_TRUE_REWARD
    let acc = 0
    for (let i = 0; i < RESPONSES.length; i++) {
      acc += BASE_POLICY[i] * rewardFromWeights(RESPONSES[i], activeWeights)
    }
    return acc
  }, [activeWeights, useImperfectReward])

  const frontier = useMemo(() => {
    return SAMPLE_BETAS.map((b) => {
      const res = solveRLHF(b, activeWeights, useImperfectReward)
      return {
        beta: b,
        kl: res.kl,
        rewardTrue: res.expectedTrue,
        rewardModel: res.expectedModel,
      }
    })
  }, [activeWeights, useImperfectReward])

  const currentPolicy = useMemo(() => {
    if (!hasOptimized) {
      return {
        probs: BASE_POLICY,
        kl: 0,
        expectedTrue: BASE_TRUE_REWARD,
        expectedModel: baseModelReward,
        avgHelpfulness: BASE_AVG_HELPFULNESS,
        avgHarmlessness: BASE_AVG_HARMLESSNESS,
      } as RLHFResult
    }
    return solveRLHF(beta, activeWeights, useImperfectReward)
  }, [beta, activeWeights, useImperfectReward, hasOptimized, baseModelReward])

  const trainMass = TRAIN_INDICES.reduce(
    (s, idx) => s + currentPolicy.probs[idx],
    0,
  )
  const heldoutMass = HELDOUT_INDICES.reduce(
    (s, idx) => s + currentPolicy.probs[idx],
    0,
  )

  let trainRewardTrue = 0
  let heldoutRewardTrue = 0

  if (trainMass > 0) {
    for (const idx of TRAIN_INDICES) {
      const p = currentPolicy.probs[idx]
      trainRewardTrue += (p / trainMass) * trueReward(RESPONSES[idx])
    }
  }
  if (heldoutMass > 0) {
    for (const idx of HELDOUT_INDICES) {
      const p = currentPolicy.probs[idx]
      heldoutRewardTrue += (p / heldoutMass) * trueReward(RESPONSES[idx])
    }
  }

  const winRateVsRef = (() => {
    const diff = currentPolicy.expectedTrue - BASE_TRUE_REWARD
    const scale = 1.0
    const sigma = 1 / (1 + Math.exp(-diff / scale))
    return sigma
  })()

  const rewardHacking =
    useImperfectReward &&
    hasOptimized &&
    currentPolicy.expectedModel > baseModelReward + 0.15 &&
    currentPolicy.expectedTrue < BASE_TRUE_REWARD - 0.05

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getRLHFInsight(beta, hasOptimized, rewardHacking, currentPolicy.kl, useImperfectReward);
  }, [beta, hasOptimized, rewardHacking, currentPolicy.kl, useImperfectReward]);

  // Apply training preset
  const handlePreset = (preset: typeof RLHF_PRESETS[0]) => {
    setBeta(preset.beta);
    setPrefSamples(preset.samples);
    setUseImperfectReward(preset.imperfect);
    setHasOptimized(false); // Reset to show fresh state
  };

  const currentPair = PREF_PAIRS[currentPairIndex % PREF_PAIRS.length]
  const respA = RESPONSES[currentPair.a]
  const respB = RESPONSES[currentPair.b]

  const modelScoreA = useImperfectReward
    ? rewardFromWeights(respA, activeWeights)
    : trueReward(respA)
  const modelScoreB = useImperfectReward
    ? rewardFromWeights(respB, activeWeights)
    : trueReward(respB)
  const trueScoreA = trueReward(respA)
  const trueScoreB = trueReward(respB)

  const humanPref = trueScoreA >= trueScoreB ? 'A' : 'B'
  const aiConstPref = constitutionScore(respA) >= constitutionScore(respB) ? 'A' : 'B'
  const modelPref = modelScoreA >= modelScoreB ? 'A' : 'B'

  const handlePreferenceClick = (choice: 'A' | 'B') => {
    if (!useImperfectReward) {
      // In "perfect" mode we still advance the pair, but don't update weights.
      setCurrentPairIndex((i) => (i + 1) % PREF_PAIRS.length)
      return
    }

    const y = choice === 'A' ? 1 : 0
    const fa: WeightVector = [1, respA.helpfulness, respA.harmlessness]
    const fb: WeightVector = [1, respB.helpfulness, respB.harmlessness]
    const df: WeightVector = [fa[0] - fb[0], fa[1] - fb[1], fa[2] - fb[2]]

    const w = activeWeights
    const dot = df[0] * w[0] + df[1] * w[1] + df[2] * w[2]
    const p = 1 / (1 + Math.exp(-dot))
    const gradScale = y - p
    const lr = 0.4

    setUserDelta((prev) => [
      prev[0] + lr * gradScale * df[0],
      prev[1] + lr * gradScale * df[1],
      prev[2] + lr * gradScale * df[2],
    ])

    setCurrentPairIndex((i) => (i + 1) % PREF_PAIRS.length)
  }

  // Game control functions
  const startChallenge = (challenge: HackingChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('setup')
  }

  const submitPrediction = (pred: HackingPrediction) => {
    setPrediction(pred)
    setCountdown(3)
    setGamePhase('countdown')
  }

  const _resetGame = () => {
    setGameMode(false)
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
  }

  // Countdown effect for gamification
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setGamePhase('revealed')
        // Apply the challenge's settings
        if (selectedChallenge) {
          setBeta(selectedChallenge.beta)
          setPrefSamples(selectedChallenge.samples)
          setUseImperfectReward(selectedChallenge.imperfect)
          setHasOptimized(true)
          // Update score
          if (prediction === selectedChallenge.answer) {
            setScore(s => s + 1)
          }
        }
      } else {
        setCountdown(c => c - 1)
      }
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, selectedChallenge, prediction])

  // ==== SVG helpers ====
  const PREF_WIDTH = 260
  const PREF_HEIGHT = 220
  const PREF_PAD = 26

  const scaleX = (h: number) =>
    PREF_PAD + h * (PREF_WIDTH - 2 * PREF_PAD)
  const scaleY = (s: number) =>
    PREF_HEIGHT - PREF_PAD - s * (PREF_HEIGHT - 2 * PREF_PAD)

  const decisionLine = getDecisionLine(activeWeights)
  const trueLine = getDecisionLine(TRUE_WEIGHTS)

  const FRONTIER_WIDTH = 320
  const FRONTIER_HEIGHT = 220
  const FRONTIER_PAD = 30

  const maxKL =
    frontier.reduce((m, p) => Math.max(m, p.kl), 0) || 1
  const minReward = frontier.reduce(
    (m, p) => Math.min(m, p.rewardTrue, p.rewardModel),
    Infinity,
  )
  const maxReward = frontier.reduce(
    (m, p) => Math.max(m, p.rewardTrue, p.rewardModel),
    -Infinity,
  )
  const rewardSpan = maxReward === minReward ? 1 : maxReward - minReward

  const frontierPath = (key: 'rewardTrue' | 'rewardModel') => {
    if (frontier.length === 0) return ''
    return frontier
      .map((pt, i) => {
        const x =
          FRONTIER_PAD +
          (pt.kl / Math.max(maxKL, 1e-6)) *
            (FRONTIER_WIDTH - 2 * FRONTIER_PAD)
        const y =
          FRONTIER_HEIGHT -
          FRONTIER_PAD -
          ((pt[key] - minReward) / rewardSpan) *
            (FRONTIER_HEIGHT - 2 * FRONTIER_PAD)
        const cmd = i === 0 ? 'M' : 'L'
        return `${cmd} ${x} ${y}`
      })
      .join(' ')
  }

  const currentFrontierPoint = (() => {
    const x =
      FRONTIER_PAD +
      (currentPolicy.kl / Math.max(maxKL, 1e-6)) *
        (FRONTIER_WIDTH - 2 * FRONTIER_PAD)
    const yTrue =
      FRONTIER_HEIGHT -
      FRONTIER_PAD -
      ((currentPolicy.expectedTrue - minReward) / rewardSpan) *
        (FRONTIER_HEIGHT - 2 * FRONTIER_PAD)
    const yModel =
      FRONTIER_HEIGHT -
      FRONTIER_PAD -
      ((currentPolicy.expectedModel - minReward) / rewardSpan) *
        (FRONTIER_HEIGHT - 2 * FRONTIER_PAD)
    return { x, yTrue, yModel }
  })()

  const POLICY_WIDTH = 260
  const POLICY_HEIGHT = 220
  const POLICY_PAD = 26

  const policyScaleX = (h: number) =>
    POLICY_PAD + h * (POLICY_WIDTH - 2 * POLICY_PAD)
  const policyScaleY = (s: number) =>
    POLICY_HEIGHT - POLICY_PAD - s * (POLICY_HEIGHT - 2 * POLICY_PAD)

  const klRadiusPx =
    10 + 60 * Math.min(Math.sqrt(currentPolicy.kl || 0), 1.5)

  return (
    <section className="card interactive-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <h2 style={{ margin: 0 }}>RLHF, Reward Modeling & Constitutional AI</h2>
        <button
          onClick={() => setGameMode(!gameMode)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: gameMode ? '2px solid #14b8a6' : '1px solid #374151',
            background: gameMode ? 'rgba(20, 184, 166, 0.2)' : 'rgba(31, 41, 55, 0.5)',
            color: gameMode ? '#14b8a6' : '#9ca3af',
            cursor: 'pointer',
            fontSize: '13px',
            fontWeight: 500,
          }}
        >
          {gameMode ? '🎯 Challenge Mode' : '🎮 Try Challenge'}
          {gameMode && score > 0 && <span style={{ marginLeft: '8px' }}>Score: {score}</span>}
        </button>
      </div>
      <p className="muted">
        See how a learned reward model, a KL constraint, and constitutional
        principles shape a policy&apos;s behavior.
      </p>

      {/* Game Challenge Panel */}
      {gameMode && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          marginBottom: '16px',
          background: 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(239, 68, 68, 0.05))',
          border: '1px solid rgba(20, 184, 166, 0.3)',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '8px', color: '#14b8a6' }}>
            💡 Hacking Prediction Challenge
          </div>

          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '14px', marginBottom: '12px', color: '#9ca3af' }}>
                Given a training configuration (β, preference samples, reward model quality), predict what happens to the policy!
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {HACKING_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    style={{
                      padding: '8px 14px',
                      borderRadius: '6px',
                      border: '1px solid #374151',
                      background: 'rgba(31, 41, 55, 0.5)',
                      color: '#d1d5db',
                      cursor: 'pointer',
                      fontSize: '13px',
                    }}
                    title={challenge.description}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <div style={{ fontSize: '15px', fontWeight: 500, marginBottom: '4px', color: '#e5e7eb' }}>
                {selectedChallenge.name}
              </div>
              <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '8px' }}>
                {selectedChallenge.description}
              </p>
              <div style={{ fontSize: '13px', color: '#14b8a6', marginBottom: '12px', fontFamily: 'monospace' }}>
                β = {selectedChallenge.beta} | {selectedChallenge.samples} preference samples | {selectedChallenge.imperfect ? 'Imperfect' : 'Perfect'} reward model
              </div>
              <p style={{ fontSize: '13px', marginBottom: '8px', color: '#9ca3af' }}>
                What will happen when we run RL optimization?
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('improves')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ✅ Improves
                </button>
                <button
                  onClick={() => submitPrediction('neutral')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  😐 Neutral
                </button>
                <button
                  onClick={() => submitPrediction('hacks')}
                  style={{
                    padding: '10px 16px',
                    borderRadius: '6px',
                    border: '2px solid #ef4444',
                    background: 'rgba(239, 68, 68, 0.15)',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  💀 Reward Hacks
                </button>
              </div>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '48px', fontWeight: 700, color: '#14b8a6' }}>{countdown}</div>
              <p style={{ color: '#9ca3af' }}>Running RL optimization...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <div style={{
              padding: '12px 16px',
              borderRadius: '6px',
              background: prediction === selectedChallenge.answer
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              border: `1px solid ${prediction === selectedChallenge.answer ? '#22c55e' : '#ef4444'}40`,
            }}>
              <p style={{ fontSize: '14px', lineHeight: '1.6', margin: 0 }}>
                {getHackingFeedback(prediction, selectedChallenge)}
              </p>
              <button
                onClick={() => {
                  setSelectedChallenge(null)
                  setGamePhase('setup')
                  setPrediction(null)
                }}
                style={{
                  marginTop: '12px',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  border: '1px solid #374151',
                  background: 'rgba(31, 41, 55, 0.5)',
                  color: '#d1d5db',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Try Another
              </button>
            </div>
          )}
        </div>
      )}

      {/* Training Regime Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {RLHF_PRESETS.map((preset) => {
          const isActive = Math.abs(beta - preset.beta) < 0.05 &&
            prefSamples === preset.samples &&
            useImperfectReward === preset.imperfect;
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => handlePreset(preset)}
              style={{
                fontSize: '0.75rem',
                padding: '0.35rem 0.7rem',
                borderRadius: '999px',
                border: isActive
                  ? '1px solid rgba(20, 184, 166, 0.7)'
                  : '1px solid rgba(75, 85, 99, 0.5)',
                background: isActive
                  ? 'rgba(20, 184, 166, 0.2)'
                  : 'rgba(15, 23, 42, 0.8)',
                color: '#e5e7eb',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
              }}
              title={preset.description}
            >
              {preset.name}
            </button>
          );
        })}
      </div>

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.9)',
          background: rewardHacking
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
            : !hasOptimized
              ? 'linear-gradient(135deg, rgba(75, 85, 99, 0.15), rgba(75, 85, 99, 0.05))'
              : 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))',
          border: rewardHacking
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : !hasOptimized
              ? '1px solid rgba(75, 85, 99, 0.3)'
              : '1px solid rgba(20, 184, 166, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      {/* Global controls */}
      <div className="rlhf-controls">
        <div className="rlhf-control-group">
          <label className="slider-label">
            KL penalty β ({beta.toFixed(2)})
            <input
              type="range"
              min={0.01}
              max={1}
              step={0.01}
              value={beta}
              onChange={(e) => setBeta(parseFloat(e.target.value))}
            />
          </label>
          <p className="caption">
            Lower β allows the policy to move further from the base model, chasing
            higher reward but increasing KL divergence.
          </p>
        </div>
        <div className="rlhf-control-group">
          <label className="slider-label">
            Preference samples ({prefSamples} / {PREF_PAIRS.length})
            <input
              type="range"
              min={0}
              max={PREF_PAIRS.length}
              step={1}
              value={prefSamples}
              onChange={(e) => setPrefSamples(parseInt(e.target.value, 10))}
            />
          </label>
          <p className="caption">
            More labeled comparisons → a better reward model on the training
            distribution.
          </p>
        </div>
        <div className="rlhf-control-group horizontal">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={useImperfectReward}
              onChange={(e) => setUseImperfectReward(e.target.checked)}
            />
            <span>
              Imperfect reward model{' '}
              <span className="muted">(can be hacked)</span>
            </span>
          </label>
          <button
            onClick={() => setHasOptimized(true)}
            className="primary-button"
          >
            Run RL optimization step
          </button>
        </div>
      </div>

      <div className="rlhf-layout">
        {/* Left column: preference learning + constitutional AI */}
        <div className="rlhf-column">
          <div className="rlhf-panel">
            <h3>1. Preference Learning (Reward Model)</h3>
            <div className="rlhf-panel-layout">
              <svg
                width={PREF_WIDTH}
                height={PREF_HEIGHT}
                className="rlhf-chart"
                role="img"
                aria-label="Reward model decision boundary over helpfulness vs harmlessness"
              >
                {/* Axes */}
                <line
                  x1={scaleX(0)}
                  y1={scaleY(0)}
                  x2={scaleX(1)}
                  y2={scaleY(0)}
                  className="axis-line"
                />
                <line
                  x1={scaleX(0)}
                  y1={scaleY(0)}
                  x2={scaleX(0)}
                  y2={scaleY(1)}
                  className="axis-line"
                />
                {/* Axis labels */}
                <text
                  x={scaleX(1)}
                  y={scaleY(0) + 16}
                  className="axis-label"
                  textAnchor="end"
                >
                  Helpfulness →
                </text>
                <text
                  x={scaleX(0) - 14}
                  y={scaleY(1)}
                  className="axis-label"
                  textAnchor="end"
                >
                  ↑ Harmlessness
                </text>

                {/* True reward decision line (reference) */}
                {trueLine && (
                  <line
                    x1={scaleX(trueLine.p1[0])}
                    y1={scaleY(trueLine.p1[1])}
                    x2={scaleX(trueLine.p2[0])}
                    y2={scaleY(trueLine.p2[1])}
                    stroke={MATH_COLORS.secondary}
                    strokeDasharray="4 3"
                    strokeWidth={1.5}
                    opacity={0.7}
                  />
                )}

                {/* Current reward model decision line */}
                {decisionLine && (
                  <line
                    x1={scaleX(decisionLine.p1[0])}
                    y1={scaleY(decisionLine.p1[1])}
                    x2={scaleX(decisionLine.p2[0])}
                    y2={scaleY(decisionLine.p2[1])}
                    stroke={MATH_COLORS.primary}
                    strokeWidth={2}
                  />
                )}

                {/* Responses as points */}
                {RESPONSES.map((r) => {
                  const isTrain = r.group === 'train'
                  const isLoophole = r.group === 'loophole'
                  const radiusBase =
                    3 + 7 * Math.sqrt(BASE_POLICY[r.id] || 0)
                  const isCurrent =
                    r.id === respA.id || r.id === respB.id
                  return (
                    <g key={r.id}>
                      <circle
                        cx={scaleX(r.helpfulness)}
                        cy={scaleY(r.harmlessness)}
                        r={radiusBase}
                        className="rlhf-response-point"
                        fill={
                          isLoophole
                            ? '#f97316'
                            : isTrain
                            ? '#e5e7eb'
                            : '#cbd5f5'
                        }
                        fillOpacity={isLoophole ? 0.8 : 0.6}
                        stroke={isLoophole ? '#b91c1c' : '#6b7280'}
                        strokeWidth={isLoophole ? 1.5 : 1}
                      />
                      {isCurrent && (
                        <circle
                          cx={scaleX(r.helpfulness)}
                          cy={scaleY(r.harmlessness)}
                          r={radiusBase + 3}
                          fill="none"
                          stroke={
                            r.id === respA.id
                              ? MATH_COLORS.primary
                              : MATH_COLORS.secondary
                          }
                          strokeWidth={2}
                        />
                      )}
                    </g>
                  )
                })}
              </svg>

              <div className="rlhf-preference-controls">
                <p className="muted">
                  Pick which response you prefer for this prompt. The reward
                  model updates its parameters to better match your preferences,
                  shifting the decision boundary.
                </p>
                <div className="preference-buttons">
                  <button
                    className="preference-option"
                    onClick={() => handlePreferenceClick('A')}
                  >
                    <div className="pref-label">
                      <span className="pill">A</span>
                      <span>{respA.label}</span>
                    </div>
                    <div className="pref-scores">
                      <span>
                        r<span className="subscript">model</span>:{' '}
                        {formatNumber(modelScoreA)}
                      </span>
                      <span>
                        r<span className="subscript">true</span>:{' '}
                        {formatNumber(trueScoreA)}
                      </span>
                    </div>
                  </button>
                  <button
                    className="preference-option"
                    onClick={() => handlePreferenceClick('B')}
                  >
                    <div className="pref-label">
                      <span className="pill">B</span>
                      <span>{respB.label}</span>
                    </div>
                    <div className="pref-scores">
                      <span>
                        r<span className="subscript">model</span>:{' '}
                        {formatNumber(modelScoreB)}
                      </span>
                      <span>
                        r<span className="subscript">true</span>:{' '}
                        {formatNumber(trueScoreB)}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rlhf-panel">
            <h3>6. Constitutional AI (Self-Labeling)</h3>
            <div className="constitutional-layout">
              <div className="constitution-card">
                <h4>Principles</h4>
                <ul>
                  <li>Avoid unnecessary harm or dangerous instructions.</li>
                  <li>Be helpful, honest, and clear.</li>
                  <li>Respect user privacy and dignity.</li>
                </ul>
              </div>
              <div className="constitution-comparison">
                <h4>Labels for this pair</h4>
                <div className="label-row">
                  <span className="label-title">Simulated human (true reward):</span>
                  <span className="label-value">
                    prefers <strong>{humanPref}</strong>
                  </span>
                </div>
                <div className="label-row">
                  <span className="label-title">Constitutional AI:</span>
                  <span className="label-value">
                    prefers <strong>{aiConstPref}</strong>
                  </span>
                </div>
                <div className="label-row">
                  <span className="label-title">Current reward model:</span>
                  <span className="label-value">
                    prefers <strong>{modelPref}</strong>
                  </span>
                </div>
                <p className="caption">
                  Constitutional AI uses the principles to generate labels
                  instead of humans. When the AI&apos;s labels match human
                  preferences, we can scale up alignment more cheaply.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column: reward vs KL + policy distribution */}
        <div className="rlhf-column">
          <div className="rlhf-panel">
            <h3>2. Reward vs KL Trade-off</h3>
            <svg
              width={FRONTIER_WIDTH}
              height={FRONTIER_HEIGHT}
              className="rlhf-chart"
              role="img"
              aria-label="Reward vs KL Pareto frontier"
            >
              {/* Axes */}
              <line
                x1={FRONTIER_PAD}
                y1={FRONTIER_HEIGHT - FRONTIER_PAD}
                x2={FRONTIER_WIDTH - FRONTIER_PAD}
                y2={FRONTIER_HEIGHT - FRONTIER_PAD}
                className="axis-line"
              />
              <line
                x1={FRONTIER_PAD}
                y1={FRONTIER_HEIGHT - FRONTIER_PAD}
                x2={FRONTIER_PAD}
                y2={FRONTIER_PAD}
                className="axis-line"
              />
              <text
                x={FRONTIER_WIDTH - FRONTIER_PAD}
                y={FRONTIER_HEIGHT - FRONTIER_PAD + 18}
                className="axis-label"
                textAnchor="end"
              >
                KL(πθ || π₀) →
              </text>
              <text
                x={FRONTIER_PAD}
                y={FRONTIER_PAD - 10}
                className="axis-label"
                textAnchor="start"
              >
                ↑ Expected reward
              </text>

              {/* Frontier curves */}
              <path
                d={frontierPath('rewardModel')}
                fill="none"
                stroke={MATH_COLORS.primary}
                strokeWidth={2}
              />
              <path
                d={frontierPath('rewardTrue')}
                fill="none"
                stroke={MATH_COLORS.secondary}
                strokeWidth={2}
                strokeDasharray="4 3"
              />

              {/* Current operating point */}
              {hasOptimized && (
                <>
                  <line
                    x1={currentFrontierPoint.x}
                    y1={FRONTIER_PAD}
                    x2={currentFrontierPoint.x}
                    y2={FRONTIER_HEIGHT - FRONTIER_PAD}
                    stroke={MATH_COLORS.accent}
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    opacity={0.6}
                  />
                  <circle
                    cx={currentFrontierPoint.x}
                    cy={currentFrontierPoint.yModel}
                    r={5}
                    fill={MATH_COLORS.primary}
                  />
                  <circle
                    cx={currentFrontierPoint.x}
                    cy={currentFrontierPoint.yTrue}
                    r={4}
                    fill="#fff"
                    stroke={MATH_COLORS.secondary}
                    strokeWidth={1.5}
                  />
                </>
              )}
            </svg>
            <p className="caption">
              The solid curve is reward according to the learned reward model; the
              dashed curve is true reward. With an imperfect reward model, very
              low β pushes the policy into a region where model reward keeps
              rising but true quality starts to fall — reward hacking.
            </p>
          </div>

          <div className="rlhf-panel">
            <h3>3. Policy Distribution & KL Constraint</h3>
            <div className="rlhf-panel-layout">
              <svg
                width={POLICY_WIDTH}
                height={POLICY_HEIGHT}
                className="rlhf-chart"
                role="img"
                aria-label="Policy distributions before and after RLHF"
              >
                {/* Axes */}
                <line
                  x1={policyScaleX(0)}
                  y1={policyScaleY(0)}
                  x2={policyScaleX(1)}
                  y2={policyScaleY(0)}
                  className="axis-line"
                />
                <line
                  x1={policyScaleX(0)}
                  y1={policyScaleY(0)}
                  x2={policyScaleX(0)}
                  y2={policyScaleY(1)}
                  className="axis-line"
                />
                {/* KL ball */}
                <circle
                  cx={policyScaleX(BASE_AVG_HELPFULNESS)}
                  cy={policyScaleY(BASE_AVG_HARMLESSNESS)}
                  r={klRadiusPx}
                  fill="none"
                  stroke={MATH_COLORS.accent}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  opacity={0.7}
                />
                {/* Base expectation */}
                <circle
                  cx={policyScaleX(BASE_AVG_HELPFULNESS)}
                  cy={policyScaleY(BASE_AVG_HARMLESSNESS)}
                  r={5}
                  fill="#fff"
                  stroke="#6b7280"
                  strokeWidth={1.5}
                />
                {/* RLHF expectation */}
                <circle
                  cx={policyScaleX(currentPolicy.avgHelpfulness)}
                  cy={policyScaleY(currentPolicy.avgHarmlessness)}
                  r={6}
                  fill={MATH_COLORS.secondary}
                />
                {/* Per-response distributions */}
                {RESPONSES.map((r, i) => {
                  const p0 = BASE_POLICY[i]
                  const p1 = currentPolicy.probs[i]
                  const baseR = 3 + 5 * Math.sqrt(p0)
                  const newR = 3 + 5 * Math.sqrt(p1)
                  const isLoophole = r.group === 'loophole'
                  return (
                    <g key={r.id}>
                      {/* Base */}
                      <circle
                        cx={policyScaleX(r.helpfulness)}
                        cy={policyScaleY(r.harmlessness)}
                        r={baseR}
                        fill="#e5e7eb"
                        stroke="#9ca3af"
                        strokeWidth={1}
                        opacity={0.7}
                      />
                      {/* RLHF */}
                      <circle
                        cx={policyScaleX(r.helpfulness)}
                        cy={policyScaleY(r.harmlessness)}
                        r={newR}
                        fill={isLoophole ? MATH_COLORS.primary : MATH_COLORS.secondary}
                        fillOpacity={isLoophole ? 0.85 : 0.7}
                      />
                    </g>
                  )
                })}
              </svg>
              <div className="policy-caption">
                <p className="muted">
                  Each point is a possible response (helpful vs harmless). Grey
                  circles show the base model distribution π₀; colored circles
                  show the RLHF policy πθ. The dashed circle is a cartoon &ldquo;KL
                  ball&rdquo; around the base model — small β lets πθ move further
                  away.
                </p>
                {rewardHacking ? (
                  <p className="warning">
                    Reward hacking: the policy has shifted probability mass toward
                    high <span className="math">r<sub>model</sub></span> loophole
                    responses, but true reward and safety are worse than the base
                    model.
                  </p>
                ) : (
                  <p className="caption">
                    With a reasonable β and/or a better reward model, the policy
                    moves toward higher-quality responses while staying close to
                    the base distribution.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metrics */}
      <div className="rlhf-metrics">
        <h3>7. Metrics</h3>
        <div className="metric-grid">
          <div className="metric-card">
            <div className="metric-label">Reward (training region)</div>
            <div className="metric-value">
              {formatNumber(trainRewardTrue)}{' '}
              <span className="metric-baseline">
                (base: {formatNumber(BASE_TRAIN_TRUE_REWARD)})
              </span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Reward (held-out + loopholes)</div>
            <div className="metric-value">
              {formatNumber(heldoutRewardTrue)}{' '}
              <span className="metric-baseline">
                (base: {formatNumber(BASE_HELDOUT_TRUE_REWARD)})
              </span>
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">KL from reference</div>
            <div className="metric-value">
              {formatNumber(currentPolicy.kl, 3)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Win rate vs reference (approx)</div>
            <div className="metric-value">
              {(winRateVsRef * 100).toFixed(1)}%
            </div>
          </div>
        </div>
        <p className="caption">
          RLHF = &ldquo;move toward high reward but don&apos;t go too far.&rdquo; The
          KL term keeps the policy near the pre-trained model, which helps avoid
          reward hacking and loss of general capabilities when the reward model
          is imperfect.
        </p>
      </div>
    </section>
  )
}
