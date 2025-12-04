import Link from 'next/link'

const pillars = [
  {
    id: 'sequence-modeling',
    icon: '∿',
    title: 'Sequence Modeling',
    subtitle: 'The architecture of memory and attention',
    description: 'From RNNs through Transformers to Mamba. Understand how models learn to process sequential information and the mathematical innovations that enable modern language models.',
    topics: ['Attention', 'SSMs', 'Mamba', 'Memory'],
    color: 'teal',
  },
  {
    id: 'optimization',
    icon: '∇',
    title: 'Optimization',
    subtitle: 'Navigating the loss landscape',
    description: 'Gradient descent as physics. Why Adam works, how Muon orthogonalizes updates, and the thermodynamic view of learning as escaping saddle points.',
    topics: ['SGD', 'Adam', 'Muon', 'Sharpness'],
    color: 'orange',
  },
  {
    id: 'generative-physics',
    icon: '∂',
    title: 'Generative Physics',
    subtitle: 'Diffusion, flow, and the geometry of data',
    description: 'Score matching, flow matching, and rectified flows. See how generation is gradient descent in data space, with interactive phase portraits.',
    topics: ['Diffusion', 'Flow Matching', 'Score', 'SDEs'],
    color: 'purple',
  },
  {
    id: 'geometric-dl',
    icon: '◇',
    title: 'Geometric Deep Learning',
    subtitle: 'Symmetry as inductive bias',
    description: 'When the structure of data implies the structure of networks. Equivariance, group theory, and why CNNs are just the beginning.',
    topics: ['Equivariance', 'GNNs', 'Symmetry', 'Lie Groups'],
    color: 'blue',
  },
  {
    id: 'mech-interp',
    icon: '⊕',
    title: 'Mechanistic Interpretability',
    subtitle: 'Reverse-engineering neural computation',
    description: 'Superposition, sparse autoencoders, and circuit analysis. Interactive probes into what networks actually compute.',
    topics: ['SAEs', 'Circuits', 'Features', 'Probing'],
    color: 'green',
  },
]

export default function PillarsIndex() {
  return (
    <div>
      <section className="hero" style={{ paddingBottom: '1.5rem' }}>
        <h1>Mathematical Pillars</h1>
        <p className="hero-tagline">
          Five interconnected domains that form the foundation of modern deep learning.
          Each pillar is an explorable journey through theory and visualization.
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
            <p style={{ fontStyle: 'italic', marginBottom: '0.75rem', fontSize: '0.85rem' }}>
              {pillar.subtitle}
            </p>
            <p>{pillar.description}</p>
            <div className="topics">
              {pillar.topics.map((topic) => (
                <span key={topic} className="topic-tag">{topic}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <section style={{ marginTop: '3rem', textAlign: 'center' }}>
        <p className="muted">
          Each pillar builds on shared mathematical foundations.
          <br />
          Concepts link together in the{' '}
          <Link href="/graph">knowledge graph</Link>.
        </p>
      </section>
    </div>
  )
}
