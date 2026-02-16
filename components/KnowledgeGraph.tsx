import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ForceGraph from './ForceGraph'
import { generateFoundationsGraphData, CATEGORY_COLORS } from '../data/foundationsData'

export default function KnowledgeGraph() {
  const router = useRouter()

  // Generate graph data from the full foundations dataset (100 concepts)
  const graphData = useMemo(() => generateFoundationsGraphData(), [])

  const handleClickNode = (nodeId: string) => {
    // nodeId is already the concept ID in the new data format
    if (nodeId) {
      // Client-side navigation keeps the graph page snappy on static export.
      router.push(`/foundations/${nodeId}/`)
    }
  }

  const nodeCount = graphData.nodes.length
  const linkCount = graphData.links.length

  return (
    <div className="card graph-card">
      {/* Breadcrumb */}
      <nav className="breadcrumb" style={{ marginBottom: '1rem', fontSize: '0.85rem' }}>
        <Link href="/" style={{ color: 'var(--text-muted)' }}>Home</Link>
        <span style={{ margin: '0 0.5rem', color: 'var(--text-muted)' }}>/</span>
        <span style={{ color: 'var(--text-secondary)' }}>Knowledge Graph</span>
      </nav>

      <h1>Knowledge Graph</h1>
      <p className="muted">
        Explore {nodeCount} concepts and {linkCount} connections between them.
        Drag nodes, zoom with scroll, click to navigate. Colors indicate topic area.
      </p>
      <div className="legend" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        marginBottom: '16px',
        fontSize: '11px'
      }}>
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: color,
              display: 'inline-block'
            }} />
            <span style={{ color: '#9ca3af', textTransform: 'capitalize' }}>{cat}</span>
          </span>
        ))}
      </div>
      <div className="graph-wrapper">
        <ForceGraph
          nodes={graphData.nodes}
          links={graphData.links}
          categoryColors={CATEGORY_COLORS}
          width={850}
          height={600}
          onNodeClick={handleClickNode}
        />
      </div>
    </div>
  )
}
