import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import type { ComponentType } from 'react'
import { contentConceptVizMap } from '../../../content/_generated/vizMap'
import type { ConceptMeta } from '../../../lib/contentLoader'

type ConceptMetaPublic = Omit<ConceptMeta, '_dirPath' | '_conceptYamlPath' | '_contentMdxPath' | '_vizPath'>

type ResolvedLink = {
  id: string
  title?: string
  href?: string
}

type Neighbor = {
  title: string
  href: string
}

type Props = {
  domainTitle: string
  concept: ConceptMetaPublic
  sections: {
    intuitionHtml: string
    mathHtml: string
    codeHtml: string
    demoHtml: string
  }
  prerequisites: ResolvedLink[]
  leadsTo: ResolvedLink[]
  related: ResolvedLink[]
  prevInDomain: Neighbor | null
  nextInDomain: Neighbor | null
}

const stripInternalMeta = (meta: ConceptMeta): ConceptMetaPublic => {
  const { _dirPath, _conceptYamlPath, _contentMdxPath, _vizPath, ...publicMeta } = meta
  return publicMeta
}

const parseMdxSections = (raw: string): { intuition: string; math: string; code: string; demo: string } => {
  const normalized = raw.replace(/\r\n/g, '\n')

  // Strip frontmatter if present.
  const fm = /^---\n[\s\S]*?\n---\n/.exec(normalized)
  const body = fm ? normalized.slice(fm[0].length) : normalized

  const headingRe = /^##\s+(.+)\s*$/gm
  const headings: Array<{ title: string; start: number; contentStart: number }> = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(body))) {
    headings.push({ title: m[1].trim(), start: m.index, contentStart: headingRe.lastIndex })
  }

  const sections = new Map<string, string>()
  for (let i = 0; i < headings.length; i++) {
    const h = headings[i]
    const end = headings[i + 1]?.start ?? body.length
    const content = body.slice(h.contentStart, end).trim()
    sections.set(h.title, content)
  }

  return {
    intuition: sections.get('Intuition') ?? '',
    math: sections.get('Math') ?? '',
    code: sections.get('Code') ?? '',
    demo: sections.get('Interactive Demo') ?? '',
  }
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { loadConceptMetas } = await import('../../../lib/contentLoader')
  const concepts = loadConceptMetas()

  return {
    paths: concepts.map((c) => ({ params: { domain: c.domain, slug: c.slug } })),
    fallback: false,
  }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const domainId = String(params?.domain ?? '')
  const slug = String(params?.slug ?? '')

  const { loadDomains, loadConceptMetas } = await import('../../../lib/contentLoader')

  const domains = loadDomains()
  const domain = domains.find((d) => d.id === domainId)
  if (!domain) return { notFound: true }

  const metas = loadConceptMetas()
  const meta = metas.find((m) => m.domain === domainId && m.slug === slug)
  if (!meta) return { notFound: true }

  const fs = await import('node:fs')
  const mdxRaw = fs.readFileSync(meta._contentMdxPath, 'utf8')
  const parsed = parseMdxSections(mdxRaw)

  const [
    mdxMod,
    mdxReactMod,
    remarkMathMod,
    rehypeKatexMod,
    rehypeSlugMod,
    serverMod,
    runtime,
  ] = await Promise.all([
    import('@mdx-js/mdx'),
    import('@mdx-js/react'),
    import('remark-math'),
    import('rehype-katex'),
    import('rehype-slug'),
    import('react-dom/server'),
    import('react/jsx-runtime'),
  ] as const)

  const { compile, run } = mdxMod
  const { useMDXComponents } = mdxReactMod

  // Some remark/rehype plugins are published as ESM default exports but may be
  // loaded through CJS interop depending on the environment.
  const remarkMath = remarkMathMod.default ?? remarkMathMod
  const rehypeKatex = rehypeKatexMod.default ?? rehypeKatexMod
  const rehypeSlug = rehypeSlugMod.default ?? rehypeSlugMod

  const { renderToStaticMarkup } = serverMod

  const compileToHtml = async (mdx: string): Promise<string> => {
    if (!mdx.trim()) return ''

    const compiled = await compile(mdx, {
      outputFormat: 'function-body',
      providerImportSource: '@mdx-js/react',
      remarkPlugins: [remarkMath],
      rehypePlugins: [[rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }], rehypeSlug],
    })

    const evaluated = await run(compiled, { ...runtime, useMDXComponents })
    const MDXContent = (evaluated as unknown as { default: ComponentType<Record<string, unknown>> }).default

    // Important: render through React so hooks (useMDXComponents) have a valid dispatcher.
    return renderToStaticMarkup(runtime.jsx(MDXContent, {}))
  }

  const [intuitionHtml, mathHtml, codeHtml] = await Promise.all([
    compileToHtml(parsed.intuition),
    compileToHtml(parsed.math),
    compileToHtml(parsed.code),
  ])

  const demoHtml = await compileToHtml(parsed.demo)

  // Resolve cross-links (prefer content/ concepts; fall back to legacy /foundations when possible).
  const contentIndex = new Map(metas.map((m) => [m.id, m] as const))

  let legacyIds = new Set<string>()
  try {
    const legacy = await import('../../../data/foundationsData')
    legacyIds = new Set(legacy.foundationsConcepts.map((c) => c.id))
  } catch {
    // Legacy import is best-effort; content pages still work without it.
  }

  const linkFor = (id: string): ResolvedLink => {
    const content = contentIndex.get(id)
    if (content) {
      return { id, title: content.title, href: `/domains/${content.domain}/${content.slug}/` }
    }
    if (legacyIds.has(id)) {
      return { id, href: `/foundations/${id}/` }
    }
    return { id }
  }

  const conceptPublic = stripInternalMeta(meta)

  const prerequisites = (conceptPublic.prerequisites ?? []).map(linkFor)
  const leadsTo = (conceptPublic.leads_to ?? []).map(linkFor)
  const related = (conceptPublic.related ?? []).map(linkFor)

  // Prev/next within the same domain (stable sort by title).
  const inDomain = metas.filter((m) => m.domain === domainId).slice().sort((a, b) => a.title.localeCompare(b.title))
  const idx = inDomain.findIndex((m) => m.id === meta.id)

  const prev = idx > 0 ? inDomain[idx - 1] : null
  const next = idx >= 0 && idx < inDomain.length - 1 ? inDomain[idx + 1] : null

  return {
    props: {
      domainTitle: domain.title,
      concept: conceptPublic,
      sections: {
        intuitionHtml,
        mathHtml,
        codeHtml,
        demoHtml,
      },
      prerequisites,
      leadsTo,
      related,
      prevInDomain: prev ? { title: prev.title, href: `/domains/${prev.domain}/${prev.slug}/` } : null,
      nextInDomain: next ? { title: next.title, href: `/domains/${next.domain}/${next.slug}/` } : null,
    },
  }
}

