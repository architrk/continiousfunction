import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import katex from 'katex'
import ExperienceBridge from '@/components/editorial/ExperienceBridge'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import { FoundationConceptHeroFigure } from '@/components/editorial/EditorialFigures'
import type { Concept } from '../../data/foundationsData'
import NextMovesPanel from '@/components/foundations/NextMovesPanel'
import { sanitizeRenderedHtml } from '../../lib/htmlSafety'

const FoundationsVizDeck = dynamic(() => import('@/components/foundations/FoundationsVizDeck'), { ssr: false })

const CATEGORY_LABELS = {
  core: 'Core Training',
  optimization: 'Optimization',
  generative: 'Generative Models',
  representation: 'Representations',
  scaling: 'Scaling & Alignment',
  efficiency: 'Efficiency',
  theory: 'Theory',
} as const

type ConceptLink = Pick<Concept, 'id' | 'color' | 'icon' | 'shortTitle'>

interface Props {
  concept: Concept
  prevConcept: Concept | null
  nextConcept: Concept | null
  studyPhase: { phase: number; title: string } | null
  migratedHref: string | null
  totalConcepts: number
  prereqConcepts: ConceptLink[]
  dependentConcepts: ConceptLink[]
}

// Escape HTML entities to prevent XSS in fallback rendering
const escapeHtml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

// Strip lightweight inline markup for meta descriptions (avoid leaking KaTeX/markdown symbols into <meta>).
const toPlainText = (raw: string): string => {
  return raw
    .replace(/\$\$[\s\S]*?\$\$/g, '') // display math
    .replace(/\$[^$]+\$/g, '') // inline math
    .replace(/\*\*([^*]+)\*\*/g, '$1') // bold
    .replace(/\*([^*\n]+)\*/g, '$1') // italics
    .replace(/`([^`]+)`/g, '$1') // code
    .replace(/\s+/g, ' ')
    .trim()
}

// Render LaTeX string to HTML (safe defaults: no trust, no throw)
const renderLatex = (latex: string, displayMode: boolean = false): string => {
  try {
    return sanitizeRenderedHtml(
      katex.renderToString(latex, {
        displayMode,
        throwOnError: false,
        strict: 'warn',
        trust: false,
      })
    )
  } catch (e) {
    console.error('KaTeX error:', e)
    return `<code>${escapeHtml(latex)}</code>`
  }
}

const getSafeExternalHref = (rawUrl?: string): string | null => {
  if (!rawUrl) return null
  try {
    const url = new URL(rawUrl)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch {
    return null
  }
}

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  // Prevent escaped dollars (\$) from being interpreted as math delimiters.
  // We restore them differently in latex vs plain text.
  const DOLLAR_SENTINEL = '__ESCAPED_DOLLAR__'
  const prepared = text.replace(/\\\$/g, DOLLAR_SENTINEL)

  // Split by display math ($$...$$), inline math ($...$), bold (**...**), italics (*...*), and code (`...`)
  const parts = prepared.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$|\*\*[^*]+\*\*|\*[^*\n]+\*|`[^`]+`)/g)

  return parts
    .filter(Boolean)
    .map((segment, j) => {
      // Display math block within text
      if (segment.startsWith('$$') && segment.endsWith('$$')) {
        const latex = segment.slice(2, -2).trim().replaceAll(DOLLAR_SENTINEL, '\\$')
        return (
          <span
            key={`${keyPrefix}-seg-${j}`}
            className="inline-block-math"
            dangerouslySetInnerHTML={{ __html: renderLatex(latex, true) }}
          />
        )
      }

      // Inline math
      if (segment.startsWith('$') && segment.endsWith('$') && !segment.startsWith('$$')) {
        const latex = segment.slice(1, -1).replaceAll(DOLLAR_SENTINEL, '\\$')
        return (
          <span
            key={`${keyPrefix}-seg-${j}`}
            className="inline-math"
            dangerouslySetInnerHTML={{ __html: renderLatex(latex, false) }}
          />
        )
      }

      // Bold text
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={`${keyPrefix}-seg-${j}`}>{segment.slice(2, -2).replaceAll(DOLLAR_SENTINEL, '$')}</strong>
      }

      // Italic text (minimal support for emphasis like *this*)
      if (
        segment.length >= 3 &&
        segment.startsWith('*') &&
        segment.endsWith('*') &&
        !segment.startsWith('**')
      ) {
        return <em key={`${keyPrefix}-seg-${j}`}>{segment.slice(1, -1).replaceAll(DOLLAR_SENTINEL, '$')}</em>
      }

      // Inline code
      if (segment.startsWith('`') && segment.endsWith('`')) {
        return <code key={`${keyPrefix}-seg-${j}`}>{segment.slice(1, -1).replaceAll(DOLLAR_SENTINEL, '$')}</code>
      }

      // Plain text (preserve line breaks for readability)
      const restored = segment.replaceAll(DOLLAR_SENTINEL, '$')
      const lines = restored.split('\n')
      if (lines.length === 1) {
        return <span key={`${keyPrefix}-seg-${j}`}>{restored}</span>
      }
      return (
        <span key={`${keyPrefix}-seg-${j}`}>
          {lines.map((lineText, k) => (
            <span key={`${keyPrefix}-seg-${j}-line-${k}`}>
              {lineText}
              {k < lines.length - 1 ? <br /> : null}
            </span>
          ))}
        </span>
      )
    })
}

