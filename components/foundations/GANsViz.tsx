'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import { scaleLinear, line as d3Line, curveMonotoneX, area as d3Area } from 'd3'
import { MATH_COLORS } from '../../lib/mathObjects'

type GamePhase = 'setup' | 'countdown' | 'reveal'
type TrainingPrediction = 'mode_collapse' | 'oscillation' | 'convergence' | 'vanishing_gradients'
type DivergenceType = 'js' | 'wasserstein'

interface PredictionChallenge {
  name: string
  divergenceType: DivergenceType
  discriminatorStrength: number // 0-1, how good the discriminator is
  generatorLR: number
  correctAnswer: TrainingPrediction
  hint: string
  explanation: string
}

const PREDICTION_CHALLENGES: PredictionChallenge[] = [
  {
    name: '🎯 Mystery #1',
    divergenceType: 'js',
    discriminatorStrength: 0.95,
    generatorLR: 0.1,
    correctAnswer: 'vanishing_gradients',
    hint: 'JS divergence + very strong discriminator',
    explanation: 'With JS divergence, when D is too good, log(1 - D(G(z))) → 0, giving G no gradient signal!'
  },
  {
    name: '🎯 Mystery #2',
    divergenceType: 'js',
    discriminatorStrength: 0.3,
    generatorLR: 0.5,
    correctAnswer: 'mode_collapse',
    hint: 'Weak discriminator + aggressive generator',
    explanation: 'G finds one mode that fools weak D and exploits it, collapsing diversity.'
  },
  {
    name: '🎯 Mystery #3',
    divergenceType: 'wasserstein',
    discriminatorStrength: 0.9,
    generatorLR: 0.2,
    correctAnswer: 'convergence',
    hint: 'Wasserstein distance provides smooth gradients everywhere',
    explanation: 'WGAN\'s Earth-Mover distance gives useful gradients even when distributions don\'t overlap!'
  },
  {
    name: '🎯 Mystery #4',
    divergenceType: 'js',
    discriminatorStrength: 0.6,
    generatorLR: 0.4,
    correctAnswer: 'oscillation',
    hint: 'Evenly matched with JS divergence',
    explanation: 'G and D chase each other without converging — the classic GAN training instability.'
  },
  {
    name: '🎯 Mystery #5',
    divergenceType: 'wasserstein',
    discriminatorStrength: 0.5,
    generatorLR: 0.3,
    correctAnswer: 'convergence',
    hint: 'Balanced training with Wasserstein',
    explanation: 'WGAN with balanced training provides stable convergence and meaningful loss curves.'
  },
]

const PREDICTION_OPTIONS: { id: TrainingPrediction; label: string; emoji: string }[] = [
  { id: 'convergence', label: 'Stable Convergence', emoji: '✅' },
  { id: 'mode_collapse', label: 'Mode Collapse', emoji: '📍' },
  { id: 'oscillation', label: 'Oscillation', emoji: '〰️' },
  { id: 'vanishing_gradients', label: 'Vanishing Gradients', emoji: '💨' },
]

// Presets for different training scenarios
type ScenarioPreset = 'balanced' | 'strong_d' | 'weak_d' | 'wgan'

const SCENARIO_PRESETS: Record<ScenarioPreset, {
  name: string
  emoji: string
  description: string
  divergenceType: DivergenceType
  discriminatorStrength: number
  generatorLR: number
}> = {
  balanced: {
    name: 'Balanced Training',
    emoji: '⚖️',
    description: 'Equal G/D capacity',
    divergenceType: 'js',
    discriminatorStrength: 0.5,
    generatorLR: 0.3
  },
  strong_d: {
    name: 'Strong Discriminator',
    emoji: '🛡️',
    description: 'D dominates → vanishing gradients',
    divergenceType: 'js',
    discriminatorStrength: 0.9,
    generatorLR: 0.2
  },
  weak_d: {
    name: 'Weak Discriminator',
    emoji: '🎭',
    description: 'G exploits D → mode collapse',
    divergenceType: 'js',
    discriminatorStrength: 0.2,
    generatorLR: 0.5
  },
  wgan: {
    name: 'Wasserstein GAN',
    emoji: '🌊',
    description: 'Earth-Mover distance',
    divergenceType: 'wasserstein',
    discriminatorStrength: 0.7,
    generatorLR: 0.25
  },
}

