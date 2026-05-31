import Head from 'next/head'
import Link from 'next/link'
import ExperienceBridge from '@/components/editorial/ExperienceBridge'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import { PillarsHeroFigure } from '@/components/editorial/EditorialFigures'

const pillars = [
  {
    id: 'sequence-modeling',
    icon: 'S',
    title: 'Sequence Modeling',
    subtitle: 'The architecture of memory and attention',
    mathNote: 'y = softmax(QK^T / sqrt(d))V',
    description:
      'Move from recurrence to attention to state-space models, watching how different architectures remember, retrieve, and compress context.',
    topics: ['Attention', 'SSMs', 'Mamba', 'Memory'],
    startHref: '/domains/attention-transformers/attention-transformers/',
    startLabel: 'Start with attention',
  },
  {
    id: 'optimization',
    icon: 'O',
    title: 'Optimization',
    subtitle: 'Navigating the loss landscape',
    mathNote: 'theta <- theta - eta grad L(theta)',
    description:
      'Treat training as dynamics: gradients, curvature, stability, averaging, and the practical geometry that makes models learn.',
    topics: ['SGD', 'Adam', 'Muon', 'Sharpness'],
    startHref: '/domains/optimization/gradient-descent/',
    startLabel: 'Start with gradients',
  },
  {
    id: 'generative-physics',
    icon: 'G',
    title: 'Generative Physics',
    subtitle: 'Diffusion, flow, and the geometry of data',
    mathNote: 'dx = f(x,t)dt + g(t)dW',
    description:
      'See generation as transport: noisy particles, score fields, flow matching, and probability paths becoming manipulable systems.',
    topics: ['Diffusion', 'Flow Matching', 'Score', 'SDEs'],
    startHref: '/domains/generative-models/diffusion/',
    startLabel: 'Start with diffusion',
  },
  {
    id: 'geometric-dl',
    icon: 'E',
    title: 'Geometric Deep Learning',
    subtitle: 'Symmetry as inductive bias',
    mathNote: "f(rho(g)x) = rho'(g)f(x)",
    description:
      'Use symmetry to explain why architecture should respect the structure of the data, from grids to graphs to manifolds.',
    topics: ['Equivariance', 'GNNs', 'Symmetry', 'Lie Groups'],
    startHref: '/pillars/geometric-dl/',
    startLabel: 'Open the pillar',
  },
  {
    id: 'mech-interp',
    icon: 'M',
    title: 'Mechanistic Interpretability',
    subtitle: 'Reverse-engineering neural computation',
    mathNote: 'x ~= sum_i a_i f_i',
    description:
      'Connect representations to mechanisms: features, superposition, circuits, probes, and interventions that make models inspectable.',
    topics: ['SAEs', 'Circuits', 'Features', 'Probing'],
    startHref: '/domains/representation-learning/sparse-autoencoders/',
    startLabel: 'Start with features',
  },
]

const bridgeItems = [
  {
    label: 'Frame',
    title: 'Pillars explain why a topic matters.',
    body: 'They keep the big mathematical story visible before a learner drops into a single concept page.',
    href: '/vision/',
    cta: 'Read the vision',
  },
  {
    label: 'Enter',
    title: 'Domains turn a pillar into a route.',
    body: 'Each pillar points toward notebooks with prerequisites, code witnesses, demos, and AI companion context.',
    href: '/domains/',
    cta: 'Browse domains',
  },
  {
    label: 'Connect',
    title: 'The graph keeps cross-links honest.',
    body: 'When a pillar crosses into another field, the graph should reveal the edge instead of hiding the jump.',
    href: '/graph/',
    cta: 'Open graph',
  },
]

export default function PillarsIndex() {
  return (
    <NotebookLayout
      eyebrow="Synthesis Layer"
      title="Five Pillars"
      lede="Use pillars when you want the map before the territory: the same notebooks can serve a learner, a researcher, or a professor, but each needs a different scale of orientation."
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Pillars' },
      ]}
      meta={['5 synthesis tracks', 'domain-linked', 'research-to-notebook']}
      actions={[
        { href: '/domains/', label: 'Browse Domains' },
        { href: '/graph/', label: 'Open Graph', variant: 'secondary' },
      ]}
      heroVisual={<PillarsHeroFigure />}
    >
      <Head>
        <title>Five Pillars — Continuous Function</title>
      </Head>

      <div className="pillars-page">
        <ExperienceBridge
          eyebrow="Route Logic"
          title="A pillar should feel like a conceptual zoom level."
          intro="It starts with a research question, names the mathematical pattern, and hands the learner to a notebook where the idea becomes testable."
          items={bridgeItems}
        />

        <section className="pillar-grid" aria-label="Pillar routes">
          {pillars.map((pillar) => (
            <article key={pillar.id} className="pillar-card">
              <div className="pillar-symbol">{pillar.icon}</div>
              <div className="pillar-copy">
                <p>{pillar.subtitle}</p>
                <h2>{pillar.title}</h2>
                <code>{pillar.mathNote}</code>
                <span>{pillar.description}</span>
              </div>
              <div className="topic-row">
                {pillar.topics.map((topic) => (
                  <span key={topic}>{topic}</span>
                ))}
              </div>
              <div className="pillar-actions">
                <Link href={pillar.startHref}>{pillar.startLabel}</Link>
                <Link href={`/pillars/${pillar.id}`} className="secondary">
                  Pillar essay
                </Link>
              </div>
            </article>
          ))}
        </section>
      </div>

      <style jsx>{`
        .pillars-page {
          display: grid;
          gap: 1rem;
        }

        .pillar-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }

        .pillar-card {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.9rem;
          min-width: 0;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.05);
        }

        .pillar-symbol {
          display: grid;
          place-items: center;
          width: 3rem;
          height: 3rem;
          border-radius: 8px;
          color: #f8f3ea;
          background: linear-gradient(135deg, #1f4b99, #1f6f78);
          font-family: var(--font-display);
          font-size: 1.45rem;
          box-shadow: 0 12px 26px rgba(31, 75, 153, 0.16);
        }

        .pillar-copy {
          display: grid;
          gap: 0.48rem;
          min-width: 0;
        }

        .pillar-copy p {
          margin: 0;
          color: #5a6874;
          font-style: italic;
          line-height: 1.45;
        }

        .pillar-copy h2 {
          margin: 0;
          color: #151d27;
          font-family: var(--font-display);
          font-size: clamp(1.3rem, 2.2vw, 1.85rem);
          line-height: 1.08;
          letter-spacing: 0;
        }

        .pillar-copy code {
          width: fit-content;
          max-width: 100%;
          padding: 0.42rem 0.55rem;
          border-radius: 6px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(239, 232, 219, 0.78);
          color: #1f6f78;
          overflow-wrap: anywhere;
          white-space: normal;
        }

        .pillar-copy span {
          color: #455361;
          line-height: 1.58;
        }

        .topic-row,
        .pillar-actions {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .topic-row span {
          padding: 0.3rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(239, 247, 245, 0.72);
          color: #4f5c68;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .pillar-actions {
          margin-top: 0.2rem;
        }

        .pillar-actions :global(a) {
          color: #1f4b99;
          font-weight: 700;
          text-decoration: none;
        }

        .pillar-actions :global(a.secondary) {
          color: #52606b;
          font-weight: 600;
        }

        .pillar-actions :global(a:hover) {
          color: #17202a;
          text-shadow: none;
        }

        @media (max-width: 900px) {
          .pillar-grid,
          .pillar-card {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </NotebookLayout>
  )
}
