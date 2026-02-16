import { useState, useMemo, useEffect } from 'react'
import * as d3 from 'd3'

/**
 * Sparse Autoencoder Visualization
 * Shows reconstruction-sparsity tradeoff frontier
 * Compares L1 SAE vs TopK SAE approaches
 */

interface SparseAutoencoderVizProps {
  width?: number
  height?: number
}

type SAEType = 'l1' | 'topk' | 'gated'

// Gamification types
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SAEPrediction = SAEType | null

// Mystery challenges for the prediction game
const FRONTIER_CHALLENGES = [
  {
    name: '🎲 Sparse Regime',
    sparsity: 5,
    answer: 'gated' as SAEType,
    description: 'At very low sparsity (k=5), which SAE type reconstructs best?',
  },
  {
    name: '🎲 Dense Regime',
    sparsity: 40,
    answer: 'gated' as SAEType,
    description: 'At high sparsity (k=40), do the frontiers converge?',
  },
  {
    name: '🎲 Shrinkage Zone',
    sparsity: 15,
    answer: 'gated' as SAEType,
    description: 'Mid-range: where does L1 shrinkage hurt most?',
  },
  {
    name: '🎲 OpenAI Range',
    sparsity: 32,
    answer: 'gated' as SAEType,
    description: 'Near OpenAI\'s k≈100 (scaled): which dominates?',
  },
];

// Feedback based on prediction accuracy
const getFrontierFeedback = (
  predicted: SAEPrediction,
  actual: SAEType,
  sparsity: number,
  mseValues: { l1: number; topk: number; gated: number }
): string => {
  const correct = predicted === actual;
  const _mseSorted = Object.entries(mseValues)
    .sort(([, a], [, b]) => a - b)
    .map(([type]) => type);

  if (correct) {
    if (actual === 'gated') {
      return `🎯 Correct! Gated SAE wins with MSE=${mseValues.gated.toFixed(3)}. It fixes L1's shrinkage bias by separating "which features" (gate) from "how much" (magnitude). At k=${sparsity}, L1 has MSE=${mseValues.l1.toFixed(3)} while TopK has ${mseValues.topk.toFixed(3)}.`;
    }
    if (actual === 'topk') {
      return `🎯 Correct! TopK wins here. At this sparsity, directly selecting top-k features beats L1's soft thresholding. MSE ranking: TopK(${mseValues.topk.toFixed(3)}) < Gated(${mseValues.gated.toFixed(3)}) < L1(${mseValues.l1.toFixed(3)}).`;
    }
    return `🎯 Surprising! L1 wins at k=${sparsity}. This is rare—typically Gated or TopK dominate.`;
  }

  // Wrong prediction
  return `❌ ${actual.charAt(0).toUpperCase() + actual.slice(1)} wins! At k=${sparsity}: Gated(${mseValues.gated.toFixed(3)}) < TopK(${mseValues.topk.toFixed(3)}) < L1(${mseValues.l1.toFixed(3)}). L1's shrinkage bias means active features are pushed toward zero, hurting reconstruction. Gated and TopK avoid this.`;
};

// Operating point presets based on real SAE research
const OPERATING_PRESETS = [
  { name: '🔬 Minimal', type: 'topk' as SAEType, k: 5, description: 'Ultra-sparse (5 features/token), extreme interpretability' },
  { name: '📊 Anthropic', type: 'gated' as SAEType, k: 20, description: 'Anthropic-style: ~20 active features, interpretable' },
  { name: '🚀 OpenAI GPT-4', type: 'topk' as SAEType, k: 32, description: 'OpenAI 16M SAE: k≈100 features (scaled)' },
  { name: '💪 High Fidelity', type: 'gated' as SAEType, k: 45, description: 'Best reconstruction, less sparse' },
];

