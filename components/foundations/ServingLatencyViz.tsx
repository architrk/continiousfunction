'use client';
import React, { useState, useMemo } from 'react';
import { MATH_COLORS } from '../../lib/mathObjects';

// Presets for common serving scenarios
const PRESETS = [
  {
    id: 'chat',
    name: '💬 Chat Bot',
    description: 'Short prompts, medium responses',
    promptLength: 256,
    outputLength: 150,
    batchSize: 1
  },
  {
    id: 'rag',
    name: '📚 RAG Pipeline',
    description: 'Long context from retrieval',
    promptLength: 2048,
    outputLength: 100,
    batchSize: 4
  },
  {
    id: 'code',
    name: '💻 Code Gen',
    description: 'Medium prompt, long output',
    promptLength: 512,
    outputLength: 400,
    batchSize: 2
  },
  {
    id: 'batch',
    name: '🏭 Batch Inference',
    description: 'High throughput batch',
    promptLength: 512,
    outputLength: 100,
    batchSize: 16
  },
  {
    id: 'summarize',
    name: '📝 Summarization',
    description: 'Very long input, short output',
    promptLength: 2048,
    outputLength: 50,
    batchSize: 1
  }
] as const;

// Prediction challenge scenarios
type ChallengeId = 'double_batch' | 'long_prompt' | 'long_output' | 'mystery';

interface Challenge {
  id: ChallengeId;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  setup: { promptLength: number; outputLength: number; batchSize: number };
}

const CHALLENGES: Challenge[] = [
  {
    id: 'double_batch',
    question: 'If we double batch size from 4→8, which grows more?',
    options: ['TTFT grows more', 'Decode time grows more', 'Both grow equally'],
    correctIndex: 1,
    explanation: 'Decode is memory-bandwidth bound. Doubling batch size means 2× KV cache reads per token, so TPOT increases. TTFT only grows with √batch (parallel compute).',
    setup: { promptLength: 512, outputLength: 200, batchSize: 4 }
  },
  {
    id: 'long_prompt',
    question: 'With a 2048-token prompt and 50-token output, what dominates latency?',
    options: ['Prefill (TTFT)', 'Decode phase', 'About equal'],
    correctIndex: 0,
    explanation: 'Long prompts mean massive prefill (O(T²) attention). With only 50 output tokens, decode is quick. This is the "summarization" pattern.',
    setup: { promptLength: 2048, outputLength: 50, batchSize: 1 }
  },
  {
    id: 'long_output',
    question: 'With 256-token prompt and 500-token output, what dominates?',
    options: ['Prefill (TTFT)', 'Decode phase', 'About equal'],
    correctIndex: 1,
    explanation: 'Short prompts mean fast prefill. With 500 output tokens, each taking ~5ms, decode dominates. This is the "code generation" pattern.',
    setup: { promptLength: 256, outputLength: 500, batchSize: 1 }
  },
  {
    id: 'mystery',
    question: 'RAG scenario: 2048 prompt, 100 output, batch=4. What bottleneck?',
    options: ['Prefill is bottleneck', 'Decode is bottleneck', 'Well balanced'],
    correctIndex: 0,
    explanation: 'RAG prompts are huge (retrieved docs). The O(T²) prefill attention on 2048 tokens dominates. This is why chunking and caching matter for RAG.',
    setup: { promptLength: 2048, outputLength: 100, batchSize: 4 }
  }
];

// Dynamic insight based on current state
const getInsight = (
  prefillFraction: number,
  promptLength: number,
  outputLength: number,
  batchSize: number,
  tpot: number
): string => {
  if (prefillFraction > 0.7) {
    return `⚡ Prefill-dominated (${(prefillFraction * 100).toFixed(0)}%). Long prompts create massive O(T²) attention costs. Consider: prompt caching, chunked prefill, or FlashAttention.`;
  }
  if (prefillFraction < 0.3) {
    return `🔄 Decode-dominated (${((1 - prefillFraction) * 100).toFixed(0)}%). Long outputs mean many sequential KV cache reads. Consider: speculative decoding, GQA/MQA for smaller KV cache.`;
  }
  if (batchSize > 8) {
    return `📦 High batch (${batchSize}). Throughput increases but latency grows due to KV cache contention. TPOT is ${tpot.toFixed(1)}ms — consider batch size vs latency tradeoff.`;
  }
  if (promptLength > 1500 && outputLength > 200) {
    return `⚠️ Both prompt (${promptLength}) and output (${outputLength}) are long. This is expensive! Total context grows to ${promptLength + outputLength} tokens by the end.`;
  }
  return `📊 Balanced workload. Prefill: ${(prefillFraction * 100).toFixed(0)}%, Decode: ${((1 - prefillFraction) * 100).toFixed(0)}%. This is a healthy mix for most serving scenarios.`;
};

