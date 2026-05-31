import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { DomainsHeroFigure } from '@/components/editorial/EditorialFigures'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import ReaderLensPanel from '@/components/learning/ReaderLensPanel'

type DomainCard = {
  id: string
  title: string
  description: string
  icon: string
  color: string
  order: number
  conceptCount: number
  publishedCount: number
  demoCount: number
  role: string
}

type Props = {
  domains: DomainCard[]
  totalConcepts: number
  totalPublished: number
  totalDemos: number
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const { loadDomains, loadConceptMetas } = await import('../../lib/contentLoader')

  const domains = loadDomains()
  const concepts = loadConceptMetas()

  const domainsWithCounts: DomainCard[] = domains.map((d) => {
    const inDomain = concepts.filter((c) => c.domain === d.id)
    const published = inDomain.filter((c) => c.status === 'published')
    const withDemo = inDomain.filter((c) => c.has_visualization || c.has_interactive_demo)

    return {
      id: d.id,
      title: d.title,
      description: d.description,
      icon: d.icon,
      color: d.color,
      order: d.order,
      conceptCount: inDomain.length,
      publishedCount: published.length,
      demoCount: withDemo.length,
      role: getDomainRole(d.id),
    }
  })

  domainsWithCounts.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))

  const totalConcepts = concepts.length
  const totalPublished = concepts.filter((c) => c.status === 'published').length
  const totalDemos = concepts.filter((c) => c.has_visualization || c.has_interactive_demo).length

  return {
    props: {
      domains: domainsWithCounts,
      totalConcepts,
      totalPublished,
      totalDemos,
    },
  }
}

const getDomainRole = (domainId: string): string => {
  if (['linear-algebra', 'calculus', 'probability', 'optimization', 'information-theory'].includes(domainId)) {
    return 'Foundations'
  }
  if (['attention-transformers', 'neural-networks', 'generative-models', 'representation-learning'].includes(domainId)) {
    return 'Model Mechanics'
  }
  if (['llm-systems', 'efficiency', 'scaling'].includes(domainId)) {
    return 'Systems & Practice'
  }
  return 'Frontier Bridges'
}

const getDomainGlyph = (domainId: string): string => {
  if (domainId.includes('calculus')) return '∂'
  if (domainId.includes('optimization')) return '∇'
  if (domainId.includes('probability')) return 'P'
  if (domainId.includes('information')) return 'H'
  if (domainId.includes('attention')) return 'QK'
  if (domainId.includes('representation')) return 'E'
  if (domainId.includes('generative')) return 'z'
  if (domainId.includes('scaling')) return 'N'
  if (domainId.includes('efficiency')) return 'η'
  if (domainId.includes('systems')) return '{}'
  if (domainId.includes('alignment')) return 'r'
  return 'v'
}

const getRoleQuestion = (role: string): string => {
  if (role === 'Foundations') return 'I need the math underneath the model.'
  if (role === 'Model Mechanics') return 'I want to see how the architecture actually behaves.'
  if (role === 'Systems & Practice') return 'I care about how these ideas run at scale.'
  return 'I am connecting the atlas to open research questions.'
}

const getRoleTransition = (role: string): string => {
  if (role === 'Foundations') return 'Start here when notation, geometry, probability, or optimization is the blocker.'
  if (role === 'Model Mechanics') return 'Move here once the primitives are clear enough to explain a network component.'
  if (role === 'Systems & Practice') return 'Use this band when correctness, latency, memory, and serving constraints matter.'
  return 'Use these bridges when the same mathematics reappears as alignment, interpretability, or causal structure.'
}

const getDomainFocus = (domain: DomainCard): string => {
  if (domain.demoCount > 0 && domain.publishedCount > 0) {
    return 'Best when you want to read, run, and manipulate the idea in one sitting.'
  }
  if (domain.publishedCount > 0) {
    return 'Best when you want a stable reading path before the demos fill in.'
  }
  return 'Emerging territory: useful for seeing the map and what still needs publication polish.'
}

