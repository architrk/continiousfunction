'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { createColorScale } from '../../lib/d3Types';

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
    const color = createColorScale([0, maxAbs], ['#020617', '#f59e0b']);

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

// Temperature presets
const TEMPERATURE_PRESETS = [
  { name: '🎯 Sharp', temp: 0.4, description: 'Focus on top-1 token' },
  { name: '📚 Standard', temp: 1.0, description: 'Normal softmax behavior' },
  { name: '💨 Warm', temp: 1.5, description: 'Spread attention wider' },
  { name: '🌫️ Diffuse', temp: 2.2, description: 'Very uniform attention' },
];

// Gamification types and challenges
type GamePhase = 'setup' | 'countdown' | 'revealed'
type TokenPrediction = string | null

interface AttentionChallenge {
  name: string
  queryIndex: number
  temperature: number
  question: string
  correctToken: string // Token that gets highest attention
  explanation: string
}

// Mystery scenarios for the prediction game
const ATTENTION_CHALLENGES: AttentionChallenge[] = [
  {
    name: '🎲 Sharp Focus',
    queryIndex: 1, // "cat"
    temperature: 0.4,
    question: 'With sharp temperature (T=0.4), which token does "cat" attend to most?',
    correctToken: 'sat',
    explanation: '🎯 "cat" → "sat"! With low temperature, attention concentrates on the verb that describes the subject\'s action. Semantic association wins.',
  },
  {
    name: '🎲 Article Mystery',
    queryIndex: 0, // "The"
    temperature: 1.0,
    question: 'At standard temperature, which token does "The" (first) attend to most?',
    correctToken: 'The',
    explanation: '📝 "The" → "The"! Articles often self-attend because they lack strong semantic content. The embeddings are similar.',
  },
  {
    name: '🎲 Warm Spread',
    queryIndex: 3, // "on"
    temperature: 1.5,
    question: 'With warm temperature (T=1.5), where does "on" attend most?',
    correctToken: 'mat',
    explanation: '💨 "on" → "mat"! Prepositions attend to their objects. Even with warm temperature spreading attention, "mat" still dominates as the prepositional phrase target.',
  },
  {
    name: '🎲 Final Token',
    queryIndex: 5, // "mat"
    temperature: 1.0,
    question: 'Which token does "mat" (final position) attend to most?',
    correctToken: 'cat',
    explanation: '🔍 "mat" → "cat"! Nouns attend to related nouns. "mat" and "cat" have similar syntactic roles and rhyming embeddings.',
  },
];

// Educational feedback for predictions
function getAttentionFeedback(
  prediction: TokenPrediction,
  challenge: AttentionChallenge
): string {
  if (prediction === null) return ''

  if (prediction === challenge.correctToken) {
    return `🎯 Perfect! ${challenge.explanation}`
  } else {
    return `❌ Not quite! ${challenge.explanation}`
  }
}

// Compute entropy of attention weights
function computeEntropy(weights: number[]): number {
  return -weights.reduce((sum, w) => {
    if (w > 1e-10) return sum + w * Math.log2(w);
    return sum;
  }, 0);
}

