'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { MATH_COLORS } from '../../lib/mathObjects';

interface TokenProposal {
  token: string;
  draftProb: number;
  targetProb: number;
  accepted: boolean;
}

// ─────────────────────────────────────────────────────────────
// Gamification: Speedup Prediction Challenge
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed';
type SpeedupPrediction = '<1×' | '1-2×' | '2-3×' | '>3×' | null;

interface SpeedupChallenge {
  name: string;
  quality: number;
  k: number;
  hint: string;
  correctRange: '<1×' | '1-2×' | '2-3×' | '>3×';
  explanation: string;
}

// Calculate expected speedup from quality and k
function calculateExpectedSpeedup(quality: number, k: number): number {
  // Approximate acceptance rate ≈ quality (simplified model)
  const alpha = quality;
  return (alpha * k) / (1 + (1 - alpha) * k);
}

function _getSpeedupRange(speedup: number): '<1×' | '1-2×' | '2-3×' | '>3×' {
  if (speedup < 1) return '<1×';
  if (speedup < 2) return '1-2×';
  if (speedup < 3) return '2-3×';
  return '>3×';
}

const SPEEDUP_CHALLENGES: SpeedupChallenge[] = [
  {
    name: '🎲 Mystery A',
    quality: 0.95,
    k: 6,
    hint: 'An excellent draft model proposes 6 tokens...',
    correctRange: '>3×',
    explanation: '🚀 >3× speedup! With 95% acceptance and k=6, almost every draft token is accepted. The speedup formula gives (0.95×6)/(1+(0.05)×6) ≈ 4.4×. This is the ideal scenario!'
  },
  {
    name: '🎲 Mystery B',
    quality: 0.3,
    k: 5,
    hint: 'A poor draft model tries to speculate 5 tokens...',
    correctRange: '<1×',
    explanation: '💔 <1× speedup (actually slower)! With only 30% acceptance, most tokens are rejected. We waste time running the draft model only to reject its proposals. The formula gives ~0.6×—worse than no speculation!'
  },
  {
    name: '🎲 Mystery C',
    quality: 0.7,
    k: 4,
    hint: 'A decent draft model with moderate speculation length...',
    correctRange: '1-2×',
    explanation: '⚖️ 1-2× speedup! At 70% acceptance with k=4, we get (0.7×4)/(1+(0.3)×4) ≈ 1.27×. Modest improvement—better draft alignment or lower k might help.'
  },
  {
    name: '🎲 Mystery D',
    quality: 0.85,
    k: 8,
    hint: 'A good draft model with aggressive speculation...',
    correctRange: '2-3×',
    explanation: '💪 2-3× speedup! With 85% acceptance and k=8, we get (0.85×8)/(1+(0.15)×8) ≈ 2.8×. High k works because acceptance is strong enough to offset the occasional rejections.'
  }
];

function getSpeedupFeedback(
  prediction: SpeedupPrediction,
  challenge: SpeedupChallenge
): { correct: boolean; message: string } {
  const isCorrect = prediction === challenge.correctRange;
  return {
    correct: isCorrect,
    message: isCorrect
      ? challenge.explanation
      : `❌ Not quite! The speedup is actually ${challenge.correctRange}. ${challenge.explanation}`
  };
}

// Quality presets
const QUALITY_PRESETS = [
  { name: '🐢 Poor Draft', quality: 0.3, k: 3, description: 'Mismatched distributions (high rejection)' },
  { name: '⚖️ Moderate', quality: 0.6, k: 4, description: 'Decent alignment (mixed results)' },
  { name: '🎯 Good', quality: 0.8, k: 5, description: 'Well-aligned draft model' },
  { name: '🚀 Excellent', quality: 0.95, k: 6, description: 'Near-identical to target (max speedup)' },
];

