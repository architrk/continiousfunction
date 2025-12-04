import Link from 'next/link'
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
      <section className="hero">
        <h1>The Mathematics of Learning</h1>
        <p className="hero-tagline">
          Interactive explorations of the mathematical foundations of modern deep learning.
          Scroll-synced labs with live visualizations. From gradient descent to Mamba.
        </p>
        <div className="hero-actions">
          <Link href="/pillars" className="btn">
            Explore the Pillars
          </Link>
          <Link href="/graph" className="btn ghost">
            Knowledge Graph
          </Link>
        </div>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', marginBottom: '1rem' }}>
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
          <h2>Scroll-Synced Labs</h2>
          <p>
            Read the theory while the visualization updates in real-time.
            Adjust parameters inline. See the math come alive.
          </p>
        </article>
        <article className="card">
          <h2>Connected Knowledge</h2>
          <p>
            Concepts linked in a navigable graph structure. See how attention
            leads to SSMs, how diffusion connects to flow matching.
          </p>
          <p>
            Explore the <Link href="/graph">knowledge graph</Link>.
          </p>
        </article>
        <article className="card">
          <h2>Learn by Doing</h2>
          <p>
            Adjust learning rates. Watch convergence. Break things on purpose.
            Understanding comes from experimentation.
          </p>
        </article>
      </section>

      <GradientDescentPlayground />
    </div>
  )
}
