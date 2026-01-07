'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

// ─────────────────────────────────────────────────────────────
// Gamification Types
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed'
type SavingsPrediction = 'low' | 'medium' | 'high' | 'extreme' | null

interface SavingsChallenge {
  name: string
  sequenceLength: number
  answer: Exclude<SavingsPrediction, null>
  description: string
}

// Mystery challenges - users predict savings percentage
const SAVINGS_CHALLENGES: SavingsChallenge[] = [
  {
    name: '🎲 Short Prompt',
    sequenceLength: 3,
    answer: 'low',
    description: 'Just 3 tokens generated... how much can caching help?'
  },
  {
    name: '🎲 Chat Message',
    sequenceLength: 6,
    answer: 'medium',
    description: 'A typical short response... quadratic savings are building!'
  },
  {
    name: '🎲 Paragraph',
    sequenceLength: 10,
    answer: 'high',
    description: 'Getting longer now... O(L²) vs O(L) really diverges!'
  },
  {
    name: '🎲 Full Context',
    sequenceLength: 16,
    answer: 'extreme',
    description: 'Maximum context... imagine this at 100K tokens!'
  },
  {
    name: '🎲 Edge Case',
    sequenceLength: 2,
    answer: 'low',
    description: 'The very first cache hit... minimal savings?'
  },
]

// Calculate actual savings
function calculateSavings(seqLength: number): { percent: number; category: Exclude<SavingsPrediction, null> } {
  const naive = (seqLength * (seqLength + 1)) / 2
  const cached = seqLength
  const percent = naive > 0 ? ((naive - cached) / naive) * 100 : 0

  if (percent < 50) return { percent, category: 'low' }
  if (percent < 70) return { percent, category: 'medium' }
  if (percent < 85) return { percent, category: 'high' }
  return { percent, category: 'extreme' }
}

// Educational feedback
function getSavingsFeedback(
  prediction: SavingsPrediction,
  challenge: SavingsChallenge,
  actualPercent: number
): string {
  const isCorrect = prediction === challenge.answer
  const naive = (challenge.sequenceLength * (challenge.sequenceLength + 1)) / 2
  const cached = challenge.sequenceLength

  if (isCorrect) {
    if (challenge.answer === 'low') {
      return `✅ Correct! Only ${actualPercent.toFixed(0)}% savings. At small sequence lengths, the quadratic cost hasn't grown much yet. With ${naive} total ops vs ${cached} cached, the gap is modest.`
    }
    if (challenge.answer === 'medium') {
      return `✅ Correct! ${actualPercent.toFixed(0)}% savings. The O(L²) curve is starting to pull away! ${naive} ops without cache vs ${cached} with cache.`
    }
    if (challenge.answer === 'high') {
      return `✅ Correct! ${actualPercent.toFixed(0)}% savings! The quadratic term (${naive}) is now much larger than linear (${cached}). This is why KV cache is essential!`
    }
    return `✅ Correct! ${actualPercent.toFixed(0)}% savings!! At this scale, without caching you'd do ${naive} KV operations. With cache: just ${cached}. Imagine this at 100K tokens!`
  }

  // Wrong answers
  return `❌ Not quite! The actual savings is ${actualPercent.toFixed(0)}% (${challenge.answer}). At length ${challenge.sequenceLength}: naive = ${naive} ops, cached = ${cached} ops. Remember: naive grows as L(L+1)/2 while cached grows as L!`
}

interface KVCacheVisualizerProps {
  maxTokens?: number
}

interface Token {
  id: number
  label: string
}

const DEFAULT_MAX_TOKENS = 16

// Sequence length presets for quick exploration
const SEQUENCE_PRESETS = [
  { name: '📝 Short', length: 4, description: 'A brief prompt (4 tokens)' },
  { name: '💬 Chat', length: 8, description: 'Typical chat message (8 tokens)' },
  { name: '📄 Paragraph', length: 12, description: 'Full paragraph (12 tokens)' },
  { name: '📚 Maximum', length: 16, description: 'Full context (16 tokens)' },
];

// Dynamic educational insights based on current state
const getKVCacheInsight = (
  seqLength: number,
  savedPercent: number,
  maxTokens: number
): string => {
  if (seqLength === 1) {
    return '🚀 Starting fresh! At step 1, there\'s no cache advantage yet - we compute Q, K, V for the first token. The magic starts with token 2!';
  }
  if (seqLength === 2) {
    return '✨ First cache hit! Now Q₂ attends to K₁,V₁ from cache instead of recomputing them. We\'re already saving 33% work!';
  }
  if (seqLength <= 4) {
    return `📈 Building momentum! With ${seqLength} tokens, we've saved ${savedPercent.toFixed(0)}% of KV compute. Notice how savings grow quadratically!`;
  }
  if (seqLength <= 8) {
    return `💪 Significant savings! At ${seqLength} tokens, ${savedPercent.toFixed(0)}% of work avoided. This is why LLMs can do inference at all - O(L) vs O(L²) is huge!`;
  }
  if (seqLength <= 12) {
    return `🎯 Cache is crucial now! Without caching, we'd do ${Math.round((seqLength * (seqLength + 1)) / 2)} KV ops. With cache: just ${seqLength}. That's ${savedPercent.toFixed(0)}% savings!`;
  }
  if (seqLength >= maxTokens) {
    return `🏆 Maximum context reached! At ${seqLength} tokens, KV cache saves ${savedPercent.toFixed(0)}% of compute. Imagine this at 100K tokens - O(L²) would be impossible!`;
  }
  return `📊 ${savedPercent.toFixed(0)}% savings at length ${seqLength}. Real models cache across hundreds of thousands of tokens!`;
};

