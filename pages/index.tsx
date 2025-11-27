import Link from 'next/link'
import GradientDescentPlayground from '../components/GradientDescentPlayground'

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>Interactive Deep Learning Optimizers</h1>
        <p className="hero-tagline">
          Explorable explanations of optimizers like SGD, AdamW, and Muon, with
          live visualizations and a knowledge graph of concepts.
        </p>
        <div className="hero-actions">
          <Link href="/concepts/optimizers/overview" className="btn">
            Start with Optimizers
          </Link>
          <Link href="/graph" className="btn ghost">
            Explore concept graph
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Modular MDX explainers</h2>
          <p>
            Each concept (SGD, AdamW, Muon, etc.) is its own MDX page with math
            typeset via KaTeX and embedded React widgets for interactivity.
          </p>
        </article>
        <article className="card">
          <h2>Obsidian-style concept map</h2>
          <p>
            Concepts are linked together and rendered as a graph so learners can
            visually explore how ideas connect.
          </p>
          <p>
            Try the <Link href="/graph">Concept Graph</Link>.
          </p>
        </article>
        <article className="card">
          <h2>Static-first, highly interactive</h2>
          <p>
            Built as a static Next.js site, then enhanced with client-side
            visualizations. Easy to host on any CDN.
          </p>
        </article>
      </section>

      <GradientDescentPlayground />
    </div>
  )
}