// Render LaTeX content with KaTeX
function MathContent({ content }: { content: string }) {
  type Block =
    | { type: 'p'; text: string }
    | { type: 'hr' }
    | { type: 'heading'; level: 2 | 3 | 4; text: string }
    | { type: 'ul'; items: string[] }
    | { type: 'ol'; items: string[] }
    | { type: 'math'; latex: string }
    | { type: 'code'; code: string }

  const parseBlocks = (raw: string): Block[] => {
    const lines = raw.replace(/\r\n/g, '\n').split('\n')
    const blocks: Block[] = []
    let paragraphLines: string[] = []

    const flushParagraph = () => {
      const text = paragraphLines.join('\n').trim()
      if (text) blocks.push({ type: 'p', text })
      paragraphLines = []
    }

    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      const trimmed = line.trim()

      // Blank line: end current paragraph/list context
      if (trimmed === '') {
        flushParagraph()
        i += 1
        continue
      }

      // Horizontal rule
      if (trimmed === '---') {
        flushParagraph()
        blocks.push({ type: 'hr' })
        i += 1
        continue
      }

      // Fenced code block (```lang ... ```)
      if (trimmed.startsWith('```')) {
        flushParagraph()
        const codeLines: string[] = []
        i += 1
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i += 1
        }
        if (i < lines.length && lines[i].trim().startsWith('```')) i += 1
        blocks.push({ type: 'code', code: codeLines.join('\n') })
        continue
      }

      // Headings (used inside some coreMath entries)
      const headingMatch = line.match(/^(#{2,4})\s+(.*)$/)
      if (headingMatch) {
        flushParagraph()
        const level = headingMatch[1].length as 2 | 3 | 4
        blocks.push({ type: 'heading', level, text: headingMatch[2].trim() })
        i += 1
        continue
      }

      // Fenced code block (``` ... ```)
      if (trimmed.startsWith('```')) {
        flushParagraph()
        const codeLines: string[] = []
        i += 1
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          codeLines.push(lines[i])
          i += 1
        }
        if (i < lines.length) i += 1 // skip closing fence
        blocks.push({ type: 'code', code: codeLines.join('\n') })
        continue
      }

      // Unordered list
      const ulMatch = line.match(/^\s*-\s+(.*)$/)
      if (ulMatch) {
        flushParagraph()
        const items: string[] = []
        while (i < lines.length) {
          const m = lines[i].match(/^\s*-\s+(.*)$/)
          if (!m) break
          items.push(m[1])
          i += 1
        }
        blocks.push({ type: 'ul', items })
        continue
      }

      // Ordered list
      const olMatch = line.match(/^\s*(\d+)\.\s+(.*)$/)
      if (olMatch) {
        flushParagraph()
        const items: string[] = []
        while (i < lines.length) {
          const m = lines[i].match(/^\s*(\d+)\.\s+(.*)$/)
          if (!m) break
          items.push(m[2])
          i += 1
        }
        blocks.push({ type: 'ol', items })
        continue
      }

      // Math block (line starts with $$ ... $$ or a multi-line $$ block)
      if (trimmed.startsWith('$$')) {
        flushParagraph()

        // Single-line $$...$$
        if (trimmed.endsWith('$$') && trimmed !== '$$') {
          const latex = trimmed.replace(/^\$\$\s*/, '').replace(/\s*\$\$$/, '').trim()
          blocks.push({ type: 'math', latex })
          i += 1
          continue
        }

        // Multi-line $$ ... $$ (supports "$$" on its own line or "$$ latex" opening)
        const latexLines: string[] = []
        const openRemainder = line.slice(line.indexOf('$$') + 2)
        if (openRemainder.trim() !== '') latexLines.push(openRemainder)
        i += 1

        while (i < lines.length) {
          const l = lines[i]
          const closeIdx = l.indexOf('$$')
          if (closeIdx !== -1) {
            const before = l.slice(0, closeIdx)
            if (before.trim() !== '') latexLines.push(before)
            i += 1
            break
          }
          latexLines.push(l)
          i += 1
        }

        blocks.push({ type: 'math', latex: latexLines.join('\n').trim() })
        continue
      }

      // Default: paragraph text
      paragraphLines.push(line)
      i += 1
    }

    flushParagraph()
    return blocks
  }

  const blocks = parseBlocks(content)

  return (
    <div className="math-text">
      {blocks.map((block, i) => {
        if (block.type === 'hr') {
          return <hr key={`b-${i}`} className="math-hr" />
        }

        if (block.type === 'code') {
          return (
            <pre key={`b-${i}`} className="math-code">
              <code>{block.code}</code>
            </pre>
          )
        }

        if (block.type === 'heading') {
          const HeadingTag = block.level === 2 ? 'h3' : block.level === 3 ? 'h4' : 'h5'
          return (
            <HeadingTag key={`b-${i}`} className="math-heading">
              {renderInline(block.text, `b-${i}`)}
            </HeadingTag>
          )
        }

        if (block.type === 'math') {
          return (
            <div
              key={`b-${i}`}
              className="math-block"
              role="math"
              aria-label="Mathematical equation"
              dangerouslySetInnerHTML={{ __html: renderLatex(block.latex, true) }}
            />
          )
        }

        if (block.type === 'ul') {
          return (
            <ul key={`b-${i}`} className="math-list">
              {block.items.map((item, j) => (
                <li key={`b-${i}-li-${j}`}>{renderInline(item, `b-${i}-li-${j}`)}</li>
              ))}
            </ul>
          )
        }

        if (block.type === 'ol') {
          return (
            <ol key={`b-${i}`} className="math-list">
              {block.items.map((item, j) => (
                <li key={`b-${i}-li-${j}`}>{renderInline(item, `b-${i}-li-${j}`)}</li>
              ))}
            </ol>
          )
        }

        // Paragraph
        return <p key={`b-${i}`}>{renderInline(block.text, `b-${i}`)}</p>
      })}
      <style jsx>{`
        .math-text p {
          margin: 0 0 1rem;
          line-height: 1.8;
        }
        .math-heading {
          margin: 1.5rem 0 0.75rem;
          line-height: 1.3;
          font-weight: 650;
        }
        .math-text h3.math-heading {
          font-size: 1.15rem;
        }
        .math-text h4.math-heading {
          font-size: 1.05rem;
          opacity: 0.95;
        }
        .math-text h5.math-heading {
          font-size: 1rem;
          opacity: 0.9;
        }
        .math-hr {
          border: none;
          border-top: 1px solid rgba(31, 111, 120, 0.22);
          margin: 1.5rem 0;
        }
        .math-list {
          margin: 0 0 1rem 1.25rem;
          padding: 0;
          line-height: 1.8;
        }
        .math-list li {
          margin: 0.25rem 0;
        }
        .math-code {
          background: rgba(248, 243, 234, 0.92);
          border: 1px solid rgba(27, 36, 48, 0.08);
          padding: 0.9rem 1rem;
          border-radius: 10px;
          margin: 1rem 0 1.5rem;
          overflow-x: auto;
          white-space: pre;
        }
        .math-code code {
          font-family: var(--font-mono);
          font-size: 0.9rem;
          line-height: 1.5;
          color: #17202a;
        }
        .math-block {
          background: rgba(239, 247, 245, 0.78);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          overflow-x: auto;
          border-left: 3px solid #1f6f78;
        }
        .math-code {
          background: rgba(248, 243, 234, 0.92);
          padding: 1rem 1.25rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          overflow-x: auto;
          border-left: 3px solid rgba(31, 111, 120, 0.24);
        }
        .math-text :global(.inline-math) {
          background: rgba(239, 247, 245, 0.9);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
        }
        .math-text :global(.inline-block-math) {
          display: block;
          margin: 1rem 0;
        }
        .math-text :global(.katex) {
          font-size: 1.1em;
        }
        .math-text :global(.katex-display) {
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          border-left: none !important;
        }
        .math-text :global(.katex-display > .katex) {
          text-align: left;
        }
      `}</style>
    </div>
  )
}

