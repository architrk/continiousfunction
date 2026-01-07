import ForceGraph from './ForceGraph'
import { conceptGraphData, NODE_ID_MAP, CATEGORY_COLORS } from '../data/conceptGraphData'

export default function KnowledgeGraph() {
  const handleClickNode = (nodeId: string) => {
    const conceptId = NODE_ID_MAP[nodeId]
    if (conceptId) {
      window.location.href = `/foundations/${conceptId}`
    }
  }

  return (
    <div className="card graph-card">
      <h1>Knowledge Graph</h1>
      <p className="muted">
        All 34 mathematical foundations and their prerequisite relationships.
        Drag nodes, zoom with scroll, click to explore. Colors indicate topic area.
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
          nodes={conceptGraphData.nodes}
          links={conceptGraphData.links}
          categoryColors={CATEGORY_COLORS}
          width={850}
          height={600}
          onNodeClick={handleClickNode}
        />
      </div>
    </div>
  )
}