const KVCacheVisualizer: React.FC<KVCacheVisualizerProps> = ({
  maxTokens = DEFAULT_MAX_TOKENS,
}) => {
  const [tokens, setTokens] = useState<Token[]>(() => [{ id: 0, label: 'T1' }])
  const chartRef = useRef<SVGSVGElement | null>(null)

  // Auto-generate mode
  const [autoGenerating, setAutoGenerating] = useState(false)
  const autoGenIntervalRef = useRef<number | null>(null)

  // ─────────────────────────────────────────────────────────────
  // Gamification State
  // ─────────────────────────────────────────────────────────────
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<SavingsChallenge | null>(null)
  const [prediction, setPrediction] = useState<SavingsPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<string[]>([])

  // Game control functions
  const startChallenge = (challenge: SavingsChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setGamePhase('countdown')
    setCountdown(3)
  }

  const submitPrediction = (pred: SavingsPrediction) => {
    if (!selectedChallenge || gamePhase !== 'countdown') return
    setPrediction(pred)
    // Set tokens to the challenge's sequence length
    const newTokens: Token[] = []
    for (let i = 0; i < selectedChallenge.sequenceLength; i++) {
      newTokens.push({ id: i, label: `T${i + 1}` })
    }
    setTokens(newTokens)
    setGamePhase('revealed')
    // Score
    if (pred === selectedChallenge.answer) {
      setScore((s) => s + 1)
    }
    if (!completedChallenges.includes(selectedChallenge.name)) {
      setCompletedChallenges((c) => [...c, selectedChallenge.name])
    }
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(3)
  }

  const exitGameMode = () => {
    setGameMode(false)
    resetGame()
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) return

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1)
    }, 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown])

  const sequenceLength = tokens.length

  // Simple model of KV compute cost:
  //  - no cache: at step t, compute KV for all t tokens => sum_{t=1..L} t = L(L+1)/2  (O(L^2))
  //  - with cache: at step t, compute KV only for new token => sum_{t=1..L} 1 = L   (O(L))
  const naiveTotalKV = useMemo(
    () => (sequenceLength * (sequenceLength + 1)) / 2,
    [sequenceLength]
  )
  const cachedTotalKV = sequenceLength
  const savedKV = naiveTotalKV - cachedTotalKV
  const savedPercent =
    naiveTotalKV > 0 ? (savedKV / naiveTotalKV) * 100 : 0

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getKVCacheInsight(sequenceLength, savedPercent, maxTokens);
  }, [sequenceLength, savedPercent, maxTokens]);

  // Auto-generate effect
  useEffect(() => {
    if (!autoGenerating) {
      if (autoGenIntervalRef.current !== null) {
        window.clearInterval(autoGenIntervalRef.current);
        autoGenIntervalRef.current = null;
      }
      return;
    }

    autoGenIntervalRef.current = window.setInterval(() => {
      setTokens(prev => {
        if (prev.length >= maxTokens) {
          setAutoGenerating(false);
          return prev;
        }
        const nextIdx = prev.length;
        const newToken: Token = { id: nextIdx, label: `T${nextIdx + 1}` };
        return [...prev, newToken];
      });
    }, 600);

    return () => {
      if (autoGenIntervalRef.current !== null) {
        window.clearInterval(autoGenIntervalRef.current);
        autoGenIntervalRef.current = null;
      }
    };
  }, [autoGenerating, maxTokens]);

  // Stop auto-generation when reaching max
  useEffect(() => {
    if (tokens.length >= maxTokens && autoGenerating) {
      setAutoGenerating(false);
    }
  }, [tokens.length, maxTokens, autoGenerating]);

  const currentStepWorkNaive = sequenceLength
  const currentStepWorkCached = 1

  const formatInt = (n: number) => Math.round(n).toLocaleString('en-US')

  // D3 chart: memory / compute vs sequence length
  useEffect(() => {
    const svgEl = chartRef.current
    if (!svgEl) return

    const width = 360
    const height = 220
    const margin = { top: 18, right: 12, bottom: 38, left: 48 }
    const innerWidth = width - margin.left - margin.right
    const innerHeight = height - margin.top - margin.bottom

    const lengths = d3.range(1, maxTokens + 1)
    const noCacheSeries = lengths.map(L => (L * (L + 1)) / 2)
    const cacheSeries = lengths.map(L => L)
    const yMax = (d3.max(noCacheSeries) ?? 1) * 1.05

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()
    svg.attr('width', width).attr('height', height)

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    const x = d3
      .scaleLinear<number, number>()
      .domain([1, maxTokens])
      .range([0, innerWidth])

    const y = d3
      .scaleLinear<number, number>()
      .domain([0, yMax])
      .nice()
      .range([innerHeight, 0])

    // Grid lines
    const grid = g.append('g').attr('class', 'kv-grid')
    const yGrid = d3
      .axisLeft<number>(y)
      .ticks(4)
      .tickSize(-innerWidth)
      .tickFormat(() => '')

    grid
      .call(yGrid as any)
      .call(g =>
        g
          .selectAll('line')
          .attr('stroke', 'rgba(148,163,184,0.08)')
      )
      .call(g => g.select('path').remove())
      .attr('pointer-events', 'none')

    // Axes
    const xAxis = d3
      .axisBottom<number>(x)
      .ticks(5)
      .tickFormat(
        d3.format('d') as unknown as (value: number, index: number) => string
      )

    const yAxis = d3.axisLeft<number>(y).ticks(4)

    g.append('g')
      .attr('class', 'kv-axis kv-axis-x')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis as any)

    g.append('g')
      .attr('class', 'kv-axis kv-axis-y')
      .call(yAxis as any)

    g.selectAll('.kv-axis text')
      .attr('fill', '#9ca3af')
      .attr('font-size', 10)

    g.selectAll('.kv-axis line')
      .attr('stroke', 'rgba(148,163,184,0.35)')
      .attr('stroke-width', 1)

    g.selectAll('.kv-axis path')
      .attr('stroke', 'rgba(148,163,184,0.6)')
      .attr('stroke-width', 1)

    // Lines
    const lineGen = d3
      .line<number>()
      .x((_, i) => x(lengths[i]))
      .y(d => y(d))
      .curve(d3.curveMonotoneX)

    const noCachePath = g
      .append('path')
      .datum(noCacheSeries)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148,163,184,0.95)')
      .attr('stroke-width', 1.5)
      .attr('class', 'kv-line-no-cache')
      .attr('d', lineGen)

    const cachePath = g
      .append('path')
      .datum(cacheSeries)
      .attr('fill', 'none')
      .attr('stroke', '#14b8a6')
      .attr('stroke-width', 2)
      .attr('class', 'kv-line-cache')
      .attr('d', lineGen)

    // Animate teal line
    const cacheNode = cachePath.node() as SVGPathElement | null
    if (cacheNode) {
      const totalLength = cacheNode.getTotalLength()
      cachePath
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(650)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
    }

    // Highlight current sequence length
    const currentLength = Math.min(sequenceLength, maxTokens)
    const currentX = x(currentLength)
    const currentNoCacheVal = noCacheSeries[currentLength - 1]
    const currentCacheVal = cacheSeries[currentLength - 1]

    const highlight = g.append('g').attr('class', 'kv-highlight')

    highlight
      .append('line')
      .attr('x1', currentX)
      .attr('x2', currentX)
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', 'rgba(248,250,252,0.45)')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1)

    highlight
      .append('circle')
      .attr('cx', currentX)
      .attr('cy', y(currentNoCacheVal))
      .attr('r', 4)
      .attr('fill', 'rgba(148,163,184,0.95)')

    highlight
      .append('circle')
      .attr('cx', currentX)
      .attr('cy', y(currentCacheVal))
      .attr('r', 4.5)
      .attr('fill', '#14b8a6')

    // Legend
    const legend = g
      .append('g')
      .attr('class', 'kv-legend')
      .attr('transform', `translate(${innerWidth - 152},${8})`)

    const legendItems = [
      { color: 'rgba(148,163,184,0.95)', label: 'recompute every step (O(L²))' },
      { color: '#14b8a6', label: 'KV cache (O(L))' },
    ]

    legendItems.forEach((item, idx) => {
      const row = legend.append('g').attr('transform', `translate(0,${idx * 18})`)
      row
        .append('rect')
        .attr('width', 12)
        .attr('height', 12)
        .attr('rx', 2)
        .attr('fill', item.color)
      row
        .append('text')
        .attr('x', 18)
        .attr('y', 10)
        .attr('fill', '#9ca3af')
        .attr('font-size', 10)
        .text(item.label)
    })

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 28)
      .attr('fill', '#9ca3af')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .text('sequence length L')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -margin.left + 14)
      .attr('fill', '#9ca3af')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .text('relative KV work / memory')
  }, [sequenceLength, maxTokens])

  const handleGenerate = () => {
    setTokens(prev => {
      if (prev.length >= maxTokens) return prev
      const nextIdx = prev.length
      const newToken: Token = { id: nextIdx, label: `T${nextIdx + 1}` }
      return [...prev, newToken]
    })
  }

  const handleReset = () => {
    setTokens([{ id: 0, label: 'T1' }])
    setAutoGenerating(false)
  }

  const handlePreset = (length: number) => {
    setAutoGenerating(false)
    const newTokens: Token[] = []
    for (let i = 0; i < Math.min(length, maxTokens); i++) {
      newTokens.push({ id: i, label: `T${i + 1}` })
    }
    setTokens(newTokens)
  }

  // Layout constants for the attention diagram SVG
  const attentionWidth = 260
  const attentionHeight = 160
  const kvStartX = 30
  const keyWidth = 26
  const valueWidth = 26
  const kvGapX = 6
  const kvRowHeight = 18
  const kvStartY = 32
  const kvCellHeight = 12

  const qWidth = 30
  const qHeight = 18
  const qX = 190
  const qY =
    kvStartY + ((sequenceLength - 1) * kvRowHeight) / 2 - qHeight / 2

  return (
    <section className="kv-container">
      <div className="kv-inner">
        <header className="kv-header">
          <div>
            <h2 className="kv-title">KV Cache in Autoregressive Generation</h2>
            <p className="kv-subtitle">
              Click <span className="kv-subtitle-accent">Generate next token</span>{' '}
              to watch the KV cache grow and see how much recompute you avoid.
            </p>
            {/* Gamification Toggle */}
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => setGameMode(!gameMode)}
                className={`kv-button ${gameMode ? 'kv-game-active' : 'kv-button-ghost'}`}
                style={{ fontSize: '0.75rem', padding: '5px 12px' }}
              >
                {gameMode ? '🎮 Exit Challenge Mode' : '🎯 Try Savings Challenge'}
              </button>
              {score > 0 && (
                <span style={{ marginLeft: 10, fontSize: '0.75rem', color: '#fcd34d' }}>
                  Score: {score}/{completedChallenges.length}
                </span>
              )}
            </div>
          </div>
          <div className="kv-header-badge">
            <span className="kv-badge-pill">Q attends to cached K,V only</span>
          </div>
        </header>

        {/* ─────────────────────────────────────────────────────────────
            Gamification Panel
           ───────────────────────────────────────────────────────────── */}
        {gameMode && (
          <div className="kv-game-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fcd34d', margin: 0 }}>
                🎯 Savings Prediction Challenge
              </h3>
              {gamePhase !== 'setup' && (
                <button
                  type="button"
                  onClick={resetGame}
                  className="kv-button kv-button-ghost"
                  style={{ fontSize: '0.7rem', padding: '4px 10px' }}
                >
                  ← Back to Challenges
                </button>
              )}
            </div>

            {gamePhase === 'setup' && (
              <>
                <p style={{ fontSize: '0.78rem', color: '#d1d5db', marginBottom: 10 }}>
                  Can you predict how much compute the KV cache will save? Remember: savings = (O(L²) - O(L)) / O(L²)
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SAVINGS_CHALLENGES.map((challenge) => {
                    const isCompleted = completedChallenges.includes(challenge.name)
                    return (
                      <button
                        key={challenge.name}
                        type="button"
                        onClick={() => startChallenge(challenge)}
                        className={`kv-preset-btn ${isCompleted ? 'kv-preset-complete' : ''}`}
                      >
                        {isCompleted ? '✓ ' : ''}{challenge.name}
                      </button>
                    )
                  })}
                </div>
              </>
            )}

            {gamePhase === 'countdown' && selectedChallenge && (
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '0.85rem', color: '#fcd34d', marginBottom: 6, fontWeight: 500 }}>
                  {selectedChallenge.name}
                </p>
                <p style={{ fontSize: '0.78rem', color: '#d1d5db', marginBottom: 14, fontStyle: 'italic' }}>
                  &ldquo;{selectedChallenge.description}&rdquo;
                </p>
                <p style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: 10 }}>
                  At {selectedChallenge.sequenceLength} tokens, how much compute is saved?
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                  {[
                    { value: 'low' as const, label: '📉 Low', desc: '<50%' },
                    { value: 'medium' as const, label: '📊 Medium', desc: '50-70%' },
                    { value: 'high' as const, label: '📈 High', desc: '70-85%' },
                    { value: 'extreme' as const, label: '🚀 Extreme', desc: '>85%' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => submitPrediction(option.value)}
                      className="kv-game-option"
                    >
                      <div style={{ fontWeight: 500 }}>{option.label}</div>
                      <div style={{ fontSize: '0.65rem', color: '#9ca3af', marginTop: 2 }}>{option.desc}</div>
                    </button>
                  ))}
                </div>
                {countdown > 0 && (
                  <div style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                    Make your prediction! ({countdown}s to think...)
                  </div>
                )}
              </div>
            )}

            {gamePhase === 'revealed' && selectedChallenge && (
              <div>
                <div
                  className={`kv-game-result ${prediction === selectedChallenge.answer ? 'kv-game-correct' : 'kv-game-incorrect'}`}
                >
                  <p style={{ fontSize: '0.78rem', color: '#e5e7eb', lineHeight: 1.5, margin: 0 }}>
                    {getSavingsFeedback(prediction, selectedChallenge, calculateSavings(selectedChallenge.sequenceLength).percent)}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, fontSize: '0.7rem', color: '#9ca3af', marginTop: 10 }}>
                  <div>
                    Your guess: <span style={{ color: prediction === selectedChallenge.answer ? '#86efac' : '#fca5a5' }}>
                      {prediction === 'low' ? '📉 Low' : prediction === 'medium' ? '📊 Medium' : prediction === 'high' ? '📈 High' : '🚀 Extreme'}
                    </span>
                  </div>
                  <div>
                    Actual: <span style={{ color: '#fcd34d' }}>
                      {selectedChallenge.answer === 'low' ? '📉 Low' : selectedChallenge.answer === 'medium' ? '📊 Medium' : selectedChallenge.answer === 'high' ? '📈 High' : '🚀 Extreme'}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 10, marginBottom: 0 }}>
                  👆 The visualization now shows {selectedChallenge.sequenceLength} tokens - check the chart!
                </p>
              </div>
            )}
          </div>
        )}

        <div className="kv-body">
          {/* LEFT: timeline, cache stack, attention diagram */}
          <div className="kv-left">
            {/* 1. Timeline of token generation */}
            <div className="kv-panel">
              <div className="kv-panel-header">
                <h3>1. Token timeline (left → right)</h3>
                <span className="kv-panel-tag">
                  step {sequenceLength} / {maxTokens}
                </span>
              </div>
              <div className="kv-token-row">
                {tokens.map((token, idx) => {
                  const isCurrent = idx === tokens.length - 1
                  return (
                    <div
                      key={token.id}
                      className={`kv-token ${isCurrent ? 'kv-token-current' : 'kv-token-cached'}`}
                    >
                      <div className="kv-token-label">{token.label}</div>
                      <div className="kv-token-sub">
                        {isCurrent ? 'Q, K, V (new)' : 'K, V cached'}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 2. KV cache + 3. Only the new Q attends to all cached K,V */}
            <div className="kv-panel kv-panel-split">
              {/* KV cache as growing stack */}
              <div className="kv-subpanel">
                <h3 className="kv-subpanel-title">2. Growing KV cache</h3>
                <div className="kv-cache-layout">
                  <div className="kv-cache-frame">
                    <div className="kv-cache-header">
                      <span className="kv-cache-title">KV cache</span>
                      <span className="kv-cache-subtitle">stored once per token</span>
                    </div>
                    <div className="kv-cache-stack">
                      {tokens.map((token, idx) => (
                        <div
                          key={token.id}
                          className="kv-cache-block"
                          style={{
                            opacity: 0.6 + (idx / Math.max(tokens.length - 1, 1)) * 0.4,
                          }}
                        >
                          <span className="kv-cache-block-label">
                            {token.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="kv-cache-meta">
                    <div className="kv-meta-row">
                      <span className="kv-meta-label">Cache size</span>
                      <span className="kv-meta-value">
                        {sequenceLength} KV pairs
                      </span>
                    </div>
                    <div className="kv-meta-row">
                      <span className="kv-meta-label">Growth</span>
                      <span className="kv-meta-value">O(L) memory</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attention diagram: new Q attends to all cached K,V */}
              <div className="kv-subpanel">
                <h3 className="kv-subpanel-title">3. Only new Q attends</h3>
                <div className="kv-attention-wrapper">
                  <svg
                    className="kv-attention-svg"
                    width={attentionWidth}
                    height={attentionHeight}
                    viewBox={`0 0 ${attentionWidth} ${attentionHeight}`}
                    role="img"
                    aria-label="Q of the new token attending to cached keys and values"
                  >
                    {/* Labels */}
                    <text
                      x={kvStartX + keyWidth / 2}
                      y={18}
                      className="kv-attention-label"
                    >
                      K
                    </text>
                    <text
                      x={kvStartX + keyWidth + kvGapX + valueWidth / 2}
                      y={18}
                      className="kv-attention-label"
                    >
                      V
                    </text>
                    <text x={qX + qWidth / 2} y={18} className="kv-attention-label">
                      Q (new token)
                    </text>

                    {/* KV rows */}
                    {tokens.map((token, idx) => {
                      const rowY = kvStartY + idx * kvRowHeight
                      return (
                        <g
                          key={`${token.id}-${sequenceLength}`}
                          transform={`translate(0,${rowY})`}
                        >
                          <rect
                            x={kvStartX}
                            y={0}
                            width={keyWidth}
                            height={kvCellHeight}
                            rx={3}
                            className="kv-attention-k"
                          />
                          <rect
                            x={kvStartX + keyWidth + kvGapX}
                            y={0}
                            width={valueWidth}
                            height={kvCellHeight}
                            rx={3}
                            className="kv-attention-v"
                          />
                          <text
                            x={kvStartX - 8}
                            y={kvCellHeight / 2 + 3}
                            className="kv-attention-token-label"
                          >
                            {token.label}
                          </text>
                        </g>
                      )
                    })}

                    {/* New Q for last token */}
                    <g transform={`translate(${qX},${qY})`}>
                      <rect
                        x={0}
                        y={0}
                        width={qWidth}
                        height={qHeight}
                        rx={4}
                        className="kv-attention-q"
                      />
                      <text
                        x={qWidth / 2}
                        y={qHeight / 2 + 3}
                        className="kv-attention-q-label"
                      >
                        Q_t
                      </text>
                    </g>

                    {/* Lines: Q_t → all K */}
                    {tokens.map((token, idx) => {
                      const rowY = kvStartY + idx * kvRowHeight
                      const kCenterX = kvStartX + keyWidth / 2
                      const kCenterY = rowY + kvCellHeight / 2
                      const qCenterX = qX + qWidth / 2
                      const qCenterY = qY + qHeight / 2
                      return (
                        <line
                          key={`line-${token.id}-${sequenceLength}`}
                          x1={qCenterX}
                          y1={qCenterY}
                          x2={kCenterX}
                          y2={kCenterY}
                          className="kv-attention-line"
                        />
                      )
                    })}
                  </svg>
                  <p className="kv-caption">
                    At step t, only <span className="kv-caption-strong">Qₜ</span> is
                    fresh. All previous <span className="kv-caption-strong">K,V</span>{' '}
                    are reused from the cache.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: memory / compute chart + stats + controls */}
          <div className="kv-right">
            <div className="kv-panel">
              <h3>4. Memory / compute with and without KV cache</h3>
              <svg ref={chartRef} className="kv-chart-svg" />
              <p className="kv-caption">
                Without caching you redo work for all previous tokens each step
                (gray), giving <span className="kv-caption-strong">O(L²)</span> KV
                work. With KV cache (teal), total KV work grows only{' '}
                <span className="kv-caption-strong">O(L)</span>.
              </p>
            </div>

            <div className="kv-panel kv-panel-stats">
              <h3>5. Computational savings</h3>
              <div className="kv-stat-grid">
                <div className="kv-stat">
                  <div className="kv-stat-label">Sequence length</div>
                  <div className="kv-stat-value">{sequenceLength}</div>
                  <div className="kv-stat-note">tokens generated so far</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">Total KV (no cache)</div>
                  <div className="kv-stat-value">
                    {formatInt(naiveTotalKV)}
                  </div>
                  <div className="kv-stat-note">recomputed every step</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">Total KV (with cache)</div>
                  <div className="kv-stat-value">
                    {formatInt(cachedTotalKV)}
                  </div>
                  <div className="kv-stat-note">each token once</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">This step&apos;s KV work</div>
                  <div className="kv-stat-value">
                    {currentStepWorkNaive} → {currentStepWorkCached}
                  </div>
                  <div className="kv-stat-note">
                    naive → cached at step {sequenceLength}
                  </div>
                </div>
              </div>

              <div className="kv-counter">
                <div className="kv-counter-label">KV computations avoided</div>
                <div className="kv-counter-value">
                  ≈{formatInt(savedKV)}
                </div>
                <div className="kv-counter-note">
                  ~{savedPercent.toFixed(0)}% less KV work vs recomputing
                </div>
              </div>

              {/* Dynamic educational insight */}
              <div className="kv-insight">
                {currentInsight}
              </div>

              <div className="kv-controls">
                <button
                  type="button"
                  className="kv-button kv-button-primary"
                  onClick={handleGenerate}
                  disabled={sequenceLength >= maxTokens || autoGenerating}
                >
                  Generate next token
                </button>
                <button
                  type="button"
                  className="kv-button kv-button-secondary"
                  onClick={() => setAutoGenerating(a => !a)}
                  disabled={sequenceLength >= maxTokens}
                >
                  {autoGenerating ? '⏸ Pause' : '▶ Auto-generate'}
                </button>
                <button
                  type="button"
                  className="kv-button kv-button-ghost"
                  onClick={handleReset}
                >
                  Reset
                </button>
                <span className="kv-max-note">
                  Max tokens: {maxTokens}
                </span>
              </div>

              {/* Sequence presets */}
              <div className="kv-presets">
                <span className="kv-presets-label">Jump to:</span>
                {SEQUENCE_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`kv-preset-btn ${sequenceLength === preset.length ? 'kv-preset-active' : ''}`}
                    onClick={() => handlePreset(preset.length)}
                    title={preset.description}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        .kv-container {
          background: #080c14;
          border-radius: 16px;
          border: 1px solid rgba(148, 163, 184, 0.3);
          padding: 24px;
          color: #e5e7eb;
          font-family: system-ui, -apple-system, BlinkMacSystemFont, 'SF Pro Text',
            'Inter', sans-serif;
        }

        .kv-inner {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .kv-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .kv-title {
          font-size: 1.25rem;
          font-weight: 600;
          letter-spacing: 0.02em;
          margin: 0 0 4px;
        }

        .kv-subtitle {
          margin: 0;
          font-size: 0.875rem;
          color: #9ca3af;
        }

        .kv-subtitle-accent {
          color: #f59e0b;
          font-weight: 500;
        }

        .kv-header-badge {
          display: flex;
          align-items: center;
        }

        .kv-badge-pill {
          border-radius: 9999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: radial-gradient(
            circle at top left,
            rgba(245, 158, 11, 0.16),
            rgba(15, 23, 42, 0.95)
          );
          color: #fbbf24;
          white-space: nowrap;
        }

        .kv-body {
          display: flex;
          flex-wrap: wrap;
          gap: 20px;
        }

        .kv-left {
          flex: 3;
          min-width: min(100%, 520px);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .kv-right {
          flex: 2;
          min-width: min(100%, 320px);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .kv-panel {
          border-radius: 14px;
          padding: 14px 16px 16px;
          background: radial-gradient(
              circle at top left,
              rgba(15, 23, 42, 0.96),
              rgba(15, 23, 42, 0.98)
            ),
            linear-gradient(to bottom right, rgba(15, 23, 42, 0.96), #020617);
          border: 1px solid rgba(148, 163, 184, 0.35);
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.65);
        }

        .kv-panel-header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 10px;
        }

        .kv-panel > h3,
        .kv-panel-header h3 {
          font-size: 0.95rem;
          font-weight: 500;
          margin: 0;
        }

        .kv-panel-tag {
          font-size: 0.7rem;
          padding: 2px 8px;
          border-radius: 9999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          color: #9ca3af;
          white-space: nowrap;
        }

        .kv-panel-split {
          display: grid;
          grid-template-columns: 1.1fr 1.1fr;
          gap: 12px;
        }

        @media (max-width: 900px) {
          .kv-panel-split {
            grid-template-columns: minmax(0, 1fr);
          }
        }

        .kv-subpanel {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kv-subpanel-title {
          margin: 0;
          font-size: 0.9rem;
          font-weight: 500;
        }

        /* Timeline */
        .kv-token-row {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          align-items: flex-end;
        }

        .kv-token {
          min-width: 66px;
          padding: 7px 9px;
          border-radius: 9999px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          line-height: 1.15;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(15, 23, 42, 0.95);
          color: #e5e7eb;
          animation: kv-pop-in 0.32s ease-out;
        }

        .kv-token-current {
          background: #f59e0b;
          color: #111827;
          border-color: rgba(251, 191, 36, 0.9);
          box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.7),
            0 14px 32px rgba(0, 0, 0, 0.7);
          transform: translateY(-1px);
        }

        .kv-token-cached {
          background: rgba(20, 184, 166, 0.08);
          border-color: rgba(45, 212, 191, 0.7);
          color: #a5f3fc;
        }

        .kv-token-label {
          font-weight: 500;
          font-size: 0.75rem;
        }

        .kv-token-sub {
          font-size: 0.68rem;
          opacity: 0.8;
        }

        /* KV cache stack */
        .kv-cache-layout {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .kv-cache-frame {
          border-radius: 12px;
          padding: 10px 10px 8px;
          border: 1px dashed rgba(45, 212, 191, 0.7);
          background: radial-gradient(
            circle at top left,
            rgba(20, 184, 166, 0.16),
            rgba(15, 23, 42, 0.98)
          );
        }

        .kv-cache-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 4px;
          margin-bottom: 6px;
        }

        .kv-cache-title {
          font-size: 0.8rem;
          font-weight: 500;
          color: #a5f3fc;
        }

        .kv-cache-subtitle {
          font-size: 0.7rem;
          color: #67e8f9;
          opacity: 0.85;
        }

        .kv-cache-stack {
          display: flex;
          flex-direction: column-reverse;
          gap: 5px;
          max-height: 150px;
          overflow: hidden;
        }

        .kv-cache-block {
          height: 14px;
          border-radius: 9999px;
          background: linear-gradient(to right, #14b8a6, #0f766e);
          position: relative;
          animation: kv-pop-in 0.3s ease-out;
        }

        .kv-cache-block-label {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 0.65rem;
          color: #ecfeff;
        }

        .kv-cache-meta {
          display: grid;
          gap: 2px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .kv-meta-row {
          display: flex;
          justify-content: space-between;
          gap: 6px;
        }

        .kv-meta-label {
          opacity: 0.9;
        }

        .kv-meta-value {
          color: #e5e7eb;
        }

        /* Attention diagram */
        .kv-attention-wrapper {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .kv-attention-svg {
          width: 100%;
          max-width: 280px;
          height: auto;
          display: block;
        }

        .kv-attention-label {
          fill: #9ca3af;
          font-size: 0.65rem;
        }

        .kv-attention-token-label {
          fill: #9ca3af;
          font-size: 0.65rem;
          text-anchor: end;
        }

        .kv-attention-k {
          fill: rgba(20, 184, 166, 0.95);
        }

        .kv-attention-v {
          fill: rgba(45, 212, 191, 0.6);
        }

        .kv-attention-q {
          fill: #f59e0b;
          stroke: rgba(253, 224, 71, 0.9);
          stroke-width: 1;
          filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.7));
        }

        .kv-attention-q-label {
          fill: #111827;
          font-size: 0.7rem;
          text-anchor: middle;
          font-weight: 600;
        }

        .kv-attention-line {
          stroke: rgba(248, 250, 252, 0.5);
          stroke-width: 1;
          stroke-linecap: round;
          stroke-dasharray: 120;
          stroke-dashoffset: 120;
          animation: kv-draw-line 0.45s ease-out forwards;
        }

        /* Chart */
        .kv-chart-svg {
          width: 100%;
          height: 210px;
          display: block;
          margin-top: 6px;
        }

        .kv-caption {
          margin-top: 8px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .kv-caption-strong {
          color: #f59e0b;
          font-weight: 500;
        }

        /* Stats & controls */
        .kv-panel-stats {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .kv-stat-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .kv-stat {
          border-radius: 10px;
          padding: 7px 8px;
          background: linear-gradient(
            to bottom right,
            rgba(15, 23, 42, 0.95),
            rgba(10, 16, 30, 0.98)
          );
          border: 1px solid rgba(148, 163, 184, 0.5);
        }

        .kv-stat-label {
          font-size: 0.7rem;
          color: #9ca3af;
          margin-bottom: 2px;
        }

        .kv-stat-value {
          font-size: 0.95rem;
          font-weight: 600;
          color: #f9fafb;
        }

        .kv-stat-note {
          font-size: 0.7rem;
          color: #6b7280;
          margin-top: 1px;
        }

        .kv-counter {
          margin-top: 2px;
          border-radius: 11px;
          padding: 8px 10px;
          background: radial-gradient(
            circle at top left,
            rgba(245, 158, 11, 0.22),
            rgba(15, 23, 42, 0.96)
          );
          border: 1px solid rgba(245, 158, 11, 0.6);
        }

        .kv-counter-label {
          font-size: 0.75rem;
          color: #fcd34d;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .kv-counter-value {
          font-size: 1.2rem;
          font-weight: 700;
          color: #fed7aa;
          text-shadow: 0 0 16px rgba(248, 250, 252, 0.18);
        }

        .kv-counter-note {
          font-size: 0.75rem;
          color: #e5e7eb;
          opacity: 0.85;
        }

        .kv-controls {
          margin-top: 8px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
        }

        .kv-button {
          font-size: 0.8rem;
          border-radius: 9999px;
          padding: 7px 16px;
          cursor: pointer;
          border: none;
        }

        .kv-button-primary {
          background: #f59e0b;
          color: #111827;
          font-weight: 600;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
          transition: transform 0.15s ease-out,
            box-shadow 0.15s ease-out,
            background-color 0.15s ease-out,
            opacity 0.15s ease-out;
        }

        .kv-button-primary:hover:enabled {
          transform: translateY(-1px);
          box-shadow: 0 14px 32px rgba(0, 0, 0, 0.85);
          background: #fbbf24;
        }

        .kv-button-primary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        .kv-button-ghost {
          background: transparent;
          border: 1px solid rgba(148, 163, 184, 0.7);
          color: #e5e7eb;
          font-weight: 500;
          padding-inline: 14px;
          transition: background-color 0.15s ease-out,
            border-color 0.15s ease-out;
        }

        .kv-button-ghost:hover {
          background: rgba(15, 23, 42, 0.95);
          border-color: rgba(148, 163, 184, 0.95);
        }

        .kv-button-secondary {
          background: rgba(20, 184, 166, 0.2);
          border: 1px solid rgba(45, 212, 191, 0.6);
          color: #a5f3fc;
          font-weight: 500;
          padding-inline: 14px;
          transition: background-color 0.15s ease-out,
            border-color 0.15s ease-out;
        }

        .kv-button-secondary:hover:enabled {
          background: rgba(20, 184, 166, 0.35);
          border-color: rgba(45, 212, 191, 0.9);
        }

        .kv-button-secondary:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .kv-insight {
          margin-top: 10px;
          padding: 10px 12px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(96, 165, 250, 0.15), rgba(59, 130, 246, 0.08));
          border: 1px solid rgba(96, 165, 250, 0.3);
          font-size: 0.82rem;
          color: rgba(255, 255, 255, 0.9);
          line-height: 1.5;
        }

        .kv-presets {
          margin-top: 10px;
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 6px;
        }

        .kv-presets-label {
          font-size: 0.75rem;
          color: #9ca3af;
          margin-right: 4px;
        }

        .kv-preset-btn {
          font-size: 0.72rem;
          border-radius: 9999px;
          padding: 4px 10px;
          cursor: pointer;
          border: 1px solid rgba(148, 163, 184, 0.4);
          background: rgba(15, 23, 42, 0.7);
          color: #e5e7eb;
          transition: all 0.15s ease-out;
        }

        .kv-preset-btn:hover {
          background: rgba(20, 184, 166, 0.15);
          border-color: rgba(45, 212, 191, 0.6);
        }

        .kv-preset-active {
          background: rgba(20, 184, 166, 0.3);
          border-color: rgba(45, 212, 191, 0.8);
          color: #a5f3fc;
        }

        .kv-preset-complete {
          background: rgba(34, 197, 94, 0.15);
          border-color: #22c55e;
          color: #86efac;
        }

        .kv-max-note {
          font-size: 0.75rem;
          color: #6b7280;
        }

        /* Gamification styles */
        .kv-game-active {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(249, 115, 22, 0.1));
          border: 1px solid #f59e0b;
          color: #fcd34d;
        }

        .kv-game-panel {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(249, 115, 22, 0.05));
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .kv-game-option {
          font-size: 0.75rem;
          padding: 8px 14px;
          border-radius: 10px;
          border: 1px solid #6b7280;
          background: rgba(55, 65, 81, 0.7);
          color: #e5e7eb;
          cursor: pointer;
          transition: all 0.15s ease-out;
          text-align: center;
        }

        .kv-game-option:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.5);
        }

        .kv-game-result {
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 8px;
        }

        .kv-game-correct {
          background: rgba(34, 197, 94, 0.15);
          border: 1px solid rgba(34, 197, 94, 0.4);
        }

        .kv-game-incorrect {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.4);
        }

        /* Animations */
        @keyframes kv-pop-in {
          0% {
            opacity: 0;
            transform: scale(0.85) translateY(4px);
          }
          100% {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes kv-draw-line {
          0% {
            stroke-dashoffset: 120;
          }
          100% {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </section>
  )
}

export default KVCacheVisualizer
