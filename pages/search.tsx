import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import { useRouter } from 'next/router'

type SearchItem = {
  kind: 'foundation' | 'content'
  id: string
  title: string
  href: string
  badge: string
  description: string
  tags: string[]
}

type Props = {
  items: SearchItem[]
}

const normalize = (s: string): string => s.toLowerCase().trim()

const scoreItem = (qTokens: string[], item: SearchItem): number => {
  if (qTokens.length === 0) return 0

  const title = normalize(item.title)
  const id = normalize(item.id)
  const badge = normalize(item.badge)
  const desc = normalize(item.description)
  const tags = item.tags.map(normalize).join(' ')

  const hay = `${title} ${id} ${badge} ${tags} ${desc}`

  let score = 0
  for (const t of qTokens) {
    if (!t) continue
    const hit = hay.includes(t)
    if (!hit) return 0 // AND semantics: all tokens must match somewhere
    score += 10

    if (title.startsWith(t)) score += 6
    if (id.startsWith(t)) score += 5
    if (tags.includes(t)) score += 2
  }

  return score
}

export const getStaticProps: GetStaticProps<Props> = async () => {
  const [{ foundationsConcepts, CATEGORY_LABELS }, { loadDomains, loadConceptMetas }] = await Promise.all([
    import('../data/foundationsData'),
    import('../lib/contentLoader'),
  ])

  const domains = loadDomains()
  const concepts = loadConceptMetas()
  const domainTitleById = new Map(domains.map((d) => [d.id, d.title] as const))

  const foundationItems: SearchItem[] = foundationsConcepts.map((c) => ({
    kind: 'foundation',
    id: c.id,
    title: c.title,
    href: `/foundations/${c.id}/`,
    badge: CATEGORY_LABELS[c.category] ?? c.category,
    description: c.whyItMatters?.[0] ?? '',
    tags: [c.category, 'foundations'],
  }))

  const contentItems: SearchItem[] = concepts.map((m) => ({
    kind: 'content',
    id: m.id,
    title: m.title,
    href: `/domains/${m.domain}/${m.slug}/`,
    badge: domainTitleById.get(m.domain) ?? m.domain,
    description: m.short_description ?? '',
    tags: Array.isArray(m.tags) ? m.tags : [],
  }))

  return {
    props: {
      items: [...contentItems, ...foundationItems],
    },
  }
}

