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
  GraphLink
} from '@/data/foundationsData'
import {
  SimulationNode,
  getNodeId,
  getLinkX,
  getLinkY,
  createNodeDrag,
  selectCircleFromGroup,
  transitionCircle
} from '@/lib/d3Types'

// Extend GraphNode with d3 simulation properties
interface Node extends GraphNode, SimulationNode {}

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

// All available relation types
const ALL_RELATION_TYPES = Object.keys(RELATION_LABELS) as (keyof typeof RELATION_LABELS)[]

export default function FoundationsGraph({
  width = 900,
  height = 600,
  onNodeClick
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const layoutWidth = Math.max(width, 900)
  const renderHeight = width < 720 ? 360 : height

  // Relation type filter state - all visible by default
  const [visibleRelations, setVisibleRelations] = useState<Set<string>>(
    () => new Set(ALL_RELATION_TYPES)
  )

  const graphData = useMemo(() => generateFoundationsGraphData(), [])

  // Filter links based on visible relation types
  const filteredLinks = useMemo(() => {
    return graphData.links.filter(link => visibleRelations.has(link.type))
  }, [graphData.links, visibleRelations])

  // Toggle a relation type's visibility
  const toggleRelationType = (type: string) => {
    setVisibleRelations(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  // Show all / hide all helpers
  const showAllRelations = () => setVisibleRelations(new Set(ALL_RELATION_TYPES))
  const hideAllRelations = () => setVisibleRelations(new Set())

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
      .force('link', d3.forceLink<Node, Link>(filteredLinks as Link[])
        .id(d => d.id)
        .distance(100)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('collision', d3.forceCollide().radius(50))
      // Phase-based X positioning (left-to-right learning progression)
      .force('x', d3.forceX<Node>(d => PHASE_CENTERS[d.phase] || layoutWidth / 2).strength(0.15))
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
      .selectAll<SVGLineElement, Link>('line')
      .data(filteredLinks as Link[])
      .join('line')
      .attr('stroke', (d: Link) => RELATION_COLORS[d.type as keyof typeof RELATION_COLORS] || 'rgba(245, 158, 11, 0.3)')
      .attr('stroke-width', (d: Link) => d.type === 'prereq' ? 1.5 : 2)
      .attr('stroke-dasharray', (d: Link) => d.type === 'analogy' ? '4,2' : 'none')
      .attr('marker-end', (d: Link) => `url(#arrowhead-${d.type})`)

    // Create drag behavior for nodes
    const dragBehavior = createNodeDrag<Node>(simulation)

    // Create node groups
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, Node>('g')
      .data(graphData.nodes as Node[])
      .join('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer')

    // Apply drag behavior
    node.call(dragBehavior)

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
      .on('mouseover', function(this: SVGGElement, event, d) {
        setHoveredNode(d.id)
        const circle = selectCircleFromGroup(this)
        transitionCircle(circle, 150, { r: 32, fillOpacity: 0.25, strokeWidth: 3 })

        // Highlight connected links
        link
          .attr('stroke-opacity', (l: Link) => {
            const sourceId = getNodeId(l.source)
            const targetId = getNodeId(l.target)
            return sourceId === d.id || targetId === d.id ? 1 : 0.2
          })
          .attr('stroke-width', (l: Link) => {
            const sourceId = getNodeId(l.source)
            const targetId = getNodeId(l.target)
            return sourceId === d.id || targetId === d.id ? 2.5 : 1
          })
      })
      .on('mouseout', function(this: SVGGElement) {
        setHoveredNode(null)
        const circle = selectCircleFromGroup(this)
        transitionCircle(circle, 150, { r: 28, fillOpacity: 0.15, strokeWidth: 2 })

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
        .attr('x1', (d: Link) => getLinkX(d.source))
        .attr('y1', (d: Link) => getLinkY(d.source))
        .attr('x2', (d: Link) => getLinkX(d.target))
        .attr('y2', (d: Link) => getLinkY(d.target))

      node.attr('transform', (d: Node) => `translate(${d.x ?? 0},${d.y ?? 0})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [graphData, filteredLinks, layoutWidth, height, onNodeClick])

  // Get hovered concept details
  const hoveredConcept = hoveredNode
    ? foundationsConcepts.find(c => c.id === hoveredNode)
    : null

  return (
    <div className="foundations-graph">
      <div className="graph-header">
        <h2>Mathematical Foundations of Deep Learning</h2>
        <p className="muted">
          {foundationsConcepts.length} core concepts explaining GPT-4, Claude, Gemini, Llama, Stable Diffusion, and Sora.
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
        <div className="legend-section legend-filters">
          <span className="legend-title">Filter Edges:</span>
          {Object.entries(RELATION_LABELS).map(([key, label]) => {
            const isActive = visibleRelations.has(key)
            return (
              <button
                key={key}
                className={`filter-chip ${isActive ? 'active' : 'inactive'}`}
                onClick={() => toggleRelationType(key)}
                aria-pressed={isActive}
                title={`${isActive ? 'Hide' : 'Show'} ${label} edges`}
              >
                <span
                  className="legend-line"
                  style={{
                    backgroundColor: RELATION_COLORS[key as keyof typeof RELATION_COLORS],
                    borderStyle: key === 'analogy' ? 'dashed' : 'solid'
                  }}
                />
                <span className="legend-label">{label}</span>
              </button>
            )
          })}
          <div className="filter-actions">
            <button
              className="filter-action-btn"
              onClick={showAllRelations}
              title="Show all edge types"
            >
              All
            </button>
            <button
              className="filter-action-btn"
              onClick={hideAllRelations}
              title="Hide all edges"
            >
              None
            </button>
          </div>
        </div>
      </div>

      <div className="graph-container">
        <svg
          ref={svgRef}
          width={width}
          height={renderHeight}
          viewBox={`0 0 ${layoutWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          style={{
            maxWidth: '100%',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
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
          width: 100%;
          min-width: 0;
          overflow: hidden;
        }
        .graph-header {
          text-align: center;
          margin-bottom: 1.5rem;
        }
        .graph-header h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          padding-left: 0;
        }
        .graph-header h2::before {
          display: none;
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
        .legend-filters {
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .filter-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.35rem 0.6rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-chip:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(245, 158, 11, 0.3);
        }
        .filter-chip.active {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.4);
        }
        .filter-chip.inactive {
          opacity: 0.5;
        }
        .filter-chip.inactive .legend-line {
          opacity: 0.3;
        }
        .filter-actions {
          display: flex;
          gap: 0.25rem;
          margin-left: 0.5rem;
        }
        .filter-action-btn {
          padding: 0.25rem 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.15);
          border-radius: 3px;
          font-size: 0.65rem;
          color: var(--text-tertiary);
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .filter-action-btn:hover {
          background: rgba(245, 158, 11, 0.2);
          border-color: rgba(245, 158, 11, 0.4);
          color: var(--text-primary);
        }
        .graph-container {
          position: relative;
          display: flex;
          justify-content: center;
          width: 100%;
          min-width: 0;
          overflow: hidden;
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

        @media (max-width: 720px) {
          .foundations-graph {
            margin: 0;
          }

          .graph-header {
            text-align: left;
          }

          .graph-legend {
            align-items: stretch;
          }

          .graph-container {
            justify-content: flex-start;
          }

          .legend-section {
            justify-content: flex-start;
            flex-wrap: wrap;
            width: 100%;
            gap: 0.55rem 0.75rem;
            overflow: visible;
          }

          .filter-chip,
          .legend-item,
          .filter-actions {
            flex: 0 1 auto;
          }

          .legend-title {
            flex-basis: 100%;
          }

          .filter-chip {
            max-width: 100%;
          }

          .legend-label {
            white-space: normal;
          }

          .concept-tooltip {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