// Dynamic educational insight
function getSAEInsight(
  selectedType: SAEType,
  sparsityParam: number,
  currentMSE: number
): string {
  if (selectedType === 'l1' && sparsityParam < 10) {
    return `⚠️ L1 SAE with high λ: very sparse but suffers from SHRINKAGE BIAS—active features are pushed toward zero. TopK or Gated fix this by separating "which features" from "how much".`;
  }

  if (selectedType === 'topk') {
    if (sparsityParam <= 5) {
      return `🎯 TopK with k=${sparsityParam}: Ultra-sparse! Only ${sparsityParam} features fire per token. Great for finding the most important features, but reconstruction suffers (MSE ≈ ${currentMSE.toFixed(3)}).`;
    }
    if (sparsityParam >= 30) {
      return `🚀 TopK with k=${sparsityParam}: Near-perfect reconstruction (MSE ≈ ${currentMSE.toFixed(3)})! This is close to OpenAI's GPT-4 SAE operating point. Good balance of interpretability and fidelity.`;
    }
    return `📊 TopK with k=${sparsityParam}: Exactly ${sparsityParam} features activate per token. No λ tuning needed! MSE ≈ ${currentMSE.toFixed(3)}. Move the slider to explore the reconstruction-sparsity frontier.`;
  }

  if (selectedType === 'gated') {
    return `🌟 Gated SAE: Best of both worlds! Separate gates for "which features" and "how much". Notice it dominates L1 everywhere on the frontier. MSE ≈ ${currentMSE.toFixed(3)} at L0=${sparsityParam}.`;
  }

  return `📈 L1 SAE with L0≈${sparsityParam}: Reconstruction MSE ≈ ${currentMSE.toFixed(3)}. L1 penalty creates shrinkage bias—try TopK or Gated for a better frontier!`;
}

