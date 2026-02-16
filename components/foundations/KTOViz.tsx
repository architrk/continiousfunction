import { useState, useMemo, useCallback, useEffect } from 'react'
import * as d3 from 'd3'

// ─────────────────────────────────────────────────────────────
// Gamification: Behavior Prediction Challenge
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed';
type BehaviorPrediction = 'cautious' | 'balanced' | 'aggressive' | 'extreme-averse' | null;

interface BehaviorChallenge {
  name: string;
  beta: number;
  lambdaD: number;
  lambdaU: number;
  hint: string;
  correctBehavior: 'cautious' | 'balanced' | 'aggressive' | 'extreme-averse';
  explanation: string;
}

function _getBehaviorType(beta: number, lambdaD: number, lambdaU: number): 'cautious' | 'balanced' | 'aggressive' | 'extreme-averse' {
  const lossRatio = lambdaU / lambdaD;
  const isLossAverse = lossRatio > 1.3;
  const isGainFocused = lossRatio < 0.7;
  const isSharp = beta > 2.0;
  const isSmooth = beta < 0.5;

  if (isSharp && isLossAverse) return 'cautious';
  if (isGainFocused || (beta > 1.5 && lossRatio < 1.0)) return 'aggressive';
  if (isSmooth) return 'extreme-averse';
  return 'balanced';
}

const BEHAVIOR_CHALLENGES: BehaviorChallenge[] = [
  {
    name: '🎲 Mystery A',
    beta: 2.5,
    lambdaD: 0.8,
    lambdaU: 1.6,
    hint: 'This model was trained on safety-critical data where avoiding harm is paramount...',
    correctBehavior: 'cautious',
    explanation: '😰 Cautious! High β (2.5) means sharp saturation—only borderline examples matter. Combined with 2× loss aversion (λU/λD = 2.0), the model strongly avoids anything resembling "bad" outputs.'
  },
  {
    name: '🎲 Mystery B',
    beta: 1.0,
    lambdaD: 1.0,
    lambdaU: 1.0,
    hint: 'The team used default parameters without tuning...',
    correctBehavior: 'balanced',
    explanation: '⚖️ Balanced! With β=1.0 and equal lambdas, the value function treats desirable and undesirable examples symmetrically. This is a good starting point before understanding your data distribution.'
  },
  {
    name: '🎲 Mystery C',
    beta: 1.8,
    lambdaD: 1.5,
    lambdaU: 0.7,
    hint: 'The training data has high-quality "desirable" labels but noisy "undesirable" examples...',
    correctBehavior: 'aggressive',
    explanation: '🎯 Aggressive! With λD > λU (ratio 0.47), the model prioritizes finding excellent responses over avoiding bad ones. The high β focuses on borderline cases. Good when your positive labels are trustworthy.'
  },
  {
    name: '🎲 Mystery D',
    beta: 0.35,
    lambdaD: 1.1,
    lambdaU: 1.2,
    hint: 'Preference labels in the dataset have high variance and some mislabeling...',
    correctBehavior: 'extreme-averse',
    explanation: '🌊 Extreme-averse! Very low β (0.35) means gradual saturation—even extreme examples contribute to learning. This helps when labels are noisy since it doesn\'t over-trust any single example.'
  }
];

function getBehaviorFeedback(
  prediction: BehaviorPrediction,
  challenge: BehaviorChallenge
): { correct: boolean; message: string } {
  const isCorrect = prediction === challenge.correctBehavior;
  const behaviorLabels = {
    'cautious': 'Cautious/Loss-Averse',
    'balanced': 'Balanced',
    'aggressive': 'Aggressive/Gain-Focused',
    'extreme-averse': 'Extreme-Averse (Smooth)'
  };
  return {
    correct: isCorrect,
    message: isCorrect
      ? challenge.explanation
      : `❌ Not quite! The behavior is "${behaviorLabels[challenge.correctBehavior]}". ${challenge.explanation}`
  };
}

/**
 * KTO Utility Curve Visualization
 * Shows how KTO's prospect-theoretic value function saturates for extreme examples
 * Demonstrates loss aversion asymmetry between desirable/undesirable
 */

