// Complete concept graph data - all 34 foundations with prereq relationships
// Used by KnowledgeGraph component for interactive exploration

export const conceptGraphData = {
  nodes: [
    // Core Training (orange)
    { id: 'ML/CE/KL', category: 'core' },

    // Optimization (green)
    { id: 'Adam', category: 'optimization' },
    { id: 'Sharpness', category: 'optimization' },
    { id: 'Double Descent', category: 'optimization' },
    { id: 'NTK', category: 'optimization' },

    // Sequence Modeling (blue)
    { id: 'Attention', category: 'sequence' },
    { id: 'RoPE', category: 'sequence' },
    { id: 'Efficient Attn', category: 'sequence' },
    { id: 'Long Context', category: 'sequence' },
    { id: 'SSMs & Hybrids', category: 'sequence' },

    // Generative Models (purple)
    { id: 'VAEs', category: 'generative' },
    { id: 'GANs', category: 'generative' },
    { id: 'Diffusion', category: 'generative' },

    // Representations (teal)
    { id: 'Embeddings', category: 'representation' },
    { id: 'Superposition', category: 'representation' },
    { id: 'Probing', category: 'representation' },
    { id: 'Circuits', category: 'representation' },

    // Mech Interp (cyan)
    { id: 'SAEs', category: 'interp' },
    { id: 'Circuit Discovery', category: 'interp' },
    { id: 'Activation Steering', category: 'interp' },

    // Scaling & RLHF (red)
    { id: 'Scaling', category: 'scaling' },
    { id: 'RLHF', category: 'scaling' },
    { id: 'DPO', category: 'scaling' },
    { id: 'KTO', category: 'scaling' },
    { id: 'Reward Hacking', category: 'scaling' },

    // Efficiency & Serving (blue)
    { id: 'Efficiency', category: 'efficiency' },
    { id: 'Spec Decode', category: 'efficiency' },
    { id: 'LLM Serving', category: 'efficiency' },
    { id: 'MoE', category: 'efficiency' },
    { id: 'MoE Serving', category: 'efficiency' },

    // Theory & Misc
    { id: 'Theory', category: 'theory' },
    { id: 'Multimodal', category: 'multimodal' },
    { id: 'Tokens', category: 'core' },
    { id: 'Decoding', category: 'efficiency' },
  ],
  links: [
    // Core → Optimization
    { source: 'Adam', target: 'Sharpness' },
    { source: 'Sharpness', target: 'Double Descent' },
    { source: 'Double Descent', target: 'NTK' },

    // Core → Sequence Modeling
    { source: 'ML/CE/KL', target: 'Attention' },
    { source: 'Attention', target: 'RoPE' },
    { source: 'Attention', target: 'Efficient Attn' },
    { source: 'RoPE', target: 'Efficient Attn' },
    { source: 'Efficient Attn', target: 'Long Context' },
    { source: 'Long Context', target: 'SSMs & Hybrids' },

    // Core → Generative
    { source: 'ML/CE/KL', target: 'VAEs' },
    { source: 'ML/CE/KL', target: 'GANs' },
    { source: 'VAEs', target: 'Diffusion' },
    { source: 'ML/CE/KL', target: 'Diffusion' },

    // Attention → Representations
    { source: 'Attention', target: 'Embeddings' },
    { source: 'Embeddings', target: 'Superposition' },
    { source: 'Embeddings', target: 'Probing' },
    { source: 'Superposition', target: 'Circuits' },
    { source: 'Probing', target: 'Circuits' },

    // Representations → Mech Interp
    { source: 'Circuits', target: 'SAEs' },
    { source: 'SAEs', target: 'Circuit Discovery' },
    { source: 'Circuit Discovery', target: 'Activation Steering' },

    // Attention → Scaling
    { source: 'Double Descent', target: 'Scaling' },
    { source: 'Attention', target: 'Scaling' },

    // Scaling → RLHF
    { source: 'ML/CE/KL', target: 'RLHF' },
    { source: 'Scaling', target: 'RLHF' },
    { source: 'RLHF', target: 'DPO' },
    { source: 'DPO', target: 'KTO' },
    { source: 'KTO', target: 'Reward Hacking' },

    // Efficiency chains
    { source: 'Sharpness', target: 'Efficiency' },
    { source: 'Diffusion', target: 'Efficiency' },
    { source: 'Attention', target: 'Spec Decode' },
    { source: 'Efficient Attn', target: 'Spec Decode' },
    { source: 'Spec Decode', target: 'LLM Serving' },
    { source: 'Attention', target: 'MoE' },
    { source: 'Efficient Attn', target: 'MoE' },
    { source: 'MoE', target: 'MoE Serving' },
    { source: 'LLM Serving', target: 'MoE Serving' },

    // Theory
    { source: 'NTK', target: 'Theory' },

    // Multimodal & Tokens
    { source: 'Attention', target: 'Multimodal' },
    { source: 'Diffusion', target: 'Multimodal' },
    { source: 'ML/CE/KL', target: 'Tokens' },
    { source: 'Embeddings', target: 'Tokens' },

    // Decoding
    { source: 'ML/CE/KL', target: 'Decoding' },
    { source: 'Attention', target: 'Decoding' },
    { source: 'Spec Decode', target: 'Decoding' },
  ]
}

// Concept ID to graph node mapping (for navigation)
export const NODE_ID_MAP: Record<string, string> = {
  'ML/CE/KL': 'maximum-likelihood',
  'Adam': 'adam',
  'Sharpness': 'loss-landscapes',
  'Double Descent': 'double-descent',
  'NTK': 'ntk',
  'Attention': 'attention-transformers',
  'RoPE': 'rope',
  'Efficient Attn': 'efficient-attention',
  'Long Context': 'long-context',
  'SSMs & Hybrids': 'ssm-hybrids',
  'VAEs': 'vaes',
  'GANs': 'gans',
  'Diffusion': 'diffusion',
  'Embeddings': 'representations',
  'Superposition': 'superposition',
  'Probing': 'probing',
  'Circuits': 'induction-heads',
  'SAEs': 'sparse-autoencoders',
  'Circuit Discovery': 'circuit-discovery',
  'Activation Steering': 'activation-steering',
  'Scaling': 'scaling-laws',
  'RLHF': 'rlhf',
  'DPO': 'dpo',
  'KTO': 'kto',
  'Reward Hacking': 'reward-hacking',
  'Efficiency': 'efficiency',
  'Spec Decode': 'speculative-decoding',
  'LLM Serving': 'llm-serving',
  'MoE': 'mixture-of-experts',
  'MoE Serving': 'moe-serving',
  'Theory': 'theory',
  'Multimodal': 'multimodal',
  'Tokens': 'tokenization-vocabulary',
  'Decoding': 'decoding-sampling',
}

// Category colors for graph nodes
export const CATEGORY_COLORS: Record<string, string> = {
  core: '#f59e0b',        // orange
  optimization: '#22c55e', // green
  sequence: '#3b82f6',     // blue
  generative: '#8b5cf6',   // purple
  representation: '#14b8a6', // teal
  interp: '#06b6d4',       // cyan
  scaling: '#ef4444',      // red
  efficiency: '#6366f1',   // indigo
  theory: '#6b7280',       // gray
  multimodal: '#ec4899',   // pink
}