// Dynamic educational insight
function getSpeculativeInsight(
  acceptanceRate: number,
  speedup: number,
  draftQuality: number,
  numTokens: number,
  accepted: number
): string {
  if (acceptanceRate > 0.9) {
    return `🚀 EXCELLENT! ${(acceptanceRate * 100).toFixed(0)}% acceptance rate → ${speedup.toFixed(2)}× speedup! When draft ≈ target, almost all tokens are accepted. This is the ideal scenario for speculative decoding.`;
  }
  if (acceptanceRate < 0.3) {
    return `⚠️ Low acceptance (${(acceptanceRate * 100).toFixed(0)}%)! Too many rejections mean we're doing extra work. Either improve the draft model or reduce k. Current speedup is only ${speedup.toFixed(2)}×.`;
  }
  if (speedup > 2) {
    return `💪 ${speedup.toFixed(2)}× speedup! We're generating ${accepted} tokens in the time of ~1 target forward pass. The ${(acceptanceRate * 100).toFixed(0)}% acceptance rate is solid.`;
  }
  if (numTokens > 5 && acceptanceRate < 0.5) {
    return `📉 High k (${numTokens}) with low acceptance (${(acceptanceRate * 100).toFixed(0)}%) is suboptimal. Try reducing draft length to improve expected speedup.`;
  }
  return `📊 Acceptance rate: ${(acceptanceRate * 100).toFixed(0)}%. Speedup: ${speedup.toFixed(2)}×. The key trade-off: longer drafts = more potential speedup, but only if acceptance stays high.`;
}

