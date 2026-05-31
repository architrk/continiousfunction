import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useState, type CSSProperties } from 'react'
import NotebookLayout from '@/components/editorial/NotebookLayout'

type Domain = {
  id: string
  title: string
  description: string
  icon: string
  color: string
  order: number
}

type ConceptCard = {
  id: string
  slug: string
  title: string
  short_description: string
  status: 'draft' | 'review' | 'published'
  importance: 'critical' | 'important' | 'supplementary' | 'advanced'
  difficulty: number
  estimated_read_time: number
  prerequisites: string[]
  prereqCount: number
  prereqTitles: string[]
  hasDemo: boolean
  hasCode: boolean
  tags: string[]
}

type Props = {
  domain: Domain
  concepts: ConceptCard[]
}

const importanceRank: Record<ConceptCard['importance'], number> = {
  critical: 0,
  important: 1,
  supplementary: 2,
  advanced: 3,
}

const sortForLearningRoute = (left: ConceptCard, right: ConceptCard) => {
  if (left.status !== right.status) return left.status === 'published' ? -1 : 1

  const leftRequiresRight = left.prerequisites.includes(right.id)
  const rightRequiresLeft = right.prerequisites.includes(left.id)
  if (leftRequiresRight !== rightRequiresLeft) return leftRequiresRight ? 1 : -1

  if (left.difficulty !== right.difficulty) return left.difficulty - right.difficulty
  if (left.prereqCount !== right.prereqCount) return left.prereqCount - right.prereqCount

  const importanceDelta = importanceRank[left.importance] - importanceRank[right.importance]
  if (importanceDelta !== 0) return importanceDelta

  return left.title.localeCompare(right.title)
}

const cleanTag = (tag: string) => tag.replace(/[-_]+/g, ' ')

const bridgeCueFor = (previous: ConceptCard | undefined, current: ConceptCard) => {
  if (!previous) {
    return current.prereqTitles.length
      ? `Check ${current.prereqTitles[0]} first if the symbols feel slippery.`
      : 'Entry point: build the first mental model here.'
  }

  if (current.prereqTitles.includes(previous.title)) {
    return `Why this follows: ${current.title} uses ${previous.title} directly.`
  }

  const sharedTags = current.tags.filter((tag) => previous.tags.includes(tag)).slice(0, 2)
  if (sharedTags.length) {
    return `Why this follows: both pages keep the ${sharedTags.map(cleanTag).join(' / ')} thread active.`
  }

  if (current.prereqTitles.length) {
    return `Why this follows: it shifts toward ${current.prereqTitles[0]} while staying in the same neighborhood.`
  }

  return `Why this follows: it moves from ${previous.title} toward the next mechanism in ${current.title}.`
}

