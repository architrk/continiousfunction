'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MATH_COLORS } from '../../../lib/mathObjects';

// ─────────────────────────────────────────────────────────────────────────────
// Gamification Types and Data
// ─────────────────────────────────────────────────────────────────────────────

type GamePhase = 'setup' | 'countdown' | 'revealed'
type DotPrediction = 'higher' | 'lower' | 'same' | null

interface RoPEChallenge {
  name: string
  question: string
  posA1: number
  posB1: number
  posA2: number
  posB2: number
  answer: DotPrediction
}

const ROPE_CHALLENGES: RoPEChallenge[] = [
  {
    name: '🎲 Distance Effect',
    question: 'Which pair has HIGHER dot product: (pos 2, pos 3) or (pos 2, pos 6)?',
    posA1: 2, posB1: 3,
    posA2: 2, posB2: 6,
    answer: 'higher', // pair 1 has higher (closer positions = smaller Δθ = higher cos)
  },
  {
    name: '🎲 Same Distance',
    question: 'Compare dot products: (pos 0, pos 4) vs (pos 5, pos 9). Same distance apart—same dot product?',
    posA1: 0, posB1: 4,
    posA2: 5, posB2: 9,
    answer: 'same', // same relative distance = same Δθ = same cos(Δθ)
  },
  {
    name: '🎲 Orthogonal',
    question: 'Which pair is CLOSER to orthogonal (dot ≈ 0): (pos 1, pos 3) or (pos 0, pos 5)?',
    posA1: 1, posB1: 3,
    posA2: 0, posB2: 5,
    answer: 'lower', // pair 2 has larger Δθ, closer to 90° = cos closer to 0
  },
  {
    name: '🎲 Adjacent Tokens',
    question: 'Adjacent tokens (pos 4, pos 5) vs (pos 0, pos 1)—which has higher dot product?',
    posA1: 4, posB1: 5,
    posA2: 0, posB2: 1,
    answer: 'same', // same distance = same dot product (RoPE is translation-invariant)
  },
]

function getRoPEFeedback(
  predicted: DotPrediction,
  challenge: RoPEChallenge,
  thetaStep: number
): string {
  const correct = predicted === challenge.answer
  const dist1 = Math.abs(challenge.posB1 - challenge.posA1)
  const dist2 = Math.abs(challenge.posB2 - challenge.posA2)
  const dot1 = Math.cos(dist1 * thetaStep)
  const dot2 = Math.cos(dist2 * thetaStep)

  if (challenge.answer === 'same') {
    if (correct) {
      return `✓ Correct! Both pairs have relative distance ${dist1}, so Δθ = ${dist1}×θ_step is identical. This is RoPE's key property: attention only sees RELATIVE positions. cos(Δθ) = ${dot1.toFixed(3)} for both.`
    }
    return `✗ Not quite. In RoPE, only the RELATIVE distance matters. Both pairs are ${dist1} positions apart, so both have cos(Δθ) = ${dot1.toFixed(3)}. Absolute positions don't affect attention scores—that's translation invariance.`
  }

  if (challenge.answer === 'higher') {
    if (correct) {
      return `✓ Correct! Pair 1 (distance ${dist1}) has dot = cos(${(dist1 * thetaStep).toFixed(2)}) ≈ ${dot1.toFixed(3)}. Pair 2 (distance ${dist2}) has dot ≈ ${dot2.toFixed(3)}. Closer tokens → smaller angle → higher cosine.`
    }
    return `✗ Not quite. Pair 1 (distance ${dist1}) is closer, giving dot ≈ ${dot1.toFixed(3)}. Pair 2 (distance ${dist2}) has larger Δθ, so dot ≈ ${dot2.toFixed(3)}. RoPE encodes proximity: closer = higher attention.`
  }

  // answer === 'lower' (pair 2 is closer to orthogonal)
  if (correct) {
    return `✓ Correct! Pair 2 has distance ${dist2}, giving Δθ ≈ ${(dist2 * thetaStep).toFixed(2)} rad. That's closer to 90° (π/2 ≈ 1.57), so cos(Δθ) ≈ ${dot2.toFixed(3)} is nearer to 0 (orthogonal).`
  }
  return `✗ Not quite. Pair 2 (distance ${dist2}) has Δθ ≈ ${(dist2 * thetaStep).toFixed(2)} rad, giving cos ≈ ${dot2.toFixed(3)}. Pair 1 (distance ${dist1}) has cos ≈ ${dot1.toFixed(3)}. Larger Δθ → closer to orthogonal.`
}