export default function SpeculativeDecodingViz() {
  const [draftQuality, setDraftQuality] = useState(0.7); // How similar draft is to target
  const [numTokens, setNumTokens] = useState(4);
  const [seed, setSeed] = useState(0);

  // ─────────────────────────────────────────────────────────────
  // Game State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0);
  const [prediction, setPrediction] = useState<SpeedupPrediction>(null);
  const [countdown, setCountdown] = useState(0);
  const [score, setScore] = useState(0);
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());

  const currentChallenge = SPEEDUP_CHALLENGES[currentChallengeIdx];

  // Game control functions
  const startChallenge = (idx: number) => {
    setCurrentChallengeIdx(idx);
    setGamePhase('setup');
    setPrediction(null);
    // Don't reveal the quality and k values in game mode - that's the challenge!
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
        // Apply the mystery settings to show the actual simulation
        setDraftQuality(currentChallenge.quality);
        setNumTokens(currentChallenge.k);
        setSeed(s => s + 1);
        // Check answer
        const feedback = getSpeedupFeedback(prediction, currentChallenge);
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

  // Simulate draft-verify for a sequence
  const simulation = useMemo(() => {
    const tokens = ['the', 'cat', 'sat', 'on', 'the', 'mat', 'and', 'purred'];
    const proposals: TokenProposal[] = [];

    let accepted = 0;
    for (let i = 0; i < numTokens && i < tokens.length; i++) {
      // Simulate draft probability (with some randomness)
      const baseProb = 0.3 + Math.random() * 0.4;
      const draftProb = baseProb;

      // Target probability varies based on draft quality
      // High draft quality = target prob close to draft prob
      const variation = (1 - draftQuality) * (Math.random() - 0.5) * 0.4;
      const targetProb = Math.max(0.1, Math.min(0.9, draftProb + variation));

      // Acceptance: α_i = min(1, p_i / q_i)
      const acceptanceProb = Math.min(1, targetProb / draftProb);
      const isAccepted = Math.random() < acceptanceProb;

      if (isAccepted) accepted++;

      proposals.push({
        token: tokens[i],
        draftProb,
        targetProb,
        accepted: isAccepted
      });
    }

    return { proposals, acceptanceRate: accepted / numTokens };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- seed is used for reproducible randomization
  }, [draftQuality, numTokens, seed]);

  // Calculate theoretical speedup
  const speedup = useMemo(() => {
    const alpha = simulation.acceptanceRate;
    const k = numTokens;
    return (alpha * k) / (1 + (1 - alpha) * k);
  }, [simulation.acceptanceRate, numTokens]);

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    const accepted = simulation.proposals.filter(p => p.accepted).length;
    return getSpeculativeInsight(
      simulation.acceptanceRate,
      speedup,
      draftQuality,
      numTokens,
      accepted
    );
  }, [simulation.acceptanceRate, speedup, draftQuality, numTokens, simulation.proposals]);

  // Handle preset selection
  const handlePreset = (preset: typeof QUALITY_PRESETS[0]) => {
    setDraftQuality(preset.quality);
    setNumTokens(preset.k);
    setSeed(s => s + 1);
  };

  return (
    <div className="speculative-decoding-viz">
      <div className="controls">
        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.primary }}>Draft Model Quality</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={draftQuality}
              onChange={(e) => setDraftQuality(parseFloat(e.target.value))}
            />
            <span className="value">{draftQuality.toFixed(2)}</span>
          </label>
          <p className="hint">How similar is the draft model to the target?</p>
        </div>

        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.secondary }}>Draft Length (k)</span>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={numTokens}
              onChange={(e) => setNumTokens(parseInt(e.target.value))}
            />
            <span className="value">{numTokens}</span>
          </label>
          <p className="hint">How many tokens does draft model propose?</p>
        </div>

        <button
          onClick={() => setSeed(s => s + 1)}
          className="resample-btn"
        >
          Resample
        </button>
      </div>

      {/* Quality Presets */}
      <div className="presets">
        {QUALITY_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => handlePreset(preset)}
            className={`preset-btn ${draftQuality === preset.quality ? 'active' : ''}`}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────
          Gamification: Speedup Prediction Challenge
          ───────────────────────────────────────────────────────────── */}
      <div className="game-panel">
        <div className="game-header">
          <h3>🎮 Speedup Prediction Challenge</h3>
          {!gameMode ? (
            <button className="game-toggle" onClick={() => setGameMode(true)}>
              Start Challenge
            </button>
          ) : (
            <button className="game-toggle exit" onClick={resetGame}>
              Exit Game
            </button>
          )}
          {gameMode && <span className="score-badge">Score: {score}/{SPEEDUP_CHALLENGES.length}</span>}
        </div>

        {gameMode && (
          <div className="game-content">
            <div className="challenge-selector">
              {SPEEDUP_CHALLENGES.map((ch, idx) => (
                <button
                  key={ch.name}
                  onClick={() => startChallenge(idx)}
                  className={`challenge-btn ${currentChallengeIdx === idx ? 'active' : ''} ${completedChallenges.has(idx) ? 'completed' : ''}`}
                >
                  {completedChallenges.has(idx) ? '✅' : ch.name}
                </button>
              ))}
            </div>

            {gamePhase === 'setup' && (
              <div className="prediction-panel">
                <p className="challenge-hint">{currentChallenge.hint}</p>
                <p className="challenge-prompt">What speedup do you expect?</p>
                <div className="prediction-options">
                  {(['<1×', '1-2×', '2-3×', '>3×'] as SpeedupPrediction[]).map(opt => (
                    <button
                      key={opt}
                      onClick={() => setPrediction(opt)}
                      className={`prediction-btn ${prediction === opt ? 'selected' : ''}`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <button
                  className="submit-btn"
                  onClick={submitPrediction}
                  disabled={!prediction}
                >
                  Lock In Prediction
                </button>
              </div>
            )}

            {gamePhase === 'countdown' && (
              <div className="countdown-display">
                <div className="countdown-number">{countdown}</div>
                <p>Simulating...</p>
              </div>
            )}

            {gamePhase === 'revealed' && (
              <div className="result-panel">
                {(() => {
                  const feedback = getSpeedupFeedback(prediction, currentChallenge);
                  return (
                    <>
                      <div className={`result-badge ${feedback.correct ? 'correct' : 'incorrect'}`}>
                        {feedback.correct ? '🎉 Correct!' : '💡 Learning opportunity!'}
                      </div>
                      <p className="result-message">{feedback.message}</p>
                      <p className="revealed-params">
                        Quality: {currentChallenge.quality}, k: {currentChallenge.k} →
                        Speedup: {calculateExpectedSpeedup(currentChallenge.quality, currentChallenge.k).toFixed(2)}×
                      </p>
                      <button
                        className="next-btn"
                        onClick={() => {
                          const nextIdx = (currentChallengeIdx + 1) % SPEEDUP_CHALLENGES.length;
                          startChallenge(nextIdx);
                        }}
                      >
                        {currentChallengeIdx < SPEEDUP_CHALLENGES.length - 1 ? 'Next Challenge →' : 'Try Again'}
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
        className="dynamic-insight"
        style={{
          background: simulation.acceptanceRate > 0.7
            ? 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.05))'
            : simulation.acceptanceRate < 0.4
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))'
              : 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.05))',
          border: simulation.acceptanceRate > 0.7
            ? '1px solid rgba(52, 211, 153, 0.3)'
            : simulation.acceptanceRate < 0.4
              ? '1px solid rgba(239, 68, 68, 0.3)'
              : '1px solid rgba(96, 165, 250, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="token-sequence">
        <h3>Draft-Verify Process</h3>
        <div className="tokens">
          {simulation.proposals.map((proposal, i) => (
            <div
              key={i}
              className={`token-card ${proposal.accepted ? 'accepted' : 'rejected'}`}
            >
              <div className="token-text">"{proposal.token}"</div>
              <div className="probabilities">
                <div className="prob-row">
                  <span className="label">Draft q:</span>
                  <span className="value">{proposal.draftProb.toFixed(3)}</span>
                </div>
                <div className="prob-row">
                  <span className="label">Target p:</span>
                  <span className="value">{proposal.targetProb.toFixed(3)}</span>
                </div>
                <div className="prob-row acceptance">
                  <span className="label">α = p/q:</span>
                  <span className="value">
                    {Math.min(1, proposal.targetProb / proposal.draftProb).toFixed(3)}
                  </span>
                </div>
              </div>
              <div className={`status ${proposal.accepted ? 'accepted' : 'rejected'}`}>
                {proposal.accepted ? '✓ Accepted' : '✗ Rejected'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label">Acceptance Rate</div>
          <div className="metric-value" style={{ color: MATH_COLORS.primary }}>
            {(simulation.acceptanceRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Theoretical Speedup</div>
          <div className="metric-value" style={{ color: MATH_COLORS.accent }}>
            {speedup.toFixed(2)}×
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Tokens Generated</div>
          <div className="metric-value" style={{ color: MATH_COLORS.secondary }}>
            {simulation.proposals.filter(p => p.accepted).length} / {numTokens}
          </div>
        </div>
      </div>

      <div className="insight-box">
        <strong>★ Key Insight:</strong> The acceptance probability α = min(1, p/q) ensures
        output distribution matches the target model <em>exactly</em>—this is not an approximation.
        When draft quality is high (draft probabilities ≈ target probabilities), most tokens are
        accepted and we get speedup. When rejected, we use residual sampling from max(0, p - q)
        to maintain the lossless property.
      </div>

      <style jsx>{`
        .speculative-decoding-viz {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
        }

        .controls {
          display: flex;
          gap: 2rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
        }

        .control-group {
          flex: 1;
          min-width: 200px;
        }

        .control-group label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.25rem;
        }

        .control-group input[type="range"] {
          flex: 1;
          height: 4px;
          background: rgba(245, 158, 11, 0.2);
          border-radius: 2px;
          outline: none;
        }

        .control-group input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: var(--accent);
          border-radius: 50%;
          cursor: pointer;
        }

        .value {
          min-width: 40px;
          text-align: right;
          color: var(--text-secondary);
          font-family: monospace;
        }

        .hint {
          font-size: 0.8rem;
          color: var(--text-tertiary);
          margin: 0;
          font-style: italic;
        }

        .resample-btn {
          padding: 0.5rem 1rem;
          background: var(--accent);
          color: #0a0a0a;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .resample-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
        }

        .presets {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .preset-btn {
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          border: 1px solid #374151;
          background: rgba(15, 23, 42, 0.9);
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease-out;
        }

        .preset-btn:hover {
          background: rgba(20, 184, 166, 0.15);
          border-color: rgba(45, 212, 191, 0.6);
        }

        .preset-btn.active {
          background: rgba(20, 184, 166, 0.25);
          border-color: #14b8a6;
          color: #5eead4;
        }

        .dynamic-insight {
          padding: 0.75rem 1rem;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
          line-height: 1.6;
          color: rgba(255, 255, 255, 0.9);
        }

        .token-sequence h3 {
          margin-bottom: 1rem;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .tokens {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 2rem;
        }

        .token-card {
          background: rgba(8, 12, 20, 0.8);
          border: 2px solid;
          border-radius: 8px;
          padding: 1rem;
          min-width: 120px;
          transition: all 0.3s;
        }

        .token-card.accepted {
          border-color: ${MATH_COLORS.primary};
        }

        .token-card.rejected {
          border-color: rgba(239, 68, 68, 0.5);
        }

        .token-text {
          font-size: 1.1rem;
          font-weight: 600;
          margin-bottom: 0.75rem;
          color: var(--text-primary);
          text-align: center;
        }

        .probabilities {
          font-size: 0.8rem;
          margin-bottom: 0.5rem;
        }

        .prob-row {
          display: flex;
          justify-content: space-between;
          margin: 0.25rem 0;
        }

        .prob-row.acceptance {
          margin-top: 0.5rem;
          padding-top: 0.5rem;
          border-top: 1px solid rgba(245, 158, 11, 0.2);
          font-weight: 600;
        }

        .label {
          color: var(--text-tertiary);
        }

        .status {
          text-align: center;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem;
          border-radius: 4px;
        }

        .status.accepted {
          color: ${MATH_COLORS.primary};
          background: rgba(34, 197, 94, 0.1);
        }

        .status.rejected {
          color: rgba(239, 68, 68, 1);
          background: rgba(239, 68, 68, 0.1);
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .metric-card {
          background: rgba(8, 12, 20, 0.8);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 8px;
          padding: 1rem;
          text-align: center;
        }

        .metric-label {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .metric-value {
          font-size: 1.5rem;
          font-weight: bold;
        }

        .insight-box {
          background: rgba(245, 158, 11, 0.05);
          border-left: 3px solid var(--accent);
          padding: 1rem;
          border-radius: 4px;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .insight-box strong {
          color: var(--accent);
        }

        /* Game Panel Styles */
        .game-panel {
          background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(59, 130, 246, 0.05));
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .game-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .game-header h3 {
          margin: 0;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .game-toggle {
          padding: 0.4rem 1rem;
          border-radius: 6px;
          border: 1px solid rgba(139, 92, 246, 0.5);
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .game-toggle:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        .game-toggle.exit {
          border-color: rgba(239, 68, 68, 0.5);
          background: rgba(239, 68, 68, 0.2);
          color: #f87171;
        }

        .score-badge {
          margin-left: auto;
          background: rgba(52, 211, 153, 0.2);
          border: 1px solid rgba(52, 211, 153, 0.4);
          padding: 0.25rem 0.75rem;
          border-radius: 999px;
          font-size: 0.8rem;
          color: #34d399;
        }

        .challenge-selector {
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
          margin-bottom: 1rem;
        }

        .challenge-btn {
          padding: 0.4rem 0.8rem;
          border-radius: 8px;
          border: 1px solid rgba(139, 92, 246, 0.3);
          background: rgba(15, 23, 42, 0.6);
          color: #e5e7eb;
          cursor: pointer;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .challenge-btn:hover {
          border-color: rgba(139, 92, 246, 0.6);
          background: rgba(139, 92, 246, 0.15);
        }

        .challenge-btn.active {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.25);
          color: #c4b5fd;
        }

        .challenge-btn.completed {
          border-color: rgba(52, 211, 153, 0.4);
          background: rgba(52, 211, 153, 0.15);
          color: #34d399;
        }

        .prediction-panel {
          text-align: center;
        }

        .challenge-hint {
          font-style: italic;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .challenge-prompt {
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1rem;
        }

        .prediction-options {
          display: flex;
          justify-content: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
          flex-wrap: wrap;
        }

        .prediction-btn {
          padding: 0.6rem 1.2rem;
          border-radius: 8px;
          border: 2px solid rgba(139, 92, 246, 0.3);
          background: rgba(15, 23, 42, 0.8);
          color: #e5e7eb;
          cursor: pointer;
          font-size: 0.95rem;
          font-weight: 500;
          transition: all 0.2s;
        }

        .prediction-btn:hover {
          border-color: rgba(139, 92, 246, 0.6);
          background: rgba(139, 92, 246, 0.15);
        }

        .prediction-btn.selected {
          border-color: #8b5cf6;
          background: rgba(139, 92, 246, 0.3);
          color: #fff;
        }

        .submit-btn {
          padding: 0.6rem 1.5rem;
          border-radius: 8px;
          border: none;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          color: white;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
        }

        .submit-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(139, 92, 246, 0.4);
        }

        .submit-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .countdown-display {
          text-align: center;
          padding: 2rem;
        }

        .countdown-number {
          font-size: 4rem;
          font-weight: bold;
          color: #8b5cf6;
          animation: pulse 1s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.1); }
        }

        .result-panel {
          text-align: center;
        }

        .result-badge {
          display: inline-block;
          padding: 0.5rem 1.5rem;
          border-radius: 999px;
          font-weight: 600;
          margin-bottom: 1rem;
        }

        .result-badge.correct {
          background: rgba(52, 211, 153, 0.2);
          border: 1px solid rgba(52, 211, 153, 0.4);
          color: #34d399;
        }

        .result-badge.incorrect {
          background: rgba(251, 191, 36, 0.2);
          border: 1px solid rgba(251, 191, 36, 0.4);
          color: #fbbf24;
        }

        .result-message {
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 1rem;
        }

        .revealed-params {
          font-family: monospace;
          font-size: 0.85rem;
          color: var(--text-tertiary);
          margin-bottom: 1rem;
        }

        .next-btn {
          padding: 0.6rem 1.5rem;
          border-radius: 8px;
          border: 1px solid rgba(139, 92, 246, 0.5);
          background: rgba(139, 92, 246, 0.2);
          color: #a78bfa;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .next-btn:hover {
          background: rgba(139, 92, 246, 0.3);
        }

        @media (max-width: 768px) {
          .controls {
            flex-direction: column;
          }

          .tokens {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
