import { useState } from 'react'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { generateFoundationsGraphData } from '../data/foundationsData'
import { conceptVisualizationMap } from '../data/visualizationMappings'

// Get actual connection count from data
const graphData = generateFoundationsGraphData()
const totalConnections = graphData.links.length
const totalConcepts = graphData.nodes.length
const totalDemos = Object.keys(conceptVisualizationMap).length

// Lazy load the playground to improve initial page load
const GradientDescentPlayground = dynamic(
  () => import('../components/GradientDescentPlayground'),
  { ssr: false, loading: () => <div className="playground-placeholder">Loading interactive demo...</div> }
)

const startingPoints = [
  {
    id: 'newcomer',
    icon: '🌱',
    title: 'New to Deep Learning',
    desc: 'Start with the fundamentals',
    link: '/foundations/maximum-likelihood/',
    linkText: 'Begin with Basics',
    concepts: ['Maximum Likelihood', 'Gradient Descent', 'Backpropagation'],
    recommended: true
  },
  {
    id: 'practitioner',
    icon: '🔧',
    title: 'ML Practitioner',
    desc: 'Understand the models you use',
    link: '/foundations/attention-transformers/',
    linkText: 'Explore Transformers',
    concepts: ['Attention', 'KV Cache', 'RoPE']
  },
  {
    id: 'researcher',
    icon: '🔬',
    title: 'Researcher',
    desc: 'Dive into frontier topics',
    link: '/foundations/scaling-laws/',
    linkText: 'Frontier Research',
    concepts: ['Scaling Laws', 'Grokking', 'Superposition']
  },
  {
    id: 'explorer',
    icon: '🗺️',
    title: 'Just Exploring',
    desc: 'See how everything connects',
    link: '/foundations/',
    linkText: 'Browse All Concepts',
    concepts: [`${totalConcepts} concepts`, `${totalConnections} connections`, '13 learning phases']
  },
]

const pillars = [
  { id: 'sequence-modeling', icon: '∿', title: 'Sequence Modeling', desc: 'Attention, SSMs, Mamba', color: '#14b8a6' },
  { id: 'optimization', icon: '∇', title: 'Optimization', desc: 'Gradient descent as physics', color: '#f59e0b' },
  { id: 'generative-physics', icon: '∂', title: 'Generative Physics', desc: 'Diffusion, flow matching', color: '#8b5cf6' },
  { id: 'geometric-dl', icon: '◇', title: 'Geometric DL', desc: 'Symmetry, equivariance', color: '#ec4899' },
  { id: 'mech-interp', icon: '⊕', title: 'Mech Interp', desc: 'Reverse-engineering', color: '#06b6d4' },
]

const quickLinks = [
  { title: 'Study Path', desc: 'Structured 13-phase curriculum', href: '/foundations/#study-path', icon: '📚' },
  { title: 'Knowledge Graph', desc: 'Visualize concept connections', href: '/foundations/#concept-map', icon: '🕸️' },
  { title: 'All Concepts', desc: `Browse all ${totalConcepts} foundations`, href: '/foundations/#all-concepts', icon: '📖' },
]