export default function ServingLatencyViz() {
  const [promptLength, setPromptLength] = useState(512);
  const [outputLength, setOutputLength] = useState(100);
  const [batchSize, setBatchSize] = useState(4);

  // Gamification state
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [challengeMode, setChallengeMode] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  // Latency calculation (simplified model)
  const latency = useMemo(() => {
    // TTFT (Time To First Token) - dominated by prefill
    // Simplified: TTFT ∝ prompt_length × batch_size (parallel processing)
    const ttft = (promptLength / 1000) * Math.sqrt(batchSize) * 50; // ms

    // TPOT (Time Per Output Token) - dominated by decode
    // Decode is sequential, grows with batch size due to KV cache reads
    const tpot = 5 + batchSize * 0.5; // ms per token

    // Total latency
    const total = ttft + (outputLength - 1) * tpot;

    return {
      ttft,
      tpot,
      total,
      prefillFraction: ttft / total,
      decodeFraction: ((outputLength - 1) * tpot) / total
    };
  }, [promptLength, outputLength, batchSize]);

  // Calculate workload characteristics
  const workload = useMemo(() => {
    // Prefill: compute-bound (big parallel matmuls)
    const prefillCompute = promptLength * promptLength; // Quadratic in prompt length
    const prefillMemory = promptLength; // Linear memory read

    // Decode: memory-bound (huge KV cache reads)
    const decodeCompute = promptLength; // Linear - attend to all past tokens
    const decodeMemory = promptLength * outputLength; // KV cache grows with output

    const computeIntensity = {
      prefill: prefillCompute / prefillMemory,
      decode: decodeCompute / decodeMemory
    };

    return {
      prefillCompute,
      prefillMemory,
      decodeCompute,
      decodeMemory,
      computeIntensity
    };
  }, [promptLength, outputLength]);

  // Dynamic insight
  const currentInsight = useMemo(() => {
    return getInsight(latency.prefillFraction, promptLength, outputLength, batchSize, latency.tpot);
  }, [latency.prefillFraction, promptLength, outputLength, batchSize, latency.tpot]);

  // Handle preset selection
  const handlePresetClick = (preset: typeof PRESETS[number]) => {
    setActivePreset(preset.id);
    setPromptLength(preset.promptLength);
    setOutputLength(preset.outputLength);
    setBatchSize(preset.batchSize);
  };

  // Handle challenge start
  const startChallenge = () => {
    const randomChallenge = CHALLENGES[Math.floor(Math.random() * CHALLENGES.length)];
    setCurrentChallenge(randomChallenge);
    setPromptLength(randomChallenge.setup.promptLength);
    setOutputLength(randomChallenge.setup.outputLength);
    setBatchSize(randomChallenge.setup.batchSize);
    setSelectedAnswer(null);
    setShowResult(false);
    setChallengeMode(true);
  };

  // Handle answer selection
  const handleAnswerSelect = (index: number) => {
    if (showResult) return;
    setSelectedAnswer(index);
    setShowResult(true);
    const isCorrect = index === currentChallenge?.correctIndex;
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  // Clear preset when user manually adjusts sliders
  const handleSliderChange = (setter: (value: number) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setActivePreset(null);
    setter(parseInt(e.target.value));
  };

  return (
    <div className="serving-latency-viz">
      {/* Presets */}
      <div className="presets-section">
        <div className="presets-header">
          <span className="presets-title">📊 Serving Scenarios</span>
          <button
            className={`challenge-btn ${challengeMode ? 'active' : ''}`}
            onClick={startChallenge}
          >
            🎯 {challengeMode ? 'New Challenge' : 'Test Your Intuition'}
          </button>
        </div>
        <div className="presets-grid">
          {PRESETS.map(preset => (
            <button
              key={preset.id}
              className={`preset-btn ${activePreset === preset.id ? 'active' : ''}`}
              onClick={() => handlePresetClick(preset)}
            >
              <span className="preset-name">{preset.name}</span>
              <span className="preset-desc">{preset.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Challenge Mode */}
      {challengeMode && currentChallenge && (
        <div className="challenge-panel">
          <div className="challenge-question">
            <span className="challenge-icon">🤔</span>
            {currentChallenge.question}
          </div>
          <div className="challenge-options">
            {currentChallenge.options.map((option, idx) => (
              <button
                key={idx}
                className={`option-btn ${
                  showResult
                    ? idx === currentChallenge.correctIndex
                      ? 'correct'
                      : idx === selectedAnswer
                        ? 'incorrect'
                        : ''
                    : selectedAnswer === idx
                      ? 'selected'
                      : ''
                }`}
                onClick={() => handleAnswerSelect(idx)}
                disabled={showResult}
              >
                {option}
              </button>
            ))}
          </div>
          {showResult && (
            <div className={`challenge-result ${selectedAnswer === currentChallenge.correctIndex ? 'correct' : 'incorrect'}`}>
              <div className="result-header">
                {selectedAnswer === currentChallenge.correctIndex ? '✅ Correct!' : '❌ Not quite!'}
              </div>
              <div className="result-explanation">{currentChallenge.explanation}</div>
              <div className="score-display">Score: {score.correct}/{score.total}</div>
            </div>
          )}
        </div>
      )}

      <div className="controls">
        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.primary }}>Prompt Length (T_in)</span>
            <input
              type="range"
              min="128"
              max="2048"
              step="128"
              value={promptLength}
              onChange={handleSliderChange(setPromptLength)}
            />
            <span className="value">{promptLength}</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.secondary }}>Output Length (T_out)</span>
            <input
              type="range"
              min="10"
              max="500"
              step="10"
              value={outputLength}
              onChange={handleSliderChange(setOutputLength)}
            />
            <span className="value">{outputLength}</span>
          </label>
        </div>

        <div className="control-group">
          <label>
            <span style={{ color: MATH_COLORS.accent }}>Batch Size</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={batchSize}
              onChange={handleSliderChange(setBatchSize)}
            />
            <span className="value">{batchSize}</span>
          </label>
        </div>
      </div>

      <div className="latency-breakdown">
        <h3>Latency Decomposition</h3>
        <div className="formula">
          Latency ≈ <span style={{ color: MATH_COLORS.primary }}>TTFT</span> + (T_out - 1) · <span style={{ color: MATH_COLORS.secondary }}>TPOT</span>
        </div>

        <div className="timeline">
          <div className="timeline-bar">
            <div
              className="timeline-segment prefill"
              style={{ width: `${latency.prefillFraction * 100}%` }}
            >
              <span className="segment-label">
                TTFT (Prefill)<br />
                {latency.ttft.toFixed(1)} ms
              </span>
            </div>
            <div
              className="timeline-segment decode"
              style={{ width: `${latency.decodeFraction * 100}%` }}
            >
              <span className="segment-label">
                Decode ({outputLength - 1} × {latency.tpot.toFixed(1)} ms)<br />
                {((outputLength - 1) * latency.tpot).toFixed(1)} ms
              </span>
            </div>
          </div>
          <div className="timeline-total">
            Total: {latency.total.toFixed(1)} ms
          </div>
        </div>
      </div>

      <div className="regime-comparison">
        <h3>Prefill vs Decode: Different Workloads</h3>
        <div className="regimes">
          <div className="regime-card prefill">
            <h4>Prefill (TTFT)</h4>
            <ul>
              <li><strong>Nature:</strong> Parallel processing of all prompt tokens</li>
              <li><strong>Compute:</strong> O(T²) - Quadratic in prompt length</li>
              <li><strong>Memory:</strong> O(T) - Linear reads</li>
              <li>
                <strong>Intensity:</strong>{' '}
                <span className="intensity high">
                  {workload.computeIntensity.prefill.toFixed(1)} (compute-bound)
                </span>
              </li>
              <li><strong>Bottleneck:</strong> Compute (big matmuls)</li>
            </ul>
          </div>

          <div className="regime-card decode">
            <h4>Decode (TPOT)</h4>
            <ul>
              <li><strong>Nature:</strong> Sequential, one token at a time</li>
              <li><strong>Compute:</strong> O(T) - Linear in context</li>
              <li><strong>Memory:</strong> O(T × T_out) - KV cache reads</li>
              <li>
                <strong>Intensity:</strong>{' '}
                <span className="intensity low">
                  {workload.computeIntensity.decode.toFixed(3)} (memory-bound)
                </span>
              </li>
              <li><strong>Bottleneck:</strong> Memory bandwidth (KV cache)</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">TTFT</div>
          <div className="metric-value" style={{ color: MATH_COLORS.primary }}>
            {latency.ttft.toFixed(1)} ms
          </div>
          <div className="metric-detail">{(latency.prefillFraction * 100).toFixed(1)}% of total</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">TPOT</div>
          <div className="metric-value" style={{ color: MATH_COLORS.secondary }}>
            {latency.tpot.toFixed(1)} ms
          </div>
          <div className="metric-detail">Per output token</div>
        </div>

        <div className="metric-card">
          <div className="metric-label">Total Latency</div>
          <div className="metric-value" style={{ color: MATH_COLORS.accent }}>
            {latency.total.toFixed(0)} ms
          </div>
          <div className="metric-detail">{(latency.total / 1000).toFixed(2)} seconds</div>
        </div>
      </div>

      {/* Dynamic insight box */}
      <div
        className="dynamic-insight"
        style={{
          background: latency.prefillFraction > 0.6
            ? 'linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.08))'
            : latency.prefillFraction < 0.4
              ? 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(245, 158, 11, 0.08))'
              : 'linear-gradient(135deg, rgba(52, 211, 153, 0.15), rgba(34, 197, 94, 0.08))',
          border: latency.prefillFraction > 0.6
            ? '1px solid rgba(96, 165, 250, 0.3)'
            : latency.prefillFraction < 0.4
              ? '1px solid rgba(251, 146, 60, 0.3)'
              : '1px solid rgba(52, 211, 153, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div className="insight-box">
        <strong>★ Key Insight:</strong> Prefill and decode are fundamentally different workloads.
        Prefill is <strong>compute-bound</strong> (big parallel matrix multiplications), while
        decode is <strong>bandwidth-bound</strong> (reading huge KV caches). This is why DistServe
        disaggregates them—colocating these workloads creates interference and hurts both TTFT and TPOT.
        Long prompts dominate TTFT, long outputs dominate total cost.
      </div>

      <style jsx>{`
        .serving-latency-viz {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 2rem;
          margin: 2rem 0;
        }

        /* Presets section */
        .presets-section {
          margin-bottom: 1.5rem;
        }

        .presets-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.75rem;
        }

        .presets-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .challenge-btn {
          background: rgba(245, 158, 11, 0.15);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 0.5rem 1rem;
          color: var(--accent);
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .challenge-btn:hover, .challenge-btn.active {
          background: rgba(245, 158, 11, 0.25);
          border-color: var(--accent);
        }

        .presets-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 0.5rem;
        }

        .preset-btn {
          background: rgba(8, 12, 20, 0.8);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 8px;
          padding: 0.6rem 0.8rem;
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .preset-btn:hover {
          border-color: rgba(245, 158, 11, 0.4);
          background: rgba(245, 158, 11, 0.08);
        }

        .preset-btn.active {
          border-color: var(--accent);
          background: rgba(245, 158, 11, 0.15);
        }

        .preset-name {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.2rem;
        }

        .preset-desc {
          display: block;
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        /* Challenge panel */
        .challenge-panel {
          background: rgba(8, 12, 20, 0.9);
          border: 2px solid rgba(245, 158, 11, 0.4);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }

        .challenge-question {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .challenge-icon {
          font-size: 1.3rem;
        }

        .challenge-options {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }

        .option-btn {
          flex: 1;
          min-width: 150px;
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          padding: 0.75rem 1rem;
          color: var(--text-primary);
          cursor: pointer;
          font-size: 0.9rem;
          transition: all 0.2s;
        }

        .option-btn:hover:not(:disabled) {
          border-color: rgba(245, 158, 11, 0.5);
          background: rgba(245, 158, 11, 0.1);
        }

        .option-btn.selected {
          border-color: var(--accent);
          background: rgba(245, 158, 11, 0.2);
        }

        .option-btn.correct {
          border-color: rgba(34, 197, 94, 1);
          background: rgba(34, 197, 94, 0.2);
        }

        .option-btn.incorrect {
          border-color: rgba(239, 68, 68, 1);
          background: rgba(239, 68, 68, 0.2);
        }

        .challenge-result {
          padding: 1rem;
          border-radius: 8px;
          margin-top: 0.5rem;
        }

        .challenge-result.correct {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .challenge-result.incorrect {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .result-header {
          font-weight: 600;
          font-size: 1.1rem;
          margin-bottom: 0.5rem;
        }

        .result-explanation {
          font-size: 0.9rem;
          line-height: 1.6;
          color: var(--text-secondary);
        }

        .score-display {
          margin-top: 0.75rem;
          font-size: 0.85rem;
          color: var(--accent);
          font-weight: 600;
        }

        /* Dynamic insight */
        .dynamic-insight {
          padding: 1rem;
          border-radius: 10px;
          margin-bottom: 1rem;
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .control-group label {
          display: flex;
          align-items: center;
          gap: 0.75rem;
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
          min-width: 50px;
          text-align: right;
          color: var(--text-secondary);
          font-family: monospace;
        }

        .latency-breakdown {
          margin-bottom: 2rem;
        }

        .latency-breakdown h3 {
          margin-bottom: 0.5rem;
          font-size: 1rem;
        }

        .formula {
          text-align: center;
          font-size: 1.1rem;
          margin: 1rem 0;
          padding: 0.75rem;
          background: rgba(8, 12, 20, 0.5);
          border-radius: 6px;
          font-family: 'Computer Modern', serif;
        }

        .timeline {
          margin-top: 1.5rem;
        }

        .timeline-bar {
          display: flex;
          height: 60px;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .timeline-segment {
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: all 0.3s;
        }

        .timeline-segment.prefill {
          background: linear-gradient(135deg, ${MATH_COLORS.primary}40, ${MATH_COLORS.primary}20);
          border-right: 2px solid ${MATH_COLORS.primary};
        }

        .timeline-segment.decode {
          background: linear-gradient(135deg, ${MATH_COLORS.secondary}40, ${MATH_COLORS.secondary}20);
        }

        .segment-label {
          font-size: 0.75rem;
          font-weight: 600;
          text-align: center;
          padding: 0.5rem;
          line-height: 1.3;
        }

        .timeline-total {
          text-align: right;
          margin-top: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .regime-comparison {
          margin: 2rem 0;
        }

        .regime-comparison h3 {
          margin-bottom: 1rem;
          font-size: 1rem;
        }

        .regimes {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .regime-card {
          background: rgba(8, 12, 20, 0.8);
          border: 2px solid;
          border-radius: 8px;
          padding: 1.5rem;
        }

        .regime-card.prefill {
          border-color: ${MATH_COLORS.primary};
        }

        .regime-card.decode {
          border-color: ${MATH_COLORS.secondary};
        }

        .regime-card h4 {
          margin: 0 0 1rem 0;
          font-size: 1.1rem;
          color: var(--text-primary);
        }

        .regime-card ul {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .regime-card li {
          margin: 0.5rem 0;
          font-size: 0.85rem;
          line-height: 1.5;
        }

        .intensity {
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          font-family: monospace;
          font-weight: bold;
        }

        .intensity.high {
          background: rgba(34, 197, 94, 0.2);
          color: ${MATH_COLORS.primary};
        }

        .intensity.low {
          background: rgba(239, 68, 68, 0.2);
          color: rgba(239, 68, 68, 1);
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin: 2rem 0;
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
          margin-bottom: 0.25rem;
        }

        .metric-detail {
          font-size: 0.7rem;
          color: var(--text-tertiary);
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

        @media (max-width: 768px) {
          .controls {
            grid-template-columns: 1fr;
          }

          .segment-label {
            font-size: 0.65rem;
          }
        }
      `}</style>
    </div>
  );
}
