'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { callAxis } from '../../lib/d3Types'
import { clearDemoState, emitDemoState } from '../../lib/demoState'
import { useKeyboardNav } from '../../lib/useKeyboardNav'

// ─────────────────────────────────────────────────────────────
// Prediction checkpoint types
// ─────────────────────────────────────────────────────────────
type PredictionPhase = 'setup' | 'predicting' | 'revealed'
type SavingsPrediction = 'low' | 'medium' | 'high' | 'extreme' | null

interface SavingsChallenge {
  name: string
  sequenceLength: number
  description: string
}

// Learners predict the bucket before seeing the computed work comparison.
const SAVINGS_CHALLENGES: SavingsChallenge[] = [
  {
    name: 'Short prompt',
    sequenceLength: 3,
    description: 'Only three generated tokens. The quadratic curve has barely started.'
  },
  {
    name: 'Chat message',
    sequenceLength: 6,
    description: 'A short response where repeated KV projection work starts to separate.'
  },
  {
    name: 'Paragraph',
    sequenceLength: 10,
    description: 'Long enough that recomputing all prior K,V vectors becomes visibly wasteful.'
  },
  {
    name: 'Full local window',
    sequenceLength: 16,
    description: 'The largest local window in this toy lab; the scaling gap is the point.'
  },
  {
    name: 'Edge case',
    sequenceLength: 2,
    description: 'The first moment when a previous K,V pair can be reused.'
  },
]

