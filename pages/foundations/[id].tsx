import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import katex from 'katex'
import { foundationsConcepts, Concept, CATEGORY_LABELS, getDependents, studyOrder } from '../../data/foundationsData'
import { conceptVisualizationMap } from '../../data/visualizationMappings'
import NextMovesPanel from '../../components/foundations/NextMovesPanel'

// Helper to find which study phase a concept belongs to
function getStudyPhase(conceptId: string): { phase: number; title: string } | null {
  for (const phase of studyOrder) {
    if (phase.concepts.includes(conceptId)) {
      return { phase: phase.phase, title: phase.title }
    }
  }
  return null
}

interface Props {
  concept: Concept
  prevConcept: Concept | null
  nextConcept: Concept | null
  studyPhase: { phase: number; title: string } | null
  migratedHref: string | null
}

// Lazy load visualizations (client-only chunks; keep SSR stable)
const CrossEntropyViz = dynamic(() => import('../../components/foundations/CrossEntropyViz'), { ssr: false })
const AttentionGeometryViz = dynamic(() => import('../../components/foundations/AttentionGeometryViz'), { ssr: false })
const AdamOptimizerViz = dynamic(() => import('../../components/foundations/AdamOptimizerViz'), { ssr: false })
const LossLandscapeViz = dynamic(() => import('../../components/foundations/LossLandscapeViz'), { ssr: false })
const DoubleDescentViz = dynamic(() => import('../../components/foundations/DoubleDescentViz'), { ssr: false })
const NTKViz = dynamic(() => import('../../components/foundations/NTKViz'), { ssr: false })
const VAEELBOViz = dynamic(() => import('../../components/foundations/VAEELBOViz'), { ssr: false })
const DiffusionScoreViz = dynamic(() => import('../../components/foundations/DiffusionScoreViz'), { ssr: false })
const FlowMatchingViz = dynamic(() => import('../../components/foundations/FlowMatchingViz'), { ssr: false })
const SuperpositionViz = dynamic(() => import('../../components/foundations/SuperpositionViz'), { ssr: false })
const LinearProbeViz = dynamic(() => import('../../components/foundations/LinearProbeViz'), { ssr: false })
const InductionHeadsViz = dynamic(() => import('../../components/foundations/InductionHeadsViz'), { ssr: false })
const ScalingLawsViz = dynamic(() => import('../../components/foundations/ScalingLawsViz'), { ssr: false })
const RLHFViz = dynamic(() => import('../../components/foundations/RLHFViz'), { ssr: false })
const LoRAViz = dynamic(() => import('../../components/foundations/LoRAViz'), { ssr: false })
const InfoBottleneckViz = dynamic(() => import('../../components/foundations/InfoBottleneckViz'), { ssr: false })

// Additional specialized visualizations
const TransformerArchitectureViz = dynamic(() => import('../../components/foundations/TransformerArchitectureViz'), { ssr: false })
const KVCacheViz = dynamic(() => import('../../components/foundations/KVCacheViz'), { ssr: false })
const RoPEViz = dynamic(() => import('../../components/foundations/RoPEViz'), { ssr: false })
const SlidingWindowViz = dynamic(() => import('../../components/foundations/SlidingWindowViz'), { ssr: false })
const NewtonSchulzViz = dynamic(() => import('../../components/foundations/NewtonSchulzViz'), { ssr: false })
const EdgeOfStabilityViz = dynamic(() => import('../../components/foundations/EdgeOfStabilityViz'), { ssr: false })
const GrokkingViz = dynamic(() => import('../../components/foundations/GrokkingViz'), { ssr: false })
const LayerNormViz = dynamic(() => import('../../components/foundations/LayerNormViz'), { ssr: false })
const NeuralScalingViz = dynamic(() => import('../../components/foundations/NeuralScalingViz'), { ssr: false })
const DPOViz = dynamic(() => import('../../components/foundations/DPOViz'), { ssr: false })
const MoERoutingViz = dynamic(() => import('../../components/foundations/MoERoutingViz'), { ssr: false })

