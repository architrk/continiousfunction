export type ProductGraphStatus = 'live' | 'planned'

export type ProductGraphNode = {
  id: string
  label: string
  role: string
  group: string
  status: ProductGraphStatus
  href?: string
}

export type ProductGraphEdge = {
  from: string
  to: string
  type: string
  weight: number
  why: string
}

export type ComputedGraphRoute = {
  nodes: ProductGraphNode[]
  edges: ProductGraphEdge[]
  totalWeight: number
  nextRepair?: ProductGraphNode
}

export const productGraphNodes: ProductGraphNode[] = [
  {
    id: 'attention',
    label: 'Attention',
    role: 'weighted copying',
    group: 'transformers',
    status: 'live',
    href: '/domains/attention-transformers/attention-transformers/',
  },
  {
    id: 'efficient-attention',
    label: 'Efficient Attention',
    role: 'memory pressure',
    group: 'transformers',
    status: 'live',
    href: '/domains/attention-transformers/efficient-attention/',
  },
  {
    id: 'rope',
    label: 'RoPE',
    role: 'position geometry',
    group: 'transformers',
    status: 'live',
    href: '/domains/attention-transformers/rope/',
  },
  {
    id: 'flash-attention',
    label: 'FlashAttention',
    role: 'memory movement',
    group: 'systems',
    status: 'live',
    href: '/domains/attention-transformers/flash-attention/',
  },
  {
    id: 'long-context',
    label: 'Long Context',
    role: 'stress regime',
    group: 'systems',
    status: 'live',
    href: '/domains/attention-transformers/long-context/',
  },
  {
    id: 'llm-serving',
    label: 'LLM Serving',
    role: 'runtime bottlenecks',
    group: 'systems',
    status: 'live',
    href: '/domains/llm-systems/llm-serving/',
  },
  {
    id: 'decoding',
    label: 'Decoding',
    role: 'token loop',
    group: 'systems',
    status: 'live',
    href: '/domains/llm-systems/decoding-sampling/',
  },
  {
    id: 'kv-cache-compression',
    label: 'KV Cache Compression',
    role: 'paper claim target',
    group: 'systems',
    status: 'planned',
  },
  {
    id: 'linear-transformations',
    label: 'Linear Transformations',
    role: 'matrix lens',
    group: 'linear algebra',
    status: 'live',
    href: '/domains/linear-algebra/linear-transformations/',
  },
  {
    id: 'ssm-hybrids',
    label: 'SSM Hybrids',
    role: 'fixed-state sequence models',
    group: 'frontier',
    status: 'live',
    href: '/domains/attention-transformers/ssm-hybrids/',
  },
  {
    id: 'parallel-scan',
    label: 'Parallel Scan',
    role: 'trainable recurrence',
    group: 'frontier',
    status: 'planned',
  },
  {
    id: 'state-space-duality',
    label: 'State-Space Duality',
    role: 'Mamba-style bridge',
    group: 'frontier',
    status: 'planned',
  },
  {
    id: 'maximum-likelihood',
    label: 'Maximum Likelihood',
    role: 'fit observed data',
    group: 'probability',
    status: 'live',
    href: '/domains/probability/maximum-likelihood/',
  },
  {
    id: 'cross-entropy',
    label: 'Cross-Entropy',
    role: 'classification loss',
    group: 'probability',
    status: 'live',
    href: '/domains/probability/cross-entropy/',
  },
  {
    id: 'kl-divergence',
    label: 'KL Divergence',
    role: 'reference distance',
    group: 'information theory',
    status: 'live',
    href: '/domains/information-theory/kl-divergence/',
  },
  {
    id: 'rlhf',
    label: 'RLHF',
    role: 'reward route',
    group: 'alignment',
    status: 'live',
    href: '/domains/alignment/rlhf/',
  },
  {
    id: 'dpo',
    label: 'DPO',
    role: 'direct preference route',
    group: 'alignment',
    status: 'live',
    href: '/domains/alignment/dpo/',
  },
  {
    id: 'reward-hacking',
    label: 'Reward Hacking',
    role: 'proxy failure',
    group: 'alignment',
    status: 'live',
    href: '/domains/alignment/reward-hacking/',
  },
  {
    id: 'gradient-descent',
    label: 'Gradient Descent',
    role: 'base update',
    group: 'optimization',
    status: 'live',
    href: '/domains/optimization/gradient-descent/',
  },
  {
    id: 'adam',
    label: 'Adam',
    role: 'adaptive baseline',
    group: 'optimization',
    status: 'live',
    href: '/domains/optimization/adam/',
  },
  {
    id: 'adamw',
    label: 'AdamW',
    role: 'decoupled decay',
    group: 'optimization',
    status: 'live',
    href: '/domains/optimization/weight-decay-adamw/',
  },
  {
    id: 'loss-landscapes',
    label: 'Loss Landscapes',
    role: 'step geometry',
    group: 'optimization',
    status: 'live',
    href: '/domains/optimization/loss-landscapes/',
  },
  {
    id: 'muon',
    label: 'Muon',
    role: 'orthogonalized update',
    group: 'optimization',
    status: 'live',
    href: '/concepts/optimizers/muon/',
  },
]