function DomainRouteHeroFigure({
  domain,
  routeConcepts,
  demoCount,
}: {
  domain: Domain
  routeConcepts: ConceptCard[]
  demoCount: number
}) {
  const preview = routeConcepts.slice(0, 5)
  const firstConceptHref = preview[0] ? `/domains/${domain.id}/${preview[0].slug}/` : `/domains/${domain.id}/`
  const firstDemoConcept = routeConcepts.find((concept) => concept.hasDemo)
  const firstDemoHref = firstDemoConcept ? `/domains/${domain.id}/${firstDemoConcept.slug}/#interactive-demo` : firstConceptHref
  const domainModes = [
    {
      label: 'Learner',
      title: 'Repair prerequisites',
      cue: 'Start from the first route node and keep the next missing object visible.',
      question: `What should I understand first so ${domain.title} stops feeling like a list?`,
      move: preview[0]
        ? `Begin with ${preview[0].title}, then follow the next route node only after the invariant feels stable.`
        : 'Start with the first published notebook when this domain opens.',
      href: firstConceptHref,
      accent: '#2dd4bf',
    },
    {
      label: 'Researcher',
      title: 'Inspect mechanisms',
      cue: 'Use tags, demos, and code witnesses to move from paper clue to testable claim.',
      question: `Which claim in ${domain.title} can I turn into an equation, source, or code witness?`,
      move: 'Use search to find the exact object, then return to the domain route with the object attached.',
      href: `/search/?q=${encodeURIComponent(domain.title)}#route-search-lens`,
      accent: '#a78bfa',
    },
    {
      label: 'Experimenter',
      title: `${demoCount} demos`,
      cue: 'Prefer pages where a prediction checkpoint turns the idea into evidence.',
      question: demoCount
        ? 'Which knob should move if the mechanism is right?'
        : 'What toy witness would make the first claim testable?',
      move: firstDemoConcept
        ? `Open ${firstDemoConcept.title} at the demo and make one prediction before reading more.`
        : 'Use the first route node as a design brief for a future prediction-first demo.',
      href: firstDemoHref,
      accent: '#f59e0b',
    },
    {
      label: 'Professor',
      title: 'Teach the chain',
      cue: 'Turn the route into prerequisite, invariant, misconception, and transfer.',
      question: `What sequence would make ${domain.title} teachable without flattening the math?`,
      move: 'Use the recommended route as a lecture spine, then surface one misconception per concept.',
      href: '/pillars/',
      accent: '#fb7185',
    },
  ] as const
  const [activeModeLabel, setActiveModeLabel] = useState<(typeof domainModes)[number]['label']>('Learner')
  const activeMode = domainModes.find((mode) => mode.label === activeModeLabel) ?? domainModes[0]

  return (
    <div className="domain-route-hero" aria-label={`${domain.title} route preview`}>
      <div className="domain-console">
        <div className="domain-console-header">
          <span>Domain route</span>
          <strong>{domain.title}</strong>
          <em>{preview.length ? `${preview.length} starting moves visible` : 'Route opens as notebooks are published'}</em>
        </div>

        <div className="domain-lens-panel" style={{ '--mode-accent': activeMode.accent } as CSSProperties}>
          <span>{activeMode.label} lens</span>
          <strong>{activeMode.question}</strong>
          <p>{activeMode.move}</p>
          <Link href={activeMode.href}>Take this lens</Link>
        </div>

        <div className="route-preview" aria-label="Recommended learning sequence">
          {preview.map((concept, index) => (
            <div key={concept.id} className={index === 0 ? 'route-node active' : 'route-node'}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{concept.title}</strong>
              <em>
                {concept.hasDemo ? 'demo' : concept.hasCode ? 'code' : 'read'}
                {' · '}
                level {concept.difficulty}
              </em>
            </div>
          ))}
        </div>

        <div className="domain-mode-grid">
          {domainModes.map((mode) => (
            <button
              key={mode.label}
              type="button"
              className={activeMode.label === mode.label ? 'is-active' : ''}
              style={{ '--mode-accent': mode.accent } as CSSProperties}
              aria-pressed={activeMode.label === mode.label}
              onClick={() => setActiveModeLabel(mode.label)}
            >
              <span>{mode.label}</span>
              <strong>{mode.title}</strong>
              <p>{mode.cue}</p>
            </button>
          ))}
        </div>
      </div>

      <style jsx>{`
        .domain-route-hero {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 100%;
          padding: clamp(0.8rem, 2vw, 1rem);
          overflow: hidden;
          background:
            linear-gradient(rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 18% 16%, rgba(45, 212, 191, 0.18), transparent 32%),
            radial-gradient(circle at 84% 76%, rgba(245, 158, 11, 0.12), transparent 30%),
            rgba(5, 12, 20, 0.56);
          background-size: 30px 30px, 30px 30px, auto, auto, auto;
        }

        .domain-route-hero::before {
          content: '';
          position: absolute;
          inset: 8% 5%;
          border-radius: 8px;
          border: 1px solid rgba(125, 211, 252, 0.12);
          background:
            radial-gradient(circle at 24% 24%, rgba(45, 212, 191, 0.12), transparent 36%),
            linear-gradient(135deg, rgba(248, 243, 234, 0.04), transparent 55%);
        }

        .domain-console {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 0.75rem;
          width: min(88%, 560px);
          padding: 0.9rem;
          border-radius: 8px;
          border: 1px solid rgba(248, 243, 234, 0.16);
          background:
            linear-gradient(180deg, rgba(248, 243, 234, 0.1), rgba(248, 243, 234, 0.035)),
            rgba(5, 12, 20, 0.68);
          box-shadow:
            0 20px 48px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px) saturate(116%);
        }

        .domain-console-header,
        .domain-lens-panel,
        .route-node,
        .domain-mode-grid button {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.78rem;
          border-radius: 8px;
          border: 1px solid rgba(248, 243, 234, 0.12);
          background: rgba(248, 243, 234, 0.06);
        }

        .domain-console-header {
          background:
            linear-gradient(90deg, rgba(45, 212, 191, 0.16), transparent 72%),
            rgba(248, 243, 234, 0.06);
        }

        .domain-lens-panel {
          gap: 0.42rem;
          border-color: color-mix(in srgb, var(--mode-accent) 42%, rgba(248, 243, 234, 0.12));
          border-left: 4px solid var(--mode-accent);
          background:
            radial-gradient(circle at 12% 16%, color-mix(in srgb, var(--mode-accent) 18%, transparent), transparent 48%),
            rgba(248, 243, 234, 0.07);
        }

        .domain-console-header span,
        .domain-lens-panel span,
        .route-node span,
        .domain-mode-grid span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7dd3fc;
        }

        .domain-console-header strong {
          color: #fff8ed;
          font-family: var(--font-display);
          font-size: clamp(1.3rem, 2.5vw, 2rem);
          line-height: 1;
        }

        .domain-lens-panel span {
          color: color-mix(in srgb, var(--mode-accent) 86%, white);
        }

        .domain-lens-panel strong {
          color: #fff8ed;
          line-height: 1.24;
          overflow-wrap: anywhere;
        }

        .domain-lens-panel p {
          margin: 0;
          color: rgba(248, 243, 234, 0.68);
          line-height: 1.45;
          overflow-wrap: anywhere;
        }

        .domain-lens-panel :global(a) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 44px;
          max-width: 100%;
          padding: 0.48rem 0.7rem;
          border-radius: 999px;
          border: 1px solid rgba(248, 243, 234, 0.16);
          background: rgba(248, 243, 234, 0.92);
          color: #07111d;
          font-size: 0.82rem;
          font-weight: 800;
          line-height: 1.15;
          text-align: center;
          text-decoration: none;
        }

        .domain-console-header em,
        .route-node em,
        .domain-mode-grid p {
          margin: 0;
          color: rgba(248, 243, 234, 0.64);
          font-style: normal;
          line-height: 1.42;
        }

        .route-preview {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.45rem;
        }

        .route-node {
          grid-template-columns: auto minmax(0, 1fr) auto;
          align-items: center;
          min-height: 0;
        }

        .route-node.active {
          border-color: rgba(45, 212, 191, 0.42);
          background: rgba(45, 212, 191, 0.1);
        }

        .route-node strong,
        .domain-mode-grid strong {
          color: #fff8ed;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .route-node em {
          text-align: right;
        }

        .domain-mode-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .domain-mode-grid button {
          color: inherit;
          font: inherit;
          text-align: left;
          cursor: pointer;
          appearance: none;
          background:
            linear-gradient(180deg, rgba(248, 243, 234, 0.08), rgba(248, 243, 234, 0.04)),
            linear-gradient(90deg, color-mix(in srgb, var(--mode-accent) 14%, transparent), transparent 70%);
          transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
        }

        .domain-mode-grid button:hover,
        .domain-mode-grid button.is-active {
          transform: translateY(-1px);
          border-color: color-mix(in srgb, var(--mode-accent) 62%, rgba(248, 243, 234, 0.12));
        }

        .domain-mode-grid button.is-active {
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--mode-accent) 16%, rgba(248, 243, 234, 0.08)), rgba(248, 243, 234, 0.05)),
            linear-gradient(90deg, color-mix(in srgb, var(--mode-accent) 24%, transparent), transparent 76%);
          box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--mode-accent) 30%, transparent);
        }

        .domain-mode-grid button:focus-visible {
          outline: 2px solid color-mix(in srgb, var(--mode-accent) 70%, white);
          outline-offset: 3px;
        }

        @media (max-width: 720px) {
          .domain-route-hero {
            min-height: 520px;
          }

          .domain-console {
            width: min(92%, 560px);
          }

          .domain-mode-grid {
            grid-template-columns: 1fr;
          }

          .domain-lens-panel :global(a) {
            width: 100%;
          }

          .route-node {
            grid-template-columns: 1fr;
            align-items: start;
          }

          .route-node em {
            text-align: left;
          }
        }
      `}</style>
    </div>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { loadDomains } = await import('../../../lib/contentLoader')
  const domains = loadDomains()

  return {
    paths: domains.map((d) => ({ params: { domain: d.id } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const domainId = String(params?.domain ?? '')

  const { loadDomains, loadConceptMetas } = await import('../../../lib/contentLoader')

  const domains = loadDomains()
  const domain = domains.find((d) => d.id === domainId)
  if (!domain) return { notFound: true }

  const allConcepts = loadConceptMetas()
  const titleById = new Map(allConcepts.map((concept) => [concept.id, concept.title]))

  const concepts = allConcepts
    .filter((c) => c.domain === domainId)
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      title: c.title,
      short_description: c.short_description,
      status: c.status,
      importance: c.importance,
      difficulty: c.difficulty,
      estimated_read_time: c.estimated_read_time,
      prerequisites: c.prerequisites,
      prereqCount: c.prerequisites.length,
      prereqTitles: c.prerequisites
        .map((id) => titleById.get(id) ?? id)
        .slice(0, 3),
      hasDemo: Boolean(c.has_visualization || c.has_interactive_demo),
      hasCode: c.has_code_example,
      tags: c.tags,
    }))
    .sort(sortForLearningRoute)

  return {
    props: {
      domain: {
        id: domain.id,
        title: domain.title,
        description: domain.description,
        icon: domain.icon,
        color: domain.color,
        order: domain.order,
      },
      concepts,
    },
  }
}

export default function DomainPage({ domain, concepts }: Props) {
  const publishedConcepts = concepts.filter((concept) => concept.status === 'published')
  const routeConcepts = publishedConcepts.slice(0, 7)
  const advancedConcepts = publishedConcepts.filter((concept) => concept.importance === 'advanced' || concept.difficulty >= 4)
  const inProgressConcepts = concepts.filter((concept) => concept.status !== 'published')
  const demoCount = concepts.filter((concept) => concept.hasDemo).length

  return (
    <div className="domain-atlas-page">
      <Head>
        <title>{`${domain.title} — Domains — Continuous Function`}</title>
      </Head>

      <NotebookLayout
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Domains', href: '/domains/' },
          { label: domain.title },
        ]}
        eyebrow="Domain Neighborhood"
        title={domain.title}
        lede={domain.description}
        meta={[
          `${concepts.length} concepts`,
          `${publishedConcepts.length} published`,
          `${demoCount} demos`,
        ]}
        actions={[
          routeConcepts[0]
            ? { href: `/domains/${domain.id}/${routeConcepts[0].slug}/`, label: `Start with ${routeConcepts[0].title}` }
            : { href: '/domains/', label: 'Browse Domains' },
          { href: '/search/', label: 'Search Atlas', variant: 'secondary' },
        ]}
        heroVisual={<DomainRouteHeroFigure domain={domain} routeConcepts={routeConcepts} demoCount={demoCount} />}
      >
        <div className="domain-body">
          <section className="route-section" aria-labelledby="recommended-route">
            <div className="section-heading">
              <p className="eyebrow">Recommended Route</p>
              <h2 id="recommended-route">Start here, then follow the prerequisites forward.</h2>
              <p>
                This sequence is ordered for learning rather than inventory: lower difficulty, fewer prerequisites,
                and more central concepts come first.
              </p>
            </div>

            <ol className="route-list">
              {routeConcepts.map((concept, index) => (
                <li key={concept.id} className="route-item">
                  <span className="route-index">{String(index + 1).padStart(2, '0')}</span>
                  <div className="route-copy">
                    <Link href={`/domains/${domain.id}/${concept.slug}/`} className="route-link">
                      {concept.title}
                    </Link>
                    <p>{concept.short_description}</p>
                    <div className="signals">
                      <span>{concept.estimated_read_time || 10} min</span>
                      {concept.hasCode ? <span>code</span> : null}
                      {concept.hasDemo ? <span>demo</span> : null}
                      {concept.prereqTitles.length ? <span>after {concept.prereqTitles.join(', ')}</span> : <span>entry point</span>}
                    </div>
                    <p className="bridge-cue">{bridgeCueFor(routeConcepts[index - 1], concept)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section className="notebook-section" aria-labelledby="all-notebooks">
            <div className="section-heading compact">
              <p className="eyebrow">All Published Notebooks</p>
              <h2 id="all-notebooks">Browse the territory.</h2>
            </div>

            <div className="concept-list">
              {publishedConcepts.map((concept) => (
                <Link key={concept.id} href={`/domains/${domain.id}/${concept.slug}/`} className="concept-row">
                  <div>
                    <h3>{concept.title}</h3>
                    <p>{concept.short_description}</p>
                  </div>
                  <div className="row-meta">
                    <span>Level {concept.difficulty}</span>
                    <span>{concept.estimated_read_time || 10} min</span>
                    {concept.hasDemo ? <span>demo</span> : null}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {advancedConcepts.length ? (
            <section className="notebook-section" aria-labelledby="advanced-notebooks">
              <div className="section-heading compact">
                <p className="eyebrow">Advanced Bridges</p>
                <h2 id="advanced-notebooks">Use these after the core path.</h2>
              </div>

              <div className="bridge-list">
                {advancedConcepts.slice(0, 6).map((concept) => (
                  <Link key={concept.id} href={`/domains/${domain.id}/${concept.slug}/`} className="bridge-link">
                    {concept.title}
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          {inProgressConcepts.length ? (
            <section className="notebook-section" aria-labelledby="in-progress">
              <div className="section-heading compact">
                <p className="eyebrow">In Progress</p>
                <h2 id="in-progress">Notebooks still below the publish bar.</h2>
              </div>

              <div className="bridge-list muted">
                {inProgressConcepts.map((concept) => (
                  <span key={concept.id} className="bridge-link pending">
                    {concept.title}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </NotebookLayout>

      <style jsx>{`
        .domain-body {
          display: grid;
          gap: 2rem;
        }

        .section-heading {
          max-width: 58rem;
          margin-bottom: 1rem;
        }

        .section-heading.compact {
          margin-bottom: 0.75rem;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #0f766e;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.65rem, 4vw, 2.35rem);
          line-height: 1;
          color: #151d27;
        }

        h2::before {
          content: none;
        }

        .section-heading p:last-child {
          margin: 0.85rem 0 0;
          color: #4f5c68;
          line-height: 1.7;
        }

        .route-list {
          list-style: none;
          margin: 0;
          padding: 0;
          border-top: 1px solid rgba(27, 36, 48, 0.1);
        }

        .route-item {
          list-style: none;
          display: grid;
          grid-template-columns: 3rem minmax(0, 1fr);
          gap: 1rem;
          padding: 1rem 0;
          border-bottom: 1px solid rgba(27, 36, 48, 0.1);
        }

        .route-item::before,
        .route-item::marker {
          content: none;
          display: none;
        }

        .route-index {
          font-family: var(--font-mono);
          color: color-mix(in srgb, ${domain.color || '#0f766e'} 70%, #1b2430);
          font-size: 0.85rem;
        }

        :global(.route-link) {
          color: #151d27;
          text-decoration: none;
          font-weight: 700;
          font-size: 1.08rem;
        }

        :global(.route-link:hover),
        :global(.concept-row:hover) h3,
        :global(.bridge-link:hover) {
          color: #0f766e;
          text-shadow: none;
        }

        .route-copy p,
        :global(.concept-row) p {
          margin: 0.45rem 0 0;
          color: #455361;
          line-height: 1.62;
        }

        .route-copy .bridge-cue {
          margin-top: 0.72rem;
          padding: 0.72rem 0.82rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(239, 247, 245, 0.72);
          color: #40515c;
          font-size: 0.92rem;
          line-height: 1.5;
        }

        .signals,
        .row-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
          margin-top: 0.75rem;
        }

        .signals span,
        .row-meta span {
          padding: 0.3rem 0.5rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.82);
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4f5c68;
          font-family: var(--font-mono);
          font-size: 0.7rem;
        }

        .concept-list {
          display: grid;
          border-top: 1px solid rgba(27, 36, 48, 0.1);
        }

        :global(.concept-row) {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 1rem;
          padding: 1rem 0;
          border-bottom: 1px solid rgba(27, 36, 48, 0.1);
          color: inherit;
          text-decoration: none;
        }

        :global(.concept-row) h3 {
          margin: 0;
          color: #151d27;
          font-size: 1.04rem;
        }

        .row-meta {
          justify-content: flex-end;
          align-content: start;
          margin-top: 0;
          min-width: 12rem;
        }

        .bridge-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
        }

        :global(.bridge-link) {
          display: inline-flex;
          min-height: 38px;
          align-items: center;
          padding: 0.55rem 0.7rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.82);
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #1b2430;
          text-decoration: none;
          font-weight: 600;
        }

        :global(.bridge-link.pending) {
          color: #5b6874;
          font-weight: 500;
        }

        @media (max-width: 720px) {
          .route-item,
          :global(.concept-row) {
            grid-template-columns: 1fr;
          }

          .row-meta {
            justify-content: flex-start;
            min-width: 0;
          }
        }
      `}</style>
    </div>
  )
}
