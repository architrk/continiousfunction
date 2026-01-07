import { useEffect, useRef, useState, useMemo } from 'react'
import * as d3 from 'd3'
import {
  foundationsConcepts,
  generateFoundationsGraphData,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  RELATION_COLORS,
  RELATION_LABELS,
  GraphNode,
  GraphLink,
  LinkType
} from '../data/foundationsData'

// Extend GraphNode with d3 simulation properties
interface Node extends GraphNode {
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface Link extends Omit<GraphLink, 'source' | 'target'> {
  source: string | Node
  target: string | Node
}

// Phase centers for subway-map style layout (left to right progression)
const PHASE_CENTERS: Record<number, number> = {
  1: 100,   // Core
  2: 250,   // Optimization
  3: 400,   // Generative
  4: 550,   // Representation
  5: 700,   // Scaling
  6: 850,   // Efficiency/Theory
}

// Category centers for vertical bands
const CATEGORY_Y_CENTERS: Record<string, number> = {
  core: 100,
  optimization: 200,
  generative: 300,
  representation: 400,
  scaling: 500,
  efficiency: 550,
  theory: 580,
}

interface Props {
  width?: number
  height?: number
  onNodeClick?: (conceptId: string) => void
}

export default function FoundationsGraph({
  width = 900,
  height = 600,
  onNodeClick
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)

  const graphData = useMemo(() => generateFoundationsGraphData(), [])

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Create arrow marker for directed edges
    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'rgba(245, 158, 11, 0.5)')

    // Create container for zoom
    const g = svg.append('g')

    // Set up zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Create force simulation with phase-anchored layout (subway-map style)
    const simulation = d3.forceSimulation<Node>(graphData.nodes as Node[])
      .force('link', d3.forceLink<Node, Link>(graphData.links as Link[])
        .id(d => d.id)
        .distance(100)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(50))
      // Phase-based X positioning (left-to-right learning progression)
      .force('x', d3.forceX<Node>(d => PHASE_CENTERS[d.phase] || width / 2).strength(0.15))
      // Category-based Y positioning (vertical bands by topic)
      .force('y', d3.forceY<Node>(d => CATEGORY_Y_CENTERS[d.category] || height / 2).strength(0.12))