export default function DomainsIndex({ domains, totalConcepts, totalPublished, totalDemos }: Props) {
  const groupedDomains = ['Foundations', 'Model Mechanics', 'Systems & Practice', 'Frontier Bridges']
    .map((role) => ({
      role,
      id: role.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      domains: domains.filter((domain) => domain.role === role),
    }))
    .filter((group) => group.domains.length > 0)

  return (
    <div className="domains-index-page">
      <Head>
        <title>Domains — Continuous Function</title>
      </Head>

      <NotebookLayout
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Domains' },
        ]}
        eyebrow="Domain Atlas"
        title="Choose the territory by the question you are trying to answer"
        lede="Every domain is a route into the same learning loop: intuition, math, code, interactive evidence, and AI-assisted repair when the idea gets slippery."
        meta={[
          `${totalConcepts} concepts`,
          `${totalPublished} published notebooks`,
          `${totalDemos} interactive demos`,
        ]}
        actions={[
          { href: '/domains/linear-algebra/', label: 'Start With Foundations' },
          { href: '/search/', label: 'Search Across Domains', variant: 'secondary' },
          { href: '/graph/', label: 'Open The Knowledge Graph', variant: 'secondary' },
        ]}
        ambientImage="/images/editorial/home-atlas-hero-direction.png"
        heroVisual={<DomainsHeroFigure />}
      >
        <div className="domain-index-body">
          <ReaderLensPanel compact />

          <section className="entry-lanes" aria-labelledby="domain-entry-lanes">
            <div className="section-heading">
              <p className="eyebrow">Choose By Need</p>
              <h2 id="domain-entry-lanes">The same atlas should support first contact, research recall, and teaching prep.</h2>
            </div>

            <div className="lane-grid">
              <Link href="/domains/linear-algebra/" className="lane">
                <span>Learner</span>
                <strong>Build the missing prerequisite.</strong>
                <p>Start with the mathematical object, then watch it become a model behavior.</p>
              </Link>
              <Link href="/domains/alignment/" className="lane">
                <span>Researcher</span>
                <strong>Inspect the mechanism fast.</strong>
                <p>Jump to assumptions, failure regimes, and executable witnesses before returning to papers.</p>
              </Link>
              <Link href="/pillars/" className="lane">
                <span>Professor</span>
                <strong>Find a lecture spine.</strong>
                <p>Use domains as teachable arcs with demos, derivation checkpoints, and next questions.</p>
              </Link>
            </div>
          </section>

          <section className="domain-groups" aria-label="Domain groups">
            {groupedDomains.map((group, groupIndex) => (
              <section key={group.role} className="domain-group" aria-labelledby={`group-${group.id}`}>
                <div className="group-heading">
                  <div>
                    <p className="eyebrow">{String(groupIndex + 1).padStart(2, '0')} / {group.role}</p>
                    <h2 id={`group-${group.id}`}>{getRoleQuestion(group.role)}</h2>
                  </div>
                  <p>{getRoleTransition(group.role)}</p>
                </div>

                <div className="domain-grid">
                  {group.domains.map((domain) => (
                    <Link
                      key={domain.id}
                      href={`/domains/${domain.id}/`}
                      className="domain-card"
                      style={{ '--accent': domain.color || '#1f6f78' } as CSSProperties}
                    >
                      <div className="domain-card-top">
                        <span className="domain-icon" aria-hidden>
                          {getDomainGlyph(domain.id)}
                        </span>
                        <span className="domain-count">{domain.conceptCount} concepts</span>
                      </div>
                      <h3>{domain.title}</h3>
                      <p>{domain.description}</p>
                      <p className="domain-focus">{getDomainFocus(domain)}</p>
                      <div className="domain-signals">
                        <span><strong>{domain.publishedCount}</strong> ready</span>
                        <span><strong>{domain.demoCount}</strong> demos</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            ))}
          </section>
        </div>
      </NotebookLayout>

      <style jsx>{`
        .domain-index-body {
          display: grid;
          gap: 2rem;
          min-width: 0;
        }

        .entry-lanes,
        .domain-group {
          min-width: 0;
        }

        .section-heading,
        .group-heading {
          max-width: 68rem;
        }

        .section-heading {
          margin-bottom: 1rem;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        h2 {
          margin: 0;
          color: #151d27;
          font-family: var(--font-display);
          font-size: clamp(1.55rem, 3vw, 2.28rem);
          line-height: 1.04;
          letter-spacing: 0;
        }

        h2::before {
          content: none;
        }

        .lane-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }

        :global(.lane) {
          display: grid;
          align-content: start;
          gap: 0.6rem;
          min-width: 0;
          min-height: 210px;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(135deg, rgba(31, 75, 153, 0.06), transparent 46%),
            rgba(255, 251, 245, 0.86);
          color: #151d27;
          text-decoration: none;
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.06);
        }

        :global(.lane:hover),
        :global(.domain-card:hover) {
          transform: translateY(-2px);
          text-shadow: none;
        }

        :global(.lane) span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        :global(.lane) strong {
          font-size: 1.14rem;
          line-height: 1.25;
        }

        :global(.lane) p {
          margin: 0;
          color: #4c5967;
          line-height: 1.62;
        }

        .domain-groups {
          display: grid;
          gap: 2.15rem;
        }

        .domain-group {
          display: grid;
          gap: 1rem;
          padding-top: 1.35rem;
          border-top: 1px solid rgba(27, 36, 48, 0.1);
        }

        .group-heading {
          display: grid;
          grid-template-columns: minmax(0, 0.72fr) minmax(18rem, 0.28fr);
          gap: 1.2rem;
          align-items: end;
        }

        .group-heading > p {
          margin: 0;
          color: #4c5967;
          line-height: 1.65;
        }

        .domain-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
          gap: 0.9rem;
        }

        :global(.domain-card) {
          position: relative;
          display: grid;
          align-content: start;
          gap: 0.75rem;
          min-width: 0;
          min-height: 282px;
          padding: 1rem;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid color-mix(in srgb, var(--accent) 24%, rgba(27, 36, 48, 0.08));
          background:
            radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 12%, transparent), transparent 36%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.94), rgba(247, 242, 233, 0.82));
          color: #151d27;
          text-decoration: none;
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.06);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        :global(.domain-card)::after {
          content: '';
          position: absolute;
          inset: auto 0 0;
          height: 4px;
          background: color-mix(in srgb, var(--accent) 72%, #1b2430);
        }

        .domain-card-top {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.7rem;
          align-items: center;
        }

        .domain-icon {
          display: grid;
          width: 42px;
          height: 42px;
          place-items: center;
          border-radius: 8px;
          border: 1px solid color-mix(in srgb, var(--accent) 34%, rgba(27, 36, 48, 0.1));
          background: color-mix(in srgb, var(--accent) 9%, rgba(255, 251, 245, 0.92));
          color: color-mix(in srgb, var(--accent) 72%, #1b2430);
          font-family: var(--font-mono);
          font-size: 0.78rem;
          font-weight: 700;
          line-height: 1;
        }

        .domain-count {
          justify-self: end;
          color: #5a6874;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        :global(.domain-card) h3 {
          margin: 0;
          color: #151d27;
          font-size: 1.18rem;
          line-height: 1.18;
          letter-spacing: 0;
        }

        :global(.domain-card) p {
          margin: 0;
          color: #4c5967;
          line-height: 1.6;
          max-width: 700px;
        }

        .domain-focus {
          padding-top: 0.75rem;
          border-top: 1px solid rgba(27, 36, 48, 0.08);
          font-size: 0.92rem;
        }

        .domain-signals {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          margin-top: auto;
        }

        .domain-signals span {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          min-height: 32px;
          padding: 0.35rem 0.55rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
          color: #4c5967;
          font-family: var(--font-mono);
          font-size: 0.7rem;
        }

        .domain-signals strong {
          color: #151d27;
        }

        @media (max-width: 980px) {
          .lane-grid,
          .group-heading {
            grid-template-columns: 1fr;
          }

          :global(.lane) {
            min-height: 0;
          }
        }

        @media (max-width: 720px) {
          .domain-index-body {
            gap: 1.4rem;
          }

          :global(.domain-card) {
            min-height: 0;
          }
        }
      `}</style>
    </div>
  )
}
