import { useEffect, useMemo, useState } from 'react'

const MATH_COLORS = {
  primary: '#f59e0b',
  secondary: '#14b8a6',
  accent: '#8b5cf6',
}

type Vec2 = [number, number]
type PatternGrid = number[][]

interface ExampleBase {
  id: number
  label: string
  color: string
  trueZ: Vec2
}

interface Example extends ExampleBase {
  basePattern: PatternGrid
}

interface SimulatedExample extends Example {
  mu: Vec2
  sigma: number
  sampleZ: Vec2
  reconPattern: PatternGrid
  reconError: number
  kl: number
}

const GRID_SIZE = 7
const LATENT_WIDTH = 260
const LATENT_HEIGHT = 260
const LATENT_PADDING = 26
const LATENT_RANGE = 3

const ELBO_WIDTH = 260
const ELBO_HEIGHT = 160
const ELBO_PADDING = 24

// Fun beta presets for exploring VAE behavior
const BETA_PRESETS = [
  { name: '🎨 Reconstruction Focus', beta: 0.3, latentDim: 4, description: 'Prioritize reconstruction, looser latent space' },
  { name: '⚖️ Standard VAE', beta: 1.0, latentDim: 2, description: 'Classic β=1 ELBO objective' },
  { name: '📦 β-VAE Light', beta: 4.0, latentDim: 2, description: 'Encourage disentanglement' },
  { name: '🎯 β-VAE Strong', beta: 10.0, latentDim: 2, description: 'Maximum regularization (risk of collapse)' },
  { name: '🔬 High Capacity', beta: 1.0, latentDim: 8, description: 'More latent dimensions' },
];

// Prediction game types and challenges
type GamePhase = 'setup' | 'countdown' | 'revealed'
type BalancePrediction = 'recon' | 'kl' | 'balanced' | null

const BALANCE_CHALLENGES = [
  { name: '🎲 Mystery β=0.5', beta: 0.5, latentDim: 2, description: 'Low regularization...' },
  { name: '🎲 Mystery β=2.5', beta: 2.5, latentDim: 2, description: 'Moderate β-VAE...' },
  { name: '🎲 Mystery β=7.0', beta: 7.0, latentDim: 2, description: 'High regularization...' },
  { name: '🎲 High-D β=1.0', beta: 1.0, latentDim: 6, description: 'More latent dims at standard β...' },
]

function getBalanceFeedback(
  prediction: BalancePrediction,
  avgRecon: number,
  klWeighted: number,
  beta: number
): string {
  const reconHigher = avgRecon > klWeighted * 1.2
  const klHigher = klWeighted > avgRecon * 1.2
  const _isBalanced = !reconHigher && !klHigher

  let winner: BalancePrediction = 'balanced'
  if (reconHigher) winner = 'recon'
  if (klHigher) winner = 'kl'

  const isCorrect = prediction === winner

  if (isCorrect) {
    if (winner === 'recon') {
      return `🎯 Correct! Reconstruction loss dominates (${avgRecon.toFixed(3)} vs ${klWeighted.toFixed(3)}). At β=${beta.toFixed(1)}, the model prioritizes fitting the data over regularizing the latent space.`
    }
    if (winner === 'kl') {
      return `🎯 Correct! β×KL dominates (${klWeighted.toFixed(3)} vs ${avgRecon.toFixed(3)}). High β pushes q(z|x) toward the prior, sacrificing reconstruction fidelity.`
    }
    return `🎯 Correct! They're roughly balanced (recon: ${avgRecon.toFixed(3)}, β×KL: ${klWeighted.toFixed(3)}). This is often the sweet spot for learning!`
  }

  // Wrong prediction
  if (winner === 'recon') {
    return `❌ Reconstruction actually dominates! At β=${beta.toFixed(1)}, the KL penalty is weak enough that the model focuses on fitting the data.`
  }
  if (winner === 'kl') {
    return `❌ β×KL actually dominates! The high β=${beta.toFixed(1)} creates strong regularization pressure - the encoder is being forced toward the prior.`
  }
  return `❌ They're actually balanced! At this β and latent dim, neither term dominates - both contribute roughly equally to the ELBO.`
}

