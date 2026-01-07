import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { foundationsConcepts, studyOrder, CATEGORY_COLORS, CATEGORY_LABELS } from '../../data/foundationsData'

// Dynamic import for the graph to avoid SSR issues with D3
const FoundationsGraph = dynamic(
  () => import('../../components/FoundationsGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="graph-loading">
        <div className="loading-spinner" />
        <p>Loading concept map...</p>
        <style jsx>{`
          .graph-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 550px;
            background: rgba(8, 12, 20, 0.5);
            border-radius: 8px;
            border: 1px solid rgba(245, 158, 11, 0.2);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(245, 158, 11, 0.2);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .graph-loading p {
            margin-top: 1rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
)

export default function FoundationsIndex() {
  const router = useRouter()
  const [graphWidth, setGraphWidth] = useState(900)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const updateWidth = () => {
      setGraphWidth(Math.min(900, window.innerWidth - 48))
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const handleNodeClick = (conceptId: string) => {
    router.push(`/foundations/${conceptId}`)
  }

  return (
    <div className="foundations-page">
      <Head>
        <title>Mathematical Foundations — Continuous Function</title>
      </Head>
      <section className="hero">
        <h1>Mathematical Foundations</h1>
        <p className="hero-tagline">
          34 core mathematical concepts that explain how modern AI systems work.
          From maximum likelihood to multimodal vision-language models, these ideas power GPT-4, Claude, Gemini,
          Llama, Stable Diffusion, and Sora.
        </p>
        <div className="hero-actions">
          <Link href="#concept-map" className="btn">
            Explore the Map
          </Link>
          <Link href="#study-path" className="btn ghost">
            Study Path
          </Link>
        </div>
      </section>

      <section id="concept-map" className="graph-section">
        {mounted && (
          <FoundationsGraph
            width={graphWidth}
            height={550}
            onNodeClick={handleNodeClick}
          />
        )}
      </section>

      <section id="study-path" className="study-path-section">
        <h2>Recommended Study Order</h2>
        <p className="muted">
          Build understanding from fundamentals to frontier techniques. Each phase
          builds on the previous one.
        </p>

        <div className="study-phases">
          {studyOrder.map((phase) => (
            <div key={phase.phase} className="phase-card">
              <div className="phase-header">
                <span className="phase-number">{phase.phase}</span>
                <h3>{phase.title}</h3>
              </div>
              <div className="phase-concepts">
                {phase.concepts.map((conceptId) => {
                  const concept = foundationsConcepts.find(c => c.id === conceptId)
                  if (!concept) return null
                  return (
                    <Link
                      key={concept.id}
                      href={`/foundations/${concept.id}`}
                      className="concept-chip"
                      style={{ borderColor: concept.color }}
                    >
                      <span className="concept-icon">{concept.icon}</span>
                      <span className="concept-name">{concept.shortTitle}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="concepts-grid-section">
        <h2>All 34 Concepts</h2>
        <p className="muted">
          Click any concept to explore its canonical papers, core math,
          why it matters for modern models, and missing intuition.
        </p>

        <div className="concepts-grid">
          {foundationsConcepts.map((concept) => (
            <Link
              key={concept.id}
              href={`/foundations/${concept.id}`}
              className="concept-card"
            >
              <div className="concept-card-header">
                <span
                  className="concept-badge"
                  style={{ backgroundColor: concept.color }}
                >
                  {concept.number}
                </span>
                <span className="concept-icon-large">{concept.icon}</span>
              </div>
              <h3>{concept.shortTitle}</h3>
              <p className="concept-full-title">{concept.title}</p>
              <div className="concept-meta">
                <span
                  className="category-tag"
                  style={{
                    backgroundColor: `${concept.color}20`,
                    color: concept.color
                  }}
                >
                  {CATEGORY_LABELS[concept.category as keyof typeof CATEGORY_LABELS]}
                </span>
                <span className="paper-count">
                  {concept.canonicalPapers.length} paper{concept.canonicalPapers.length !== 1 ? 's' : ''}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="cta-section">
        <h2>Why These 34 Concepts?</h2>
        <div className="cta-grid">
          <div className="cta-card">
            <h3>Complete Coverage</h3>
            <p>
              Together, these concepts explain the core mechanisms behind
              language models, diffusion models, and multimodal systems.
            </p>
          </div>
          <div className="cta-card">
            <h3>Missing Intuition</h3>
            <p>
              Each concept includes what's still poorly explained in
              textbooks and papers - the intuition gaps we aim to fill.
            </p>
          </div>
          <div className="cta-card">
            <h3>Connected Knowledge</h3>
            <p>
              See how concepts build on each other. Understand prerequisites
              and what each idea unlocks.
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .foundations-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .hero {
          text-align: center;
          padding: 3rem 0;
        }

        .hero h1 {
          font-family: var(--font-display);
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .hero-tagline {
          max-width: 700px;
          margin: 0 auto 2rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }

        .graph-section {
          margin: 2rem 0;
        }

        .study-path-section {
          margin: 4rem 0;
        }

        .study-path-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .study-phases {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .phase-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .phase-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .phase-number {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: #0a0a0a;
          border-radius: 50%;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .phase-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .phase-concepts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .concept-chip {
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

        .concept-chip:hover {
          background: rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
        }

        .concept-icon {
          font-size: 1rem;
          font-family: var(--font-symbol);
        }

        .concepts-grid-section {
          margin: 4rem 0;
        }

        .concepts-grid-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
        }

        .concepts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .concept-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }

        .concept-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1);
        }

        .concept-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .concept-badge {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: bold;
          color: #0a0a0a;
        }

        .concept-icon-large {
          font-size: 1.5rem;
          font-family: var(--font-symbol);
        }

        .concept-card h3 {
          margin: 0 0 0.25rem;
          font-size: 1.1rem;
        }

        .concept-full-title {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0 0 1rem;
          line-height: 1.4;
        }

        .concept-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .category-tag {
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .paper-count {
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .cta-section {
          margin: 4rem 0;
          text-align: center;
        }

        .cta-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 2rem;
        }

        .cta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 1.5rem;
        }

        .cta-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: left;
        }

        .cta-card h3 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .cta-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .hero h1 {
            font-size: 1.8rem;
          }

          .hero-actions {
            flex-direction: column;
          }

          .concepts-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