const KTO_PRESETS = [
  { name: '⚖️ Balanced', beta: 1.0, lambdaD: 1.0, lambdaU: 1.0, description: 'Equal weights - symmetric value function' },
  { name: '😰 Loss Averse', beta: 1.0, lambdaD: 0.8, lambdaU: 1.5, description: 'Undesirable outputs weighted more (human-like)' },
  { name: '🎯 Gain Focused', beta: 1.0, lambdaD: 1.5, lambdaU: 0.8, description: 'Prioritize finding good responses over avoiding bad' },
  { name: '🔪 Sharp Cutoff', beta: 2.5, lambdaD: 1.0, lambdaU: 1.0, description: 'High β = rapid saturation near z=0' },
  { name: '🌊 Smooth', beta: 0.4, lambdaD: 1.0, lambdaU: 1.0, description: 'Low β = gradual transition, learns from extreme examples' },
]

function getKTOInsight(beta: number, lambdaD: number, lambdaU: number): { text: string; color: string; emoji: string } {
  const lossAversion = lambdaU / lambdaD
  const isLossAverse = lossAversion > 1.2
  const isGainFocused = lossAversion < 0.8
  const isSharp = beta > 2.0
  const isSmooth = beta < 0.6

  if (isSharp && isLossAverse) {
    return {
      emoji: '⚠️',
      color: '#ef4444',
      text: 'Sharp loss-averse mode: The model strongly punishes any hint of undesirable outputs while quickly saturating on gains. This can lead to overly cautious behavior.'
    }
  }

  if (isSmooth) {
    return {
      emoji: '📈',
      color: '#3b82f6',
      text: `Low β (${beta.toFixed(2)}) means gradual saturation—the model learns from extreme examples too. This can help when you have noisy preference labels.`
    }
  }

  if (isLossAverse) {
    return {
      emoji: '😰',
      color: '#f59e0b',
      text: `Loss aversion ratio: ${lossAversion.toFixed(2)}x. Like Kahneman's prospect theory: "losses loom larger than gains." This models human preference asymmetry.`
    }
  }

  if (isGainFocused) {
    return {
      emoji: '🎯',
      color: '#22c55e',
      text: `Gain-focused (ratio ${lossAversion.toFixed(2)}). The model prioritizes finding excellent responses over avoiding bad ones. Good when your "desirable" labels are high quality.`
    }
  }

  if (isSharp) {
    return {
      emoji: '🔪',
      color: '#a855f7',
      text: `High β (${beta.toFixed(2)}) = sharp transition near z=0. Only borderline examples contribute to learning; extreme examples saturate the sigmoid.`
    }
  }

  return {
    emoji: '⚖️',
    color: '#64748b',
    text: 'Balanced configuration. The value function treats desirable and undesirable examples symmetrically. A good starting point before tuning.'
  }
}

interface KTOVizProps {
  width?: number
  height?: number
}

