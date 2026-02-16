Here’s a self-contained SelfAttentionExplorer component that uses React hooks + D3 to visualize Q, K, V, the QKᵀ / √dₖ scores, and the softmax with temperature. It should drop into a Next.js app (note the 'use client' directive) and uses inline styles so you don’t need extra CSS.

 

The color scheme matches your existing visualization palette: dark slate background and orange for high attention. 

attachments-bundle

tsx
Copy code
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

type Matrix = number[][];

interface HeatmapProps {
  data: Matrix;
  title: string;
  width?: number;
  height?: number;
  rowLabels?: string[];
  colLabels?: string[];
  highlightedRow?: number | null;
  highlightedCol?: number | null;
}

// --- Small linear algebra helpers ------------------------------------------------

function matmul(a: Matrix, b: Matrix): Matrix {
  const aRows = a.length;
  const aCols = a[0]?.length ?? 0;
  const bRows = b.length;
  const bCols = b[0]?.length ?? 0;

  if (!aRows || !aCols || !bRows || !bCols || aCols !== bRows) {
    throw new Error(`Shape mismatch in matmul: [${aRows},${aCols}] x [${bRows},${bCols}]`);
  }

  const result: Matrix = Array.from({ length: aRows }, () => Array(bCols).fill(0));

  for (let i = 0; i < aRows; i++) {
    for (let k = 0; k < aCols; k++) {
      const aVal = a[i][k];
      for (let j = 0; j < bCols; j++) {
        result[i][j] += aVal * b[k][j];
      }
    }
  }

  return result;
}

function transpose(a: Matrix): Matrix {
  const rows = a.length;
  const cols = a[0]?.length ?? 0;
  const result: Matrix = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      result[j][i] = a[i][j];
    }
  }
  return result;
}

function softmaxWithTemperature(row: number[], temperature: number): number[] {
  const t = Math.max(temperature, 0.05); // avoid division by 0
  const scaled = row.map((v) => v / t);
  const maxLogit = Math.max(...scaled);
  const exps = scaled.map((v) => Math.exp(v - maxLogit));
  const sum = exps.reduce((acc, v) => acc + v, 0);
  return exps.map((e) => e / sum);
}

// --- D3 heatmap component --------------------------------------------------------

const Heatmap: React.FC<HeatmapProps> = ({
  data,
  title,
  width = 260,
  height = 220,
  rowLabels,
  colLabels,
  highlightedRow = null,
  highlightedCol = null,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    const rows = data.length;
    const cols = data[0]?.length ?? 0;

    const margin = {
      top: 26,
      right: 12,
      bottom: colLabels ? 52 : 20,
      left: rowLabels ? 60 : 20,
    };

    const innerWidth = Math.max(0, width - margin.left - margin.right);
    const innerHeight = Math.max(0, height - margin.top - margin.bottom);

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .style('background', '#020617') // near dark-slate
      .style('border-radius', '0.75rem');

    // Clear previous content and redraw (simple but keeps the code approachable)
    svg.selectAll('*').remove();

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    if (!rows || !cols) return;

    type CellDatum = { row: number; col: number; value: number };
    const cells: CellDatum[] = [];
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        cells.push({ row: i, col: j, value: data[i][j] });
      }
    }

    const maxAbs = d3.max(cells, (d) => Math.abs(d.value)) || 1;

    // 0 -> dark slate, 1 -> bright orange
    const color = d3
      .scaleLinear<number, string>()
      .domain([0, maxAbs])
      .range(['#020617', '#f59e0b']);

    const cellW = innerWidth / cols;
    const cellH = innerHeight / rows;

    const computeOpacity = (d: CellDatum) => {
      if (highlightedRow === null && highlightedCol === null) return 0.9;
      return highlightedRow === d.row || highlightedCol === d.col ? 1 : 0.2;
    };

    const cellsSelection = g
      .selectAll<SVGRectElement, CellDatum>('rect.heatmap-cell')
      .data(cells)
      .join('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', (d) => d.col * cellW)
      .attr('y', (d) => d.row * cellH)
      .attr('width', cellW - 1)
      .attr('height', cellH - 1)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('fill', '#020617')
      .attr('opacity', 0.2);

    cellsSelection
      .transition()
      .duration(400)
      .attr('fill', (d) => color(Math.abs(d.value)))
      .attr('opacity', (d) => computeOpacity(d))
      .attr('stroke', (d) =>
        highlightedRow === d.row || highlightedCol === d.col
          ? '#f97316'
          : 'transparent'
      )
      .attr('stroke-width', (d) =>
        highlightedRow === d.row || highlightedCol === d.col ? 1.5 : 0
      );

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 18)
      .attr('text-anchor', 'middle')
      .attr('fill', '#e5e7eb')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .text(title);

    // Row labels
    if (rowLabels) {
      const rowGroup = svg
        .append('g')
        .attr('transform', `translate(${margin.left - 10},${margin.top})`);
      rowLabels.forEach((label, i) => {
        rowGroup
          .append('text')
          .attr('x', 0)
          .attr('y', i * cellH + cellH / 2)
          .attr('text-anchor', 'end')
          .attr('alignment-baseline', 'middle')
          .attr('fill', '#9ca3af')
          .attr('font-size', 10)
          .text(label);
      });
    }

    // Column labels
    if (colLabels) {
      const colGroup = svg
        .append('g')
        .attr(
          'transform',
          `translate(${margin.left},${margin.top + innerHeight + 4})`
        );
      colLabels.forEach((label, j) => {
        const x = j * cellW + cellW / 2;
        colGroup
          .append('text')
          .attr('x', x)
          .attr('y', 0)
          .attr('text-anchor', 'start')
          .attr('alignment-baseline', 'hanging')
          .attr('fill', '#9ca3af')
          .attr('font-size', 10)
          .attr('transform', `rotate(-45, ${x}, 0)`)
          .text(label);
      });
    }
  }, [data, width, height, rowLabels, colLabels, highlightedRow, highlightedCol, title]);

  return <svg ref={svgRef} width={width} height={height} />;
};

