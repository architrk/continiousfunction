import { useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/router'
import ForceGraph from './ForceGraph'
import { generateFoundationsGraphData, CATEGORY_COLORS } from '@/data/foundationsData'

type Props = {
  showIntro?: boolean
}

export default function KnowledgeGraph({ showIntro = true }: Props) {
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
    <section className={`knowledge-graph ${showIntro ? 'standalone' : 'embedded'}`} aria-label="Interactive knowledge graph">
      {showIntro ? (
        <>
          <nav className="breadcrumb" aria-label="Breadcrumb">
            <Link href="/">Home</Link>
            <span>/</span>
            <span>Knowledge Graph</span>
          </nav>

          <h1>Knowledge Graph</h1>
          <p className="intro">
            Explore {nodeCount} concepts and {linkCount} connections between them. Drag nodes, zoom with scroll, click
            to navigate.
          </p>
        </>
      ) : null}

      <div className="graph-summary">
        <div>
          <span>{nodeCount}</span>
          <p>concept nodes</p>
        </div>
        <div>
          <span>{linkCount}</span>
          <p>directed edges</p>
        </div>
        <div>
          <span>{Object.keys(CATEGORY_COLORS).length}</span>
          <p>topic colors</p>
        </div>
      </div>

      <div className="legend">
        {Object.entries(CATEGORY_COLORS).map(([cat, color]) => (
          <span key={cat}>
            <i style={{ backgroundColor: color }} />
            {cat}
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

      <style jsx>{`
        .knowledge-graph {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }

        .breadcrumb {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          color: #64707c;
          font-size: 0.85rem;
        }

        .breadcrumb :global(a) {
          color: #1f6f78;
          text-decoration: none;
        }

        .breadcrumb :global(a):hover {
          color: #17202a;
          text-shadow: none;
        }

        h1 {
          margin: 0;
          color: #151d27;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3rem);
          line-height: 1.05;
        }

        .intro {
          margin: 0;
          color: #455361;
          line-height: 1.65;
        }

        .graph-summary {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .graph-summary div {
          min-width: 0;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.86);
        }

        .graph-summary span {
          display: block;
          color: #17202a;
          font-family: var(--font-display);
          font-size: 1.7rem;
          line-height: 1;
        }

        .graph-summary p {
          margin: 0.35rem 0 0;
          color: #52606b;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .legend {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        .legend span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.25rem 0.45rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
          color: #4f5c68;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          text-transform: capitalize;
        }

        .legend i {
          width: 0.62rem;
          height: 0.62rem;
          border-radius: 999px;
          box-shadow: 0 0 0 2px rgba(27, 36, 48, 0.06);
        }

        .graph-wrapper {
          min-width: 0;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background:
            radial-gradient(circle at center, rgba(19, 26, 36, 0.95), rgba(8, 12, 20, 0.98)),
            linear-gradient(rgba(255, 251, 245, 0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 251, 245, 0.04) 1px, transparent 1px);
          background-size: 100% 100%, 30px 30px, 30px 30px;
          box-shadow: inset 0 0 80px rgba(0, 0, 0, 0.28);
        }

        .graph-wrapper :global(svg) {
          display: block;
          width: 100%;
          max-width: 100%;
          height: auto;
        }

        @media (max-width: 720px) {
          .graph-summary {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
