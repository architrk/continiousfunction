Here’s a single TransformerMasterDiagram.tsx component you can drop into components/ in a Next.js app. It’s self-contained (aside from react + d3-interpolate) and uses SVG with interactive drill‑down, breadcrumbs, hover formulas, and a token flow animation.

 

attachments-bundle

tsx
Copy code
'use client'

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  MouseEvent as ReactMouseEvent,
  CSSProperties,
} from 'react'
import { interpolateNumber } from 'd3-interpolate'

type TransformerComponentId =
  | 'input-embedding'
  | 'multihead-self-attn'
  | 'add-norm'
  | 'feed-forward'
  | 'encoder-decoder-attn'
  | 'output-projection'

type FocusTarget =
  | { kind: 'overview' }
  | { kind: 'component'; componentId: TransformerComponentId }

interface DimensionAnnotation {
  label: string
  shape: string
  description?: string
}

interface FormulaInfo {
  label: string
  formula: string
  description?: string
}

interface ComponentMetadata {
  id: TransformerComponentId
  title: string
  category: 'Encoder' | 'Decoder' | 'Shared'
  summary: string
  dimensions: DimensionAnnotation[]
  formulas: FormulaInfo[]
}

type BlockRole = 'encoder' | 'decoder' | 'attention' | 'io'

interface DiagramBlock {
  id: string
  label: string
  componentId?: TransformerComponentId
  role: BlockRole
  row: 'encoder' | 'decoder'
  x: number
  y: number
  width: number
  height: number
  shapeLabel?: string
}

interface TokenStage {
  id: string
  label: string
  blockId: string
}

interface TooltipState {
  x: number
  y: number
  content: string
}

// === Architecture hyperparameters (for dimension annotations) ===

const D_MODEL = 512
const D_FF = 2048
const NUM_HEADS = 8
const D_K = D_MODEL / NUM_HEADS // 64
const T_SRC = 6
const T_TGT = 6
const VOCAB_SIZE = 32000

// === Color palette ===

const COLORS = {
  background: '#0d1219',
  panel: 'rgba(15,23,42,0.95)',
  panelBorder: '#1f2937',
  encoderFill: 'rgba(13, 148, 136, 0.22)', // teal
  encoderStroke: 'rgba(34, 211, 238, 0.9)',
  decoderFill: 'rgba(249, 115, 22, 0.22)', // orange
  decoderStroke: 'rgba(248, 250, 252, 0.7)',
  attentionFill: 'rgba(139, 92, 246, 0.22)', // purple
  attentionStroke: 'rgba(196, 181, 253, 0.95)',
  ioFill: 'rgba(15, 23, 42, 0.9)',
  ioStroke: 'rgba(148, 163, 184, 0.9)',
  tokenFill: '#e5e7eb',
  tokenStroke: '#a855f7',
  textMain: '#e5e7eb',
  textMuted: '#9ca3af',
  textAccent: '#f97316',
  borderSoft: '#374151',
  borderStrong: '#4b5563',
  chipBg: 'rgba(15,23,42,0.9)',
  chipBorder: 'rgba(55,65,81,0.8)',
}

// === Component metadata: summaries, dimensions, formulas ===

const COMPONENT_METADATA: Record<TransformerComponentId, ComponentMetadata> = {
  'input-embedding': {
    id: 'input-embedding',
    title: 'Input Embedding + Positional Encoding',
    category: 'Shared',
    summary:
      'Turns discrete token IDs into continuous d_model-dimensional vectors and adds sinusoidal positional encodings so the model knows token order.',
    dimensions: [
      {
        label: 'Token IDs',
        shape: '(T,)',
        description: 'Integer indices for each token in the sequence (source or target).',
      },
      {
        label: 'Embedding matrix W_e',
        shape: `(V, d_model) = (${VOCAB_SIZE}, ${D_MODEL})`,
        description: 'Learned lookup table mapping each token ID to a d_model-dimensional vector.',
      },
      {
        label: 'Token embeddings E',
        shape: `(T, d_model)`,
        description: 'Sequence of dense vectors looked up from W_e.',
      },
      {
        label: 'Positional encodings PE',
        shape: '(T, d_model)',
        description: 'Fixed sinusoidal features encoding absolute position.',
      },
      {
        label: 'Output E + PE',
        shape: '(T, d_model)',
        description: 'Embeddings used as input to the encoder or decoder.',
      },
    ],
    formulas: [
      {
        label: 'Embedding lookup',
        formula: 'e_t = W_e[x_t]',
        description: 'Take row x_t of the embedding matrix W_e.',
      },
      {
        label: 'Positional encoding (even dims)',
        formula: 'PE(pos, 2i)   = sin(pos / 10000^{2i / d_model})',
      },
      {
        label: 'Positional encoding (odd dims)',
        formula: 'PE(pos, 2i+1) = cos(pos / 10000^{2i / d_model})',
      },
    ],
  },
  'multihead-self-attn': {
    id: 'multihead-self-attn',
    title: 'Multi-Head Self-Attention',
    category: 'Shared',
    summary:
      'For each position, computes attention-weighted combinations of all positions. Multi-head structure lets the model attend to different patterns in parallel.',
    dimensions: [
      {
        label: 'Input X',
        shape: '(T, d_model)',
        description: 'Sequence of token representations into the layer.',
      },
      {
        label: 'Projection matrices',
        shape: 'W_Q, W_K, W_V ∈ ℝ^{d_model × d_model}',
        description: 'Learned projections for queries, keys, and values.',
      },
      {
        label: 'Q, K, V',
        shape: '(T, d_model) each',
      },
      {
        label: 'Split into heads',
        shape: `(h, T, d_k) with h = ${NUM_HEADS}, d_k = ${D_K}`,
      },
      {
        label: 'Attention weights',
        shape: '(h, T, T)',
        description: 'For each head, attention over all tokens for each query position.',
      },
      {
        label: 'Output',
        shape: '(T, d_model)',
        description: 'Concat of all heads projected back with W_O.',
      },
    ],
    formulas: [
      {
        label: 'Scaled dot-product attention',
        formula: 'Attention(Q, K, V) = softmax(Q Kᵀ / √d_k) V',
      },
      {
        label: 'Multi-head',
        formula: 'MultiHead(Q, K, V) = Concat(head₁, …, head_h) W_O',
      },
    ],
  },
  'add-norm': {
    id: 'add-norm',
    title: 'Add & Norm (Residual + LayerNorm)',
    category: 'Shared',
    summary:
      'Adds the input (residual connection) to the sublayer output and applies layer normalization for stable training.',
    dimensions: [
      {
        label: 'Input x',
        shape: '(T, d_model)',
      },
      {
        label: 'Sublayer(x)',
        shape: '(T, d_model)',
      },
      {
        label: 'Output',
        shape: '(T, d_model)',
        description: 'Same shape as input; residual pathway preserves information.',
      },
    ],
    formulas: [
      {
        label: 'Residual connection',
        formula: 'z = x + Sublayer(x)',
      },
      {
        label: 'Layer normalization',
        formula: 'LayerNorm(z) = (z − μ) / √(σ² + ε) ⊙ γ + β',
        description: 'Normalize across the feature dimension for each position.',
      },
    ],
  },
  'feed-forward': {
    id: 'feed-forward',
    title: 'Position-wise Feed-Forward Network',
    category: 'Shared',
    summary:
      'Two fully-connected layers applied independently at each position: expand to d_ff, apply nonlinearity, project back to d_model.',
    dimensions: [
      {
        label: 'Input',
        shape: '(T, d_model)',
      },
      {
        label: 'Hidden layer',
        shape: `(T, d_ff) = (T, ${D_FF})`,
      },
      {
        label: 'Output',
        shape: '(T, d_model)',
      },
    ],
    formulas: [
      {
        label: 'FFN',
        formula: 'FFN(x) = max(0, x W₁ + b₁) W₂ + b₂',
        description: 'ReLU nonlinearity in the original paper.',
      },
    ],
  },
  'encoder-decoder-attn': {
    id: 'encoder-decoder-attn',
    title: 'Encoder–Decoder (Cross) Attention',
    category: 'Decoder',
    summary:
      'Decoder queries attend over encoder outputs (keys/values), letting each target position condition on the whole source sentence.',
    dimensions: [
      {
        label: 'Decoder queries Q_dec',
        shape: `(T_tgt, d_model) = (${T_TGT}, ${D_MODEL})`,
      },
      {
        label: 'Encoder keys/values K_enc, V_enc',
        shape: `(T_src, d_model) = (${T_SRC}, ${D_MODEL})`,
      },
      {
        label: 'Attention weights',
        shape: `(h, T_tgt, T_src) with h = ${NUM_HEADS}`,
      },
      {
        label: 'Output',
        shape: '(T_tgt, d_model)',
      },
    ],
    formulas: [
      {
        label: 'Cross-attention',
        formula: 'Attention(Q_dec, K_enc, V_enc) = softmax(Q_dec K_encᵀ / √d_k) V_enc',
      },
    ],
  },
  'output-projection': {
    id: 'output-projection',
    title: 'Output Linear + Softmax',
    category: 'Decoder',
    summary:
      'Projects decoder hidden states into vocabulary logits and applies a softmax to obtain next-token probabilities.',
    dimensions: [
      {
        label: 'Decoder hidden states H',
        shape: `(T_tgt, d_model) = (${T_TGT}, ${D_MODEL})`,
      },
      {
        label: 'Output projection W_o',
        shape: `(d_model, V) = (${D_MODEL}, ${VOCAB_SIZE})`,
      },
      {
        label: 'Logits',
        shape: `(T_tgt, V) = (${T_TGT}, ${VOCAB_SIZE})`,
      },
      {
        label: 'Probabilities',
        shape: `(T_tgt, V)`,
        description: 'Row-wise softmax over vocabulary dimension.',
      },
    ],
    formulas: [
      {
        label: 'Logits',
        formula: 'z_t = W_o h_t + b_o',
      },
      {
        label: 'Softmax',
        formula: 'P(y_t = k | ·) = exp(z_{t,k}) / Σ_j exp(z_{t,j})',
      },
    ],
  },
}

