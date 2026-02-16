import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'

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
  prereqCount: number
  hasDemo: boolean
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

  const concepts = loadConceptMetas()
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
      prereqCount: c.prerequisites.length,
      hasDemo: Boolean(c.has_visualization || c.has_interactive_demo),
      tags: c.tags,
    }))

  concepts.sort((a, b) => {
    const ia = importanceRank[a.importance]
    const ib = importanceRank[b.importance]
    if (ia !== ib) return ia - ib
    if (a.difficulty !== b.difficulty) return a.difficulty - b.difficulty
    return a.title.localeCompare(b.title)
  })

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
  const publishedCount = concepts.filter((c) => c.status === 'published').length
  const demoCount = concepts.filter((c) => c.hasDemo).length

  return (
    <div>
      <Head>
        <title>{domain.title} — Domains — Continuous Function</title>
      </Head>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href="/domains/">Domains</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{domain.title}</span>
      </nav>

      <section className="hero">
        <h1>
          <span
            className="domain-icon"
            style={{
              borderColor: domain.color || 'var(--border-subtle)',
              color: domain.color || 'var(--text-secondary)',
            }}
          >
            {domain.icon || '∎'}
          </span>
          {domain.title}
        </h1>
        <p className="hero-tagline">{domain.description}</p>
        <div className="hero-stats">
          <span className="hero-stat">
            <strong>{concepts.length}</strong> concepts
          </span>
          <span className="hero-stat">
            <strong>{publishedCount}</strong> published
          </span>
          <span className="hero-stat">
            <strong>{demoCount}</strong> demos
          </span>
          <span className="hero-stat">
            id: <code>{domain.id}</code>
          </span>
        </div>
      </section>

      <section>
        <div className="grid">
          {concepts.map((c) => (
            <Link key={c.id} href={`/domains/${domain.id}/${c.slug}/`} className="card concept-card">
              <div className="concept-card-top">
                <h2 className="concept-title">{c.title}</h2>
                <div className="badges">
                  <span className={`badge status ${c.status}`}>{c.status}</span>
                  <span className={`badge importance ${c.importance}`}>{c.importance}</span>
                  {c.hasDemo && <span className="badge demo">demo</span>}
                </div>
              </div>
              <p className="concept-desc">{c.short_description}</p>
              <div className="concept-meta">
                <span>
                  difficulty: <strong>{c.difficulty}</strong>/5
                </span>
                <span>
                  read: <strong>{c.estimated_read_time || 0}</strong>m
                </span>
                <span>
                  prereqs: <strong>{c.prereqCount}</strong>
                </span>
              </div>
              {c.tags?.length > 0 && (
                <div className="tags">
                  {c.tags.slice(0, 6).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      </section>

      <style jsx>{`
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

        .domain-icon {
          display: inline-grid;
          place-items: center;
          width: 42px;
          height: 42px;
          border-radius: 12px;
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          margin-right: 0.75rem;
          vertical-align: middle;
          font-family: var(--font-mono);
          font-size: 0.95rem;
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

        .concept-card {
          display: block;
          text-decoration: none;
        }

        .concept-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .concept-title {
          margin: 0;
          font-size: 1.1rem;
          font-family: var(--font-display);
          padding-left: 0;
        }

        /* Override global h2 decoration inside cards */
        .concept-title::before {
          content: none;
        }

        .concept-desc {
          margin: 0.5rem 0 0 0;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .concept-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
          margin-top: 0.9rem;
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .concept-meta strong {
          color: var(--text-primary);
        }

        .badges {
          display: inline-flex;
          gap: 0.4rem;
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .badge {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          background: rgba(8, 12, 20, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .badge.demo {
          border-color: rgba(20, 184, 166, 0.35);
          color: var(--converge-teal);
          background: rgba(20, 184, 166, 0.12);
        }

        .badge.status.published {
          border-color: rgba(245, 158, 11, 0.35);
          color: var(--gradient-orange);
          background: rgba(245, 158, 11, 0.12);
        }

        .badge.status.review {
          border-color: rgba(251, 191, 36, 0.35);
          color: #fbbf24;
          background: rgba(251, 191, 36, 0.12);
        }

        .badge.status.draft {
          border-color: rgba(148, 163, 184, 0.25);
          color: rgba(148, 163, 184, 0.9);
          background: rgba(148, 163, 184, 0.08);
        }

        .badge.importance.critical {
          border-color: rgba(239, 68, 68, 0.35);
          color: #ef4444;
          background: rgba(239, 68, 68, 0.12);
        }

        .badge.importance.important {
          border-color: rgba(34, 197, 94, 0.35);
          color: #22c55e;
          background: rgba(34, 197, 94, 0.12);
        }

        .badge.importance.supplementary {
          border-color: rgba(59, 130, 246, 0.35);
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.12);
        }

        .badge.importance.advanced {
          border-color: rgba(168, 85, 247, 0.35);
          color: #a855f7;
          background: rgba(168, 85, 247, 0.12);
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: 0.8rem;
        }

        .tag {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.12rem 0.45rem;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          background: rgba(8, 12, 20, 0.25);
        }
      `}</style>
    </div>
  )
}
