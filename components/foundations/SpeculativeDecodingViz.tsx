'use client';
import React, { useState, useMemo, useEffect } from 'react';
import { MATH_COLORS } from '../../lib/mathObjects';
import { emitDemoState } from '../../lib/demoState';

type TokenStatus = 'accepted' | 'rejected' | 'discarded';

interface TokenProposal {
  token: string;
  draftProb: number;
  targetProb: number;
  acceptanceProb: number;
  status: TokenStatus;
}

type SpeculativeDecodingVizProps = {
  chrome?: 'legacy' | 'notebook';
};

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
  // Approximate acceptance rate follows quality in this simplified model.
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
    name: 'Trial A',
    quality: 0.95,
    k: 6,
    hint: 'An excellent draft model proposes 6 tokens...',
    correctRange: '>3×',
    explanation: '>3× speedup. With 95% acceptance and k=6, almost every draft token is accepted. The speedup formula gives (0.95×6)/(1+(0.05)×6) ≈ 4.4×.'
  },
  {
    name: 'Trial B',
    quality: 0.3,
    k: 5,
    hint: 'A poor draft model tries to speculate 5 tokens...',
    correctRange: '<1×',
    explanation: '<1× speedup, so the proxy is slower than no speculation. With only 30% acceptance, most tokens are rejected. The formula gives about 0.33×.'
  },
  {
    name: 'Trial C',
    quality: 0.7,
    k: 4,
    hint: 'A decent draft model with moderate speculation length...',
    correctRange: '1-2×',
    explanation: '1-2× speedup. At 70% acceptance with k=4, we get (0.7×4)/(1+(0.3)×4) ≈ 1.27×. Better draft alignment or a smaller k may be more useful.'
  },
  {
    name: 'Trial D',
    quality: 0.85,
    k: 7,
    hint: 'A good draft model with aggressive speculation...',
    correctRange: '2-3×',
    explanation: '2-3× speedup. With 85% acceptance and k=7, we get (0.85×7)/(1+(0.15)×7) ≈ 2.9×. High k works because acceptance is strong enough to offset occasional rejections.'
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
      : `Prediction missed. The speedup is actually ${challenge.correctRange}. ${challenge.explanation}`
  };
}

// Quality presets
const QUALITY_PRESETS = [
  { name: 'Poor draft', quality: 0.3, k: 3, description: 'Mismatched distributions (high rejection)' },
  { name: 'Moderate match', quality: 0.6, k: 4, description: 'Decent alignment (mixed results)' },
  { name: 'Good match', quality: 0.8, k: 5, description: 'Well-aligned draft model' },
  { name: 'Near-target draft', quality: 0.95, k: 6, description: 'Near-identical to target (max speedup)' },
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
    return `High draft-target match: ${(acceptanceRate * 100).toFixed(0)}% of proposed tokens survived verification, giving a ${speedup.toFixed(2)}× toy speedup proxy. When draft is close to target, one target pass can confirm several draft tokens.`;
  }
  if (acceptanceRate < 0.3) {
    return `Low acceptance (${(acceptanceRate * 100).toFixed(0)}%): the verifier rejects too often, so a larger draft chunk adds work without much progress. Try improving draft-target match before increasing k.`;
  }
  if (speedup > 2) {
    return `${speedup.toFixed(2)}× toy speedup proxy: ${accepted} draft tokens were accepted from one verification step. The key condition is still high acceptance, not merely a large k.`;
  }
  if (numTokens > 5 && acceptanceRate < 0.5) {
    return `High k (${numTokens}) with low acceptance (${(acceptanceRate * 100).toFixed(0)}%) is a weak tradeoff. Longer drafts help only when the accepted prefix usually stays long.`;
  }
  return `Acceptance rate: ${(acceptanceRate * 100).toFixed(0)}%. Toy speedup proxy: ${speedup.toFixed(2)}×. Longer drafts create more upside, but only when acceptance stays high.`;
}

function pseudoRandom(seed: number, index: number, salt = 0): number {
  const x = Math.sin(seed * 997 + index * 37 + salt * 101) * 43758.5453;
  return x - Math.floor(x);
}

