import dynamic from 'next/dynamic'
import Head from 'next/head'
import ExperienceBridge from '@/components/editorial/ExperienceBridge'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import GraphProductNavigator from '@/components/product/GraphProductNavigator'
import LivingLearningLoopRail from '@/components/product/LivingLearningLoopRail'
import { generateFoundationsGraphData, CATEGORY_COLORS } from '@/data/foundationsData'

type KnowledgeGraphProps = {
  showIntro?: boolean
}

const KnowledgeGraph = dynamic<KnowledgeGraphProps>(
  () => import('@/components/graphs/KnowledgeGraph'),
  { ssr: false }
)

const graphData = generateFoundationsGraphData()

function GraphRouteHeroFigure() {
  return (
    <figure className="graph-route-hero-figure">
      <img
        src="/images/editorial/product-loop/learning-route-continuity.jpg"
        alt="A learner question moving along one highlighted path through a larger concept graph."
      />
      <figcaption>
        <span>Route</span>
        Keep the learner's question visible while the graph chooses the next concept.
      </figcaption>

      <style jsx>{`
        .graph-route-hero-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          margin: 0;
          overflow: hidden;
          background: #151d27;
        }

        img {
          width: 100%;
          height: 100%;
          min-height: inherit;
          object-fit: cover;
          display: block;
          filter: saturate(0.96) contrast(0.98);
        }

        figcaption {
          position: absolute;
          left: 1rem;
          right: 1rem;
          bottom: 1rem;
          display: grid;
          gap: 0.28rem;
          max-width: 28rem;
          padding: 0.82rem;
          border-radius: 8px;
          border: 1px solid rgba(255, 251, 245, 0.18);
          background: rgba(21, 29, 39, 0.76);
          color: #f8f3ea;
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.16);
          backdrop-filter: blur(8px) saturate(112%);
        }

        span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #f6b47d;
        }

        @media (max-width: 720px) {
          .graph-route-hero-figure {
            min-height: 360px;
          }
        }
      `}</style>
    </figure>
  )
}

export default function GraphPage() {
  return (
    <NotebookLayout
      eyebrow="Knowledge Graph"
      title="Ask the map what to learn next."
      lede="Use the graph as a research-learning instrument: map papers to concepts, inspect typed edges, find prerequisite repairs, and attach equations, labs, claims, and discussion to the exact idea."
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Graph' },
      ]}
      meta={[
        `${graphData.nodes.length} nodes`,
        `${graphData.links.length} edges`,
        `${Object.keys(CATEGORY_COLORS).length} topic groups`,
      ]}
      actions={[
        { href: '/paper-map/', label: 'Map a Paper' },
        { href: '/paths/attention-serving/', label: 'Open Serving Module', variant: 'secondary' },
        { href: '/search/', label: 'Search Atlas', variant: 'secondary' },
        { href: '/domains/', label: 'Browse Domains', variant: 'secondary' },
      ]}
      ambientImage="/images/editorial/product-loop/learning-route-continuity.jpg"
      heroVisual={<GraphRouteHeroFigure />}
    >
      <Head>
        <title>Knowledge Graph — Continuous Function</title>
      </Head>

      <div className="graph-page">
        <ExperienceBridge
          eyebrow="Graph Reading"
          title="A graph is useful only when it explains the next move."
          intro="The point is not to admire complexity; it is to find the shortest honest path from confusion to a concept you can test."
          items={[
            {
              label: 'Learner',
              title: 'Find the missing prerequisite.',
              body: 'When a page feels too hard, use incoming edges to locate the idea that should be repaired first.',
              href: '/domains/linear-algebra/dot-product/',
              cta: 'Try a bridge',
            },
            {
              label: 'Researcher',
              title: 'Spot reusable mechanisms.',
              body: 'Follow shared neighborhoods to see when optimization, probability, or representation ideas are doing the same job.',
              href: '/search/',
              cta: 'Search mechanisms',
            },
            {
              label: 'Professor',
              title: 'Turn edges into a lecture route.',
              body: 'Use the graph to choose the minimum sequence that makes a derivation or demo feel earned.',
              href: '/pillars/',
              cta: 'Open pillars',
            },
          ]}
        />

        <LivingLearningLoopRail
          surface="Graph as next-move tutor"
          activeKey="object"
          summary="The graph should not be a loose map. It should preserve the current question, point at the live object, and explain why the next edge matters."
          steps={[
            { key: 'question', label: 'Question', detail: 'Start from a paper, confusion, route, or concept gap.' },
            { key: 'object', label: 'Object', detail: 'Select the mechanism, equation, claim, or lab target.' },
            { key: 'evidence', label: 'Evidence', detail: 'Inspect typed edges and route observations.' },
            { key: 'next', label: 'Next move', detail: 'Open the repair, paper object, lab, or teaching route.' },
          ]}
        />

        <GraphProductNavigator />
        <KnowledgeGraph showIntro={false} />
      </div>

      <style jsx>{`
        .graph-page {
          display: grid;
          gap: 1rem;
          min-width: 0;
        }
      `}</style>
    </NotebookLayout>
  )
}
