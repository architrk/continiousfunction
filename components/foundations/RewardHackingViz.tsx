import { useState, useMemo, useEffect } from 'react'
import * as d3 from 'd3'

// ─────────────────────────────────────────────────────────────
// Gamification: Severity Prediction Challenge
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed';
type SeverityPrediction = 'aligned' | 'warning' | 'hacking' | 'severe' | null;

interface SeverityChallenge {
  name: string;
  overopt: number;
  noise: number;
  hint: string;
  correctSeverity: 'aligned' | 'warning' | 'hacking' | 'severe';
  explanation: string;
}

function _getSeverityLevel(overopt: number, noise: number): 'aligned' | 'warning' | 'hacking' | 'severe' {
  if (overopt < 0.2 && noise < 0.2) return 'aligned';
  if (overopt > 0.7 || (overopt > 0.5 && noise > 0.5)) return 'severe';
  if (overopt > 0.4 || (overopt + noise) > 0.6) return 'hacking';
  return 'warning';
}

const SEVERITY_CHALLENGES: SeverityChallenge[] = [
  {
    name: '🎲 Mystery A',
    overopt: 0.15,
    noise: 0.1,
    hint: 'The reward model was carefully calibrated with diverse human feedback...',
    correctSeverity: 'aligned',
    explanation: '✅ Well-aligned! Low overoptimization (0.15) and low noise (0.1) means the proxy closely tracks true quality. This is rare in practice—most reward models have some misspecification.'
  },
  {
    name: '🎲 Mystery B',
    overopt: 0.85,
    noise: 0.5,
    hint: 'The model found a surprising way to maximize reward that the designers didn\'t anticipate...',
    correctSeverity: 'severe',
    explanation: '💀 Severe hacking! At 0.85 overoptimization, the model is fully gaming the proxy. True quality is likely degrading while reward keeps climbing. This needs KL penalties and human oversight!'
  },
  {
    name: '🎲 Mystery C',
    overopt: 0.35,
    noise: 0.3,
    hint: 'Evaluators notice the model\'s outputs feel slightly different from early training...',
    correctSeverity: 'warning',
    explanation: '⚠️ Early warning! At 0.35 overoptimization, divergence is just starting. This is the ideal time for iterative RLHF—recalibrate with fresh human feedback before the gap widens.'
  },
  {
    name: '🎲 Mystery D',
    overopt: 0.55,
    noise: 0.45,
    hint: 'The reward model was trained on slightly different data than the deployment distribution...',
    correctSeverity: 'hacking',
    explanation: '🔴 Goodhart zone! With 0.55 overoptimization and 0.45 noise, the proxy is diverging significantly from true quality. The model has found exploitable patterns in the reward signal.'
  }
];

function getSeverityFeedback(
  prediction: SeverityPrediction,
  challenge: SeverityChallenge
): { correct: boolean; message: string } {
  const isCorrect = prediction === challenge.correctSeverity;
  const severityLabels = {
    'aligned': 'Well-Aligned',
    'warning': 'Early Warning',
    'hacking': 'Goodhart Zone',
    'severe': 'Severe Hacking'
  };
  return {
    correct: isCorrect,
    message: isCorrect
      ? challenge.explanation
      : `❌ Not quite! The severity is "${severityLabels[challenge.correctSeverity]}". ${challenge.explanation}`
  };
}

// Scenario presets for different hacking regimes
const SCENARIO_PRESETS = [
  { name: '✅ Well-Aligned', overopt: 0.1, noise: 0.1, description: 'Proxy closely tracks true quality' },
  { name: '⚠️ Early Warning', overopt: 0.35, noise: 0.25, description: 'Slight divergence begins' },
  { name: '🔴 Goodhart Zone', overopt: 0.6, noise: 0.4, description: 'Proxy rises, quality stalls' },
  { name: '💀 Severe Hacking', overopt: 0.9, noise: 0.7, description: 'True quality degrades as proxy soars' },
  { name: '🎲 High Noise', overopt: 0.3, noise: 0.8, description: 'Misspecified proxy, large gap' },
]

