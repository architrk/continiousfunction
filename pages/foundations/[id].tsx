import { GetStaticPaths, GetStaticProps } from 'next'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import katex from 'katex'
import { foundationsConcepts, Concept, CATEGORY_LABELS, getDependents } from '../../data/foundationsData'
import { conceptVisualizationMap } from '../../data/visualizationMappings'
import NextMovesPanel from '../../components/foundations/NextMovesPanel'

interface Props {
  concept: Concept
  prevConcept: Concept | null
  nextConcept: Concept | null
}

// Lazy load visualizations - Core 34 concepts
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

// Render LaTeX content with KaTeX
function MathContent({ content }: { content: string }) {
  // Split content into paragraphs
  const paragraphs = content.split('\n\n')

  // Render LaTeX string to HTML
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
      return `<code>${latex}</code>`
    }
  }

  return (
    <div className="math-text">
      {paragraphs.map((para, i) => {
        // Check if this is a math block (starts with $$)
        if (para.trim().startsWith('$$')) {
          const latex = para.replace(/\$\$/g, '').trim()
          return (
            <div
              key={i}
              className="math-block"
              dangerouslySetInnerHTML={{ __html: renderLatex(latex, true) }}
            />
          )
        }

        // Regular paragraph - render with inline formatting
        // Split by display math ($$...$$), inline math ($...$), bold (**...**), and code (`...`)
        const parts = para.split(/(\$\$[\s\S]*?\$\$|\$[^$]+\$|\*\*[^*]+\*\*|`[^`]+`)/g)

        return (
          <p key={i}>
            {parts.map((segment, j) => {
              if (!segment) return null

              // Display math block within paragraph
              if (segment.startsWith('$$') && segment.endsWith('$$')) {
                const latex = segment.slice(2, -2).trim()
                return (
                  <span
                    key={j}
                    className="inline-block-math"
                    dangerouslySetInnerHTML={{ __html: renderLatex(latex, true) }}
                  />
                )
              }
              // Inline math
              if (segment.startsWith('$') && segment.endsWith('$') && !segment.startsWith('$$')) {
                const latex = segment.slice(1, -1)
                return (
                  <span
                    key={j}
                    className="inline-math"
                    dangerouslySetInnerHTML={{ __html: renderLatex(latex, false) }}
                  />
                )
              }
              // Bold text
              if (segment.startsWith('**') && segment.endsWith('**')) {
                return <strong key={j}>{segment.slice(2, -2)}</strong>
              }
              // Inline code
              if (segment.startsWith('`') && segment.endsWith('`')) {
                return <code key={j}>{segment.slice(1, -1)}</code>
              }
              // Plain text
              return segment
            })}
          </p>
        )
      })}
      <style jsx>{`
        .math-text p {
          margin: 0 0 1rem;
          line-height: 1.8;
        }
        .math-block {
          background: rgba(0, 0, 0, 0.3);
          padding: 1rem 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
          overflow-x: auto;
          border-left: 3px solid var(--accent);
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
          margin: 0;
        }
        .math-text :global(.katex-display > .katex) {
          text-align: left;
        }
      `}</style>
    </div>
  )
}

export default function ConceptPage({ concept, prevConcept, nextConcept }: Props) {
  // Get visualizations for this concept
  const vizNames = conceptVisualizationMap[concept.id] || []
  const visualizations = vizNames.map(name => vizMap[name]).filter(Boolean)

  return (
    <>
      <Head>
        <title>{`${concept.shortTitle} — Continuous Function`}</title>
      </Head>
      <div className="concept-page">
        <nav className="concept-nav">
        <Link href="/foundations" className="back-link">
          ← All Concepts
        </Link>
        <div className="nav-arrows">
          {prevConcept && (
            <Link href={`/foundations/${prevConcept.id}`} className="nav-arrow prev">
              <span className="nav-label">Previous</span>
              <span className="nav-title">{prevConcept.shortTitle}</span>
            </Link>
          )}
          {nextConcept && (
            <Link href={`/foundations/${nextConcept.id}`} className="nav-arrow next">
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
            style={{ backgroundColor: concept.color }}
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

      <div className="concept-content">
        <section className="content-section">
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

        <section className="content-section math-section">
          <h2>Core Mathematics</h2>
          <div className="math-content-wrapper">
            <MathContent content={concept.coreMath} />
          </div>
          <div className="key-equation">
            <span className="equation-label">Key Equation</span>
            <div
              className="equation-content"
              dangerouslySetInnerHTML={{
                __html: (() => {
                  try {
                    return katex.renderToString(concept.coreEquation, {
                      displayMode: true,
                      throwOnError: false,
                      strict: 'warn',
                      trust: false,
                    })
                  } catch {
                    return `<code>${concept.coreEquation}</code>`
                  }
                })()
              }}
            />
          </div>
        </section>

        {visualizations.length > 0 && (
          <section className="content-section viz-section">
            <h2>Interactive Visualization</h2>
            <div className="visualizations">
              {visualizations.map((VizComponent, i) => (
                <div key={i} className="viz-container">
                  <VizComponent />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="content-section">
          <h2>Why It Matters for Modern Models</h2>
          <ul className="insight-list">
            {concept.whyItMatters.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="content-section">
          <h2>Missing Intuition</h2>
          <p className="section-intro">
            What is still poorly explained in textbooks and papers:
          </p>
          <ul className="intuition-list">
            {concept.missingIntuition.map((point, i) => (
              <li key={i}>{point}</li>
            ))}
          </ul>
        </section>

        <section className="content-section connections-section">
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
                        href={`/foundations/${prereqId}`}
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
            {getDependents(concept.id).length > 0 && (
              <div className="connection-group">
                <h3>Enables</h3>
                <div className="connection-links">
                  {getDependents(concept.id).map(depId => {
                    const dep = foundationsConcepts.find(c => c.id === depId)
                    if (!dep) return null
                    return (
                      <Link
                        key={depId}
                        href={`/foundations/${depId}`}
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
        </section>

        {/* Next Moves - mathematician's mind navigation */}
        <NextMovesPanel concept={concept} />
      </div>

      <style jsx>{`
        .concept-page {
          max-width: 900px;
          margin: 0 auto;
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

        .content-section {
          margin-bottom: 3rem;
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

        .connections-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 2rem;
        }

        .connection-group h3 {
          font-size: 0.9rem;
          margin-bottom: 0.75rem;
          color: var(--text-secondary);
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

  return {
    props: {
      concept,
      prevConcept,
      nextConcept
    }
  }
}