export default function ConceptPage({
  concept,
  prevConcept,
  nextConcept,
  studyPhase,
  migratedHref,
  totalConcepts,
  prereqConcepts,
  dependentConcepts,
}: Props) {
  const conceptLede = toPlainText(concept.whyItMatters[0] || concept.title)
  const categoryLabel = CATEGORY_LABELS[concept.category as keyof typeof CATEGORY_LABELS]
  const bridgeItems = [
    {
      label: 'Orient',
      title: 'Read the mechanism before the demo.',
      body: 'The legacy page starts with why the concept matters and what common explanations skip, so the visualization has a job.',
      href: '#why-it-matters',
      cta: 'Start there',
    },
    {
      label: 'Test',
      title: 'Treat the old dark panel as the lab bench.',
      body: 'The visualization deck stays in place here because many legacy demos are still the best runnable witness for the concept.',
      href: '#interactive-viz',
      cta: 'Open demo',
    },
    migratedHref
      ? {
          label: 'Upgrade',
          title: 'A newer notebook exists.',
          body: 'When a concept has been migrated, the domain notebook is the preferred Intuition -> Math -> Code -> Demo version.',
          href: migratedHref,
          cta: 'Open notebook',
        }
      : {
          label: 'Continue',
          title: 'Use connections to choose the next move.',
          body: 'Prerequisites, dependents, and semantic links keep the old page from becoming a dead end.',
          href: '#connections',
          cta: 'Trace links',
        },
  ]

  return (
    <>
      <Head>
        <title>{`${concept.shortTitle} — Continuous Function`}</title>
        <meta name="description" content={conceptLede} />
        {prevConcept && <link rel="prev" href={`/foundations/${prevConcept.id}/`} />}
        {nextConcept && <link rel="next" href={`/foundations/${nextConcept.id}/`} />}
      </Head>
      <NotebookLayout
        eyebrow="Legacy Concept Lab"
        title={concept.title}
        lede={conceptLede}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Foundations', href: '/foundations/' },
          { label: concept.shortTitle },
        ]}
        meta={[
          `Concept ${concept.number} of ${totalConcepts}`,
          categoryLabel,
          studyPhase ? `Phase ${studyPhase.phase}` : 'Legacy route',
        ]}
        actions={[
          migratedHref
            ? { href: migratedHref, label: 'Open New Notebook' }
            : { href: '#interactive-viz', label: 'Open Demo' },
          { href: '/foundations/#all-concepts', label: 'All Foundations', variant: 'secondary' },
        ]}
        heroVisual={(
          <FoundationConceptHeroFigure
            number={concept.number}
            shortTitle={concept.shortTitle}
            category={categoryLabel}
            color={concept.color}
            equation={concept.coreEquation}
          />
        )}
        rail={(
          <ExperienceBridge
            compact
            eyebrow="Legacy Route"
            title="Bridge the old lab into the new atlas."
            intro="Use this page as a working demo surface, then move through links when a newer notebook is available."
            items={bridgeItems}
          />
        )}
      >
      <div className="concept-page">

        {/* Learning Context Banner */}
        {studyPhase && (
          <div className="learning-context">
            <span className="context-phase">
              Phase {studyPhase.phase}: {studyPhase.title}
            </span>
            <span className="context-position">
              Concept {concept.number} of {totalConcepts}
            </span>
          </div>
        )}

        {migratedHref ? (
          <div className="migration-banner" role="note" aria-label="Migrated concept notice">
            <span className="migration-label">Migrated:</span>
            <Link href={migratedHref} className="migration-link">
              view the updated version in <span className="mono">/domains</span> →
            </Link>
            <span className="migration-hint">
              This <span className="mono">/foundations</span> page is legacy during migration.
            </span>
          </div>
        ) : null}

        <nav className="concept-nav">
          <Link href="/foundations/" className="back-link">
            ← All Concepts
          </Link>
          <div className="nav-arrows">
            {prevConcept && (
              <Link href={`/foundations/${prevConcept.id}/`} className="nav-arrow prev">
                <span className="nav-label">Previous</span>
                <span className="nav-title">{prevConcept.shortTitle}</span>
              </Link>
            )}
            {nextConcept && (
              <Link href={`/foundations/${nextConcept.id}/`} className="nav-arrow next">
                <span className="nav-label">Next</span>
                <span className="nav-title">{nextConcept.shortTitle}</span>
              </Link>
            )}
          </div>
        </nav>

      <main id="main-content" className="concept-content">
        <nav className="content-toc" aria-label="On this page">
          <ul className="toc-list">
            <li><a href="#why-it-matters" className="toc-link">Why it matters</a></li>
            <li><a href="#missing-intuition" className="toc-link">What tutorials skip</a></li>
            <li><a href="#interactive-viz" className="toc-link">Visualization</a></li>
            <li><a href="#core-math" className="toc-link">Math</a></li>
            <li><a href="#papers" className="toc-link">Papers</a></li>
            <li><a href="#connections" className="toc-link">Connections</a></li>
            <li><a href="#next-moves" className="toc-link">Next moves</a></li>
          </ul>
        </nav>

        <section id="why-it-matters" className="content-section">
          <h2>Why It Matters for Modern Models</h2>
          <ul className="insight-list">
            {concept.whyItMatters.map((point, i) => (
              <li key={i}>{renderInline(point, `why-${i}`)}</li>
            ))}
          </ul>
        </section>

        <section id="missing-intuition" className="content-section">
          <h2>What Tutorials Skip</h2>
          <p className="section-intro">
            What is still poorly explained in textbooks and papers:
          </p>
          <ul className="intuition-list">
            {concept.missingIntuition.map((point, i) => (
              <li key={i}>{renderInline(point, `intuition-${i}`)}</li>
            ))}
          </ul>
        </section>

        <section id="interactive-viz" className="content-section viz-section">
          <h2>Interactive Visualization</h2>
          <FoundationsVizDeck conceptId={concept.id} />
        </section>

        <section id="core-math" className="content-section math-section">
          <h2>Core Math (Optional Deep Dive)</h2>
          <p className="section-intro">
            If you want intuition first, start with the key equation and the visualization. Come back here for the full walkthrough.
          </p>
          <div className="key-equation">
            <span className="equation-label">Key Equation</span>
            <div
              className="equation-content"
              role="math"
              aria-label="Key equation"
              dangerouslySetInnerHTML={{
                __html: renderLatex(concept.coreEquation, true)
              }}
            />
          </div>
          <div className="math-content-wrapper">
            <MathContent content={concept.coreMath} />
          </div>
        </section>

        <section id="papers" className="content-section">
          <h2>Canonical Papers</h2>
          <div className="papers-list">
            {concept.canonicalPapers.map((paper, i) => {
              const paperHref = getSafeExternalHref(paper.url)
              return (
                <div key={i} className="paper-card">
                  <h3>{paper.title}</h3>
                  <div className="paper-meta">
                    <span>{paper.authors}</span>
                    <span>{paper.year}</span>
                    {paper.venue && <span>{paper.venue}</span>}
                  </div>
                  {paperHref && (
                    <a
                      href={paperHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="paper-link"
                    >
                      Read paper →
                    </a>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        <section id="connections" className="content-section connections-section">
          <h2>Connections</h2>
          <div className="connections-grid">
            {prereqConcepts.length > 0 && (
              <div className="connection-group">
                <h3>Prerequisites</h3>
                <div className="connection-links">
                  {prereqConcepts.map((prereq) => (
                    <Link
                      key={prereq.id}
                      href={`/foundations/${prereq.id}/`}
                      className="connection-link"
                      style={{ borderColor: prereq.color }}
                    >
                      <span className="connection-icon">{prereq.icon}</span>
                      <span>{prereq.shortTitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {dependentConcepts.length > 0 && (
              <div className="connection-group">
                <h3>Enables</h3>
                <div className="connection-links">
                  {dependentConcepts.map((dep) => (
                    <Link
                      key={dep.id}
                      href={`/foundations/${dep.id}/`}
                      className="connection-link"
                      style={{ borderColor: dep.color }}
                    >
                      <span className="connection-icon">{dep.icon}</span>
                      <span>{dep.shortTitle}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {prereqConcepts.length === 0 && dependentConcepts.length === 0 && (
            <p className="connections-empty">No connections mapped yet for this concept.</p>
          )}
        </section>

        {/* Next Moves - mathematician's mind navigation */}
        <section id="next-moves" className="content-section">
          <NextMovesPanel concept={concept} />
        </section>
      </main>

      <style jsx>{`
        .concept-page {
          max-width: none;
          margin: 0;
          position: relative;
          min-width: 0;
        }

        .skip-link {
          position: absolute;
          left: -999px;
          top: 0.75rem;
          padding: 0.5rem 0.75rem;
          border-radius: 10px;
          background: rgba(8, 12, 20, 0.95);
          border: 1px solid rgba(245, 158, 11, 0.35);
          color: var(--text-primary);
          text-decoration: none;
          z-index: 10;
        }

        .skip-link:focus,
        .skip-link:focus-visible {
          left: 0.75rem;
          outline: 2px solid rgba(245, 158, 11, 0.7);
          outline-offset: 2px;
        }

        /* Breadcrumb */
        .breadcrumb {
          font-size: 0.85rem;
          margin-bottom: 1rem;
          color: var(--text-muted);
        }

        .breadcrumb a {
          color: var(--text-secondary);
          text-decoration: none;
        }

        .breadcrumb a:hover {
          color: var(--accent);
        }

        .breadcrumb-sep {
          margin: 0 0.5rem;
          opacity: 0.5;
        }

        .breadcrumb-current {
          color: var(--text-primary);
        }

        /* Learning Context */
        .learning-context {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.75rem 1rem;
          background: linear-gradient(90deg, rgba(31, 111, 120, 0.1), transparent);
          border-left: 3px solid #1f6f78;
          border-radius: 0 8px 8px 0;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
        }

        .context-phase {
          color: #1f6f78;
          font-weight: 500;
        }

        .context-position {
          color: var(--text-muted);
        }

        .migration-banner {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.6rem;
          padding: 0.75rem 1rem;
          border-radius: 12px;
          border: 1px solid rgba(31, 75, 153, 0.2);
          background: rgba(239, 247, 245, 0.72);
          margin-bottom: 1.5rem;
        }

        .migration-label {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #1f6f78;
          background: rgba(255, 251, 245, 0.78);
          border: 1px solid rgba(31, 111, 120, 0.22);
          border-radius: 999px;
          padding: 0.18rem 0.55rem;
        }

        .migration-link {
          color: #1f4b99;
          text-decoration: none;
          font-weight: 500;
        }

        .migration-link:hover {
          text-decoration: underline;
        }

        .migration-hint {
          color: #52606b;
          font-size: 0.85rem;
        }

        .concept-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(27, 36, 48, 0.08);
        }

        .back-link {
          color: #1f4b99;
          text-decoration: none;
          font-size: 0.9rem;
        }

        .nav-arrows {
          display: flex;
          gap: 1rem;
        }

        .nav-arrow {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.84);
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .nav-arrow:hover {
          border-color: rgba(31, 111, 120, 0.28);
          text-shadow: none;
        }

        .nav-label {
          font-size: 0.7rem;
          color: var(--text-tertiary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 0.25rem;
        }

        .nav-title {
          font-size: 0.85rem;
          color: var(--text-primary);
          font-weight: 500;
        }

        .concept-header {
          margin-bottom: 2rem;
        }

        .concept-meta-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .concept-number {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          font-weight: bold;
          color: #0a0a0a;
        }

        .category-badge {
          padding: 0.25rem 0.75rem;
          border-radius: 4px;
          font-size: 0.75rem;
          font-weight: 500;
        }

        .concept-header h1 {
          font-family: var(--font-display);
          font-size: 2rem;
          line-height: 1.3;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .concept-icon {
          font-size: 2rem;
        }

        .content-toc {
          margin: 0 0 1.5rem;
          padding: 0.75rem;
          background: rgba(255, 251, 245, 0.76);
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 12px;
        }

        .toc-list {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .toc-list li {
          margin: 0;
          padding: 0;
        }

        .toc-link {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 999px;
          text-decoration: none;
          font-size: 0.85rem;
          color: #455361;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          transition: border-color 150ms ease, color 150ms ease, transform 150ms ease;
        }

        .toc-link:hover {
          border-color: rgba(31, 111, 120, 0.28);
          color: #17202a;
          transform: translateY(-1px);
          text-shadow: none;
        }

        .toc-link:focus-visible,
        .connection-link:focus-visible,
        .nav-arrow:focus-visible,
        .back-link:focus-visible {
          outline: 2px solid rgba(245, 158, 11, 0.7);
          outline-offset: 2px;
        }

        .content-section {
          margin-bottom: 3rem;
          scroll-margin-top: 90px;
        }

        .content-section > h2 {
          font-family: var(--font-display);
          font-size: 1.25rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(27, 36, 48, 0.08);
        }

        .papers-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .paper-card {
          background: rgba(255, 251, 245, 0.86);
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          padding: 1rem;
        }

        .paper-card h3 {
          font-size: 1rem;
          margin: 0 0 0.5rem;
        }

        .paper-meta {
          display: flex;
          gap: 1rem;
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin-bottom: 0.5rem;
        }

        .paper-link {
          color: #1f4b99;
          font-size: 0.85rem;
          text-decoration: none;
        }

        .paper-link:hover {
          text-decoration: underline;
        }

        .math-content-wrapper {
          background: rgba(255, 251, 245, 0.86);
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          padding: 1.5rem;
          font-size: 0.95rem;
        }

        .key-equation {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(239, 247, 245, 0.78);
          border-radius: 8px;
          border-left: 3px solid #1f6f78;
        }

        .equation-label {
          display: block;
          font-size: 0.75rem;
          color: #1f6f78;
          font-weight: 600;
          margin-bottom: 0.5rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .equation-content code {
          font-family: var(--font-mono);
          font-size: 1rem;
          color: var(--text-primary);
        }

        /* Avoid double boxing from global .katex-display styling inside the key equation card. */
        .equation-content :global(.katex-display) {
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          border: none !important;
          border-left: none !important;
        }

        .viz-section .visualizations {
          display: flex;
          flex-direction: column;
          gap: 2rem;
        }

        .viz-container {
          background: rgba(8, 12, 20, 0.82);
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 12px;
          padding: 1.5rem;
          overflow-x: auto;
        }

        .viz-container :global(h2) {
          padding-left: 0;
          color: inherit;
          border-bottom: 0;
        }

        .viz-container :global(h2::before) {
          content: none;
          display: none;
        }

        .viz-placeholder {
          margin-top: 0.75rem;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgba(255, 251, 245, 0.84);
          border: 1px dashed rgba(31, 111, 120, 0.28);
        }

        .viz-placeholder-title {
          margin: 0 0 0.35rem;
          font-weight: 650;
          letter-spacing: 0.01em;
        }

        .viz-placeholder-body {
          margin: 0;
          color: var(--text-secondary);
          line-height: 1.7;
        }

        .insight-list,
        .intuition-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .insight-list li,
        .intuition-list li {
          padding: 0.75rem 0 0.75rem 1.5rem;
          position: relative;
          border-bottom: 1px solid rgba(245, 158, 11, 0.1);
          line-height: 1.6;
        }

        .insight-list li:before {
          content: '→';
          position: absolute;
          left: 0;
          color: var(--accent);
        }

        .intuition-list li:before {
          content: '?';
          position: absolute;
          left: 0;
          color: #8b5cf6;
          font-weight: bold;
        }

        .section-intro {
          color: var(--text-secondary);
          margin-bottom: 1rem;
        }

        .connections-section {
          background: linear-gradient(135deg, rgba(239, 247, 245, 0.82), rgba(255, 251, 245, 0.82));
          border: 1px solid rgba(31, 111, 120, 0.18);
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 2rem;
        }

        .connections-section h2 {
          color: #1f6f78;
          margin-bottom: 1.25rem;
        }

        .connections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 2rem;
        }

        .connections-empty {
          margin: 1rem 0 0;
          color: var(--text-secondary);
          font-style: italic;
        }

        .connection-group h3 {
          font-size: 0.85rem;
          margin-bottom: 0.75rem;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .connection-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .connection-link {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.8rem;
          background: rgba(255, 251, 245, 0.88);
          border: 1px solid;
          border-radius: 20px;
          font-size: 0.85rem;
          text-decoration: none;
          color: #17202a;
          transition: all 0.2s;
        }

        .connection-link:hover {
          background: rgba(239, 247, 245, 0.86);
          transform: translateY(-1px);
          text-shadow: none;
        }

        .connection-icon {
          font-size: 1rem;
        }

        @media (max-width: 768px) {
          .concept-header h1 {
            font-size: 1.5rem;
          }

          .nav-arrows {
            display: none;
          }
        }
      `}</style>
    </div>
    </NotebookLayout>
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const { foundationsConcepts } = await import('../../data/foundationsData')
  const paths = foundationsConcepts.map(concept => ({
    params: { id: concept.id }
  }))

  return { paths, fallback: false }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const { foundationsConcepts, getDependents, studyOrder } = await import('../../data/foundationsData')
  const id = params?.id as string
  const conceptIndex = foundationsConcepts.findIndex(c => c.id === id)
  const concept = foundationsConcepts[conceptIndex]

  if (!concept) {
    return { notFound: true }
  }

  const prevConcept = conceptIndex > 0 ? foundationsConcepts[conceptIndex - 1] : null
  const nextConcept = conceptIndex < foundationsConcepts.length - 1
    ? foundationsConcepts[conceptIndex + 1]
    : null
  const studyPhase =
    studyOrder
      .map((phase) =>
        phase.concepts.includes(id)
          ? { phase: phase.phase, title: phase.title }
          : null
      )
      .find(Boolean) ?? null
  const toConceptLink = (entry: Concept): ConceptLink => ({
    id: entry.id,
    color: entry.color,
    icon: entry.icon,
    shortTitle: entry.shortTitle,
  })
  const prereqConcepts = concept.prereqs.flatMap((prereqId) => {
    const entry = foundationsConcepts.find((candidate) => candidate.id === prereqId)
    return entry ? [toConceptLink(entry)] : []
  })
  const dependentConcepts = getDependents(id).flatMap((depId) => {
    const entry = foundationsConcepts.find((candidate) => candidate.id === depId)
    return entry ? [toConceptLink(entry)] : []
  })

  let migratedHref: string | null = null
  try {
    const { loadConceptMetas } = await import('../../lib/contentLoader')
    const metas = loadConceptMetas()
    const meta = metas.find((m) => m.id === id)
    if (meta) migratedHref = `/domains/${meta.domain}/${meta.slug}/`
  } catch {
    // Best-effort: /foundations should remain buildable even if content loader changes.
  }

  return {
    props: {
      concept,
      prevConcept,
      nextConcept,
      studyPhase,
      migratedHref,
      totalConcepts: foundationsConcepts.length,
      prereqConcepts,
      dependentConcepts,
    }
  }
}
