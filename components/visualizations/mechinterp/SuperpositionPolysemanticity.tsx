'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'

type SuperpositionExplorerProps = {
  width?: number
  height?: number
}

type Feature = {
  index: number
  angle: number // radians
  color: string
}

type GamePhase = 'setup' | 'countdown' | 'revealed'
type OverlapPrediction = 'A' | 'B' | null

interface InterferenceChallenge {
  name: string
  question: string
  numFeatures: number
  featureA: number  // 0-indexed
  featureB: number
  // Which has higher overlap with the active feature?
  activeFeature: number
  answer: 'A' | 'B'  // Which has higher overlap
  insight: string
}

const INTERFERENCE_CHALLENGES: InterferenceChallenge[] = [
  {
    name: '🎲 Adjacent vs Opposite',
    question: 'Feature 1 is active. Which has HIGHER overlap: Feature 2 (adjacent) or Feature 4 (opposite)?',
    numFeatures: 5,
    activeFeature: 0,
    featureA: 1,  // adjacent
    featureB: 3,  // opposite
    answer: 'A',
    insight: 'adjacent features (72° apart) have cos(72°) ≈ 0.31, while opposite features (144° apart) have cos(144°) ≈ -0.81',
  },
  {
    name: '🎲 Crowded Space',
    question: 'With 8 features, Feature 1 active. Higher overlap: Feature 2 or Feature 5?',
    numFeatures: 8,
    activeFeature: 0,
    featureA: 1,  // adjacent (45° away)
    featureB: 4,  // 180° away
    answer: 'A',
    insight: 'with 8 features (45° spacing), adjacent overlap is cos(45°) ≈ 0.71—high interference!',
  },
  {
    name: '🎲 Minimal Interference',
    question: 'With only 3 features, Feature 1 active. Does Feature 2 have positive or negative overlap?',
    numFeatures: 3,
    activeFeature: 0,
    featureA: 1,  // 120° away → cos(120°) = -0.5
    featureB: 2,  // 240° away → cos(240°) = -0.5 (same!)
    answer: 'A',  // Trick: both are equal, but we'll ask differently
    insight: 'with 3 features (120° spacing), cos(120°) = -0.5—negative overlap! ReLU zeros this out',
  },
  {
    name: '🎲 Dense Packing',
    question: 'With 16 features (22.5° spacing), Feature 1 vs Feature 2 overlap is cos(22.5°)≈0.92. Is Feature 8 overlap higher or lower?',
    numFeatures: 16,
    activeFeature: 0,
    featureA: 1,   // 22.5° → cos ≈ 0.92
    featureB: 7,   // 157.5° → cos ≈ -0.92
    answer: 'A',
    insight: 'opposite features (157.5°) have cos ≈ -0.92. Dense packing means huge positive overlap with neighbors!',
  },
]

function computeOverlap(
  numFeatures: number,
  activeIdx: number,
  targetIdx: number
): number {
  const activeAngle = (2 * Math.PI * activeIdx) / numFeatures
  const targetAngle = (2 * Math.PI * targetIdx) / numFeatures
  return Math.cos(activeAngle - targetAngle)
}

function getInterferenceFeedback(
  predicted: OverlapPrediction,
  challenge: InterferenceChallenge
): string {
  const overlapA = computeOverlap(challenge.numFeatures, challenge.activeFeature, challenge.featureA)
  const overlapB = computeOverlap(challenge.numFeatures, challenge.activeFeature, challenge.featureB)
  const isCorrect = predicted === challenge.answer

  const stats = `Feature ${challenge.featureA + 1} overlap: ${overlapA.toFixed(2)}, Feature ${challenge.featureB + 1} overlap: ${overlapB.toFixed(2)}`

  if (isCorrect) {
    return `✓ Correct! ${stats}. ${challenge.insight}. Angular spacing = 360°/${challenge.numFeatures} = ${(360 / challenge.numFeatures).toFixed(1)}°.`
  }
  return `✗ Not quite. ${stats}. ${challenge.insight}. The overlap is cos(Δangle)—closer features have higher positive overlap.`
}

const MIN_FEATURES = 2
const MAX_FEATURES = 16

function radiansToDegrees(rad: number): number {
  return (rad * 180) / Math.PI
}

