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
  'derivatives': dynamic(() => import('../domains/calculus/concepts/derivatives/viz'), { ssr: false }),
  'dot-product': dynamic(() => import('../domains/linear-algebra/concepts/dot-product/viz'), { ssr: false }),
  'vector-spaces': dynamic(() => import('../domains/linear-algebra/concepts/vector-spaces/viz'), { ssr: false }),
}

export const hasContentViz = (conceptId: string): boolean => Object.prototype.hasOwnProperty.call(contentConceptVizMap, conceptId)