// New additions: 3D loss, parallel transport, self-attention, task vectors, backprop, diffusion process
const LossLandscape3DViz = dynamic(() => import('../../components/foundations/LossLandscape3DViz'), { ssr: false })
const ParallelTransportViz = dynamic(() => import('../../components/foundations/ParallelTransportViz'), { ssr: false })
const SelfAttentionViz = dynamic(() => import('../../components/foundations/SelfAttentionViz'), { ssr: false })
const TaskVectorViz = dynamic(() => import('../../components/foundations/TaskVectorViz'), { ssr: false })
const AttentionBackpropViz = dynamic(() => import('../../components/foundations/AttentionBackpropViz'), { ssr: false })
const DiffusionProcessViz = dynamic(() => import('../../components/foundations/DiffusionProcessViz'), { ssr: false })
const KVCacheDashboard = dynamic(() => import('../../components/foundations/KVCacheDashboard'), { ssr: false })
const SpeculativeDecodingViz = dynamic(() => import('../../components/foundations/SpeculativeDecodingViz'), { ssr: false })
const ServingLatencyViz = dynamic(() => import('../../components/foundations/ServingLatencyViz'), { ssr: false })
const KTOViz = dynamic(() => import('../../components/foundations/KTOViz'), { ssr: false })
const RewardHackingViz = dynamic(() => import('../../components/foundations/RewardHackingViz'), { ssr: false })
const SparseAutoencoderViz = dynamic(() => import('../../components/foundations/SparseAutoencoderViz'), { ssr: false })
const TokenizationViz = dynamic(() => import('../../components/foundations/TokenizationViz'), { ssr: false })
const SSMViz = dynamic(() => import('../../components/foundations/SSMViz'), { ssr: false })
const MambaViz = dynamic(() => import('../../components/foundations/MambaViz'), { ssr: false })
const DecodingSamplingViz = dynamic(() => import('../../components/foundations/DecodingSamplingViz'), { ssr: false })
const EquivarianceViz = dynamic(() => import('../../components/foundations/EquivarianceViz'), { ssr: false })
const GQAViz = dynamic(() => import('../../components/foundations/GQAViz'), { ssr: false })
const SwiGLUViz = dynamic(() => import('../../components/foundations/SwiGLUViz'), { ssr: false })
const GANsViz = dynamic(() => import('../../components/foundations/GANsViz'), { ssr: false })

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Each visualization has unique props; union type would be impractical
const vizMap: Record<string, React.ComponentType<any>> = {
  'CrossEntropyViz': CrossEntropyViz,
  'AttentionGeometryViz': AttentionGeometryViz,
  'AdamOptimizerViz': AdamOptimizerViz,
  'LossLandscapeViz': LossLandscapeViz,
  'DoubleDescentViz': DoubleDescentViz,
  'NTKViz': NTKViz,
  'VAEELBOViz': VAEELBOViz,
  'DiffusionScoreViz': DiffusionScoreViz,
  'FlowMatchingViz': FlowMatchingViz,
  'SuperpositionViz': SuperpositionViz,
  'LinearProbeViz': LinearProbeViz,
  'InductionHeadsViz': InductionHeadsViz,
  'ScalingLawsViz': ScalingLawsViz,
  'RLHFViz': RLHFViz,
  'LoRAViz': LoRAViz,
  'InfoBottleneckViz': InfoBottleneckViz,
  // Additional visualizations
  'TransformerArchitectureViz': TransformerArchitectureViz,
  'KVCacheViz': KVCacheViz,
  'RoPEViz': RoPEViz,
  'SlidingWindowViz': SlidingWindowViz,
  'NewtonSchulzViz': NewtonSchulzViz,
  'EdgeOfStabilityViz': EdgeOfStabilityViz,
  'GrokkingViz': GrokkingViz,
  'LayerNormViz': LayerNormViz,
  'NeuralScalingViz': NeuralScalingViz,
  'DPOViz': DPOViz,
  'MoERoutingViz': MoERoutingViz,
  // New additions
  'LossLandscape3DViz': LossLandscape3DViz,
  'ParallelTransportViz': ParallelTransportViz,
  'SelfAttentionViz': SelfAttentionViz,
  'TaskVectorViz': TaskVectorViz,
  'AttentionBackpropViz': AttentionBackpropViz,
  'DiffusionProcessViz': DiffusionProcessViz,
  'KVCacheDashboard': KVCacheDashboard,
  'SpeculativeDecodingViz': SpeculativeDecodingViz,
  'ServingLatencyViz': ServingLatencyViz,
  'KTOViz': KTOViz,
  'RewardHackingViz': RewardHackingViz,
  'SparseAutoencoderViz': SparseAutoencoderViz,
  'TokenizationViz': TokenizationViz,
  'SSMViz': SSMViz,
  'MambaViz': MambaViz,
  'DecodingSamplingViz': DecodingSamplingViz,
  'EquivarianceViz': EquivarianceViz,
  'GQAViz': GQAViz,
  'SwiGLUViz': SwiGLUViz,
  'GANsViz': GANsViz,
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
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: 'warn',
      trust: false,
    })
  } catch (e) {
    console.error('KaTeX error:', e)
    return `<code>${escapeHtml(latex)}</code>`
  }
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const m = hex.trim().match(/^#?([0-9a-fA-F]{6})$/)
  if (!m) return null
  const v = m[1]
  return {
    r: parseInt(v.slice(0, 2), 16),
    g: parseInt(v.slice(2, 4), 16),
    b: parseInt(v.slice(4, 6), 16),
  }
}