export const productGraphEdges: ProductGraphEdge[] = [
  {
    from: 'attention',
    to: 'efficient-attention',
    type: 'prerequisite',
    weight: 1,
    why: 'You need Q/K/V weighted copying before cache and memory optimizations are meaningful.',
  },
  {
    from: 'efficient-attention',
    to: 'long-context',
    type: 'invented to fix',
    weight: 1.05,
    why: 'Long context exposes the cost of storing and repeatedly reading all prior keys and values.',
  },
  {
    from: 'efficient-attention',
    to: 'llm-serving',
    type: 'implementation dependency',
    weight: 1.1,
    why: 'Serving systems feel attention as bandwidth, latency, and cache movement.',
  },
  {
    from: 'rope',
    to: 'long-context',
    type: 'breaks when',
    weight: 1.25,
    why: 'Position extrapolation changes attention-score geometry as context length grows.',
  },
  {
    from: 'flash-attention',
    to: 'llm-serving',
    type: 'systems tradeoff',
    weight: 1.1,
    why: 'FlashAttention preserves the math while changing how memory traffic is scheduled.',
  },
  {
    from: 'long-context',
    to: 'kv-cache-compression',
    type: 'research frontier',
    weight: 0.85,
    why: 'KV compression papers are attempts to keep long-context serving from becoming memory-bound.',
  },
  {
    from: 'llm-serving',
    to: 'kv-cache-compression',
    type: 'implementation dependency',
    weight: 0.75,
    why: 'The practical question is which decode-time memory term the paper reduces.',
  },
  {
    from: 'llm-serving',
    to: 'decoding',
    type: 'runtime loop',
    weight: 1,
    why: 'Decode-time choices determine which cached state is touched on every new token.',
  },
  {
    from: 'long-context',
    to: 'ssm-hybrids',
    type: 'same pressure',
    weight: 1.1,
    why: 'Fixed-state sequence models become attractive when KV memory grows with sequence length.',
  },
  {
    from: 'linear-transformations',
    to: 'ssm-hybrids',
    type: 'same mathematical trick',
    weight: 1.25,
    why: 'State updates are easier to read when matrices are understood as transformations.',
  },
  {
    from: 'ssm-hybrids',
    to: 'parallel-scan',
    type: 'implementation dependency',
    weight: 1.2,
    why: 'Recurrent-looking models need parallel sequence computation to train at scale.',
  },
  {
    from: 'parallel-scan',
    to: 'state-space-duality',
    type: 'paper-specific bridge',
    weight: 1.15,
    why: 'Modern Mamba-style papers often connect recurrence, convolution, and attention-like views.',
  },
  {
    from: 'maximum-likelihood',
    to: 'cross-entropy',
    type: 'prerequisite',
    weight: 0.8,
    why: 'Cross-entropy is the optimization form of likelihood for categorical predictions.',
  },
  {
    from: 'cross-entropy',
    to: 'kl-divergence',
    type: 'same mathematical trick',
    weight: 0.95,
    why: 'Both compare distributions; KL makes the reference distribution explicit.',
  },
  {
    from: 'kl-divergence',
    to: 'rlhf',
    type: 'implementation dependency',
    weight: 1,
    why: 'RLHF keeps a learned policy near a reference model with a KL anchor.',
  },
  {
    from: 'rlhf',
    to: 'dpo',
    type: 'invented to fix',
    weight: 1,
    why: 'DPO removes the separate reward-model optimization loop while preserving preference shaping.',
  },
  {
    from: 'cross-entropy',
    to: 'dpo',
    type: 'same mathematical trick',
    weight: 1.35,
    why: 'DPO can be read as a classification-style loss over preference pairs.',
  },
  {
    from: 'rlhf',
    to: 'reward-hacking',
    type: 'breaks when',
    weight: 1,
    why: 'Optimizing a learned proxy can select behavior that satisfies the proxy but misses intent.',
  },
  {
    from: 'gradient-descent',
    to: 'adam',
    type: 'prerequisite',
    weight: 0.9,
    why: 'Adam modifies the basic update with adaptive moments.',
  },
  {
    from: 'adam',
    to: 'adamw',
    type: 'invented to fix',
    weight: 0.8,
    why: 'AdamW separates weight decay from Adam-style adaptive scaling.',
  },
  {
    from: 'adamw',
    to: 'muon',
    type: 'research frontier',
    weight: 1.15,
    why: 'Muon comparisons usually ask when orthogonalized matrix updates beat AdamW-like baselines.',
  },
  {
    from: 'linear-transformations',
    to: 'muon',
    type: 'same mathematical trick',
    weight: 0.95,
    why: 'Muon treats matrix-shaped updates as geometric objects, not just parameter arrays.',
  },
  {
    from: 'gradient-descent',
    to: 'loss-landscapes',
    type: 'reframe',
    weight: 1,
    why: 'Loss landscapes explain why a step direction can help, stall, or destabilize training.',
  },
  {
    from: 'loss-landscapes',
    to: 'muon',
    type: 'motivates',
    weight: 1.2,
    why: 'Optimizer geometry matters most when the surface is curved and anisotropic.',
  },
]

