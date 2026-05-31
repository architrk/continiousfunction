/*
 * AUTO-GENERATED FILE. DO NOT EDIT BY HAND.
 *
 * Source: content/domains/<domain>/concepts/<concept>/viz.tsx
 * Generator: scripts/generate-content.ts
 */

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- concept demos are heterogeneous
export type ContentVizComponent = ComponentType<any>

// Map: concept id -> dynamically loaded viz component (client-only)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic() typing is clunky for heterogeneous components
export const contentConceptVizMap: Record<string, ContentVizComponent> = {
  'adam': dynamic(() => import('../domains/optimization/concepts/adam/viz'), { ssr: false }),
  'attention-transformers': dynamic(() => import('../domains/attention-transformers/concepts/attention-transformers/viz'), { ssr: false }),
  'backpropagation': dynamic(() => import('../domains/calculus/concepts/backpropagation/viz'), { ssr: false }),
  'bayesian-inference': dynamic(() => import('../domains/probability/concepts/bayesian-inference/viz'), { ssr: false }),
  'computation-graphs': dynamic(() => import('../domains/calculus/concepts/computation-graphs/viz'), { ssr: false }),
  'cross-entropy': dynamic(() => import('../domains/probability/concepts/cross-entropy/viz'), { ssr: false }),
  'decoding-sampling': dynamic(() => import('../domains/llm-systems/concepts/decoding-sampling/viz'), { ssr: false }),
  'derivatives': dynamic(() => import('../domains/calculus/concepts/derivatives/viz'), { ssr: false }),
  'diffusion': dynamic(() => import('../domains/generative-models/concepts/diffusion/viz'), { ssr: false }),
  'distributions': dynamic(() => import('../domains/probability/concepts/distributions/viz'), { ssr: false }),
  'dot-product': dynamic(() => import('../domains/linear-algebra/concepts/dot-product/viz'), { ssr: false }),
  'double-descent': dynamic(() => import('../domains/scaling/concepts/double-descent/viz'), { ssr: false }),
  'dpo': dynamic(() => import('../domains/alignment/concepts/dpo/viz'), { ssr: false }),
  'efficiency': dynamic(() => import('../domains/efficiency/concepts/efficiency/viz'), { ssr: false }),
  'efficient-attention': dynamic(() => import('../domains/attention-transformers/concepts/efficient-attention/viz'), { ssr: false }),
  'flash-attention': dynamic(() => import('../domains/attention-transformers/concepts/flash-attention/viz'), { ssr: false }),
  'flow-matching': dynamic(() => import('../domains/generative-models/concepts/flow-matching/viz'), { ssr: false }),
  'gradient-descent': dynamic(() => import('../domains/optimization/concepts/gradient-descent/viz'), { ssr: false }),
  'grouped-query-attention': dynamic(() => import('../domains/attention-transformers/concepts/grouped-query-attention/viz'), { ssr: false }),
  'kl-divergence': dynamic(() => import('../domains/information-theory/concepts/kl-divergence/viz'), { ssr: false }),
  'knowledge-distillation': dynamic(() => import('../domains/efficiency/concepts/knowledge-distillation/viz'), { ssr: false }),
  'kto': dynamic(() => import('../domains/alignment/concepts/kto/viz'), { ssr: false }),
  'layer-normalization': dynamic(() => import('../domains/attention-transformers/concepts/layer-normalization/viz'), { ssr: false }),
  'learning-rate-schedules': dynamic(() => import('../domains/optimization/concepts/learning-rate-schedules/viz'), { ssr: false }),
  'llm-serving': dynamic(() => import('../domains/llm-systems/concepts/llm-serving/viz'), { ssr: false }),
  'long-context': dynamic(() => import('../domains/attention-transformers/concepts/long-context/viz'), { ssr: false }),
  'loss-landscapes': dynamic(() => import('../domains/optimization/concepts/loss-landscapes/viz'), { ssr: false }),
  'maximum-likelihood': dynamic(() => import('../domains/probability/concepts/maximum-likelihood/viz'), { ssr: false }),
  'mixture-of-experts': dynamic(() => import('../domains/efficiency/concepts/mixture-of-experts/viz'), { ssr: false }),
  'moe-serving': dynamic(() => import('../domains/llm-systems/concepts/moe-serving/viz'), { ssr: false }),
  'normalizing-flows': dynamic(() => import('../domains/generative-models/concepts/normalizing-flows/viz'), { ssr: false }),
  'ntk': dynamic(() => import('../domains/scaling/concepts/ntk/viz'), { ssr: false }),
  'pretraining-data-mixtures': dynamic(() => import('../domains/scaling/concepts/pretraining-data-mixtures/viz'), { ssr: false }),
  'probability-basics': dynamic(() => import('../domains/probability/concepts/probability-basics/viz'), { ssr: false }),
  'process-reward-models': dynamic(() => import('../domains/alignment/concepts/process-reward-models/viz'), { ssr: false }),
  'pruning': dynamic(() => import('../domains/efficiency/concepts/pruning/viz'), { ssr: false }),
  'quantization': dynamic(() => import('../domains/efficiency/concepts/quantization/viz'), { ssr: false }),
  'random-variables': dynamic(() => import('../domains/probability/concepts/random-variables/viz'), { ssr: false }),
  'representations': dynamic(() => import('../domains/representation-learning/concepts/representations/viz'), { ssr: false }),
  'retrieval-augmented-generation': dynamic(() => import('../domains/llm-systems/concepts/retrieval-augmented-generation/viz'), { ssr: false }),
  'reverse-mode-autodiff': dynamic(() => import('../domains/calculus/concepts/reverse-mode-autodiff/viz'), { ssr: false }),
  'reward-hacking': dynamic(() => import('../domains/alignment/concepts/reward-hacking/viz'), { ssr: false }),
  'rlhf': dynamic(() => import('../domains/alignment/concepts/rlhf/viz'), { ssr: false }),
  'rope': dynamic(() => import('../domains/attention-transformers/concepts/rope/viz'), { ssr: false }),
  'scaling-laws': dynamic(() => import('../domains/scaling/concepts/scaling-laws/viz'), { ssr: false }),
  'score-matching': dynamic(() => import('../domains/generative-models/concepts/score-matching/viz'), { ssr: false }),
  'sparse-autoencoders': dynamic(() => import('../domains/representation-learning/concepts/sparse-autoencoders/viz'), { ssr: false }),
  'speculative-decoding': dynamic(() => import('../domains/llm-systems/concepts/speculative-decoding/viz'), { ssr: false }),
  'ssm-hybrids': dynamic(() => import('../domains/attention-transformers/concepts/ssm-hybrids/viz'), { ssr: false }),
  'structured-decoding': dynamic(() => import('../domains/llm-systems/concepts/structured-decoding/viz'), { ssr: false }),
  'swiglu': dynamic(() => import('../domains/attention-transformers/concepts/swiglu/viz'), { ssr: false }),
  'test-time-compute': dynamic(() => import('../domains/scaling/concepts/test-time-compute/viz'), { ssr: false }),
  'tokenization-vocabulary': dynamic(() => import('../domains/attention-transformers/concepts/tokenization-vocabulary/viz'), { ssr: false }),
  'tree-search-reasoning': dynamic(() => import('../domains/scaling/concepts/tree-search-reasoning/viz'), { ssr: false }),
  'vaes': dynamic(() => import('../domains/generative-models/concepts/vaes/viz'), { ssr: false }),
  'vector-spaces': dynamic(() => import('../domains/linear-algebra/concepts/vector-spaces/viz'), { ssr: false }),
}

export const hasContentViz = (conceptId: string): boolean => Object.prototype.hasOwnProperty.call(contentConceptVizMap, conceptId)