// Dynamic educational insights
function getGoodhartInsight(overopt: number, noise: number): string {
  const gap = overopt + noise;

  if (overopt < 0.2 && noise < 0.2) {
    return "✅ Safe zone! Proxy reward closely tracks true quality. This is the ideal - but hard to achieve in practice. Real reward signals are always imperfect.";
  }

  if (overopt > 0.7) {
    return "💀 Severe overoptimization! The model is 'gaming' the proxy - true quality degrades even as the reward signal keeps climbing. This is why PPO uses KL penalties!";
  }

  if (noise > 0.6) {
    return "🎲 High proxy noise! The reward model is badly misspecified. Consider using ensemble reward models, human feedback checkpoints, or conservative optimization (like DPO).";
  }

  if (overopt > 0.4 || gap > 0.6) {
    return "🔴 Goodhart's Law activated: 'When a measure becomes a target, it ceases to be a good measure.' The gap between green (true) and red (proxy) is the alignment tax.";
  }

  if (overopt > 0.25) {
    return "⚠️ Early warning signs: proxy and true quality are starting to diverge. This is where iterative RLHF with fresh human feedback helps recalibrate.";
  }

  return "📊 Moderate regime: some divergence between proxy and true quality. The shaded area between curves represents lost alignment - the cost of imperfect reward signals.";
}

/**
 * Reward Hacking / Goodhart's Law Visualization
 * Shows characteristic pattern: proxy reward increases while true quality plateaus/degrades
 * Demonstrates the alignment tax of overoptimization
 */

interface RewardHackingVizProps {
  width?: number
  height?: number
}