// Educational insight based on current state
const getVAEInsight = (
  beta: number,
  avgRecon: number,
  avgKl: number,
  _latentDim: number
): string => {
  const _klReconRatio = avgKl / (avgRecon + 0.001);

  if (beta < 0.5) {
    return '🎨 Very low β: Almost ignoring the KL term. Reconstructions are sharp, but latent space is disorganized - no guarantee of smooth interpolation!';
  }

  if (beta >= 0.5 && beta < 1.5) {
    if (avgRecon < 0.05) {
      return '✨ Sweet spot! Good reconstructions AND regularized latent space. This is where most practical VAEs operate.';
    }
    return '📚 Standard ELBO (β≈1): Balancing reconstruction and KL equally. The VAE learns to compress data while keeping latent space close to N(0,I).';
  }

  if (beta >= 1.5 && beta < 5) {
    return '🔄 β-VAE regime: Stronger KL penalty encourages disentangled representations. Good for learning interpretable factors of variation!';
  }

  if (beta >= 5 && beta < 8) {
    return '⚠️ High β: Heavy regularization is pulling q(z|x) toward the prior. Watch the ellipses shrink toward the origin. Reconstruction quality may suffer.';
  }

  if (beta >= 8) {
    if (avgKl < 0.05) {
      return '💥 Danger zone: Posterior collapse! KL → 0 means q(z|x) ≈ p(z) for all x. The encoder is ignoring the input - z carries no information!';
    }
    return '🎯 Very high β: Extreme regularization. If training continues, this risks posterior collapse where z becomes uninformative.';
  }

  return '💡 The ELBO trades off reconstruction (how well x̂ matches x) vs KL (how close q(z|x) is to the prior).';
};

const BASE_EXAMPLES: ExampleBase[] = [
  { id: 0, label: 'Cluster A', color: MATH_COLORS.primary, trueZ: [-2.2, -0.8] },
  { id: 1, label: 'Cluster A', color: MATH_COLORS.primary, trueZ: [-2.0, 0.4] },
  { id: 2, label: 'Cluster A', color: MATH_COLORS.primary, trueZ: [-1.6, 1.0] },
  { id: 3, label: 'Cluster B', color: MATH_COLORS.secondary, trueZ: [-0.2, 2.2] },
  { id: 4, label: 'Cluster B', color: MATH_COLORS.secondary, trueZ: [0.6, 1.6] },
  { id: 5, label: 'Cluster B', color: MATH_COLORS.secondary, trueZ: [0.0, 1.0] },
  { id: 6, label: 'Cluster C', color: MATH_COLORS.accent, trueZ: [2.1, -1.8] },
  { id: 7, label: 'Cluster C', color: MATH_COLORS.accent, trueZ: [1.5, -0.6] },
  { id: 8, label: 'Cluster C', color: MATH_COLORS.accent, trueZ: [2.4, 0.0] },
]

// ---------- Math / utility helpers ----------

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v))
}

function createRng(seed: number): () => number {
  let value = seed % 2147483647
  if (value <= 0) value += 2147483646
  return () => {
    value = (value * 16807) % 2147483647
    return (value - 1) / 2147483646
  }
}

