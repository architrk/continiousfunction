import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'

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

export default function DomainsIndex({ domains, totalConcepts, totalPublished, totalDemos }: Props) {
  return (
    <div>
      <Head>
        <title>Domains — Continuous Function</title>
      </Head>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Domains</span>
      </nav>

      <section className="hero">
        <h1>Domains</h1>
        <p className="hero-tagline">
          A filesystem-driven library of concepts. This is the new, unlimited content system.
        </p>
        <div className="hero-stats" style={{ marginTop: '1rem' }}>
          <span className="hero-stat"><strong>{totalConcepts}</strong> concepts</span>
          <span className="hero-stat"><strong>{totalPublished}</strong> published</span>
          <span className="hero-stat"><strong>{totalDemos}</strong> demos</span>
        </div>
      </section>

      <section>
        <div className="grid">
          {domains.map((d) => (
            <Link
              key={d.id}
              href={`/domains/${d.id}/`}
              className="card"
              style={{ borderColor: d.color || 'var(--border-subtle)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  aria-hidden
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    display: 'grid',
                    placeItems: 'center',
                    border: `1px solid ${d.color || 'var(--border-subtle)'}`,
                    background: 'rgba(8, 12, 20, 0.35)',
                    color: d.color || 'var(--text-secondary)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.9rem',
                  }}
                >
                  {d.icon || '∎'}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontFamily: 'var(--font-display)' }}>
                      {d.title}
                    </h3>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {d.conceptCount} concepts
                    </span>
                  </div>
                  <p style={{ margin: '0.5rem 0 0 0', color: 'var(--text-secondary)', maxWidth: 700 }}>
                    {d.description}
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{d.publishedCount}</strong> published
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      <strong style={{ color: 'var(--text-primary)' }}>{d.demoCount}</strong> demos
                    </span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      id: <code>{d.id}</code>
                    </span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <style jsx>{`
        /* Minimal breadcrumb styling (legacy pages mix inline + global) */
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 1.25rem;
        }
        .breadcrumb a {
          color: var(--converge-teal);
          text-decoration: none;
        }
        .breadcrumb a:hover {
          text-decoration: underline;
        }
        .breadcrumb-sep {
          color: var(--text-muted);
          opacity: 0.7;
        }
        .breadcrumb-current {
          color: var(--text-secondary);
        }

        .hero-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 1rem;
        }

        .hero-stat {
          display: inline-flex;
          align-items: baseline;
          gap: 0.4rem;
          padding: 0.35rem 0.6rem;
          border-radius: var(--radius-md);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .hero-stat strong {
          color: var(--text-primary);
        }
      `}</style>
    </div>
  )
}