export const routeKnownOptions = [
  'attention',
  'efficient-attention',
  'rope',
  'flash-attention',
  'linear-transformations',
  'cross-entropy',
  'kl-divergence',
  'gradient-descent',
  'adam',
  'adamw',
] as const

export const routeTargetOptions = ['state-space-duality', 'kv-cache-compression', 'dpo', 'reward-hacking', 'muon'] as const

const nodeById = new Map(productGraphNodes.map((node) => [node.id, node]))

export function getProductGraphNode(id: string) {
  return nodeById.get(id)
}

export function computeGraphRoute(knownIds: string[], targetId: string): ComputedGraphRoute | null {
  const known = knownIds.filter((id) => nodeById.has(id))
  const target = nodeById.get(targetId)

  if (!target || known.length === 0) {
    return null
  }

  const distances = new Map<string, number>()
  const previous = new Map<string, ProductGraphEdge>()
  const unvisited = new Set(productGraphNodes.map((node) => node.id))

  for (const node of productGraphNodes) {
    distances.set(node.id, Number.POSITIVE_INFINITY)
  }

  for (const knownId of known) {
    distances.set(knownId, 0)
  }

  while (unvisited.size > 0) {
    let current: string | undefined
    let bestDistance = Number.POSITIVE_INFINITY

    for (const id of unvisited) {
      const distance = distances.get(id) ?? Number.POSITIVE_INFINITY
      if (distance < bestDistance) {
        current = id
        bestDistance = distance
      }
    }

    if (!current || bestDistance === Number.POSITIVE_INFINITY) {
      break
    }

    if (current === targetId) {
      break
    }

    unvisited.delete(current)

    for (const edge of productGraphEdges.filter((candidate) => candidate.from === current)) {
      const nextDistance = bestDistance + edge.weight
      const existingDistance = distances.get(edge.to) ?? Number.POSITIVE_INFINITY

      if (nextDistance < existingDistance) {
        distances.set(edge.to, nextDistance)
        previous.set(edge.to, edge)
      }
    }
  }

  const totalWeight = distances.get(targetId) ?? Number.POSITIVE_INFINITY
  if (totalWeight === Number.POSITIVE_INFINITY) {
    return null
  }

  const edges: ProductGraphEdge[] = []
  let cursor = targetId

  while (!known.includes(cursor)) {
    const edge = previous.get(cursor)
    if (!edge) {
      break
    }

    edges.unshift(edge)
    cursor = edge.from
  }

  const routeIds = [cursor, ...edges.map((edge) => edge.to)]
  const nodes = routeIds.map((id) => nodeById.get(id)).filter((node): node is ProductGraphNode => Boolean(node))
  const nextRepair = nodes.find((node) => !known.includes(node.id) && node.id !== targetId)

  return {
    nodes,
    edges,
    totalWeight,
    nextRepair,
  }
}
