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
  'decoding-sampling': dynamic(() => import('../domains/llm-systems/concepts/decoding-sampling/viz'), { ssr: false }),
  'derivatives': dynamic(() => import('../domains/calculus/concepts/derivatives/viz'), { ssr: false }),
  'diffusion': dynamic(() => import('../domains/generative-models/concepts/diffusion/viz'), { ssr: false }),
  'dot-product': dynamic(() => import('../domains/linear-algebra/concepts/dot-product/viz'), { ssr: false }),
  'double-descent': dynamic(() => import('../domains/scaling/concepts/double-descent/viz'), { ssr: false }),
  'dpo': dynamic(() => import('../domains/alignment/concepts/dpo/viz'), { ssr: false }),
  'efficiency': dynamic(() => import('../domains/efficiency/concepts/efficiency/viz'), { ssr: false }),
  'efficient-attention': dynamic(() => import('../domains/attention-transformers/concepts/efficient-attention/viz'), { ssr: false }),
  'flow-matching': dynamic(() => import('../domains/generative-models/concepts/flow-matching/viz'), { ssr: false }),
  'kl-divergence': dynamic(() => import('../domains/information-theory/concepts/kl-divergence/viz'), { ssr: false }),
  'kto': dynamic(() => import('../domains/alignment/concepts/kto/viz'), { ssr: false }),
  'llm-serving': dynamic(() => import('../domains/llm-systems/concepts/llm-serving/viz'), { ssr: false }),
  'long-context': dynamic(() => import('../domains/attention-transformers/concepts/long-context/viz'), { ssr: false }),
  'loss-landscapes': dynamic(() => import('../domains/optimization/concepts/loss-landscapes/viz'), { ssr: false }),
  'maximum-likelihood': dynamic(() => import('../domains/probability/concepts/maximum-likelihood/viz'), { ssr: false }),
  'mixture-of-experts': dynamic(() => import('../domains/efficiency/concepts/mixture-of-experts/viz'), { ssr: false }),
  'representations': dynamic(() => import('../domains/representation-learning/concepts/representations/viz'), { ssr: false }),
  'reward-hacking': dynamic(() => import('../domains/alignment/concepts/reward-hacking/viz'), { ssr: false }),
  'rlhf': dynamic(() => import('../domains/alignment/concepts/rlhf/viz'), { ssr: false }),
  'rope': dynamic(() => import('../domains/attention-transformers/concepts/rope/viz'), { ssr: false }),
  'scaling-laws': dynamic(() => import('../domains/scaling/concepts/scaling-laws/viz'), { ssr: false }),
  'score-matching': dynamic(() => import('../domains/generative-models/concepts/score-matching/viz'), { ssr: false }),
  'speculative-decoding': dynamic(() => import('../domains/llm-systems/concepts/speculative-decoding/viz'), { ssr: false }),
  'tokenization-vocabulary': dynamic(() => import('../domains/attention-transformers/concepts/tokenization-vocabulary/viz'), { ssr: false }),
  'vaes': dynamic(() => import('../domains/generative-models/concepts/vaes/viz'), { ssr: false }),
  'vector-spaces': dynamic(() => import('../domains/linear-algebra/concepts/vector-spaces/viz'), { ssr: false }),
}

export const hasContentViz = (conceptId: string): boolean => Object.prototype.hasOwnProperty.call(contentConceptVizMap, conceptId)