export default function KTOViz({ width = 600, height = 400 }: KTOVizProps) {
  const [beta, setBeta] = useState(1.0)
  const [lambdaD, setLambdaD] = useState(1.0)
  const [lambdaU, setLambdaU] = useState(1.0)
  const [activePreset, setActivePreset] = useState<string | null>('⚖️ Balanced')

  // ─────────────────────────────────────────────────────────────
  // Game State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [prediction, setPrediction] = useState<BehaviorPrediction>(null);
  const [countdown, setCountdown] = useState(0);
  const [score, setScore] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());

  const currentChallenge = BEHAVIOR_CHALLENGES[currentChallengeIdx];

  // Game control functions
  const startChallenge = (idx: number) => {
    setCurrentChallengeIdx(idx);
    setGamePhase('setup');
    setPrediction(null);
  };

  const submitPrediction = () => {
    if (!prediction) return;
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setGameMode(false);
    setGamePhase('setup');
    setPrediction(null);
    setScore(0);
    setCompletedChallenges(new Set());
    setCurrentChallengeIdx(0);
  };

  // Countdown timer
  useEffect(() => {
    if (gamePhase !== 'countdown' || countdown <= 0) return;
    const timer = setTimeout(() => {
      if (countdown === 1) {
        setGamePhase('revealed');
        // Apply the mystery settings to show the actual curves
        setBeta(currentChallenge.beta);
        setLambdaD(currentChallenge.lambdaD);
        setLambdaU(currentChallenge.lambdaU);
        setActivePreset(null);
        // Check answer
        const feedback = getBehaviorFeedback(prediction, currentChallenge);
        if (feedback.correct) {
          setScore(s => s + 1);
          setCompletedChallenges(prev => new Set([...prev, currentChallengeIdx]));
        }
      } else {
        setCountdown(countdown - 1);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [gamePhase, countdown, prediction, currentChallenge, currentChallengeIdx]);

  const currentInsight = useMemo(() => getKTOInsight(beta, lambdaD, lambdaU), [beta, lambdaD, lambdaU])

  const handlePreset = useCallback((preset: typeof KTO_PRESETS[0]) => {
    setBeta(preset.beta)
    setLambdaD(preset.lambdaD)
    setLambdaU(preset.lambdaU)
    setActivePreset(preset.name)
  }, [])

  const clearActivePreset = () => setActivePreset(null)

  const margin = { top: 20, right: 120, bottom: 60, left: 60 }
  const w = width - margin.left - margin.right
  const h = height - margin.top - margin.bottom

  // Sigmoid function
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x))

  // KTO value functions
  const valueDesirable = (z: number) => lambdaD * sigmoid(beta * z)
  const valueUndesirable = (z: number) => lambdaU * sigmoid(beta * (-z))

  // Generate curve data
  const curveData = useMemo(() => {
    const points = 200
    const zRange = [-4, 4]
    const zScale = d3.scaleLinear()
      .domain([0, points - 1])
      .range(zRange)

    const desirable = []
    const undesirable = []

    for (let i = 0; i < points; i++) {
      const z = zScale(i)
      desirable.push({ z, v: valueDesirable(z) })
      undesirable.push({ z, v: valueUndesirable(z) })
    }

    return { desirable, undesirable }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- valueDesirable/valueUndesirable are stable functions
  }, [beta, lambdaD, lambdaU])

  const xScale = d3.scaleLinear()
    .domain([-4, 4])
    .range([0, w])

  const yScale = d3.scaleLinear()
    .domain([0, Math.max(lambdaD, lambdaU) * 1.1])
    .range([h, 0])

  const lineGen = d3.line<{ z: number; v: number }>()
    .x(d => xScale(d.z))
    .y(d => yScale(d.v))

  return (
    <div className="kto-viz">
      {/* Preset Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {KTO_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            title={preset.description}
            style={{
              fontSize: '0.8rem',
              padding: '0.4rem 0.8rem',
              borderRadius: '999px',
              border: activePreset === preset.name ? '1px solid rgba(245, 158, 11, 0.7)' : '1px solid rgba(148, 163, 184, 0.35)',
              background: activePreset === preset.name ? 'rgba(245, 158, 11, 0.25)' : 'rgba(15, 23, 42, 0.8)',
              color: activePreset === preset.name ? '#fbbf24' : '#d1d5db',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight Box */}
      <div
        style={{
          padding: '12px 16px',
          marginBottom: '1rem',
          borderRadius: '8px',
          background: `linear-gradient(135deg, ${currentInsight.color}15 0%, ${currentInsight.color}08 100%)`,
          border: `1px solid ${currentInsight.color}30`,
        }}
      >
        <span style={{ fontSize: '1.2em', marginRight: '8px' }}>{currentInsight.emoji}</span>
        <span style={{ color: currentInsight.color, fontWeight: 500 }}>Insight:</span>{' '}
        <span style={{ color: '#d1d5db' }}>{currentInsight.text}</span>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Gamification: Behavior Prediction Challenge
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(59, 130, 246, 0.05))',
        border: '1px solid rgba(168, 85, 247, 0.3)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#e5e7eb' }}>🎮 Behavior Prediction Challenge</h4>
          {!gameMode ? (
            <button
              onClick={() => setGameMode(true)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                border: '1px solid rgba(168, 85, 247, 0.5)',
                background: 'rgba(168, 85, 247, 0.2)',
                color: '#c4b5fd',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Start Challenge
            </button>
          ) : (
            <button
              onClick={resetGame}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                border: '1px solid rgba(107, 114, 128, 0.5)',
                background: 'rgba(107, 114, 128, 0.2)',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '0.85rem'
              }}
            >
              Exit Game
            </button>
          )}
          {gameMode && (
            <span style={{
              marginLeft: 'auto',
              background: 'rgba(52, 211, 153, 0.2)',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              padding: '0.25rem 0.75rem',
              borderRadius: '999px',
              fontSize: '0.8rem',
              color: '#34d399'
            }}>
              Score: {score}/{BEHAVIOR_CHALLENGES.length}
            </span>
          )}
        </div>

        {gameMode && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {BEHAVIOR_CHALLENGES.map((ch, idx) => (
                <button
                  key={ch.name}
                  onClick={() => startChallenge(idx)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: currentChallengeIdx === idx
                      ? '1px solid #a855f7'
                      : completedChallenges.has(idx)
                        ? '1px solid rgba(52, 211, 153, 0.4)'
                        : '1px solid rgba(168, 85, 247, 0.3)',
                    background: currentChallengeIdx === idx
                      ? 'rgba(168, 85, 247, 0.25)'
                      : completedChallenges.has(idx)
                        ? 'rgba(52, 211, 153, 0.15)'
                        : 'rgba(15, 23, 42, 0.6)',
                    color: completedChallenges.has(idx) ? '#34d399' : '#e5e7eb',
                    cursor: 'pointer',
                    fontSize: '0.8rem'
                  }}
                >
                  {completedChallenges.has(idx) ? '✅' : ch.name}
                </button>
              ))}
            </div>

            {gamePhase === 'setup' && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontStyle: 'italic', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem' }}>
                  {currentChallenge.hint}
                </p>
                <p style={{ fontWeight: 600, color: '#e5e7eb', marginBottom: '1rem' }}>
                  What behavior will this model exhibit?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {([
                    { key: 'cautious', label: '😰 Cautious' },
                    { key: 'balanced', label: '⚖️ Balanced' },
                    { key: 'aggressive', label: '🎯 Aggressive' },
                    { key: 'extreme-averse', label: '🌊 Smooth' }
                  ] as { key: BehaviorPrediction; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPrediction(opt.key)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: prediction === opt.key
                          ? '2px solid #a855f7'
                          : '2px solid rgba(168, 85, 247, 0.3)',
                        background: prediction === opt.key
                          ? 'rgba(168, 85, 247, 0.3)'
                          : 'rgba(15, 23, 42, 0.8)',
                        color: '#e5e7eb',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: 500
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={submitPrediction}
                  disabled={!prediction}
                  style={{
                    padding: '0.6rem 1.5rem',
                    borderRadius: '8px',
                    border: 'none',
                    background: prediction ? 'linear-gradient(135deg, #a855f7, #6366f1)' : 'rgba(107, 114, 128, 0.3)',
                    color: 'white',
                    cursor: prediction ? 'pointer' : 'not-allowed',
                    fontWeight: 600,
                    opacity: prediction ? 1 : 0.5
                  }}
                >
                  Lock In Prediction
                </button>
              </div>
            )}

            {gamePhase === 'countdown' && (
              <div style={{ textAlign: 'center', padding: '1.5rem' }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 'bold',
                  color: '#a855f7',
                  animation: 'pulse 1s ease-in-out infinite'
                }}>
                  {countdown}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)' }}>Revealing value curves...</p>
              </div>
            )}

            {gamePhase === 'revealed' && (
              <div style={{ textAlign: 'center' }}>
                {(() => {
                  const feedback = getBehaviorFeedback(prediction, currentChallenge);
                  return (
                    <>
                      <div style={{
                        display: 'inline-block',
                        padding: '0.5rem 1.5rem',
                        borderRadius: '999px',
                        fontWeight: 600,
                        marginBottom: '1rem',
                        background: feedback.correct ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                        border: feedback.correct ? '1px solid rgba(52, 211, 153, 0.4)' : '1px solid rgba(251, 191, 36, 0.4)',
                        color: feedback.correct ? '#34d399' : '#fbbf24'
                      }}>
                        {feedback.correct ? '🎉 Correct!' : '💡 Learning opportunity!'}
                      </div>
                      <p style={{ color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, marginBottom: '1rem' }}>
                        {feedback.message}
                      </p>
                      <p style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', marginBottom: '1rem' }}>
                        β: {currentChallenge.beta}, λ_D: {currentChallenge.lambdaD}, λ_U: {currentChallenge.lambdaU}
                      </p>
                      <button
                        onClick={() => {
                          const nextIdx = (currentChallengeIdx + 1) % BEHAVIOR_CHALLENGES.length;
                          startChallenge(nextIdx);
                        }}
                        style={{
                          padding: '0.6rem 1.5rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(168, 85, 247, 0.5)',
                          background: 'rgba(168, 85, 247, 0.2)',
                          color: '#c4b5fd',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {currentChallengeIdx < BEHAVIOR_CHALLENGES.length - 1 ? 'Next Challenge →' : 'Try Again'}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="controls">
        <div className="control-group">
          <label>
            β (temperature): {beta.toFixed(2)}
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={beta}
              onChange={(e) => { setBeta(parseFloat(e.target.value)); clearActivePreset(); }}
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            λ_D (desirable weight): {lambdaD.toFixed(2)}
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={lambdaD}
              onChange={(e) => { setLambdaD(parseFloat(e.target.value)); clearActivePreset(); }}
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            λ_U (undesirable weight): {lambdaU.toFixed(2)}
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={lambdaU}
              onChange={(e) => { setLambdaU(parseFloat(e.target.value)); clearActivePreset(); }}
            />
          </label>
        </div>
      </div>

      <svg width={width} height={height} role="img" aria-label="KTO loss visualization showing how desirable and undesirable responses are weighted differently">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Axes */}
          <g className="axis axis-x" transform={`translate(0,${h})`}>
            {xScale.ticks(8).map(tick => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2="6" stroke="currentColor" />
                <text y="20" textAnchor="middle" fontSize="12" fill="currentColor">
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={w / 2} y="45" textAnchor="middle" fontSize="14" fill="currentColor">
              z = r_θ(x,y) - z_0 (implied reward - baseline)
            </text>
          </g>

          <g className="axis axis-y">
            {yScale.ticks(5).map(tick => (
              <g key={tick} transform={`translate(0,${yScale(tick)})`}>
                <line x2="-6" stroke="currentColor" />
                <text x="-10" textAnchor="end" alignmentBaseline="middle" fontSize="12" fill="currentColor">
                  {tick.toFixed(2)}
                </text>
              </g>
            ))}
            <text
              transform={`translate(-45,${h / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize="14"
              fill="currentColor"
            >
              Value v(x,y)
            </text>
          </g>

          {/* Zero line */}
          <line
            x1={xScale(0)}
            x2={xScale(0)}
            y1={0}
            y2={h}
            stroke="#666"
            strokeDasharray="4,4"
            opacity={0.5}
          />

          {/* Curves */}
          <path
            d={lineGen(curveData.desirable) || ''}
            fill="none"
            stroke="#22c55e"
            strokeWidth={2.5}
          />
          <path
            d={lineGen(curveData.undesirable) || ''}
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.5}
          />

          {/* Legend */}
          <g transform={`translate(${w + 10},20)`}>
            <g>
              <line x1="0" x2="20" y1="0" y2="0" stroke="#22c55e" strokeWidth={2.5} />
              <text x="25" y="5" fontSize="12" fill="currentColor">Desirable</text>
            </g>
            <g transform="translate(0,20)">
              <line x1="0" x2="20" y1="0" y2="0" stroke="#ef4444" strokeWidth={2.5} />
              <text x="25" y="5" fontSize="12" fill="currentColor">Undesirable</text>
            </g>
          </g>
        </g>
      </svg>

      {/* Static insight removed - replaced by dynamic insight box above */}

      <style jsx>{`
        .kto-viz {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 1.5rem;
          margin: 2rem 0;
        }

        .controls {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
        }

        .control-group {
          flex: 1;
          min-width: 200px;
        }

        .control-group label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        input[type="range"] {
          width: 100%;
        }

        svg {
          display: block;
          margin: 0 auto;
        }

        .insight {
          margin-top: 1rem;
          padding: 1rem;
          background: rgba(245, 158, 11, 0.1);
          border-left: 3px solid var(--accent);
          border-radius: 4px;
        }

        .insight p {
          margin: 0;
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--text-secondary);
        }

        .insight strong {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}