// --- Main self-attention explainer component ------------------------------------

const DEFAULT_TOKENS = ['The', 'cat', 'sat', 'on', 'the', 'mat'];
const D_K = 4;

// Fixed small W_Q, W_K, W_V for a single-head toy example
const W_Q: Matrix = [
  [0.8, 0.1, -0.3, 0.2],
  [0.2, 0.7, 0.1, -0.2],
  [-0.4, 0.2, 0.9, 0.1],
  [0.1, -0.3, 0.2, 0.7],
];

const W_K: Matrix = [
  [0.7, -0.2, 0.3, 0.1],
  [0.3, 0.8, -0.1, 0.2],
  [-0.2, 0.3, 0.7, -0.3],
  [0.2, 0.1, 0.2, 0.6],
];

const W_V: Matrix = [
  [0.6, 0.1, 0.1, -0.2],
  [-0.1, 0.7, 0.2, 0.1],
  [0.3, 0.2, 0.8, -0.1],
  [0.0, -0.2, 0.3, 0.7],
];

const SelfAttentionExplorer: React.FC = () => {
  const tokens = DEFAULT_TOKENS;
  const dimLabels = ['d₀', 'd₁', 'd₂', 'd₃'];

  const [temperature, setTemperature] = useState(1.0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(1);

  // Toy "token embeddings" – simple functions of position and rough POS
  const baseEmbeddings = useMemo<Matrix>(() => {
    const n = tokens.length;
    return tokens.map((tok, i) => {
      const pos = (i + 1) / n;
      const lower = tok.toLowerCase();
      const isThe = lower === 'the';
      const isNoun = lower === 'cat' || lower === 'mat';
      const isVerb = lower === 'sat';
      const isPrep = lower === 'on';

      const syntacticRole =
        isNoun ? 0.8 : isVerb ? 0.6 : isPrep ? -0.2 : isThe ? -0.4 : 0.0;

      return [
        pos - 0.5, // position encoding-ish
        syntacticRole,
        i % 2 === 0 ? -0.3 : 0.3,
        (lower.charCodeAt(0) % 2 === 0 ? 0.2 : -0.2),
      ];
    });
  }, [tokens]);

  const { Q, K, V, scores, attention } = useMemo(() => {
    const Q = matmul(baseEmbeddings, W_Q);
    const K = matmul(baseEmbeddings, W_K);
    const V = matmul(baseEmbeddings, W_V);

    const scaledScores = matmul(Q, transpose(K)).map((row) =>
      row.map((v) => v / Math.sqrt(D_K))
    );

    const attention = scaledScores.map((row) =>
      softmaxWithTemperature(row, temperature)
    );

    return { Q, K, V, scores: scaledScores, attention };
  }, [baseEmbeddings, temperature]);

  const activeIndex = hoveredIndex ?? 0;
  const activeAttentionRow = attention[activeIndex] ?? [];

  return (
    <section
      style={{
        backgroundColor: '#080c14', // dark slate background
        color: '#e5e7eb',
        padding: '1.75rem',
        borderRadius: '1rem',
        border: '1px solid #111827',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
        maxWidth: '1040px',
        margin: '0 auto',
      }}
    >
      <h2 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
        Transformer Self-Attention (step‑by‑step)
      </h2>
      <p
        style={{
          fontSize: '0.9rem',
          color: '#9ca3af',
          marginBottom: '1rem',
          maxWidth: '640px',
        }}
      >
        Hover a token to treat it as the <strong>query</strong>. The heatmaps
        show Q, K, V, the scaled scores{' '}
        <code>QKᵀ / √dₖ</code>, and the attention weights{' '}
        <code>softmax(scores / T)</code>, where T is the softmax temperature.
      </p>

      {/* Token sequence */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            fontSize: '0.8rem',
            color: '#9ca3af',
            marginBottom: '0.3rem',
          }}
        >
          1. Sequence of tokens (hover to explore attention):
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.5rem',
          }}
        >
          {tokens.map((token, j) => {
            const w = activeAttentionRow[j] ?? 0;
            const isQuery = j === activeIndex;
            const baseAlpha = isQuery ? 0.3 : 0.1;
            const bgAlpha = baseAlpha + w * 0.9;
            const outlineColor = isQuery ? '#f97316' : 'rgba(148,163,184,0.7)';

            return (
              <button
                key={`${token}-${j}`}
                type="button"
                onMouseEnter={() => setHoveredIndex(j)}
                onFocus={() => setHoveredIndex(j)}
                style={{
                  padding: '0.35rem 0.8rem',
                  borderRadius: '9999px',
                  border: `1px solid ${outlineColor}`,
                  backgroundColor: `rgba(245, 158, 11, ${bgAlpha})`,
                  color: '#f9fafb',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  whiteSpace: 'nowrap',
                  transition:
                    'transform 120ms ease, box-shadow 120ms ease, border-color 120ms ease',
                  boxShadow:
                    w > 0.2
                      ? '0 0 0 1px rgba(245, 158, 11, 0.6)'
                      : 'none',
                }}
              >
                <span>{token}</span>
                {isQuery && (
                  <span
                    style={{
                      fontSize: '0.65rem',
                      textTransform: 'uppercase',
                      color: '#fed7aa',
                      letterSpacing: '0.06em',
                    }}
                  >
                    query
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            fontSize: '0.8rem',
            color: '#9ca3af',
            marginTop: '0.35rem',
          }}
        >
          Highlighted chip = query token. Orange intensity on other chips =
          attention weight to that token.
        </div>
      </div>

      {/* Temperature slider */}
      <div
        style={{
          marginTop: '0.75rem',
          marginBottom: '1rem',
          padding: '0.75rem 0.9rem',
          borderRadius: '0.75rem',
          background:
            'linear-gradient(to right, rgba(15,23,42,1), rgba(15,23,42,0.7))',
          border: '1px solid #1f2937',
        }}
      >
        <label
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.4rem',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.8rem',
              color: '#d1d5db',
            }}
          >
            <span>
              2. Softmax temperature&nbsp;
              <code>T = {temperature.toFixed(2)}</code>
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={2.5}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(parseFloat(e.target.value))}
            style={{
              width: '100%',
              accentColor: '#f59e0b',
            }}
          />
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '0.75rem',
              color: '#9ca3af',
            }}
          >
            <span>Sharper attention (T &lt; 1)</span>
            <span>More diffuse (T &gt; 1)</span>
          </div>
        </label>
      </div>

      {/* Q, K, V heatmaps */}
      <div
        style={{
          marginTop: '0.75rem',
          fontSize: '0.8rem',
          color: '#9ca3af',
        }}
      >
        3. Project embeddings into Q, K, V:
        <code> Q = XW_Q</code>, <code>K = XW_K</code>, <code>V = XW_V</code>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginTop: '0.5rem',
        }}
      >
        <Heatmap
          data={Q}
          title="Queries Q"
          rowLabels={tokens}
          colLabels={dimLabels}
          highlightedRow={activeIndex}
        />
        <Heatmap
          data={K}
          title="Keys K"
          rowLabels={tokens}
          colLabels={dimLabels}
          highlightedRow={activeIndex}
        />
        <Heatmap
          data={V}
          title="Values V"
          rowLabels={tokens}
          colLabels={dimLabels}
          highlightedRow={activeIndex}
        />
      </div>

      {/* Scores + Attention heatmaps */}
      <div
        style={{
          marginTop: '1.1rem',
          fontSize: '0.8rem',
          color: '#9ca3af',
        }}
      >
        4. Compute attention scores and weights:
        <div style={{ marginTop: '0.25rem' }}>
          <code>scores = QKᵀ / √dₖ</code>
          <span style={{ margin: '0 0.5rem' }}>→</span>
          <code>αᵢⱼ = softmax(scoresᵢⱼ / T)</code>
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginTop: '0.5rem',
        }}
      >
        <Heatmap
          data={scores}
          title="Scaled scores QKᵀ / √dₖ"
          rowLabels={tokens}
          colLabels={tokens}
          highlightedRow={activeIndex}
        />
        <Heatmap
          data={attention}
          title="Attention weights softmax(scores / T)"
          rowLabels={tokens}
          colLabels={tokens}
          highlightedRow={activeIndex}
        />
      </div>

      <p
        style={{
          fontSize: '0.8rem',
          color: '#9ca3af',
          marginTop: '0.9rem',
        }}
      >
        The highlighted row in each matrix corresponds to the current query
        token. In the attention heatmap and token chips, bright orange cells
        show which positions that query attends to most.
      </p>
    </section>
  );
};

export default SelfAttentionExplorer;


You can drop this into components/SelfAttentionExplorer.tsx, ensure d3 is installed (npm install d3), and import it into a Next.js page:

tsx
Copy code
import SelfAttentionExplorer from '@/components/SelfAttentionExplorer';

export default function Page() {
  return (
    <main>
      <SelfAttentionExplorer />
    </main>
  );
}
