/**
 * Colorblind-accessible pattern overlays for visualizations.
 *
 * These patterns help users with color vision deficiency distinguish
 * between different values in heatmaps and other color-coded visualizations
 * by adding texture patterns on top of (or instead of) color encoding.
 *
 * Patterns are SVG-based and can be used as fill patterns for shapes.
 */

import * as d3 from 'd3'

/**
 * Pattern types available for colorblind accessibility.
 */
export type PatternType =
  | 'solid'
  | 'diagonal-lines'
  | 'horizontal-lines'
  | 'vertical-lines'
  | 'dots'
  | 'crosshatch'
  | 'checkerboard'
  | 'waves'

/**
 * Configuration for a pattern.
 */
export interface PatternConfig {
  type: PatternType
  color: string
  backgroundColor?: string
  opacity?: number
  size?: number
  strokeWidth?: number
}

/**
 * Default pattern sequence for distinguishing values.
 * Ordered from lowest to highest intensity.
 */
export const DEFAULT_PATTERN_SEQUENCE: PatternType[] = [
  'solid',
  'horizontal-lines',
  'diagonal-lines',
  'dots',
  'crosshatch',
  'checkerboard',
]

/**
 * Create SVG pattern definitions for colorblind accessibility.
 *
 * @param svg - D3 selection of the SVG element
 * @param id - Base ID for the patterns
 * @param patterns - Array of pattern configs to create
 * @returns Array of pattern IDs that can be used as fill="url(#patternId)"
 *
 * @example
 * ```tsx
 * const svg = d3.select(svgRef.current)
 * const patternIds = createPatterns(svg, 'heatmap', [
 *   { type: 'solid', color: '#14b8a6' },
 *   { type: 'diagonal-lines', color: '#f59e0b' },
 *   { type: 'dots', color: '#ef4444' },
 * ])
 *
 * // Use in heatmap cells
 * cells.attr('fill', (d, i) => `url(#${patternIds[i]})`)
 * ```
 */
