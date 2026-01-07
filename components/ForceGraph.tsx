// Custom D3 force-directed graph - replaces react-d3-graph to fix React 18 errors
import { useEffect, useRef, useCallback } from 'react'
import * as d3 from 'd3'

interface GraphNode {
  id: string
  category?: string
  x?: number
  y?: number
  fx?: number | null
  fy?: number | null
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
}

interface ForceGraphProps {
  nodes: { id: string; category?: string }[]
  links: { source: string; target: string }[]
  categoryColors?: Record<string, string>
  width?: number
  height?: number
  onNodeClick?: (nodeId: string) => void
}

const DEFAULT_COLOR = '#4f46e5'

export default function ForceGraph({
  nodes: nodeData,
  links: linkData,
  categoryColors = {},
  width = 800,
  height = 600,
  onNodeClick
}: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)

  const handleNodeClick = useCallback((nodeId: string) => {
    if (onNodeClick) {
      onNodeClick(nodeId)
    }
  }, [onNodeClick])

  const getNodeColor = useCallback((category?: string) => {
    if (!category) return DEFAULT_COLOR
    return categoryColors[category] || DEFAULT_COLOR
  }, [categoryColors])

  useEffect(() => {
    if (!svgRef.current) return

    // Clear previous content
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    // Create deep copies of data for D3 mutation
    const nodes: GraphNode[] = nodeData.map(n => ({ ...n }))
    const links: GraphLink[] = linkData.map(l => ({ ...l }))

    // Create container for zoom/pan FIRST
    const container = svg.append('g')

    // Create zoom behavior (after container exists)
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform)
      })

    svg.call(zoom)

    // Start slightly zoomed out for large graphs
    if (nodes.length > 20) {
      svg.call(zoom.transform, d3.zoomIdentity.translate(width / 4, height / 4).scale(0.6))
    }

    // Adjust simulation parameters based on node count
    const linkDistance = nodes.length > 20 ? 80 : 120
    const chargeStrength = nodes.length > 20 ? -300 : -200

    // Initialize simulation
    const simulation = d3.forceSimulation<GraphNode>(nodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(links)
        .id(d => d.id)
        .distance(linkDistance))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30))
      .force('x', d3.forceX(width / 2).strength(0.05))
      .force('y', d3.forceY(height / 2).strength(0.05))

    simulationRef.current = simulation

    // Create arrow markers for directed edges
    svg.append('defs').selectAll('marker')
      .data(['arrow'])
      .join('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 25)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('fill', '#6b7280')
      .attr('d', 'M0,-5L10,0L0,5')

    // Create links
    const link = container.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#4b5563')
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1.5)
      .attr('marker-end', 'url(#arrow)')

    // Create node groups
    const node = container.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, GraphNode>('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')

    // Apply drag behavior separately with proper typing
    const dragBehavior = d3.drag<SVGGElement, GraphNode>()
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
      })

    node.call(dragBehavior)

    // Add circles to nodes with category-based colors
    node.append('circle')
      .attr('r', 16)
      .attr('fill', d => getNodeColor(d.category))
      .attr('stroke', d => d3.color(getNodeColor(d.category))?.darker(0.5)?.toString() || '#312e81')
      .attr('stroke-width', 2)

    // Add labels to nodes
    node.append('text')
      .text(d => d.id)
      .attr('text-anchor', 'middle')
      .attr('dy', 28)
      .attr('font-size', '10px')
      .attr('fill', '#e5e7eb')
      .style('pointer-events', 'none')

    // Hover effects
    node
      .on('mouseover', function(_, d) {
        d3.select(this).select('circle')
          .transition()
          .duration(150)
          .attr('r', 20)
          .attr('stroke-width', 3)

        // Highlight connected links
        link
          .attr('stroke-opacity', l => {
            const source = (l.source as GraphNode).id
            const target = (l.target as GraphNode).id
            return source === d.id || target === d.id ? 1 : 0.2
          })
          .attr('stroke', l => {
            const source = (l.source as GraphNode).id
            const target = (l.target as GraphNode).id
            return source === d.id || target === d.id ? getNodeColor(d.category) : '#4b5563'
          })
      })
      .on('mouseout', function(_, d) {
        d3.select(this).select('circle')
          .transition()
          .duration(150)
          .attr('r', 16)
          .attr('stroke-width', 2)

        link
          .attr('stroke-opacity', 0.5)
          .attr('stroke', '#4b5563')
      })
      .on('click', (_, d) => {
        handleNodeClick(d.id)
      })

    // Update positions on tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as GraphNode).x || 0)
        .attr('y1', d => (d.source as GraphNode).y || 0)
        .attr('x2', d => (d.target as GraphNode).x || 0)
        .attr('y2', d => (d.target as GraphNode).y || 0)

      node.attr('transform', d => `translate(${d.x || 0},${d.y || 0})`)
    })

    // Cleanup
    return () => {
      simulation.stop()
    }
  }, [nodeData, linkData, categoryColors, width, height, handleNodeClick, getNodeColor])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%)',
        borderRadius: '8px'
      }}
    />
  )
}
