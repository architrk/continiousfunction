Here’s a self‑contained client-side component you can drop into a Next.js app.
It uses **TypeScript + TSX**, **D3.js** for the memory/compute chart, and CSS animations for smooth transitions, on a dark theme with the colors you specified.



```tsx
'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

interface KVCacheVisualizerProps {
  maxTokens?: number
}

interface Token {
  id: number
  label: string
}

const DEFAULT_MAX_TOKENS = 16

const KVCacheVisualizer: React.FC<KVCacheVisualizerProps> = ({
  maxTokens = DEFAULT_MAX_TOKENS,
}) => {
  const [tokens, setTokens] = useState<Token[]>(() => [{ id: 0, label: 'T1' }])
  const chartRef = useRef<SVGSVGElement | null>(null)

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
          </div>
          <div className="kv-header-badge">
            <span className="kv-badge-pill">Q attends to cached K,V only</span>
          </div>
        </header>

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

              <div className="kv-controls">
                <button
                  type="button"
                  className="kv-button kv-button-primary"
                  onClick={handleGenerate}
                  disabled={sequenceLength >= maxTokens}
                >
                  Generate next token
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

        .kv-max-note {
          font-size: 0.75rem;
          color: #6b7280;
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
```

### How to use

* Install D3 if you haven’t yet:

```bash
npm install d3
# or
yarn add d3
```

* Drop the file into `components/KVCacheVisualizer.tsx`.
* Use it from a page or another component:

```tsx
import KVCacheVisualizer from '@/components/KVCacheVisualizer'

export default function Page() {
  return (
    <main>
      <KVCacheVisualizer maxTokens={16} />
    </main>
  )
}
```

The component:

* Shows a **timeline** of tokens (current token in **orange**, cached ones in **teal**).
* Visualizes the **KV cache** as a growing stack.
* Shows **only the latest token’s Q** attending to all cached K,V.
* Uses **D3** to compare **quadratic vs linear** KV work/memory.
* Has an interactive **“Generate next token”** button, plus a **compute savings counter** that accumulates as you go.
