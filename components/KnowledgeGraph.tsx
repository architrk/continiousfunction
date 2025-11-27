import { Graph } from 'react-d3-graph'
import { conceptGraphData } from '../data/conceptGraphData'

const config = {
  directed: false,
  height: 450,
  width: 800,
  nodeHighlightBehavior: true,
  panAndZoom: true,
  d3: {
    gravity: -200,
    linkLength: 140
  },
  node: {
    size: 400,
    fontSize: 12,
    highlightStrokeColor: '#4f46e5'
  },
  link: {
    highlightColor: '#6366f1'
  }
}

const NODE_ROUTES: Record<string, string> = {
  'Optimizers Overview': '/concepts/optimizers/overview',
  'SGD & Momentum': '/concepts/optimizers/overview#momentum',
  AdamW: '/concepts/optimizers/adamw',
  RMSProp: '/concepts/optimizers/overview#rmsprop',
  Muon: '/concepts/optimizers/muon'
}

export default function KnowledgeGraph() {
  const handleClickNode = (nodeId: string) => {
    const route = NODE_ROUTES[nodeId]
    if (route) {
      window.location.href = route
    }
  }

  return (
    <div className="card graph-card">
      <h1>Concept Graph</h1>
      <p className="muted">
        Drag nodes, zoom, and click a concept to navigate to its explainer. This
        is a small example; you can grow it into a full knowledge map.
      </p>
      <div className="graph-wrapper">
        <Graph
          id="optimizer-concept-graph"
          data={conceptGraphData as any}
          config={config as any}
          onClickNode={handleClickNode}
        />
      </div>
    </div>
  )
}