// Generate 1D distribution samples
const generateDistribution = (
  mean: number,
  std: number,
  nSamples: number
): number[] => {
  const samples: number[] = []
  for (let i = 0; i < nSamples; i++) {
    // Box-Muller transform
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    samples.push(mean + std * z)
  }
  return samples
}

// Compute histogram from samples
const computeHistogram = (
  samples: number[],
  bins: number,
  xMin: number,
  xMax: number
): number[] => {
  const histogram = new Array(bins).fill(0)
  const binWidth = (xMax - xMin) / bins

  for (const sample of samples) {
    const binIndex = Math.floor((sample - xMin) / binWidth)
    if (binIndex >= 0 && binIndex < bins) {
      histogram[binIndex]++
    }
  }

  // Normalize
  const maxCount = Math.max(...histogram)
  return maxCount > 0 ? histogram.map(c => c / maxCount) : histogram
}

// Simulate GAN training dynamics
const simulateTraining = (
  divergenceType: DivergenceType,
  discriminatorStrength: number,
  generatorLR: number,
  steps: number
): {
  generatorLoss: number[]
  discriminatorLoss: number[]
  realDistMean: number
  genDistMeans: number[] // Generator distribution mean over time
  genDistStds: number[] // Generator distribution std over time
  outcome: TrainingPrediction
} => {
  const realMean = 0
  const realStd = 1

  let genMean = 3 // Start far from real data
  let genStd = 0.5

  const gLoss: number[] = []
  const dLoss: number[] = []
  const genMeans: number[] = [genMean]
  const genStds: number[] = [genStd]

  // Track oscillation
  let oscillationCount = 0
  let lastDirection = 0

  for (let step = 0; step < steps; step++) {
    // Discriminator's ability to distinguish
    const overlap = Math.exp(-Math.abs(genMean - realMean) / (realStd + genStd))

    if (divergenceType === 'js') {
      // JS divergence behavior
      const dAccuracy = discriminatorStrength * (1 - overlap) + 0.5 * overlap
      dLoss.push(1 - dAccuracy)

      // Generator gradient based on D accuracy
      if (dAccuracy > 0.9) {
        // Vanishing gradient regime
        gLoss.push(gLoss.length > 0 ? gLoss[gLoss.length - 1] : 2)
        genMean += (Math.random() - 0.5) * 0.05 // Random walk
      } else {
        // Some gradient signal
        const gradient = generatorLR * (realMean - genMean) * (1 - dAccuracy)
        const prevMean = genMean
        genMean += gradient + (Math.random() - 0.5) * 0.1

        // Track direction changes for oscillation
        const direction = Math.sign(genMean - prevMean)
        if (direction !== 0 && direction !== lastDirection && lastDirection !== 0) {
          oscillationCount++
        }
        lastDirection = direction

        gLoss.push(Math.log(1 + Math.abs(genMean - realMean)))
      }

      // Mode collapse: std shrinks under weak D
      if (discriminatorStrength < 0.4 && overlap > 0.3) {
        genStd *= 0.95
      }
    } else {
      // Wasserstein behavior - smooth gradients everywhere
      const wassDist = Math.abs(genMean - realMean) + Math.abs(genStd - realStd)
      dLoss.push(wassDist)

      // Stable gradient from Wasserstein
      const gradient = generatorLR * (realMean - genMean) * 0.5
      genMean += gradient
      genStd += 0.02 * (realStd - genStd) // Also match std

      gLoss.push(wassDist)
    }

    genMeans.push(genMean)
    genStds.push(Math.max(0.1, genStd))
  }

  // Determine outcome
  let outcome: TrainingPrediction
  const finalDistance = Math.abs(genMean - realMean)
  const finalStd = genStds[genStds.length - 1]

  if (finalStd < 0.2) {
    outcome = 'mode_collapse'
  } else if (oscillationCount > steps / 4) {
    outcome = 'oscillation'
  } else if (divergenceType === 'js' && discriminatorStrength > 0.85) {
    outcome = 'vanishing_gradients'
  } else if (finalDistance < 0.5 && finalStd > 0.5) {
    outcome = 'convergence'
  } else if (oscillationCount > steps / 6) {
    outcome = 'oscillation'
  } else {
    outcome = 'convergence'
  }

  return {
    generatorLoss: gLoss,
    discriminatorLoss: dLoss,
    realDistMean: realMean,
    genDistMeans: genMeans,
    genDistStds: genStds,
    outcome
  }
}