export default function SuperpositionExplorer({
  width = 420,
  height = 420,
}: SuperpositionExplorerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [numFeatures, setNumFeatures] = useState(5)
  const [activeFeature, setActiveFeature] = useState(0)
  const [useReLU, setUseReLU] = useState(true)

  // Game state
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [activeChallenge, setActiveChallenge] = useState<InterferenceChallenge | null>(null)
  const [prediction, setPrediction] = useState<OverlapPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [gameScore, setGameScore] = useState({ correct: 0, total: 0 })

  // Game control functions
  function startChallenge(challenge: InterferenceChallenge) {
    setActiveChallenge(challenge)
    setNumFeatures(challenge.numFeatures)
    setActiveFeature(challenge.activeFeature)
    setPrediction(null)
    setGamePhase('setup')
  }

  function submitPrediction(pred: OverlapPrediction) {
    if (!activeChallenge || gamePhase !== 'setup') return
    setPrediction(pred)
    setGamePhase('countdown')
    setCountdown(3)
  }

  function resetGame() {
    setGamePhase('setup')
    setActiveChallenge(null)
    setPrediction(null)
    setCountdown(3)
  }

  // Countdown timer effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown <= 0) {
      setGamePhase('revealed')
      if (activeChallenge && prediction) {
        const isCorrect = prediction === activeChallenge.answer
        setGameScore((s) => ({
          correct: s.correct + (isCorrect ? 1 : 0),
          total: s.total + 1,
        }))
      }
      return
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [gamePhase, countdown, activeChallenge, prediction])

  // Keep activeFeature in range when numFeatures changes
  useEffect(() => {
    setActiveFeature((prev) => Math.min(prev, numFeatures - 1))
  }, [numFeatures])

  const features: Feature[] = useMemo(() => {
    // Distinct colors for each feature
    const baseColors =
      (d3.schemeTableau10 as readonly string[]) ||
      (d3.schemeCategory10 as readonly string[])

    return Array.from({ length: numFeatures }, (_, i) => {
      const angle = (2 * Math.PI * i) / numFeatures // evenly spaced => 72° when N=5
      return {
        index: i,
        angle,
        color: baseColors[i % baseColors.length],
      }
    })
  }, [numFeatures])

  // Active feature's overlap with all others (cosine of angle difference)
  const activationData = useMemo(() => {
    if (features.length === 0) return []

    const active = features[activeFeature]
    return features.map((f) => {
      const diff = active.angle - f.angle
      const raw = Math.cos(diff) // [-1, 1]
      const relu = Math.max(0, raw)
      return {
        feature: f,
        raw,
        relu,
      }
    })
  }, [features, activeFeature])

  const maxAbsOverlap = useMemo(() => {
    if (activationData.length === 0) return 1
    return Math.max(
      ...activationData.map((d) => Math.abs(d.raw)),
      1e-3
    )
  }, [activationData])

  // Main D3 vector visualization
  useEffect(() => {
    const svgEl = svgRef.current
    if (!svgEl) return

    const svg = d3.select(svgEl)
    const W = width
    const H = height
    const centerX = W / 2
    const centerY = H / 2
    const radius = Math.min(W, H) * 0.38

    svg.attr('viewBox', `0 0 ${W} ${H}`)

    // Clear previous contents
    svg.selectAll('*').remove()

    // Background
    svg
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', W)
      .attr('height', H)
      .attr('fill', '#080c14')

    const g = svg.append('g').attr('transform', `translate(${centerX}, ${centerY})`)

    // Axes
    g.append('line')
      .attr('x1', -radius)
      .attr('y1', 0)
      .attr('x2', radius)
      .attr('y2', 0)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)

    g.append('line')
      .attr('x1', 0)
      .attr('y1', -radius)
      .attr('x2', 0)
      .attr('y2', radius)
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)

    // Unit circle
    g.append('circle')
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1.2)
      .attr('stroke-dasharray', '4,4')

    // Interference zones on the circle (red bands)
    const segments = 180
    const threshold = 0.6 // "strong" positive response
    const interferenceFlags: boolean[] = []

    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments
      const dirX = Math.cos(angle)
      const dirY = Math.sin(angle)

      let strongCount = 0
      features.forEach((f) => {
        const fx = Math.cos(f.angle)
        const fy = Math.sin(f.angle)
        let dot = fx * dirX + fy * dirY
        if (useReLU) dot = Math.max(0, dot)
        if (dot > threshold) strongCount++
      })

      // Interference: more than one feature wants to fire on this direction
      interferenceFlags.push(strongCount >= 2)
    }

    type ArcDatum = { startAngle: number; endAngle: number }

    const arcs: ArcDatum[] = []
    let currentStart: number | null = null

    for (let i = 0; i < segments; i++) {
      const angle = (2 * Math.PI * i) / segments
      const isInterfering = interferenceFlags[i]

      if (isInterfering && currentStart === null) {
        currentStart = angle
      } else if (!isInterfering && currentStart !== null) {
        arcs.push({ startAngle: currentStart, endAngle: angle })
        currentStart = null
      }
    }
    // Wrap-around case
    if (currentStart !== null) {
      arcs.push({ startAngle: currentStart, endAngle: 2 * Math.PI })
    }

    const arcGenerator = d3
      .arc<ArcDatum>()
      .innerRadius(radius * 0.72)
      .outerRadius(radius * 0.98)

    g.append('g')
      .selectAll('path.interference-arc')
      .data(arcs)
      .join('path')
      .attr('class', 'interference-arc')
      .attr('d', (d) => arcGenerator(d) ?? null)
      .attr('fill', 'rgba(220, 38, 38, 0.45)')

    // Feature vectors
    const vectorsGroup = g.append('g').attr('class', 'feature-vectors')

    vectorsGroup
      .selectAll('line.feature-vector')
      .data(features)
      .join('line')
      .attr('class', 'feature-vector')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', (d) => Math.cos(d.angle) * radius * 0.9)
      .attr('y2', (d) => -Math.sin(d.angle) * radius * 0.9)
      .attr('stroke', (d) => d.color)
      .attr('stroke-width', (d) => (d.index === activeFeature ? 4 : 2))
      .attr('opacity', (d) => (d.index === activeFeature ? 1 : 0.8))

    // Vector tips
    vectorsGroup
      .selectAll('circle.vector-tip')
      .data(features)
      .join('circle')
      .attr('class', 'vector-tip')
      .attr('cx', (d) => Math.cos(d.angle) * radius * 0.9)
      .attr('cy', (d) => -Math.sin(d.angle) * radius * 0.9)
      .attr('r', (d) => (d.index === activeFeature ? 5 : 3))
      .attr('fill', (d) => d.color)
      .attr('stroke', '#000')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('click', (_, d: Feature) => {
        setActiveFeature(d.index)
      })

    // Labels at the edge of the circle
    const labelRadius = radius * 1.05
    vectorsGroup
      .selectAll('text.feature-label')
      .data(features)
      .join('text')
      .attr('class', 'feature-label')
      .attr('x', (d) => Math.cos(d.angle) * labelRadius)
      .attr('y', (d) => -Math.sin(d.angle) * labelRadius)
      .attr('fill', '#e5e7eb')
      .attr('font-size', 11)
      .attr('text-anchor', (d) => {
        const deg = radiansToDegrees(d.angle)
        if (deg > 75 && deg < 105) return 'middle'
        if (deg > 255 && deg < 285) return 'middle'
        return deg > 180 ? 'end' : 'start'
      })
      .attr('dy', '0.35em')
      .text((d) => (d.index === activeFeature ? `Feature ${d.index + 1} ★` : `Feature ${d.index + 1}`))

    // Small legend text
    g.append('text')
      .attr('x', 0)
      .attr('y', radius + 24)
      .attr('fill', '#9ca3af')
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .text('Red bands: directions where multiple features fire at once (superposition interference)')
  }, [features, activeFeature, useReLU, width, height])

  const featuresPerDim = (numFeatures / 2).toFixed(1)

  return (
    <section
      className="card interactive-card"
      style={{
        background: '#080c14',
        border: '1px solid #111827',
        borderRadius: '1rem',
        padding: '1.25rem',
        color: '#e5e7eb',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.25rem' }}>
        Superposition & Polysemantic Neurons (2D Toy)
      </h2>
      <p style={{ fontSize: '0.9rem', color: '#9ca3af', marginBottom: '0.75rem' }}>
        We only have <strong>2 dimensions</strong>, but we try to store many more{' '}
        <span style={{ color: '#f97316' }}>features</span> as directions. Because they
        can&apos;t all be orthogonal, turning on one feature partially activates the others.
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.1fr)',
          gap: '1.25rem',
          alignItems: 'stretch',
        }}
      >
        {/* Left: D3 vector visualization */}
        <div>
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{
              maxWidth: width,
              maxHeight: height,
              borderRadius: '0.75rem',
              display: 'block',
            }}
          />
        </div>

        {/* Right: controls + activation panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid #111827',
              background: 'radial-gradient(circle at top, #111827, #020617)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.8rem',
                marginBottom: '0.5rem',
                alignItems: 'baseline',
              }}
            >
              <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
                Packed feature directions
              </span>
              <span style={{ color: '#9ca3af' }}>
                dims: <strong>2</strong> · features:{' '}
                <strong>{numFeatures}</strong> · features / dim:{' '}
                <strong>{featuresPerDim}</strong>
              </span>
            </div>
            <label
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.8rem',
              }}
            >
              <span style={{ color: '#9ca3af' }}>
                Number of features (watch crowding as you add more)
              </span>
              <input
                type="range"
                min={MIN_FEATURES}
                max={MAX_FEATURES}
                step={1}
                value={numFeatures}
                onChange={(e) => setNumFeatures(parseInt(e.target.value, 10))}
              />
            </label>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.5rem' }}>
              With 5 features, the directions are spaced at ~72° – barely "almost orthogonal".
              As you add more, the angular spacing shrinks and interference grows.
            </p>
          </div>

          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid #111827',
              background: '#020617',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.75rem',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '0.8rem',
                    color: '#e5e7eb',
                    fontWeight: 500,
                  }}
                >
                  Interference from polysemantic features
                </div>
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  Click a feature around the circle. Dots show how other features respond when
                  that one is "on".
                </div>
              </div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                  fontSize: '0.8rem',
                  color: '#9ca3af',
                  whiteSpace: 'nowrap',
                }}
              >
                <input
                  type="checkbox"
                  checked={useReLU}
                  onChange={(e) => setUseReLU(e.target.checked)}
                />
                Use ReLU (zero negative interference)
              </label>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)',
                columnGap: '0.4rem',
                rowGap: '0.25rem',
                fontSize: '0.7rem',
                marginTop: '0.25rem',
                paddingBottom: '0.15rem',
                borderBottom: '1px solid #111827',
                color: '#9ca3af',
              }}
            >
              <span>Feature</span>
              <span style={{ textAlign: 'center' }}>Raw dot product</span>
              <span style={{ textAlign: 'center' }}>After ReLU</span>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                maxHeight: '220px',
                overflowY: 'auto',
                paddingRight: '0.25rem',
              }}
            >
              {activationData.map(({ feature, raw, relu }) => {
                const isActive = feature.index === activeFeature
                const halfWidth = 52
                const normRaw = Math.abs(raw) / maxAbsOverlap
                const rawLength = normRaw * halfWidth
                const rawLeft = raw >= 0 ? halfWidth : halfWidth - rawLength
                const rawColor =
                  raw >= 0
                    ? feature.color
                    : 'rgba(220, 38, 38, 0.9)' // red = negative interference

                const normReLU = relu / maxAbsOverlap
                const reluLength = normReLU * halfWidth

                return (
                  <button
                    key={feature.index}
                    onClick={() => setActiveFeature(feature.index)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr) minmax(0, 1fr)',
                      columnGap: '0.4rem',
                      alignItems: 'center',
                      padding: '0.25rem 0.3rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      textAlign: 'left',
                      backgroundColor: isActive ? 'rgba(15, 23, 42, 0.9)' : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: isActive ? '#e5e7eb' : '#d1d5db',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: '999px',
                          background: feature.color,
                        }}
                      />
                      Feature {feature.index + 1}
                      {isActive && (
                        <span style={{ color: '#f97316', fontSize: '0.7rem' }}>
                          (currently "on")
                        </span>
                      )}
                    </span>

                    {/* Raw dot product bar */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.1rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: halfWidth * 2,
                          height: 8,
                          borderRadius: 999,
                          background: '#020617',
                        }}
                      >
                        {/* Midline */}
                        <div
                          style={{
                            position: 'absolute',
                            left: halfWidth,
                            top: 0,
                            bottom: 0,
                            width: 1,
                            background: 'rgba(55, 65, 81, 0.9)',
                          }}
                        />
                        {/* Bar */}
                        <div
                          style={{
                            position: 'absolute',
                            left: rawLeft,
                            top: 0,
                            bottom: 0,
                            width: rawLength,
                            borderRadius: 999,
                            background: rawLength > 0 ? rawColor : 'transparent',
                            transition: 'width 0.15s ease, left 0.15s ease',
                          }}
                        />
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {raw.toFixed(2)}
                      </span>
                    </div>

                    {/* After ReLU bar */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '0.1rem',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: halfWidth * 2,
                          height: 8,
                          borderRadius: 999,
                          background: '#020617',
                        }}
                      >
                        {/* Midline at 0, but ReLU means we only go right */}
                        <div
                          style={{
                            position: 'absolute',
                            left: halfWidth,
                            top: 0,
                            bottom: 0,
                            width: 1,
                            background: 'rgba(55, 65, 81, 0.9)',
                          }}
                        />
                        {useReLU ? (
                          <div
                            style={{
                              position: 'absolute',
                              left: halfWidth,
                              top: 0,
                              bottom: 0,
                              width: reluLength,
                              borderRadius: 999,
                              background: reluLength > 0 ? feature.color : 'transparent',
                              transition: 'width 0.15s ease',
                            }}
                          />
                        ) : (
                          // If ReLU is "off", show the same as raw for clarity
                          <div
                            style={{
                              position: 'absolute',
                              left: rawLeft,
                              top: 0,
                              bottom: 0,
                              width: rawLength,
                              borderRadius: 999,
                              background: rawLength > 0 ? rawColor : 'transparent',
                              transition: 'width 0.15s ease, left 0.15s ease',
                            }}
                          />
                        )}
                      </div>
                      <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                        {useReLU ? relu.toFixed(2) : raw.toFixed(2)}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.25rem' }}>
              Negative overlaps (left‑pointing red bars) are <em>negative interference</em> —
              when you use ReLU, those are clamped to zero, leaving only positive overlaps.
            </p>
          </div>

          <div
            style={{
              padding: '0.6rem 0.75rem',
              borderRadius: '0.75rem',
              border: '1px dashed #1f2933',
              background: 'rgba(15, 23, 42, 0.9)',
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}
          >
            <div style={{ marginBottom: '0.15rem', color: '#e5e7eb', fontWeight: 500 }}>
              The GPT puzzle
            </div>
            <div>
              In big models, we have <strong>thousands of dimensions</strong> but
              <strong> millions of concepts</strong>. The trick is exactly this toy picture:
              directions are <em>shared</em> between many concepts (superposition), and only a
              sparse subset of features fire for any given input (helped by ReLU and other
              nonlinearities). That&apos;s how a limited vector space stores far more
              &quot;meanings&quot; than it has dimensions.
            </div>
          </div>

          {/* Game Panel */}
          <div
            style={{
              padding: '0.75rem',
              borderRadius: '0.75rem',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              background: 'rgba(245, 158, 11, 0.05)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div style={{ fontSize: '0.85rem', color: '#f59e0b', fontWeight: 600 }}>
                🎯 Feature Interference Challenge
              </div>
              {gameScore.total > 0 && (
                <span style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                  Score: {gameScore.correct}/{gameScore.total}
                </span>
              )}
            </div>

            {!activeChallenge ? (
              <div>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
                  Test your intuition about feature overlap in packed representation spaces:
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                  {INTERFERENCE_CHALLENGES.map((ch) => (
                    <button
                      key={ch.name}
                      onClick={() => startChallenge(ch)}
                      style={{
                        padding: '0.25rem 0.5rem',
                        borderRadius: '0.375rem',
                        border: '1px solid rgba(245, 158, 11, 0.5)',
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#f59e0b',
                        fontSize: '0.7rem',
                        cursor: 'pointer',
                      }}
                    >
                      {ch.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : gamePhase === 'setup' ? (
              <div>
                <p style={{ color: '#e5e7eb', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
                  {activeChallenge.question}
                </p>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    onClick={() => submitPrediction('A')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #14b8a6, #0d9488)',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Feature {activeChallenge.featureA + 1}
                  </button>
                  <button
                    onClick={() => submitPrediction('B')}
                    style={{
                      flex: 1,
                      padding: '0.5rem',
                      borderRadius: '0.5rem',
                      border: 'none',
                      background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                      color: 'white',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Feature {activeChallenge.featureB + 1}
                  </button>
                </div>
              </div>
            ) : gamePhase === 'countdown' ? (
              <div style={{ textAlign: 'center', padding: '0.75rem 0' }}>
                <div
                  style={{
                    fontSize: '2rem',
                    fontWeight: 700,
                    color: '#f59e0b',
                    textShadow: '0 0 20px rgba(245, 158, 11, 0.5)',
                  }}
                >
                  {countdown}
                </div>
                <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                  You predicted: Feature {prediction === 'A' ? activeChallenge.featureA + 1 : activeChallenge.featureB + 1}
                </p>
              </div>
            ) : (
              <div>
                <p
                  style={{
                    color: prediction === activeChallenge.answer ? '#10b981' : '#ef4444',
                    fontSize: '0.75rem',
                    marginBottom: '0.5rem',
                    lineHeight: 1.4,
                  }}
                >
                  {getInterferenceFeedback(prediction, activeChallenge)}
                </p>
                <button
                  onClick={resetGame}
                  style={{
                    width: '100%',
                    padding: '0.5rem',
                    borderRadius: '0.5rem',
                    border: '1px solid rgba(245, 158, 11, 0.5)',
                    background: 'rgba(245, 158, 11, 0.15)',
                    color: '#f59e0b',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                  }}
                >
                  Try Another Challenge
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