export default function HomePage() {
  const [showPlayground, setShowPlayground] = useState(false)

  return (
    <div className="home-page">
      <Head>
        <title>Continuous Function — The Mathematics of Learning</title>
      </Head>

      {/* Hero - Clear value proposition */}
      <section className="hero home-hero">
        <p className="hero-eyebrow">Interactive Explorations</p>
        <h1>Understand Deep Learning<br />from First Principles</h1>
        <p className="hero-tagline">
          {totalConcepts} mathematical concepts explained with interactive visualizations (currently {totalDemos} demos and growing).
          See how ideas connect, from gradient descent to diffusion models.
        </p>
      </section>

      {/* Starting Points - Help users find their path */}
      <section className="starting-points-section">
        <h2 className="section-heading-subtle">Where would you like to start?</h2>
        <div className="starting-points-grid">
          {startingPoints.map((point) => (
            <Link
              key={point.id}
              href={point.link}
              className={`starting-point-card${point.recommended ? ' recommended' : ''}`}
            >
              {point.recommended && <span className="recommended-badge">Good starting point</span>}
              <span className="starting-point-icon">{point.icon}</span>
              <div className="starting-point-content">
                <h3>{point.title}</h3>
                <p>{point.desc}</p>
                <div className="starting-point-concepts">
                  {point.concepts.map((c, i) => (
                    <span key={i} className="concept-pill">{c}</span>
                  ))}
                </div>
              </div>
              <span className="starting-point-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Quick Navigation */}
      <section className="quick-nav-section">
        <div className="quick-nav-links">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href} className="quick-nav-link">
              <span className="quick-nav-icon">{link.icon}</span>
              <span className="quick-nav-text">
                <strong>{link.title}</strong>
                <span>{link.desc}</span>
              </span>
              <span className="quick-nav-arrow">→</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Five Pillars - Visual overview */}
      <section className="pillars-section">
        <h2 className="section-heading">Five Mathematical Pillars</h2>
        <p className="section-desc">
          Deep learning mathematics organized into five interconnected themes.
          Each pillar contains concepts that build on each other.
        </p>
        <div className="pillars-visual">
          {pillars.map((pillar) => (
            <Link key={pillar.id} href={`/pillars/${pillar.id}`} className="pillar-visual-card">
              <span className="pillar-visual-icon" style={{ color: pillar.color }}>{pillar.icon}</span>
              <span className="pillar-visual-title">{pillar.title}</span>
              <span className="pillar-visual-desc">{pillar.desc}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Interactive Demo - Collapsible */}
      <section className="demo-section">
        <button
          className="demo-toggle"
          onClick={() => setShowPlayground(!showPlayground)}
          aria-expanded={showPlayground}
        >
          <span className="demo-toggle-icon">{showPlayground ? '▼' : '▶'}</span>
          <span className="demo-toggle-text">
            <strong>Try an Interactive Demo</strong>
            <span>Experiment with gradient descent</span>
          </span>
        </button>
        {showPlayground && (
          <div className="demo-content">
            <GradientDescentPlayground />
          </div>
        )}
      </section>

      {/* Quick Start - Featured Concepts */}
      <section className="featured-section">
        <h2 className="section-heading-subtle">Dive in anywhere</h2>
        <div className="featured-grid">
          <Link href="/foundations/attention-transformers/" className="featured-card featured-primary">
            <span className="featured-badge">Most Popular</span>
            <span className="featured-icon">⊗</span>
            <h3>Attention</h3>
            <p>The mechanism behind transformers - see how queries find relevant keys</p>
            <span className="featured-cta">Explore →</span>
          </Link>
          <Link href="/foundations/diffusion/" className="featured-card">
            <span className="featured-icon">∂</span>
            <h3>Diffusion</h3>
            <p>From noise to images - the physics of generation</p>
            <span className="featured-cta">Explore →</span>
          </Link>
          <Link href="/foundations/scaling-laws/" className="featured-card">
            <span className="featured-icon">↗</span>
            <h3>Scaling Laws</h3>
            <p>Why bigger models work better (and when they don't)</p>
            <span className="featured-cta">Explore →</span>
          </Link>
        </div>
      </section>

      {/* What makes this different */}
      <section className="features-section">
        <h2 className="section-heading">How This Site Works</h2>
        <div className="features-grid">
          <article className="feature-card">
            <span className="feature-icon">🎯</span>
            <h3>Intuition First</h3>
            <p>
              Concepts start with intuition (interactive demos where available), then build to the math.
              No prerequisites beyond curiosity.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">🔗</span>
            <h3>Connected Knowledge</h3>
            <p>
              See how attention relates to mixture-of-experts, how diffusion
              connects to optimal transport. {totalConnections} typed relationships.
            </p>
          </article>
          <article className="feature-card">
            <span className="feature-icon">🎮</span>
            <h3>Learn by Doing</h3>
            <p>
              Interactive visualizations let you experiment.
              Break things. Discover edge cases. Build real intuition.
            </p>
          </article>
        </div>
      </section>

      <style jsx>{`
        .home-page {
          max-width: 1200px;
          margin: 0 auto;
        }

        .home-hero {
          text-align: center;
          padding: 4rem 0 3rem;
        }

        .hero-eyebrow {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.15em;
          margin-bottom: 1rem;
        }

        .home-hero h1 {
          font-size: clamp(2rem, 5vw, 3rem);
          line-height: 1.2;
          margin-bottom: 1.5rem;
        }

        .home-hero h1::after {
          display: none;
        }

        .home-hero .hero-tagline {
          max-width: 600px;
          margin: 0 auto;
          font-size: 1.1rem;
        }

        /* Starting Points */
        .starting-points-section {
          margin: 2rem 0 3rem;
        }

        .section-heading-subtle {
          font-family: var(--font-body);
          font-size: 1rem;
          font-weight: 500;
          color: var(--text-secondary);
          text-align: center;
          margin-bottom: 1.5rem;
          padding-left: 0;
        }

        /* Remove the § decoration from homepage headings */
        .section-heading-subtle::before,
        .section-heading::before {
          display: none;
        }

        .starting-points-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1rem;
        }

        :global(.starting-point-card) {
          position: relative;
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          padding: 1.25rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
        }

        :global(.starting-point-card:hover) {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1);
        }

        .starting-point-icon {
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .starting-point-content {
          flex: 1;
          min-width: 0;
        }

        .starting-point-content h3 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.25rem;
          color: var(--text-primary);
        }

        .starting-point-content p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0 0 0.75rem;
        }

        .starting-point-concepts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.4rem;
        }

        .concept-pill {
          font-size: 0.7rem;
          padding: 0.15rem 0.5rem;
          background: var(--bg-elevated);
          border-radius: 999px;
          color: var(--text-muted);
        }

        .starting-point-arrow {
          color: var(--accent);
          font-size: 1.25rem;
          opacity: 0.5;
          transition: opacity 0.2s, transform 0.2s;
        }

        :global(.starting-point-card:hover .starting-point-arrow) {
          opacity: 1;
          transform: translateX(4px);
        }

        :global(.starting-point-card.recommended) {
          border-color: rgba(20, 184, 166, 0.3);
          background: linear-gradient(135deg, var(--bg-surface), rgba(20, 184, 166, 0.03));
        }

        :global(.starting-point-card.recommended:hover) {
          border-color: var(--converge-teal);
          box-shadow: 0 4px 20px rgba(20, 184, 166, 0.15);
        }

        :global(.recommended-badge) {
          position: absolute;
          top: -8px;
          left: 16px;
          font-size: 0.65rem;
          font-weight: 600;
          padding: 0.2rem 0.5rem;
          background: var(--converge-teal);
          color: var(--bg-deep);
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }

        /* Quick Navigation */
        .quick-nav-section {
          margin: 2rem 0;
          padding: 1.5rem;
          background: var(--bg-surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
        }

        .quick-nav-links {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
        }

        .quick-nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.25rem;
          text-decoration: none;
          color: var(--text-secondary);
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }

        .quick-nav-link:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .quick-nav-icon {
          font-size: 1.25rem;
        }

        .quick-nav-text {
          display: flex;
          flex-direction: column;
        }

        .quick-nav-text strong {
          font-size: 0.9rem;
          color: var(--text-primary);
        }

        .quick-nav-text span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .quick-nav-arrow {
          color: var(--converge-teal);
          opacity: 0.5;
          transition: opacity 0.2s, transform 0.2s;
        }

        .quick-nav-link:hover .quick-nav-arrow {
          opacity: 1;
          transform: translateX(3px);
        }

        /* Pillars Section */
        .pillars-section {
          margin: 3rem 0;
          text-align: center;
        }

        .section-desc {
          color: var(--text-secondary);
          max-width: 600px;
          margin: 0 auto 2rem;
        }

        .pillars-visual {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 1rem;
        }

        .pillar-visual-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1.5rem 1.25rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          min-width: 140px;
          transition: all 0.2s;
        }

        .pillar-visual-card:hover {
          border-color: var(--border-accent);
          transform: translateY(-3px);
          box-shadow: var(--shadow-glow);
        }

        .pillar-visual-icon {
          font-size: 2rem;
          margin-bottom: 0.5rem;
        }

        .pillar-visual-title {
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--text-primary);
          margin-bottom: 0.25rem;
        }

        .pillar-visual-desc {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        /* Demo Section */
        .demo-section {
          margin: 3rem 0;
        }

        .demo-toggle {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1.25rem 1.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          text-align: left;
          transition: all 0.2s;
        }

        .demo-toggle:hover {
          border-color: var(--converge-teal);
          background: rgba(20, 184, 166, 0.05);
        }

        .demo-toggle-icon {
          color: var(--converge-teal);
          font-size: 0.8rem;
        }

        .demo-toggle-text {
          display: flex;
          flex-direction: column;
        }

        .demo-toggle-text strong {
          color: var(--text-primary);
          font-size: 1rem;
        }

        .demo-toggle-text span {
          color: var(--text-muted);
          font-size: 0.85rem;
        }

        .demo-content {
          margin-top: 1rem;
          animation: slideDown 0.3s ease;
        }

        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .playground-placeholder {
          padding: 3rem;
          text-align: center;
          color: var(--text-muted);
          background: var(--bg-surface);
          border-radius: var(--radius-lg);
        }

        /* Featured Section */
        .featured-section {
          margin: 2rem 0 3rem;
        }

        .featured-grid {
          display: grid;
          grid-template-columns: 1.5fr 1fr 1fr;
          gap: 1rem;
        }

        .featured-card {
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          text-decoration: none;
          color: inherit;
          transition: all 0.2s ease;
        }

        .featured-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
        }

        .featured-primary {
          background: linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(20, 184, 166, 0.05));
          border-color: rgba(245, 158, 11, 0.3);
        }

        .featured-badge {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--accent);
          margin-bottom: 0.5rem;
        }

        .featured-icon {
          font-size: 1.75rem;
          margin-bottom: 0.5rem;
          color: var(--text-secondary);
        }

        .featured-card h3 {
          font-size: 1rem;
          margin: 0 0 0.35rem;
          color: var(--text-primary);
        }

        .featured-card p {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
          flex: 1;
        }

        .featured-cta {
          font-size: 0.85rem;
          color: var(--accent);
          margin-top: 0.75rem;
        }

        /* Features Section */
        .features-section {
          margin: 3rem 0;
        }

        .features-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        .feature-card {
          padding: 1.5rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
        }

        .feature-icon {
          font-size: 1.5rem;
          display: block;
          margin-bottom: 0.75rem;
        }

        .feature-card h3 {
          font-size: 1rem;
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }

        .feature-card p {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.6;
        }

        @media (max-width: 900px) {
          .featured-grid {
            grid-template-columns: 1fr;
          }

          .featured-primary {
            grid-column: auto;
          }
        }

        @media (max-width: 768px) {
          .home-hero {
            padding: 2rem 0;
          }

          .starting-points-grid {
            grid-template-columns: 1fr;
          }

          .pillars-visual {
            gap: 0.75rem;
          }

          .pillar-visual-card {
            min-width: 120px;
            padding: 1rem;
          }

          .quick-nav-links {
            flex-direction: column;
          }
        }
      `}</style>
    </div>
  )
}
