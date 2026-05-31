import type { GetStaticPaths, GetStaticProps } from 'next'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import ConceptNotebookPage from '@/components/concepts/ConceptNotebookPage'
import { getConceptImage, type ConceptImage } from '@/lib/conceptImages'
import { extractConceptObjectSpans, type ConceptObjectSpan } from '@/lib/conceptObjectSpans'
import { assertSafeContentMdx, sanitizeContentMdxSource } from '../../../lib/contentMdxSafety'
import type { ConceptMeta } from '../../../lib/contentLoader'
import { compileSafeMarkdownToHtml, parseConceptMdxSections } from '../../../lib/safeMdx'

const ContentConceptViz = dynamic(() => import('@/components/concepts/ContentConceptViz'), { ssr: false })

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
  sectionPrompts: {
    intuition: string
    math: string
    code: string
    demo: string
  }
  objectSpans: ConceptObjectSpan[]
  prerequisites: ResolvedLink[]
  leadsTo: ResolvedLink[]
  related: ResolvedLink[]
  prevInDomain: Neighbor | null
  nextInDomain: Neighbor | null
  conceptImage: ConceptImage | null
}

const stripInternalMeta = (meta: ConceptMeta): ConceptMetaPublic => {
  const { _dirPath, _conceptYamlPath, _contentMdxPath, _vizPath, ...publicMeta } = meta
  return publicMeta
}

const compactPromptSnippet = (raw: string, maxLength = 700): string => {
  const cleaned = raw
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength).trimEnd()}...`
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
  const path = await import('node:path')
  const mdxRaw = fs.readFileSync(meta._contentMdxPath, 'utf8')
  assertSafeContentMdx(mdxRaw, meta._contentMdxPath)
  const parsed = parseConceptMdxSections(sanitizeContentMdxSource(mdxRaw))

  const [intuitionHtml, mathHtml, codeHtml] = await Promise.all([
    compileSafeMarkdownToHtml(parsed.intuition),
    compileSafeMarkdownToHtml(parsed.math),
    compileSafeMarkdownToHtml(parsed.code),
  ])

  const demoHtml = await compileSafeMarkdownToHtml(parsed.demo)
  const objectSpans = extractConceptObjectSpans(parsed)

  // Resolve cross-links (prefer content/ concepts; fall back to legacy /foundations when possible).
  const contentIndex = new Map(metas.map((m) => [m.id, m] as const))

  let legacyIds = new Set<string>()
  try {
    const legacyPath = path.join(process.cwd(), 'data', 'foundationsData.ts')
    const legacyRaw = fs.readFileSync(legacyPath, 'utf8')
    const ids = new Set<string>()
    const idRe = /\bid:\s*'([^']+)'\s*,/g
    let match: RegExpExecArray | null
    while ((match = idRe.exec(legacyRaw))) ids.add(match[1])
    legacyIds = ids
  } catch {
    // Legacy ID scan is best-effort; content pages still work without it.
  }

  const titleizeConceptId = (id: string) =>
    id
      .split('-')
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')

  const linkFor = (rawId: string): ResolvedLink => {
    const plannedPrefix = 'planned:'
    const isPlanned = rawId.startsWith(plannedPrefix)
    const id = isPlanned ? rawId.slice(plannedPrefix.length) : rawId

    if (isPlanned) {
      return { id: rawId, title: `${titleizeConceptId(id)} (planned)` }
    }

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
      sectionPrompts: {
        intuition: compactPromptSnippet(parsed.intuition),
        math: compactPromptSnippet(parsed.math),
        code: compactPromptSnippet(parsed.code),
        demo: compactPromptSnippet(parsed.demo),
      },
      objectSpans,
      prerequisites,
      leadsTo,
      related,
      prevInDomain: prev ? { title: prev.title, href: `/domains/${prev.domain}/${prev.slug}/` } : null,
      nextInDomain: next ? { title: next.title, href: `/domains/${next.domain}/${next.slug}/` } : null,
      conceptImage: getConceptImage(meta.id),
    },
  }
}

export default function ConceptPage({
  domainTitle,
  concept,
  sections,
  sectionPrompts,
  objectSpans,
  prerequisites,
  leadsTo,
  related,
  prevInDomain,
  nextInDomain,
  conceptImage,
}: Props) {
  const Viz = concept.has_visualization
    ? function ConceptViz() {
        return <ContentConceptViz conceptId={concept.id} />
      }
    : undefined

  return (
    <>
      <Head>
        <title>{`${concept.title} — ${domainTitle} — Continuous Function`}</title>
        {concept.short_description ? (
          <meta name="description" content={concept.short_description} />
        ) : null}
      </Head>
      <ConceptNotebookPage
        domainTitle={domainTitle}
        concept={concept}
        sections={sections}
        sectionPrompts={sectionPrompts}
        objectSpans={objectSpans}
        prerequisites={prerequisites}
        leadsTo={leadsTo}
        related={related}
        prevInDomain={prevInDomain}
        nextInDomain={nextInDomain}
        conceptImage={conceptImage}
        Viz={Viz}
      />
    </>
  )
}
