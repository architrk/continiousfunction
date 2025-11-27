import Link from 'next/link'
import GradientDescentPlayground from '../components/GradientDescentPlayground'

export default function HomePage() {
  return (
    <div>
      <section className="hero">
        <h1>The Mathematics of Learning</h1>
        <p className="hero-tagline">
          Interactive explorations of optimization algorithms that power modern deep learning.
          From gradient descent fundamentals to cutting-edge methods like Muon.
        </p>
        <div className="hero-actions">
          <Link href="/concepts/optimizers/overview" className="btn">
            Begin with ∇L(θ)
          </Link>
          <Link href="/graph" className="btn ghost">
            Concept Graph
          </Link>
        </div>
      </section>

      <section className="grid">
        <article className="card">
          <h2>Mathematical Foundations</h2>
          <p>
            Rigorous explanations of gradient-based optimization with interactive
            visualizations. KaTeX-rendered equations meet explorable demos.
          </p>
        </article>
        <article className="card">
          <h2>Connected Knowledge</h2>
          <p>
            Concepts linked in a navigable graph structure. See how SGD leads to
            momentum, Adam builds on RMSProp, and Muon rethinks everything.
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
