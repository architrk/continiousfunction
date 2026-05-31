'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MATH_COLORS } from '../../lib/mathObjects';
import { emitDemoState } from '../../lib/demoState';

const SVG_WIDTH = 340;
const SVG_HEIGHT = 260;
const MAX_POSITION = 10;

type RoPEGeometryVisualizerProps = {
  conceptId?: string;
};

// Fun frequency presets
const FREQUENCY_PRESETS = [
  { name: '🩰 Slow Dance', stepDeg: 10, description: 'Gentle rotations, easy to track' },
  { name: '📚 Standard', stepDeg: 20, description: 'Typical RoPE frequency' },
  { name: '💃 Fast Spin', stepDeg: 30, description: 'Quick rotations, harder to follow' },
  { name: '🌀 Chaos', stepDeg: 45, description: 'Wild rotations! (45° = orthogonal at Δpos=2)' },
];

// Position presets for demonstrations
const POSITION_PRESETS = [
  { name: '🎯 Adjacent', posA: 2, posB: 3, description: 'Neighbors: small Δθ, high similarity' },
  { name: '📏 Distant', posA: 1, posB: 8, description: 'Far apart: large Δθ' },
  { name: '🔄 Symmetric', posA: 3, posB: 7, description: 'Centered around 5' },
  { name: '🎲 Random', posA: -1, posB: -1, description: 'Try random positions' },
];

// Educational insight based on current state
const getRoPEInsight = (relDist: number, dot: number, globalShift: number, thetaStepDeg: number): string => {
  if (globalShift !== 0) {
    return `🔑 Key insight! Global shift changed absolute positions but the dot product stayed at ${dot.toFixed(3)} because RoPE only cares about RELATIVE distance |j-i| = ${relDist}. This is translation equivariance!`;
  }
  if (relDist === 0) {
    return '🎯 Same position! Identical rotation → dot product = 1.0. Tokens at the same position have maximum similarity.';
  }
  if (dot > 0.9) {
    return '✨ Very close positions → nearly parallel vectors. High attention weight expected!';
  }
  if (dot < 0.1 && dot > -0.1) {
    return '⊥ Perpendicular! These positions are orthogonal in this rotation frequency. Attention score ≈ 0.';
  }
  if (dot < -0.5) {
    return '↔️ Nearly opposite directions! Negative dot product means anti-correlated attention (unusual in practice).';
  }
  if (thetaStepDeg >= 40) {
    return '🌀 High frequency rotations! Positions become orthogonal faster, creating sharper position discrimination.';
  }
  if (relDist >= 6) {
    return '📏 Large distance! As positions spread apart, their embeddings become less similar due to accumulated rotation.';
  }
  return `💡 Relative distance ${relDist} → rotation difference Δθ determines similarity. Try the global shift to see translation invariance!`;
};

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

