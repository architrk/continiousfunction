/**
 * Type-safe D3 utilities to avoid 'as any' casts throughout the codebase.
 *
 * D3's TypeScript definitions are strict but often require explicit generics
 * that are tedious to write inline. This module provides properly typed
 * wrappers for common patterns.
 */

import * as d3 from 'd3'

// ═══════════════════════════════════════════════════════════
// SIMULATION NODE/LINK TYPES
// ═══════════════════════════════════════════════════════════

/**
 * Base node type with D3 simulation properties.
 * Extend this for your specific node data.
 */
export interface SimulationNode extends d3.SimulationNodeDatum {
  id: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

/**
 * Link type where source/target can be string IDs or node references.
 * After simulation starts, D3 mutates these to node objects.
 */
export interface SimulationLink<N extends SimulationNode> extends d3.SimulationLinkDatum<N> {
  source: string | N
  target: string | N
}

/**
 * Helper to safely get node ID from a link endpoint that may be a string or node.
 */
export function getNodeId<N extends SimulationNode>(endpoint: string | N): string {
  return typeof endpoint === 'string' ? endpoint : endpoint.id
}

/**
 * Helper to get x coordinate from link endpoint.
 * Returns 0 if source is still a string (before simulation tick).
 */
export function getLinkX<N extends SimulationNode>(endpoint: string | N): number {
  if (typeof endpoint === 'string') return 0
  return endpoint.x ?? 0
}

/**
 * Helper to get y coordinate from link endpoint.
 */
export function getLinkY<N extends SimulationNode>(endpoint: string | N): number {
  if (typeof endpoint === 'string') return 0
  return endpoint.y ?? 0
}

// ═══════════════════════════════════════════════════════════
// AXIS UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Apply an axis to a selection in a type-safe way.
 * D3's axis generators are polymorphic and the selection type doesn't always match.
 */
export function applyAxis<Domain extends d3.AxisDomain>(
  selection: d3.Selection<SVGGElement, unknown, HTMLElement | null, unknown>,
  axis: d3.Axis<Domain>
): d3.Selection<SVGGElement, unknown, HTMLElement | null, unknown> {
  return selection.call(axis as unknown as (selection: d3.Selection<SVGGElement, unknown, HTMLElement | null, unknown>) => void)
}

/**
 * Apply axis to a selection from a ref element.
 */
export function applyAxisToRef<Domain extends d3.AxisDomain>(
  element: SVGGElement | null,
  axis: d3.Axis<Domain>
): void {
  if (!element) return
  d3.select(element).call(axis as unknown as (selection: d3.Selection<SVGGElement, unknown, null, undefined>) => void)
}

/**
 * Type-safe axis call that can be used inline.
 * Usage: selection.call(callAxis(axis))
 */
export function callAxis<Domain extends d3.AxisDomain>(
  axis: d3.Axis<Domain>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): (selection: d3.Selection<SVGGElement, any, any, any>) => void {
  return (selection) => {
    axis(selection)
  }
}

// ═══════════════════════════════════════════════════════════
// COLOR SCALE UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Create a linear color scale with proper typing.
 * D3's scaleLinear defaults to number output, but we often need string colors.
 */
export function createColorScale(
  domain: [number, number],
  range: [string, string]
): d3.ScaleLinear<string, string> {
  return d3.scaleLinear<string>()
    .domain(domain)
    .range(range)
}

/**
 * Create a diverging color scale for positive/negative values.
 */
export function createDivergingColorScale(
  domain: [number, number, number],
  range: [string, string, string]
): d3.ScaleLinear<string, string> {
  return d3.scaleLinear<string>()
    .domain(domain)
    .range(range)
}

// ═══════════════════════════════════════════════════════════
// DRAG UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Create a drag behavior for simulation nodes.
 * Handles the common pattern of dragging nodes in a force simulation.
 */
export function createNodeDrag<N extends SimulationNode>(
  simulation: d3.Simulation<N, undefined>
): d3.DragBehavior<SVGGElement, N, N | d3.SubjectPosition> {
  return d3.drag<SVGGElement, N>()
    .on('start', (event: d3.D3DragEvent<SVGGElement, N, N>, d: N) => {
      if (!event.active) simulation.alphaTarget(0.3).restart()
      d.fx = d.x
      d.fy = d.y
    })
    .on('drag', (event: d3.D3DragEvent<SVGGElement, N, N>, d: N) => {
      d.fx = event.x
      d.fy = event.y
    })
    .on('end', (event: d3.D3DragEvent<SVGGElement, N, N>, d: N) => {
      if (!event.active) simulation.alphaTarget(0)
      d.fx = null
      d.fy = null
    })
}

/**
 * Apply drag behavior to a selection.
 */
export function applyDrag<GElement extends Element, Datum>(
  selection: d3.Selection<GElement, Datum, Element | null, unknown>,
  drag: d3.DragBehavior<GElement, Datum, Datum | d3.SubjectPosition>
): void {
  selection.call(drag as unknown as (selection: d3.Selection<GElement, Datum, Element | null, unknown>) => void)
}

/**
 * Apply drag behavior to an element ref.
 */
export function applyDragToElement<GElement extends Element>(
  element: GElement | null,
  drag: d3.DragBehavior<GElement, unknown, unknown>
): void {
  if (!element) return
  d3.select(element).call(drag as unknown as (selection: d3.Selection<GElement, unknown, null, undefined>) => void)
}

// ═══════════════════════════════════════════════════════════
// TRANSITION UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Safely transition a circle element's attributes.
 * Avoids the need for casting when chaining transitions.
 */
export function transitionCircle(
  selection: d3.Selection<SVGCircleElement, unknown, Element | null, unknown>,
  duration: number,
  attrs: {
    r?: number
    fillOpacity?: number
    strokeWidth?: number
    fill?: string
    stroke?: string
  }
): d3.Transition<SVGCircleElement, unknown, Element | null, unknown> {
  let transition = selection.transition().duration(duration)

  if (attrs.r !== undefined) {
    transition = transition.attr('r', attrs.r)
  }
  if (attrs.fillOpacity !== undefined) {
    transition = transition.attr('fill-opacity', attrs.fillOpacity)
  }
  if (attrs.strokeWidth !== undefined) {
    transition = transition.attr('stroke-width', attrs.strokeWidth)
  }
  if (attrs.fill !== undefined) {
    transition = transition.attr('fill', attrs.fill)
  }
  if (attrs.stroke !== undefined) {
    transition = transition.attr('stroke', attrs.stroke)
  }

  return transition
}

/**
 * Get the first circle element from a node group selection.
 */
export function selectCircleFromGroup(
  groupElement: SVGGElement
): d3.Selection<SVGCircleElement, unknown, null, undefined> {
  return d3.select(groupElement).select<SVGCircleElement>('circle')
}