export default function SearchPage({ items }: Props) {
  const router = useRouter()
  const initialQ = typeof router.query.q === 'string' ? router.query.q : ''

  const [q, setQ] = useState(initialQ)
  const [showFoundations, setShowFoundations] = useState(true)
  const [showDomains, setShowDomains] = useState(true)

  const qTokens = useMemo(() => normalize(q).split(/\s+/).filter(Boolean).slice(0, 6), [q])

  const results = useMemo(() => {
    if (!qTokens.length) return []

    const filtered = items.filter((it) => {
      if (it.kind === 'foundation' && !showFoundations) return false
      if (it.kind === 'content' && !showDomains) return false
      return true
    })

    return filtered
      .map((it) => ({ it, score: scoreItem(qTokens, it) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.it.title.localeCompare(b.it.title))
      .slice(0, 60)
      .map((x) => x.it)
  }, [items, qTokens, showDomains, showFoundations])

  const counts = useMemo(() => {
    let foundations = 0
    let content = 0
    for (const it of results) {
      if (it.kind === 'foundation') foundations++
      else content++
    }
    return { foundations, content }
  }, [results])

  return (
    <div className="page">
      <Head>
        <title>Search — Continuous Function</title>
        <meta name="description" content="Search across Foundations and Domains concepts." />
      </Head>

      <header className="hero">
        <h1>Search</h1>
        <p className="sub">
          Search across <span className="mono">/foundations</span> (legacy curriculum) and <span className="mono">/domains</span> (filesystem concepts).
        </p>
      </header>

      <section className="panel" aria-label="Search controls">
        <label className="inputLabel" htmlFor="q">
          Query
        </label>
        <input
          id="q"
          className="input"
          type="search"
          placeholder="Try: dot product, attention, SGD, KL divergence…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />

        <div className="filters">
          <label className="toggle">
            <input type="checkbox" checked={showDomains} onChange={(e) => setShowDomains(e.target.checked)} />
            <span>Domains</span>
          </label>
          <label className="toggle">
            <input type="checkbox" checked={showFoundations} onChange={(e) => setShowFoundations(e.target.checked)} />
            <span>Foundations</span>
          </label>

          <div className="counts" aria-live="polite">
            {qTokens.length ? (
              <>
                <span className="countChip">results: {results.length}</span>
                <span className="countChip">domains: {counts.content}</span>
                <span className="countChip">foundations: {counts.foundations}</span>
              </>
            ) : (
              <span className="muted">Type to search.</span>
            )}
          </div>
        </div>
      </section>

      <section className="results" aria-label="Search results">
        {results.length ? (
          results.map((r) => (
            <Link key={`${r.kind}:${r.id}`} href={r.href} className="card">
              <div className="cardTop">
                <span className={`kind ${r.kind}`}>{r.kind === 'content' ? 'domain' : 'foundation'}</span>
                <span className="badge">{r.badge}</span>
                <span className="id mono">{r.id}</span>
              </div>
              <div className="title">{r.title}</div>
              {r.description ? <div className="desc">{r.description}</div> : null}
              {r.tags.length ? (
                <div className="tags">
                  {r.tags.slice(0, 8).map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          ))
        ) : qTokens.length ? (
          <div className="empty">
            No matches. Try fewer words, or search by the concept ID (e.g. <span className="mono">dot-product</span>).
          </div>
        ) : (
          <div className="empty">
            Popular starts:{' '}
            <Link href="/domains/linear-algebra/dot-product/" className="inlineLink">
              dot product
            </Link>
            ,{' '}
            <Link href="/foundations/attention-transformers/" className="inlineLink">
              attention
            </Link>
            ,{' '}
            <Link href="/foundations/adam/" className="inlineLink">
              Adam
            </Link>
            .
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          max-width: 980px;
          margin: 0 auto;
        }

        .hero {
          margin: 0.5rem 0 1.25rem;
        }

        h1 {
          font-size: 2.4rem;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .sub {
          margin: 0.5rem 0 0;
          color: rgba(148, 163, 184, 0.92);
        }

        .mono {
          font-family: var(--font-mono);
        }

        .panel {
          border: 1px solid rgba(245, 158, 11, 0.16);
          border-radius: 16px;
          background: rgba(10, 12, 18, 0.55);
          padding: 1rem;
        }

        .inputLabel {
          display: block;
          font-size: 0.85rem;
          color: rgba(245, 245, 245, 0.72);
          margin-bottom: 0.35rem;
        }

        .input {
          width: 100%;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(8, 12, 20, 0.55);
          padding: 0.7rem 0.85rem;
          color: rgba(245, 245, 245, 0.92);
          font-size: 1rem;
          outline: none;
        }

        .input:focus {
          border-color: rgba(20, 184, 166, 0.55);
          box-shadow: 0 0 0 3px rgba(20, 184, 166, 0.12);
        }

        .filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.85rem;
          align-items: center;
          margin-top: 0.8rem;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(245, 245, 245, 0.78);
          user-select: none;
        }

        .counts {
          margin-left: auto;
          display: flex;
          gap: 0.45rem;
          align-items: center;
          flex-wrap: wrap;
        }

        .countChip {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: rgba(245, 245, 245, 0.78);
          background: rgba(8, 12, 20, 0.35);
        }

        .muted {
          color: rgba(148, 163, 184, 0.8);
        }

        .results {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .card {
          display: block;
          text-decoration: none;
          border: 1px solid rgba(245, 158, 11, 0.14);
          border-radius: 16px;
          background: rgba(8, 12, 20, 0.35);
          padding: 0.9rem 0.9rem 0.8rem;
          transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
        }

        .card:hover {
          transform: translateY(-1px);
          border-color: rgba(20, 184, 166, 0.28);
          background: rgba(8, 12, 20, 0.45);
        }

        .cardTop {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          flex-wrap: wrap;
          margin-bottom: 0.55rem;
        }

        .kind {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: rgba(245, 245, 245, 0.78);
          background: rgba(8, 12, 20, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .kind.foundation {
          border-color: rgba(245, 158, 11, 0.26);
        }

        .kind.content {
          border-color: rgba(20, 184, 166, 0.28);
        }

        .badge {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: rgba(245, 245, 245, 0.78);
          background: rgba(8, 12, 20, 0.35);
        }

        .id {
          font-size: 0.75rem;
          color: rgba(148, 163, 184, 0.92);
        }

        .title {
          font-size: 1.05rem;
          color: rgba(245, 245, 245, 0.92);
          font-weight: 650;
          line-height: 1.2;
        }

        .desc {
          margin-top: 0.45rem;
          color: rgba(148, 163, 184, 0.88);
          font-size: 0.92rem;
          line-height: 1.35;
        }

        .tags {
          margin-top: 0.65rem;
          display: flex;
          gap: 0.35rem;
          flex-wrap: wrap;
        }

        .tag {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.16rem 0.42rem;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          color: rgba(245, 245, 245, 0.72);
          background: rgba(8, 12, 20, 0.28);
        }

        .empty {
          grid-column: 1 / -1;
          border: 1px dashed rgba(148, 163, 184, 0.28);
          border-radius: 16px;
          padding: 1.1rem;
          color: rgba(148, 163, 184, 0.9);
          background: rgba(8, 12, 20, 0.25);
        }

        .inlineLink {
          color: rgba(20, 184, 166, 0.95);
          text-decoration: none;
        }

        .inlineLink:hover {
          text-decoration: underline;
        }

        @media (max-width: 860px) {
          .results {
            grid-template-columns: 1fr;
          }
          .counts {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}