export default function SparseAutoencoderViz({ width = 600, height = 400 }: SparseAutoencoderVizProps) {
  const [selectedType, setSelectedType] = useState<SAEType>('topk')
  const [sparsityParam, setSparsityParam] = useState(10)

  // Game state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<typeof FRONTIER_CHALLENGES[0] | null>(null)
  const [prediction, setPrediction] = useState<SAEPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState({ correct: 0, total: 0 })

  const margin = { top: 20, right: 120, bottom: 60, left: 70 }
  const w = width - margin.left - margin.right
  const h = height - margin.top - margin.bottom

  // Generate Pareto frontier data for different SAE types
  const frontierData = useMemo(() => {
    const points = 50
    const sparsityRange = [0.5, 50] // L0 sparsity (average active features)

    const generateFrontier = (saeType: SAEType) => {
      const data = []
      for (let i = 0; i < points; i++) {
        const t = i / (points - 1)
        const sparsity = sparsityRange[0] + t * (sparsityRange[1] - sparsityRange[0])

        // Reconstruction error (MSE) - decreases with more active features
        let recon: number
        if (saeType === 'l1') {
          // L1 SAE: gradual improvement but with shrinkage bias
          recon = 0.05 + 0.4 / (1 + sparsity / 8)
        } else if (saeType === 'topk') {
          // TopK SAE: better frontier (no shrinkage)
          recon = 0.02 + 0.35 / (1 + sparsity / 6)
        } else {
          // Gated SAE: best frontier
          recon = 0.015 + 0.3 / (1 + sparsity / 5)
        }

        data.push({ sparsity, recon })
      }
      return data
    }

    return {
      l1: generateFrontier('l1'),
      topk: generateFrontier('topk'),
      gated: generateFrontier('gated')
    }
  }, [])

  const xScale = d3.scaleLinear()
    .domain([0, 50])
    .range([0, w])

  const yScale = d3.scaleLinear()
    .domain([0, 0.5])
    .range([h, 0])

  const lineGen = d3.line<{ sparsity: number; recon: number }>()
    .x(d => xScale(d.sparsity))
    .y(d => yScale(d.recon))

  const saeColors = {
    l1: '#8b5cf6',
    topk: '#22c55e',
    gated: '#f59e0b'
  }

  const saeLabels = {
    l1: 'L1 SAE (tune λ)',
    topk: 'TopK SAE (set k)',
    gated: 'Gated SAE'
  }

  // Get current operating point MSE
  const currentMSE = useMemo(() => {
    const data = frontierData[selectedType]
    const idx = Math.min(
      Math.floor((sparsityParam / 50) * data.length),
      data.length - 1
    )
    return data[idx]?.recon ?? 0
  }, [frontierData, selectedType, sparsityParam])

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getSAEInsight(selectedType, sparsityParam, currentMSE)
  }, [selectedType, sparsityParam, currentMSE])

  // Handle preset selection
  const handlePreset = (preset: typeof OPERATING_PRESETS[0]) => {
    setSelectedType(preset.type)
    setSparsityParam(preset.k)
  }

  // Calculate MSE for all SAE types at a given sparsity
  const getMSEAtSparsity = (sparsity: number) => {
    const getRecon = (type: SAEType, s: number) => {
      if (type === 'l1') return 0.05 + 0.4 / (1 + s / 8);
      if (type === 'topk') return 0.02 + 0.35 / (1 + s / 6);
      return 0.015 + 0.3 / (1 + s / 5);
    };
    return {
      l1: getRecon('l1', sparsity),
      topk: getRecon('topk', sparsity),
      gated: getRecon('gated', sparsity),
    };
  };

  // Game control functions
  const startChallenge = (challenge: typeof FRONTIER_CHALLENGES[0]) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setGamePhase('setup');
  };

  const submitPrediction = (pred: SAEPrediction) => {
    if (!selectedChallenge || !pred) return;
    setPrediction(pred);
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setGamePhase('setup');
    setSelectedChallenge(null);
    setPrediction(null);
  };

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          // Reveal phase - show the result at the challenge sparsity
          if (selectedChallenge) {
            setSparsityParam(selectedChallenge.sparsity);
            setSelectedType(selectedChallenge.answer);

            // Update score
            const correct = prediction === selectedChallenge.answer;
            setScore(prev => ({
              correct: prev.correct + (correct ? 1 : 0),
              total: prev.total + 1,
            }));
          }
          setGamePhase('revealed');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gamePhase, selectedChallenge, prediction]);

  return (
    <div className="sae-viz">
      {/* Game Mode Toggle */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
        <button
          onClick={() => {
            setGameMode(!gameMode);
            if (!gameMode) resetGame();
          }}
          style={{
            fontSize: '0.8rem',
            padding: '0.35rem 0.85rem',
            borderRadius: '999px',
            border: gameMode ? '1px solid #8b5cf6' : '1px solid rgba(139, 92, 246, 0.3)',
            background: gameMode
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(139, 92, 246, 0.1))'
              : 'rgba(15, 23, 42, 0.9)',
            color: gameMode ? '#c4b5fd' : '#e5e7eb',
            cursor: 'pointer',
            fontWeight: gameMode ? 600 : 400,
          }}
        >
          {gameMode ? '🎮 Challenge Mode' : '🎮 Try Challenge'}
        </button>
        {gameMode && score.total > 0 && (
          <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
          </span>
        )}
      </div>

      {/* Game Panel */}
      {gameMode && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.85rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(245, 158, 11, 0.1))',
          border: '1px solid rgba(139, 92, 246, 0.3)',
        }}>
          {gamePhase === 'setup' && !selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#c4b5fd', marginBottom: '0.5rem', fontWeight: 600 }}>
                🎯 Frontier Prediction Challenge
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                At a mystery sparsity level, which SAE type will have the lowest reconstruction error?
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {FRONTIER_CHALLENGES.map((challenge) => (
                  <button
                    key={challenge.name}
                    onClick={() => startChallenge(challenge)}
                    title={challenge.description}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.4rem 0.7rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(139, 92, 246, 0.3)',
                      background: 'rgba(15, 23, 42, 0.9)',
                      color: '#e5e7eb',
                      cursor: 'pointer',
                    }}
                  >
                    {challenge.name}
                  </button>
                ))}
              </div>
            </>
          )}

          {gamePhase === 'setup' && selectedChallenge && (
            <>
              <p style={{ fontSize: '0.85rem', color: '#c4b5fd', marginBottom: '0.4rem', fontWeight: 600 }}>
                {selectedChallenge.name}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#9ca3af', marginBottom: '0.6rem' }}>
                {selectedChallenge.description}
              </p>
              <p style={{ fontSize: '0.78rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                Which SAE type will have the LOWEST MSE at k={selectedChallenge.sparsity}?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => submitPrediction('l1')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    border: '1px solid #8b5cf6',
                    background: 'rgba(139, 92, 246, 0.15)',
                    color: '#a78bfa',
                    cursor: 'pointer',
                  }}
                >
                  🔮 L1 SAE
                </button>
                <button
                  onClick={() => submitPrediction('topk')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    border: '1px solid #22c55e',
                    background: 'rgba(34, 197, 94, 0.15)',
                    color: '#22c55e',
                    cursor: 'pointer',
                  }}
                >
                  🎯 TopK SAE
                </button>
                <button
                  onClick={() => submitPrediction('gated')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.5rem 0.9rem',
                    borderRadius: '6px',
                    border: '1px solid #f59e0b',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    cursor: 'pointer',
                  }}
                >
                  🌟 Gated SAE
                </button>
              </div>
            </>
          )}

          {gamePhase === 'countdown' && (
            <div style={{ textAlign: 'center', padding: '1.5rem 0' }}>
              <p style={{ fontSize: '0.95rem', color: '#c4b5fd', marginBottom: '0.5rem' }}>
                You predicted: <strong>{prediction?.toUpperCase()}</strong>
              </p>
              <p style={{ fontSize: '2.2rem', color: '#e5e7eb', fontWeight: 700 }}>
                {countdown}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Comparing frontiers at k={selectedChallenge?.sparsity}...</p>
            </div>
          )}

          {gamePhase === 'revealed' && selectedChallenge && (
            <>
              <div style={{
                padding: '0.65rem',
                borderRadius: '8px',
                background: prediction === selectedChallenge.answer
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(239, 68, 68, 0.15)',
                border: prediction === selectedChallenge.answer
                  ? '1px solid rgba(34, 197, 94, 0.3)'
                  : '1px solid rgba(239, 68, 68, 0.3)',
                marginBottom: '0.65rem',
              }}>
                <p style={{ fontSize: '0.8rem', color: '#e5e7eb', lineHeight: 1.5 }}>
                  {getFrontierFeedback(
                    prediction,
                    selectedChallenge.answer,
                    selectedChallenge.sparsity,
                    getMSEAtSparsity(selectedChallenge.sparsity)
                  )}
                </p>
              </div>
              <button
                onClick={resetGame}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.4rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  background: 'rgba(15, 23, 42, 0.9)',
                  color: '#e5e7eb',
                  cursor: 'pointer',
                }}
              >
                Try Another
              </button>
            </>
          )}
        </div>
      )}

      {/* Operating Point Presets */}
      <div className="presets">
        {OPERATING_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            className={`preset-btn ${selectedType === preset.type && sparsityParam === preset.k ? 'active' : ''}`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight */}
      <div
        className="dynamic-insight"
        style={{
          background: currentInsight.includes('🌟') || currentInsight.includes('🚀')
            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.05))'
            : currentInsight.includes('⚠️')
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
          border: currentInsight.includes('🌟') || currentInsight.includes('🚀')
            ? '1px solid rgba(52, 211, 153, 0.3)'
            : currentInsight.includes('⚠️')
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="controls">
        <div className="control-group">
          <label>SAE Type:</label>
          <div className="button-group">
            {(['l1', 'topk', 'gated'] as SAEType[]).map(type => (
              <button
                key={type}
                className={selectedType === type ? 'active' : ''}
                onClick={() => setSelectedType(type)}
                style={{ borderColor: saeColors[type] }}
              >
                {saeLabels[type]}
              </button>
            ))}
          </div>
        </div>
        <div className="control-group">
          <label>
            {selectedType === 'topk' ? 'k (active features)' : 'Target sparsity'}: {sparsityParam}
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={sparsityParam}
              onChange={(e) => setSparsityParam(parseInt(e.target.value))}
            />
          </label>
        </div>
      </div>

      <svg width={width} height={height} role="img" aria-label="Sparse autoencoder visualization showing L0 sparsity vs reconstruction loss tradeoff">
        <g transform={`translate(${margin.left},${margin.top})`}>
          {/* Axes */}
          <g className="axis axis-x" transform={`translate(0,${h})`}>
            {xScale.ticks(5).map(tick => (
              <g key={tick} transform={`translate(${xScale(tick)},0)`}>
                <line y2="6" stroke="currentColor" />
                <text y="20" textAnchor="middle" fontSize="12" fill="currentColor">
                  {tick}
                </text>
              </g>
            ))}
            <text x={w / 2} y="45" textAnchor="middle" fontSize="14" fill="currentColor">
              L0 Sparsity (average active features per token)
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
              transform={`translate(-55,${h / 2}) rotate(-90)`}
              textAnchor="middle"
              fontSize="14"
              fill="currentColor"
            >
              Reconstruction Error (MSE)
            </text>
          </g>

          {/* Grid */}
          <g className="grid" opacity={0.05}>
            {xScale.ticks(10).map(tick => (
              <line
                key={`v-${tick}`}
                x1={xScale(tick)}
                x2={xScale(tick)}
                y1={0}
                y2={h}
                stroke="currentColor"
              />
            ))}
            {yScale.ticks(10).map(tick => (
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

          {/* Pareto frontiers */}
          {Object.entries(frontierData).map(([type, data]) => (
            <path
              key={type}
              d={lineGen(data) || ''}
              fill="none"
              stroke={saeColors[type as SAEType]}
              strokeWidth={selectedType === type ? 3 : 1.5}
              opacity={selectedType === type ? 1 : 0.3}
            />
          ))}

          {/* Current operating point */}
          {(() => {
            const data = frontierData[selectedType]
            const idx = Math.min(
              Math.floor((sparsityParam / 50) * data.length),
              data.length - 1
            )
            const point = data[idx]
            return (
              <g>
                <circle
                  cx={xScale(point.sparsity)}
                  cy={yScale(point.recon)}
                  r={6}
                  fill={saeColors[selectedType]}
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={xScale(point.sparsity)}
                  y={yScale(point.recon) - 15}
                  textAnchor="middle"
                  fontSize="11"
                  fill={saeColors[selectedType]}
                  fontWeight="bold"
                >
                  Operating point
                </text>
              </g>
            )
          })()}

          {/* Legend */}
          <g transform={`translate(${w + 10},20)`}>
            {(['l1', 'topk', 'gated'] as SAEType[]).map((type, i) => (
              <g key={type} transform={`translate(0,${i * 25})`}>
                <line
                  x1="0"
                  x2="20"
                  y1="0"
                  y2="0"
                  stroke={saeColors[type]}
                  strokeWidth={selectedType === type ? 3 : 1.5}
                />
                <text x="25" y="5" fontSize="11" fill="currentColor">
                  {saeLabels[type]}
                </text>
              </g>
            ))}
          </g>

          {/* Annotation */}
          <g transform={`translate(${w * 0.15},${h * 0.2})`}>
            <text fontSize="10" fill="#f59e0b" fontStyle="italic">
              Better →
            </text>
            <text y="12" fontSize="9" fill="#f59e0b" opacity={0.8}>
              (lower error, same sparsity)
            </text>
          </g>
        </g>
      </svg>

      <div className="insight">
        <p>
          <strong>Reconstruction-Sparsity Frontier:</strong> SAEs trade reconstruction quality
          for interpretability (sparsity). TopK directly controls k active features per token,
          making tuning easier than L1 penalty. Gated SAEs fix L1 shrinkage bias for the best frontier.
          OpenAI's 16M-latent SAE on GPT-4 uses TopK with k≈100 features per token.
        </p>
      </div>

      <style jsx>{`
        .sae-viz {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 1.5rem;
          margin: 2rem 0;
        }

        .presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .preset-btn {
          font-size: 0.8rem;
          padding: 0.4rem 0.8rem;
          border-radius: 999px;
          border: 1px solid rgba(139, 92, 246, 0.25);
          background: rgba(15, 23, 42, 0.8);
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease-out;
        }

        .preset-btn:hover {
          background: rgba(139, 92, 246, 0.15);
          border-color: rgba(139, 92, 246, 0.5);
        }

        .preset-btn.active {
          background: rgba(139, 92, 246, 0.25);
          border-color: rgba(139, 92, 246, 0.7);
          color: #c4b5fd;
        }

        .dynamic-insight {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
          font-size: 0.88rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .controls {
          display: flex;
          gap: 2rem;
          margin-bottom: 1.5rem;
          flex-wrap: wrap;
          align-items: flex-start;
        }

        .control-group {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .control-group label {
          font-size: 0.9rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        .button-group {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .button-group button {
          padding: 0.5rem 1rem;
          background: rgba(8, 12, 20, 0.8);
          border: 2px solid;
          border-radius: 6px;
          color: var(--text-primary);
          font-size: 0.85rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .button-group button:hover {
          background: rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
        }

        .button-group button.active {
          background: rgba(245, 158, 11, 0.2);
          font-weight: bold;
        }

        input[type="range"] {
          width: 100%;
          min-width: 200px;
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
