'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';

type Matrix = number[][];

// ─────────────────────────────────────────────────────────────
// Gamification: "Attention Challenge" – predict attention behavior
// ─────────────────────────────────────────────────────────────
type GamePhase = 'setup' | 'countdown' | 'revealed';
type AttentionPrediction = 'A' | 'B' | 'C' | null;

interface AttentionChallenge {
  name: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  answer: 'A' | 'B' | 'C';
  insight: string;
}

const ATTENTION_CHALLENGES: AttentionChallenge[] = [
  {
    name: '🎲 Temperature Effect',
    question: 'When temperature T < 1, what happens to the attention distribution?',
    optionA: 'Attention becomes more uniform (spread equally)',
    optionB: 'Attention becomes sharper (concentrated on few keys)',
    optionC: 'Attention values become negative',
    answer: 'B',
    insight: 'Lower temperature makes softmax outputs more "peaky" - the highest logit dominates. At T→0, softmax becomes argmax. This is why LLM sampling uses temperature: T<1 for deterministic output, T>1 for creative/diverse output!'
  },
  {
    name: '🎲 QKᵀ Meaning',
    question: 'What does the QKᵀ matrix represent before softmax?',
    optionA: 'The final output values',
    optionB: 'Raw similarity/alignment scores between each query-key pair',
    optionC: 'The gradient of the loss function',
    answer: 'B',
    insight: 'QKᵀ[i,j] = dot(q_i, k_j) measures how much query i "matches" key j. High dot product = high similarity = high attention. The √d_k scaling prevents these scores from growing too large with dimension.'
  },
  {
    name: '🎲 Value Role',
    question: 'What is the role of the Value (V) matrix in attention?',
    optionA: 'It determines which tokens to attend to',
    optionB: 'It provides the content to aggregate based on attention weights',
    optionC: 'It normalizes the attention scores',
    answer: 'B',
    insight: 'V is the "content" matrix. Q and K determine WHERE to attend (the routing), while V determines WHAT information to retrieve. Output = Σ(α_ij × V_j) - a weighted sum of value vectors.'
  },
  {
    name: '🎲 Query vs Key',
    question: 'Why have separate Q and K projections instead of just using Q for both?',
    optionA: 'To reduce computation (half the matrix multiplications)',
    optionB: 'To allow asymmetric relationships (A attends to B ≠ B attends to A)',
    optionC: 'To make the attention matrix symmetric',
    answer: 'B',
    insight: 'With Q=K, attention would be symmetric: A attends to B iff B attends to A. Separate projections allow asymmetry - e.g., "the cat" might attend strongly to "sat" (subject→verb), but "sat" might attend more to "mat" (verb→object).'
  }
];

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
      .scaleLinear<string>()
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

  // ─── Game state ───
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup');
  const [activeChallengeIdx, setActiveChallengeIdx] = useState<number | null>(null);
  const [prediction, setPrediction] = useState<AttentionPrediction>(null);
  const [countdown, setCountdown] = useState<number>(3);
  const [score, setScore] = useState<{ correct: number; total: number }>({ correct: 0, total: 0 });

  const activeChallenge = activeChallengeIdx !== null ? ATTENTION_CHALLENGES[activeChallengeIdx] : null;

  // ─── Game control functions ───
  const startChallenge = (idx: number) => {
    setActiveChallengeIdx(idx);
    setPrediction(null);
    setGamePhase('setup');
    setCountdown(3);
  };

  const submitPrediction = (choice: 'A' | 'B' | 'C') => {
    setPrediction(choice);
    setGamePhase('countdown');
    setCountdown(3);
  };

  const resetGame = () => {
    setActiveChallengeIdx(null);
    setPrediction(null);
    setGamePhase('setup');
    setCountdown(3);
    setScore({ correct: 0, total: 0 });
  };

  // ─── Countdown effect ───
  useEffect(() => {
    if (gamePhase !== 'countdown') return;
    if (countdown <= 0) {
      setGamePhase('revealed');
      if (activeChallenge && prediction === activeChallenge.answer) {
        setScore((s) => ({ correct: s.correct + 1, total: s.total + 1 }));
      } else {
        setScore((s) => ({ ...s, total: s.total + 1 }));
      }
      return;
    }
    const tid = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(tid);
  }, [gamePhase, countdown, activeChallenge, prediction]);

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

      {/* ─────────────────────────────────────────────────────────────
          GAME PANEL: Attention Challenge
          ───────────────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 16,
        padding: 16,
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(24,24,27,0.95))',
        border: '1px solid rgba(148,163,184,0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ fontSize: '1rem', margin: 0 }}>🎮 Attention Challenge</h3>
          <div style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
            Score: {score.correct}/{score.total}
            {score.total > 0 && (
              <button
                onClick={resetGame}
                style={{
                  marginLeft: 8,
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  borderRadius: 4,
                  border: '1px solid rgba(148,163,184,0.4)',
                  background: 'rgba(15,23,42,0.8)',
                  color: '#9ca3af',
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Challenge selection */}
        {activeChallengeIdx === null && (
          <div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: 10 }}>
              Test your understanding of self-attention:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {ATTENTION_CHALLENGES.map((ch, idx) => (
                <button
                  key={idx}
                  onClick={() => startChallenge(idx)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '6px 12px',
                    borderRadius: 6,
                    border: '1px solid rgba(245,158,11,0.5)',
                    background: 'rgba(245,158,11,0.1)',
                    color: '#f59e0b',
                    cursor: 'pointer'
                  }}
                >
                  {ch.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Active challenge */}
        {activeChallenge && gamePhase === 'setup' && (
          <div>
            <p style={{ fontSize: '0.9rem', marginBottom: 12, color: '#e5e7eb' }}>
              {activeChallenge.question}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(['A', 'B', 'C'] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => submitPrediction(opt)}
                  style={{
                    fontSize: '0.85rem',
                    padding: '10px 14px',
                    borderRadius: 8,
                    border: '1px solid rgba(148,163,184,0.4)',
                    background: 'rgba(15,23,42,0.9)',
                    color: '#e5e7eb',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                >
                  <strong>{opt}.</strong>{' '}
                  {opt === 'A' ? activeChallenge.optionA : opt === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
                </button>
              ))}
            </div>
            <button
              onClick={() => setActiveChallengeIdx(null)}
              style={{
                marginTop: 10,
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: 4,
                border: '1px solid rgba(148,163,184,0.3)',
                background: 'transparent',
                color: '#6b7280',
                cursor: 'pointer'
              }}
            >
              ← Back to challenges
            </button>
          </div>
        )}

        {/* Countdown */}
        {gamePhase === 'countdown' && (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <div style={{ fontSize: '3rem', fontWeight: 700, color: '#f59e0b' }}>
              {countdown}
            </div>
            <p style={{ fontSize: '0.85rem', color: '#9ca3af' }}>
              Your prediction: <strong>{prediction}</strong>
            </p>
          </div>
        )}

        {/* Revealed */}
        {gamePhase === 'revealed' && activeChallenge && (
          <div>
            <div style={{
              padding: 12,
              borderRadius: 8,
              marginBottom: 12,
              background: prediction === activeChallenge.answer
                ? 'rgba(34,197,94,0.15)'
                : 'rgba(239,68,68,0.15)',
              border: `1px solid ${prediction === activeChallenge.answer ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: 4 }}>
                {prediction === activeChallenge.answer ? '✓ Correct!' : '✗ Not quite'}
              </div>
              <p style={{ fontSize: '0.85rem', margin: 0, color: '#e5e7eb' }}>
                The answer is <strong>{activeChallenge.answer}</strong>:{' '}
                {activeChallenge.answer === 'A' ? activeChallenge.optionA : activeChallenge.answer === 'B' ? activeChallenge.optionB : activeChallenge.optionC}
              </p>
            </div>
            <div style={{
              padding: 12,
              borderRadius: 8,
              background: 'rgba(8,145,178,0.1)',
              border: '1px solid rgba(8,145,178,0.3)'
            }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0891b2', marginBottom: 4 }}>
                💡 Insight
              </div>
              <p style={{ fontSize: '0.85rem', margin: 0, color: '#e5e7eb' }}>
                {activeChallenge.insight}
              </p>
            </div>
            <button
              onClick={() => setActiveChallengeIdx(null)}
              style={{
                marginTop: 12,
                fontSize: '0.8rem',
                padding: '6px 14px',
                borderRadius: 6,
                border: '1px solid rgba(245,158,11,0.5)',
                background: 'rgba(245,158,11,0.1)',
                color: '#f59e0b',
                cursor: 'pointer'
              }}
            >
              Try another challenge
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default SelfAttentionExplorer;