// === Layout constants ===

const ARCH_WIDTH = 1280
const ARCH_HEIGHT = 520
const ROW_X_START = 80
const BLOCK_WIDTH = 120
const BLOCK_HEIGHT = 64
const H_SPACING = 26
const ENCODER_ROW_Y = 140
const DECODER_ROW_Y = 340

interface BlockSpec {
  id: string
  label: string
  componentId?: TransformerComponentId
  shapeLabel?: string
}

// One encoder layer (top row)
const ENCODER_BLOCK_SPECS: BlockSpec[] = [
  {
    id: 'enc-input-embed',
    label: 'Input Embedding + PosEnc',
    componentId: 'input-embedding',
    shapeLabel: `src: ${T_SRC} × ${D_MODEL}`,
  },
  {
    id: 'enc-self-attn',
    label: 'Self-Attention (enc)',
    componentId: 'multihead-self-attn',
    shapeLabel: `${T_SRC} × ${D_MODEL} → ${T_SRC} × ${D_MODEL}`,
  },
  {
    id: 'enc-addnorm1',
    label: 'Add & Norm',
    componentId: 'add-norm',
    shapeLabel: `${T_SRC} × ${D_MODEL}`,
  },
  {
    id: 'enc-ffn',
    label: 'Feed-Forward',
    componentId: 'feed-forward',
    shapeLabel: `${T_SRC} × ${D_MODEL} → ${T_SRC} × ${D_MODEL}`,
  },
  {
    id: 'enc-addnorm2',
    label: 'Add & Norm',
    componentId: 'add-norm',
    shapeLabel: `${T_SRC} × ${D_MODEL}`,
  },
]