    // Create arrow markers for each relation type
    const defs = svg.select('defs')
    Object.entries(RELATION_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrowhead-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color)
    })

    // Create links with typed colors
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(graphData.links)
      .join('line')
      .attr('stroke', (d: any) => RELATION_COLORS[d.type as keyof typeof RELATION_COLORS] || 'rgba(245, 158, 11, 0.3)')
      .attr('stroke-width', (d: any) => d.type === 'prereq' ? 1.5 : 2)
      .attr('stroke-dasharray', (d: any) => d.type === 'analogy' ? '4,2' : 'none')
      .attr('marker-end', (d: any) => `url(#arrowhead-${d.type})`)

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(graphData.nodes)
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, Node>()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart()
          d.fx = d.x
          d.fy = d.y
        })
        .on('drag', (event, d) => {
          d.fx = event.x
          d.fy = event.y
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0)
          d.fx = null
          d.fy = null
        }) as any)

    // Node circle background
    node.append('circle')
      .attr('r', 28)
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.15)
      .attr('stroke', d => d.color)
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)

    // Node number badge
    node.append('circle')
      .attr('r', 10)
      .attr('cx', 20)
      .attr('cy', -20)
      .attr('fill', d => d.color)
      .attr('fill-opacity', 0.9)

    node.append('text')
      .attr('x', 20)
      .attr('y', -16)
      .attr('text-anchor', 'middle')
      .attr('font-size', '9px')
      .attr('font-weight', 'bold')
      .attr('fill', '#0a0a0a')
      .text(d => d.number)

    // Node icon
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('font-size', '20px')
      .attr('fill', d => d.color)
      .text(d => d.icon)

    // Node label
    node.append('text')
      .attr('y', 42)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('fill', '#e5e5e5')
      .text(d => d.label)

    // Hover and click interactions
    node
      .on('mouseover', function(event, d) {
        setHoveredNode(d.id)
        ;(d3.select(this).select('circle') as any)
          .transition()
          .duration(150)
          .attr('r', 32)
          .attr('fill-opacity', 0.25)
          .attr('stroke-width', 3)

        // Highlight connected links
        link
          .attr('stroke-opacity', (l: any) => {
            const source = typeof l.source === 'string' ? l.source : l.source.id
            const target = typeof l.target === 'string' ? l.target : l.target.id
            return source === d.id || target === d.id ? 1 : 0.2
          })
          .attr('stroke-width', (l: any) => {
            const source = typeof l.source === 'string' ? l.source : l.source.id
            const target = typeof l.target === 'string' ? l.target : l.target.id
            return source === d.id || target === d.id ? 2.5 : 1
          })
      })
      .on('mouseout', function(event, d) {
        setHoveredNode(null)
        ;(d3.select(this).select('circle') as any)
          .transition()
          .duration(150)
          .attr('r', 28)
          .attr('fill-opacity', 0.15)
          .attr('stroke-width', 2)

        link
          .attr('stroke-opacity', 0.3)
          .attr('stroke-width', 1.5)
      })
      .on('click', (event, d) => {
        if (onNodeClick) {
          onNodeClick(d.id)
        }
      })

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [graphData, width, height, onNodeClick])

  // Get hovered concept details
  const hoveredConcept = hoveredNode
    ? foundationsConcepts.find(c => c.id === hoveredNode)
    : null

  return (
    <div className="foundations-graph">
      <div className="graph-header">
        <h2>Mathematical Foundations of Deep Learning</h2>
        <p className="muted">
          34 core concepts explaining GPT-4, Claude, Gemini, Llama, Stable Diffusion, and Sora.
          Drag nodes to explore. Click to see details.
        </p>
      </div>

      <div className="graph-legend">
        <div className="legend-section">
          <span className="legend-title">Nodes:</span>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="legend-item">
              <span
                className="legend-dot"
                style={{ backgroundColor: CATEGORY_COLORS[key as keyof typeof CATEGORY_COLORS] }}
              />
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
        <div className="legend-section">
          <span className="legend-title">Edges:</span>
          {Object.entries(RELATION_LABELS).map(([key, label]) => (
            <div key={key} className="legend-item">
              <span
                className="legend-line"
                style={{
                  backgroundColor: RELATION_COLORS[key as keyof typeof RELATION_COLORS],
                  borderStyle: key === 'analogy' ? 'dashed' : 'solid'
                }}
              />
              <span className="legend-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="graph-container">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          style={{
            background: 'rgba(8, 12, 20, 0.5)',
            borderRadius: '8px',
            border: '1px solid rgba(245, 158, 11, 0.2)'
          }}
        />

        {hoveredConcept && (
          <div className="concept-tooltip">
            <div className="tooltip-header">
              <span className="tooltip-icon">{hoveredConcept.icon}</span>
              <span className="tooltip-number">#{hoveredConcept.number}</span>
              <span className="tooltip-title">{hoveredConcept.shortTitle}</span>
            </div>
            <p className="tooltip-full-title">{hoveredConcept.title}</p>
            <div className="tooltip-prereqs">
              {hoveredConcept.prereqs.length > 0 && (
                <span>Prereqs: {hoveredConcept.prereqs.join(', ')}</span>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .foundations-graph {
          margin: 2rem 0;
        }
        .graph-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .graph-header h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }
        .graph-legend {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 1rem;
        }
        .legend-section {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
          align-items: center;
        }
        .legend-title {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.75rem;
        }
        .legend-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .legend-line {
          width: 16px;
          height: 3px;
          border-radius: 1px;
        }
        .legend-label {
          color: var(--text-secondary);
        }
        .graph-container {
          position: relative;
          display: flex;
          justify-content: center;
        }
        .concept-tooltip {
          position: absolute;
          top: 1rem;
          right: 1rem;
          background: rgba(8, 12, 20, 0.95);
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 8px;
          padding: 1rem;
          max-width: 280px;
          pointer-events: none;
        }
        .tooltip-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }
        .tooltip-icon {
          font-size: 1.2rem;
        }
        .tooltip-number {
          background: rgba(245, 158, 11, 0.2);
          padding: 0.1rem 0.4rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: bold;
        }
        .tooltip-title {
          font-weight: 600;
          color: var(--accent);
        }
        .tooltip-full-title {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
        }
        .tooltip-prereqs {
          margin-top: 0.5rem;
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }
      `}</style>
    </div>
  )
}
