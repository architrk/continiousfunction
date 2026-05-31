import type { GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import SurfaceBackplate from '@/components/editorial/SurfaceBackplate'
import SearchActionResultCard, {
  classifySearchActionResult,
  searchActionBucketDefinitions,
  searchActionBucketOrder,
  type SearchActionBucketKind,
} from '@/components/product/SearchActionResultCard'
import SearchRouteBridge from '@/components/product/SearchRouteBridge'
import { useSavedLearningRouteSnapshot } from '@/components/product/useSavedLearningRouteSnapshot'
import LivingLearningLoopRail from '@/components/product/LivingLearningLoopRail'

type SearchItem = {
  kind: 'foundation' | 'content'
  id: string
  title: string
  href: string
  badge: string
  description: string
  snippet?: string
  tags: string[]
  nextAction: string
  pathHint: string
  hasInteractiveDemo: boolean
  hasCodeExample: boolean
  prerequisiteLabels: string[]
  leadLabels: string[]
}

type Props = {
  items: SearchItem[]
}

const normalize = (s: string): string =>
  s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const scoreItem = (qTokens: string[], item: SearchItem): number => {
  if (qTokens.length === 0) return 0

  const title = normalize(item.title)
  const id = normalize(item.id)
  const badge = normalize(item.badge)
  const desc = normalize(item.description)
  const snippet = normalize(item.snippet ?? '')
  const tags = item.tags.map(normalize).join(' ')

  const hay = `${title} ${id} ${badge} ${tags} ${desc} ${snippet}`

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

  const fs = await import('node:fs')

  const stripFrontmatter = (raw: string): string => {
    const normalized = raw.replace(/\r\n/g, '\n')
    const fm = /^---\n[\s\S]*?\n---\n/.exec(normalized)
    return fm ? normalized.slice(fm[0].length) : normalized
  }

  const parseMdxSections = (raw: string): { intuition: string; math: string } => {
    const body = stripFrontmatter(raw)
    const headingRe = /^##\s+(.+)\s*$/gm
    const headings: Array<{ title: string; start: number; contentStart: number }> = []
    let m: RegExpExecArray | null
    while ((m = headingRe.exec(body))) headings.push({ title: m[1].trim(), start: m.index, contentStart: headingRe.lastIndex })

    const sections = new Map<string, string>()
    for (let i = 0; i < headings.length; i++) {
      const h = headings[i]
      const end = headings[i + 1]?.start ?? body.length
      sections.set(h.title, body.slice(h.contentStart, end).trim())
    }

    return { intuition: sections.get('Intuition') ?? '', math: sections.get('Math') ?? '' }
  }

  const mdxToPlainText = (mdx: string): string => {
    let s = mdx
    s = s.replace(/```[\s\S]*?```/g, ' ') // code fences
    s = s.replace(/\$\$[\s\S]*?\$\$/g, ' ') // display math
    s = s.replace(/\$[^$]*\$/g, ' ') // inline math (best-effort)
    s = s.replace(/!\[[^\]]*\]\([^)]+\)/g, ' ') // images
    s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links -> text
    s = s.replace(/<[^>]+>/g, ' ') // mdx/jsx tags
    s = s.replace(/[>*#_`]/g, ' ')
    s = s.replace(/\s+/g, ' ').trim()
    return s
  }

  const snippetFor = (mdxPath: string): string => {
    try {
      const raw = fs.readFileSync(mdxPath, 'utf8')
      const { intuition, math } = parseMdxSections(raw)
      const text = [mdxToPlainText(intuition), mdxToPlainText(math)].filter(Boolean).join(' ')
      if (!text) return ''
      return text.slice(0, 280)
    } catch {
      return ''
    }
  }

  const domains = loadDomains()
  const concepts = loadConceptMetas()
  const domainTitleById = new Map(domains.map((d) => [d.id, d.title] as const))
  const titleById = new Map<string, string>()
  const normalizePlannedId = (id: string) => id.startsWith('planned:') ? id.slice('planned:'.length) : id
  for (const c of foundationsConcepts) titleById.set(c.id, c.title)
  for (const c of concepts) titleById.set(c.id, c.title)

  const labelForConceptId = (id: string) => titleById.get(normalizePlannedId(id)) ?? normalizePlannedId(id)
  const pathHintFor = (beforeIds: string[] | undefined, nextIds: string[] | undefined): string => {
    const before = beforeIds?.[0]
    const next = nextIds?.[0]
    const beforeLabel = before ? `Before: ${labelForConceptId(before)}` : 'Before: start here'
    const nextLabel = next ? `Next: ${labelForConceptId(next)}` : 'Next: open the graph'
    return `${beforeLabel} -> ${nextLabel}`
  }

  const foundationItems: SearchItem[] = foundationsConcepts.map((c) => ({
    kind: 'foundation',
    id: c.id,
    title: c.title,
    href: `/foundations/${c.id}/`,
    badge: CATEGORY_LABELS[c.category] ?? c.category,
    description: c.whyItMatters?.[0] ?? '',
    tags: [c.category, 'foundations'],
    nextAction: 'Open the foundation map and use it as a prerequisite repair',
    pathHint: pathHintFor(c.prereqs, c.dependents),
    hasInteractiveDemo: false,
    hasCodeExample: false,
    prerequisiteLabels: (c.prereqs ?? []).slice(0, 3).map(labelForConceptId),
    leadLabels: (c.dependents ?? []).slice(0, 3).map(labelForConceptId),
  }))

  const contentItems: SearchItem[] = concepts.map((m) => ({
    kind: 'content',
    id: m.id,
    title: m.title,
    href: `/domains/${m.domain}/${m.slug}/`,
    badge: domainTitleById.get(m.domain) ?? m.domain,
    description: m.short_description ?? '',
    snippet: snippetFor(m._contentMdxPath),
    tags: Array.isArray(m.tags) ? m.tags : [],
    nextAction: m.has_interactive_demo
      ? 'Open the notebook, then try the demo checkpoint'
      : 'Open the notebook, then follow the next edge',
    pathHint: pathHintFor(m.prerequisites, m.leads_to),
    hasInteractiveDemo: Boolean(m.has_interactive_demo),
    hasCodeExample: Boolean(m.has_code_example),
    prerequisiteLabels: (m.prerequisites ?? []).slice(0, 3).map(labelForConceptId),
    leadLabels: (m.leads_to ?? []).slice(0, 3).map(labelForConceptId),
  }))

  // During migration, prefer filesystem concepts when IDs collide.
  const contentIds = new Set(contentItems.map((c) => c.id))
  const dedupedFoundationItems = foundationItems.filter((f) => !contentIds.has(f.id))

  return {
    props: {
      items: [...contentItems, ...dedupedFoundationItems],
    },
  }
}

export default function SearchPage({ items }: Props) {
  const router = useRouter()
  const initialQ = typeof router.query.q === 'string' ? router.query.q : ''
  const routeSnapshot = useSavedLearningRouteSnapshot()

  const [q, setQ] = useState(initialQ)
  const [showFoundations, setShowFoundations] = useState(true)
  const [showDomains, setShowDomains] = useState(true)

  useEffect(() => {
    if (!router.isReady) return
    setQ(typeof router.query.q === 'string' ? router.query.q : '')
  }, [router.isReady, router.query.q])

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

  const bucketedResults = useMemo(() => {
    const buckets = Object.fromEntries(
      searchActionBucketOrder.map((bucket) => [bucket, [] as SearchItem[]])
    ) as Record<SearchActionBucketKind, SearchItem[]>

    for (const item of results) {
      const classification = classifySearchActionResult(item, routeSnapshot)
      buckets[classification.bucket].push(item)
    }

    return buckets
  }, [results, routeSnapshot])

  const selectRouteQuery = (nextQuery: string) => {
    const trimmed = nextQuery.trim()
    if (!trimmed) return

    setQ(trimmed)
    void router.replace(
      {
        pathname: '/search/',
        query: { q: trimmed, from: 'route' },
        hash: 'route-search-lens',
      },
      undefined,
      { shallow: true }
    )
  }

  return (
    <NotebookLayout
      eyebrow="Atlas Search"
      title="Find an idea, then follow its edges."
      lede="Search by concept, mechanism, symbol, or tag. Results keep domain, snippet, and tags visible so discovery still feels connected to the learning path."
      breadcrumb={[
        { label: 'Home', href: '/' },
        { label: 'Search' },
      ]}
      meta={[
        `${items.length} indexed entries`,
        'domains + foundations',
        'snippet-aware',
      ]}
      actions={[
        { href: '/domains/', label: 'Browse Domains' },
        { href: '/graph/', label: 'Open Graph', variant: 'secondary' },
      ]}
      preHero={<SearchRouteBridge onSelectQuery={selectRouteQuery} />}
      heroVisual={(
        <div className="search-hero-visual">
          <SurfaceBackplate variant="atlas" />
          <div className="search-orbit" aria-hidden="true">
            <span className="orbit-node one" />
            <span className="orbit-node two" />
            <span className="orbit-node three" />
            <span className="orbit-node four" />
            <span className="orbit-node five" />
            <span className="orbit-path" />
          </div>
          <div className="search-console" aria-label="Search route preview">
            <div className="console-header">
              <span>Route search</span>
              <strong>attention memory</strong>
              <em>concept, equation, demo, next repair</em>
            </div>
            <div className="console-results">
              <article>
                <span>01 / concept</span>
                <strong>Attention</strong>
                <p>weighted copy, QK^T, value mixing</p>
              </article>
              <article>
                <span>02 / system</span>
                <strong>KV cache</strong>
                <p>memory grows with layers, heads, context</p>
              </article>
              <article>
                <span>03 / next step</span>
                <strong>Long context</strong>
                <p>repair the pressure term before serving</p>
              </article>
            </div>
          </div>
        </div>
      )}
    >
      <div className="page">
      <Head>
        <title>Search — Continuous Function</title>
        <meta name="description" content="Search across Foundations and Domains concepts." />
      </Head>

      <section className="search-bridge" aria-label="Search continuity">
        <SurfaceBackplate variant="path" density="quiet" />
        <div>
          <p className="eyebrow">Discovery Bridge</p>
          <h2>Search should return a next step, not a pile of links.</h2>
        </div>
        <p>
          For a learner, results should reveal prerequisites. For a researcher, they should expose assumptions and
          executable witnesses. For a professor, they should surface teachable sequences.
        </p>
      </section>

      <LivingLearningLoopRail
        surface="Search as route finder"
        activeKey={qTokens.length ? 'evidence' : 'question'}
        summary="The search page should turn a learner's phrase into a concept object, visible evidence, and one useful next move."
        steps={[
          { key: 'question', label: 'Question', detail: 'Name the idea, paper clue, symbol, or mechanism.' },
          { key: 'object', label: 'Object', detail: 'Lock onto a concept, prerequisite, demo, or source surface.' },
          { key: 'evidence', label: 'Evidence', detail: 'Read snippets, tags, route memory, and action buckets.' },
          { key: 'next', label: 'Next move', detail: 'Repair, inspect, run a witness, or continue the route.' },
        ]}
      />

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
          searchActionBucketOrder.map((bucket) => {
            const bucketResults = bucketedResults[bucket]
            if (!bucketResults.length) return null

            const definition = searchActionBucketDefinitions[bucket]
            return (
              <section
                key={bucket}
                className={`resultBucket ${bucket}`}
                data-search-result-bucket={bucket}
                aria-labelledby={`search-bucket-${bucket}`}
              >
                <div className="bucketHeader">
                  <div>
                    <p className="eyebrow">{definition.label}</p>
                    <h2 id={`search-bucket-${bucket}`}>{definition.description}</h2>
                  </div>
                  <span>{bucketResults.length} result{bucketResults.length === 1 ? '' : 's'}</span>
                </div>

                <div className="bucketCards">
                  {bucketResults.map((result) => (
                    <SearchActionResultCard
                      key={`${result.kind}:${result.id}`}
                      item={result}
                      snapshot={routeSnapshot}
                    />
                  ))}
                </div>
              </section>
            )
          })
        ) : qTokens.length ? (
          <div className="empty">
            No matches. Try fewer words, or search by the concept ID (e.g. <span className="mono">dot-product</span>).
          </div>
        ) : (
          <div className="empty">
            Start with a stable bridge:{' '}
            <Link href="/domains/linear-algebra/dot-product/" className="inlineLink">
              dot product
            </Link>
            ,{' '}
            <Link href="/domains/attention-transformers/attention-transformers/" className="inlineLink">
              attention
            </Link>
            ,{' '}
            <Link href="/domains/optimization/adam/" className="inlineLink">
              Adam
            </Link>
            .
          </div>
        )}
      </section>

      <style jsx>{`
        .page {
          display: grid;
          gap: 1rem;
          max-width: 1120px;
          margin: 0 auto;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .search-bridge {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1fr);
          gap: 1rem;
          align-items: center;
          padding: 1rem;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.7);
        }

        .search-bridge > div,
        .search-bridge > p {
          position: relative;
          z-index: 1;
        }

        .eyebrow {
          margin: 0 0 0.45rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.6vw, 2rem);
          line-height: 1.05;
          color: #151d27;
          letter-spacing: 0;
        }

        .search-bridge p:last-child {
          margin: 0;
          color: #4c5967;
          line-height: 1.65;
        }

        .panel {
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 22px;
          background: rgba(255, 251, 245, 0.82);
          padding: 1rem;
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.06);
        }

        .inputLabel {
          display: block;
          font-size: 0.85rem;
          color: #5a6874;
          margin-bottom: 0.35rem;
        }

        .input {
          width: 100%;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.94);
          padding: 0.7rem 0.85rem;
          color: #17202a;
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
          color: #334155;
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
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4f5c68;
          background: rgba(255, 251, 245, 0.9);
        }

        .muted {
          color: #64717d;
        }

        .results {
          margin-top: 1rem;
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .resultBucket {
          display: grid;
          gap: 0.72rem;
          min-width: 0;
          padding-top: 0.88rem;
          border-top: 1px solid rgba(27, 36, 48, 0.08);
        }

        .bucketHeader {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.8rem;
          align-items: start;
          min-width: 0;
        }

        .bucketHeader .eyebrow {
          margin-bottom: 0.32rem;
        }

        .bucketHeader h2 {
          font-size: clamp(1.08rem, 2vw, 1.45rem);
          line-height: 1.12;
        }

        .bucketHeader > span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.2rem 0.52rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4f5c68;
          background: rgba(255, 251, 245, 0.92);
          white-space: nowrap;
        }

        .bucketCards {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.76rem;
          min-width: 0;
        }

        .empty {
          grid-column: 1 / -1;
          border: 1px dashed rgba(27, 36, 48, 0.2);
          border-radius: 18px;
          padding: 1.1rem;
          color: #52606b;
          background: rgba(255, 251, 245, 0.7);
        }

        .empty :global(.inlineLink) {
          color: #1f4b99;
          text-decoration: none;
          font-weight: 700;
        }

        .empty :global(.inlineLink:hover) {
          text-decoration: underline;
        }

        @media (max-width: 860px) {
          .search-bridge {
            grid-template-columns: 1fr;
          }

          .results {
            grid-template-columns: 1fr;
          }

          .bucketCards {
            grid-template-columns: 1fr;
          }

          .bucketHeader {
            grid-template-columns: 1fr;
            gap: 0.44rem;
          }

          .resultBucket {
            padding-top: 0.7rem;
          }

          .counts {
            margin-left: 0;
          }
        }
      `}</style>
      <style jsx global>{`
        .search-hero-visual {
          position: relative;
          display: grid;
          place-items: center;
          min-height: 100%;
          overflow: hidden;
          background:
            radial-gradient(circle at 30% 20%, rgba(45, 212, 191, 0.18), transparent 32%),
            radial-gradient(circle at 82% 78%, rgba(245, 158, 11, 0.12), transparent 30%),
            rgba(5, 12, 20, 0.52);
        }

        .search-hero-visual .search-orbit {
          position: absolute;
          inset: 8%;
          z-index: 1;
          margin: 0;
          border-radius: 8px;
          border: 1px solid rgba(125, 211, 252, 0.12);
          background:
            linear-gradient(rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            rgba(5, 12, 20, 0.22);
          background-size: 32px 32px;
          box-shadow: 0 18px 40px rgba(0, 0, 0, 0.12);
        }

        .search-hero-visual .orbit-node {
          position: absolute;
          width: 34px;
          height: 34px;
          border-radius: 8px;
          border: 1px solid rgba(125, 211, 252, 0.18);
          background: rgba(248, 243, 234, 0.12);
          box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
        }

        .search-hero-visual .orbit-node::after {
          content: '';
          position: absolute;
          inset: 9px;
          border-radius: 999px;
          background: #7dd3fc;
          box-shadow: 0 0 0 6px rgba(125, 211, 252, 0.12);
        }

        .search-hero-visual .orbit-node.one {
          left: 12%;
          top: 46%;
        }

        .search-hero-visual .orbit-node.two {
          left: 34%;
          top: 26%;
        }

        .search-hero-visual .orbit-node.three {
          left: 54%;
          top: 58%;
        }

        .search-hero-visual .orbit-node.four {
          left: 72%;
          top: 32%;
        }

        .search-hero-visual .orbit-node.five {
          left: 82%;
          top: 66%;
        }

        .search-hero-visual .orbit-path {
          position: absolute;
          inset: 18% 8%;
          border-bottom: 3px solid rgba(125, 211, 252, 0.24);
          border-left: 1px solid rgba(45, 212, 191, 0.16);
          transform: skewY(-9deg);
        }

        .search-hero-visual .orbit-path::after {
          content: '';
          position: absolute;
          right: 4%;
          bottom: -18px;
          width: 42%;
          height: 54%;
          border-top: 2px dashed rgba(245, 158, 11, 0.24);
          border-right: 2px dashed rgba(245, 158, 11, 0.18);
          border-radius: 999px;
        }

        .search-hero-visual .search-console {
          position: relative;
          z-index: 2;
          display: grid;
          gap: 0.75rem;
          width: min(86%, 520px);
          padding: 0.9rem;
          border-radius: 8px;
          border: 1px solid rgba(248, 243, 234, 0.16);
          background:
            linear-gradient(180deg, rgba(248, 243, 234, 0.1), rgba(248, 243, 234, 0.035)),
            rgba(5, 12, 20, 0.72);
          box-shadow:
            0 20px 48px rgba(0, 0, 0, 0.22),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(10px) saturate(116%);
        }

        .search-hero-visual .console-header,
        .search-hero-visual .console-results article {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.78rem;
          border-radius: 8px;
          border: 1px solid rgba(248, 243, 234, 0.12);
          background: rgba(248, 243, 234, 0.06);
        }

        .search-hero-visual .console-header {
          background:
            linear-gradient(90deg, rgba(45, 212, 191, 0.16), transparent 72%),
            rgba(248, 243, 234, 0.06);
        }

        .search-hero-visual .console-header span,
        .search-hero-visual .console-results span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #7dd3fc;
        }

        .search-hero-visual .console-header strong {
          color: #fff8ed;
          font-family: var(--font-mono);
          font-size: clamp(1rem, 2vw, 1.35rem);
          line-height: 1.2;
        }

        .search-hero-visual .console-header em,
        .search-hero-visual .console-results p {
          margin: 0;
          color: rgba(248, 243, 234, 0.66);
          font-style: normal;
          line-height: 1.42;
        }

        .search-hero-visual .console-results {
          display: grid;
          gap: 0.55rem;
        }

        .search-hero-visual .console-results article {
          grid-template-columns: minmax(0, 0.62fr) minmax(0, 0.72fr) minmax(0, 1.18fr);
          align-items: center;
        }

        .search-hero-visual .console-results strong {
          color: #fff8ed;
          line-height: 1.2;
        }

        @media (max-width: 720px) {
          .search-hero-visual .search-console {
            width: min(92%, 520px);
          }

          .search-hero-visual .console-results article {
            grid-template-columns: 1fr;
          }

          .search-hero-visual .search-orbit {
            inset: 5%;
          }
        }
      `}</style>
    </div>
    </NotebookLayout>
  )
}