// One decoder layer (bottom row)
const DECODER_BLOCK_SPECS: BlockSpec[] = [
  {
    id: 'dec-input-embed',
    label: 'Target Embedding + PosEnc',
    componentId: 'input-embedding',
    shapeLabel: `tgt: ${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'dec-self-attn',
    label: 'Masked Self-Attention',
    componentId: 'multihead-self-attn',
    shapeLabel: `${T_TGT} × ${D_MODEL} → ${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'dec-addnorm1',
    label: 'Add & Norm',
    componentId: 'add-norm',
    shapeLabel: `${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'dec-cross-attn',
    label: 'Encoder–Decoder Attention',
    componentId: 'encoder-decoder-attn',
    shapeLabel: `Q: ${T_TGT} × ${D_MODEL}, K,V: ${T_SRC} × ${D_MODEL}`,
  },
  {
    id: 'dec-addnorm2',
    label: 'Add & Norm',
    componentId: 'add-norm',
    shapeLabel: `${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'dec-ffn',
    label: 'Feed-Forward',
    componentId: 'feed-forward',
    shapeLabel: `${T_TGT} × ${D_MODEL} → ${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'dec-addnorm3',
    label: 'Add & Norm',
    componentId: 'add-norm',
    shapeLabel: `${T_TGT} × ${D_MODEL}`,
  },
  {
    id: 'output-projection',
    label: 'Linear + Softmax',
    componentId: 'output-projection',
    shapeLabel: `${T_TGT} × ${VOCAB_SIZE}`,
  },
]

// Build concrete block layout
const DIAGRAM_BLOCKS: DiagramBlock[] = [
  ...ENCODER_BLOCK_SPECS.map((spec, index) => ({
    id: spec.id,
    label: spec.label,
    componentId: spec.componentId,
    role: 'encoder' as BlockRole,
    row: 'encoder' as const,
    x: ROW_X_START + index * (BLOCK_WIDTH + H_SPACING),
    y: ENCODER_ROW_Y,
    width: BLOCK_WIDTH,
    height: BLOCK_HEIGHT,
    shapeLabel: spec.shapeLabel,
  })),
  ...DECODER_BLOCK_SPECS.map((spec, index) => {
    let role: BlockRole = 'decoder'
    if (spec.id === 'dec-cross-attn') role = 'attention'
    if (spec.id === 'output-projection') role = 'io'
    return {
      id: spec.id,
      label: spec.label,
      componentId: spec.componentId,
      role,
      row: 'decoder' as const,
      x: ROW_X_START + index * (BLOCK_WIDTH + H_SPACING),
      y: DECODER_ROW_Y,
      width: BLOCK_WIDTH,
      height: BLOCK_HEIGHT,
      shapeLabel: spec.shapeLabel,
    }
  }),
]

// Fast lookup by id
const BLOCK_INDEX: Record<string, DiagramBlock> = DIAGRAM_BLOCKS.reduce(
  (acc, block) => {
    acc[block.id] = block
    return acc
  },
  {} as Record<string, DiagramBlock>,
)

// Order of blocks for arrows
const ENCODER_ORDER = ENCODER_BLOCK_SPECS.map((s) => s.id)
const DECODER_ORDER = DECODER_BLOCK_SPECS.map((s) => s.id)

// Stages for the token animation
const TOKEN_STAGES: TokenStage[] = [
  {
    id: 'stage-src-embed',
    label: 'Source token → embedding + positional encoding',
    blockId: 'enc-input-embed',
  },
  {
    id: 'stage-enc-self-attn',
    label: 'Encoder self-attention over all source positions',
    blockId: 'enc-self-attn',
  },
  {
    id: 'stage-enc-addnorm1',
    label: 'Residual + layer norm after encoder attention',
    blockId: 'enc-addnorm1',
  },
  {
    id: 'stage-enc-ffn',
    label: 'Encoder feed-forward transformation',
    blockId: 'enc-ffn',
  },
  {
    id: 'stage-enc-addnorm2',
    label: 'Encoder output (residual + layer norm)',
    blockId: 'enc-addnorm2',
  },
  {
    id: 'stage-tgt-embed',
    label: 'Target token → embedding + positional encoding',
    blockId: 'dec-input-embed',
  },
  {
    id: 'stage-dec-self-attn',
    label: 'Masked self-attention over target prefix',
    blockId: 'dec-self-attn',
  },
  {
    id: 'stage-dec-addnorm1',
    label: 'Residual + norm after decoder self-attention',
    blockId: 'dec-addnorm1',
  },
  {
    id: 'stage-cross-attn',
    label: 'Encoder–decoder attention (queries from decoder, keys/values from encoder)',
    blockId: 'dec-cross-attn',
  },
  {
    id: 'stage-dec-addnorm2',
    label: 'Residual + norm after cross-attention',
    blockId: 'dec-addnorm2',
  },
  {
    id: 'stage-dec-ffn',
    label: 'Decoder feed-forward transformation',
    blockId: 'dec-ffn',
  },
  {
    id: 'stage-dec-addnorm3',
    label: 'Final decoder residual + norm',
    blockId: 'dec-addnorm3',
  },
  {
    id: 'stage-output',
    label: 'Linear projection + softmax → next-token distribution',
    blockId: 'output-projection',
  },
]

// Compute animated token position along the path (using d3 interpolate)
function getTokenPosition(progress: number) {
  const stages = TOKEN_STAGES
  if (stages.length === 0) {
    return {
      x: 0,
      y: 0,
      stageIndex: 0,
      stage: stages[0],
    }
  }
  const clamped = Math.max(0, Math.min(progress, 1))
  const segmentCount = stages.length - 1

  if (segmentCount <= 0) {
    const onlyStage = stages[0]
    const block = BLOCK_INDEX[onlyStage.blockId]
    const cx = block.x + block.width / 2
    const cy = block.y + block.height / 2
    return {
      x: cx,
      y: cy,
      stageIndex: 0,
      stage: onlyStage,
    }
  }

  const scaled = clamped * segmentCount
  const i = Math.min(Math.floor(scaled), segmentCount - 1)
  const localT = scaled - i

  const fromStage = stages[i]
  const toStage = stages[i + 1]

  const fromBlock = BLOCK_INDEX[fromStage.blockId]
  const toBlock = BLOCK_INDEX[toStage.blockId]

  const fromX = fromBlock.x + fromBlock.width / 2
  const fromY = fromBlock.y + fromBlock.height / 2
  const toX = toBlock.x + toBlock.width / 2
  const toY = toBlock.y + toBlock.height / 2

  const x = interpolateNumber(fromX, toX)(localT)
  const y = interpolateNumber(fromY, toY)(localT)

  const stageIndex = clamped === 1 ? stages.length - 1 : i
  const stage = stages[stageIndex]

  return { x, y, stageIndex, stage }
}

// === Mini diagrams for drill-down views ===

function ComponentMiniDiagram({ componentId }: { componentId: TransformerComponentId }) {
  switch (componentId) {
    case 'input-embedding':
      return (
        <svg
          viewBox="0 0 420 150"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={150}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />
          {/* Token IDs */}
          <rect
            x={24}
            y={60}
            width={80}
            height={40}
            rx={8}
            fill={COLORS.ioFill}
            stroke={COLORS.ioStroke}
          />
          <text x={64} y={83} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            token IDs
          </text>

          {/* Embedding matrix */}
          <rect
            x={140}
            y={30}
            width={90}
            height={40}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={185} y={54} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            W_e
          </text>
          {/* Lookup arrow */}
          <line
            x1={104}
            y1={80}
            x2={140}
            y2={50}
            stroke={COLORS.encoderStroke}
            strokeWidth={1.5}
            markerEnd="url(#mini-arrow-teal)"
          />

          {/* Embeddings */}
          <rect
            x={255}
            y={30}
            width={90}
            height={40}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={300} y={47} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            embeddings
          </text>
          <text x={300} y={62} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            (T, d_model)
          </text>
          <line
            x1={230}
            y1={50}
            x2={255}
            y2={50}
            stroke={COLORS.encoderStroke}
            strokeWidth={1.5}
            markerEnd="url(#mini-arrow-teal)"
          />

          {/* Positional encoding */}
          <rect
            x={255}
            y={90}
            width={90}
            height={40}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={300} y={107} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            PE(pos)
          </text>
          <text x={300} y={122} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            sin / cos
          </text>

          {/* Plus and output */}
          <text x={355} y={80} fontSize={18} fill={COLORS.textMain}>
            +
          </text>
          <line
            x1={348}
            y1={80}
            x2={380}
            y2={80}
            stroke={COLORS.encoderStroke}
            strokeWidth={1.5}
            markerEnd="url(#mini-arrow-teal)"
          />
          <text x={388} y={74} fontSize={10} fill={COLORS.textMuted} textAnchor="start">
            E + PE
          </text>

          <defs>
            <marker
              id="mini-arrow-teal"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.encoderStroke} />
            </marker>
          </defs>
        </svg>
      )
    case 'multihead-self-attn':
      return (
        <svg
          viewBox="0 0 420 180"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={180}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />

          {/* Input */}
          <rect
            x={20}
            y={68}
            width={80}
            height={44}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={60} y={88} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            X
          </text>
          <text x={60} y={102} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            (T, d_model)
          </text>

          {/* Q, K, V */}
          {['Q', 'K', 'V'].map((name, i) => {
            const y = 24 + i * 44
            return (
              <g key={name}>
                <rect
                  x={140}
                  y={y}
                  width={64}
                  height={32}
                  rx={6}
                  fill={COLORS.attentionFill}
                  stroke={COLORS.attentionStroke}
                />
                <text
                  x={172}
                  y={y + 20}
                  textAnchor="middle"
                  fill={COLORS.textMain}
                  fontSize={11}
                >
                  {name}
                </text>
                <line
                  x1={100}
                  y1={90}
                  x2={140}
                  y2={y + 16}
                  stroke={COLORS.attentionStroke}
                  strokeWidth={1.4}
                  markerEnd="url(#mini-arrow-purple)"
                />
              </g>
            )
          })}

          {/* Heads */}
          <rect
            x={230}
            y={24}
            width={70}
            height={120}
            rx={10}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.attentionStroke}
            strokeDasharray="4 3"
          />
          {[0, 1, 2].map((i) => (
            <rect
              key={i}
              x={238}
              y={34 + i * 32}
              width={54}
              height={24}
              rx={6}
              fill={COLORS.attentionFill}
              stroke={COLORS.attentionStroke}
            />
          ))}
          <text
            x={265}
            y={140}
            textAnchor="middle"
            fill={COLORS.textMuted}
            fontSize={10}
          >
            h heads
          </text>

          {/* Attn + concat */}
          <rect
            x={320}
            y={48}
            width={80}
            height={44}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={360} y={69} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            softmax
          </text>
          <text x={360} y={84} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            QKᵀ / √d_k
          </text>
          <rect
            x={320}
            y={104}
            width={80}
            height={40}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={360} y={125} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            concat + W_O
          </text>
          <text x={360} y={140} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            (T, d_model)
          </text>

          <line
            x1={300}
            y1={84}
            x2={320}
            y2={84}
            stroke={COLORS.attentionStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-purple)"
          />

          <defs>
            <marker
              id="mini-arrow-purple"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.attentionStroke} />
            </marker>
          </defs>
        </svg>
      )
    case 'add-norm':
      return (
        <svg
          viewBox="0 0 420 150"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={150}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />
          {/* x */}
          <rect
            x={32}
            y={40}
            width={100}
            height={40}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={82} y={64} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            x
          </text>

          {/* Sublayer(x) */}
          <rect
            x={32}
            y={92}
            width={100}
            height={40}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={82} y={116} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            Sublayer(x)
          </text>

          {/* Plus */}
          <circle
            cx={190}
            cy={80}
            r={18}
            fill={COLORS.chipBg}
            stroke={COLORS.borderStrong}
          />
          <text x={190} y={84} textAnchor="middle" fill={COLORS.textMain} fontSize={18}>
            +
          </text>

          <line
            x1={132}
            y1={60}
            x2={172}
            y2={72}
            stroke={COLORS.encoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-addnorm)"
          />
          <line
            x1={132}
            y1={112}
            x2={172}
            y2={88}
            stroke={COLORS.decoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-addnorm)"
          />

          {/* LayerNorm */}
          <rect
            x={230}
            y={48}
            width={140}
            height={64}
            rx={12}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={300} y={74} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            LayerNorm
          </text>
          <text x={300} y={92} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            per position, over d_model
          </text>

          <line
            x1={208}
            y1={80}
            x2={230}
            y2={80}
            stroke={COLORS.attentionStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-addnorm)"
          />

          <defs>
            <marker
              id="mini-arrow-addnorm"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.attentionStroke} />
            </marker>
          </defs>
        </svg>
      )
    case 'feed-forward':
      return (
        <svg
          viewBox="0 0 420 150"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={150}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />

          {/* Input */}
          <rect
            x={24}
            y={52}
            width={90}
            height={46}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={69} y={74} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            x
          </text>
          <text x={69} y={90} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            (T, d_model)
          </text>

          {/* Linear 1 */}
          <rect
            x={140}
            y={32}
            width={110}
            height={40}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={195} y={56} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            W₁, b₁
          </text>
          <text x={195} y={70} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            d_model → d_ff
          </text>

          {/* ReLU */}
          <rect
            x={140}
            y={84}
            width={110}
            height={32}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={195} y={104} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            ReLU
          </text>

          {/* Linear 2 */}
          <rect
            x={280}
            y={52}
            width={110}
            height={46}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={335} y={74} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            W₂, b₂
          </text>
          <text x={335} y={90} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            d_ff → d_model
          </text>

          <line
            x1={114}
            y1={75}
            x2={140}
            y2={52}
            stroke={COLORS.decoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-ffn)"
          />
          <line
            x1={195}
            y1={72}
            x2={195}
            y2={84}
            stroke={COLORS.attentionStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-ffn)"
          />
          <line
            x1={250}
            y1={100}
            x2={280}
            y2={75}
            stroke={COLORS.decoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-ffn)"
          />

          <defs>
            <marker
              id="mini-arrow-ffn"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.decoderStroke} />
            </marker>
          </defs>
        </svg>
      )
    case 'encoder-decoder-attn':
      return (
        <svg
          viewBox="0 0 420 180"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={180}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />

          {/* Encoder memory */}
          <rect
            x={24}
            y={32}
            width={120}
            height={44}
            rx={8}
            fill={COLORS.encoderFill}
            stroke={COLORS.encoderStroke}
          />
          <text x={84} y={52} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            encoder outputs
          </text>
          <text x={84} y={67} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            (T_src, d_model)
          </text>

          {/* Decoder hidden */}
          <rect
            x={24}
            y={104}
            width={120}
            height={44}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={84} y={124} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            decoder state
          </text>
          <text x={84} y={139} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            (T_tgt, d_model)
          </text>

          {/* Q from decoder */}
          <rect
            x={180}
            y={104}
            width={70}
            height={32}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={215} y={124} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            Q_dec
          </text>

          {/* K,V from encoder */}
          <rect
            x={180}
            y={32}
            width={70}
            height={32}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={215} y={52} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            K_enc
          </text>
          <rect
            x={180}
            y={68}
            width={70}
            height={32}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={215} y={88} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            V_enc
          </text>

          {/* Attention box */}
          <rect
            x={280}
            y={48}
            width={120}
            height={72}
            rx={12}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={340} y={72} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            cross-attention
          </text>
          <text x={340} y={89} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            softmax(Q_dec K_encᵀ / √d_k)
          </text>

          <line
            x1={144}
            y1={124}
            x2={180}
            y2={120}
            stroke={COLORS.decoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-cross)"
          />
          <line
            x1={144}
            y1={54}
            x2={180}
            y2={48}
            stroke={COLORS.encoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-cross)"
          />
          <line
            x1={250}
            y1={64}
            x2={280}
            y2={84}
            stroke={COLORS.attentionStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-cross)"
          />

          <defs>
            <marker
              id="mini-arrow-cross"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.attentionStroke} />
            </marker>
          </defs>
        </svg>
      )
    case 'output-projection':
      return (
        <svg
          viewBox="0 0 420 150"
          style={{ width: '100%', maxWidth: 420, marginTop: '1rem' }}
        >
          <rect
            x={0}
            y={0}
            width={420}
            height={150}
            rx={16}
            fill="rgba(15,23,42,0.9)"
            stroke={COLORS.borderSoft}
          />
          {/* Hidden state */}
          <rect
            x={24}
            y={52}
            width={120}
            height={44}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={84} y={72} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            h_t
          </text>
          <text x={84} y={88} textAnchor="middle" fill={COLORS.textMuted} fontSize={10}>
            (d_model)
          </text>

          {/* Linear */}
          <rect
            x={170}
            y={36}
            width={100}
            height={40}
            rx={8}
            fill={COLORS.decoderFill}
            stroke={COLORS.decoderStroke}
          />
          <text x={220} y={60} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            W_o, b_o
          </text>
          <text x={220} y={74} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            d_model → V
          </text>

          {/* Softmax */}
          <rect
            x={170}
            y={86}
            width={100}
            height={44}
            rx={8}
            fill={COLORS.attentionFill}
            stroke={COLORS.attentionStroke}
          />
          <text x={220} y={108} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            softmax
          </text>
          <text x={220} y={123} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            over vocabulary
          </text>

          {/* Output distribution */}
          <rect
            x={300}
            y={52}
            width={100}
            height={44}
            rx={8}
            fill={COLORS.ioFill}
            stroke={COLORS.ioStroke}
          />
          <text x={350} y={72} textAnchor="middle" fill={COLORS.textMain} fontSize={11}>
            P(y_t | ·)
          </text>
          <text x={350} y={88} textAnchor="middle" fill={COLORS.textMuted} fontSize={9}>
            (V)
          </text>

          <line
            x1={144}
            y1={74}
            x2={170}
            y2={56}
            stroke={COLORS.decoderStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-out)"
          />
          <line
            x1={220}
            y1={76}
            x2={220}
            y2={86}
            stroke={COLORS.attentionStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-out)"
          />
          <line
            x1={270}
            y1={108}
            x2={300}
            y2={74}
            stroke={COLORS.ioStroke}
            strokeWidth={1.4}
            markerEnd="url(#mini-arrow-out)"
          />

          <defs>
            <marker
              id="mini-arrow-out"
              markerWidth="10"
              markerHeight="10"
              refX="9"
              refY="5"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <path d="M0,0 L10,5 L0,10 z" fill={COLORS.ioStroke} />
            </marker>
          </defs>
        </svg>
      )
    default:
      return null
  }
}

// === Main component ===

export default function TransformerMasterDiagram() {
  const [focus, setFocus] = useState<FocusTarget>({ kind: 'overview' })
  const [showShapes, setShowShapes] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0) // 0..1
  const [speed, setSpeed] = useState(1) // multiplier
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const containerRef = useRef<HTMLDivElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastTimestampRef = useRef<number | null>(null)

  // Animation loop for the token
  useEffect(() => {
    if (!isPlaying) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastTimestampRef.current = null
      return
    }

    const totalDurationMs = 12000 / speed // 12s default, scaled by speed

    const step = (timestamp: number) => {
      if (lastTimestampRef.current == null) {
        lastTimestampRef.current = timestamp
        animationFrameRef.current = requestAnimationFrame(step)
        return
      }
      const delta = timestamp - lastTimestampRef.current
      lastTimestampRef.current = timestamp

      setProgress((prev) => {
        const next = prev + delta / totalDurationMs
        if (next >= 1) {
          // Stop at the end
          setIsPlaying(false)
          return 1
        }
        return next
      })

      animationFrameRef.current = requestAnimationFrame(step)
    }

    animationFrameRef.current = requestAnimationFrame(step)
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      lastTimestampRef.current = null
    }
  }, [isPlaying, speed])

  const tokenState = useMemo(() => getTokenPosition(progress), [progress])
  const activeStage = tokenState.stage
  const activeBlockId = activeStage.blockId

  const handleBlockClick = (block: DiagramBlock) => {
    if (block.componentId) {
      setFocus({ kind: 'component', componentId: block.componentId })
    }
  }

  const handleBlockMouseEnter = (
    block: DiagramBlock,
    evt: ReactMouseEvent<SVGGElement>,
  ) => {
    if (!block.componentId) return
    const meta = COMPONENT_METADATA[block.componentId]
    if (!meta) return
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return

    const content = meta.formulas
      .map((f) => `${f.label}: ${f.formula}`)
      .join('\n')

    setTooltip({
      x: evt.clientX - containerRect.left + 12,
      y: evt.clientY - containerRect.top + 12,
      content,
    })
  }

  const handleBlockMouseMove = (
    block: DiagramBlock,
    evt: ReactMouseEvent<SVGGElement>,
  ) => {
    if (!block.componentId || !tooltip) return
    const containerRect = containerRef.current?.getBoundingClientRect()
    if (!containerRect) return
    setTooltip((prev) =>
      prev
        ? {
            ...prev,
            x: evt.clientX - containerRect.left + 12,
            y: evt.clientY - containerRect.top + 12,
          }
        : prev,
    )
  }

  const handleBlockMouseLeave = () => {
    setTooltip(null)
  }

  const resetAnimation = () => {
    setProgress(0)
    setIsPlaying(false)
  }

  const overviewActive = focus.kind === 'overview'

  // Detail panel content (overview or component drill-down)
  const renderDetailPanel = () => {
    if (focus.kind === 'overview') {
      return (
        <div style={styles.detailPanel}>
          <div style={styles.breadcrumbsRow}>
            <span style={styles.breadcrumbActive}>Transformer (overview)</span>
          </div>
          <h2 style={styles.detailTitle}>Encoder–Decoder Transformer</h2>
          <p style={styles.detailText}>
            This diagram shows one encoder layer and one decoder layer from the original
            “Attention Is All You Need” Transformer. The top row is the encoder, the
            bottom row is the decoder, and the purple block links them via cross-attention.
          </p>
          <ul style={styles.detailList}>
            <li>
              <span style={styles.listLabel}>Click any block</span> to zoom into that
              component.
            </li>
            <li>
              <span style={styles.listLabel}>Hover blocks</span> to see key formulas.
            </li>
            <li>
              <span style={styles.listLabel}>Play the animation</span> to follow a single
              token as it flows through the whole network.
            </li>
          </ul>
          <div style={styles.detailSection}>
            <h3 style={styles.detailSectionTitle}>Default hyperparameters</h3>
            <div style={styles.detailGrid}>
              <div>
                <div style={styles.detailLabel}>d_model</div>
                <div style={styles.detailValue}>{D_MODEL}</div>
              </div>
              <div>
                <div style={styles.detailLabel}>d_ff</div>
                <div style={styles.detailValue}>{D_FF}</div>
              </div>
              <div>
                <div style={styles.detailLabel}>Heads (h)</div>
                <div style={styles.detailValue}>{NUM_HEADS}</div>
              </div>
              <div>
                <div style={styles.detailLabel}>d_k = d_model / h</div>
                <div style={styles.detailValue}>{D_K}</div>
              </div>
              <div>
                <div style={styles.detailLabel}>Source length (T_src)</div>
                <div style={styles.detailValue}>{T_SRC}</div>
              </div>
              <div>
                <div style={styles.detailLabel}>Target length (T_tgt)</div>
                <div style={styles.detailValue}>{T_TGT}</div>
              </div>
            </div>
          </div>
        </div>
      )
    }

    const meta = COMPONENT_METADATA[focus.componentId]

    return (
      <div style={styles.detailPanel}>
        <div style={styles.breadcrumbsRow}>
          <button
            type="button"
            style={styles.breadcrumbLink}
            onClick={() => setFocus({ kind: 'overview' })}
          >
            Transformer
          </button>
          <span style={styles.breadcrumbSeparator}>/</span>
          <span style={styles.breadcrumbDim}>{meta.category}</span>
          <span style={styles.breadcrumbSeparator}>/</span>
          <span style={styles.breadcrumbActive}>{meta.title}</span>
        </div>
        <h2 style={styles.detailTitle}>{meta.title}</h2>
        <p style={styles.detailText}>{meta.summary}</p>

        <ComponentMiniDiagram componentId={meta.id} />

        <div style={styles.detailSection}>
          <h3 style={styles.detailSectionTitle}>Tensor shapes</h3>
          <table style={styles.detailTable as CSSProperties}>
            <thead>
              <tr>
                <th style={styles.tableHeaderCell}>Stage</th>
                <th style={styles.tableHeaderCell}>Shape</th>
                <th style={styles.tableHeaderCell}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {meta.dimensions.map((dim) => (
                <tr key={dim.label}>
                  <td style={styles.tableCellLabel}>{dim.label}</td>
                  <td style={styles.tableCellShape}>{dim.shape}</td>
                  <td style={styles.tableCellNotes}>
                    {dim.description ?? <span style={styles.muted}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={styles.detailSection}>
          <h3 style={styles.detailSectionTitle}>Key formulas</h3>
          <ul style={styles.formulaList}>
            {meta.formulas.map((f) => (
              <li key={f.label} style={styles.formulaItem}>
                <div style={styles.formulaLabel}>{f.label}</div>
                <div style={styles.formulaBody}>{f.formula}</div>
                {f.description && (
                  <div style={styles.formulaDescription}>{f.description}</div>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  const tokenStageLabel = `${tokenState.stageIndex + 1}/${TOKEN_STAGES.length}: ${
    activeStage.label
  }`

  return (
    <div ref={containerRef} style={styles.root}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>Transformer Architecture Explorer</h1>
          <p style={styles.subtitle}>
            Full encoder–decoder layout from “Attention Is All You Need”, with clickable
            components and a token-level data flow animation.
          </p>
        </div>
        <div style={styles.legend}>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendSwatch, background: COLORS.encoderFill }} />
            <span style={styles.legendLabel}>Encoder (teal)</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendSwatch, background: COLORS.decoderFill }} />
            <span style={styles.legendLabel}>Decoder (orange)</span>
          </div>
          <div style={styles.legendRow}>
            <span style={{ ...styles.legendSwatch, background: COLORS.attentionFill }} />
            <span style={styles.legendLabel}>Attention (purple)</span>
          </div>
        </div>
      </div>

      <div style={styles.controlsRow}>
        <div style={styles.controlsLeft}>
          <button
            type="button"
            onClick={() => setIsPlaying((p) => !p)}
            style={styles.controlButton}
          >
            {isPlaying ? 'Pause token flow' : progress >= 1 ? 'Replay token flow' : 'Play token flow'}
          </button>
          <button type="button" onClick={resetAnimation} style={styles.controlButtonGhost}>
            Reset
          </button>
          <div style={styles.sliderGroup}>
            <label style={styles.sliderLabel}>
              Speed ×{speed.toFixed(1)}
              <input
                type="range"
                min={0.5}
                max={2}
                step={0.1}
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                style={styles.sliderInput}
              />
            </label>
          </div>
        </div>
        <div style={styles.controlsRight}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={showShapes}
              onChange={(e) => setShowShapes(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show tensor shapes
          </label>
          <div style={styles.stageLabel}>{tokenStageLabel}</div>
        </div>
      </div>

      <div style={styles.mainLayout}>
        <div style={styles.diagramPanel}>
          <svg
            viewBox={`0 0 ${ARCH_WIDTH} ${ARCH_HEIGHT}`}
            style={{ width: '100%', height: '100%', display: 'block', borderRadius: 16 }}
          >
            <defs>
              {/* Arrowheads */}
              <marker
                id="arrow-encoder"
                markerWidth="12"
                markerHeight="12"
                refX="10"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L12,6 L0,12 z" fill={COLORS.encoderStroke} />
              </marker>
              <marker
                id="arrow-decoder"
                markerWidth="12"
                markerHeight="12"
                refX="10"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L12,6 L0,12 z" fill={COLORS.decoderStroke} />
              </marker>
              <marker
                id="arrow-attn"
                markerWidth="12"
                markerHeight="12"
                refX="10"
                refY="6"
                orient="auto"
                markerUnits="strokeWidth"
              >
                <path d="M0,0 L12,6 L0,12 z" fill={COLORS.attentionStroke} />
              </marker>
            </defs>

            {/* Background */}
            <rect
              x={0}
              y={0}
              width={ARCH_WIDTH}
              height={ARCH_HEIGHT}
              fill={COLORS.background}
              rx={24}
            />

            {/* Encoder area background */}
            <rect
              x={40}
              y={ENCODER_ROW_Y - 80}
              width={ARCH_WIDTH - 80}
              height={140}
              rx={20}
              fill="rgba(15,118,110,0.18)"
              stroke="rgba(45,212,191,0.35)"
            />
            <text
              x={60}
              y={ENCODER_ROW_Y - 52}
              fill={COLORS.textMain}
              fontSize={14}
              fontWeight={600}
            >
              Encoder (× 6 layers)
            </text>

            {/* Decoder area background */}
            <rect
              x={40}
              y={DECODER_ROW_Y - 80}
              width={ARCH_WIDTH - 80}
              height={160}
              rx={20}
              fill="rgba(194,65,12,0.18)"
              stroke="rgba(251,146,60,0.45)"
            />
            <text
              x={60}
              y={DECODER_ROW_Y - 52}
              fill={COLORS.textMain}
              fontSize={14}
              fontWeight={600}
            >
              Decoder (× 6 layers, masked self-attn + cross-attn)
            </text>

            {/* Encoder arrows */}
            {ENCODER_ORDER.slice(0, -1).map((fromId, idx) => {
              const toId = ENCODER_ORDER[idx + 1]
              const from = BLOCK_INDEX[fromId]
              const to = BLOCK_INDEX[toId]
              const x1 = from.x + from.width
              const y1 = from.y + from.height / 2
              const x2 = to.x
              const y2 = to.y + to.height / 2
              return (
                <line
                  key={`${fromId}->${toId}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={COLORS.encoderStroke}
                  strokeWidth={1.8}
                  markerEnd="url(#arrow-encoder)"
                  opacity={0.9}
                />
              )
            })}

            {/* Decoder arrows */}
            {DECODER_ORDER.slice(0, -1).map((fromId, idx) => {
              const toId = DECODER_ORDER[idx + 1]
              const from = BLOCK_INDEX[fromId]
              const to = BLOCK_INDEX[toId]
              const x1 = from.x + from.width
              const y1 = from.y + from.height / 2
              const x2 = to.x
              const y2 = to.y + to.height / 2
              const role =
                fromId === 'dec-cross-attn' || toId === 'dec-cross-attn'
                  ? 'attention'
                  : 'decoder'
              const stroke =
                role === 'attention' ? COLORS.attentionStroke : COLORS.decoderStroke
              const marker =
                role === 'attention' ? 'url(#arrow-attn)' : 'url(#arrow-decoder)'
              return (
                <line
                  key={`${fromId}->${toId}`}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={stroke}
                  strokeWidth={1.8}
                  markerEnd={marker}
                  opacity={0.9}
                />
              )
            })}

            {/* Cross-attention arrow from encoder output to decoder cross-attn */}
            {(() => {
              const encOut = BLOCK_INDEX['enc-addnorm2']
              const cross = BLOCK_INDEX['dec-cross-attn']
              const x1 = encOut.x + encOut.width / 2
              const y1 = encOut.y + encOut.height + 10
              const x2 = cross.x + cross.width / 2
              const y2 = cross.y - 10
              const midY = (y1 + y2) / 2
              const pathD = `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
              return (
                <path
                  d={pathD}
                  stroke={COLORS.attentionStroke}
                  strokeWidth={1.8}
                  fill="none"
                  markerEnd="url(#arrow-attn)"
                  opacity={0.95}
                />
              )
            })()}

            {/* Blocks */}
            {DIAGRAM_BLOCKS.map((block) => {
              const isTokenHere = block.id === activeBlockId
              const isFocusComponent =
                focus.kind === 'component' && block.componentId === focus.componentId

              let fill = COLORS.ioFill
              let stroke = COLORS.ioStroke
              if (block.role === 'encoder') {
                fill = COLORS.encoderFill
                stroke = COLORS.encoderStroke
              } else if (block.role === 'decoder') {
                fill = COLORS.decoderFill
                stroke = COLORS.decoderStroke
              } else if (block.role === 'attention') {
                fill = COLORS.attentionFill
                stroke = COLORS.attentionStroke
              }

              const baseOpacity = overviewActive ? 0.95 : 0.8
              const opacity =
                isFocusComponent || !block.componentId
                  ? 1
                  : focus.kind === 'overview'
                  ? baseOpacity
                  : 0.35

              const strokeWidth = isTokenHere || isFocusComponent ? 2.4 : 1.4

              return (
                <g
                  key={block.id}
                  onClick={() => handleBlockClick(block)}
                  onMouseEnter={(evt) => handleBlockMouseEnter(block, evt)}
                  onMouseMove={(evt) => handleBlockMouseMove(block, evt)}
                  onMouseLeave={handleBlockMouseLeave}
                  style={{ cursor: block.componentId ? 'pointer' : 'default' }}
                >
                  <rect
                    x={block.x}
                    y={block.y}
                    rx={10}
                    ry={10}
                    width={block.width}
                    height={block.height}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={strokeWidth}
                    opacity={opacity}
                  />
                  {/* Glow for active token position */}
                  {isTokenHere && (
                    <rect
                      x={block.x - 4}
                      y={block.y - 4}
                      width={block.width + 8}
                      height={block.height + 8}
                      rx={14}
                      ry={14}
                      fill="none"
                      stroke={COLORS.attentionStroke}
                      strokeWidth={1.4}
                      strokeDasharray="4 3"
                      opacity={0.9}
                    />
                  )}
                  <text
                    x={block.x + block.width / 2}
                    y={block.y + 22}
                    textAnchor="middle"
                    fill={COLORS.textMain}
                    fontSize={12}
                    fontWeight={500}
                  >
                    {block.label}
                  </text>
                  {showShapes && block.shapeLabel && (
                    <text
                      x={block.x + block.width / 2}
                      y={block.y + block.height - 10}
                      textAnchor="middle"
                      fill={COLORS.textMuted}
                      fontSize={10}
                    >
                      {block.shapeLabel}
                    </text>
                  )}
                </g>
              )
            })}

            {/* Token (animated) */}
            <g>
              <circle
                cx={tokenState.x}
                cy={tokenState.y}
                r={10}
                fill={COLORS.tokenFill}
                stroke={COLORS.tokenStroke}
                strokeWidth={2}
              />
              <circle
                cx={tokenState.x}
                cy={tokenState.y}
                r={18}
                fill="none"
                stroke={COLORS.tokenStroke}
                strokeWidth={1}
                opacity={0.45}
              />
              <text
                x={tokenState.x}
                y={tokenState.y + 3}
                textAnchor="middle"
                fontSize={9}
                fill="#020617"
              >
                token
              </text>
            </g>
          </svg>
        </div>

        <div style={styles.detailPanelWrapper}>{renderDetailPanel()}</div>
      </div>

      {/* Tooltip for formulas */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            maxWidth: 320,
            background: 'rgba(15,23,42,0.98)',
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: 8,
            padding: '0.55rem 0.7rem',
            fontSize: 11,
            lineHeight: 1.4,
            color: COLORS.textMain,
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            boxShadow: '0 18px 50px rgba(0,0,0,0.65)',
            zIndex: 40,
          }}
        >
          {tooltip.content}
        </div>
      )}
    </div>
  )
}

// === Inline styles ===

const styles: Record<string, CSSProperties> = {
  root: {
    position: 'relative',
    background: COLORS.background,
    borderRadius: 24,
    padding: '1.5rem',
    border: `1px solid ${COLORS.borderSoft}`,
    color: COLORS.textMain,
    fontFamily:
      'system-ui, -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1.5rem',
    marginBottom: '1.25rem',
    alignItems: 'flex-start',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 650,
    margin: 0,
  },
  subtitle: {
    margin: '0.25rem 0 0',
    fontSize: 13,
    color: COLORS.textMuted,
    maxWidth: 560,
  },
  legend: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 11,
    padding: '0.5rem 0.75rem',
    borderRadius: 12,
    background: 'rgba(15,23,42,0.9)',
    border: `1px solid ${COLORS.borderSoft}`,
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 14,
    height: 10,
    borderRadius: 999,
    border: `1px solid ${COLORS.borderStrong}`,
  },
  legendLabel: {
    color: COLORS.textMuted,
  },
  controlsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '1rem',
    marginBottom: '1rem',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  controlsLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },
  controlsRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    flexWrap: 'wrap',
  },
  controlButton: {
    padding: '0.4rem 0.85rem',
    borderRadius: 999,
    border: 'none',
    background:
      'linear-gradient(to right, rgba(56,189,248,0.16), rgba(59,130,246,0.05))',
    color: COLORS.textMain,
    fontSize: 12,
    cursor: 'pointer',
    borderColor: 'transparent',
  },
  controlButtonGhost: {
    padding: '0.4rem 0.85rem',
    borderRadius: 999,
    border: `1px solid ${COLORS.borderSoft}`,
    background: 'transparent',
    color: COLORS.textMuted,
    fontSize: 12,
    cursor: 'pointer',
  },
  sliderGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sliderLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  sliderInput: {
    width: 120,
  },
  toggleLabel: {
    fontSize: 11,
    color: COLORS.textMuted,
    display: 'flex',
    alignItems: 'center',
  },
  stageLabel: {
    fontSize: 11,
    color: COLORS.textAccent,
    maxWidth: 340,
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 3.5fr) minmax(0, 2.5fr)',
    gap: '1.25rem',
    alignItems: 'stretch',
  },
  diagramPanel: {
    background: COLORS.panel,
    borderRadius: 20,
    padding: 10,
    border: `1px solid ${COLORS.panelBorder}`,
    minHeight: 360,
  },
  detailPanelWrapper: {
    minHeight: 360,
  },
  detailPanel: {
    background: COLORS.panel,
    borderRadius: 20,
    padding: '1rem 1.1rem',
    border: `1px solid ${COLORS.panelBorder}`,
    height: '100%',
    overflow: 'auto',
  },
  breadcrumbsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11,
    marginBottom: 6,
  },
  breadcrumbLink: {
    border: 'none',
    padding: 0,
    margin: 0,
    background: 'none',
    color: COLORS.textMuted,
    cursor: 'pointer',
    fontSize: 11,
  },
  breadcrumbSeparator: {
    color: COLORS.textMuted,
  },
  breadcrumbDim: {
    color: COLORS.textMuted,
  },
  breadcrumbActive: {
    color: COLORS.textMain,
    fontWeight: 500,
  },
  detailTitle: {
    margin: '0.1rem 0 0.4rem',
    fontSize: 15,
    fontWeight: 600,
  },
  detailText: {
    margin: 0,
    fontSize: 12,
    color: COLORS.textMuted,
  },
  detailList: {
    margin: '0.6rem 0 0.6rem 1.1rem',
    padding: 0,
    fontSize: 11,
    color: COLORS.textMuted,
  },
  listLabel: {
    color: COLORS.textMain,
  },
  detailSection: {
    marginTop: '0.85rem',
  },
  detailSectionTitle: {
    margin: '0 0 0.3rem',
    fontSize: 12,
    fontWeight: 600,
    color: COLORS.textMain,
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '0.45rem 0.75rem',
    fontSize: 11,
  },
  detailLabel: {
    color: COLORS.textMuted,
  },
  detailValue: {
    color: COLORS.textMain,
    fontWeight: 500,
  },
  detailTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 11,
  },
  tableHeaderCell: {
    textAlign: 'left',
    padding: '0.25rem 0.35rem',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    color: COLORS.textMuted,
    fontWeight: 500,
  },
  tableCellLabel: {
    padding: '0.25rem 0.35rem',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    whiteSpace: 'nowrap',
  },
  tableCellShape: {
    padding: '0.25rem 0.35rem',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono"',
  },
  tableCellNotes: {
    padding: '0.25rem 0.35rem',
    borderBottom: `1px solid ${COLORS.borderSoft}`,
    color: COLORS.textMuted,
  },
  muted: {
    color: COLORS.textMuted,
  },
  formulaList: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  formulaItem: {
    padding: '0.4rem 0.45rem',
    borderRadius: 10,
    border: `1px dashed ${COLORS.borderSoft}`,
    background: 'rgba(15,23,42,0.85)',
  },
  formulaLabel: {
    fontSize: 11,
    fontWeight: 600,
    marginBottom: 2,
  },
  formulaBody: {
    fontSize: 11,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono"',
  },
  formulaDescription: {
    fontSize: 10,
    color: COLORS.textMuted,
    marginTop: 2,
  },
}
