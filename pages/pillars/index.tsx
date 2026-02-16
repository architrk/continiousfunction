import Link from 'next/link'
import Head from 'next/head'

const pillars = [
  {
    id: 'sequence-modeling',
    icon: '∿',
    title: 'Sequence Modeling',
    subtitle: 'The architecture of memory and attention',
    mathNote: 'y = softmax(QKᵀ/√d)V',
    description: 'From RNNs through Transformers to Mamba. Understand how models learn to process sequential information and the mathematical innovations that enable modern language models.',
    topics: ['Attention', 'SSMs', 'Mamba', 'Memory'],
    color: 'teal',
  },
  {
    id: 'optimization',
    icon: '∇',
    title: 'Optimization',
    subtitle: 'Navigating the loss landscape',
    mathNote: 'θ ← θ − η∇L(θ)',
    description: 'Gradient descent as physics. Why Adam works, how Muon orthogonalizes updates, and the thermodynamic view of learning as escaping saddle points.',
    topics: ['SGD', 'Adam', 'Muon', 'Sharpness'],
    color: 'orange',
  },
  {
    id: 'generative-physics',
    icon: '∂',
    title: 'Generative Physics',
    subtitle: 'Diffusion, flow, and the geometry of data',
    mathNote: 'dx = f(x,t)dt + g(t)dW',
    description: 'Score matching, flow matching, and rectified flows. See how generation is gradient descent in data space, with interactive phase portraits.',
    topics: ['Diffusion', 'Flow Matching', 'Score', 'SDEs'],
    color: 'purple',
  },
  {
    id: 'geometric-dl',
    icon: '◇',
    title: 'Geometric Deep Learning',
    subtitle: 'Symmetry as inductive bias',
    mathNote: 'f(ρ(g)x) = ρ′(g)f(x)',
    description: 'When the structure of data implies the structure of networks. Equivariance, group theory, and why CNNs are just the beginning.',
    topics: ['Equivariance', 'GNNs', 'Symmetry', 'Lie Groups'],
    color: 'blue',
  },
  {
    id: 'mech-interp',
    icon: '⊕',
    title: 'Mechanistic Interpretability',
    subtitle: 'Reverse-engineering neural computation',
    mathNote: 'x ≈ Σᵢ aᵢfᵢ (sparse)',
    description: 'Superposition, sparse autoencoders, and circuit analysis. Interactive probes into what networks actually compute.',
    topics: ['SAEs', 'Circuits', 'Features', 'Probing'],
    color: 'green',
  },
]

export default function PillarsIndex() {
  return (
    <div>
      <Head>
        <title>Five Pillars — Continuous Function</title>
      </Head>

      {/* Breadcrumb navigation */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-separator">/</span>
        <span className="breadcrumb-current">Pillars</span>
      </nav>

      <section className="hero" style={{ paddingBottom: '1.5rem' }}>
        <h1>Five Pillars</h1>
        <p className="hero-tagline">
          Five interconnected areas of deep learning mathematics.
          Each one explores theory through visualization and interaction.
        </p>
      </section>

      <div className="pillars-grid">
        {pillars.map((pillar) => (
          <Link
            key={pillar.id}
            href={`/pillars/${pillar.id}`}
            className="pillar-card"
            style={{ textDecoration: 'none' }}
          >
            <div className="pillar-card-icon">{pillar.icon}</div>
            <h3>{pillar.title}</h3>
            <p className="pillar-card-subtitle">
              {pillar.subtitle}
            </p>
            <code className="pillar-card-math">
              {pillar.mathNote}
            </code>
            <p>{pillar.description}</p>
            <div className="topics">
              {pillar.topics.map((topic) => (
                <span key={topic} className="topic-tag">{topic}</span>
              ))}
            </div>
            <span className="pillar-cta">Explore →</span>
          </Link>
        ))}
      </div>

      <section style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p className="muted">
          These areas share mathematical connections.
          <br />
          See how they link in the{' '}
          <Link href="/graph">knowledge graph</Link>.
        </p>
      </section>

      <style jsx>{`
        .breadcrumb {
          font-size: 0.85rem;
          margin-bottom: 1.5rem;
          color: #7a7468;
        }
        .breadcrumb :global(a) {
          color: var(--converge-teal);
          text-decoration: none;
        }
        .breadcrumb :global(a):hover {
          text-decoration: underline;
        }
        .breadcrumb-separator {
          margin: 0 0.5rem;
          color: #5a5448;
        }
        .breadcrumb-current {
          color: #b8b0a0;
        }
      `}</style>
    </div>
  )
}