// Prediction options for keyboard navigation
const PREDICTION_OPTIONS = [
  { value: 'low' as const, label: 'Low', desc: '<50%' },
  { value: 'medium' as const, label: 'Medium', desc: '50-70%' },
  { value: 'high' as const, label: 'High', desc: '70-85%' },
  { value: 'extreme' as const, label: 'Extreme', desc: '>85%' },
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

function predictionLabel(prediction: SavingsPrediction): string {
  if (prediction === 'low') return 'low savings'
  if (prediction === 'medium') return 'medium savings'
  if (prediction === 'high') return 'high savings'
  if (prediction === 'extreme') return 'extreme savings'
  return 'none'
}

// Educational feedback
function getSavingsFeedback(
  prediction: SavingsPrediction,
  challenge: SavingsChallenge,
  actualPercent: number
): string {
  const actual = calculateSavings(challenge.sequenceLength)
  const isCorrect = prediction === actual.category
  const naive = (challenge.sequenceLength * (challenge.sequenceLength + 1)) / 2
  const cached = challenge.sequenceLength
  const mechanism = `No cache recomputes ${naive} K,V token-projections; the cache computes ${cached}. K,V are computed once per token, but the new query still attends over the cached prefix.`

  if (isCorrect) {
    if (actual.category === 'low') {
      return `Matched. Savings are ${actualPercent.toFixed(0)}%, because the sequence is still short. ${mechanism}`
    }
    if (actual.category === 'medium') {
      return `Matched. Savings are ${actualPercent.toFixed(0)}%; the L(L+1)/2 curve is starting to pull away from L. ${mechanism}`
    }
    if (actual.category === 'high') {
      return `Matched. Savings are ${actualPercent.toFixed(0)}%; the avoided K,V recomputation is now the dominant visible effect. ${mechanism}`
    }
    return `Matched. Savings are ${actualPercent.toFixed(0)}%; in long decode loops, avoiding K,V recomputation is essential. ${mechanism}`
  }

  return `Actual bucket: ${actual.category}. Savings are ${actualPercent.toFixed(0)}%. ${mechanism}`
}

interface KVCacheVisualizerProps {
  maxTokens?: number
  conceptId?: string
}

interface Token {
  id: number
  label: string
}

const DEFAULT_MAX_TOKENS = 16

// Sequence length presets for quick exploration
const SEQUENCE_PRESETS = [
  { name: 'Short', length: 4, description: 'A brief prompt (4 tokens)' },
  { name: 'Chat', length: 8, description: 'Typical chat message (8 tokens)' },
  { name: 'Paragraph', length: 12, description: 'Full paragraph (12 tokens)' },
  { name: 'Maximum', length: 16, description: 'Full context (16 tokens)' },
];

// Dynamic educational insights based on current state
const getKVCacheInsight = (
  seqLength: number,
  savedPercent: number,
  maxTokens: number
): string => {
  if (seqLength === 1) {
    return 'At step 1 there is no cache advantage yet: the model computes Q, K, and V for the first token.';
  }
  if (seqLength === 2) {
    return 'First reuse: Q_2 can read K_1,V_1 from cache instead of recomputing the previous K,V pair.';
  }
  if (seqLength <= 4) {
    return `With ${seqLength} tokens, the cache avoids ${savedPercent.toFixed(0)}% of KV projection recomputation. The gap is still modest, but the shape is visible.`;
  }
  if (seqLength <= 8) {
    return `At ${seqLength} tokens, ${savedPercent.toFixed(0)}% of KV projection work is avoided. The cache changes repeated K,V computation from L(L+1)/2 to L.`;
  }
  if (seqLength <= 12) {
    return `Without caching, this toy decode would compute ${Math.round((seqLength * (seqLength + 1)) / 2)} K,V token-projections. With cache: ${seqLength}.`;
  }
  if (seqLength >= maxTokens) {
    return `At ${seqLength} tokens, the cache avoids ${savedPercent.toFixed(0)}% of repeated K,V projection work. Attention still reads the cached prefix, and the cache still occupies memory.`;
  }
  return `${savedPercent.toFixed(0)}% of repeated K,V projection work is avoided at length ${seqLength}.`;
};

const KVCacheVisualizer: React.FC<KVCacheVisualizerProps> = ({
  maxTokens = DEFAULT_MAX_TOKENS,
  conceptId = 'efficient-attention',
}) => {
  const [tokens, setTokens] = useState<Token[]>(() => [{ id: 0, label: 'T1' }])
  const chartRef = useRef<SVGSVGElement | null>(null)

  // Auto-generate mode
  const [autoGenerating, setAutoGenerating] = useState(false)
  const autoGenIntervalRef = useRef<number | null>(null)

  // ─────────────────────────────────────────────────────────────
  // Prediction checkpoint state
  // ─────────────────────────────────────────────────────────────
  const [predictionPhase, setPredictionPhase] = useState<PredictionPhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<SavingsChallenge | null>(null)
  const [prediction, setPrediction] = useState<SavingsPrediction>(null)

  // Keyboard navigation for prediction options
  const predictionNav = useKeyboardNav({
    options: PREDICTION_OPTIONS,
    onSelect: (option) => submitPrediction(option.value),
    onEscape: () => {
      setPredictionPhase('setup')
      setSelectedChallenge(null)
    },
    enabled: predictionPhase === 'predicting',
  })

  // Prediction control functions
  const startChallenge = (challenge: SavingsChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setPredictionPhase('predicting')
  }

  const submitPrediction = (pred: SavingsPrediction) => {
    if (!selectedChallenge || predictionPhase !== 'predicting') return
    setPrediction(pred)
    // Set tokens to the challenge's sequence length
    const newTokens: Token[] = []
    for (let i = 0; i < selectedChallenge.sequenceLength; i++) {
      newTokens.push({ id: i, label: `T${i + 1}` })
    }
    setTokens(newTokens)
    setPredictionPhase('revealed')
  }

  const resetPrediction = () => {
    setPredictionPhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
  }

  useEffect(() => {
    return () => clearDemoState(conceptId)
  }, [conceptId])

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
  const attentionKeysReadThisStep = sequenceLength
  const retainedKVMemory = sequenceLength

  const formatInt = (n: number) => Math.round(n).toLocaleString('en-US')

  useEffect(() => {
    const challengeActual = selectedChallenge
      ? calculateSavings(selectedChallenge.sequenceLength)
      : null
    const revealedPrediction = predictionPhase === 'revealed'
    const values = [
      `sequence length L: ${sequenceLength}`,
      `no-cache KV projection work: ${formatInt(naiveTotalKV)} token-computes`,
      `cached KV projection work: ${formatInt(cachedTotalKV)} token-computes`,
      `saved KV projection work: ${formatInt(savedKV)} token-computes`,
      `saved KV projection work percent: ${savedPercent.toFixed(1)}%`,
      `current decode step without cache: ${formatInt(currentStepWorkNaive)} K,V token-computes`,
      `current decode step with cache: ${formatInt(currentStepWorkCached)} K,V token-compute`,
      `attention span this step: ${attentionKeysReadThisStep} cached keys/values`,
      `retained cache memory: ${retainedKVMemory} K,V pairs`,
      'invariant: K,V are computed once per token; the new query still attends across cached keys',
    ]

    if (selectedChallenge && challengeActual) {
      values.push(
        `prediction case: ${selectedChallenge.name}`,
        `prediction length: ${selectedChallenge.sequenceLength}`,
        `prediction: ${predictionLabel(prediction)}`,
        `actual bucket: ${revealedPrediction ? predictionLabel(challengeActual.category) : 'hidden until reveal'}`,
        `prediction correct: ${revealedPrediction ? (prediction === challengeActual.category ? 'yes' : 'no') : 'not checked'}`,
        `actual savings: ${revealedPrediction ? `${challengeActual.percent.toFixed(1)}%` : 'hidden until reveal'}`
      )
    }

    emitDemoState({
      conceptId,
      label: 'KV cache decode-compute witness',
      summary:
        revealedPrediction && selectedChallenge && challengeActual
          ? `At L=${selectedChallenge.sequenceLength}, KV cache computes ${formatInt(cachedTotalKV)} K,V token-projections instead of ${formatInt(naiveTotalKV)}, saving ${challengeActual.percent.toFixed(1)}%.`
          : selectedChallenge
          ? `The learner is predicting the KV projection savings bucket for L=${selectedChallenge.sequenceLength}; exact work stays hidden until reveal.`
          : `At L=${sequenceLength}, KV cache computes ${formatInt(cachedTotalKV)} K,V token-projections instead of ${formatInt(naiveTotalKV)}, saving ${savedPercent.toFixed(1)}%.`,
      phase:
        revealedPrediction
          ? 'revealed'
          : selectedChallenge
          ? 'predicted'
          : 'observing',
      prediction: selectedChallenge
        ? {
            prompt: `At L=${selectedChallenge.sequenceLength}, which KV projection savings bucket applies?`,
            learnerChoice: predictionLabel(prediction),
            actual: revealedPrediction && challengeActual ? predictionLabel(challengeActual.category) : 'hidden',
            correct: revealedPrediction && challengeActual ? prediction === challengeActual.category : undefined,
          }
        : undefined,
      measurements:
        selectedChallenge && !revealedPrediction
          ? {
              currentVisibleSequenceLength: sequenceLength,
              predictionLength: selectedChallenge.sequenceLength,
              exactPredictionWorkHidden: true,
            }
          : {
              sequenceLength,
              noCacheKvProjectionWork: naiveTotalKV,
              cachedKvProjectionWork: cachedTotalKV,
              savedKvProjectionWork: savedKV,
              savedPercent: Number(savedPercent.toFixed(1)),
              currentStepNoCacheKvWork: currentStepWorkNaive,
              currentStepCachedKvWork: currentStepWorkCached,
              attentionKeysReadThisStep,
              retainedKvPairs: retainedKVMemory,
            },
      invariant: 'K,V are computed once per token; the new query still attends across cached keys, and the cache still occupies memory.',
      nextQuestion: 'When sequence length grows, does the serving bottleneck move from recomputing K,V to reading/storing the KV cache?',
      values,
    })
  }, [
    cachedTotalKV,
    conceptId,
    attentionKeysReadThisStep,
    currentStepWorkCached,
    currentStepWorkNaive,
    naiveTotalKV,
    prediction,
    predictionPhase,
    retainedKVMemory,
    savedKV,
    savedPercent,
    selectedChallenge,
    sequenceLength,
  ])

  // D3 chart: repeated KV projection work vs sequence length.
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
    svg
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')

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
      .call(callAxis(yGrid))
      .call(g =>
        g
          .selectAll('line')
          .attr('stroke', 'rgba(229,240,248,0.08)')
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
      .call(callAxis(xAxis))

    g.append('g')
      .attr('class', 'kv-axis kv-axis-y')
      .call(callAxis(yAxis))

    g.selectAll('.kv-axis text')
      .attr('fill', 'rgba(238,247,255,0.58)')
      .attr('font-size', 10)

    g.selectAll('.kv-axis line')
      .attr('stroke', 'rgba(229,240,248,0.18)')
      .attr('stroke-width', 1)

    g.selectAll('.kv-axis path')
      .attr('stroke', 'rgba(229,240,248,0.24)')
      .attr('stroke-width', 1)

    // Lines
    const lineGen = d3
      .line<number>()
      .x((_, i) => x(lengths[i]))
      .y(d => y(d))
      .curve(d3.curveMonotoneX)

    const _noCachePath = g
      .append('path')
      .datum(noCacheSeries)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(207,218,231,0.74)')
      .attr('stroke-width', 1.5)
      .attr('class', 'kv-line-no-cache')
      .attr('d', lineGen)

    const cachePath = g
      .append('path')
      .datum(cacheSeries)
      .attr('fill', 'none')
      .attr('stroke', '#22b8a6')
      .attr('stroke-width', 2)
      .attr('class', 'kv-line-cache')
      .attr('d', lineGen)

    // Animate teal line
    const cacheNode = cachePath.node() as SVGPathElement | null
    if (cacheNode && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
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
      .attr('stroke', 'rgba(232,180,73,0.62)')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1)

    highlight
      .append('circle')
      .attr('cx', currentX)
      .attr('cy', y(currentNoCacheVal))
      .attr('r', 4)
      .attr('fill', 'rgba(207,218,231,0.78)')

    highlight
      .append('circle')
      .attr('cx', currentX)
      .attr('cy', y(currentCacheVal))
      .attr('r', 4.5)
      .attr('fill', '#22b8a6')

    // Legend
    const legend = g
      .append('g')
      .attr('class', 'kv-legend')
      .attr('transform', 'translate(8,8)')

    const legendItems = [
      { color: 'rgba(207,218,231,0.78)', label: 'no cache: recompute K,V for prefix' },
      { color: '#22b8a6', label: 'cache: compute each K,V once' },
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
        .attr('fill', 'rgba(238,247,255,0.64)')
        .attr('font-size', 10)
        .text(item.label)
    })

    // Axis labels
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 28)
      .attr('fill', 'rgba(238,247,255,0.64)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .text('sequence length L')

    g.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('x', -innerHeight / 2)
      .attr('y', -margin.left + 14)
      .attr('fill', 'rgba(238,247,255,0.64)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .text('KV projection token-computes')
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
  const attentionHeight = Math.max(160, 56 + sequenceLength * 18)
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
  const loopPhase =
    predictionPhase === 'setup'
      ? 'question'
      : predictionPhase === 'predicting'
        ? 'predict'
        : 'evidence'

  return (
    <section className="kv-container cf-surface-lab">
      <div className="kv-inner">
        <header className="kv-header">
          <div>
            <h2 className="kv-title">KV Cache in Autoregressive Generation</h2>
            <p className="kv-subtitle">
              Predict the KV projection work saved during decoding. K,V are cached
              once per token; the new query still attends over the cached prefix.
            </p>
          </div>
          <div className="kv-header-badge">
            <span className="kv-badge-pill">K,V cached once; Q_t still attends over K_1...K_t</span>
          </div>
        </header>

        <ol className="kv-loop-rail" aria-label="KV cache learning loop">
          <li className={`kv-loop-step ${loopPhase === 'question' ? 'is-active' : 'is-complete'}`}>
            <span className="kv-loop-index">1</span>
            <span>
              <strong>Question</strong>
              <small>Where does repeated K,V work grow?</small>
            </span>
          </li>
          <li className={`kv-loop-step ${loopPhase === 'predict' ? 'is-active' : predictionPhase === 'revealed' ? 'is-complete' : ''}`}>
            <span className="kv-loop-index">2</span>
            <span>
              <strong>Predict</strong>
              <small>Choose the savings bucket before reveal.</small>
            </span>
          </li>
          <li className={`kv-loop-step ${loopPhase === 'evidence' ? 'is-active' : ''}`}>
            <span className="kv-loop-index">3</span>
            <span>
              <strong>Evidence</strong>
              <small>Compare L(L+1)/2 with L.</small>
            </span>
          </li>
          <li className={predictionPhase === 'revealed' ? 'kv-loop-step is-invariant' : 'kv-loop-step'}>
            <span className="kv-loop-index">4</span>
            <span>
              <strong>Invariant</strong>
              <small>K,V are cached; Q_t still attends.</small>
            </span>
          </li>
        </ol>

        <div className="kv-prediction-panel cf-prediction-gate" data-child-demo-gate="kv-cache-projection-work">
          <div className="kv-prediction-head">
            <div>
              <h3>Predict the KV projection savings</h3>
              <p>
                Pick a decode length, commit a bucket, then reveal the exact
                K,V recomputation work. This does not claim attention is free:
                the new query still reads the cached prefix.
              </p>
            </div>
            {predictionPhase !== 'setup' ? (
              <button type="button" onClick={resetPrediction} className="kv-button kv-button-ghost">
                Choose another case
              </button>
            ) : null}
          </div>

          {predictionPhase === 'setup' ? (
            <div className="kv-case-grid" aria-label="KV cache prediction cases">
              {SAVINGS_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  type="button"
                  onClick={() => startChallenge(challenge)}
                  className="kv-case-button"
                >
                  <strong>{challenge.name}</strong>
                  <span>L={challenge.sequenceLength}</span>
                  <small>{challenge.description}</small>
                </button>
              ))}
            </div>
          ) : null}

          {predictionPhase === 'predicting' && selectedChallenge ? (
            <div className="kv-prediction-workspace">
              <div className="kv-prediction-copy">
                <strong>{selectedChallenge.name}: L={selectedChallenge.sequenceLength}</strong>
                <p>{selectedChallenge.description}</p>
                <p className="sr-only">Use arrow keys to navigate options, Enter to select, Escape to leave the prediction.</p>
              </div>
              <div {...predictionNav.containerProps} className="prediction-options">
                {PREDICTION_OPTIONS.map((option, index) => (
                  <button
                    key={option.value}
                    type="button"
                    {...predictionNav.getOptionProps(option, index)}
                    className={`kv-prediction-option ${predictionNav.focusedIndex === index ? 'kb-focused' : ''}`}
                  >
                    <strong>{option.label}</strong>
                    <span>{option.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {predictionPhase === 'revealed' && selectedChallenge ? (() => {
            const actual = calculateSavings(selectedChallenge.sequenceLength)
            const correct = prediction === actual.category
            return (
              <div className="kv-prediction-result" role="status" aria-live="polite" aria-atomic="true">
                <div className={correct ? 'kv-result-card kv-result-good' : 'kv-result-card kv-result-miss'}>
                  <strong>{correct ? 'Prediction matched' : `Actual bucket: ${actual.category}`}</strong>
                  <p>{getSavingsFeedback(prediction, selectedChallenge, actual.percent)}</p>
                </div>
                <div className="kv-result-facts">
                  <span>Your prediction: {predictionLabel(prediction)}</span>
                  <span>Actual: {predictionLabel(actual.category)}</span>
                  <span>Saved: {actual.percent.toFixed(1)}%</span>
                </div>
              </div>
            )
          })() : null}
        </div>

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
                        {isCurrent ? 'Q_t, K_t, V_t computed now' : 'K,V reused'}
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
                <h3 className="kv-subpanel-title">3. Q_t attends to cached K_1...K_t</h3>
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
                    At decode step t, the model computes Q_t, K_t, V_t for the
                    new token, appends K_t,V_t to the cache, then Q_t attends
                    over K_1...K_t and reads V_1...V_t. KV cache removes repeated
                    K,V projections; it does not remove attention over the prefix.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: KV projection work chart + stats + controls */}
          <div className="kv-right">
            <div className="kv-panel">
              <h3>4. Cumulative KV projection work during decoding</h3>
              <svg ref={chartRef} className="kv-chart-svg" role="img" aria-label="KV projection work comparison chart showing L squared recomputation without KV cache versus linear K,V projection work with caching" />
              <p className="kv-caption">
                Gray recomputes K,V for all tokens at every decode step:
                1 + 2 + ... + L. Teal computes each token&apos;s K,V once and
                reuses them. This chart excludes attention-weight and value mixing,
                MLPs, output projections, and memory bandwidth.
              </p>
            </div>

            <div className="kv-panel kv-panel-stats">
              <h3>5. Recomputed K,V avoided</h3>
              <div className="kv-stat-grid">
                <div className="kv-stat">
                  <div className="kv-stat-label">Sequence length</div>
                  <div className="kv-stat-value">{sequenceLength}</div>
                  <div className="kv-stat-note">tokens generated so far</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">KV projections, no cache</div>
                  <div className="kv-stat-value">
                    {formatInt(naiveTotalKV)}
                  </div>
                  <div className="kv-stat-note">recomputed every step</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">KV projections, cached</div>
                  <div className="kv-stat-value">
                    {formatInt(cachedTotalKV)}
                  </div>
                  <div className="kv-stat-note">each token once</div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">This step&apos;s KV projection work</div>
                  <div className="kv-stat-value">
                    {currentStepWorkNaive} → {currentStepWorkCached}
                  </div>
                  <div className="kv-stat-note">
                    no cache → cached at step {sequenceLength}
                  </div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">Attention span this step</div>
                  <div className="kv-stat-value">{attentionKeysReadThisStep}</div>
                  <div className="kv-stat-note">
                    tokens; unchanged by KV cache
                  </div>
                </div>
                <div className="kv-stat">
                  <div className="kv-stat-label">Retained cache memory</div>
                  <div className="kv-stat-value">{retainedKVMemory}</div>
                  <div className="kv-stat-note">
                    K,V pairs grow with context length
                  </div>
                </div>
              </div>

              <div className="kv-counter">
                <div className="kv-counter-label">KV projection recomputes avoided</div>
                <div className="kv-counter-value">
                  ≈{formatInt(savedKV)}
                </div>
                <div className="kv-counter-note">
                  ~{savedPercent.toFixed(0)}% fewer K,V projection token-computes than recomputing the prefix each step
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
                  {autoGenerating ? 'Pause' : 'Auto-generate'}
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
          background:
            radial-gradient(circle at 12% 0%, rgba(34, 184, 166, 0.16), transparent 34%),
            linear-gradient(135deg, var(--cf-lab-panel), var(--cf-lab));
          border-radius: 14px;
          border: 1px solid var(--cf-line-dark);
          padding: 24px;
          color: #eef7ff;
          font-family: var(--font-body);
          box-shadow: var(--cf-shadow-lab);
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
          font-family: var(--font-display);
          font-size: 1.28rem;
          font-weight: 600;
          letter-spacing: 0;
          margin: 0 0 4px;
          padding-left: 0;
          color: #f7fbff;
          line-height: 1.2;
        }

        .kv-title::before {
          content: none;
          display: none;
        }

        .kv-subtitle {
          margin: 0;
          font-size: 0.875rem;
          color: rgba(238, 247, 255, 0.72);
          max-width: 68ch;
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
          border: 1px solid rgba(34, 184, 166, 0.45);
          background: radial-gradient(
            circle at top left,
            var(--cf-invariant-soft),
            rgba(8, 21, 35, 0.95)
          );
          color: #a8fff2;
          white-space: nowrap;
        }

        .kv-loop-rail {
          list-style: none;
          margin: 0;
          padding: 10px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          border-radius: 12px;
          border: 1px solid rgba(229, 240, 248, 0.13);
          background:
            linear-gradient(135deg, rgba(247, 241, 230, 0.08), rgba(8, 21, 35, 0.5)),
            repeating-linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 18px);
        }

        .kv-loop-step {
          min-width: 0;
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 8px;
          align-items: start;
          padding: 9px;
          border-radius: 10px;
          border: 1px solid rgba(229, 240, 248, 0.1);
          background: rgba(8, 21, 35, 0.38);
          color: rgba(238, 247, 255, 0.68);
        }

        .kv-loop-index {
          width: 22px;
          height: 22px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 9999px;
          border: 1px solid rgba(229, 240, 248, 0.18);
          color: rgba(238, 247, 255, 0.72);
          font-family: var(--font-mono);
          font-size: 0.68rem;
        }

        .kv-loop-step strong {
          display: block;
          color: inherit;
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .kv-loop-step small {
          display: block;
          margin-top: 2px;
          color: rgba(238, 247, 255, 0.62);
          font-size: 0.68rem;
          line-height: 1.3;
        }

        .kv-loop-step.is-active {
          border-color: rgba(232, 180, 73, 0.46);
          background: linear-gradient(135deg, var(--cf-active-soft), rgba(8, 21, 35, 0.58));
          color: #ffe7aa;
        }

        .kv-loop-step.is-complete {
          border-color: rgba(79, 143, 216, 0.38);
          background: linear-gradient(135deg, var(--cf-evidence-soft), rgba(8, 21, 35, 0.48));
          color: #cfe6ff;
        }

        .kv-loop-step.is-invariant {
          border-color: rgba(34, 184, 166, 0.45);
          background: linear-gradient(135deg, var(--cf-invariant-soft), rgba(8, 21, 35, 0.5));
          color: #b8fff3;
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
          border-radius: 12px;
          padding: 14px 16px 16px;
          background: radial-gradient(
              circle at top left,
              rgba(34, 184, 166, 0.08),
              rgba(16, 34, 53, 0.96)
            ),
            linear-gradient(to bottom right, rgba(16, 34, 53, 0.97), rgba(8, 21, 35, 0.98));
          border: 1px solid rgba(229, 240, 248, 0.16);
          box-shadow: 0 16px 36px rgba(3, 10, 18, 0.38);
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
          border: 1px solid rgba(232, 180, 73, 0.42);
          color: #f3d795;
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
          max-height: none;
          overflow: visible;
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
          text-anchor: middle;
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

        .kv-max-note {
          font-size: 0.75rem;
          color: #6b7280;
        }

        .kv-prediction-panel {
          margin-bottom: 16px;
          padding: 14px 16px;
          border-radius: 12px;
          background:
            linear-gradient(135deg, var(--cf-active-soft), rgba(34, 184, 166, 0.08)),
            linear-gradient(180deg, rgba(247, 241, 230, 0.06), transparent);
          border: 1px solid rgba(232, 180, 73, 0.34);
        }

        .kv-prediction-head {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          align-items: flex-start;
          margin-bottom: 12px;
        }

        .kv-prediction-head h3 {
          margin: 0 0 4px;
          color: #ffe4a8;
          font-size: 0.95rem;
          font-weight: 600;
        }

        .kv-prediction-head p,
        .kv-prediction-copy p,
        .kv-result-card p {
          margin: 0;
          color: rgba(238, 247, 255, 0.76);
          font-size: 0.8rem;
          line-height: 1.5;
        }

        .kv-case-grid,
        .prediction-options,
        .kv-result-facts {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .kv-case-grid {
          grid-template-columns: repeat(5, minmax(0, 1fr));
        }

        .kv-case-button,
        .kv-prediction-option {
          min-width: 0;
          border-radius: 10px;
          border: 1px solid rgba(229, 240, 248, 0.16);
          background: rgba(8, 21, 35, 0.7);
          color: #eef7ff;
          cursor: pointer;
          transition: all 0.15s ease-out;
        }

        .kv-case-button {
          display: grid;
          gap: 4px;
          padding: 10px;
          text-align: left;
        }

        .kv-case-button strong,
        .kv-prediction-option strong,
        .kv-result-card strong {
          color: #f8fafc;
          font-size: 0.8rem;
        }

        .kv-case-button span,
        .kv-result-facts span {
          color: #a8fff2;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .kv-case-button small,
        .kv-prediction-option span {
          color: rgba(238, 247, 255, 0.64);
          font-size: 0.72rem;
          line-height: 1.32;
        }

        .kv-case-button:hover,
        .kv-prediction-option:hover {
          background: rgba(34, 184, 166, 0.16);
          border-color: rgba(34, 184, 166, 0.56);
        }

        .kv-prediction-workspace {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(18rem, 1.2fr);
          gap: 12px;
          align-items: center;
        }

        .kv-prediction-copy {
          display: grid;
          gap: 4px;
        }

        .kv-prediction-copy strong {
          color: #ffe4a8;
        }

        .kv-prediction-option {
          font-size: 0.75rem;
          padding: 8px 14px;
          text-align: center;
          display: grid;
          gap: 2px;
        }

        .kv-prediction-option.kb-focused {
          outline: 2px solid rgba(251, 191, 36, 0.85);
          outline-offset: 2px;
        }

        .kv-result-card {
          padding: 10px 12px;
          border-radius: 10px;
          margin-bottom: 10px;
        }

        .kv-result-good {
          background: var(--cf-invariant-soft);
          border: 1px solid rgba(34, 184, 166, 0.44);
        }

        .kv-result-miss {
          background: var(--cf-active-soft);
          border: 1px solid rgba(232, 180, 73, 0.38);
        }

        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        @media (max-width: 640px) {
          .kv-container {
            padding: 14px;
            border-radius: 12px;
          }

          .kv-header,
          .kv-panel-header {
            flex-direction: column;
            align-items: stretch;
          }

          .kv-header-badge {
            align-self: flex-start;
            max-width: 100%;
          }

          .kv-badge-pill,
          .kv-panel-tag {
            white-space: normal;
            line-height: 1.35;
          }

          .kv-body {
            gap: 14px;
          }

          .kv-loop-rail {
            grid-template-columns: 1fr;
            padding: 8px;
          }

          .kv-loop-step {
            min-height: 54px;
          }

          .kv-prediction-head,
          .kv-prediction-workspace {
            display: grid;
            grid-template-columns: 1fr;
          }

          .kv-case-grid,
          .prediction-options,
          .kv-result-facts {
            grid-template-columns: 1fr;
          }

          .kv-button,
          .kv-prediction-option,
          .kv-preset-btn {
            min-height: 44px;
          }

          .kv-case-button {
            min-height: 72px;
          }

          .kv-panel {
            padding: 12px;
            overflow: hidden;
          }

          .kv-attention-svg,
          .kv-chart-svg {
            max-width: 100%;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .kv-token,
          .kv-cache-block,
          .kv-attention-line {
            animation: none;
          }
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
