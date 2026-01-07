'use client'

import React, { useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'

// ----- Gamification types -----
type GamePhase = 'setup' | 'countdown' | 'revealed'
type GrokkingPrediction = 'A' | 'B' | 'C' | null

type GrokkingChallenge = {
  name: string
  question: string
  optionA: string
  optionB: string
  optionC?: string
  answer: 'A' | 'B' | 'C'
  sliderStart: number // Where to set slider for this challenge
  insight: string
}

const GROKKING_CHALLENGES: GrokkingChallenge[] = [
  {
    name: '🎲 Early Training',
    question: 'At 10¹ steps (early training), which statement is TRUE?',
    optionA: 'Both losses near zero',
    optionB: 'Train low, val still high',
    optionC: 'Both losses high',
    answer: 'B',
    sliderStart: 15,
    insight: 'Memorization phase: the model memorizes training examples (low train loss) but hasn\'t learned the underlying algorithm (high val loss). This is the "gap" that persists until grokking.'
  },
  {
    name: '🎲 Compression Phase',
    question: 'During compression (10² → 10⁴ steps), what are embeddings doing?',
    optionA: 'Already circular',
    optionB: 'Still random cloud',
    optionC: 'Gradually organizing',
    answer: 'B',
    sliderStart: 50,
    insight: 'Compression is "quiet reorganization"—the model is internally searching for a simpler algorithm, but embeddings still look random. The structure emerges suddenly at grokking, not gradually.'
  },
  {
    name: '🎲 Phase Transition',
    question: 'At the grokking point (~10⁵ steps), what happens FIRST?',
    optionA: 'Embeddings form circle',
    optionB: 'Validation loss drops',
    optionC: 'They happen together',
    answer: 'C',
    sliderStart: 80,
    insight: 'Grokking is a phase transition: the Fourier structure emerges and validation collapses simultaneously. The model "snaps" from a memorizing solution to a generalizing algorithm in one sharp transition.'
  },
  {
    name: '🎲 Why Fourier?',
    question: 'For modular addition (a+b mod N), why do embeddings form a CIRCLE?',
    optionA: 'Random initialization',
    optionB: 'Modular math is cyclic',
    optionC: 'L2 regularization',
    answer: 'B',
    sliderStart: 95,
    insight: 'Modular arithmetic is inherently cyclic: 0,1,...,N-1,0,1,... The optimal representation for computing (a+b) mod N uses Fourier features e^(i2πn/N)—placing each number as a phase on a circle makes addition = rotation!'
  }
]

type LossDatum = {
  t: number // normalized 0..1
  train: number
  val: number
}

type EmbeddingSeed = {
  id: number
  random: [number, number]
  circle: [number, number]
  angle: number
}

const LOG_MAX_STEPS = 5 // log10 of 1e5
const NUM_LOSS_POINTS = 220
const NUM_TOKENS = 16
const GROK_POINT = 0.8

const TRAIN_HIGH = 1.4
const TRAIN_LOW = 0.02
const VAL_HIGH = 1.4
const VAL_LOW = 0.03

const COLOR_TRAIN = '#14b8a6' // teal
const COLOR_VAL = '#f59e0b' // orange
const BG = '#080c14'

// ----- Loss curves (toy model of grokking) -----

function trainLossAt(t: number): number {
  // Drops quickly: "memorization" happens early
  const k = 18
  const p0 = 0.18
  const L = 1 / (1 + Math.exp(-k * (t - p0)))
  return TRAIN_LOW + (TRAIN_HIGH - TRAIN_LOW) * (1 - L)
}

function valLossAt(t: number): number {
  // Stays high, then phase-transition drop near GROK_POINT
  const k = 40
  const p0 = GROK_POINT
  const L = 1 / (1 + Math.exp(-k * (t - p0)))
  return VAL_LOW + (VAL_HIGH - VAL_LOW) * (1 - L)
}

// Alignment of embeddings to the "true" Fourier circle
function embeddingAlignment(t: number): number {
  const k = 45
  const p0 = GROK_POINT
  const L = 1 / (1 + Math.exp(-k * (t - p0)))
  return L
}

const formatSteps = (logStep: number): string => {
  const pow = Math.pow(10, logStep)
  if (pow < 1000) return pow.toFixed(0)
  if (pow < 100000) return (pow / 1000).toFixed(1).replace(/\.0$/, '') + 'k'
  return '100k+'
}

const phaseForProgress = (p: number): 'Memorization' | 'Compression' | 'Grokking' => {
  if (p < 0.25) return 'Memorization'
  if (p < 0.8) return 'Compression'
  return 'Grokking'
}

const phaseDescription: Record<string, string> = {
  Memorization: 'Training loss drops as the model memorizes the training set; validation stays random.',
  Compression: 'The model quietly reorganizes its internal representation, searching for a simpler algorithm.',
  Grokking: 'A phase transition: validation suddenly improves as the compressed algorithm snaps into place.'
}

function getGrokkingFeedback(predicted: GrokkingPrediction, challenge: GrokkingChallenge): string {
  if (!predicted) return ''
  const isCorrect = predicted === challenge.answer
  const correctLabel = challenge.answer === 'A' ? challenge.optionA : challenge.answer === 'B' ? challenge.optionB : challenge.optionC
  if (isCorrect) {
    return `✓ Correct! ${challenge.insight}`
  }
  return `✗ The answer is "${correctLabel}". ${challenge.insight}`
}

const GrokkingGrokViz: React.FC = () => {
  // Slider in [0, 100], map to progress in [0, 1]
  const [slider, setSlider] = useState<number>(15)

  // ----- Gamification state -----
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<GrokkingChallenge | null>(null)
  const [prediction, setPrediction] = useState<GrokkingPrediction>(null)
  const [countdown, setCountdown] = useState<number>(3)
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 })

  // Game control functions
  function startChallenge(challenge: GrokkingChallenge) {
    setActiveChallenge(challenge)
    setSlider(challenge.sliderStart) // Set to challenge's starting position
    setPrediction(null)
    setGamePhase('setup')
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
    setSlider(15)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      // Update score
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

  const progress = slider / 100
  const logStep = progress * LOG_MAX_STEPS
  const phase = phaseForProgress(progress)
  const isAhaMoment = Math.abs(progress - GROK_POINT) < 0.03

  // Precompute synthetic loss curves
  const lossData = useMemo<LossDatum[]>(() => {
    const data: LossDatum[] = []
    for (let i = 0; i < NUM_LOSS_POINTS; i++) {
      const t = i / (NUM_LOSS_POINTS - 1)
      data.push({
        t,
        train: trainLossAt(t),
        val: valLossAt(t),
      })
    }
    return data
  }, [])

  // Geometry & D3 path for the loss chart
  const lossPlot = useMemo(() => {
    const width = 440
    const height = 260
    const margin = { top: 20, right: 20, bottom: 44, left: 52 }

    const xScale = d3
      .scaleLinear()
      .domain([0, LOG_MAX_STEPS])
      .range([margin.left, width - margin.right])

    const yScale = d3
      .scaleLinear()
      .domain([0, 1.6])
      .range([height - margin.bottom, margin.top])

    const trainLine = d3
      .line<LossDatum>()
      .x((d) => xScale(d.t * LOG_MAX_STEPS))
      .y((d) => yScale(d.train))
      .curve(d3.curveMonotoneX)

    const valLine = d3
      .line<LossDatum>()
      .x((d) => xScale(d.t * LOG_MAX_STEPS))
      .y((d) => yScale(d.val))
      .curve(d3.curveMonotoneX)

    return {
      width,
      height,
      margin,
      xScale,
      yScale,
      trainPath: trainLine(lossData) ?? '',
      valPath: valLine(lossData) ?? '',
    }
  }, [lossData])

  const currentTrain = trainLossAt(progress)
  const currentVal = valLossAt(progress)
  const currentX = lossPlot.xScale(logStep)
  const currentYTrain = lossPlot.yScale(currentTrain)
  const currentYVal = lossPlot.yScale(currentVal)

  // ----- Embedding / Fourier view -----

  const embeddingSeeds = useMemo<EmbeddingSeed[]>(() => {
    const seeds: EmbeddingSeed[] = []
    for (let i = 0; i < NUM_TOKENS; i++) {
      const angle = (2 * Math.PI * i) / NUM_TOKENS
      const circle: [number, number] = [Math.cos(angle), Math.sin(angle)]
      const randomRadius = 0.15 + Math.random() * 1.1
      const randomAngle = Math.random() * 2 * Math.PI
      const random: [number, number] = [
        randomRadius * Math.cos(randomAngle),
        randomRadius * Math.sin(randomAngle),
      ]
      seeds.push({ id: i, random, circle, angle })
    }
    return seeds
  }, [])

  const alpha = embeddingAlignment(progress)
  const embeddingPoints = embeddingSeeds.map((seed) => {
    const [rx, ry] = seed.random
    const [cx, cy] = seed.circle
    const x = (1 - alpha) * rx + alpha * cx
    const y = (1 - alpha) * ry + alpha * cy
    return { ...seed, x, y }
  })

  const embedWidth = 320
  const embedHeight = 320
  const embedCenterX = embedWidth / 2
  const embedCenterY = embedHeight / 2
  const embedRadius = 115

  const projectEmbedding = (x: number, y: number): { x: number; y: number } => ({
    x: embedCenterX + x * embedRadius,
    y: embedCenterY - y * embedRadius,
  })

  return (
    <div className="grok-root">
      <div className="grok-header">
        <h2 className="grok-title">Grokking: Delayed Generalization as a Phase Transition</h2>
        <p className="grok-subtitle">
          Training accuracy hits 100% quickly, but validation stays random. Then, long after memorization,
          the internal representation snaps into a clean Fourier-like circle and generalization appears
          in a single dramatic step.
        </p>
      </div>

      {/* Slider / controls */}
      <div className="grok-controls">
        <label className="grok-slider-label">
          <span>Training steps (log scale)</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={slider}
            onChange={(e) => setSlider(Number(e.target.value))}
          />
        </label>
        <div className="grok-controls-row">
          <div className="grok-metric">
            <span className="grok-metric-label">Approx. steps</span>
            <span className="grok-metric-value">10^{logStep.toFixed(1)} ≈ {formatSteps(logStep)}</span>
          </div>
          <div className="grok-metric">
            <span className="grok-metric-label">Phase</span>
            <span className={`grok-phase-pill phase-${phase.toLowerCase()}`}>{phase}</span>
          </div>
          <div className="grok-metric grok-loss-metric">
            <span className="grok-metric-label">Loss (train / val)</span>
            <span className="grok-metric-value">
              <span style={{ color: COLOR_TRAIN }}>{currentTrain.toFixed(3)}</span>{' '}
              <span className="grok-metric-separator">/</span>{' '}
              <span style={{ color: COLOR_VAL }}>{currentVal.toFixed(3)}</span>
            </span>
          </div>
        </div>
        <p className="grok-phase-desc">{phaseDescription[phase]}</p>

        {/* Game Panel */}
        <div className="grok-game-panel">
          <div className="grok-game-header">
            <span className="grok-game-title">🎮 Generalization Challenge</span>
            {score.total > 0 && (
              <span className="grok-game-score">
                Score: {score.correct}/{score.total}
              </span>
            )}
          </div>

          {!activeChallenge ? (
            <div className="grok-challenge-select">
              <p className="grok-challenge-prompt">Test your understanding of grokking:</p>
              <div className="grok-challenge-buttons">
                {GROKKING_CHALLENGES.map((ch, idx) => (
                  <button
                    key={idx}
                    className="grok-challenge-btn"
                    onClick={() => startChallenge(ch)}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
          ) : gamePhase === 'setup' ? (
            <div className="grok-game-active">
              <p className="grok-game-question">{activeChallenge.question}</p>
              <div className="grok-prediction-buttons">
                <button
                  className={`grok-pred-btn ${prediction === 'A' ? 'selected' : ''}`}
                  onClick={() => setPrediction('A')}
                >
                  {activeChallenge.optionA}
                </button>
                <button
                  className={`grok-pred-btn ${prediction === 'B' ? 'selected' : ''}`}
                  onClick={() => setPrediction('B')}
                >
                  {activeChallenge.optionB}
                </button>
                {activeChallenge.optionC && (
                  <button
                    className={`grok-pred-btn ${prediction === 'C' ? 'selected' : ''}`}
                    onClick={() => setPrediction('C')}
                  >
                    {activeChallenge.optionC}
                  </button>
                )}
              </div>
              <div className="grok-game-actions">
                <button
                  className="grok-submit-btn"
                  onClick={submitPrediction}
                  disabled={!prediction}
                >
                  Submit Prediction
                </button>
                <button className="grok-reset-btn" onClick={resetGame}>
                  Cancel
                </button>
              </div>
            </div>
          ) : gamePhase === 'countdown' ? (
            <div className="grok-countdown">
              <span className="grok-countdown-number">{countdown}</span>
              <span className="grok-countdown-label">Revealing...</span>
            </div>
          ) : (
            <div className="grok-feedback">
              <p className="grok-feedback-text">
                {getGrokkingFeedback(prediction, activeChallenge)}
              </p>
              <div className="grok-game-actions">
                <button className="grok-next-btn" onClick={resetGame}>
                  Try Another Challenge
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grok-layout">
        {/* Left: loss + phase timeline */}
        <div className="grok-column">
          <div className="grok-panel">
            <div className="grok-panel-header">
              <h3>Training vs Validation Loss</h3>
              <p className="grok-panel-caption">
                Training loss (teal) falls quickly as the model memorizes. Validation loss (orange) stays high
                until a sudden phase transition around 10^5 steps.
              </p>
            </div>
            <svg
              className="grok-loss-svg"
              width={lossPlot.width}
              height={lossPlot.height}
              role="img"
              aria-label="Training and validation loss during grokking"
            >
              {/* Background */}
              <rect
                x={0}
                y={0}
                width={lossPlot.width}
                height={lossPlot.height}
                fill="transparent"
              />

              {/* Grid */}
              {Array.from({ length: 5 }).map((_, i) => {
                const yVal = (1.6 / 4) * i
                const y = lossPlot.yScale(yVal)
                return (
                  <line
                    key={`ygrid-${i}`}
                    x1={lossPlot.margin.left}
                    x2={lossPlot.width - lossPlot.margin.right}
                    y1={y}
                    y2={y}
                    className="grok-grid-line"
                  />
                )
              })}

              {/* Axes */}
              <line
                x1={lossPlot.margin.left}
                x2={lossPlot.width - lossPlot.margin.right}
                y1={lossPlot.height - lossPlot.margin.bottom}
                y2={lossPlot.height - lossPlot.margin.bottom}
                className="grok-axis-line"
              />
              <line
                x1={lossPlot.margin.left}
                x2={lossPlot.margin.left}
                y1={lossPlot.margin.top}
                y2={lossPlot.height - lossPlot.margin.bottom}
                className="grok-axis-line"
              />

              {/* X ticks: log10 steps */}
              {Array.from({ length: LOG_MAX_STEPS + 1 }).map((_, k) => {
                const x = lossPlot.xScale(k)
                return (
                  <g key={`xtick-${k}`}>
                    <line
                      x1={x}
                      x2={x}
                      y1={lossPlot.height - lossPlot.margin.bottom}
                      y2={lossPlot.height - lossPlot.margin.bottom + 6}
                      className="grok-axis-tick"
                    />
                    <text
                      x={x}
                      y={lossPlot.height - lossPlot.margin.bottom + 20}
                      className="grok-axis-label"
                    >
                      10^{k}
                    </text>
                  </g>
                )
              })}

              {/* Y ticks */}
              {[0, 0.5, 1.0, 1.5].map((v) => {
                const y = lossPlot.yScale(v)
                return (
                  <g key={`ytick-${v}`}>
                    <line
                      x1={lossPlot.margin.left - 6}
                      x2={lossPlot.margin.left}
                      y1={y}
                      y2={y}
                      className="grok-axis-tick"
                    />
                    <text
                      x={lossPlot.margin.left - 10}
                      y={y + 3}
                      className="grok-axis-label grok-axis-label-right"
                    >
                      {v.toFixed(1)}
                    </text>
                  </g>
                )
              })}

              {/* Loss curves */}
              <path
                d={lossPlot.trainPath}
                fill="none"
                stroke={COLOR_TRAIN}
                strokeWidth={2}
                className="grok-loss-path"
              />
              <path
                d={lossPlot.valPath}
                fill="none"
                stroke={COLOR_VAL}
                strokeWidth={2}
                className="grok-loss-path"
              />

              {/* Current time line */}
              <line
                x1={currentX}
                x2={currentX}
                y1={lossPlot.margin.top}
                y2={lossPlot.height - lossPlot.margin.bottom}
                className="grok-time-line"
                strokeDasharray="4 4"
              />

              {/* Current points */}
              <circle
                cx={currentX}
                cy={currentYTrain}
                r={5}
                fill={COLOR_TRAIN}
                className="grok-loss-dot"
              />
              <circle
                cx={currentX}
                cy={currentYVal}
                r={5}
                fill={COLOR_VAL}
                className={`grok-loss-dot ${isAhaMoment ? 'grok-aha-dot' : ''}`}
              />

              {/* Labels */}
              <text
                x={lossPlot.width / 2}
                y={lossPlot.height - 8}
                className="grok-axis-caption"
              >
                log₁₀(training steps)
              </text>
              <text
                x={14}
                y={lossPlot.margin.top - 4}
                className="grok-axis-caption"
              >
                loss
              </text>

              {/* Legend */}
              <g transform={`translate(${lossPlot.width - 150}, ${lossPlot.margin.top + 4})`}>
                <rect width={140} height={40} rx={8} className="grok-legend-bg" />
                <g transform="translate(10, 12)">
                  <circle r={4} cx={0} cy={0} fill={COLOR_TRAIN} />
                  <text x={10} y={4} className="grok-legend-label">
                    training loss
                  </text>
                </g>
                <g transform="translate(10, 26)">
                  <circle r={4} cx={0} cy={0} fill={COLOR_VAL} />
                  <text x={10} y={4} className="grok-legend-label">
                    validation loss
                  </text>
                </g>
              </g>
            </svg>

            {/* Phase timeline */}
            <div className="grok-phase-timeline">
              <div
                className={`grok-phase-segment ${
                  phase === 'Memorization' ? 'active' : ''
                }`}
                style={{ flexGrow: 1 }}
              >
                <span className="grok-phase-segment-title">Memorization</span>
                <span className="grok-phase-segment-sub">10⁰ → 10¹</span>
              </div>
              <div
                className={`grok-phase-segment ${
                  phase === 'Compression' ? 'active' : ''
                }`}
                style={{ flexGrow: 3 }}
              >
                <span className="grok-phase-segment-title">Compression</span>
                <span className="grok-phase-segment-sub">10¹ → 10⁴</span>
              </div>
              <div
                className={`grok-phase-segment ${
                  phase === 'Grokking' ? 'active' : ''
                }`}
                style={{ flexGrow: 1 }}
              >
                <span className="grok-phase-segment-title">Grokking</span>
                <span className="grok-phase-segment-sub">≈ 10⁵</span>
              </div>
              <div
                className="grok-phase-progress-indicator"
                style={{ left: `${progress * 100}%` }}
              >
                <div className="grok-phase-pin" />
              </div>
            </div>
          </div>
        </div>

        {/* Right: embeddings / Fourier view */}
        <div className="grok-column">
          <div className="grok-panel">
            <div className="grok-panel-header">
              <h3>Modular Addition Embeddings</h3>
              <p className="grok-panel-caption">
                Each token 0…{NUM_TOKENS - 1} is an embedding vector. Early on the weights are
                chaotic; after grokking, they lie nearly perfectly on a Fourier circle.
              </p>
            </div>
            <svg
              width={embedWidth}
              height={embedHeight}
              className="grok-embed-svg"
              role="img"
              aria-label="Embedding vectors evolving from random cloud to circle"
            >
              {/* Background & circle */}
              <defs>
                <radialGradient id="grok-circle-glow">
                  <stop offset="0%" stopColor="#0f172a" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="#0f172a" stopOpacity="0" />
                </radialGradient>
              </defs>
              <rect x={0} y={0} width={embedWidth} height={embedHeight} fill="transparent" />

              <circle
                cx={embedCenterX}
                cy={embedCenterY}
                r={embedRadius * 0.9}
                fill="url(#grok-circle-glow)"
              />
              <circle
                cx={embedCenterX}
                cy={embedCenterY}
                r={embedRadius * 0.9}
                fill="none"
                className={`grok-embed-circle ${alpha > 0.7 ? 'grok-embed-circle-strong' : ''}`}
              />

              {/* axes */}
              <line
                x1={embedCenterX - embedRadius * 1.05}
                x2={embedCenterX + embedRadius * 1.05}
                y1={embedCenterY}
                y2={embedCenterY}
                className="grok-embed-axis"
              />
              <line
                x1={embedCenterX}
                x2={embedCenterX}
                y1={embedCenterY - embedRadius * 1.05}
                y2={embedCenterY + embedRadius * 1.05}
                className="grok-embed-axis"
              />

              {/* token vectors */}
              {embeddingPoints.map((p) => {
                const { x, y } = projectEmbedding(p.x, p.y)
                const final = projectEmbedding(p.circle[0], p.circle[1])
                const isNearCircle = alpha > 0.8
                const opacity = 0.4 + 0.6 * alpha

                return (
                  <g key={p.id}>
                    {/* faint line from origin */}
                    <line
                      x1={embedCenterX}
                      y1={embedCenterY}
                      x2={x}
                      y2={y}
                      className="grok-embed-ray"
                      style={{ opacity: 0.2 + 0.3 * alpha }}
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r={isNearCircle ? 7 : 5}
                      className={`grok-embed-point ${
                        isAhaMoment ? 'grok-embed-point-aha' : ''
                      }`}
                      style={{ opacity }}
                    />
                    {/* Label appears as Fourier circle emerges */}
                    {alpha > 0.55 && (
                      <text
                        x={final.x * 0.96 + embedCenterX * 0.04}
                        y={final.y * 0.96 + embedCenterY * 0.04}
                        className="grok-embed-label"
                      >
                        {p.id}
                      </text>
                    )}
                  </g>
                )
              })}

              {/* Fourier explanation */}
              <text
                x={embedCenterX}
                y={embedCenterY + embedRadius * 1.1}
                className="grok-axis-caption"
              >
                tokens as phases e^{`i 2π n / N`} on a circle
              </text>
            </svg>
            <p className="grok-panel-caption grok-panel-caption-small">
              Think of each number n as a complex phase e<sup>i 2πn/N</sup>. Grokking is the moment the
              model re-encodes modular addition into this Fourier basis: the embeddings stop being random
              and snap into a clean circle, and validation error collapses.
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .grok-root {
          background: ${BG};
          border-radius: 1rem;
          padding: 1.5rem;
          color: #e5e7eb;
          box-shadow: 0 0 0 1px rgba(148, 163, 184, 0.25);
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif;
        }

        .grok-header {
          margin-bottom: 1.25rem;
        }

        .grok-title {
          font-size: 1.4rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin: 0 0 0.4rem;
        }

        .grok-subtitle {
          margin: 0;
          font-size: 0.9rem;
          color: #9ca3af;
          max-width: 46rem;
        }

        .grok-controls {
          border-radius: 0.9rem;
          padding: 0.9rem 1rem 0.9rem;
          background: radial-gradient(circle at top left, #0f172a, #020617);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .grok-slider-label {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          font-size: 0.85rem;
          color: #e5e7eb;
        }

        .grok-slider-label input[type='range'] {
          flex: 1;
          accent-color: ${COLOR_VAL};
        }

        .grok-controls-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
          margin-top: 0.6rem;
        }

        .grok-metric {
          min-width: 0;
          flex: 1 1 9rem;
        }

        .grok-metric-label {
          display: block;
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #9ca3af;
          margin-bottom: 0.12rem;
        }

        .grok-metric-value {
          font-size: 0.9rem;
          font-variant-numeric: tabular-nums;
          color: #f9fafb;
        }

        .grok-loss-metric {
          text-align: right;
        }

        .grok-metric-separator {
          margin: 0 0.15rem;
          color: #6b7280;
        }

        .grok-phase-pill {
          display: inline-flex;
          align-items: center;
          padding: 0.18rem 0.6rem;
          border-radius: 999px;
          font-size: 0.75rem;
          font-weight: 500;
          border: 1px solid transparent;
          background: rgba(15, 23, 42, 0.9);
        }

        .phase-memorization {
          border-color: rgba(129, 140, 248, 0.7);
          color: #c7d2fe;
        }

        .phase-compression {
          border-color: rgba(148, 163, 184, 0.8);
          color: #e5e7eb;
        }

        .phase-grokking {
          border-color: rgba(45, 212, 191, 0.9);
          color: #a5f3fc;
          box-shadow: 0 0 0 1px rgba(20, 184, 166, 0.2);
        }

        .grok-phase-desc {
          margin: 0.45rem 0 0;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .grok-layout {
          display: flex;
          flex-wrap: wrap;
          gap: 1.25rem;
          margin-top: 1.3rem;
        }

        .grok-column {
          flex: 1 1 320px;
          min-width: 0;
        }

        .grok-panel {
          border-radius: 0.9rem;
          padding: 0.9rem 1rem 0.9rem;
          background: radial-gradient(circle at top, #020617, #020617 60%, #0b1120);
          border: 1px solid rgba(31, 41, 55, 0.9);
        }

        .grok-panel-header h3 {
          margin: 0 0 0.25rem;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .grok-panel-caption {
          margin: 0;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .grok-panel-caption-small {
          margin-top: 0.7rem;
        }

        .grok-loss-svg {
          display: block;
          margin-top: 0.6rem;
          width: 100%;
          height: auto;
        }

        .grok-grid-line {
          stroke: rgba(148, 163, 184, 0.15);
          stroke-width: 1;
        }

        .grok-axis-line {
          stroke: rgba(148, 163, 184, 0.7);
          stroke-width: 1.2;
        }

        .grok-axis-tick {
          stroke: rgba(148, 163, 184, 0.7);
          stroke-width: 1;
        }

        .grok-axis-label {
          fill: #9ca3af;
          font-size: 0.7rem;
          text-anchor: middle;
        }

        .grok-axis-label-right {
          text-anchor: end;
        }

        .grok-axis-caption {
          fill: #9ca3af;
          font-size: 0.7rem;
        }

        .grok-loss-path {
          filter: drop-shadow(0 0 4px rgba(15, 23, 42, 0.9));
        }

        .grok-time-line {
          stroke: rgba(248, 250, 252, 0.5);
        }

        .grok-loss-dot {
          stroke: #020617;
          stroke-width: 1.5;
        }

        .grok-aha-dot {
          animation: grok-pulse 1.3s ease-in-out infinite;
          filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.9));
        }

        @keyframes grok-pulse {
          0% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.45);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 0.7;
          }
        }

        .grok-legend-bg {
          fill: rgba(15, 23, 42, 0.9);
          stroke: rgba(31, 41, 55, 0.9);
        }

        .grok-legend-label {
          fill: #e5e7eb;
          font-size: 0.7rem;
        }

        .grok-phase-timeline {
          position: relative;
          display: flex;
          margin-top: 0.6rem;
          border-radius: 999px;
          overflow: hidden;
          background: radial-gradient(circle at top, #020617, #020617 50%, #030712);
          border: 1px solid rgba(31, 41, 55, 0.9);
        }

        .grok-phase-segment {
          position: relative;
          padding: 0.35rem 0.6rem;
          font-size: 0.7rem;
          color: #9ca3af;
          display: flex;
          flex-direction: column;
          gap: 0.05rem;
          justify-content: center;
          white-space: nowrap;
        }

        .grok-phase-segment + .grok-phase-segment {
          border-left: 1px solid rgba(31, 41, 55, 0.9);
        }

        .grok-phase-segment-title {
          font-weight: 500;
        }

        .grok-phase-segment-sub {
          font-size: 0.65rem;
          opacity: 0.8;
        }

        .grok-phase-segment.active {
          background: radial-gradient(circle at top, rgba(20, 184, 166, 0.25), transparent 65%);
          color: #f9fafb;
        }

        .grok-phase-progress-indicator {
          position: absolute;
          top: 0;
          bottom: 0;
          width: 0;
          pointer-events: none;
        }

        .grok-phase-pin {
          position: absolute;
          top: -2px;
          left: -1px;
          width: 2px;
          bottom: -2px;
          background: linear-gradient(to bottom, #f97316, #22c55e);
          box-shadow: 0 0 10px rgba(249, 115, 22, 0.7);
        }

        .grok-embed-svg {
          display: block;
          margin-top: 0.55rem;
          width: 100%;
          height: auto;
        }

        .grok-embed-circle {
          stroke: rgba(148, 163, 184, 0.4);
          stroke-width: 1.4;
          stroke-dasharray: 3 4;
        }

        .grok-embed-circle-strong {
          stroke: rgba(45, 212, 191, 0.9);
          stroke-width: 1.7;
          stroke-dasharray: 0;
          filter: drop-shadow(0 0 10px rgba(20, 184, 166, 0.7));
        }

        .grok-embed-axis {
          stroke: rgba(55, 65, 81, 0.9);
          stroke-width: 1;
        }

        .grok-embed-ray {
          stroke: rgba(59, 130, 246, 0.35);
          stroke-width: 1;
        }

        .grok-embed-point {
          fill: #f97316;
          stroke: #020617;
          stroke-width: 1.4;
        }

        .grok-embed-point-aha {
          animation: grok-embed-flash 1.4s ease-in-out infinite;
        }

        @keyframes grok-embed-flash {
          0% {
            filter: drop-shadow(0 0 0 rgba(249, 115, 22, 0.0));
          }
          50% {
            filter: drop-shadow(0 0 14px rgba(249, 115, 22, 0.9));
          }
          100% {
            filter: drop-shadow(0 0 0 rgba(249, 115, 22, 0.0));
          }
        }

        .grok-embed-label {
          fill: #e5e7eb;
          font-size: 0.7rem;
          text-anchor: middle;
          dominant-baseline: middle;
          paint-order: stroke;
          stroke: #020617;
          stroke-width: 2px;
        }

        @media (max-width: 768px) {
          .grok-loss-metric {
            text-align: left;
          }
        }

        /* ----- Game Panel Styles ----- */
        .grok-game-panel {
          margin-top: 0.9rem;
          padding: 0.7rem 0.9rem;
          border-radius: 0.7rem;
          background: rgba(15, 23, 42, 0.6);
          border: 1px solid rgba(148, 163, 184, 0.2);
        }

        .grok-game-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5rem;
        }

        .grok-game-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: #f9fafb;
        }

        .grok-game-score {
          font-size: 0.75rem;
          color: #14b8a6;
          font-weight: 500;
        }

        .grok-challenge-prompt {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0 0 0.5rem;
        }

        .grok-challenge-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .grok-challenge-btn {
          padding: 0.35rem 0.7rem;
          font-size: 0.75rem;
          background: rgba(59, 130, 246, 0.15);
          border: 1px solid rgba(59, 130, 246, 0.4);
          border-radius: 999px;
          color: #93c5fd;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .grok-challenge-btn:hover {
          background: rgba(59, 130, 246, 0.25);
          border-color: rgba(59, 130, 246, 0.6);
        }

        .grok-game-question {
          font-size: 0.85rem;
          color: #f9fafb;
          margin: 0 0 0.6rem;
          line-height: 1.4;
        }

        .grok-prediction-buttons {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-bottom: 0.6rem;
        }

        .grok-pred-btn {
          padding: 0.4rem 0.7rem;
          font-size: 0.78rem;
          background: rgba(31, 41, 55, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 0.5rem;
          color: #e5e7eb;
          cursor: pointer;
          text-align: left;
          transition: all 0.15s ease;
        }

        .grok-pred-btn:hover {
          background: rgba(55, 65, 81, 0.8);
          border-color: rgba(148, 163, 184, 0.5);
        }

        .grok-pred-btn.selected {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.6);
          color: #fbbf24;
        }

        .grok-game-actions {
          display: flex;
          gap: 0.5rem;
        }

        .grok-submit-btn {
          flex: 1;
          padding: 0.4rem 0.8rem;
          font-size: 0.8rem;
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.5);
          border-radius: 0.5rem;
          color: #fbbf24;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .grok-submit-btn:hover:not(:disabled) {
          background: rgba(245, 158, 11, 0.35);
        }

        .grok-submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .grok-reset-btn {
          padding: 0.4rem 0.8rem;
          font-size: 0.8rem;
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.3);
          border-radius: 0.5rem;
          color: #9ca3af;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .grok-reset-btn:hover {
          background: rgba(55, 65, 81, 0.5);
        }

        .grok-countdown {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0.8rem;
        }

        .grok-countdown-number {
          font-size: 2rem;
          font-weight: 700;
          color: #f59e0b;
          animation: pulse-countdown 1s ease-in-out infinite;
        }

        @keyframes pulse-countdown {
          0%, 100% { transform: scale(1); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
        }

        .grok-countdown-label {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .grok-feedback {
          padding: 0.4rem 0;
        }

        .grok-feedback-text {
          font-size: 0.82rem;
          line-height: 1.5;
          color: #e5e7eb;
          margin: 0 0 0.6rem;
        }

        .grok-next-btn {
          width: 100%;
          padding: 0.4rem 0.8rem;
          font-size: 0.8rem;
          background: rgba(20, 184, 166, 0.2);
          border: 1px solid rgba(20, 184, 166, 0.5);
          border-radius: 0.5rem;
          color: #2dd4bf;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .grok-next-btn:hover {
          background: rgba(20, 184, 166, 0.35);
        }
      `}</style>
    </div>
  )
}

export default GrokkingGrokViz
