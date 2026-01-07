import Link from 'next/link'
import Head from 'next/head'
import GradientDescentPlayground from '../components/GradientDescentPlayground'

const pillars = [
  { id: 'sequence-modeling', icon: '∿', title: 'Sequence Modeling', desc: 'Attention, SSMs, and Mamba' },
  { id: 'optimization', icon: '∇', title: 'Optimization', desc: 'Gradient descent as physics' },
  { id: 'generative-physics', icon: '∂', title: 'Generative Physics', desc: 'Diffusion and flow matching' },
  { id: 'geometric-dl', icon: '◇', title: 'Geometric DL', desc: 'Symmetry and equivariance' },
  { id: 'mech-interp', icon: '⊕', title: 'Mech Interp', desc: 'Reverse-engineering networks' },
]

export default function HomePage() {
  return (
    <div>
      <Head>
        <title>Continuous Function — The Mathematics of Learning</title>
      </Head>
      <section className="hero">
        <h1>The Mathematics of Learning</h1>
        <p className="hero-tagline">
          Exploring the mathematical foundations of deep learning through interactive visualizations.
          See how concepts connect, from gradient descent to state space models.
        </p>
        <div className="hero-actions">
          <Link href="/foundations" className="btn">
            34 Core Concepts
          </Link>
          <Link href="/pillars" className="btn ghost">
            Five Pillars
          </Link>
        </div>
      </section>

      <section className="content-section">
        <h2 className="section-heading">
          Five Mathematical Pillars
        </h2>
        <div className="pillars-nav">
          {pillars.map((pillar) => (
            <Link key={pillar.id} href={`/pillars/${pillar.id}`} className="pillar-link">
              <span className="pillar-icon">{pillar.icon}</span>
              <span>{pillar.title}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Interactive Explorations</h2>
          <p>
            Read alongside visualizations that update as you scroll.
            Adjust parameters and see immediate changes. Play with the concepts.
          </p>
        </article>
        <article className="card">
          <h2>Connected Ideas</h2>
          <p>
            See how concepts link together. How attention relates to state spaces,
            how diffusion connects to flow matching.
          </p>
          <p>
            Explore the <Link href="/graph">knowledge graph</Link>.
          </p>
        </article>
        <article className="card">
          <h2>Hands-On Understanding</h2>
          <p>
            Adjust learning rates. Watch convergence patterns. Break things.
            Sometimes the best way to understand is to experiment.
          </p>
        </article>
      </section>

      <GradientDescentPlayground />
    </div>
  )
}
