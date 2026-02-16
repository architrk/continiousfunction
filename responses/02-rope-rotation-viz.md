Here’s a self-contained RoPE visualizer component that fits your existing explorable style and reuses the shared MATH_COLORS palette so teal/orange match the rest of the site. 

attachments-bundle

 

Save this as components/RoPEGeometryVisualizer.tsx and drop <RoPEGeometryVisualizer /> into any page.

tsx
Copy code
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { MATH_COLORS } from '../lib/mathObjects';

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

  const { thetaA, thetaB, deltaTheta, cosA, sinA, cosB, sinB, dot } = useMemo(() => {
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
        </div>
      </div>
    </section>
  );
}