export function createPatterns(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  id: string,
  patterns: PatternConfig[]
): string[] {
  // Ensure defs exists
  let defs = svg.select<SVGDefsElement>('defs')
  if (defs.empty()) {
    defs = svg.append('defs')
  }

  const patternIds: string[] = []

  patterns.forEach((config, index) => {
    const patternId = `${id}-pattern-${index}`
    patternIds.push(patternId)

    const size = config.size ?? 8
    const strokeWidth = config.strokeWidth ?? 1.5
    const opacity = config.opacity ?? 1
    const bgColor = config.backgroundColor ?? 'transparent'

    // Remove existing pattern with same ID
    defs.select(`#${patternId}`).remove()

    // Create pattern element
    const pattern = defs
      .append('pattern')
      .attr('id', patternId)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('width', size)
      .attr('height', size)

    // Add background
    pattern
      .append('rect')
      .attr('width', size)
      .attr('height', size)
      .attr('fill', bgColor)

    // Add pattern-specific shapes
    switch (config.type) {
      case 'solid':
        pattern
          .append('rect')
          .attr('width', size)
          .attr('height', size)
          .attr('fill', config.color)
          .attr('opacity', opacity)
        break

      case 'diagonal-lines':
        pattern
          .append('path')
          .attr('d', `M0,0 L${size},${size} M-${size / 4},${size * 0.75} L${size / 4},${size * 1.25} M${size * 0.75},-${size / 4} L${size * 1.25},${size / 4}`)
          .attr('stroke', config.color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', opacity)
        break

      case 'horizontal-lines':
        pattern
          .append('path')
          .attr('d', `M0,${size / 2} L${size},${size / 2}`)
          .attr('stroke', config.color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', opacity)
        break

      case 'vertical-lines':
        pattern
          .append('path')
          .attr('d', `M${size / 2},0 L${size / 2},${size}`)
          .attr('stroke', config.color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', opacity)
        break

      case 'dots':
        pattern
          .append('circle')
          .attr('cx', size / 2)
          .attr('cy', size / 2)
          .attr('r', size / 4)
          .attr('fill', config.color)
          .attr('fill-opacity', opacity)
        break

      case 'crosshatch':
        pattern
          .append('path')
          .attr('d', `M0,0 L${size},${size} M${size},0 L0,${size}`)
          .attr('stroke', config.color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', opacity)
        break

      case 'checkerboard':
        pattern
          .append('rect')
          .attr('width', size / 2)
          .attr('height', size / 2)
          .attr('fill', config.color)
          .attr('fill-opacity', opacity)
        pattern
          .append('rect')
          .attr('x', size / 2)
          .attr('y', size / 2)
          .attr('width', size / 2)
          .attr('height', size / 2)
          .attr('fill', config.color)
          .attr('fill-opacity', opacity)
        break

      case 'waves':
        pattern
          .append('path')
          .attr('d', `M0,${size / 2} Q${size / 4},0 ${size / 2},${size / 2} T${size},${size / 2}`)
          .attr('stroke', config.color)
          .attr('stroke-width', strokeWidth)
          .attr('stroke-opacity', opacity)
          .attr('fill', 'none')
        break
    }
  })

  return patternIds
}

/**
 * Generate a colorblind-safe palette with patterns.
 *
 * @param numCategories - Number of distinct categories to represent
 * @param baseColor - Optional base color to derive palette from
 * @returns Array of pattern configurations
 *
 * @example
 * ```tsx
 * // Get 4 distinct patterns
 * const patterns = generateColorblindPalette(4)
 * const patternIds = createPatterns(svg, 'chart', patterns)
 * ```
 */
export function generateColorblindPalette(
  numCategories: number,
  baseColor?: string
): PatternConfig[] {
  // Colorblind-safe colors (tested with Coblis colorblind simulator)
  const safeColors = [
    '#0077BB', // Blue
    '#EE7733', // Orange
    '#009988', // Teal
    '#CC3311', // Red
    '#33BBEE', // Cyan
    '#EE3377', // Magenta
    '#BBBBBB', // Grey
    '#000000', // Black
  ]

  const patterns: PatternConfig[] = []

  for (let i = 0; i < numCategories; i++) {
    const patternType = DEFAULT_PATTERN_SEQUENCE[i % DEFAULT_PATTERN_SEQUENCE.length]
    const color = baseColor ?? safeColors[i % safeColors.length]

    patterns.push({
      type: patternType,
      color,
      opacity: 0.8 + (i % 3) * 0.1, // Slight variation in opacity
    })
  }

  return patterns
}

/**
 * Create a gradient scale with patterns for continuous data.
 *
 * @param svg - D3 selection of the SVG element
 * @param id - Base ID for the patterns
 * @param colorScale - D3 color scale for the gradient
 * @param steps - Number of discrete steps (default: 5)
 * @returns Function that maps a value to a pattern URL
 *
 * @example
 * ```tsx
 * const colorScale = d3.scaleLinear<string>()
 *   .domain([0, 1])
 *   .range(['#14b8a6', '#f59e0b'])
 *
 * const getPattern = createGradientPatterns(svg, 'heatmap', colorScale, 5)
 *
 * cells.attr('fill', d => getPattern(d.value))
 * ```
 */
export function createGradientPatterns(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  id: string,
  colorScale: d3.ScaleLinear<string, string>,
  steps: number = 5
): (value: number) => string {
  const [minVal, maxVal] = colorScale.domain()
  const range = maxVal - minVal

  const patterns: PatternConfig[] = []
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1)
    const value = minVal + t * range
    const patternType = DEFAULT_PATTERN_SEQUENCE[i % DEFAULT_PATTERN_SEQUENCE.length]

    patterns.push({
      type: patternType,
      color: colorScale(value),
      opacity: 0.7 + t * 0.3, // More opaque for higher values
    })
  }

  const patternIds = createPatterns(svg, id, patterns)

  // Create scale to map values to pattern indices
  const indexScale = d3
    .scaleQuantize<number>()
    .domain([minVal, maxVal])
    .range(d3.range(steps))

  return (value: number): string => {
    const index = indexScale(value)
    return `url(#${patternIds[index]})`
  }
}

/**
 * Utility to check if user prefers reduced motion.
 * Patterns can be simpler when reduced motion is preferred.
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * CSS class names for pattern legend styling.
 */
export const patternLegendStyles = `
.pattern-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.pattern-legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  color: var(--text-secondary, #9ca3af);
}

.pattern-legend-swatch {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.1));
  border-radius: 2px;
}
`
