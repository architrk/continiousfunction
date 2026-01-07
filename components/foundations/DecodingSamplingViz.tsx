import { useEffect, useMemo, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────
// Gamification Types
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed'
type OutcomePrediction = 'repetitive' | 'diverse' | 'deterministic' | 'chaotic' | null

interface StrategyChallenge {
  name: string
  scenario: 'peaky' | 'long-tail' | 'repetition-trap'
  mode: 'greedy' | 'sample' | 'beam'
  temperature: number
  useTopP: boolean
  topP: number
  repetitionPenalty: number
  answer: Exclude<OutcomePrediction, null>
  description: string
  steps: number // How many steps to run
}

// Mystery challenges - users predict output behavior
const STRATEGY_CHALLENGES: StrategyChallenge[] = [
  {
    name: '🎲 The Trap',
    scenario: 'repetition-trap',
    mode: 'greedy',
    temperature: 1.0,
    useTopP: false,
    topP: 1.0,
    repetitionPenalty: 1.0,
    answer: 'repetitive',
    description: 'Greedy decoding on a repetition-trap scenario... what happens?',
    steps: 8
  },
  {
    name: '🎲 High Temp',
    scenario: 'peaky',
    mode: 'sample',
    temperature: 2.0,
    useTopP: false,
    topP: 1.0,
    repetitionPenalty: 1.0,
    answer: 'chaotic',
    description: 'Temperature = 2.0 flattens the distribution... is it creative or chaotic?',
    steps: 6
  },
  {
    name: '🎲 Ice Cold',
    scenario: 'long-tail',
    mode: 'sample',
    temperature: 0.2,
    useTopP: true,
    topP: 0.9,
    repetitionPenalty: 1.0,
    answer: 'deterministic',
    description: 'Very low temperature on a long-tail distribution...',
    steps: 6
  },
  {
    name: '🎲 GPT-4 Style',
    scenario: 'long-tail',
    mode: 'sample',
    temperature: 0.8,
    useTopP: true,
    topP: 0.9,
    repetitionPenalty: 1.1,
    answer: 'diverse',
    description: 'Balanced temp + top-p + light repetition penalty...',
    steps: 8
  },
  {
    name: '🎲 Escape Artist',
    scenario: 'repetition-trap',
    mode: 'sample',
    temperature: 1.0,
    useTopP: true,
    topP: 0.8,
    repetitionPenalty: 1.5,
    answer: 'diverse',
    description: 'Can top-p + repetition penalty save us from the trap?',
    steps: 8
  },
]

// Educational feedback
function getOutcomeFeedback(
  prediction: OutcomePrediction,
  challenge: StrategyChallenge,
  actualSequence: number[]
): string {
  const isCorrect = prediction === challenge.answer
  const hasRepetition = actualSequence.length >= 3 &&
    actualSequence.slice(-3).every(t => t === actualSequence[actualSequence.length - 1])

  if (isCorrect) {
    if (challenge.answer === 'repetitive') {
      return `✅ Correct! The model got stuck repeating tokens. Greedy decoding on repetition-prone distributions is a classic failure mode. The fix? Add repetition penalty, use sampling, or try nucleus sampling (top-p).`
    }
    if (challenge.answer === 'chaotic') {
      return `✅ Correct! At temperature = ${challenge.temperature}, the distribution becomes nearly uniform. This is great for brainstorming but terrible for coherent text. Notice how even unlikely tokens get sampled!`
    }
    if (challenge.answer === 'deterministic') {
      return `✅ Correct! Low temperature (${challenge.temperature}) sharpens the distribution so much it's almost greedy. The output is predictable but can lack creativity.`
    }
    return `✅ Correct! This balanced configuration produces diverse but coherent outputs. Temperature ${challenge.temperature} + top-p ${challenge.topP} is the "sweet spot" used by most production LLMs.`
  }

  // Wrong answers
  if (challenge.answer === 'repetitive') {
    return `❌ It actually got repetitive! ${hasRepetition ? 'Look at the sequence - same tokens repeating.' : 'Without any diversity mechanism, greedy decoding on trap scenarios degenerates.'} The model has no way to escape the local maximum.`
  }
  if (challenge.answer === 'chaotic') {
    return `❌ This was actually chaotic! At temp=${challenge.temperature}, the probability mass spreads too evenly. Even tokens with low base probability get sampled frequently.`
  }
  if (challenge.answer === 'deterministic') {
    return `❌ This was actually deterministic! Temperature ${challenge.temperature} is so low that even with sampling, we almost always pick the highest-probability token.`
  }
  return `❌ This was actually diverse! The configuration (temp=${challenge.temperature}, top-p=${challenge.topP}, rep-pen=${challenge.repetitionPenalty}) strikes a balance between exploration and coherence.`
}

type ScenarioId = 'peaky' | 'long-tail' | 'repetition-trap'
type DecodeMode = 'greedy' | 'sample' | 'beam'

type TokenInfo = { token: string; id: number }
type DistRow = {
  token: string
  id: number
  logit: number
  prob: number
  probFiltered: number
  allowed: boolean
}

type Beam = { continuation: number[]; logp: number }

const TOKENS: TokenInfo[] = [
  { token: 'the', id: 0 },
  { token: 'cat', id: 1 },
  { token: 'dog', id: 2 },
  { token: 'sat', id: 3 },
  { token: 'on', id: 4 },
  { token: 'mat', id: 5 },
  { token: 'and', id: 6 },
  { token: 'ha', id: 7 },
  { token: '.', id: 8 },
  { token: '!', id: 9 },
]

const SCENARIOS: Array<{ id: ScenarioId; title: string; description: string }> = [
  {
    id: 'peaky',
    title: 'Peaky distribution',
    description: 'Low entropy: one token dominates. Temperature changes "determinism" fast.'
  },
  {
    id: 'long-tail',
    title: 'Long tail',
    description: 'High entropy: many plausible tokens. Top‑p deletes the tail dynamically.'
  },
  {
    id: 'repetition-trap',
    title: 'Repetition trap',
    description: 'A toy loop where greedy decoding collapses into repetition unless you reshape the distribution.'
  }
]

// Strategy presets for quick exploration
const STRATEGY_PRESETS = [
  { name: '🎯 Greedy', mode: 'greedy' as DecodeMode, temp: 1.0, topP: 1.0, topK: 10, useTopP: false, useTopK: false, repPen: 1.0, description: 'Always pick highest probability (deterministic, boring)' },
  { name: '🎨 Creative', mode: 'sample' as DecodeMode, temp: 1.2, topP: 0.95, topK: 10, useTopP: true, useTopK: false, repPen: 1.1, description: 'Higher temperature + top-p for diverse outputs' },
  { name: '📝 Balanced', mode: 'sample' as DecodeMode, temp: 0.8, topP: 0.9, topK: 10, useTopP: true, useTopK: false, repPen: 1.0, description: 'GPT-4 default-ish: reliable yet varied' },
  { name: '🔒 Focused', mode: 'sample' as DecodeMode, temp: 0.3, topP: 0.5, topK: 5, useTopP: true, useTopK: true, repPen: 1.0, description: 'Low temp + aggressive filtering for precision' },
  { name: '🌊 Chaos', mode: 'sample' as DecodeMode, temp: 2.0, topP: 1.0, topK: 10, useTopP: false, useTopK: false, repPen: 1.0, description: 'Flat distribution = pure randomness' },
]

// Dynamic educational insight based on current state
function getDecodingInsight(
  mode: DecodeMode,
  temperature: number,
  useTopP: boolean,
  topP: number,
  useTopK: boolean,
  topK: number,
  hBase: number,
  hFiltered: number,
  massKept: number,
  sequence: number[],
  repetitionPenalty: number
): string {
  // Check for repetition in sequence
  const hasRepetition = sequence.length >= 3 &&
    sequence[sequence.length - 1] === sequence[sequence.length - 2] &&
    sequence[sequence.length - 2] === sequence[sequence.length - 3];

  if (hasRepetition && repetitionPenalty <= 1.05) {
    return `⚠️ REPETITION DETECTED! The model is stuck in a loop. This is classic "degenerate" behavior. Try: (1) increase repetition penalty, (2) raise temperature, or (3) use top-p to add variety.`;
  }

  if (mode === 'greedy') {
    return `🎯 Greedy mode: Always picking argmax. Entropy is ${hBase.toFixed(2)} nats, but you're only considering 1 token. Deterministic but predictable—great for math, bad for stories.`;
  }

  if (mode === 'beam') {
    return `🔍 Beam search: Exploring multiple paths simultaneously. Unlike greedy, beam can find globally better sequences by keeping the top-k hypotheses at each step.`;
  }

  // Sampling mode insights
  if (temperature > 1.5) {
    return `🌡️ Very high temperature (${temperature.toFixed(2)})! The distribution is being flattened—rare tokens become much more likely. Output will be highly unpredictable. Good for brainstorming, bad for coherence.`;
  }

  if (temperature < 0.3) {
    return `❄️ Very low temperature (${temperature.toFixed(2)})! Distribution is sharpened—almost greedy behavior with a tiny bit of stochasticity. Good for deterministic-feeling outputs.`;
  }

  if (useTopP && topP < 0.5) {
    return `✂️ Aggressive top-p (${topP.toFixed(2)})! Only ${(massKept * 100).toFixed(0)}% probability mass kept. This dramatically reduces vocabulary to just the most likely tokens.`;
  }

  if (useTopK && topK <= 3) {
    return `🎰 Very restrictive top-k (k=${topK})! Sampling only from the ${topK} most likely tokens. Simple but ignores distribution shape—top-p is usually more adaptive.`;
  }

  if (hFiltered < 0.5 && hBase > 1.0) {
    return `📉 Entropy dropped from ${hBase.toFixed(2)} → ${hFiltered.toFixed(2)} nats. Filtering removed most uncertainty—the model is now very confident about what comes next.`;
  }

  if (hBase > 2.0) {
    return `📊 High base entropy (${hBase.toFixed(2)} nats)! The model sees many plausible continuations. This is where sampling shines over greedy—you get diversity instead of repetition.`;
  }

  return `⚖️ Temperature ${temperature.toFixed(2)} × top-p ${useTopP ? topP.toFixed(2) : 'off'} × top-k ${useTopK ? topK : 'off'}. Base entropy: ${hBase.toFixed(2)} nats. Experiment with sliders to see how each changes the distribution!`;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function argmax(values: number[]) {
  let bestI = 0
  let bestV = -Infinity
  for (let i = 0; i < values.length; i++) {
    if (values[i] > bestV) {
      bestV = values[i]
      bestI = i
    }
  }
  return bestI
}

function nextRand(seed: number): [number, number] {
  const next = (Math.imul(seed >>> 0, 1664525) + 1013904223) >>> 0
  return [next / 2 ** 32, next]
}

function softmaxFromLogits(logits: number[], temperature: number) {
  const t = Math.max(1e-6, temperature)
  const scaled = logits.map((z) => z / t)
  const maxVal = Math.max(...scaled)
  const exps = scaled.map((v) => Math.exp(v - maxVal))
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1
  return exps.map((e) => e / sum)
}

function entropy(probs: number[]) {
  let h = 0
  for (const p of probs) {
    if (p <= 0) continue
    h += -p * Math.log(p)
  }
  return h
}

function applyTopKMask(probs: number[], topK: number) {
  const n = probs.length
  const k = Math.floor(topK)
  if (k <= 0 || k >= n) return new Array(n).fill(true) as boolean[]

  const idx = [...probs.keys()].sort((a, b) => probs[b] - probs[a])
  const keep = new Array(n).fill(false) as boolean[]
  for (let i = 0; i < k; i++) keep[idx[i]] = true
  return keep
}

function applyTopPMask(probs: number[], topP: number) {
  const n = probs.length
  const p = clamp(topP, 0, 1)
  if (p >= 1) return new Array(n).fill(true) as boolean[]

  const idx = [...probs.keys()].sort((a, b) => probs[b] - probs[a])
  const keep = new Array(n).fill(false) as boolean[]

  let mass = 0
  for (let i = 0; i < idx.length; i++) {
    const j = idx[i]
    keep[j] = true
    mass += probs[j]
    if (mass >= p && i >= 0) break
  }

  // Safety: never allow an empty mask.
  if (!keep.some(Boolean)) keep[idx[0] ?? 0] = true
  return keep
}

function renormalize(probs: number[], allowed: boolean[]) {
  let mass = 0
  for (let i = 0; i < probs.length; i++) {
    if (allowed[i]) mass += probs[i]
  }
  const denom = mass || 1
  return { probs: probs.map((p, i) => (allowed[i] ? p / denom : 0)), massKept: mass }
}

function tokenColorStyle(i: number) {
  const hue = (i * 47) % 360
  return {
    backgroundColor: `hsla(${hue}, 80%, 65%, 0.18)`,
    borderColor: `hsla(${hue}, 80%, 65%, 0.35)`,
  } as React.CSSProperties
}

function baseLogitsForScenario(s: ScenarioId, prevTokenId: number | null) {
  const n = TOKENS.length
  const logits = new Array(n).fill(0) as number[]

  if (s === 'peaky') {
    // Strongly favor "the", with a couple plausible continuations.
    logits[0] = 4.4 // the
    logits[1] = 2.0 // cat
    logits[2] = 1.8 // dog
    logits[3] = 1.1 // sat
    logits[4] = 0.9 // on
    logits[5] = 0.7 // mat
    logits[6] = 0.6 // and
    logits[7] = -0.4 // ha
    logits[8] = 0.5 // .
    logits[9] = 0.2 // !
    return logits
  }

  if (s === 'long-tail') {
    // Smoothly decaying long tail.
    const base = 2.2
    for (let i = 0; i < n; i++) {
      logits[i] = base - i * 0.35
    }
    return logits
  }

  // repetition-trap
  // A toy Markov chain: once you hit "ha", it wants to repeat "ha" forever.
  for (let i = 0; i < n; i++) logits[i] = -1.2

  const ha = 7
  const bang = 9
  const dot = 8
  const the = 0

  if (prevTokenId === ha) {
    logits[ha] = 4.2
    logits[bang] = 1.0
    logits[dot] = 0.6
    logits[the] = 0.2
  } else {
    logits[ha] = 2.6
    logits[the] = 1.2
    logits[bang] = 1.0
    logits[dot] = 0.7
    logits[6] = 0.4 // and
  }

  return logits
}

function applyRepetitionPenalty(logits: number[], history: number[], penalty: number) {
  const p = Math.max(1, penalty)
  if (p === 1) return logits

  const counts = new Array(logits.length).fill(0) as number[]
  for (const t of history) {
    if (t >= 0 && t < counts.length) counts[t]++
  }

  const strength = Math.log(p)
  return logits.map((z, i) => z - strength * counts[i])
}

function sampleFromDistribution(probs: number[], seed: number): [number, number] {
  let [r, nextSeed] = nextRand(seed)
  let cum = 0
  for (let i = 0; i < probs.length; i++) {
    cum += probs[i]
    if (r <= cum) return [i, nextSeed]
  }
  return [probs.length - 1, nextSeed]
}

function renderSequence(seq: number[]) {
  if (!seq.length) return '∅'
  return seq.map((i) => TOKENS[i]?.token ?? '?').join(' ')
}

export default function DecodingSamplingViz() {
  const [scenario, setScenario] = useState<ScenarioId>('peaky')
  const [mode, setMode] = useState<DecodeMode>('sample')

  const [temperature, setTemperature] = useState(0.8)
  const [useTopK, setUseTopK] = useState(false)
  const [topK, setTopK] = useState(5)
  const [useTopP, setUseTopP] = useState(true)
  const [topP, setTopP] = useState(0.9)
  const [repetitionPenalty, setRepetitionPenalty] = useState(1.0)

  const [seed, setSeed] = useState(123)
  const [sequence, setSequence] = useState<number[]>([])

  const [autoplay, setAutoplay] = useState(false)
  const autoplayRef = useRef<number | null>(null)

  // ─────────────────────────────────────────────────────────────
  // Gamification State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<StrategyChallenge | null>(null)
  const [prediction, setPrediction] = useState<OutcomePrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])

  // Game control functions
  const startChallenge = (challenge: StrategyChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(3)
  }

  const submitPrediction = (pred: OutcomePrediction) => {
    if (!selectedChallenge || gamePhase !== 'countdown') return
    setPrediction(pred)
    // Apply challenge settings
    setScenario(selectedChallenge.scenario)
    setMode(selectedChallenge.mode)
    setTemperature(selectedChallenge.temperature)
    setUseTopP(selectedChallenge.useTopP)
    setTopP(selectedChallenge.topP)
    setRepetitionPenalty(selectedChallenge.repetitionPenalty)
    setSequence([])
    // Start autoplay for the challenge steps
    setTimeout(() => {
      setAutoplay(true)
      setTimeout(() => {
        setAutoplay(false)
        setGamePhase('revealed')
        // Score
        if (pred === selectedChallenge.answer) {
          setScore((s) => s + 1)
        }
        if (!completedChallenges.includes(selectedChallenge.name)) {
          setCompletedChallenges((c) => [...c, selectedChallenge.name])
        }
      }, selectedChallenge.steps * 600)
    }, 100)
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(3)
    setAutoplay(false)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  // Beam settings
  const [beamWidth, setBeamWidth] = useState(3)
  const [beamSteps, setBeamSteps] = useState(6)
  const [beamResults, setBeamResults] = useState<Beam[] | null>(null)

  const prevTokenId = sequence.length ? sequence[sequence.length - 1] : null

  const rawLogits = useMemo(() => {
    const base = baseLogitsForScenario(scenario, prevTokenId)
    return applyRepetitionPenalty(base, sequence, repetitionPenalty)
  }, [scenario, prevTokenId, sequence, repetitionPenalty])

  const baseProbs = useMemo(() => softmaxFromLogits(rawLogits, temperature), [rawLogits, temperature])

  const maskTopK = useMemo(() => (useTopK ? applyTopKMask(baseProbs, topK) : new Array(baseProbs.length).fill(true)), [baseProbs, useTopK, topK])
  const maskTopP = useMemo(() => (useTopP ? applyTopPMask(baseProbs, topP) : new Array(baseProbs.length).fill(true)), [baseProbs, useTopP, topP])

  const allowed = useMemo(() => maskTopK.map((v, i) => v && maskTopP[i]), [maskTopK, maskTopP])

  const filtered = useMemo(() => renormalize(baseProbs, allowed), [baseProbs, allowed])
  const filteredProbs = filtered.probs
  const massKept = filtered.massKept

  const hBase = useMemo(() => entropy(baseProbs), [baseProbs])
  const hFiltered = useMemo(() => entropy(filteredProbs), [filteredProbs])

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getDecodingInsight(
      mode, temperature, useTopP, topP, useTopK, topK,
      hBase, hFiltered, massKept, sequence, repetitionPenalty
    );
  }, [mode, temperature, useTopP, topP, useTopK, topK, hBase, hFiltered, massKept, sequence, repetitionPenalty]);

  // Handle preset selection
  const handlePreset = (preset: typeof STRATEGY_PRESETS[0]) => {
    setMode(preset.mode);
    setTemperature(preset.temp);
    setTopP(preset.topP);
    setTopK(preset.topK);
    setUseTopP(preset.useTopP);
    setUseTopK(preset.useTopK);
    setRepetitionPenalty(preset.repPen);
  };

  const distRows: DistRow[] = useMemo(() => {
    const rows: DistRow[] = TOKENS.map((t, i) => ({
      token: t.token,
      id: t.id,
      logit: rawLogits[i] ?? 0,
      prob: baseProbs[i] ?? 0,
      probFiltered: filteredProbs[i] ?? 0,
      allowed: allowed[i] ?? true
    }))

    rows.sort((a, b) => (b.probFiltered || b.prob) - (a.probFiltered || a.prob))
    return rows
  }, [rawLogits, baseProbs, filteredProbs, allowed])

  useEffect(() => {
    // Stop autoplay when switching to beam mode.
    if (mode === 'beam') setAutoplay(false)
  }, [mode])

  useEffect(() => {
    if (!autoplay) {
      if (autoplayRef.current !== null) {
        window.clearInterval(autoplayRef.current)
        autoplayRef.current = null
      }
      return
    }

    autoplayRef.current = window.setInterval(() => {
      stepOnce()
    }, 550)

    return () => {
      if (autoplayRef.current !== null) {
        window.clearInterval(autoplayRef.current)
        autoplayRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, mode, scenario, temperature, useTopK, topK, useTopP, topP, repetitionPenalty, seed, sequence])

  function stepOnce() {
    setBeamResults(null)

    if (!filteredProbs.length) return

    if (mode === 'greedy') {
      const i = argmax(filteredProbs)
      setSequence((s) => [...s, i])
      return
    }

    if (mode === 'sample') {
      const [i, nextSeed] = sampleFromDistribution(filteredProbs, seed)
      setSeed(nextSeed)
      setSequence((s) => [...s, i])
      return
    }
  }

  function reset() {
    setAutoplay(false)
    setSequence([])
    setBeamResults(null)
  }

  function runBeam() {
    setAutoplay(false)

    const width = clamp(Math.floor(beamWidth), 1, 8)
    const steps = clamp(Math.floor(beamSteps), 1, 12)

    const beams: Beam[] = [{ continuation: [], logp: 0 }]

    for (let t = 0; t < steps; t++) {
      const expanded: Beam[] = []
      for (const beam of beams) {
        const fullHistory = [...sequence, ...beam.continuation]
        const last = fullHistory.length ? fullHistory[fullHistory.length - 1] : null
        const logits = applyRepetitionPenalty(baseLogitsForScenario(scenario, last), fullHistory, repetitionPenalty)
        const probs = softmaxFromLogits(logits, temperature)
        const kMask = useTopK ? applyTopKMask(probs, topK) : new Array(probs.length).fill(true)
        const pMask = useTopP ? applyTopPMask(probs, topP) : new Array(probs.length).fill(true)
        const allow = kMask.map((v, i) => v && pMask[i])
        const { probs: probsF } = renormalize(probs, allow)

        for (let i = 0; i < probsF.length; i++) {
          const p = probsF[i]
          if (p <= 0) continue
          expanded.push({ continuation: [...beam.continuation, i], logp: beam.logp + Math.log(p) })
        }
      }

      expanded.sort((a, b) => b.logp - a.logp)
      beams.splice(0, beams.length, ...expanded.slice(0, width))
    }

    setBeamResults(beams.slice(0, Math.min(width, 5)))
  }

  return (
    <section className="card interactive-card decoding-viz">
      <h2>Decoding Console: Temperature, Top‑p & Sampling</h2>
      <p className="muted">
        Training gives you probabilities. Decoding chooses what world you actually sample from.
        Watch how temperature reshapes logits, how top‑p deletes the tail (then renormalizes),
        and how these knobs can create or prevent degeneration.
      </p>

      {/* Strategy Presets */}
      <div className="strategy-presets">
        {STRATEGY_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            className={`preset-btn ${mode === preset.mode && Math.abs(temperature - preset.temp) < 0.05 ? 'active' : ''}`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={() => setGameMode(!gameMode)}
          className={`preset-btn ${gameMode ? 'game-active' : ''}`}
        >
          {gameMode ? '🎮 Exit Challenge' : '🎯 Try Prediction Challenge'}
        </button>
        {score > 0 && (
          <span className="game-score">Score: {score}/{completedChallenges.length}</span>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Gamification Panel
         ───────────────────────────────────────────────────────────── */}
      {gameMode && (
        <div className="game-panel">
          <div className="game-header">
            <h3>🎯 Strategy Prediction Challenge</h3>
            {gamePhase !== 'setup' && (
              <button onClick={resetGame} className="btn ghost small">← Back</button>
            )}
          </div>

          {gamePhase === 'setup' && (
            <>
              <p className="game-desc">
                Can you predict how the model will behave? Consider temperature, top-p, and repetition penalty!
              </p>
              <div className="game-challenges">
                {STRATEGY_CHALLENGES.map((challenge) => {
                  const isCompleted = completedChallenges.includes(challenge.name)
                  return (
                    <button
                      key={challenge.name}
                      onClick={() => startChallenge(challenge)}
                      className={`preset-btn ${isCompleted ? 'completed' : ''}`}
                    >
                      {isCompleted ? '✓ ' : ''}{challenge.name}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {gamePhase === 'countdown' && selectedChallenge && (
            <div className="game-countdown">
              <p className="game-challenge-name">{selectedChallenge.name}</p>
              <p className="game-challenge-desc">&ldquo;{selectedChallenge.description}&rdquo;</p>
              <p className="game-question">What will the output behavior be?</p>
              <div className="game-options">
                {[
                  { value: 'repetitive' as const, label: '🔄 Repetitive', desc: 'Stuck in a loop' },
                  { value: 'deterministic' as const, label: '🎯 Deterministic', desc: 'Same output every time' },
                  { value: 'diverse' as const, label: '🌈 Diverse', desc: 'Varied but coherent' },
                  { value: 'chaotic' as const, label: '🌪️ Chaotic', desc: 'Random gibberish' },
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => submitPrediction(option.value)}
                    className="game-option-btn"
                  >
                    <div className="game-option-label">{option.label}</div>
                    <div className="game-option-desc">{option.desc}</div>
                  </button>
                ))}
              </div>
              {countdown > 0 && (
                <div className="game-timer">Make your prediction! ({countdown}s to think...)</div>
              )}
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <div className="game-revealed">
              <div className={`game-result ${prediction === selectedChallenge.answer ? 'correct' : 'incorrect'}`}>
                <p>{getOutcomeFeedback(prediction, selectedChallenge, sequence)}</p>
              </div>
              <div className="game-comparison">
                <span>
                  Your prediction: <span className={prediction === selectedChallenge.answer ? 'correct-text' : 'incorrect-text'}>
                    {prediction === 'repetitive' ? '🔄 Repetitive' : prediction === 'deterministic' ? '🎯 Deterministic' : prediction === 'diverse' ? '🌈 Diverse' : '🌪️ Chaotic'}
                  </span>
                </span>
                <span>
                  Actual: <span className="actual-text">
                    {selectedChallenge.answer === 'repetitive' ? '🔄 Repetitive' : selectedChallenge.answer === 'deterministic' ? '🎯 Deterministic' : selectedChallenge.answer === 'diverse' ? '🌈 Diverse' : '🌪️ Chaotic'}
                  </span>
                </span>
              </div>
              <p className="game-note">👆 Watch the sequence above - it shows the actual generation!</p>
            </div>
          )}
        </div>
      )}

      {/* Dynamic Insight */}
      <div
        className="dynamic-insight"
        style={{
          background: currentInsight.includes('REPETITION') || currentInsight.includes('⚠️')
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
            : currentInsight.includes('🌡️') || currentInsight.includes('❄️')
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
          border: currentInsight.includes('REPETITION') || currentInsight.includes('⚠️')
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : currentInsight.includes('🌡️') || currentInsight.includes('❄️')
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="layout">
        <div className="panel">
          <div className="panel-title">Scenario</div>
          <div className="scenario-grid">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={['scenario', s.id === scenario ? 'active' : ''].join(' ')}
                onClick={() => {
                  setScenario(s.id)
                  setBeamResults(null)
                }}
              >
                <div className="scenario-name">{s.title}</div>
                <div className="scenario-desc">{s.description}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-title">Controls</div>

          <div className="controls">
            <label className="field">
              <span className="label">Decode mode</span>
              <select value={mode} onChange={(e) => setMode(e.target.value as DecodeMode)}>
                <option value="greedy">Greedy (argmax)</option>
                <option value="sample">Sample (stochastic)</option>
                <option value="beam">Beam search (preview)</option>
              </select>
            </label>

            <label className="field">
              <span className="label">Temperature (τ): {temperature.toFixed(2)}</span>
              <input
                type="range"
                min={0.05}
                max={2.0}
                step={0.05}
                value={temperature}
                onChange={(e) => setTemperature(Number(e.target.value))}
              />
              <span className="subtle">Lower → sharper; higher → flatter.</span>
            </label>

            <label className="field">
              <span className="label">Repetition penalty: {repetitionPenalty.toFixed(2)}</span>
              <input
                type="range"
                min={1.0}
                max={2.2}
                step={0.05}
                value={repetitionPenalty}
                onChange={(e) => setRepetitionPenalty(Number(e.target.value))}
              />
              <span className="subtle">Toy penalty: downweights tokens already used in the sequence.</span>
            </label>

            <div className="row">
              <label className="toggle">
                <input type="checkbox" checked={useTopP} onChange={(e) => setUseTopP(e.target.checked)} />
                <span>Top‑p</span>
              </label>
              <label className="field compact">
                <span className="label">p: {topP.toFixed(2)}</span>
                <input
                  type="range"
                  min={0.05}
                  max={1.0}
                  step={0.01}
                  value={topP}
                  disabled={!useTopP}
                  onChange={(e) => setTopP(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="row">
              <label className="toggle">
                <input type="checkbox" checked={useTopK} onChange={(e) => setUseTopK(e.target.checked)} />
                <span>Top‑k</span>
              </label>
              <label className="field compact">
                <span className="label">k: {topK}</span>
                <input
                  type="range"
                  min={1}
                  max={TOKENS.length}
                  step={1}
                  value={topK}
                  disabled={!useTopK}
                  onChange={(e) => setTopK(Number(e.target.value))}
                />
              </label>
            </div>

            <div className="row">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (mode === 'beam') runBeam()
                  else stepOnce()
                }}
              >
                {mode === 'beam' ? 'Run Beam Search' : 'Generate Next Token'}
              </button>
              <button type="button" className="btn ghost" onClick={reset}>Reset</button>
              {mode !== 'beam' ? (
                <label className="toggle auto">
                  <input type="checkbox" checked={autoplay} onChange={(e) => setAutoplay(e.target.checked)} />
                  <span>Auto</span>
                </label>
              ) : null}
              <button type="button" className="btn ghost" onClick={() => setSeed((s) => (s + 1) >>> 0)}>
                Reseed
              </button>
            </div>
          </div>

          {mode === 'beam' ? (
            <div className="beam-controls">
              <div className="panel-title small">Beam settings</div>
              <div className="beam-grid">
                <label className="field">
                  <span className="label">Width: {beamWidth}</span>
                  <input
                    type="range"
                    min={1}
                    max={8}
                    step={1}
                    value={beamWidth}
                    onChange={(e) => setBeamWidth(Number(e.target.value))}
                  />
                </label>
                <label className="field">
                  <span className="label">Steps: {beamSteps}</span>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    step={1}
                    value={beamSteps}
                    onChange={(e) => setBeamSteps(Number(e.target.value))}
                  />
                </label>
              </div>
              <div className="subtle">
                Beam search is deterministic best-first expansion; it often increases likelihood but can reduce diversity.
              </div>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-title">Sequence</div>
          <div className="sequence">
            {sequence.length ? (
              <div className="tokens">
                {sequence.map((t, i) => (
                  <span key={`${i}-${t}`} className="tok" style={tokenColorStyle(t)}>
                    <span className="mono">{TOKENS[t]?.token ?? '?'}</span>
                  </span>
                ))}
              </div>
            ) : (
              <div className="empty">No tokens generated yet.</div>
            )}
          </div>

          {beamResults ? (
            <div className="beam-results">
              <div className="panel-title small">Top beams</div>
              <ol>
                {beamResults.map((b, i) => (
                  <li key={i}>
                    <span className="mono">{renderSequence(b.continuation)}</span>
                    <span className="beam-metric">logp {b.logp.toFixed(2)}</span>
                    <button
                      type="button"
                      className="small-btn"
                      onClick={() => {
                        setSequence((s) => [...s, ...b.continuation])
                        setBeamResults(null)
                      }}
                    >
                      Append
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel-title">Distribution (this step)</div>
          <div className="stats">
            <div className="stat">
              <div className="stat-label">Entropy (base)</div>
              <div className="stat-value mono">{hBase.toFixed(3)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Entropy (after filters)</div>
              <div className="stat-value mono">{hFiltered.toFixed(3)}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Mass kept</div>
              <div className="stat-value mono">{massKept.toFixed(3)}</div>
              <div className="stat-sub">renorm factor ≈ {(massKept > 0 ? (1 / massKept) : 0).toFixed(2)}×</div>
            </div>
          </div>

          <div className="dist">
            {distRows.map((r) => {
              const p = mode === 'beam' ? r.probFiltered : r.probFiltered
              const widthPct = `${(p * 100).toFixed(2)}%`
              return (
                <div key={r.id} className={['dist-row', r.allowed ? '' : 'masked'].join(' ')}>
                  <div className="dist-left">
                    <span className="tok-mini" style={tokenColorStyle(r.id)}>
                      <span className="mono">{r.token}</span>
                    </span>
                    <span className="mono dist-prob">{p.toFixed(3)}</span>
                  </div>
                  <div className="bar">
                    <div className="fill" style={{ width: widthPct }} />
                  </div>
                  <div className="dist-right mono">logit {r.logit.toFixed(2)}</div>
                </div>
              )
            })}
          </div>

          <div className="hint">
            Top‑p chooses a set of tokens with cumulative mass ≥ p, then renormalizes. When the distribution is sharp, top‑p may keep only a few tokens;
            when it’s flat, it keeps many. That’s why it behaves differently from a fixed top‑k.
          </div>
        </div>
      </div>

      <style jsx>{`
        .decoding-viz {
          position: relative;
        }

        .strategy-presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin: 1rem 0;
        }

        .preset-btn {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: 999px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(0, 0, 0, 0.3);
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease-out;
        }

        .preset-btn:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.5);
        }

        .preset-btn.active {
          background: rgba(245, 158, 11, 0.25);
          border-color: rgba(245, 158, 11, 0.7);
          color: #fef3c7;
        }

        .preset-btn.game-active {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.25), rgba(249, 115, 22, 0.15));
          border-color: rgba(245, 158, 11, 0.8);
          color: #fcd34d;
        }

        .preset-btn.completed {
          background: rgba(34, 197, 94, 0.15);
          border-color: #22c55e;
          color: #86efac;
        }

        .game-score {
          font-size: 0.85rem;
          color: #fcd34d;
          margin-left: 0.5rem;
        }

        .game-panel {
          margin-bottom: 1rem;
          padding: 1rem;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.05));
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .game-header h3 {
          margin: 0;
          font-size: 1rem;
          font-weight: 600;
          color: #fcd34d;
        }

        .btn.small {
          font-size: 0.75rem;
          padding: 0.35rem 0.6rem;
        }

        .game-desc {
          font-size: 0.85rem;
          color: #d1d5db;
          margin-bottom: 0.75rem;
        }

        .game-challenges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .game-countdown {
          text-align: center;
        }

        .game-challenge-name {
          font-size: 0.95rem;
          font-weight: 600;
          color: #fcd34d;
          margin-bottom: 0.5rem;
        }

        .game-challenge-desc {
          font-size: 0.85rem;
          color: #d1d5db;
          font-style: italic;
          margin-bottom: 1rem;
        }

        .game-question {
          font-size: 0.9rem;
          color: #e5e7eb;
          margin-bottom: 0.75rem;
        }

        .game-options {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.6rem;
          margin-bottom: 0.75rem;
        }

        .game-option-btn {
          padding: 0.6rem 1rem;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(55, 65, 81, 0.6);
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease-out;
          text-align: center;
        }

        .game-option-btn:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.5);
        }

        .game-option-label {
          font-weight: 500;
          font-size: 0.85rem;
        }

        .game-option-desc {
          font-size: 0.7rem;
          color: #9ca3af;
          margin-top: 0.2rem;
        }

        .game-timer {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .game-revealed {
          text-align: left;
        }

        .game-result {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 0.75rem;
        }

        .game-result.correct {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
        }

        .game-result.incorrect {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        .game-result p {
          margin: 0;
          font-size: 0.85rem;
          line-height: 1.6;
          color: #e5e7eb;
        }

        .game-comparison {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: #9ca3af;
          margin-bottom: 0.5rem;
        }

        .correct-text {
          color: #86efac;
        }

        .incorrect-text {
          color: #fca5a5;
        }

        .actual-text {
          color: #fcd34d;
        }

        .game-note {
          font-size: 0.75rem;
          color: #6b7280;
          margin: 0;
        }

        .dynamic-insight {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
          font-size: 0.88rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .layout {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 1rem;
          margin-top: 1rem;
          align-items: start;
        }

        .panel {
          background: rgba(8, 12, 20, 0.45);
          border: 1px solid rgba(245, 158, 11, 0.18);
          border-radius: 12px;
          padding: 0.9rem;
        }

        .panel-title {
          font-weight: 700;
          color: rgba(245, 240, 225, 0.95);
          margin-bottom: 0.6rem;
        }

        .panel-title.small {
          font-size: 0.9rem;
          margin-bottom: 0.4rem;
        }

        .scenario-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .scenario {
          border-radius: 12px;
          border: 1px solid rgba(245, 158, 11, 0.16);
          background: rgba(0, 0, 0, 0.22);
          padding: 0.75rem;
          text-align: left;
          cursor: pointer;
          transition: border-color 0.15s ease, background 0.15s ease;
          min-height: 92px;
        }

        .scenario:hover {
          border-color: rgba(245, 158, 11, 0.35);
          background: rgba(245, 158, 11, 0.06);
        }

        .scenario.active {
          border-color: rgba(245, 158, 11, 0.55);
          background: rgba(245, 158, 11, 0.10);
        }

        .scenario-name {
          font-weight: 700;
          color: rgba(255, 255, 255, 0.92);
          margin-bottom: 0.25rem;
        }

        .scenario-desc {
          color: var(--text-secondary);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .controls {
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .field {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .field.compact {
          flex: 1;
        }

        .label {
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        select,
        input[type='number'] {
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.2);
          background: rgba(0, 0, 0, 0.28);
          padding: 0.5rem 0.6rem;
          color: rgba(255, 255, 255, 0.92);
          outline: none;
        }

        select:focus,
        input[type='number']:focus {
          border-color: rgba(245, 158, 11, 0.45);
        }

        input[type='range'] {
          width: 100%;
        }

        .subtle {
          font-size: 0.78rem;
          color: var(--text-tertiary);
          line-height: 1.35;
        }

        .row {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          color: rgba(245, 240, 225, 0.9);
          font-size: 0.9rem;
          user-select: none;
        }

        .toggle.auto {
          padding: 0.2rem 0.35rem;
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.12);
          background: rgba(0, 0, 0, 0.18);
        }

        .btn {
          border-radius: 10px;
          border: 1px solid rgba(245, 158, 11, 0.25);
          background: rgba(245, 158, 11, 0.12);
          color: rgba(255, 255, 255, 0.92);
          padding: 0.55rem 0.8rem;
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }

        .btn:hover {
          border-color: rgba(245, 158, 11, 0.45);
          background: rgba(245, 158, 11, 0.16);
        }

        .btn.ghost {
          background: rgba(0, 0, 0, 0.22);
        }

        .beam-controls {
          margin-top: 0.8rem;
          border-top: 1px solid rgba(245, 158, 11, 0.12);
          padding-top: 0.8rem;
        }

        .beam-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
        }

        .sequence {
          min-height: 52px;
        }

        .tokens {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }

        .tok {
          display: inline-flex;
          align-items: center;
          border-radius: 10px;
          border: 1px solid;
          padding: 0.25rem 0.45rem;
          background: rgba(0, 0, 0, 0.18);
        }

        .empty {
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .beam-results {
          margin-top: 0.9rem;
          border-top: 1px solid rgba(245, 158, 11, 0.12);
          padding-top: 0.8rem;
        }

        .beam-results ol {
          margin: 0.3rem 0 0;
          padding-left: 1.2rem;
          color: rgba(255, 255, 255, 0.9);
        }

        .beam-results li {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin: 0.4rem 0;
          flex-wrap: wrap;
        }

        .beam-metric {
          color: var(--text-secondary);
          font-size: 0.85rem;
        }

        .small-btn {
          border-radius: 10px;
          border: 1px solid rgba(20, 184, 166, 0.25);
          background: rgba(20, 184, 166, 0.10);
          color: rgba(255, 255, 255, 0.9);
          padding: 0.35rem 0.6rem;
          cursor: pointer;
        }

        .small-btn:hover {
          border-color: rgba(20, 184, 166, 0.45);
          background: rgba(20, 184, 166, 0.14);
        }

        .stats {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.6rem;
          margin-bottom: 0.8rem;
        }

        .stat {
          border: 1px solid rgba(245, 158, 11, 0.12);
          border-radius: 10px;
          background: rgba(0, 0, 0, 0.2);
          padding: 0.6rem;
        }

        .stat-label {
          font-size: 0.78rem;
          color: var(--text-secondary);
          margin-bottom: 0.2rem;
        }

        .stat-value {
          font-size: 1rem;
          font-weight: 700;
          color: rgba(255, 255, 255, 0.92);
        }

        .stat-sub {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          margin-top: 0.2rem;
        }

        .dist {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .dist-row {
          display: grid;
          grid-template-columns: 170px 1fr 140px;
          gap: 0.6rem;
          align-items: center;
        }

        .dist-row.masked {
          opacity: 0.45;
        }

        .dist-left {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
        }

        .tok-mini {
          display: inline-flex;
          align-items: center;
          border-radius: 10px;
          border: 1px solid;
          padding: 0.2rem 0.4rem;
          background: rgba(0, 0, 0, 0.18);
          min-width: 56px;
          justify-content: center;
        }

        .bar {
          height: 10px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.08);
          border: 1px solid rgba(245, 158, 11, 0.12);
          overflow: hidden;
        }

        .fill {
          height: 100%;
          background: rgba(245, 158, 11, 0.65);
          border-radius: 999px;
        }

        .dist-right {
          color: var(--text-secondary);
          font-size: 0.85rem;
          text-align: right;
        }

        .dist-prob {
          color: rgba(255, 255, 255, 0.85);
          font-size: 0.9rem;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .hint {
          margin-top: 0.9rem;
          padding-top: 0.8rem;
          border-top: 1px solid rgba(245, 158, 11, 0.12);
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.55;
        }

        @media (max-width: 1100px) {
          .layout {
            grid-template-columns: 1fr;
          }

          .scenario-grid {
            grid-template-columns: 1fr;
          }

          .dist-row {
            grid-template-columns: 150px 1fr 120px;
          }
        }
      `}</style>
    </section>
  )
}

