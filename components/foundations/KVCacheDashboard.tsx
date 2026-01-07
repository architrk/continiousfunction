'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { MATH_COLORS } from '../../lib/mathObjects';

type GamePhase = 'setup' | 'countdown' | 'reveal'
type AttentionType = 'mha' | 'gqa-4' | 'gqa-8' | 'mqa'

// Challenge scenarios for memory prediction game
const CHALLENGE_SCENARIOS = [
  { name: '🔮 Llama-3 70B', context: 8192, layers: 80, headsQ: 64, headDim: 128, targetArch: 'gqa-8' as AttentionType, hint: 'Large model, long context' },
  { name: '🎯 GPT-like 7B', context: 4096, layers: 32, headsQ: 32, headDim: 128, targetArch: 'gqa-4' as AttentionType, hint: 'Medium model' },
  { name: '⚡ Efficient Inference', context: 32768, layers: 32, headsQ: 32, headDim: 128, targetArch: 'mqa' as AttentionType, hint: '32K context with MQA' },
  { name: '🎲 Mystery Config', context: -1, layers: -1, headsQ: -1, headDim: -1, targetArch: 'gqa-4' as AttentionType, hint: 'Random challenge!' },
]

// Educational feedback for memory predictions
function getPredictionFeedback(
  prediction: string,
  actualReduction: number,
  targetArch: AttentionType
): string {
  const actualBucket = actualReduction >= 85 ? 'massive' : actualReduction >= 70 ? 'large' : actualReduction >= 40 ? 'moderate' : 'small'
  const correct = prediction === actualBucket

  const archExplanation: Record<AttentionType, string> = {
    'mha': 'MHA uses full KV heads, so no memory savings.',
    'gqa-4': 'GQA-4 shares KV across 4 query heads → 75% reduction.',
    'gqa-8': 'GQA-8 shares KV across 8 query heads → 87.5% reduction.',
    'mqa': 'MQA uses just 1 KV head for all queries → maximum savings!',
  }

  if (correct) {
    return `Correct! ${archExplanation[targetArch]} This is why Llama 3 and other frontier models use GQA for efficiency.`
  }

  return `Not quite! ${archExplanation[targetArch]} The key is understanding the KV head ratio: with ${targetArch.toUpperCase()}, you get ${actualReduction.toFixed(0)}% memory savings.`
}