export default function RoPEGeometryVisualizer({ conceptId = 'rope' }: RoPEGeometryVisualizerProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [positionA, setPositionA] = useState<number>(2);
  const [positionB, setPositionB] = useState<number>(6);
  const [globalShift, setGlobalShift] = useState<number>(0);
  const [thetaStepDeg, setThetaStepDeg] = useState<number>(20); // degrees per token

  // Prediction game state
  const [gameMode, setGameMode] = useState(false);
  const [userGuess, setUserGuess] = useState<number>(0.5);
  const [revealed, setRevealed] = useState(false);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [attempts, setAttempts] = useState(0);

  // Dance mode (auto-animate)
  const [dancing, setDancing] = useState(false);

  // Dance mode animation
  useEffect(() => {
    if (!dancing) return;
    const interval = setInterval(() => {
      setGlobalShift(s => {
        const next = s + 1;
        return next > 5 ? -5 : next;
      });
    }, 400);
    return () => clearInterval(interval);
  }, [dancing]);

  // Prediction game logic
  const checkPrediction = () => {
    const error = Math.abs(userGuess - dot);
    setRevealed(true);
    setAttempts(a => a + 1);

    if (error < 0.1) {
      // Excellent guess
      setScore(s => s + 10 + streak * 2);
      setStreak(st => st + 1);
    } else if (error < 0.25) {
      // Good guess
      setScore(s => s + 5);
      setStreak(st => st + 1);
    } else {
      // Poor guess
      setStreak(0);
    }
  };

  const nextRound = () => {
    // Randomize positions
    setPositionA(Math.floor(Math.random() * MAX_POSITION));
    setPositionB(Math.floor(Math.random() * MAX_POSITION));
    setThetaStepDeg(10 + Math.floor(Math.random() * 30));
    setUserGuess(0.5);
    setRevealed(false);
  };

  const thetaStep = useMemo(() => (thetaStepDeg * Math.PI) / 180, [thetaStepDeg]);

  const { thetaA, thetaB, deltaTheta, cosA, sinA, cosB: _cosB, sinB: _sinB, dot } = useMemo(() => {
    // Apply global shift to both positions
    const effectivePosA = positionA + globalShift;
    const effectivePosB = positionB + globalShift;

    const thetaAInner = effectivePosA * thetaStep;
    const thetaBInner = effectivePosB * thetaStep;
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
  }, [positionA, positionB, globalShift, thetaStep]);

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

  const relDist = Math.abs(positionB - positionA);
  const effectivePositionA = positionA + globalShift;
  const effectivePositionB = positionB + globalShift;
  const deltaDegrees = toDegrees(deltaTheta);
  const predictionError = Math.abs(userGuess - dot);

  useEffect(() => {
    emitDemoState({
      conceptId,
      label: 'RoPE relative-position geometry',
      summary: `Positions i=${positionA} and j=${positionB} have relative distance ${relDist}; theta step ${thetaStepDeg} degrees gives dot product ${dot.toFixed(3)}. Translation-invariant check: global shift s=${globalShift} moves both positions while |j-i| stays ${relDist}.`,
      values: [
        `token A position i: ${positionA}`,
        `token B position j: ${positionB}`,
        `global shift s: ${globalShift}`,
        `effective positions: ${effectivePositionA} and ${effectivePositionB}`,
        `relative distance |j-i|: ${relDist}`,
        `theta step: ${thetaStepDeg} degrees/token`,
        `delta theta: ${deltaDegrees.toFixed(1)} degrees`,
        `dot product cos(delta theta): ${dot.toFixed(3)}`,
        `translation invariant: ${globalShift !== 0 ? 'demonstrated by shifted positions' : 'available through global shift control'}`,
        gameMode ? `prediction phase: ${revealed ? 'revealed' : 'guessing'}` : 'prediction phase: setup',
        gameMode ? `learner guess: ${userGuess.toFixed(2)}` : null,
        gameMode && revealed ? `prediction error: ${predictionError.toFixed(3)}` : null,
      ].filter((value): value is string => Boolean(value)),
    });
  }, [
    conceptId,
    deltaDegrees,
    dot,
    effectivePositionA,
    effectivePositionB,
    gameMode,
    globalShift,
    positionA,
    positionB,
    predictionError,
    relDist,
    revealed,
    thetaStepDeg,
    userGuess,
  ]);

  return (
    <section className="card interactive-card">
      <h2>Rotary Position Embedding (RoPE) – geometric view</h2>
      <p className="muted">
        Each token&apos;s embedding is an arrow on a circle. RoPE encodes position by rotating
        these arrows; the attention score depends only on how far apart the arrows are in angle,
        not on their absolute positions. Try the <strong>global shift slider</strong> to see this property in action.
      </p>

      {/* Frequency Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {FREQUENCY_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => setThetaStepDeg(preset.stepDeg)}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: thetaStepDeg === preset.stepDeg ? '2px solid #f59e0b' : '1px solid #374151',
              background: thetaStepDeg === preset.stepDeg
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(245, 158, 11, 0.1))'
                : 'rgba(31, 41, 55, 0.5)',
              color: thetaStepDeg === preset.stepDeg ? '#f59e0b' : '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: thetaStepDeg === preset.stepDeg ? 600 : 400,
              transition: 'all 0.2s ease',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
        <button
          onClick={() => setDancing(!dancing)}
          style={{
            padding: '6px 12px',
            borderRadius: '6px',
            border: dancing ? '2px solid #14b8a6' : '1px solid #374151',
            background: dancing
              ? 'linear-gradient(135deg, rgba(20, 184, 166, 0.2), rgba(20, 184, 166, 0.1))'
              : 'rgba(31, 41, 55, 0.5)',
            color: dancing ? '#14b8a6' : '#9ca3af',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: dancing ? 600 : 400,
          }}
        >
          {dancing ? '⏸️ Stop' : '💃 Dance Mode'}
        </button>
      </div>

      {/* Position Presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
        {POSITION_PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => {
              if (preset.posA === -1) {
                setPositionA(Math.floor(Math.random() * MAX_POSITION));
                setPositionB(Math.floor(Math.random() * MAX_POSITION));
              } else {
                setPositionA(preset.posA);
                setPositionB(preset.posB);
              }
            }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              border: '1px solid #374151',
              background: 'rgba(31, 41, 55, 0.5)',
              color: '#9ca3af',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Prediction Game */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '8px',
        marginBottom: '16px',
        background: gameMode
          ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
          : 'rgba(31, 41, 55, 0.3)',
        border: gameMode ? '1px solid rgba(139, 92, 246, 0.4)' : '1px solid #374151',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <button
            onClick={() => {
              setGameMode(!gameMode);
              if (!gameMode) {
                nextRound();
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '6px',
              border: 'none',
              background: gameMode ? '#8b5cf6' : 'rgba(139, 92, 246, 0.5)',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '13px',
            }}
          >
            {gameMode ? '🎮 Exit Game' : '🎮 Guess the Dot Product!'}
          </button>
          {gameMode && (
            <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: '#e5e7eb' }}>
              <span>Score: <strong style={{ color: '#f59e0b' }}>{score}</strong></span>
              <span>Streak: <strong style={{ color: streak > 0 ? '#22c55e' : '#9ca3af' }}>{streak}🔥</strong></span>
              <span>Attempts: {attempts}</span>
            </div>
          )}
        </div>

        {gameMode && (
          <div style={{ marginTop: '12px' }}>
            <p style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>
              Position A = {positionA}, Position B = {positionB}, θ_step = {thetaStepDeg}°
              <br />
              <strong style={{ color: '#e5e7eb' }}>What will the dot product be? (Hint: cos(Δθ) where Δθ = |j-i| × θ_step)</strong>
            </p>

            {!revealed ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.05}
                    value={userGuess}
                    onChange={(e) => setUserGuess(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ minWidth: '60px', color: '#e5e7eb', fontWeight: 600 }}>
                    {userGuess.toFixed(2)}
                  </span>
                  <button
                    onClick={checkPrediction}
                    style={{
                      padding: '6px 16px',
                      borderRadius: '6px',
                      border: 'none',
                      background: '#22c55e',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 600,
                    }}
                  >
                    Check!
                  </button>
                </div>
              </>
            ) : (
              <div style={{
                padding: '12px',
                borderRadius: '6px',
                background: Math.abs(userGuess - dot) < 0.1
                  ? 'rgba(34, 197, 94, 0.2)'
                  : Math.abs(userGuess - dot) < 0.25
                    ? 'rgba(245, 158, 11, 0.2)'
                    : 'rgba(239, 68, 68, 0.2)',
                marginTop: '8px',
              }}>
                <p style={{ margin: 0, color: '#e5e7eb' }}>
                  {Math.abs(userGuess - dot) < 0.1 && '🎯 Excellent! '}
                  {Math.abs(userGuess - dot) >= 0.1 && Math.abs(userGuess - dot) < 0.25 && '✅ Good! '}
                  {Math.abs(userGuess - dot) >= 0.25 && '❌ Not quite. '}
                  Your guess: <strong>{userGuess.toFixed(2)}</strong> | Actual: <strong>{dot.toFixed(3)}</strong>
                  {' | '}Error: {Math.abs(userGuess - dot).toFixed(3)}
                </p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#9ca3af' }}>
                  Δθ = {relDist} × {thetaStepDeg}° = {(relDist * thetaStepDeg)}° → cos({(relDist * thetaStepDeg)}°) ≈ {dot.toFixed(3)}
                </p>
                <button
                  onClick={nextRound}
                  style={{
                    marginTop: '8px',
                    padding: '6px 16px',
                    borderRadius: '6px',
                    border: 'none',
                    background: '#8b5cf6',
                    color: 'white',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Next Round →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

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

          <label className="slider-label" style={{ borderTop: '1px solid rgba(245, 158, 11, 0.2)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
            <span style={{ color: MATH_COLORS.primary }}>
              Global shift (s) — shifts BOTH tokens
            </span>
            <input
              type="range"
              min={-5}
              max={5}
              step={1}
              value={globalShift}
              onChange={(e) => setGlobalShift(parseInt(e.target.value, 10))}
            />
            <span className="slider-value">
              s = {globalShift} {globalShift !== 0 && `→ positions: i+s=${positionA + globalShift}, j+s=${positionB + globalShift}`}
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

          {/* Dynamic Educational Insight */}
          <div style={{
            background: globalShift !== 0
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
              : dot > 0.9
                ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))'
                : dot < 0.1 && dot > -0.1
                  ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
                  : 'linear-gradient(135deg, rgba(20, 184, 166, 0.1), rgba(20, 184, 166, 0.05))',
            border: `1px solid ${globalShift !== 0 ? '#f59e0b' : dot > 0.9 ? '#22c55e' : dot < 0.1 && dot > -0.1 ? '#8b5cf6' : '#14b8a6'}40`,
            borderRadius: '8px',
            padding: '0.75rem',
            marginTop: '0.75rem',
            fontSize: '0.85rem',
            lineHeight: '1.5'
          }}>
            {getRoPEInsight(relDist, dot, globalShift, thetaStepDeg)}
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
        </div>
      </div>
    </section>
  );
}
