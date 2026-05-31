'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { createColorScale } from '../../lib/d3Types';
import { clearDemoState, emitDemoState } from '../../lib/demoState';

type Matrix = number[][];
export type ValueMixPrediction = number | 'tie';

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
export const VALUE_CONTRIBUTION_TOLERANCE = 0.01;

// Temperature presets
const TEMPERATURE_PRESETS = [
  { name: '🎯 Sharp', temp: 0.4, description: 'Focus on top-1 token' },
  { name: '📚 Standard', temp: 1.0, description: 'Normal softmax behavior' },
  { name: '💨 Warm', temp: 1.5, description: 'Spread attention wider' },
  { name: '🌫️ Diffuse', temp: 2.2, description: 'Very uniform attention' },
];

type SelfAttentionExplorerProps = {
  conceptId?: string
}

// Compute entropy of attention weights
function computeEntropy(weights: number[]): number {
  return -weights.reduce((sum, w) => {
    if (w > 1e-10) return sum + w * Math.log2(w);
    return sum;
  }, 0);
}

function vectorNorm(values: number[]): number {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

export function getValueContributionWinners(
  attentionRow: number[],
  values: Matrix
): {
  contributionVectors: Matrix;
  contributionNorms: number[];
  maxNorm: number;
  winnerIndices: number[];
  expectedAnswer: ValueMixPrediction;
} {
  const contributionVectors = values.map((valueVector, tokenIndex) =>
    valueVector.map((value) => (attentionRow[tokenIndex] ?? 0) * value)
  );
  const contributionNorms = contributionVectors.map(vectorNorm);
  const maxNorm = Math.max(...contributionNorms);
  const tolerance = Math.max(VALUE_CONTRIBUTION_TOLERANCE, 0.025 * maxNorm);
  const winnerIndices = contributionNorms
    .map((norm, index) => ({ norm, index }))
    .filter(({ norm }) => maxNorm - norm <= tolerance)
    .map(({ index }) => index);

  return {
    contributionVectors,
    contributionNorms,
    maxNorm,
    winnerIndices,
    expectedAnswer: winnerIndices.length === 1 ? winnerIndices[0] : 'tie',
  };
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

const SelfAttentionExplorer: React.FC<SelfAttentionExplorerProps> = ({ conceptId = 'attention-transformers' }) => {
  const tokens = DEFAULT_TOKENS;
  const dimLabels = ['d₀', 'd₁', 'd₂', 'd₃'];

  const [temperature, setTemperature] = useState(1.0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(1);
  const conceptIdRef = useRef(conceptId);
  const conceptChanged = conceptIdRef.current !== conceptId;

  const [prediction, setPrediction] = useState<ValueMixPrediction | null>(null);
  const [revealed, setRevealed] = useState(false);
  const revealVisible = revealed && !conceptChanged;

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
  const topWeight = Math.max(...activeAttentionRow);
  const topTokenIndex = activeAttentionRow.indexOf(topWeight);
  const activeScoreRow = useMemo(() => scores[activeIndex] ?? [], [scores, activeIndex]);
  const rowSum = activeAttentionRow.reduce((sum, weight) => sum + weight, 0);
  const dimCount = dimLabels.length
  const tokenLabels = useMemo(
    () => tokens.map((token, index) => `T${index} · ${token}`),
    [tokens]
  );
  const valueMix = useMemo(
    () =>
      activeAttentionRow.reduce(
        (acc, weight, index) => {
          const value = V[index] ?? []
          for (let dim = 0; dim < dimCount; dim++) {
            acc[dim] += weight * (value[dim] ?? 0)
          }
          return acc
        },
        Array(dimCount).fill(0) as number[]
      ),
    [activeAttentionRow, V, dimCount]
  );
  const valueContribution = useMemo(
    () => getValueContributionWinners(activeAttentionRow, V),
    [activeAttentionRow, V]
  );
  const expectedValueAnswer = valueContribution.expectedAnswer;
  const predictionCorrect =
    prediction !== null &&
    (expectedValueAnswer === 'tie'
      ? prediction === 'tie'
      : prediction === expectedValueAnswer);
  const predictionLabel =
    prediction === null
      ? 'none'
      : prediction === 'tie'
      ? 'No clear single contributor'
      : tokenLabels[prediction];
  const actualContributorLabel =
    expectedValueAnswer === 'tie'
      ? valueContribution.winnerIndices.map((index) => tokenLabels[index]).join(', ')
      : tokenLabels[expectedValueAnswer];
  const topAttentionLabel = tokenLabels[topTokenIndex];
  const valueEvidenceSteps = [
    {
      title: 'Predict',
      detail:
        prediction === null
          ? 'Commit to the largest weighted value contributor.'
          : `Committed to ${predictionLabel}.`,
    },
    {
      title: 'Observe',
      detail: revealVisible
        ? `Measured contributor: ${actualContributorLabel}.`
        : 'Score, attention, and output rows stay locked.',
    },
    {
      title: 'Ground',
      detail: revealVisible
        ? `Use alpha_ij * V_j, not attention alone.`
        : 'Reason from the visible Q, K, V setup first.',
    },
    {
      title: 'Carry',
      detail: revealVisible
        ? `${predictionCorrect ? 'Matched' : 'Missed'}; carry row sum, entropy, and O_i.`
        : 'Research Room receives compact evidence after reveal.',
    },
  ];
  const valueActiveEvidenceIndex = revealVisible ? 3 : 0;
  const neutralTokenMatrix = useMemo(
    () => tokens.map(() => tokens.map(() => 0)),
    [tokens]
  );
  const visibleScores = revealVisible ? scores : neutralTokenMatrix;
  const visibleAttention = revealVisible ? attention : neutralTokenMatrix;

  const resetReveal = () => {
    setPrediction(null);
    setRevealed(false);
    clearDemoState(conceptId);
  };

  const choosePrediction = (nextPrediction: ValueMixPrediction) => {
    setPrediction(nextPrediction);
    if (revealed) {
      setRevealed(false);
      clearDemoState(conceptId);
    }
  };

  const revealValueMix = () => {
    if (prediction === null) return;
    setRevealed(true);
  };

  const changeTemperature = (nextTemperature: number) => {
    setTemperature(nextTemperature);
    resetReveal();
  };

  const changeActiveIndex = (nextIndex: number) => {
    setHoveredIndex(nextIndex);
    resetReveal();
  };

  // Dynamic insight
  const currentInsight = useMemo(() => {
    return getSelfAttentionInsight(
      tokens[activeIndex],
      temperature,
      activeAttentionRow,
      tokens
    );
  }, [tokens, activeIndex, temperature, activeAttentionRow]);

  useEffect(() => {
    conceptIdRef.current = conceptId;
    setPrediction(null);
    setRevealed(false);
    clearDemoState(conceptId);
    return () => clearDemoState(conceptId);
  }, [conceptId]);

  useEffect(() => {
    if (!revealVisible || prediction === null) return;

    emitDemoState({
      conceptId,
      label: 'Self-attention value mixing reveal',
      summary: `Query ${tokenLabels[activeIndex]} at T=${temperature.toFixed(2)}: learner predicted ${predictionLabel}; strongest weighted value contribution is ${actualContributorLabel}; top attention token is ${topAttentionLabel}; prediction ${predictionCorrect ? 'matched' : 'missed'}.`,
      values: [
        `query token: ${tokenLabels[activeIndex]} (row ${activeIndex})`,
        `temperature T: ${temperature.toFixed(2)}`,
        `prediction: ${predictionLabel}`,
        `actual value contributor: ${actualContributorLabel}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `top attention token: ${topAttentionLabel} (${(topWeight * 100).toFixed(1)}%)`,
        `attention entropy: ${currentEntropy.toFixed(3)} bits`,
        `probability row sum: ${rowSum.toFixed(4)}`,
        `score row: [${activeScoreRow.map((value) => value.toFixed(2)).join(', ')}]`,
        `attention row: [${activeAttentionRow.map((value) => value.toFixed(3)).join(', ')}]`,
        `value contribution norms: [${valueContribution.contributionNorms.map((value) => value.toFixed(3)).join(', ')}]`,
        `value mixture O_i: [${valueMix.map((value) => value.toFixed(3)).join(', ')}]`,
        'reveal state: value mixing shown',
        'evidence loop: predict -> observe -> ground -> carry',
      ],
    })
  }, [
    activeAttentionRow,
    activeIndex,
    activeScoreRow,
    actualContributorLabel,
    conceptChanged,
    conceptId,
    currentEntropy,
    prediction,
    predictionCorrect,
    predictionLabel,
    revealVisible,
    rowSum,
    temperature,
    tokenLabels,
    topAttentionLabel,
    topWeight,
    valueContribution.contributionNorms,
    valueMix,
  ]);

  return (
    <section
      style={{
        backgroundColor: '#080c14', // dark slate background
        color: '#e5e7eb',
        width: '100%',
        boxSizing: 'border-box',
        padding: 'clamp(0.65rem, 3vw, 1.75rem)',
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

      {/* Local value-mixing prediction gate */}
      <div
        data-child-demo-gate="self-attention-value-mix"
        style={{
          padding: '16px',
          marginBottom: '1rem',
          borderRadius: '8px',
          background: revealVisible
            ? 'linear-gradient(135deg, #fff7ed 0%, #f8f4ea 58%, #ecfdf5 100%)'
            : 'linear-gradient(135deg, #fffaf0 0%, #f8f4ea 100%)',
          border: revealVisible
            ? '1px solid #f59e0b'
            : '1px solid #d6c7ad',
          boxShadow: revealVisible
            ? '0 14px 34px rgba(15, 23, 42, 0.18)'
            : '0 10px 24px rgba(15, 23, 42, 0.12)',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
            flexWrap: 'wrap',
            marginBottom: '0.85rem',
          }}
        >
          <div style={{ minWidth: 0, flex: '1 1 320px' }}>
            <div
              style={{
                color: '#92400e',
                fontSize: '0.68rem',
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                marginBottom: '0.3rem',
              }}
            >
              child prediction checkpoint
            </div>
            <p style={{ fontSize: '0.92rem', color: '#1f2937', margin: '0 0 0.35rem', lineHeight: 1.4 }}>
              <strong>For selected query {tokenLabels[activeIndex]}, which source token contributes the largest weighted value vector?</strong>
            </p>
            <div style={{ fontSize: '0.8rem', color: '#6b7280', lineHeight: 1.5 }}>
              Pick the largest term in <code style={{ color: '#374151' }}>alpha_ij * V_j</code> before the score row, attention row, and output mixture unlock.
            </div>
          </div>
          <div
            style={{
              flex: '0 1 240px',
              padding: '0.65rem 0.75rem',
              borderRadius: '8px',
              background: '#111827',
              border: '1px solid #334155',
              color: '#e5e7eb',
              fontSize: '0.76rem',
              lineHeight: 1.45,
            }}
          >
            Top attention can be a clue, but the output uses{' '}
            <strong style={{ color: '#f8fafc' }}>weight x value vector norm</strong>.
          </div>
        </div>
        <div
          role="group"
          aria-label="Self-attention value contributor prediction"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
            gap: '0.5rem',
            marginBottom: '0.85rem',
          }}
        >
          {tokens.map((token, index) => (
            <button
              key={`${token}-${index}-value-prediction`}
              type="button"
              aria-pressed={prediction === index}
              onClick={() => choosePrediction(index)}
              style={{
                padding: '0.45rem 0.7rem',
                borderRadius: '8px',
                border: prediction === index
                  ? '2px solid #1d4ed8'
                  : revealVisible && valueContribution.winnerIndices.includes(index)
                  ? '2px solid #22c55e'
                  : '1px solid #d6c7ad',
                background: prediction === index
                  ? '#dbeafe'
                  : revealVisible && valueContribution.winnerIndices.includes(index)
                  ? '#dcfce7'
                  : '#fffaf0',
                color: prediction === index ? '#1d4ed8' : '#1f2937',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: prediction === index || (revealVisible && valueContribution.winnerIndices.includes(index)) ? 700 : 500,
                textAlign: 'left',
              }}
            >
              {tokenLabels[index]}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={prediction === 'tie'}
            onClick={() => choosePrediction('tie')}
            style={{
              padding: '0.45rem 0.7rem',
              borderRadius: '8px',
              border: prediction === 'tie' ? '2px solid #1d4ed8' : '1px solid #d6c7ad',
              background: prediction === 'tie' ? '#dbeafe' : '#fffaf0',
              color: prediction === 'tie' ? '#1d4ed8' : '#1f2937',
              cursor: 'pointer',
              fontSize: '0.82rem',
              fontWeight: prediction === 'tie' ? 700 : 500,
              textAlign: 'left',
            }}
          >
            No clear single contributor
          </button>
        </div>
        <div
          aria-label="Self-attention value evidence loop"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))',
            gap: '0.5rem',
            padding: '0.6rem',
            marginBottom: '0.85rem',
            borderRadius: '8px',
            background: '#0f172a',
            border: '1px solid #334155',
          }}
        >
          {valueEvidenceSteps.map((step, index) => (
            <div
              key={step.title}
              style={{
                padding: '0.6rem',
                borderRadius: '7px',
                border: index === valueActiveEvidenceIndex ? '1px solid #f59e0b' : '1px solid #1f2937',
                background: index === valueActiveEvidenceIndex ? '#fff7ed' : '#111827',
                color: index === valueActiveEvidenceIndex ? '#1f2937' : '#d1d5db',
                minHeight: '82px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  marginBottom: '0.35rem',
                }}
              >
                <span
                  style={{
                    width: '1.35rem',
                    height: '1.35rem',
                    borderRadius: '999px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: index === valueActiveEvidenceIndex ? '#f59e0b' : '#334155',
                    color: index === valueActiveEvidenceIndex ? '#111827' : '#f8fafc',
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    flex: '0 0 auto',
                  }}
                >
                  {index + 1}
                </span>
                <strong
                  style={{
                    fontSize: '0.78rem',
                    color: index === valueActiveEvidenceIndex ? '#111827' : '#f8fafc',
                  }}
                >
                  {step.title}
                </strong>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: '0.74rem',
                  lineHeight: 1.35,
                  color: index === valueActiveEvidenceIndex ? '#374151' : '#cbd5e1',
                }}
              >
                {step.detail}
              </p>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.75rem' }}>
          <button
            type="button"
            onClick={revealValueMix}
            disabled={prediction === null || revealVisible}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '999px',
              border: 'none',
              background: prediction !== null && !revealVisible
                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                : 'rgba(75, 85, 99, 0.5)',
              color: prediction !== null && !revealVisible ? '#111827' : '#6b7280',
              cursor: prediction !== null && !revealVisible ? 'pointer' : 'not-allowed',
              fontSize: '0.88rem',
              fontWeight: 700,
            }}
          >
            Reveal value mixture
          </button>
          {revealVisible && (
            <button
              type="button"
              onClick={resetReveal}
              style={{
                padding: '0.5rem 0.8rem',
                borderRadius: '999px',
                border: '1px solid rgba(148, 163, 184, 0.4)',
                background: 'rgba(15, 23, 42, 0.6)',
                color: '#d1d5db',
                cursor: 'pointer',
                fontSize: '0.82rem',
              }}
            >
              Reset reveal
            </button>
          )}
          {revealVisible && (
            <span
              style={{
                padding: '0.45rem 0.75rem',
                borderRadius: '8px',
                background: predictionCorrect ? 'rgba(34, 197, 94, 0.18)' : 'rgba(251, 146, 60, 0.14)',
                border: predictionCorrect ? '1px solid rgba(34, 197, 94, 0.42)' : '1px solid rgba(251, 146, 60, 0.36)',
                color: predictionCorrect ? '#bbf7d0' : '#fed7aa',
                fontSize: '0.83rem',
                fontWeight: 650,
              }}
            >
              {predictionCorrect ? 'Prediction matched.' : 'Prediction missed.'} Actual contributor: {actualContributorLabel}.
            </span>
          )}
          {revealVisible && (
            <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>
              Top attention token: {topAttentionLabel} at {(topWeight * 100).toFixed(1)}%.
            </span>
          )}
          </div>
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
            const w = revealVisible ? activeAttentionRow[j] ?? 0 : 0;
            const isQuery = j === activeIndex;
            const baseAlpha = isQuery ? 0.3 : 0.1;
            const bgAlpha = baseAlpha + w * 0.9;
            const outlineColor = isQuery ? '#f97316' : 'rgba(148,163,184,0.7)';

            return (
              <button
                key={`${token}-${j}`}
                type="button"
                onMouseEnter={() => changeActiveIndex(j)}
                onFocus={() => changeActiveIndex(j)}
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
          {revealVisible ? 'attention weight to that token.' : 'locked until reveal.'}
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
        {/* Distribution readout */}
        <div
          style={{
            flex: '0 0 200px',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid #1f2937',
          }}
        >
          {revealVisible ? (
            <>
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
            </>
          ) : (
            <div
              style={{
                color: '#9ca3af',
                fontSize: '0.82rem',
                fontWeight: 550,
                lineHeight: 1.45,
              }}
            >
              Distribution readout locked until reveal.
            </div>
          )}
        </div>

        {/* Dynamic insight */}
        <div
          style={{
            flex: '1 1 300px',
            padding: '0.75rem',
            borderRadius: '0.75rem',
            background: revealVisible
              ? temperature < 0.6
                ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))'
                : temperature > 1.5
                  ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(99, 102, 241, 0.05))'
                  : 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
              : 'rgba(15, 23, 42, 0.8)',
            border: revealVisible
              ? temperature < 0.6
                ? '1px solid rgba(245, 158, 11, 0.3)'
                : temperature > 1.5
                  ? '1px solid rgba(99, 102, 241, 0.3)'
                  : '1px solid rgba(20, 184, 166, 0.3)'
              : '1px solid #1f2937',
            fontSize: '0.8rem',
            color: 'rgba(255, 255, 255, 0.9)',
            lineHeight: 1.5,
          }}
        >
          {revealVisible
            ? currentInsight
            : 'Use the visible Q, K, and V setup plus the temperature to reason about which weighted value vector will dominate the output.'}
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
                  onClick={() => changeTemperature(preset.temp)}
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
            aria-label="Softmax temperature"
            min={0.3}
            max={2.5}
            step={0.05}
            value={temperature}
            onChange={(e) => changeTemperature(parseFloat(e.target.value))}
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
          data={visibleScores}
          title={revealVisible ? 'Scaled scores QKᵀ / √dₖ' : 'Scaled scores QKᵀ / √dₖ (locked)'}
          rowLabels={tokens}
          colLabels={tokens}
          highlightedRow={activeIndex}
        />
        <Heatmap
          data={visibleAttention}
          title={revealVisible ? 'Attention weights softmax(scores / T)' : 'Attention weights softmax(scores / T) (locked)'}
          rowLabels={tokens}
          colLabels={tokens}
          highlightedRow={activeIndex}
        />
      </div>

      {revealVisible ? (
        <div
          style={{
            marginTop: '0.9rem',
            padding: '0.9rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.82)',
            border: '1px solid #1f2937',
            color: '#d1d5db',
            fontSize: '0.82rem',
            lineHeight: 1.55,
          }}
        >
          <strong>Revealed value mixture:</strong> strongest weighted value contribution is {actualContributorLabel}.{' '}
          <span>Value contribution norms: [{valueContribution.contributionNorms.map((value) => value.toFixed(3)).join(', ')}]. </span>
          <span>Value mixture O_i: [{valueMix.map((value) => value.toFixed(3)).join(', ')}]. </span>
          <span>Probability row sum: {rowSum.toFixed(4)}.</span>
        </div>
      ) : (
        <div
          style={{
            marginTop: '0.9rem',
            padding: '0.9rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.72)',
            border: '1px solid #1f2937',
            color: '#9ca3af',
            fontSize: '0.82rem',
          }}
        >
          Derived rows and the final mixture are locked until reveal.
        </div>
      )}

      <p
        style={{
          fontSize: '0.8rem',
          color: '#9ca3af',
          marginTop: '0.9rem',
        }}
      >
        The highlighted row in each matrix corresponds to the current query
        token. {revealVisible
          ? 'Bright cells now show which positions the query attends to most.'
          : 'The output-bearing rows are neutral until you reveal the value-mixing prediction.'}
      </p>
    </section>
  );
};

export default SelfAttentionExplorer;