const relativeLuminance = (rgb: { r: number; g: number; b: number }): number => {
  const srgbToLinear = (c: number): number => {
    const s = c / 255
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  const r = srgbToLinear(rgb.r)
  const g = srgbToLinear(rgb.g)
  const b = srgbToLinear(rgb.b)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

const contrastRatio = (l1: number, l2: number): number => {
  const a = Math.max(l1, l2)
  const b = Math.min(l1, l2)
  return (a + 0.05) / (b + 0.05)
}

// Pick between near-black and white based on best WCAG contrast against background.
const getReadableTextColor = (bgHex: string): string => {
  const bg = hexToRgb(bgHex)
  if (!bg) return '#0a0a0a'

  const Lbg = relativeLuminance(bg)
  const Ldark = relativeLuminance({ r: 10, g: 10, b: 10 }) // #0a0a0a
  const Llight = 1 // #ffffff

  const darkContrast = contrastRatio(Lbg, Ldark)
  const lightContrast = contrastRatio(Lbg, Llight)
  return darkContrast >= lightContrast ? '#0a0a0a' : '#ffffff'
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
          border-top: 1px solid rgba(245, 158, 11, 0.25);
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
          background: rgba(8, 12, 20, 0.55);
          border: 1px solid rgba(245, 158, 11, 0.18);
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
        }
        .math-block {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          overflow-x: auto;
          border-left: 3px solid var(--accent);
        }
        .math-code {
          background: rgba(0, 0, 0, 0.45);
          padding: 1rem 1.25rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          overflow-x: auto;
          border-left: 3px solid rgba(245, 158, 11, 0.35);
        }
        .math-text :global(.inline-math) {
          background: rgba(245, 158, 11, 0.1);
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

export default function ConceptPage({ concept, prevConcept, nextConcept, studyPhase, migratedHref }: Props) {
  // Get visualizations for this concept
  const vizNames = conceptVisualizationMap[concept.id] || []
  const visualizations = vizNames.map(name => vizMap[name]).filter(Boolean)
  const dependents = getDependents(concept.id)

  return (
    <>
      <Head>
        <title>{`${concept.shortTitle} — Continuous Function`}</title>
        <meta name="description" content={toPlainText(concept.whyItMatters[0] || concept.title)} />
        {prevConcept && <link rel="prev" href={`/foundations/${prevConcept.id}/`} />}
        {nextConcept && <link rel="next" href={`/foundations/${nextConcept.id}/`} />}
      </Head>
      <div className="concept-page">
        <a href="#main-content" className="skip-link">
          Skip to content
        </a>

        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span className="breadcrumb-sep">/</span>
          <Link href="/foundations/">Foundations</Link>
          <span className="breadcrumb-sep">/</span>
          <span className="breadcrumb-current" aria-current="page">{concept.shortTitle}</span>
        </nav>

        {/* Learning Context Banner */}
        {studyPhase && (
          <div className="learning-context">
            <span className="context-phase">
              Phase {studyPhase.phase}: {studyPhase.title}
            </span>
            <span className="context-position">
              Concept {concept.number} of {foundationsConcepts.length}
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

        <header className="concept-header">
          <div className="concept-meta-header">
            <span
              className="concept-number"
              style={{ backgroundColor: concept.color, color: getReadableTextColor(concept.color) }}
            >
              {concept.number}
            </span>
            <span
              className="category-badge"
              style={{
                backgroundColor: `${concept.color}20`,
                color: concept.color
              }}
            >
              {CATEGORY_LABELS[concept.category as keyof typeof CATEGORY_LABELS]}
            </span>
          </div>
          <h1>
            <span className="concept-icon">{concept.icon}</span>
            {concept.title}
          </h1>
        </header>

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
          {visualizations.length > 0 ? (
            <div className="visualizations">
              {visualizations.map((VizComponent, i) => (
                <div key={i} className="viz-container">
                  <VizComponent />
                </div>
              ))}
            </div>
          ) : (
            <div className="viz-placeholder" role="note">
              <p className="viz-placeholder-title">No interactive demo for this concept yet.</p>
              <p className="viz-placeholder-body">
                We will add one soon. For now, use the key equation, the connections, and the "Next Moves" panel
                to build intuition.
              </p>
            </div>
          )}
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
            {concept.canonicalPapers.map((paper, i) => (
              <div key={i} className="paper-card">
                <h3>{paper.title}</h3>
                <div className="paper-meta">
                  <span>{paper.authors}</span>
                  <span>{paper.year}</span>
                  {paper.venue && <span>{paper.venue}</span>}
                </div>
                {paper.url && (
                  <a
                    href={paper.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="paper-link"
                  >
                    Read paper →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <section id="connections" className="content-section connections-section">
          <h2>Connections</h2>
          <div className="connections-grid">
            {concept.prereqs.length > 0 && (
              <div className="connection-group">
                <h3>Prerequisites</h3>
                <div className="connection-links">
                  {concept.prereqs.map(prereqId => {
                    const prereq = foundationsConcepts.find(c => c.id === prereqId)
                    if (!prereq) return null
                    return (
                      <Link
                        key={prereqId}
                        href={`/foundations/${prereqId}/`}
                        className="connection-link"
                        style={{ borderColor: prereq.color }}
                      >
                        <span className="connection-icon">{prereq.icon}</span>
                        <span>{prereq.shortTitle}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
            {dependents.length > 0 && (
              <div className="connection-group">
                <h3>Enables</h3>
                <div className="connection-links">
                  {dependents.map(depId => {
                    const dep = foundationsConcepts.find(c => c.id === depId)
                    if (!dep) return null
                    return (
                      <Link
                        key={depId}
                        href={`/foundations/${depId}/`}
                        className="connection-link"
                        style={{ borderColor: dep.color }}
                      >
                        <span className="connection-icon">{dep.icon}</span>
                        <span>{dep.shortTitle}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {concept.prereqs.length === 0 && dependents.length === 0 && (
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
          max-width: 900px;
          margin: 0 auto;
          position: relative;
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
          background: linear-gradient(90deg, rgba(245, 158, 11, 0.1), transparent);
          border-left: 3px solid var(--accent);
          border-radius: 0 8px 8px 0;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
        }

        .context-phase {
          color: var(--accent);
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
          border: 1px solid rgba(99, 102, 241, 0.35);
          background: rgba(99, 102, 241, 0.10);
          margin-bottom: 1.5rem;
        }

        .migration-label {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(199, 210, 254, 0.95);
          background: rgba(99, 102, 241, 0.22);
          border: 1px solid rgba(99, 102, 241, 0.35);
          border-radius: 999px;
          padding: 0.18rem 0.55rem;
        }

        .migration-link {
          color: #c7d2fe;
          text-decoration: none;
          font-weight: 500;
        }

        .migration-link:hover {
          text-decoration: underline;
        }

        .migration-hint {
          color: rgba(148, 163, 184, 0.95);
          font-size: 0.85rem;
        }

        .concept-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          padding-bottom: 1rem;
          border-bottom: 1px solid rgba(245, 158, 11, 0.15);
        }

        .back-link {
          color: var(--accent);
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
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
        }

        .nav-arrow:hover {
          border-color: var(--accent);
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
          background: rgba(8, 12, 20, 0.35);
          border: 1px solid rgba(245, 158, 11, 0.12);
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
          color: var(--text-secondary);
          border: 1px solid rgba(245, 158, 11, 0.18);
          background: rgba(8, 12, 20, 0.45);
          transition: border-color 150ms ease, color 150ms ease, transform 150ms ease;
        }

        .toc-link:hover {
          border-color: rgba(245, 158, 11, 0.5);
          color: var(--text-primary);
          transform: translateY(-1px);
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

        .content-section h2 {
          font-family: var(--font-display);
          font-size: 1.25rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid rgba(245, 158, 11, 0.15);
        }

        .papers-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .paper-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
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
          color: var(--accent);
          font-size: 0.85rem;
          text-decoration: none;
        }

        .paper-link:hover {
          text-decoration: underline;
        }

        .math-content-wrapper {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 8px;
          padding: 1.5rem;
          font-size: 0.95rem;
        }

        .key-equation {
          margin-top: 1.5rem;
          padding: 1rem;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 8px;
          border-left: 3px solid var(--accent);
        }

        .equation-label {
          display: block;
          font-size: 0.75rem;
          color: var(--accent);
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
          background: rgba(8, 12, 20, 0.3);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
          overflow-x: auto;
        }

        .viz-placeholder {
          margin-top: 0.75rem;
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgba(8, 12, 20, 0.55);
          border: 1px dashed rgba(245, 158, 11, 0.35);
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
          background: linear-gradient(135deg, rgba(20, 184, 166, 0.05), rgba(245, 158, 11, 0.05));
          border: 1px solid rgba(20, 184, 166, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 2rem;
        }

        .connections-section h2 {
          color: var(--converge-teal);
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
          background: rgba(8, 12, 20, 0.8);
          border: 1px solid;
          border-radius: 20px;
          font-size: 0.85rem;
          text-decoration: none;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .connection-link:hover {
          background: rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
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
    </>
  )
}

export const getStaticPaths: GetStaticPaths = async () => {
  const paths = foundationsConcepts.map(concept => ({
    params: { id: concept.id }
  }))

  return { paths, fallback: false }
}

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
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
  const studyPhase = getStudyPhase(id)

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
    }
  }
}