export default function ConceptPage({
  domainTitle,
  concept,
  sections,
  prerequisites,
  leadsTo,
  related,
  prevInDomain,
  nextInDomain,
}: Props) {
  const Viz = contentConceptVizMap[concept.id]

  const hasDemo = Boolean(Viz)

  return (
    <div>
      <Head>
        <title>{concept.title} — {domainTitle} — Continuous Function</title>
        {concept.short_description ? (
          <meta name="description" content={concept.short_description} />
        ) : null}
      </Head>

      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href="/domains/">Domains</Link>
        <span className="breadcrumb-sep">/</span>
        <Link href={`/domains/${concept.domain}/`}>{domainTitle}</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">{concept.title}</span>
      </nav>

      <section className="hero">
        <h1>{concept.title}</h1>
        {concept.short_description ? <p className="hero-tagline">{concept.short_description}</p> : null}

        <div className="meta-row">
          <span className={`badge status ${concept.status}`}>{concept.status}</span>
          <span className={`badge importance ${concept.importance}`}>{concept.importance}</span>
          <span className="badge">difficulty: {concept.difficulty}/5</span>
          <span className="badge">math: {concept.math_level || '—'}</span>
          <span className="badge">read: {concept.estimated_read_time || 0}m</span>
          {hasDemo ? <span className="badge demo">demo</span> : <span className="badge muted">no demo yet</span>}
        </div>

        {concept.tags?.length ? (
          <div className="tags">
            {concept.tags.slice(0, 10).map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        ) : null}
      </section>

      <section className="link-section">
        {prerequisites.length > 0 ? (
          <div className="link-block">
            <h2 className="link-title">Prerequisites</h2>
            <div className="link-list">
              {prerequisites.map((p) => (
                p.href ? (
                  <Link key={p.id} href={p.href} className="chip">
                    {p.title ?? p.id}
                  </Link>
                ) : (
                  <span key={p.id} className="chip disabled">{p.id}</span>
                )
              ))}
            </div>
          </div>
        ) : null}

        {leadsTo.length > 0 ? (
          <div className="link-block">
            <h2 className="link-title">Leads To</h2>
            <div className="link-list">
              {leadsTo.map((p) => (
                p.href ? (
                  <Link key={p.id} href={p.href} className="chip">
                    {p.title ?? p.id}
                  </Link>
                ) : (
                  <span key={p.id} className="chip disabled">{p.id}</span>
                )
              ))}
            </div>
          </div>
        ) : null}

        {related.length > 0 ? (
          <div className="link-block">
            <h2 className="link-title">Related</h2>
            <div className="link-list">
              {related.map((p) => (
                p.href ? (
                  <Link key={p.id} href={p.href} className="chip">
                    {p.title ?? p.id}
                  </Link>
                ) : (
                  <span key={p.id} className="chip disabled">{p.id}</span>
                )
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="content">
        <h2>Intuition</h2>
        <div className="content-html" dangerouslySetInnerHTML={{ __html: sections.intuitionHtml }} />

        <h2>Math</h2>
        <div className="content-html" dangerouslySetInnerHTML={{ __html: sections.mathHtml }} />

        <h2>Code</h2>
        <div className="content-html" dangerouslySetInnerHTML={{ __html: sections.codeHtml }} />

        <h2>Interactive Demo</h2>
        {sections.demoHtml ? (
          <div className="content-html" dangerouslySetInnerHTML={{ __html: sections.demoHtml }} />
        ) : null}
        {Viz ? (
          <div className="demo">
            <Viz />
          </div>
        ) : (
          <p className="muted">No interactive demo yet. Add a <code>viz.tsx</code> next to this concept to enable it.</p>
        )}
      </section>

      {(prevInDomain || nextInDomain) ? (
        <nav className="pager" aria-label="Domain navigation">
          {prevInDomain ? (
            <Link href={prevInDomain.href} className="pager-link">
              <span className="pager-kicker">Previous</span>
              <span className="pager-title">{prevInDomain.title}</span>
            </Link>
          ) : (
            <span />
          )}
          {nextInDomain ? (
            <Link href={nextInDomain.href} className="pager-link" style={{ textAlign: 'right' }}>
              <span className="pager-kicker">Next</span>
              <span className="pager-title">{nextInDomain.title}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}

      <style jsx>{`
        .breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          color: var(--text-muted);
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
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

        .meta-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .badge {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          padding: 0.18rem 0.5rem;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          color: var(--text-muted);
          background: rgba(8, 12, 20, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.06em;
          white-space: nowrap;
        }

        .badge.muted {
          opacity: 0.7;
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
          margin-top: 0.9rem;
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

        .link-section {
          margin-top: 1.5rem;
          padding: 1.25rem;
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
        }

        .link-block + .link-block {
          margin-top: 1rem;
        }

        .link-title {
          margin: 0 0 0.6rem 0;
          font-size: 1rem;
          padding-left: 0;
        }

        .link-title::before {
          content: none;
        }

        .link-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          padding: 0.35rem 0.6rem;
          border-radius: 999px;
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          text-decoration: none;
          font-size: 0.85rem;
        }

        .chip:hover {
          border-color: var(--converge-teal);
          color: var(--text-primary);
        }

        .chip.disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .content {
          margin-top: 2rem;
        }

        .content-html :global(pre) {
          margin: 1rem 0;
          padding: 1rem 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.55);
          overflow-x: auto;
        }

        .content-html :global(pre code) {
          border: none;
          background: transparent;
          padding: 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
          display: block;
          line-height: 1.6;
        }

        .demo {
          margin-top: 1rem;
          padding: 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.25);
        }

        .muted {
          color: var(--text-muted);
        }

        .pager {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-top: 2.5rem;
        }

        .pager-link {
          display: block;
          padding: 1rem;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.25);
          text-decoration: none;
        }

        .pager-link:hover {
          border-color: var(--converge-teal);
        }

        .pager-kicker {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: var(--text-muted);
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .pager-title {
          display: block;
          margin-top: 0.4rem;
          color: var(--text-primary);
          font-family: var(--font-display);
          font-size: 1rem;
        }

        @media (max-width: 720px) {
          .pager {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