export default function KVCacheDashboard() {
  const [contextLength, setContextLength] = useState(2048);
  const [numLayers, setNumLayers] = useState(32);
  const [numHeadsQ, setNumHeadsQ] = useState(32);
  const [headDim, setHeadDim] = useState(128);
  const [batchSize, setBatchSize] = useState(1);
  const [dtype, setDtype] = useState<'fp16' | 'fp32' | 'int8'>('fp16');
  const [attentionType, setAttentionType] = useState<'mha' | 'gqa-4' | 'gqa-8' | 'mqa'>('mha');

  // Prediction game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [prediction, setPrediction] = useState<string | null>(null)
  const [lockedPrediction, setLockedPrediction] = useState<string | null>(null)
  const [activeChallenge, setActiveChallenge] = useState<typeof CHALLENGE_SCENARIOS[number] | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [targetArchitecture, setTargetArchitecture] = useState<AttentionType>('gqa-4')

  const bytesPerElement = useMemo(() => {
    switch (dtype) {
      case 'fp32': return 4;
      case 'fp16': return 2;
      case 'int8': return 1;
      default: return 2;
    }
  }, [dtype]);

  const numHeadsKV = useMemo(() => {
    switch (attentionType) {
      case 'mha': return numHeadsQ;
      case 'gqa-4': return numHeadsQ / 4;
      case 'gqa-8': return numHeadsQ / 8;
      case 'mqa': return 1;
      default: return numHeadsQ;
    }
  }, [attentionType, numHeadsQ]);

  const kvCacheGB = useMemo(() => {
    // Formula: 2 (K and V) × batch × layers × context × heads_kv × head_dim × bytes
    const totalBytes = 2 * batchSize * numLayers * contextLength * numHeadsKV * headDim * bytesPerElement;
    return totalBytes / (1024 ** 3); // Convert to GB
  }, [batchSize, numLayers, contextLength, numHeadsKV, headDim, bytesPerElement]);

  const mhaKVCacheGB = useMemo(() => {
    const totalBytes = 2 * batchSize * numLayers * contextLength * numHeadsQ * headDim * bytesPerElement;
    return totalBytes / (1024 ** 3);
  }, [batchSize, numLayers, contextLength, numHeadsQ, headDim, bytesPerElement]);

  const memoryReduction = useMemo(() => {
    return ((1 - kvCacheGB / mhaKVCacheGB) * 100).toFixed(1);
  }, [kvCacheGB, mhaKVCacheGB]);

  // Game handlers
  const applyChallenge = useCallback((scenario: typeof CHALLENGE_SCENARIOS[number]) => {
    let ctx = scenario.context
    let lay = scenario.layers
    let heads = scenario.headsQ
    let hdim = scenario.headDim
    let arch = scenario.targetArch

    if (scenario.context === -1) {
      // Mystery config - randomize
      ctx = [2048, 4096, 8192, 16384][Math.floor(Math.random() * 4)]
      lay = [24, 32, 48, 64][Math.floor(Math.random() * 4)]
      heads = [16, 32, 48, 64][Math.floor(Math.random() * 4)]
      hdim = 128
      arch = ['gqa-4', 'gqa-8', 'mqa'][Math.floor(Math.random() * 3)] as AttentionType
    }

    setContextLength(ctx)
    setNumLayers(lay)
    setNumHeadsQ(heads)
    setHeadDim(hdim)
    setTargetArchitecture(arch)
    setAttentionType('mha') // Start at MHA baseline
    setActiveChallenge(scenario)
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
  }, [])

  const startChallenge = useCallback(() => {
    if (!prediction) return
    setLockedPrediction(prediction)
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction])

  const resetGame = useCallback(() => {
    setGamePhase('setup')
    setPrediction(null)
    setLockedPrediction(null)
    setActiveChallenge(null)
    setAttentionType('mha')
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 600)
      return () => clearTimeout(timer)
    } else {
      // Apply the target architecture and reveal
      setAttentionType(targetArchitecture)
      setGamePhase('reveal')
    }
  }, [gamePhase, countdown, targetArchitecture])

  // Calculate actual reduction for game
  const actualReduction = useMemo(() => {
    const numHeadsKVTarget = targetArchitecture === 'mha' ? numHeadsQ :
      targetArchitecture === 'gqa-4' ? numHeadsQ / 4 :
      targetArchitecture === 'gqa-8' ? numHeadsQ / 8 : 1
    return (1 - numHeadsKVTarget / numHeadsQ) * 100
  }, [targetArchitecture, numHeadsQ])

  const predictionCorrect = useMemo(() => {
    if (!lockedPrediction) return false
    const actualBucket = actualReduction >= 85 ? 'massive' : actualReduction >= 70 ? 'large' : actualReduction >= 40 ? 'moderate' : 'small'
    return lockedPrediction === actualBucket
  }, [lockedPrediction, actualReduction])

  return (
    <section className="card interactive-card">
      <h2>KV Cache Memory Budget Calculator</h2>
      <p className="muted">
        The KV cache stores past keys and values for autoregressive decoding.
        At long context, this becomes the dominant memory cost. See how GQA reduces it.
      </p>

      {/* Prediction Game Section */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(20, 184, 166, 0.05))',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '16px',
      }}>
        <div style={{ marginBottom: '12px' }}>
          <span style={{ fontSize: '0.85rem', color: '#9ca3af', marginRight: '8px' }}>
            🧠 <strong>Memory Challenge:</strong> Pick a model config:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '6px' }}>
            {CHALLENGE_SCENARIOS.map(scenario => (
              <button
                key={scenario.name}
                onClick={() => applyChallenge(scenario)}
                disabled={gamePhase === 'countdown'}
                style={{
                  padding: '6px 12px',
                  background: activeChallenge?.name === scenario.name
                    ? 'rgba(245, 158, 11, 0.3)'
                    : 'rgba(245, 158, 11, 0.1)',
                  border: `1px solid ${activeChallenge?.name === scenario.name ? '#f59e0b' : 'rgba(245, 158, 11, 0.3)'}`,
                  borderRadius: '6px',
                  color: '#e5e7eb',
                  fontSize: '0.8rem',
                  cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                  opacity: gamePhase === 'countdown' ? 0.5 : 1,
                }}
                title={scenario.hint}
              >
                {scenario.name}
              </button>
            ))}
          </div>
        </div>

        {/* Setup phase */}
        {gamePhase === 'setup' && activeChallenge && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#e5e7eb' }}>
              📊 Config: {contextLength.toLocaleString()} tokens, {numLayers} layers, {numHeadsQ} heads → switching to <strong style={{ color: MATH_COLORS.primary }}>{targetArchitecture.toUpperCase()}</strong>
            </p>
            <p style={{ fontSize: '0.95rem', marginBottom: '12px', color: '#e5e7eb' }}>
              🎯 <strong>How much memory will {targetArchitecture.toUpperCase()} save vs MHA?</strong>
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {[
                { id: 'small', label: '🤏 Small (<40%)', color: '#ef4444' },
                { id: 'moderate', label: '📊 Moderate (40-70%)', color: '#f59e0b' },
                { id: 'large', label: '💪 Large (70-85%)', color: '#22c55e' },
                { id: 'massive', label: '🚀 Massive (>85%)', color: '#14b8a6' },
              ].map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setPrediction(opt.id)}
                  style={{
                    padding: '8px 16px',
                    background: prediction === opt.id ? `${opt.color}30` : 'rgba(255, 255, 255, 0.05)',
                    border: `2px solid ${prediction === opt.id ? opt.color : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    color: '#e5e7eb',
                    fontSize: '0.85rem',
                    fontWeight: prediction === opt.id ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              onClick={startChallenge}
              disabled={!prediction}
              style={{
                padding: '12px 24px',
                background: prediction
                  ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                  : 'rgba(245, 158, 11, 0.2)',
                border: 'none',
                borderRadius: '8px',
                color: prediction ? '#fff' : '#9ca3af',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: prediction ? 'pointer' : 'not-allowed',
                opacity: prediction ? 1 : 0.5,
              }}
            >
              ⚡ Calculate Memory!
            </button>
          </div>
        )}

        {/* No challenge selected */}
        {gamePhase === 'setup' && !activeChallenge && (
          <p style={{ fontSize: '0.9rem', color: '#9ca3af', textAlign: 'center', padding: '12px' }}>
            👆 Select a model configuration to test your GQA intuition!
          </p>
        )}

        {/* Countdown */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{
              fontSize: '4rem',
              fontWeight: 'bold',
              color: '#f59e0b',
              textShadow: '0 0 30px rgba(245, 158, 11, 0.5)',
            }}>
              {countdown === 0 ? 'CALCULATING...' : countdown}
            </div>
            <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
              Your prediction: <strong style={{ color: '#f59e0b' }}>{lockedPrediction}</strong>
            </p>
          </div>
        )}

        {/* Revealed */}
        {gamePhase === 'reveal' && (
          <div>
            <div style={{
              textAlign: 'center',
              padding: '16px',
              background: predictionCorrect
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.05))'
                : 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.05))',
              borderRadius: '10px',
              marginBottom: '12px',
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>
                {predictionCorrect ? '🎉' : '🤔'}
              </div>
              <div style={{
                fontSize: '1.2rem',
                fontWeight: 'bold',
                color: predictionCorrect ? '#22c55e' : '#ef4444',
                marginBottom: '8px',
              }}>
                {predictionCorrect ? 'Correct!' : 'Not quite!'}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#e5e7eb' }}>
                Memory savings with {targetArchitecture.toUpperCase()}: <strong style={{ color: MATH_COLORS.primary }}>
                  {actualReduction.toFixed(0)}%
                </strong>
              </div>
            </div>
            <div style={{
              padding: '12px',
              background: 'rgba(0, 0, 0, 0.3)',
              borderRadius: '8px',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: '#9ca3af',
            }}>
              💡 {getPredictionFeedback(lockedPrediction!, actualReduction, targetArchitecture)}
            </div>
            <button
              onClick={resetGame}
              style={{
                marginTop: '12px',
                padding: '10px 20px',
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '8px',
                color: '#e5e7eb',
                cursor: 'pointer',
                fontSize: '0.9rem',
              }}
            >
              🔄 Try Another Challenge
            </button>
          </div>
        )}
      </div>

      <div className="kv-dashboard">
        <div className="controls-grid">
          <label className="slider-label">
            Context Length (T)
            <input
              type="range"
              min={128}
              max={32768}
              step={128}
              value={contextLength}
              onChange={(e) => setContextLength(parseInt(e.target.value))}
            />
            <span className="slider-value">{contextLength.toLocaleString()} tokens</span>
          </label>

          <label className="slider-label">
            Number of Layers (L)
            <input
              type="range"
              min={12}
              max={80}
              step={4}
              value={numLayers}
              onChange={(e) => setNumLayers(parseInt(e.target.value))}
            />
            <span className="slider-value">{numLayers} layers</span>
          </label>

          <label className="slider-label">
            Query Heads (H<sub>q</sub>)
            <input
              type="range"
              min={8}
              max={64}
              step={8}
              value={numHeadsQ}
              onChange={(e) => setNumHeadsQ(parseInt(e.target.value))}
            />
            <span className="slider-value">{numHeadsQ} heads</span>
          </label>

          <label className="slider-label">
            Head Dimension (d<sub>head</sub>)
            <input
              type="range"
              min={64}
              max={256}
              step={64}
              value={headDim}
              onChange={(e) => setHeadDim(parseInt(e.target.value))}
            />
            <span className="slider-value">{headDim}</span>
          </label>

          <label className="slider-label">
            Batch Size
            <input
              type="range"
              min={1}
              max={32}
              step={1}
              value={batchSize}
              onChange={(e) => setBatchSize(parseInt(e.target.value))}
            />
            <span className="slider-value">{batchSize} request{batchSize > 1 ? 's' : ''}</span>
          </label>

          <label className="slider-label">
            Data Type
            <select
              value={dtype}
              onChange={(e) => setDtype(e.target.value as 'fp16' | 'fp32' | 'int8')}
              className="dtype-select"
            >
              <option value="fp32">FP32 (4 bytes)</option>
              <option value="fp16">FP16/BF16 (2 bytes)</option>
              <option value="int8">INT8 (1 byte)</option>
            </select>
          </label>

          <label className="slider-label" style={{ gridColumn: '1 / -1', borderTop: '1px solid rgba(245, 158, 11, 0.2)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <span style={{ color: MATH_COLORS.primary }}>Attention Architecture</span>
            <select
              value={attentionType}
              onChange={(e) => setAttentionType(e.target.value as any)}
              className="attention-select"
            >
              <option value="mha">Multi-Head Attention (MHA) — H_kv = H_q</option>
              <option value="gqa-4">Grouped-Query Attention (GQA-4) — H_kv = H_q/4</option>
              <option value="gqa-8">Grouped-Query Attention (GQA-8) — H_kv = H_q/8</option>
              <option value="mqa">Multi-Query Attention (MQA) — H_kv = 1</option>
            </select>
            <span className="slider-value">
              KV Heads: {numHeadsKV} ({attentionType === 'mha' ? 'full' : `${numHeadsQ/numHeadsKV}×` } sharing)
            </span>
          </label>
        </div>

        <div className="results-panel">
          <div className="result-card primary">
            <div className="result-label">KV Cache Size ({attentionType.toUpperCase()})</div>
            <div className="result-value" style={{ color: MATH_COLORS.secondary }}>
              {kvCacheGB.toFixed(2)} GB
            </div>
            <div className="result-formula">
              2 × {batchSize} × {numLayers} × {contextLength.toLocaleString()} × {numHeadsKV} × {headDim} × {bytesPerElement} bytes
            </div>
          </div>

          {attentionType !== 'mha' && (
            <>
              <div className="result-card">
                <div className="result-label">MHA Baseline (for comparison)</div>
                <div className="result-value">{mhaKVCacheGB.toFixed(2)} GB</div>
              </div>

              <div className="result-card highlight">
                <div className="result-label">Memory Reduction</div>
                <div className="result-value" style={{ color: MATH_COLORS.primary }}>
                  {memoryReduction}% savings
                </div>
                <div className="result-detail">
                  GQA uses {numHeadsKV} KV heads instead of {numHeadsQ} → {(numHeadsQ/numHeadsKV).toFixed(1)}× less KV cache
                </div>
              </div>
            </>
          )}

          <div className="result-card">
            <div className="result-label">Per-Token Memory Cost</div>
            <div className="result-value">
              {((kvCacheGB * 1024) / contextLength).toFixed(2)} MB/token
            </div>
          </div>
        </div>

        <div className="insight-box">
          <strong>💡 Key Insight:</strong> At long context ({contextLength.toLocaleString()} tokens),
          KV cache grows linearly with T. {attentionType !== 'mha' ? `${attentionType.toUpperCase()} reduces this by ${memoryReduction}% compared to MHA, ` : ''}
          This is why Llama 3 and other frontier models use GQA—it's essential for serving efficiency at scale.
        </div>
      </div>

      <style jsx>{`
        .kv-dashboard {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .controls-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1rem;
        }

        .slider-label {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          font-size: 0.9rem;
        }

        .slider-value {
          font-size: 0.85rem;
          color: var(--text-secondary);
          font-family: var(--font-mono);
        }

        .dtype-select,
        .attention-select {
          padding: 0.5rem;
          background: rgba(8, 12, 20, 0.8);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 4px;
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .results-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
        }

        .result-card {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 1rem;
        }

        .result-card.primary {
          border-color: rgba(20, 184, 166, 0.5);
          background: rgba(20, 184, 166, 0.05);
        }

        .result-card.highlight {
          border-color: rgba(245, 158, 11, 0.5);
          background: rgba(245, 158, 11, 0.05);
        }

        .result-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.5rem;
        }

        .result-value {
          font-size: 1.5rem;
          font-weight: bold;
          font-family: var(--font-mono);
          margin-bottom: 0.25rem;
        }

        .result-formula,
        .result-detail {
          font-size: 0.75rem;
          color: var(--text-tertiary);
          font-family: var(--font-mono);
          line-height: 1.4;
        }

        .insight-box {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 1rem;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        @media (max-width: 768px) {
          .controls-grid {
            grid-template-columns: 1fr;
          }

          .results-panel {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