// Dynamic educational insight
function getSelfAttentionInsight(
  queryToken: string,
  temperature: number,
  attentionRow: number[],
  tokens: string[]
): string {
  const entropy = computeEntropy(attentionRow);
  const maxEntropy = Math.log2(tokens.length);
  const _focusRatio = 1 - (entropy / maxEntropy);
  const maxWeight = Math.max(...attentionRow);
  const topIndex = attentionRow.indexOf(maxWeight);
  const topToken = tokens[topIndex];

  if (temperature < 0.5) {
    if (maxWeight > 0.9) {
      return `🎯 SHARP FOCUS! "${queryToken}" attends almost exclusively to "${topToken}" (${(maxWeight * 100).toFixed(0)}%). Low temperature makes softmax behave like argmax!`;
    }
    return `🎯 Sharp attention: "${queryToken}" strongly favors "${topToken}" with ${(maxWeight * 100).toFixed(0)}% weight. The entropy is just ${entropy.toFixed(2)} bits.`;
  }

  if (temperature > 1.8) {
    return `🌫️ Diffuse attention! Temperature = ${temperature.toFixed(1)} spreads weights evenly. Entropy = ${entropy.toFixed(2)} bits (max possible: ${maxEntropy.toFixed(2)}). This is like uniform averaging.`;
  }

  if (temperature > 1.2) {
    return `💨 Warm softmax (T = ${temperature.toFixed(1)}). Attention is spreading out. "${queryToken}" still favors "${topToken}" but other tokens get more weight too.`;
  }

  if (queryToken.toLowerCase() === topToken.toLowerCase() && queryToken.toLowerCase() === 'the') {
    return `📝 Interesting! "the" attends to itself most. Articles often have weak semantic content and form a self-attending cluster.`;
  }

  if (topToken.toLowerCase() === 'cat' || topToken.toLowerCase() === 'mat') {
    return `🔍 "${queryToken}" attends most to the noun "${topToken}". Nouns often have high attention weights because they carry semantic content.`;
  }

  return `📊 "${queryToken}" → "${topToken}" (${(maxWeight * 100).toFixed(0)}%). Entropy = ${entropy.toFixed(2)} bits. Lower entropy = more focused attention.`;
}

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

  // Gamification state
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [selectedChallenge, setSelectedChallenge] = useState<AttentionChallenge | null>(null)
  const [prediction, setPrediction] = useState<TokenPrediction>(null)
  const [countdown, setCountdown] = useState(0)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<string>>(new Set())

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
  const activeAttentionRow = useMemo(() => attention[activeIndex] ?? [], [attention, activeIndex]);

  // Compute entropy for current query
  const currentEntropy = useMemo(() => computeEntropy(activeAttentionRow), [activeAttentionRow]);
  const maxEntropy = Math.log2(tokens.length);
  const focusPercent = ((1 - currentEntropy / maxEntropy) * 100).toFixed(0);

  // Dynamic insight
  const currentInsight = useMemo(() => {
    return getSelfAttentionInsight(
      tokens[activeIndex],
      temperature,
      activeAttentionRow,
      tokens
    );
  }, [tokens, activeIndex, temperature, activeAttentionRow]);

  // Game control functions
  const startChallenge = (challenge: AttentionChallenge) => {
    setSelectedChallenge(challenge)
    setPrediction(null)
    setCountdown(3)
    setGamePhase('countdown')
    // Set the query token and temperature for this challenge
    setHoveredIndex(challenge.queryIndex)
    setTemperature(challenge.temperature)
  }

  const submitPrediction = () => {
    if (prediction === null || !selectedChallenge) return
    setGamePhase('revealed')
    // Score based on correctness
    if (prediction === selectedChallenge.correctToken) {
      setScore((s) => s + 10)
    }
    setCompletedChallenges((prev) => new Set([...prev, selectedChallenge.name]))
  }

  const resetGame = () => {
    setGamePhase('setup')
    setSelectedChallenge(null)
    setPrediction(null)
    setCountdown(0)
  }

  // Countdown effect
  useEffect(() => {
    if (gamePhase === 'countdown' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000)
      return () => clearTimeout(timer)
    }
  }, [gamePhase, countdown])

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

      {/* Gamification Panel */}
      <div
        style={{
          padding: '14px 18px',
          marginBottom: '1rem',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%)',
          border: '1px solid rgba(168, 85, 247, 0.35)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                setGameMode(!gameMode)
                if (gameMode) resetGame()
              }}
              style={{
                padding: '6px 14px',
                borderRadius: '999px',
                border: gameMode ? '1px solid rgba(168, 85, 247, 0.7)' : '1px solid rgba(148, 163, 184, 0.4)',
                background: gameMode ? 'rgba(168, 85, 247, 0.25)' : 'rgba(15, 23, 42, 0.6)',
                color: gameMode ? '#d8b4fe' : '#d1d5db',
                cursor: 'pointer',
                fontSize: '0.85rem',
                fontWeight: 500,
              }}
            >
              {gameMode ? '🎮 Challenge Mode ON' : '🎯 Try Attention Quiz'}
            </button>
            {gameMode && (
              <span style={{ fontSize: '0.85rem', color: '#a5b4fc' }}>
                Score: <strong style={{ color: '#fbbf24' }}>{score}</strong>
              </span>
            )}
          </div>
        </div>

        {gameMode && gamePhase === 'setup' && (
          <div>
            <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '10px' }}>
              Select a challenge and predict which token receives the most attention:
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ATTENTION_CHALLENGES.map((challenge) => (
                <button
                  key={challenge.name}
                  type="button"
                  onClick={() => startChallenge(challenge)}
                  disabled={completedChallenges.has(challenge.name)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: '8px',
                    border: completedChallenges.has(challenge.name)
                      ? '1px solid rgba(34, 197, 94, 0.5)'
                      : '1px solid rgba(56, 189, 248, 0.5)',
                    background: completedChallenges.has(challenge.name)
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(56, 189, 248, 0.1)',
                    color: completedChallenges.has(challenge.name) ? '#86efac' : '#7dd3fc',
                    cursor: completedChallenges.has(challenge.name) ? 'default' : 'pointer',
                    fontSize: '0.8rem',
                    opacity: completedChallenges.has(challenge.name) ? 0.7 : 1,
                  }}
                >
                  {completedChallenges.has(challenge.name) ? '✓ ' : ''}{challenge.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {gameMode && gamePhase === 'countdown' && selectedChallenge && (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: '8px' }}>
              {selectedChallenge.question}
            </p>
            {countdown > 0 ? (
              <div style={{ fontSize: '2rem', color: '#fbbf24', fontWeight: 700 }}>{countdown}</div>
            ) : (
              <div>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '10px' }}>
                  Click the token that will receive the highest attention weight:
                </p>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {tokens.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => setPrediction(token)}
                      style={{
                        padding: '10px 18px',
                        borderRadius: '8px',
                        border: prediction === token ? '2px solid #fbbf24' : '1px solid rgba(148, 163, 184, 0.4)',
                        background: prediction === token ? 'rgba(251, 191, 36, 0.2)' : 'rgba(15, 23, 42, 0.6)',
                        color: prediction === token ? '#fde68a' : '#d1d5db',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        fontWeight: prediction === token ? 700 : 400,
                      }}
                    >
                      {token}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={submitPrediction}
                  disabled={prediction === null}
                  style={{
                    marginTop: '12px',
                    padding: '8px 24px',
                    borderRadius: '999px',
                    border: 'none',
                    background: prediction !== null
                      ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                      : 'rgba(75, 85, 99, 0.5)',
                    color: prediction !== null ? '#111827' : '#6b7280',
                    cursor: prediction !== null ? 'pointer' : 'default',
                    fontSize: '0.9rem',
                    fontWeight: 600,
                  }}
                >
                  Submit Prediction
                </button>
              </div>
            )}
          </div>
        )}

        {gameMode && gamePhase === 'revealed' && selectedChallenge && (
          <div>
            <div
              style={{
                padding: '12px',
                borderRadius: '8px',
                background: prediction === selectedChallenge.correctToken
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'rgba(251, 146, 60, 0.1)',
                border: `1px solid ${prediction === selectedChallenge.correctToken ? 'rgba(34, 197, 94, 0.5)' : 'rgba(251, 146, 60, 0.4)'}`,
                marginBottom: '10px',
              }}
            >
              <p style={{ fontSize: '0.85rem', color: '#d1d5db', margin: 0 }}>
                Your prediction: <strong>{prediction}</strong> | Correct: <strong>{selectedChallenge.correctToken}</strong>
              </p>
              <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '6px 0 0 0' }}>
                {getAttentionFeedback(prediction, selectedChallenge)}
              </p>
            </div>
            <button
              type="button"
              onClick={resetGame}
              style={{
                padding: '6px 16px',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#d1d5db',
                cursor: 'pointer',
                fontSize: '0.8rem',
              }}
            >
              Try Another Challenge
            </button>
          </div>
        )}
      </div>

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

      {/* Entropy gauge and insight */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1rem',
          alignItems: 'stretch',
        }}
      >
        {/* Entropy gauge */}
        <div
          style={{
            flex: '0 0 200px',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #1f2937',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.3rem' }}>
            Attention Focus
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                flex: 1,
                height: '8px',
                borderRadius: '999px',
                background: '#1f2937',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${focusPercent}%`,
                  height: '100%',
                  borderRadius: '999px',
                  background: Number(focusPercent) > 70
                    ? 'linear-gradient(to right, #f59e0b, #ef4444)'
                    : Number(focusPercent) > 40
                      ? 'linear-gradient(to right, #14b8a6, #f59e0b)'
                      : 'linear-gradient(to right, #6366f1, #14b8a6)',
                  transition: 'width 0.3s ease-out',
                }}
              />
            </div>
            <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#e5e7eb', minWidth: '40px' }}>
              {focusPercent}%
            </span>
          </div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', marginTop: '0.25rem' }}>
            Entropy: {currentEntropy.toFixed(2)} / {maxEntropy.toFixed(2)} bits
          </div>
        </div>

        {/* Dynamic insight */}
        <div
          style={{
            flex: '1 1 300px',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: temperature < 0.6
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
              : temperature > 1.5
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))'
                : 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))',
            border: temperature < 0.6
              ? '1px solid rgba(245, 158, 11, 0.3)'
              : temperature > 1.5
                ? '1px solid rgba(99, 102, 241, 0.3)'
                : '1px solid rgba(20, 184, 166, 0.3)',
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.5,
          }}
        >
          {currentInsight}
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
              alignItems: 'center',
              fontSize: '0.8rem',
              color: '#d1d5db',
              marginBottom: '0.4rem',
            }}
          >
            <span>
              2. Softmax temperature&nbsp;
              <code>T = {temperature.toFixed(2)}</code>
            </span>
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              {TEMPERATURE_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setTemperature(preset.temp)}
                  title={preset.description}
                  style={{
                    fontSize: '0.65rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '999px',
                    border: Math.abs(temperature - preset.temp) < 0.1
                      ? '1px solid #f59e0b'
                      : '1px solid #374151',
                    background: Math.abs(temperature - preset.temp) < 0.1
                      ? 'rgba(245, 158, 11, 0.2)'
                      : 'rgba(15, 23, 42, 0.9)',
                    color: Math.abs(temperature - preset.temp) < 0.1
                      ? '#fbbf24'
                      : '#e5e7eb',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease-out',
                  }}
                >
                  {preset.name}
                </button>
              ))}
            </div>
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