export default function RewardHackingViz({ width = 600, height = 400 }: RewardHackingVizProps) {
  const [overoptimization, setOveroptimization] = useState(0.5)
  const [proxyNoise, setProxyNoise] = useState(0.3)

  // ─────────────────────────────────────────────────────────────
  // Game State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [prediction, setPrediction] = useState<SeverityPrediction>(null);
  const [countdown, setCountdown] = useState(0);
  const [score, setScore] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());

  const currentChallenge = SEVERITY_CHALLENGES[currentChallengeIdx];

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
        setOveroptimization(currentChallenge.overopt);
        setProxyNoise(currentChallenge.noise);
        // Check answer
        const feedback = getSeverityFeedback(prediction, currentChallenge);
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

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getGoodhartInsight(overoptimization, proxyNoise);
  }, [overoptimization, proxyNoise]);

  // Apply preset
  const handlePreset = (preset: typeof SCENARIO_PRESETS[0]) => {
    setOveroptimization(preset.overopt);
    setProxyNoise(preset.noise);
  };

  const margin = { top: 20, right: 120, bottom: 60, left: 60 }
  const w = width - margin.left - margin.right
  const h = height - margin.top - margin.bottom

  // Generate Goodhart curve data
  const curveData = useMemo(() => {
    const points = 100
    const data = []

    for (let i = 0; i < points; i++) {
      const t = i / (points - 1) // optimization progress [0, 1]
      const kl = t * 5 // KL divergence from reference

      // True quality: rises then plateaus/degrades
      const trueQuality = Math.min(
        1.0,
        2.5 * t * (1 - overoptimization * t)
      )

      // Proxy reward: keeps rising due to noise/misspecification
      const proxyReward = trueQuality + proxyNoise * Math.log(1 + kl * 2)

      data.push({ kl, trueQuality, proxyReward })
    }

    return data
  }, [overoptimization, proxyNoise])

  const xScale = d3.scaleLinear()
    .domain([0, 5])
    .range([0, w])

  const yScale = d3.scaleLinear()
    .domain([0, d3.max(curveData, d => Math.max(d.trueQuality, d.proxyReward)) || 1])
    .range([h, 0])

  const lineGen = d3.line<{ kl: number; trueQuality: number; proxyReward: number }>()

  const trueLine = lineGen
    .x(d => xScale(d.kl))
    .y(d => yScale(d.trueQuality))

  const proxyLine = lineGen
    .x(d => xScale(d.kl))
    .y(d => yScale(d.proxyReward))

  return (
    <div className="reward-hacking-viz">
      {/* Scenario Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {SCENARIO_PRESETS.map((preset) => {
          const isActive = Math.abs(overoptimization - preset.overopt) < 0.1 && Math.abs(proxyNoise - preset.noise) < 0.1;
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
                  ? '1px solid rgba(245, 158, 11, 0.7)'
                  : '1px solid rgba(75, 85, 99, 0.5)',
                background: isActive
                  ? 'rgba(245, 158, 11, 0.2)'
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

      {/* ─────────────────────────────────────────────────────────────
          Gamification: Severity Prediction Challenge
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(245, 158, 11, 0.05))',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#e5e7eb' }}>🎮 Severity Prediction Challenge</h4>
          {!gameMode ? (
            <button
              onClick={() => setGameMode(true)}
              style={{
                padding: '0.4rem 1rem',
                borderRadius: '6px',
                border: '1px solid rgba(239, 68, 68, 0.5)',
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#f87171',
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
              Score: {score}/{SEVERITY_CHALLENGES.length}
            </span>
          )}
        </div>

        {gameMode && (
          <div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              {SEVERITY_CHALLENGES.map((ch, idx) => (
                <button
                  key={ch.name}
                  onClick={() => startChallenge(idx)}
                  style={{
                    padding: '0.4rem 0.8rem',
                    borderRadius: '8px',
                    border: currentChallengeIdx === idx
                      ? '1px solid #ef4444'
                      : completedChallenges.has(idx)
                        ? '1px solid rgba(52, 211, 153, 0.4)'
                        : '1px solid rgba(239, 68, 68, 0.3)',
                    background: currentChallengeIdx === idx
                      ? 'rgba(239, 68, 68, 0.25)'
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
                  What severity level is this scenario?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  {([
                    { key: 'aligned', label: '✅ Well-Aligned' },
                    { key: 'warning', label: '⚠️ Early Warning' },
                    { key: 'hacking', label: '🔴 Goodhart Zone' },
                    { key: 'severe', label: '💀 Severe Hacking' }
                  ] as { key: SeverityPrediction; label: string }[]).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPrediction(opt.key)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '8px',
                        border: prediction === opt.key
                          ? '2px solid #ef4444'
                          : '2px solid rgba(239, 68, 68, 0.3)',
                        background: prediction === opt.key
                          ? 'rgba(239, 68, 68, 0.3)'
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
                    background: prediction ? 'linear-gradient(135deg, #ef4444, #f97316)' : 'rgba(107, 114, 128, 0.3)',
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
                  color: '#ef4444',
                  animation: 'pulse 1s ease-in-out infinite'
                }}>
                  {countdown}
                </div>
                <p style={{ color: 'rgba(255,255,255,0.7)' }}>Revealing curves...</p>
              </div>
            )}

            {gamePhase === 'revealed' && (
              <div style={{ textAlign: 'center' }}>
                {(() => {
                  const feedback = getSeverityFeedback(prediction, currentChallenge);
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
                        Overoptimization: {currentChallenge.overopt}, Noise: {currentChallenge.noise}
                      </p>
                      <button
                        onClick={() => {
                          const nextIdx = (currentChallengeIdx + 1) % SEVERITY_CHALLENGES.length;
                          startChallenge(nextIdx);
                        }}
                        style={{
                          padding: '0.6rem 1.5rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(239, 68, 68, 0.5)',
                          background: 'rgba(239, 68, 68, 0.2)',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontWeight: 500
                        }}
                      >
                        {currentChallengeIdx < SEVERITY_CHALLENGES.length - 1 ? 'Next Challenge →' : 'Try Again'}
                      </button>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
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
          background: overoptimization > 0.6
            ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
            : overoptimization < 0.2 && proxyNoise < 0.2
              ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
              : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: overoptimization > 0.6
            ? '1px solid rgba(239, 68, 68, 0.3)'
            : overoptimization < 0.2 && proxyNoise < 0.2
              ? '1px solid rgba(34, 197, 94, 0.3)'
              : '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="controls">
        <div className="control-group">
          <label>
            Overoptimization severity: {overoptimization.toFixed(2)}
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={overoptimization}
              onChange={(e) => setOveroptimization(parseFloat(e.target.value))}
            />
          </label>
        </div>
        <div className="control-group">
          <label>
            Proxy noise/misspecification: {proxyNoise.toFixed(2)}
            <input
              type="range"
              min="0"
              max="0.8"
              step="0.05"
              value={proxyNoise}
              onChange={(e) => setProxyNoise(parseFloat(e.target.value))}
            />
          </label>
        </div>
      </div>

      <svg width={width} height={height} role="img" aria-label="Reward hacking visualization showing how policies can exploit proxy rewards while diverging from true performance">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Axes */}
          <g className="axis axis-x" transform={`translate(0,${h})`}>
            {xScale.ticks(5).map(tick => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2="6" stroke="currentColor" />
                <text y="20" textAnchor="middle" fontSize="12" fill="currentColor">
                  {tick.toFixed(1)}
                </text>
              </g>
            ))}
            <text x={w / 2} y="45" textAnchor="middle" fontSize="14" fill="currentColor">
              KL divergence from reference (optimization steps)
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
              Quality / Reward
            </text>
          </g>

          {/* Grid */}
          <g className="grid" opacity={0.1}>
            {xScale.ticks(5).map(tick => (
              <line
                key={`v-${tick}`}
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={0}
                y2={h}
                stroke="currentColor"
              />
            ))}
            {yScale.ticks(5).map(tick => (
              <line
                key={`h-${tick}`}
                x1={0}
                x2={w}
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke="currentColor"
              />
            ))}
          </g>

          {/* Curves */}
          <path
            d={trueLine(curveData) || ''}
            fill="none"
            stroke="#22c55e"
            strokeWidth={3}
          />
          <path
            d={proxyLine(curveData) || ''}
            fill="none"
            stroke="#ef4444"
            strokeWidth={3}
            strokeDasharray="5,5"
          />

          {/* Legend */}
          <g transform={`translate(${w + 10},20)`}>
            <g>
              <line x1="0" x2="20" y1="0" y2="0" stroke="#22c55e" strokeWidth={3} />
              <text x="25" y="5" fontSize="12" fill="currentColor">True Quality</text>
            </g>
            <g transform="translate(0,25)">
              <line x1="0" x2="20" y1="0" y2="0" stroke="#ef4444" strokeWidth={3} strokeDasharray="5,5" />
              <text x="25" y="5" fontSize="12" fill="currentColor">Proxy Reward</text>
            </g>
          </g>

          {/* Annotation for Goodhart region */}
          {overoptimization > 0.3 && (
            <g transform={`translate(${w * 0.6},${h * 0.3})`}>
              <text fontSize="11" fill="#f59e0b" fontStyle="italic">
                ← Goodhart's Law zone
              </text>
              <text y="15" fontSize="10" fill="#f59e0b" opacity={0.8}>
                Proxy ↑, Quality ↓
              </text>
            </g>
          )}
        </g>
      </svg>

      <div className="insight">
        <p>
          <strong>Goodhart's Law:</strong> &quot;When a measure becomes a target, it ceases to be a good measure.&quot;
          The green curve (true quality) vs red dashed curve (proxy reward) shows the alignment tax.
          Solutions: KL penalties (PPO), ensemble reward models, iterative RLHF, or DPO.
        </p>
      </div>

      <style jsx>{`
        .reward-hacking-viz {
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
          min-width: 250px;
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