const SVG_WIDTH = 340;
const SVG_HEIGHT = 260;
const MAX_POSITION = 10;

function polarToCartesian(angle: number, radius: number): { x: number; y: number } {
  return {
    x: radius * Math.cos(angle),
    y: -radius * Math.sin(angle),
  };
}

function createArcPath(startAngle: number, endAngle: number, radius: number): string {
  const delta = endAngle - startAngle;
  const x0 = radius * Math.cos(startAngle);
  const y0 = -radius * Math.sin(startAngle);
  const x1 = radius * Math.cos(endAngle);
  const y1 = -radius * Math.sin(endAngle);
  const largeArcFlag = Math.abs(delta) > Math.PI ? 1 : 0;
  const sweepFlag = delta >= 0 ? 1 : 0;
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${x1} ${y1}`;
}

function toDegrees(rad: number): number {
  return (rad * 180) / Math.PI;
}

export default function RoPEGeometryVisualizer() {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [positionA, setPositionA] = useState<number>(2);
  const [positionB, setPositionB] = useState<number>(6);
  const [thetaStepDeg, setThetaStepDeg] = useState<number>(20); // degrees per token

  const thetaStep = useMemo(() => (thetaStepDeg * Math.PI) / 180, [thetaStepDeg]);

  // ─── Gamification State ───
  const [gameMode, setGameMode] = useState(false);
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [selectedChallenge, setSelectedChallenge] = useState<RoPEChallenge | null>(null);
  const [prediction, setPrediction] = useState<DotPrediction>(null);
  const [countdown, setCountdown] = useState(3);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showingPair, setShowingPair] = useState<1 | 2>(1);

  // ─── Game Control Functions ───
  const startChallenge = (challenge: RoPEChallenge) => {
    setSelectedChallenge(challenge);
    setPrediction(null);
    setFeedback(null);
    setGamePhase('setup');
    setShowingPair(1);
    // Show pair 1 first
    setPositionA(challenge.posA1);
    setPositionB(challenge.posB1);
  };

  const togglePair = () => {
    if (!selectedChallenge || gamePhase !== 'setup') return;
    const nextPair = showingPair === 1 ? 2 : 1;
    setShowingPair(nextPair);
    if (nextPair === 1) {
      setPositionA(selectedChallenge.posA1);
      setPositionB(selectedChallenge.posB1);
    } else {
      setPositionA(selectedChallenge.posA2);
      setPositionB(selectedChallenge.posB2);
    }
  };

  const makePrediction = (pred: DotPrediction) => {
    if (gamePhase !== 'setup' || !selectedChallenge) return;
    setPrediction(pred);
    setCountdown(3);
    setGamePhase('countdown');
  };

  const revealAnswer = () => {
    if (!selectedChallenge || !prediction) return;
    const feedbackText = getRoPEFeedback(prediction, selectedChallenge, thetaStep);
    setFeedback(feedbackText);
    setGamePhase('revealed');
    const correct = prediction === selectedChallenge.answer;
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  };

  // ─── Countdown Effect ───
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown <= 0) {
      revealAnswer();
      return;
    }
    const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- revealAnswer is stable callback
  }, [gamePhase, countdown]);

  const { thetaA, thetaB, deltaTheta, cosA, sinA, cosB: _cosB, sinB: _sinB, dot } = useMemo(() => {
    const thetaAInner = positionA * thetaStep;
    const thetaBInner = positionB * thetaStep;
    const delta = thetaBInner - thetaAInner;

    const cosAInner = Math.cos(thetaAInner);
    const sinAInner = Math.sin(thetaAInner);
    const cosBInner = Math.cos(thetaBInner);
    const sinBInner = Math.sin(thetaBInner);

    const dotInner = cosAInner * cosBInner + sinAInner * sinBInner;

    return {
      thetaA: thetaAInner,
      thetaB: thetaBInner,
      deltaTheta: delta,
      cosA: cosAInner,
      sinA: sinAInner,
      cosB: cosBInner,
      sinB: sinBInner,
      dot: Math.max(-1, Math.min(1, dotInner)), // clamp for FP noise
    };
  }, [positionA, positionB, thetaStep]);

  // Initial scene setup (axes, circle, placeholders)
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    svg
      .attr('viewBox', `0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`)
      .style('overflow', 'visible');

    const radius = Math.min(SVG_WIDTH, SVG_HEIGHT) * 0.3;
    const axisLength = radius * 1.4;

    const group = svg
      .append('g')
      .attr('class', 'rope-scene')
      .attr('transform', `translate(${SVG_WIDTH / 2}, ${SVG_HEIGHT / 2})`);

    // Background panel
    group
      .append('rect')
      .attr('x', -SVG_WIDTH / 2 + 8)
      .attr('y', -SVG_HEIGHT / 2 + 8)
      .attr('width', SVG_WIDTH - 16)
      .attr('height', SVG_HEIGHT - 16)
      .attr('rx', 10)
      .attr('ry', 10)
      .attr('fill', MATH_COLORS.surface);

    // Axes
    group
      .append('line')
      .attr('class', 'axis axis-x')
      .attr('x1', -axisLength)
      .attr('y1', 0)
      .attr('x2', axisLength)
      .attr('y2', 0)
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 1);

    group
      .append('line')
      .attr('class', 'axis axis-y')
      .attr('x1', 0)
      .attr('y1', -axisLength)
      .attr('x2', 0)
      .attr('y2', axisLength)
      .attr('stroke', '#4b5563')
      .attr('stroke-width', 1);

    // Axis labels (optional "real / imag" view of complex plane)
    group
      .append('text')
      .attr('class', 'axis-label axis-label-x')
      .attr('x', axisLength + 10)
      .attr('y', -4)
      .attr('fill', '#9ca3af')
      .attr('font-size', 11)
      .text('real');

    group
      .append('text')
      .attr('class', 'axis-label axis-label-y')
      .attr('x', 4)
      .attr('y', -axisLength - 10)
      .attr('fill', '#9ca3af')
      .attr('font-size', 11)
      .text('imag');

    // Unit circle
    group
      .append('circle')
      .attr('class', 'unit-circle')
      .attr('r', radius)
      .attr('fill', 'none')
      .attr('stroke', 'rgba(148, 163, 184, 0.5)')
      .attr('stroke-width', 1.5);

    // Base embedding vector (before RoPE rotation)
    group
      .append('line')
      .attr('class', 'base-vector')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', radius)
      .attr('y2', 0)
      .attr('stroke', 'rgba(148, 163, 184, 0.8)')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 4');

    // Token A vector (teal)
    group
      .append('line')
      .attr('class', 'token-vector token-a')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', radius)
      .attr('y2', 0)
      .attr('stroke', MATH_COLORS.secondary)
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round');

    group
      .append('circle')
      .attr('class', 'token-tip token-a')
      .attr('cx', radius)
      .attr('cy', 0)
      .attr('r', 4)
      .attr('fill', MATH_COLORS.secondary);

    group
      .append('text')
      .attr('class', 'token-label token-label-a')
      .attr('x', radius + 12)
      .attr('y', -4)
      .attr('fill', '#e5e7eb')
      .attr('font-size', 11)
      .attr('text-anchor', 'start')
      .attr('alignment-baseline', 'middle')
      .text('Token A');

    // Token B vector (same teal, slightly faded)
    group
      .append('line')
      .attr('class', 'token-vector token-b')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', radius * 0.7)
      .attr('y2', radius * -0.7)
      .attr('stroke', MATH_COLORS.secondary)
      .attr('stroke-width', 3)
      .attr('stroke-linecap', 'round')
      .attr('stroke-opacity', 0.55);

    group
      .append('circle')
      .attr('class', 'token-tip token-b')
      .attr('cx', radius * 0.7)
      .attr('cy', radius * -0.7)
      .attr('r', 4)
      .attr('fill', MATH_COLORS.secondary)
      .attr('fill-opacity', 0.8);

    group
      .append('text')
      .attr('class', 'token-label token-label-b')
      .attr('x', radius * 0.7 * 1.2)
      .attr('y', radius * -0.7 * 1.2)
      .attr('fill', '#e5e7eb')
      .attr('font-size', 11)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text('Token B');

    // Rotation arcs (orange)
    group
      .append('path')
      .attr('class', 'token-arc token-a')
      .attr('fill', 'none')
      .attr('stroke', MATH_COLORS.primary)
      .attr('stroke-width', 3);

    group
      .append('path')
      .attr('class', 'token-arc token-b')
      .attr('fill', 'none')
      .attr('stroke', MATH_COLORS.primary)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.7);

    group
      .append('path')
      .attr('class', 'token-arc delta')
      .attr('fill', 'none')
      .attr('stroke', MATH_COLORS.primary)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '4 4');

    // Label for relative angle Δθ
    group
      .append('text')
      .attr('class', 'delta-label')
      .attr('fill', '#e5e7eb')
      .attr('font-size', 11)
      .attr('text-anchor', 'middle');

    return () => {
      svg.selectAll('*').remove();
    };
  }, []);

  // Update vectors + arcs whenever positions / angles change
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    const group = svg.select('.rope-scene');
    if (group.empty()) return;

    const radius = Math.min(SVG_WIDTH, SVG_HEIGHT) * 0.3;

    const aPoint = polarToCartesian(thetaA, radius);
    const bPoint = polarToCartesian(thetaB, radius);

    const arcRadiusA = radius + 12;
    const arcRadiusB = radius + 20;
    const arcRadiusDelta = radius + 30;

    // Token A vector
    group
      .select('line.token-vector.token-a')
      .transition()
      .duration(260)
      .attr('x2', aPoint.x)
      .attr('y2', aPoint.y);

    group
      .select('circle.token-tip.token-a')
      .transition()
      .duration(260)
      .attr('cx', aPoint.x)
      .attr('cy', aPoint.y);

    group
      .select('text.token-label-a')
      .transition()
      .duration(260)
      .attr('x', aPoint.x * 1.15)
      .attr('y', aPoint.y * 1.15);

    // Token B vector
    group
      .select('line.token-vector.token-b')
      .transition()
      .duration(260)
      .attr('x2', bPoint.x)
      .attr('y2', bPoint.y);

    group
      .select('circle.token-tip.token-b')
      .transition()
      .duration(260)
      .attr('cx', bPoint.x)
      .attr('cy', bPoint.y);

    group
      .select('text.token-label-b')
      .transition()
      .duration(260)
      .attr('x', bPoint.x * 1.15)
      .attr('y', bPoint.y * 1.15);

    // Rotation arcs (absolute angles)
    group
      .select('path.token-arc.token-a')
      .transition()
      .duration(260)
      .attr('d', createArcPath(0, thetaA, arcRadiusA));

    group
      .select('path.token-arc.token-b')
      .transition()
      .duration(260)
      .attr('d', createArcPath(0, thetaB, arcRadiusB));

    // Relative-angle arc (Δθ)
    group
      .select('path.token-arc.delta')
      .transition()
      .duration(260)
      .attr('d', createArcPath(thetaA, thetaB, arcRadiusDelta))
      .attr('stroke-opacity', Math.abs(dot)); // brighter when dot product is large

    const midAngle = thetaA + deltaTheta / 2;
    const midPoint = polarToCartesian(midAngle, arcRadiusDelta + 12);

    group
      .select('text.delta-label')
      .transition()
      .duration(260)
      .attr('x', midPoint.x)
      .attr('y', midPoint.y)
      .text(`Δθ ≈ ${deltaTheta.toFixed(2)} rad`);
  }, [thetaA, thetaB, deltaTheta, dot]);

  return (
    <section className="card interactive-card">
      <h2>Rotary Position Embedding (RoPE) – geometric view</h2>
      <p className="muted">
        Each token&apos;s embedding is an arrow on a circle. RoPE encodes position by rotating
        these arrows; the attention score depends only on how far apart the arrows are in angle,
        not on their absolute positions.
      </p>
      <div className="rope-layout">
        <svg
          ref={svgRef}
          width={SVG_WIDTH}
          height={SVG_HEIGHT}
          className="rope-chart"
          aria-label="2D plane showing two rotating embedding vectors under RoPE"
        />
        <div className="rope-controls">
          <label className="slider-label">
            Token A position (i)
            <input
              type="range"
              min={0}
              max={MAX_POSITION}
              step={1}
              value={positionA}
              onChange={(e) => setPositionA(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">i = {positionA}</span>
          </label>

          <label className="slider-label">
            Token B position (j)
            <input
              type="range"
              min={0}
              max={MAX_POSITION}
              step={1}
              value={positionB}
              onChange={(e) => setPositionB(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">j = {positionB}</span>
          </label>

          <label className="slider-label">
            Rotation per step θ<span className="subscript">step</span> ({thetaStepDeg.toFixed(0)}° / token)
            <input
              type="range"
              min={10}
              max={30}
              step={1}
              value={thetaStepDeg}
              onChange={(e) => setThetaStepDeg(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">
              θ<span className="subscript">step</span> ≈ {thetaStep.toFixed(2)} rad
            </span>
          </label>

          <div className="rope-stats">
            <div>
              <span className="label">Relative distance</span>
              <span>|j − i| = {Math.abs(positionB - positionA)}</span>
            </div>
            <div>
              <span className="label">Dot product</span>
              <span>
                ⟨A, B⟩ ≈ {dot.toFixed(3)} = cos(Δθ), with Δθ ≈ {deltaTheta.toFixed(2)} rad (
                {toDegrees(deltaTheta).toFixed(1)}°)
              </span>
            </div>
          </div>

          <div className="rope-math">
            <div className="formula-heading">Euler&apos;s formula for Token A</div>
            <div className="formula">
              e<sup>iθ</sup> = cos(θ) + i·sin(θ)
            </div>
            <div className="formula-expanded">
              Here θ = i·θ<span className="subscript">step</span> = {positionA} × {thetaStep.toFixed(2)} ≈{' '}
              {thetaA.toFixed(2)} rad
            </div>
            <code className="formula-code">
              e<sup>iθ</sup> ≈ {cosA.toFixed(2)} + i·{sinA.toFixed(2)}
            </code>
            <p className="caption">
              You can treat e<sup>iθ</sup> as a &quot;rotate by θ&quot; instruction: cos(θ) is the horizontal part
              of the arrow, sin(θ) is the vertical part. As you move the sliders, the arrows spin but their dot
              product only cares about the angle between them.
            </p>
          </div>

          <button
            type="button"
            className={gameMode ? '' : 'ghost'}
            onClick={() => {
              setGameMode(!gameMode);
              if (gameMode) {
                setSelectedChallenge(null);
                setGamePhase('setup');
                setFeedback(null);
              }
            }}
            style={{ marginTop: '0.75rem' }}
          >
            {gameMode ? '🎯 Exit Challenge' : '🎯 Position Challenge'}
          </button>
        </div>
      </div>

      {/* ─── Gamification Panel ─── */}
      {gameMode && (
        <div
          style={{
            marginTop: '1rem',
            padding: '1rem',
            background: 'rgba(15,23,42,0.9)',
            borderRadius: '12px',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>🎯 Relative Position Challenge</h3>
            <span style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>
              Score: {score.correct}/{score.total}
            </span>
          </div>

          {/* Challenge Selection */}
          {gamePhase === 'setup' && !selectedChallenge && (
            <div>
              <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#9ca3af' }}>
                Test your understanding of RoPE&apos;s translation invariance. Compare dot products between different position pairs.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {ROPE_CHALLENGES.map((ch) => (
                  <button
                    key={ch.name}
                    type="button"
                    className="ghost"
                    onClick={() => startChallenge(ch)}
                    style={{ fontSize: '0.8rem' }}
                  >
                    {ch.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Active Challenge */}
          {selectedChallenge && (
            <div>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 500 }}>
                {selectedChallenge.question}
              </p>

              {gamePhase === 'setup' && (
                <>
                  <div style={{ fontSize: '0.85rem', marginBottom: '0.75rem', color: '#9ca3af' }}>
                    <strong>Pair 1:</strong> ({selectedChallenge.posA1}, {selectedChallenge.posB1}) &nbsp;|&nbsp;
                    <strong>Pair 2:</strong> ({selectedChallenge.posA2}, {selectedChallenge.posB2})
                    <button
                      type="button"
                      className="ghost"
                      onClick={togglePair}
                      style={{ marginLeft: '0.75rem', fontSize: '0.75rem' }}
                    >
                      Showing Pair {showingPair} → View {showingPair === 1 ? 2 : 1}
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => makePrediction('higher')}
                      className={prediction === 'higher' ? '' : 'ghost'}
                    >
                      Pair 1 Higher
                    </button>
                    <button
                      type="button"
                      onClick={() => makePrediction('lower')}
                      className={prediction === 'lower' ? '' : 'ghost'}
                    >
                      Pair 2 Higher
                    </button>
                    <button
                      type="button"
                      onClick={() => makePrediction('same')}
                      className={prediction === 'same' ? '' : 'ghost'}
                    >
                      Same / Equal
                    </button>
                  </div>
                </>
              )}

              {gamePhase === 'countdown' && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#f59e0b' }}>
                    {countdown}
                  </div>
                  <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
                    You predicted: <strong>{prediction === 'higher' ? 'Pair 1 Higher' : prediction === 'lower' ? 'Pair 2 Higher' : 'Same'}</strong>
                  </p>
                </div>
              )}

              {gamePhase === 'revealed' && feedback && (
                <div>
                  <p style={{
                    fontSize: '0.85rem',
                    lineHeight: 1.5,
                    padding: '0.75rem',
                    borderRadius: '8px',
                    background: feedback.startsWith('✓') ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                    border: `1px solid ${feedback.startsWith('✓') ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                  }}>
                    {feedback}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedChallenge(null);
                      setGamePhase('setup');
                      setFeedback(null);
                      setPrediction(null);
                    }}
                    style={{ marginTop: '0.75rem' }}
                  >
                    Try Another Challenge
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