export default function GANsViz() {
  // Visualization dimensions
  const width = 700
  const height = 500
  const margin = { top: 40, right: 30, bottom: 50, left: 50 }
  const plotWidth = width - margin.left - margin.right
  const plotHeight = (height - margin.top - margin.bottom - 40) / 2 // Two plots

  // State
  const [selectedPreset, setSelectedPreset] = useState<ScenarioPreset>('balanced')
  const [divergenceType, setDivergenceType] = useState<DivergenceType>('js')
  const [discriminatorStrength, setDiscriminatorStrength] = useState(0.5)
  const [generatorLR, setGeneratorLR] = useState(0.3)
  const [step, setStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const maxSteps = 100

  // Gamification state
  const [showChallenge, setShowChallenge] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0)
  const [prediction, setPrediction] = useState<TrainingPrediction | null>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [streak, setStreak] = useState(0)

  const currentChallenge = PREDICTION_CHALLENGES[currentChallengeIdx]

  // Apply preset
  const applyPreset = useCallback((preset: ScenarioPreset) => {
    const config = SCENARIO_PRESETS[preset]
    setSelectedPreset(preset)
    setDivergenceType(config.divergenceType)
    setDiscriminatorStrength(config.discriminatorStrength)
    setGeneratorLR(config.generatorLR)
    setStep(0)
    setIsPlaying(false)
  }, [])

  // Simulate training
  const simulation = useMemo(() => {
    return simulateTraining(
      divergenceType,
      discriminatorStrength,
      generatorLR,
      maxSteps
    )
  }, [divergenceType, discriminatorStrength, generatorLR])

  // Animation
  useEffect(() => {
    if (!isPlaying) return

    const timer = setInterval(() => {
      setStep(s => {
        if (s >= maxSteps - 1) {
          setIsPlaying(false)
          return s
        }
        return s + 1
      })
    }, 100)

    return () => clearInterval(timer)
  }, [isPlaying])

  // Countdown timer for challenges
  useEffect(() => {
    if (gamePhase !== 'countdown') return

    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    } else {
      setGamePhase('reveal')
    }
  }, [countdown, gamePhase])

  // Scales
  const xScale = useMemo(() =>
    scaleLinear().domain([0, maxSteps]).range([0, plotWidth]),
    [plotWidth]
  )

  const yScaleLoss = useMemo(() =>
    scaleLinear().domain([0, 3]).range([plotHeight, 0]),
    [plotHeight]
  )

  const xScaleDist = useMemo(() =>
    scaleLinear().domain([-4, 6]).range([0, plotWidth]),
    [plotWidth]
  )

  const yScaleDist = useMemo(() =>
    scaleLinear().domain([0, 1]).range([plotHeight, 0]),
    [plotHeight]
  )

  // Line generators
  const lossLine = useMemo(() =>
    d3Line<number>()
      .x((_, i) => xScale(i))
      .y(d => yScaleLoss(Math.min(d, 3)))
      .curve(curveMonotoneX),
    [xScale, yScaleLoss]
  )

  // Distribution area generator
  const distArea = useMemo(() =>
    d3Area<number>()
      .x((_, i) => xScaleDist(-4 + i * 10 / 50))
      .y0(plotHeight)
      .y1(d => yScaleDist(d))
      .curve(curveMonotoneX),
    [xScaleDist, yScaleDist, plotHeight]
  )

  // Current distributions
  const currentGenMean = simulation.genDistMeans[step] ?? simulation.genDistMeans[0]
  const currentGenStd = simulation.genDistStds[step] ?? simulation.genDistStds[0]

  const realSamples = useMemo(() =>
    generateDistribution(0, 1, 200), [])
  const genSamples = useMemo(() =>
    generateDistribution(currentGenMean, currentGenStd, 200),
    [currentGenMean, currentGenStd])

  const realHist = useMemo(() =>
    computeHistogram(realSamples, 50, -4, 6), [realSamples])
  const genHist = useMemo(() =>
    computeHistogram(genSamples, 50, -4, 6), [genSamples])

  // Challenge functions
  const startChallenge = useCallback(() => {
    setDivergenceType(currentChallenge.divergenceType)
    setDiscriminatorStrength(currentChallenge.discriminatorStrength)
    setGeneratorLR(currentChallenge.generatorLR)
    setStep(0)
    setIsPlaying(false)
    setGamePhase('setup')
    setPrediction(null)
  }, [currentChallenge])

  const submitPrediction = useCallback((pred: TrainingPrediction) => {
    setPrediction(pred)
    setCountdown(3)
    setGamePhase('countdown')
    setIsPlaying(true)
  }, [])

  const checkResult = useCallback(() => {
    if (!prediction) return null
    const correct = prediction === simulation.outcome
    return { correct, actualOutcome: simulation.outcome }
  }, [prediction, simulation.outcome])

  const nextChallenge = useCallback(() => {
    const result = checkResult()
    if (result?.correct) {
      setScore(s => s + 10 * (streak + 1))
      setStreak(s => s + 1)
    } else {
      setStreak(0)
    }

    setCurrentChallengeIdx(i => (i + 1) % PREDICTION_CHALLENGES.length)
    setGamePhase('setup')
    setPrediction(null)
    setStep(0)
    setIsPlaying(false)
  }, [checkResult, streak])

  // Dynamic insight
  const insight = useMemo(() => {
    if (step < 10) {
      return "Early training: Generator starts far from real data distribution."
    }
    if (simulation.outcome === 'mode_collapse' && currentGenStd < 0.3) {
      return "⚠️ Mode collapse detected: Generator variance is shrinking as it exploits discriminator weakness."
    }
    if (simulation.outcome === 'vanishing_gradients' && step > 30) {
      return "⚠️ Vanishing gradients: Strong discriminator with JS divergence gives no learning signal."
    }
    if (divergenceType === 'wasserstein') {
      return "Wasserstein distance provides gradients everywhere, even when distributions don't overlap."
    }
    if (step > 50 && Math.abs(currentGenMean) < 0.5) {
      return "✅ Generator is converging toward the real data distribution!"
    }
    return "Watch how G and D losses evolve as training progresses."
  }, [step, simulation.outcome, currentGenStd, currentGenMean, divergenceType])

  return (
    <div className="viz-container" style={{ maxWidth: width + 40 }}>
      <div className="viz-header">
        <h3>Adversarial Training Dynamics</h3>
        <button
          className={`challenge-toggle ${showChallenge ? 'active' : ''}`}
          onClick={() => {
            setShowChallenge(!showChallenge)
            if (!showChallenge) startChallenge()
          }}
        >
          {showChallenge ? '← Exit Challenge' : '🎮 Challenge Mode'}
        </button>
      </div>

      {showChallenge ? (
        <div className="challenge-panel">
          <div className="challenge-header">
            <span className="challenge-name">{currentChallenge.name}</span>
            <div className="challenge-stats">
              <span className="score">Score: {score}</span>
              <span className="streak">🔥 {streak}</span>
            </div>
          </div>

          {gamePhase === 'setup' && (
            <div className="prediction-setup">
              <p className="challenge-question">
                What will happen with <strong>{currentChallenge.divergenceType === 'js' ? 'JS Divergence' : 'Wasserstein'}</strong>,
                D strength: <strong>{(currentChallenge.discriminatorStrength * 100).toFixed(0)}%</strong>,
                G learning rate: <strong>{currentChallenge.generatorLR}</strong>?
              </p>
              <p className="challenge-hint">💡 {currentChallenge.hint}</p>

              <div className="prediction-options">
                {PREDICTION_OPTIONS.map(opt => (
                  <button
                    key={opt.id}
                    className={`prediction-btn ${prediction === opt.id ? 'selected' : ''}`}
                    onClick={() => submitPrediction(opt.id)}
                  >
                    <span className="pred-emoji">{opt.emoji}</span>
                    <span className="pred-label">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {gamePhase === 'countdown' && (
            <div className="countdown-display">
              <p>Simulating training...</p>
              <div className="countdown-number">{countdown}</div>
              <p className="prediction-made">
                Your prediction: <strong>{PREDICTION_OPTIONS.find(o => o.id === prediction)?.label}</strong>
              </p>
            </div>
          )}

          {gamePhase === 'reveal' && (
            <div className="result-panel">
              {(() => {
                const result = checkResult()
                if (!result) return null
                return (
                  <>
                    <div className={`result-badge ${result.correct ? 'correct' : 'incorrect'}`}>
                      {result.correct ? '✓ Correct!' : '✗ Not quite'}
                    </div>
                    <p className="actual-outcome">
                      Actual outcome: <strong>{PREDICTION_OPTIONS.find(o => o.id === result.actualOutcome)?.label}</strong>
                    </p>
                    <p className="explanation">{currentChallenge.explanation}</p>
                    <button className="next-challenge" onClick={nextChallenge}>
                      Next Challenge →
                    </button>
                  </>
                )
              })()}
            </div>
          )}
        </div>
      ) : (
        <div className="preset-selector">
          {(Object.keys(SCENARIO_PRESETS) as ScenarioPreset[]).map(preset => (
            <button
              key={preset}
              className={`preset-btn ${selectedPreset === preset ? 'active' : ''}`}
              onClick={() => applyPreset(preset)}
            >
              <span className="preset-emoji">{SCENARIO_PRESETS[preset].emoji}</span>
              <span className="preset-name">{SCENARIO_PRESETS[preset].name}</span>
            </button>
          ))}
        </div>
      )}

      <svg width={width} height={height} className="gan-viz-svg">
        <defs>
          <linearGradient id="realGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={MATH_COLORS.primary} stopOpacity="0.6" />
            <stop offset="100%" stopColor={MATH_COLORS.primary} stopOpacity="0.1" />
          </linearGradient>
          <linearGradient id="genGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={MATH_COLORS.secondary} stopOpacity="0.6" />
            <stop offset="100%" stopColor={MATH_COLORS.secondary} stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Distribution Plot */}
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          <text x={plotWidth / 2} y={-15} textAnchor="middle" className="plot-title">
            Distribution Matching
          </text>

          {/* Axes */}
          <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="var(--text-muted)" strokeOpacity={0.3} />
          <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="var(--text-muted)" strokeOpacity={0.3} />

          {/* Real distribution */}
          <path
            d={distArea(realHist) || ''}
            fill="url(#realGrad)"
            stroke={MATH_COLORS.primary}
            strokeWidth={2}
          />

          {/* Generator distribution */}
          <path
            d={distArea(genHist) || ''}
            fill="url(#genGrad)"
            stroke={MATH_COLORS.secondary}
            strokeWidth={2}
          />

          {/* Legend */}
          <g transform={`translate(${plotWidth - 120}, 10)`}>
            <rect x={0} y={0} width={12} height={12} fill={MATH_COLORS.primary} rx={2} />
            <text x={18} y={10} className="legend-text">Real p(x)</text>
            <rect x={0} y={20} width={12} height={12} fill={MATH_COLORS.secondary} rx={2} />
            <text x={18} y={30} className="legend-text">Generator G(z)</text>
          </g>

          {/* X axis labels */}
          {[-4, -2, 0, 2, 4, 6].map(v => (
            <text key={v} x={xScaleDist(v)} y={plotHeight + 15} textAnchor="middle" className="axis-label">
              {v}
            </text>
          ))}
        </g>

        {/* Loss Curves Plot */}
        <g transform={`translate(${margin.left}, ${margin.top + plotHeight + 50})`}>
          <text x={plotWidth / 2} y={-15} textAnchor="middle" className="plot-title">
            Training Loss ({divergenceType === 'js' ? 'Jensen-Shannon' : 'Wasserstein'})
          </text>

          {/* Axes */}
          <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="var(--text-muted)" strokeOpacity={0.3} />
          <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="var(--text-muted)" strokeOpacity={0.3} />

          {/* Loss curves up to current step */}
          {step > 0 && (
            <>
              <path
                d={lossLine(simulation.generatorLoss.slice(0, step + 1)) || ''}
                fill="none"
                stroke={MATH_COLORS.secondary}
                strokeWidth={2}
              />
              <path
                d={lossLine(simulation.discriminatorLoss.slice(0, step + 1)) || ''}
                fill="none"
                stroke={MATH_COLORS.primary}
                strokeWidth={2}
              />
            </>
          )}

          {/* Current position markers */}
          {step > 0 && (
            <>
              <circle
                cx={xScale(step)}
                cy={yScaleLoss(Math.min(simulation.generatorLoss[step] || 0, 3))}
                r={5}
                fill={MATH_COLORS.secondary}
              />
              <circle
                cx={xScale(step)}
                cy={yScaleLoss(Math.min(simulation.discriminatorLoss[step] || 0, 3))}
                r={5}
                fill={MATH_COLORS.primary}
              />
            </>
          )}

          {/* Legend */}
          <g transform={`translate(${plotWidth - 130}, 10)`}>
            <line x1={0} y1={6} x2={15} y2={6} stroke={MATH_COLORS.secondary} strokeWidth={2} />
            <text x={20} y={10} className="legend-text">G Loss</text>
            <line x1={0} y1={26} x2={15} y2={26} stroke={MATH_COLORS.primary} strokeWidth={2} />
            <text x={20} y={30} className="legend-text">D Loss</text>
          </g>

          {/* X axis label */}
          <text x={plotWidth / 2} y={plotHeight + 35} textAnchor="middle" className="axis-label">
            Training Step
          </text>

          {/* X axis ticks */}
          {[0, 25, 50, 75, 100].map(v => (
            <text key={v} x={xScale(v)} y={plotHeight + 15} textAnchor="middle" className="axis-label">
              {v}
            </text>
          ))}
        </g>
      </svg>

      <div className="controls-row">
        <button
          className="play-btn"
          onClick={() => {
            if (step >= maxSteps - 1) setStep(0)
            setIsPlaying(!isPlaying)
          }}
        >
          {isPlaying ? '⏸ Pause' : step >= maxSteps - 1 ? '↺ Restart' : '▶ Play'}
        </button>

        <input
          type="range"
          min={0}
          max={maxSteps - 1}
          value={step}
          onChange={e => {
            setStep(parseInt(e.target.value))
            setIsPlaying(false)
          }}
          className="step-slider"
        />
        <span className="step-label">Step {step}</span>
      </div>

      {!showChallenge && (
        <div className="param-controls">
          <div className="param-group">
            <label>Divergence:</label>
            <select
              value={divergenceType}
              onChange={e => {
                setDivergenceType(e.target.value as DivergenceType)
                setStep(0)
              }}
            >
              <option value="js">Jensen-Shannon</option>
              <option value="wasserstein">Wasserstein</option>
            </select>
          </div>

          <div className="param-group">
            <label>D Strength: {(discriminatorStrength * 100).toFixed(0)}%</label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={discriminatorStrength}
              onChange={e => {
                setDiscriminatorStrength(parseFloat(e.target.value))
                setStep(0)
              }}
            />
          </div>

          <div className="param-group">
            <label>G Learning Rate: {generatorLR.toFixed(2)}</label>
            <input
              type="range"
              min={0.05}
              max={0.8}
              step={0.05}
              value={generatorLR}
              onChange={e => {
                setGeneratorLR(parseFloat(e.target.value))
                setStep(0)
              }}
            />
          </div>
        </div>
      )}

      <div className="insight-box">
        <span className="insight-icon">💡</span>
        <span className="insight-text">{insight}</span>
      </div>

      <style jsx>{`
        .viz-container {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 8px;
          padding: 1.5rem;
          margin: 1.5rem 0;
        }

        .viz-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .viz-header h3 {
          margin: 0;
          font-size: 1.1rem;
          color: var(--text-primary);
        }

        .challenge-toggle {
          padding: 0.4rem 0.9rem;
          font-family: var(--font-mono);
          font-size: 0.85rem;
          background: var(--bg-elevated);
          border: 1px solid var(--converge-teal-dim);
          border-radius: 4px;
          color: var(--converge-teal);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .challenge-toggle:hover,
        .challenge-toggle.active {
          background: var(--converge-teal);
          color: var(--bg-primary);
        }

        .challenge-panel {
          background: var(--bg-elevated);
          border: 1px solid var(--converge-teal-dim);
          border-radius: 6px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .challenge-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .challenge-name {
          font-weight: 600;
          color: var(--converge-teal);
        }

        .challenge-stats {
          display: flex;
          gap: 1rem;
          font-family: var(--font-mono);
          font-size: 0.85rem;
        }

        .prediction-setup {
          text-align: center;
        }

        .challenge-question {
          margin-bottom: 0.5rem;
        }

        .challenge-hint {
          color: var(--text-muted);
          font-size: 0.9rem;
          margin-bottom: 1rem;
        }

        .prediction-options {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.5rem;
        }

        .prediction-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.75rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .prediction-btn:hover {
          border-color: var(--converge-teal);
          background: var(--bg-elevated);
        }

        .prediction-btn.selected {
          border-color: var(--converge-teal);
          background: rgba(45, 212, 191, 0.1);
        }

        .pred-emoji {
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
        }

        .pred-label {
          font-size: 0.85rem;
          color: var(--text-primary);
        }

        .countdown-display {
          text-align: center;
          padding: 1rem;
        }

        .countdown-number {
          font-size: 3rem;
          font-weight: bold;
          color: var(--gradient-orange);
          animation: pulse 0.5s ease-in-out infinite alternate;
        }

        @keyframes pulse {
          from { transform: scale(1); }
          to { transform: scale(1.1); }
        }

        .result-panel {
          text-align: center;
        }

        .result-badge {
          display: inline-block;
          padding: 0.5rem 1rem;
          border-radius: 4px;
          font-weight: 600;
          margin-bottom: 0.75rem;
        }

        .result-badge.correct {
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid #22c55e;
          color: #22c55e;
        }

        .result-badge.incorrect {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid #ef4444;
          color: #ef4444;
        }

        .explanation {
          color: var(--text-secondary);
          font-size: 0.9rem;
          margin: 0.75rem 0;
        }

        .next-challenge {
          padding: 0.5rem 1rem;
          background: var(--converge-teal);
          border: none;
          border-radius: 4px;
          color: var(--bg-primary);
          cursor: pointer;
          font-weight: 500;
        }

        .preset-selector {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .preset-btn {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.8rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 0.85rem;
        }

        .preset-btn:hover {
          border-color: var(--converge-teal-dim);
        }

        .preset-btn.active {
          background: var(--converge-teal);
          color: var(--bg-primary);
          border-color: var(--converge-teal);
        }

        .gan-viz-svg {
          display: block;
          margin: 0 auto;
        }

        .gan-viz-svg :global(.plot-title) {
          font-size: 0.9rem;
          font-weight: 500;
          fill: var(--text-primary);
        }

        .gan-viz-svg :global(.legend-text) {
          font-size: 0.75rem;
          fill: var(--text-secondary);
        }

        .gan-viz-svg :global(.axis-label) {
          font-size: 0.7rem;
          fill: var(--text-muted);
        }

        .controls-row {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1rem 0;
        }

        .play-btn {
          padding: 0.4rem 1rem;
          background: var(--converge-teal);
          border: none;
          border-radius: 4px;
          color: var(--bg-primary);
          cursor: pointer;
          font-weight: 500;
          min-width: 80px;
        }

        .step-slider {
          flex: 1;
          accent-color: var(--converge-teal);
        }

        .step-label {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: var(--text-muted);
          min-width: 60px;
        }

        .param-controls {
          display: flex;
          gap: 1.5rem;
          flex-wrap: wrap;
          margin: 1rem 0;
          padding: 1rem;
          background: var(--bg-elevated);
          border-radius: 6px;
        }

        .param-group {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .param-group label {
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .param-group select,
        .param-group input[type="range"] {
          accent-color: var(--converge-teal);
        }

        .param-group select {
          padding: 0.3rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          color: var(--text-primary);
        }

        .insight-box {
          display: flex;
          align-items: flex-start;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(45, 212, 191, 0.1);
          border: 1px solid var(--converge-teal-dim);
          border-radius: 6px;
          margin-top: 1rem;
        }

        .insight-icon {
          flex-shrink: 0;
        }

        .insight-text {
          font-size: 0.9rem;
          color: var(--text-secondary);
        }
      `}</style>
    </div>
  )
}
