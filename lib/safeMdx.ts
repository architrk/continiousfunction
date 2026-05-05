import type { ComponentType } from 'react'
import { sanitizeRenderedHtml } from './htmlSafety'

export type ConceptMdxSections = {
  intuition: string
  math: string
  code: string
  demo: string
}

export const parseConceptMdxSections = (raw: string): ConceptMdxSections => {
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

const unwrapDefault = <T>(mod: T | { default?: T }): T =>
  (mod && typeof mod === 'object' && 'default' in mod ? (mod as { default?: T }).default ?? mod : mod) as T

type SanitizeSchema = {
  tagNames?: string[]
  attributes?: Record<string, unknown[]>
  protocols?: Record<string, string[]>
}

const unique = <T,>(values: T[]): T[] => Array.from(new Set(values))

const buildSanitizeSchema = (defaultSchema: SanitizeSchema): SanitizeSchema => {
  const attributes = defaultSchema.attributes ?? {}

  return {
    ...defaultSchema,
    tagNames: unique([
      ...(defaultSchema.tagNames ?? []),
      // KaTeX renders trusted MathML; allow the structural tags while keeping
      // scripts, event handlers, and dangerous URL protocols out of content.
      'math',
      'semantics',
      'mrow',
      'mi',
      'mn',
      'mo',
      'msup',
      'msub',
      'msubsup',
      'mfrac',
      'msqrt',
      'mroot',
      'mtext',
      'mspace',
      'mtable',
      'mtr',
      'mtd',
      'annotation',
    ]),
    attributes: {
      ...attributes,
      '*': unique([...(attributes['*'] ?? []), 'className', 'aria-hidden', 'aria-label', 'title']),
      a: unique([...(attributes.a ?? []), 'href', 'title']),
      code: unique([...(attributes.code ?? []), 'className']),
      pre: unique([...(attributes.pre ?? []), 'className']),
      span: unique([...(attributes.span ?? []), 'className', 'aria-hidden']),
      div: unique([...(attributes.div ?? []), 'className']),
      annotation: unique([...(attributes.annotation ?? []), 'encoding']),
    },
    protocols: {
      ...(defaultSchema.protocols ?? {}),
      href: ['http', 'https', 'mailto'],
      src: ['http', 'https'],
    },
  }
}

export const compileSafeMarkdownToHtml = async (markdown: string): Promise<string> => {
  if (!markdown.trim()) return ''

  const [mdxMod, remarkMathMod, rehypeKatexMod, rehypeSlugMod, rehypeSanitizeMod, serverMod, runtime] =
    await Promise.all([
      import('@mdx-js/mdx'),
      import('remark-math'),
      import('rehype-katex'),
      import('rehype-slug'),
      import('rehype-sanitize'),
      import('react-dom/server'),
      import('react/jsx-runtime'),
    ] as const)

  const { compile, run } = mdxMod
  const remarkMath = unwrapDefault(remarkMathMod)
  const rehypeKatex = unwrapDefault(rehypeKatexMod)
  const rehypeSlug = unwrapDefault(rehypeSlugMod)
  const rehypeSanitize = unwrapDefault(rehypeSanitizeMod)
  const defaultSchema = (rehypeSanitizeMod as unknown as { defaultSchema: SanitizeSchema }).defaultSchema

  const compiled = await compile(markdown, {
    // Treat content.mdx as inert markdown. This disables MDX expressions,
    // imports/exports, and JSX component execution from content files.
    format: 'md',
    outputFormat: 'function-body',
    remarkPlugins: [remarkMath],
    rehypePlugins: [
      [rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }],
      rehypeSlug,
      [rehypeSanitize, buildSanitizeSchema(defaultSchema)],
    ],
  })

  const evaluated = await run(compiled, runtime)
  const MarkdownContent = (evaluated as unknown as { default: ComponentType<Record<string, unknown>> }).default
  const html = serverMod.renderToStaticMarkup(runtime.jsx(MarkdownContent, {}))

  return sanitizeRenderedHtml(html)
}