export default function SpeculativeDecodingViz({
  chrome = 'legacy',
}: SpeculativeDecodingVizProps) {
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
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set());

  const currentChallenge = SPEEDUP_CHALLENGES[currentChallengeIdx];
  const score = completedChallenges.size;

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
        // Check answer
        const feedback = getSpeedupFeedback(prediction, currentChallenge);
        if (feedback.correct) {
          setCompletedChallenges((prev) => {
            if (prev.has(currentChallengeIdx)) return prev;
            return new Set([...prev, currentChallengeIdx]);
          });
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
    const visibleTokens = Math.min(numTokens, tokens.length);

    let acceptedPrefix = 0;
    let prefixAlive = true;
    for (let i = 0; i < visibleTokens; i++) {
      // Simulate draft probability with a stable trace until the learner resamples.
      const baseProb = 0.3 + pseudoRandom(seed, i, 1) * 0.4;
      const draftProb = baseProb;

      // The toy makes acceptance explicit so lower draft-target match behaves visibly worse.
      const acceptanceProb = Math.max(
        0.05,
        Math.min(1, draftQuality + (pseudoRandom(seed, i, 2) - 0.5) * 0.18)
      );
      const targetProb = draftProb * acceptanceProb;

      // Acceptance: α_i = min(1, p_i / q_i)
      const isAccepted = pseudoRandom(seed, i, 3) < acceptanceProb;
      let status: TokenStatus = 'discarded';

      if (prefixAlive && isAccepted) {
        status = 'accepted';
        acceptedPrefix += 1;
      } else if (prefixAlive) {
        status = 'rejected';
        prefixAlive = false;
      }

      proposals.push({
        token: tokens[i],
        draftProb,
        targetProb,
        acceptanceProb,
        status,
      });
    }

    return { proposals, acceptanceRate: acceptedPrefix / visibleTokens };
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
    const accepted = simulation.proposals.filter((proposal) => proposal.status === 'accepted').length;
    return getSpeculativeInsight(
      simulation.acceptanceRate,
      speedup,
      draftQuality,
      numTokens,
      accepted
    );
  }, [simulation.acceptanceRate, speedup, draftQuality, numTokens, simulation.proposals]);

  useEffect(() => {
    const accepted = simulation.proposals.filter((proposal) => proposal.status === 'accepted').length;

    emitDemoState({
      conceptId: 'speculative-decoding',
      label: 'Speculative decoding trace',
      summary: `Draft-target match ${draftQuality.toFixed(2)}, k=${numTokens}: ${accepted}/${numTokens} draft tokens accepted; toy speedup proxy ${speedup.toFixed(2)}x.`,
      values: [
        `acceptance rate ${(simulation.acceptanceRate * 100).toFixed(1)}%`,
        'invariant: full speculative decoding preserves the target distribution with accept/reject plus residual sampling',
        'demo scope: toy accepted-prefix and speedup witness; the residual repair proof lives in the math/code section',
        'next test: lower draft-target match before raising k',
      ],
    });
  }, [draftQuality, numTokens, simulation.acceptanceRate, simulation.proposals, speedup]);

  // Handle preset selection
  const handlePreset = (preset: typeof QUALITY_PRESETS[0]) => {
    setDraftQuality(preset.quality);
    setNumTokens(preset.k);
  };

  return (
    <div className={`speculative-decoding-viz ${chrome}`}>
      <div className="predict-first">
        <strong>Predict first:</strong> With <code>k</code> high but draft-target match low, does speculation become useful, or does it stay below the no-speculation baseline?
      </div>

      <div className="controls">
        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.primary }}>Draft-target match, toy q ~ p</span>
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
          <p className="hint">How close is the fast draft distribution to the target model?</p>
        </div>

        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.secondary }}>Draft length k</span>
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
          <p className="hint">How many tokens does the draft model propose before target verification?</p>
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

      <div className="game-panel">
        <div className="game-header">
          <h3>Speedup prediction check</h3>
          {!gameMode ? (
            <button className="game-toggle" onClick={() => setGameMode(true)}>
              Start prediction check
            </button>
          ) : (
            <button className="game-toggle exit" onClick={resetGame}>
              Close prediction check
            </button>
          )}
          {gameMode && <span className="score-badge">Matched trials: {score}/{SPEEDUP_CHALLENGES.length}</span>}
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
                  {completedChallenges.has(idx) ? 'Matched' : ch.name}
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
                  Record prediction
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
                        {feedback.correct ? 'Prediction matched' : 'Prediction missed'}
                      </div>
                      <p className="result-message">{feedback.message}</p>
                      <p className="revealed-params">
                        Quality: {currentChallenge.quality}, k: {currentChallenge.k} -&gt;
                        Speedup: {calculateExpectedSpeedup(currentChallenge.quality, currentChallenge.k).toFixed(2)}×
                      </p>
                      <button
                        className="next-btn"
                        onClick={() => {
                          const nextIdx = (currentChallengeIdx + 1) % SPEEDUP_CHALLENGES.length;
                          startChallenge(nextIdx);
                        }}
                      >
                        {currentChallengeIdx < SPEEDUP_CHALLENGES.length - 1 ? 'Next trial' : 'Try again'}
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
              className={`token-card ${proposal.status}`}
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
                    {proposal.acceptanceProb.toFixed(3)}
                  </span>
                </div>
              </div>
              <div className={`status ${proposal.status}`}>
                {proposal.status === 'accepted'
                  ? 'Accepted prefix'
                  : proposal.status === 'rejected'
                    ? 'First rejected'
                    : 'Discarded after rejection'}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="metrics">
        <div className="metric-card">
          <div className="metric-label">Accepted prefix rate</div>
          <div className="metric-value" style={{ color: MATH_COLORS.primary }}>
            {(simulation.acceptanceRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Toy speedup proxy</div>
          <div className="metric-value" style={{ color: MATH_COLORS.accent }}>
            {speedup.toFixed(2)}×
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Accepted draft tokens</div>
          <div className="metric-value" style={{ color: MATH_COLORS.secondary }}>
            {simulation.proposals.filter((proposal) => proposal.status === 'accepted').length} / {numTokens}
          </div>
        </div>
      </div>

      <div className="insight-box">
        <strong>Mechanism invariant:</strong> In full speculative decoding, accept/reject plus
        residual sampling preserves the target model&apos;s distribution. This toy trace visualizes
        accepted-prefix and speedup behavior; it does not simulate the residual repair step. The
        math and code section above carry that distribution check.
      </div>

      <style jsx>{`
        .speculative-decoding-viz {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
        }

        .speculative-decoding-viz.notebook {
          margin: 0;
          padding: 0;
          border: 0;
          border-radius: 0;
          background: transparent;
          color: #17202a;
        }

        .predict-first {
          margin-bottom: 1rem;
          padding: 0.85rem 1rem;
          border-radius: 14px;
          border: 1px solid rgba(31, 111, 120, 0.18);
          background: rgba(255, 251, 245, 0.78);
          color: #2f3c48;
          font-size: 0.92rem;
          line-height: 1.55;
        }

        .predict-first strong {
          color: #1f6f78;
        }

        .predict-first code {
          font-family: var(--font-mono);
          color: #8a4b16;
        }

        .controls {
          display: flex;
          gap: 2rem;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          min-width: 0;
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

        .control-group label > span:first-child {
          min-width: 9rem;
          line-height: 1.35;
          overflow-wrap: normal;
          word-break: normal;
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

        .speculative-decoding-viz.notebook .dynamic-insight {
          color: #2f3c48;
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
          min-width: 0;
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

        .token-card.discarded {
          border-color: rgba(148, 163, 184, 0.45);
          opacity: 0.78;
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

        .status.discarded {
          color: rgba(148, 163, 184, 1);
          background: rgba(148, 163, 184, 0.1);
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-bottom: 2rem;
          min-width: 0;
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

        .speculative-decoding-viz.notebook .challenge-hint,
        .speculative-decoding-viz.notebook .result-message,
        .speculative-decoding-viz.notebook .revealed-params {
          color: #52606b;
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

          .control-group label {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
          }

          .control-group label > span:first-child {
            grid-column: 1 / -1;
            min-width: 0;
          }

          .control-group input[type="range"] {
            width: 100%;
          }

          .value {
            min-width: 3rem;
          }

          .tokens {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
}