function randomNormal(rng: () => number): number {
  // Box–Muller
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function decodePattern(z: Vec2): PatternGrid {
  // Tiny decoder: maps 2D latent z -> 7x7 grayscale "blob + stripes" pattern
  const [zx, zy] = z
  const centerX = clamp01((zx / 2.5 + 1) / 2) * 2 - 1 // clamp to [-1, 1]
  const centerY = clamp01((zy / 2.5 + 1) / 2) * 2 - 1

  const grid: PatternGrid = []
  const radius = 0.7

  const orientationMix = 0.5 + 0.5 * Math.tanh(zy) // 0..1
  const sharpness = 6

  for (let i = 0; i < GRID_SIZE; i++) {
    const row: number[] = []
    const v = (i / (GRID_SIZE - 1)) * 2 - 1 // [-1,1]
    for (let j = 0; j < GRID_SIZE; j++) {
      const u = (j / (GRID_SIZE - 1)) * 2 - 1

      const dx = u - centerX
      const dy = v - centerY
      const dist2 = dx * dx + dy * dy

      // Round "blob" around (centerX, centerY)
      const blob = Math.exp(-dist2 / (2 * radius * radius))

      // Vertical / horizontal stripes that depend on zy
      const stripeX = Math.exp(-(dx * dx) * sharpness) * 0.6
      const stripeY = Math.exp(-(dy * dy) * sharpness) * 0.6

      const value = clamp01(blob + orientationMix * stripeX + (1 - orientationMix) * stripeY)
      row.push(value)
    }
    grid.push(row)
  }
  return grid
}

function patternMSE(a: PatternGrid, b: PatternGrid): number {
  let sum = 0
  const n = GRID_SIZE * GRID_SIZE
  for (let i = 0; i < GRID_SIZE; i++) {
    for (let j = 0; j < GRID_SIZE; j++) {
      const diff = a[i][j] - b[i][j]
      sum += diff * diff
    }
  }
  return sum / n
}

function latentToSvg([zx, zy]: Vec2): { x: number; y: number } {
  const usableWidth = LATENT_WIDTH - 2 * LATENT_PADDING
  const usableHeight = LATENT_HEIGHT - 2 * LATENT_PADDING

  const tX = (zx + LATENT_RANGE) / (2 * LATENT_RANGE)
  const tY = (zy + LATENT_RANGE) / (2 * LATENT_RANGE)

  const x = LATENT_PADDING + tX * usableWidth
  const y = LATENT_HEIGHT - (LATENT_PADDING + tY * usableHeight)
  return { x, y }
}

function grayFromValue(v: number): string {
  const g = Math.round(255 - v * 180) // 0 -> light, 1 -> darker
  return `rgb(${g}, ${g}, ${g})`
}

// ---------- Small presentational helpers ----------

function PatternView({
  grid,
  title,
}: {
  grid: PatternGrid
  title: string
}) {
  const size = 112
  const cell = size / GRID_SIZE
  return (
    <svg
      width={size}
      height={size}
      className="vae-pattern"
      role="img"
      aria-label={title}
    >
      <rect x={0} y={0} width={size} height={size} fill="#ffffff" />
      {grid.map((row, i) =>
        row.map((v, j) => (
          <rect
            key={`${i}-${j}`}
            x={j * cell}
            y={i * cell}
            width={cell}
            height={cell}
            fill={grayFromValue(v)}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth={0.5}
          />
        )),
      )}
    </svg>
  )
}

// ---------- Main component ----------

export default function VAEElboDemo() {
  const examples = useMemo<Example[]>(
    () =>
      BASE_EXAMPLES.map((ex) => ({
        ...ex,
        basePattern: decodePattern(ex.trueZ),
      })),
    [],
  )

  const [beta, setBeta] = useState(1.0)
  const [latentDim, setLatentDim] = useState(2)
  const [showPrior, setShowPrior] = useState(true)
  const [sampleSeed, setSampleSeed] = useState(0)
  const [interpT, setInterpT] = useState(0.5)
  const [flowStep, setFlowStep] = useState(0)
  const [isAnimatingFlow, setIsAnimatingFlow] = useState(false)

  const [selectedExampleId, setSelectedExampleId] = useState(
    examples[0]?.id ?? 0,
  )
  const [interpPair, setInterpPair] = useState<[number, number]>([
    examples[0]?.id ?? 0,
    examples[3]?.id ?? (examples[1]?.id ?? 0),
  ])

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<BalancePrediction>(null)
  const [activeChallenge, setActiveChallenge] = useState<typeof BALANCE_CHALLENGES[0] | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [gameScore, setGameScore] = useState(0)
  const [gameStreak, setGameStreak] = useState(0)

  // Simple forward-pass animation for the encoder/decoder diagram
  useEffect(() => {
    if (!isAnimatingFlow) return
    const id = setInterval(() => {
      setFlowStep((prev) => (prev + 1) % 4)
    }, 800)
    return () => clearInterval(id)
  }, [isAnimatingFlow])

  // Simulate how β and latentDim shape q(z|x), ELBO terms, and reconstructions
  const simulation = useMemo(() => {
    const betaNormRaw = (beta - 0.1) / 9.9
    const betaNorm = clamp01(betaNormRaw)
    const capacity = latentDim / 8 // 0.25..1 for dim in [2,8]

    // High β -> shrink μ towards 0, especially with small capacity
    const shrinkBase = 0.25 + 0.35 * capacity // base shrink at β max
    const shrink = 1 - betaNorm * (1 - shrinkBase)

    // High β -> variance closer to prior (σ ≈ 1)
    const sigma = 0.5 + 0.4 * betaNorm // 0.5..0.9

    const rng = createRng(1337 + sampleSeed)

    const simExamples: SimulatedExample[] = examples.map((ex) => {
      const mu: Vec2 = [ex.trueZ[0] * shrink, ex.trueZ[1] * shrink]

      const epsX = randomNormal(rng)
      const epsY = randomNormal(rng)
      const sampleZ: Vec2 = [mu[0] + sigma * epsX, mu[1] + sigma * epsY]

      const reconPattern = decodePattern(mu)
      const reconError = patternMSE(ex.basePattern, reconPattern)

      const muNormSq = mu[0] * mu[0] + mu[1] * mu[1]
      const sigma2 = sigma * sigma
      const perDim = sigma2 - 1 - Math.log(sigma2)

      // KL(qϕ(z|x) || p(z)) for diag Gaussian vs N(0, I)
      // Use latentDim even though we only visualize first 2 dims
      const kl = 0.5 * (muNormSq + latentDim * perDim)

      return {
        ...ex,
        mu,
        sigma,
        sampleZ,
        reconPattern,
        reconError,
        kl,
      }
    })

    const avgRecon =
      simExamples.reduce((acc, e) => acc + e.reconError, 0) /
      simExamples.length
    const avgKl =
      simExamples.reduce((acc, e) => acc + e.kl, 0) / simExamples.length

    const klWeighted = beta * avgKl
    const elboLowerBound = -(avgRecon + klWeighted) // negative "loss"

    return {
      simExamples,
      avgRecon,
      avgKl,
      klWeighted,
      elboLowerBound,
      betaNorm,
      sigma,
    }
  }, [beta, latentDim, sampleSeed, examples])

  const { simExamples, avgRecon, avgKl, klWeighted, elboLowerBound, betaNorm: _betaNorm } =
    simulation

  const selectedExample =
    simExamples.find((e) => e.id === selectedExampleId) ?? simExamples[0]

  const interpA =
    simExamples.find((e) => e.id === interpPair[0]) ?? simExamples[0]
  const interpB =
    simExamples.find((e) => e.id === interpPair[1]) ??
    simExamples[1] ??
    simExamples[0]

  const interpZ: Vec2 = [
    (1 - interpT) * interpA.mu[0] + interpT * interpB.mu[0],
    (1 - interpT) * interpA.mu[1] + interpT * interpB.mu[1],
  ]
  const interpPattern = decodePattern(interpZ)

  const latentUnitX =
    (LATENT_WIDTH - 2 * LATENT_PADDING) / (2 * LATENT_RANGE)
  const latentUnitY =
    (LATENT_HEIGHT - 2 * LATENT_PADDING) / (2 * LATENT_RANGE)

  const maxBar = Math.max(avgRecon, klWeighted, 1e-4)
  const reconHeight =
    ((avgRecon / maxBar) * (ELBO_HEIGHT - 2 * ELBO_PADDING)) || 0
  const klHeight =
    ((klWeighted / maxBar) * (ELBO_HEIGHT - 2 * ELBO_PADDING)) || 0

  let regimeText = ''
  if (beta < 0.7) {
    regimeText =
      'Low β: model mostly cares about reconstruction. Latent points drift away from the prior and KL is small.'
  } else if (beta < 3) {
    regimeText =
      'Medium β: reconstruction and KL are balanced. Latent space organizes into smooth, class-aware clusters.'
  } else {
    regimeText =
      'High β: strong regularization pulls q(z|x) toward the prior. Latents cluster near the origin and reconstructions get blurrier—if β is too large you approach posterior collapse (z carries almost no information about x).'
  }

  const handleExampleClick = (id: number) => {
    setSelectedExampleId(id)
    setInterpPair(([a, b]) => (id === a ? [a, b] : [id, a]))
  }

  const toggleFlowAnimation = () => {
    setIsAnimatingFlow((v) => !v)
  }

  // Game control functions
  const startChallenge = (challenge: typeof BALANCE_CHALLENGES[0]) => {
    setActiveChallenge(challenge)
    setBeta(challenge.beta)
    setLatentDim(challenge.latentDim)
    setGamePhase('setup')
    setPrediction(null)
  }

  const confirmPrediction = () => {
    if (!prediction || !activeChallenge) return
    setGamePhase('countdown')
    setCountdown(3)
  }

  const resetGame = () => {
    setGamePhase('setup')
    setPrediction(null)
    setActiveChallenge(null)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      // Reveal and score
      setGamePhase('revealed')
      const reconHigher = avgRecon > klWeighted * 1.2
      const klHigher = klWeighted > avgRecon * 1.2
      let winner: BalancePrediction = 'balanced'
      if (reconHigher) winner = 'recon'
      if (klHigher) winner = 'kl'

      if (prediction === winner) {
        setGameScore(s => s + 10 + gameStreak * 2)
        setGameStreak(s => s + 1)
      } else {
        setGameStreak(0)
      }
    }
  }, [gamePhase, countdown, avgRecon, klWeighted, prediction, gameStreak])

  return (
    <section className="card interactive-card">
      <h2>VAE ELBO Playground</h2>
      <p className="muted">
        Explore how a Variational Autoencoder balances reconstruction and
        regularization. Each point is an input x encoded into a 2D latent
        Gaussian q<sub>ϕ</sub>(z|x) with the ELBO decomposed into reconstruction
        and KL terms.
      </p>

      {/* Beta Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {BETA_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              setBeta(preset.beta);
              setLatentDim(preset.latentDim);
            }}
            disabled={gamePhase === 'countdown'}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: Math.abs(beta - preset.beta) < 0.2 && latentDim === preset.latentDim
                ? '2px solid #f59e0b'
                : '1px solid #374151',
              background: Math.abs(beta - preset.beta) < 0.2 && latentDim === preset.latentDim
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: Math.abs(beta - preset.beta) < 0.2 && latentDim === preset.latentDim ? '#f59e0b' : '#9ca3af',
              cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
              opacity: gamePhase === 'countdown' ? 0.5 : 1,
              fontSize: '12px',
              fontWeight: Math.abs(beta - preset.beta) < 0.2 && latentDim === preset.latentDim ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* 🎯 ELBO Balance Challenge */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.05))',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              🎯 <strong>ELBO Balance Challenge:</strong> Which term dominates at mystery β?
            </span>
            {(gameScore > 0 || gameStreak > 0) && (
              <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem' }}>
                <span>Score: <strong style={{ color: '#f59e0b' }}>{gameScore}</strong></span>
                <span>Streak: <strong style={{ color: gameStreak > 0 ? '#22c55e' : '#9ca3af' }}>{gameStreak}🔥</strong></span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {BALANCE_CHALLENGES.map(challenge => (
              <button
                key={challenge.name}
                onClick={() => startChallenge(challenge)}
                disabled={gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge?.name === challenge.name
                    ? 'rgba(139, 92, 246, 0.3)'
                    : 'rgba(139, 92, 246, 0.1)',
                  border: `1px solid ${activeChallenge?.name === challenge.name ? '#8b5cf6' : 'rgba(139, 92, 246, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={challenge.description}
              >
                {challenge.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase - make prediction */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Settings: <strong>β = {activeChallenge.beta}</strong>, <strong>latent dim = {activeChallenge.latentDim}</strong>
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>Which term will be higher: Reconstruction Loss or β×KL?</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              <button
                onClick={() => setPrediction('recon')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'recon' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(245, 158, 11, 0.15)',
                  border: `2px solid ${prediction === 'recon' ? '#f59e0b' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                🎨 Reconstruction Higher
              </button>
              <button
                onClick={() => setPrediction('kl')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'kl' ? 'rgba(139, 92, 246, 0.4)' : 'rgba(139, 92, 246, 0.15)',
                  border: `2px solid ${prediction === 'kl' ? '#8b5cf6' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                📦 β×KL Higher
              </button>
              <button
                onClick={() => setPrediction('balanced')}
                style={{
                  padding: '8px 16px',
                  background: prediction === 'balanced' ? 'rgba(20, 184, 166, 0.4)' : 'rgba(20, 184, 166, 0.15)',
                  border: `2px solid ${prediction === 'balanced' ? '#14b8a6' : 'transparent'}`,
                  borderRadius: '8px',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                  fontSize: '0.85rem',
                }}
              >
                ⚖️ Roughly Balanced
              </button>
            </div>
            {prediction && (
              <button
                onClick={confirmPrediction}
                style={{
                  padding: '8px 20px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: 'pointer',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                }}
              >
                🔍 Reveal!
              </button>
            )}
          </div>
        )}

        {/* Countdown phase */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{ fontSize: '3rem', fontWeight: 'bold', color: '#8b5cf6' }}>
              {countdown}
            </div>
            <p style={{ color: '#9ca3af' }}>Calculating ELBO...</p>
          </div>
        )}

        {/* Revealed phase */}
        {gamePhase === 'revealed' && activeChallenge && prediction && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.2)',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '0.9rem' }}>
                <span style={{ color: '#f59e0b' }}>🎨 Recon: <strong>{avgRecon.toFixed(3)}</strong></span>
                <span style={{ margin: '0 16px', color: '#9ca3af' }}>vs</span>
                <span style={{ color: '#8b5cf6' }}>📦 β×KL: <strong>{klWeighted.toFixed(3)}</strong></span>
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: avgRecon > klWeighted * 1.2 ? '#f59e0b' : klWeighted > avgRecon * 1.2 ? '#8b5cf6' : '#14b8a6'
              }}>
                {avgRecon > klWeighted * 1.2 ? '🎨 Recon Wins!' : klWeighted > avgRecon * 1.2 ? '📦 KL Wins!' : '⚖️ Balanced!'}
              </div>
            </div>
            <div style={{
              padding: '12px',
              borderRadius: '8px',
              background: (() => {
                const reconHigher = avgRecon > klWeighted * 1.2
                const klHigher = klWeighted > avgRecon * 1.2
                let winner: BalancePrediction = 'balanced'
                if (reconHigher) winner = 'recon'
                if (klHigher) winner = 'kl'
                return prediction === winner ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'
              })(),
              marginBottom: '12px',
            }}>
              <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6 }}>
                {getBalanceFeedback(prediction, avgRecon, klWeighted, activeChallenge.beta)}
              </p>
            </div>
            <button
              onClick={resetGame}
              style={{
                padding: '8px 20px',
                background: '#8b5cf6',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Try Another Challenge →
            </button>
          </div>
        )}

        {!activeChallenge && (
          <p style={{ fontSize: '0.85rem', color: '#9ca3af', margin: 0 }}>
            Select a mystery β challenge above to predict the ELBO balance!
          </p>
        )}
      </div>

      {/* Dynamic Educational Insight */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: beta < 1.5
          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(34, 197, 94, 0.04))'
          : beta < 5
            ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(139, 92, 246, 0.04))'
            : 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
        border: `1px solid ${beta < 1.5 ? '#22c55e' : beta < 5 ? '#8b5cf6' : '#ef4444'}40`,
        fontSize: '14px',
        lineHeight: '1.5',
      }}>
        {getVAEInsight(beta, avgRecon, avgKl, latentDim)}
      </div>

      {/* Global controls */}
      <div className="vae-controls">
        <label className="slider-label">
          β (KL weight) ({beta.toFixed(2)})
          <input
            type="range"
            min={0.1}
            max={10}
            step={0.1}
            value={beta}
            onChange={(e) => setBeta(parseFloat(e.target.value))}
          />
        </label>
        <label className="slider-label">
          Latent dimension (toy) ({latentDim}d)
          <input
            type="range"
            min={2}
            max={8}
            step={1}
            value={latentDim}
            onChange={(e) => setLatentDim(parseInt(e.target.value, 10))}
          />
        </label>
        <label className="slider-label vae-toggle">
          <input
            type="checkbox"
            checked={showPrior}
            onChange={(e) => setShowPrior(e.target.checked)}
          />{' '}
          Show prior p(z) = N(0, I)
        </label>
        <button
          type="button"
          className="ghost"
          onClick={() => setSampleSeed((s) => s + 1)}
        >
          Sample new z from q(z|x)
        </button>
      </div>

      <div className="vae-layout">
        {/* Row 1: Latent space + ELBO decomposition */}
        <div className="vae-row">
          <div className="vae-panel">
            <h3>Latent space qϕ(z|x)</h3>
            <p className="caption">
              Ellipses show the encoded Gaussian for each x. The circle is the
              prior p(z) = N(0, I). Colored dots are sampled z using the
              reparameterization trick.
            </p>
            <svg
              width={LATENT_WIDTH}
              height={LATENT_HEIGHT}
              className="vae-latent-chart"
              role="img"
              aria-label="2D latent space showing posterior ellipses, samples, and prior"
            >
              {/* Axes */}
              <line
                x1={LATENT_PADDING}
                y1={LATENT_HEIGHT / 2}
                x2={LATENT_WIDTH - LATENT_PADDING}
                y2={LATENT_HEIGHT / 2}
                className="axis-line"
              />
              <line
                x1={LATENT_WIDTH / 2}
                y1={LATENT_PADDING}
                x2={LATENT_WIDTH / 2}
                y2={LATENT_HEIGHT - LATENT_PADDING}
                className="axis-line"
              />

              {/* Prior circle */}
              {showPrior && (
                <circle
                  cx={LATENT_WIDTH / 2}
                  cy={LATENT_HEIGHT / 2}
                  r={latentUnitX}
                  stroke="rgba(148,163,184,0.8)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  fill="none"
                />
              )}

              {/* Posterior ellipses and samples */}
              {simExamples.map((ex) => {
                const meanPos = latentToSvg(ex.mu)
                const samplePos = latentToSvg(ex.sampleZ)
                const isSelected = ex.id === selectedExample.id

                return (
                  <g
                    key={ex.id}
                    className="vae-latent-point"
                    onClick={() => handleExampleClick(ex.id)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* 1σ ellipse for q(z|x) */}
                    <ellipse
                      cx={meanPos.x}
                      cy={meanPos.y}
                      rx={ex.sigma * latentUnitX}
                      ry={ex.sigma * latentUnitY}
                      fill="none"
                      stroke={ex.color}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeOpacity={isSelected ? 0.9 : 0.6}
                    />
                    {/* Mean point */}
                    <circle
                      cx={meanPos.x}
                      cy={meanPos.y}
                      r={isSelected ? 4.5 : 3.5}
                      fill="#ffffff"
                      stroke={ex.color}
                      strokeWidth={isSelected ? 2 : 1.5}
                    />
                    {/* Sampled z */}
                    <circle
                      cx={samplePos.x}
                      cy={samplePos.y}
                      r={3}
                      fill={ex.color}
                      fillOpacity={0.85}
                    />
                    <title>
                      {ex.label} — click to focus this example in the
                      reconstruction & flow views
                    </title>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="vae-panel">
            <h3>ELBO: reconstruction vs KL</h3>
            <p className="caption">
              ELBO ≈ −(reconstruction loss + β · KL). β scales the KL term, so
              increasing β tightens the latent space but hurts reconstruction.
            </p>
            <svg
              width={ELBO_WIDTH}
              height={ELBO_HEIGHT}
              className="vae-elbo-chart"
              role="img"
              aria-label="Bar chart of reconstruction loss and beta-scaled KL divergence"
            >
              {/* Axis */}
              <line
                x1={ELBO_PADDING}
                y1={ELBO_HEIGHT - ELBO_PADDING}
                x2={ELBO_WIDTH - ELBO_PADDING}
                y2={ELBO_HEIGHT - ELBO_PADDING}
                className="axis-line"
              />

              {/* Reconstruction bar */}
              <rect
                x={ELBO_PADDING + 20}
                y={ELBO_HEIGHT - ELBO_PADDING - reconHeight}
                width={60}
                height={reconHeight}
                fill={MATH_COLORS.primary}
                fillOpacity={0.9}
              />
              <text
                x={ELBO_PADDING + 50}
                y={ELBO_HEIGHT - ELBO_PADDING - reconHeight - 6}
                textAnchor="middle"
                className="axis-label"
              >
                Recon
              </text>

              {/* KL bar (β · KL) */}
              <rect
                x={ELBO_PADDING + 120}
                y={ELBO_HEIGHT - ELBO_PADDING - klHeight}
                width={60}
                height={klHeight}
                fill={MATH_COLORS.accent}
                fillOpacity={0.9}
              />
              <text
                x={ELBO_PADDING + 150}
                y={ELBO_HEIGHT - ELBO_PADDING - klHeight - 6}
                textAnchor="middle"
                className="axis-label"
              >
                β · KL
              </text>
            </svg>
            <div className="vae-elbo-stats">
              <div>
                <span className="label">Avg recon loss:</span>{' '}
                {avgRecon.toFixed(3)}
              </div>
              <div>
                <span className="label">Avg KL:</span> {avgKl.toFixed(3)}
              </div>
              <div>
                <span className="label">β · KL:</span> {klWeighted.toFixed(3)}
              </div>
              <div>
                <span className="label">ELBO (toy lower bound):</span>{' '}
                {elboLowerBound.toFixed(3)}
              </div>
            </div>
            <p className="caption">{regimeText}</p>
          </div>
        </div>

        {/* Row 2: Encoder/decoder flow + reconstruction & interpolation */}
        <div className="vae-row">
          <div className="vae-panel vae-flow-panel">
            <h3>Encoder / decoder flow</h3>
            <p className="caption">
              Click an example in the latent space to focus it here. The
              reparameterization trick samples z = μ(x) + σ(x) ⊙ ε so gradients
              can flow through μ and σ.
            </p>
            <div className="vae-flow-diagram">
              <FlowNode
                label="Input x"
                description="small image or pattern"
                active={flowStep === 0}
              />
              <FlowArrow />
              <FlowNode
                label="Encoder qϕ(z|x)"
                description="outputs μ(x), σ(x)"
                active={flowStep === 1}
              />
              <FlowArrow />
              <FlowNode
                label="Sample z"
                description="z = μ + σ ⊙ ε"
                active={flowStep === 2}
              />
              <FlowArrow />
              <FlowNode
                label="Decoder pθ(x|z)"
                description="reconstructs x̂"
                active={flowStep === 3}
              />
            </div>
            <button
              type="button"
              className="ghost"
              onClick={toggleFlowAnimation}
            >
              {isAnimatingFlow ? 'Pause flow animation' : 'Animate forward pass'}
            </button>

            <div className="vae-flow-numbers">
              <div>
                <span className="label">Focused example:</span>{' '}
                {selectedExample.label}
              </div>
              <div>
                <span className="label">μ(x):</span>{' '}
                ({selectedExample.mu[0].toFixed(2)},{' '}
                {selectedExample.mu[1].toFixed(2)})
              </div>
              <div>
                <span className="label">σ(x):</span>{' '}
                {selectedExample.sigma.toFixed(2)}
              </div>
              <div>
                <span className="label">Sampled z:</span>{' '}
                ({selectedExample.sampleZ[0].toFixed(2)},{' '}
                {selectedExample.sampleZ[1].toFixed(2)})
              </div>
            </div>
          </div>

          <div className="vae-panel vae-recon-panel">
            <h3>Reconstruction & latent interpolation</h3>
            <div className="vae-recon-layout">
              <div className="vae-recon-column">
                <div className="vae-recon-pair">
                  <div className="vae-recon-item">
                    <span className="label">Original x</span>
                    <PatternView
                      grid={selectedExample.basePattern}
                      title="Original input pattern"
                    />
                  </div>
                  <div className="vae-recon-item">
                    <span className="label">Reconstruction x̂</span>
                    <PatternView
                      grid={selectedExample.reconPattern}
                      title="Reconstructed pattern"
                    />
                  </div>
                </div>
                <p className="caption">
                  Reconstruction error for this example:{' '}
                  <strong>{selectedExample.reconError.toFixed(3)}</strong>
                </p>
              </div>

              <div className="vae-recon-column">
                <div className="vae-interp-header">
                  <span className="label">Latent interpolation</span>
                  <p className="caption">
                    Click two different points in the latent space. Then slide
                    between them in z to see how the decoder morphs the pattern.
                  </p>
                </div>
                <div className="vae-interp-endpoints">
                  <div>
                    <span className="label">Endpoint A:</span>{' '}
                    {interpA.label}
                  </div>
                  <div>
                    <span className="label">Endpoint B:</span>{' '}
                    {interpB.label}
                  </div>
                </div>
                <label className="slider-label">
                  Interpolation t ({interpT.toFixed(2)})
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={interpT}
                    onChange={(e) => setInterpT(parseFloat(e.target.value))}
                  />
                </label>
                <PatternView
                  grid={interpPattern}
                  title="Interpolated decoded pattern"
                />
                <p className="caption">
                  In a well-behaved VAE, moving smoothly in z should produce
                  smooth, semantic changes in the decoded x̂. β-VAEs push q(z|x)
                  toward a structured, disentangled latent space where this
                  interpolation behaves nicely.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ---------- Small internal components for flow diagram ----------

function FlowNode({
  label,
  description,
  active,
}: {
  label: string
  description: string
  active: boolean
}) {
  return (
    <div className={`vae-flow-node ${active ? 'active' : ''}`}>
      <div className="vae-flow-node-label">{label}</div>
      <div className="vae-flow-node-desc">{description}</div>
    </div>
  )
}

function FlowArrow() {
  return <div className="vae-flow-arrow">➜</div>
}
