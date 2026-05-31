import Head from 'next/head'
import ImageDirectionGallery from '@/components/editorial/ImageDirectionGallery'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import NotebookSection from '@/components/editorial/NotebookSection'
import DomainAtlasGrid from '@/components/site/DomainAtlasGrid'
import PaperPanel from '@/components/site/PaperPanel'
import ResearchHeroFigure from '@/components/site/ResearchHeroFigure'
import VizShell from '@/components/viz/VizShell'

const domains = [
  { name: 'Linear Algebra', color: '#1f4b99', motif: 'Basis / projection / SVD', href: '/domains/linear-algebra/' },
  { name: 'Calculus', color: '#c24a2d', motif: 'Curves / rates / flows', href: '/domains/calculus/' },
  { name: 'Probability', color: '#1f6f78', motif: 'Distributions / uncertainty', href: '/domains/probability/' },
  { name: 'Optimization', color: '#8b5e34', motif: 'Landscapes / dynamics', href: '/domains/optimization/' },
  { name: 'Transformers', color: '#1f4b99', motif: 'Attention / memory / routing', href: '/domains/attention-transformers/' },
  { name: 'Generative Models', color: '#1f6f78', motif: 'Noise / fields / trajectories', href: '/domains/generative-models/' },
  { name: 'Alignment', color: '#c24a2d', motif: 'Preferences / reward / control', href: '/domains/alignment/' },
  { name: 'Representation Learning', color: '#8b5e34', motif: 'Geometry / features / probes', href: '/domains/representation-learning/' },
]

const pathway = [
  'Intuition',
  'Math',
  'Code',
  'Interactive Demo',
]

const aiFirstDirections = [
  {
    title: 'Bridge Concepts',
    role: 'Concept Covers',
    image: '/images/editorial/ai-first/concept-bridge-directions.png',
    alt: 'Four-panel AI-first visual direction board for probability, information theory, process rewards, and test-time compute.',
    implementation: 'Use as cover direction for bridge concepts where uncertainty, verification, and reasoning search need a memory anchor.',
  },
  {
    title: 'Page Experiences',
    role: 'Shell Design',
    image: '/images/editorial/ai-first/page-experience-directions.png',
    alt: 'Four-panel visual direction board for homepage, concept notebook, demo workspace, and learning path pages.',
    implementation: 'Translate into atlas-first navigation, notebook pages, and lab workspaces with AI beside the content.',
  },
  {
    title: 'Component System',
    role: 'Reusable UI',
    image: '/images/editorial/ai-first/component-system-directions.png',
    alt: 'Four-panel visual direction board for AI companion, section actions, quiz, and code lab components.',
    implementation: 'Map the imagery into shared companion rails, action strips, quiz states, and code lab chrome.',
  },
  {
    title: 'Responsive Learning',
    role: 'Mobile and Tablet',
    image: '/images/editorial/ai-first/responsive-learning-directions.png',
    alt: 'Four-panel visual direction board for mobile lessons, tablet labs, misconception coaching, and mastery reflection.',
    implementation: 'Keep controls touch-friendly and collapse AI surfaces without hiding the path back to explanation.',
  },
  {
    title: 'Advanced Concepts',
    role: 'Mechanism Pages',
    image: '/images/editorial/ai-first/advanced-concept-directions.png',
    alt: 'Four-panel visual direction board for SVD, chain rule, Bayesian updating, and attention mechanism pages.',
    implementation: 'Use for concept-cover batches and for deciding which geometry deserves precise D3 or SVG.',
  },
  {
    title: 'Learner Journey',
    role: 'Guidance',
    image: '/images/editorial/ai-first/learner-journey-directions.png',
    alt: 'Four-panel visual direction board for onboarding, learning path building, Socratic sessions, and review memory.',
    implementation: 'Turn onboarding and review into learning graph interactions instead of passive account setup.',
  },
  {
    title: 'Discovery Navigation',
    role: 'Atlas Tools',
    image: '/images/editorial/ai-first/discovery-navigation-directions.png',
    alt: 'Four-panel visual direction board for domain browser, search graph, library, and symbol atlas pages.',
    implementation: 'Guide the domain browser, search, graph, and glossary toward dense but readable atlas tools.',
  },
  {
    title: 'Assessment Feedback',
    role: 'Practice Loop',
    image: '/images/editorial/ai-first/assessment-feedback-directions.png',
    alt: 'Four-panel visual direction board for problem solving, proof building, misconception debugging, and mastery checks.',
    implementation: 'Use for future exercise shells: answer canvas, verifier states, hint ladders, and mastery checks.',
  },
]

const sparseFeatures = [
  { label: 'code syntax', x: 26, y: 48, r: 9, color: '#1f4b99' },
  { label: 'json schema', x: 43, y: 32, r: 7, color: '#1f6f78' },
  { label: 'indentation', x: 57, y: 56, r: 6, color: '#c24a2d' },
  { label: 'safety cue', x: 74, y: 30, r: 8, color: '#8b5e34' },
]

const chart = [
  [0, 78],
  [18, 56],
  [36, 42],
  [54, 32],
  [72, 26],
  [90, 23],
]

function chartPath(points: number[][]) {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}

export default function EditorialPrototypePage() {
  return (
    <div className="editorial-shell">
      <Head>
        <title>Editorial Prototype — Continuous Function</title>
        <meta
          name="description"
          content="Prototype route for an editorial, research-notebook visual direction for Continuous Function."
        />
      </Head>

      <NotebookLayout
        eyebrow="Editorial Prototype"
        title="Intuition → Math → Code → Demo"
        lede="A prototype for turning Continuous Function into a denser, more intentional educational product: part mathematical atlas, part research notebook, part interactive lab."
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Prototype' },
        ]}
        meta={pathway}
        actions={[
          { href: '/domains/', label: 'Browse Domains' },
          { href: '/domains/representation-learning/sparse-autoencoders/', label: 'View Sparse Autoencoders', variant: 'secondary' },
        ]}
        heroVisual={<ResearchHeroFigure />}
        rail={(
          <div className="prototype-rail">
            <p className="eyebrow">Conversion Notes</p>
            <h3>Website primitives</h3>
            <ul>
              <li>Notebook-style concept pages as the default shell</li>
              <li>Reusable demo chrome with controls, metrics, notes, and challenge areas</li>
              <li>Domain atlas navigation instead of flat archive cards</li>
            </ul>
          </div>
        )}
      >
        <NotebookSection
          eyebrow="Visual Language"
          title="Concept images as memory anchors"
          intro="Generated raster images are used as editorial anchors: they set a learning mood and make abstract families easier to recognize, while the live diagrams remain code-native and precise."
        >
          <figure className="visual-language-board">
            <img
              src="/images/editorial/concept-visual-language-contact-sheet.png"
              alt="Six-panel visual language board for vectors, probability, optimization, attention, structured decoding, and diffusion."
            />
          </figure>
        </NotebookSection>

        <NotebookSection
          eyebrow="AI-First Direction"
          title="New image boards become implementation references"
          intro="This is the working wall for the generated UX images: each board has a product job, then the best ideas are translated into shared React components, not copied as decorative screenshots."
        >
          <ImageDirectionGallery directions={aiFirstDirections} />
        </NotebookSection>

        <NotebookSection
          eyebrow="Knowledge Atlas"
          title="Domain-led navigation, not a flat archive"
          intro="The visual goal is to make the site feel like an atlas of connected mathematical ideas, not a pile of isolated posts."
        >
          <DomainAtlasGrid items={domains} />
        </NotebookSection>

        <section className="concept-lab">
          <PaperPanel className="concept-sheet">
            <div className="sheet-header">
              <div>
                <p className="eyebrow">Concept Sheet</p>
                <h2>Sparse Autoencoders</h2>
              </div>
              <div className="meta-badges">
                <span>representation-learning</span>
                <span>difficulty 4/5</span>
                <span>demo</span>
              </div>
            </div>

            <div className="sheet-grid">
              <article className="sheet-card prose-card">
                <h3>Intuition</h3>
                <p>
                  SAEs learn a sparse parts-list for dense model activations. Instead of one neuron meaning one
                  concept, a token activates a few reusable feature directions.
                </p>
              </article>

              <article className="sheet-card prose-card">
                <h3>Math</h3>
                <p className="equation">
                  z = TopK(Wenc(x - bpre), k)
                </p>
                <p className="equation">
                  L = ||x - x̂||²
                </p>
              </article>

              <article className="sheet-card code-card">
                <h3>Code</h3>
                <pre>{`scores = W.T @ x\nkeep = argtopk(abs(scores), k)\nz_hat[keep] = scores[keep]\nx_hat = W @ z_hat`}</pre>
              </article>

              <article className="sheet-card demo-card">
                <VizShell
                  eyebrow="Demo Surface"
                  title="Sparse feature atlas"
                  subtitle="A reusable shell for interactive concept demos: controls, metrics, explanatory notes, and challenge modules."
                  metrics={['interactive', 'svg/d3 default', 'challenge-ready']}
                  controls={(
                    <>
                      <span className="control-chip">k = 4</span>
                      <span className="control-chip">TopK</span>
                      <span className="control-chip">recon MSE 0.023</span>
                    </>
                  )}
                  notes={(
                    <p>
                      Use the stage for the real renderer, then keep explanation, metrics, and challenge state in the
                      shell instead of duplicating that chrome in each demo.
                    </p>
                  )}
                  challenge={(
                    <p>
                      Example challenge: predict which feature directions will survive when the sparsity budget drops
                      from 8 to 4.
                    </p>
                  )}
                >
                  <div className="demo-surface">
                    <svg viewBox="0 0 320 220" className="demo-svg">
                      <rect x="18" y="16" width="120" height="186" rx="18" className="panel-soft" />
                      <rect x="182" y="16" width="120" height="186" rx="18" className="panel-soft" />

                      <text x="36" y="40" className="panel-title">feature space</text>
                      <text x="198" y="40" className="panel-title">reconstruction</text>

                      {sparseFeatures.map((f) => (
                        <g key={f.label}>
                          <circle cx={f.x + 18} cy={f.y + 18} r={f.r} fill={f.color} opacity="0.78" />
                          <line x1={f.x + 18} y1={f.y + 18} x2={226} y2={118} className="feature-link" />
                        </g>
                      ))}

                      <path d={chartPath(chart.map(([x, y]) => [x + 196, y + 100]))} className="chart-line" />
                      <line x1="198" y1="180" x2="288" y2="180" className="axis-line" />
                      <line x1="198" y1="180" x2="198" y2="108" className="axis-line" />
                    </svg>
                  </div>
                </VizShell>
              </article>
            </div>
          </PaperPanel>

          <PaperPanel className="animation-notes" tone="cool">
            <p className="eyebrow">Animation Mapping</p>
            <ul>
              <li><strong>SVG + D3:</strong> geometry, charts, and token/memory diagrams.</li>
              <li><strong>Canvas:</strong> dense fields, particles, phase portraits, heavy timelines.</li>
              <li><strong>GSAP:</strong> staged reveals, token travel, route verification, callouts.</li>
              <li><strong>Three:</strong> only for concepts where real 3D structure teaches the idea.</li>
            </ul>
          </PaperPanel>
        </section>
      </NotebookLayout>

      <style jsx>{`
        .editorial-shell {
          color: #1b2430;
          padding-bottom: 4rem;
        }

        .concept-lab {
          margin-bottom: 2.5rem;
        }

        .visual-language-board {
          margin: 0;
          overflow: hidden;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          box-shadow: 0 18px 42px rgba(9, 17, 27, 0.08);
        }

        .visual-language-board img {
          display: block;
          width: 100%;
          height: auto;
        }

        .concept-lab {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
          gap: 1.5rem;
          align-items: stretch;
        }

        h1, h2, h3 {
          margin: 0;
          font-family: var(--font-display);
          color: #151d27;
          letter-spacing: -0.02em;
        }

        h2 {
          font-size: clamp(1.7rem, 3vw, 2.6rem);
          line-height: 1.02;
        }

        h3 {
          font-size: 1.05rem;
          margin-bottom: 0.7rem;
        }

        .sheet-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }

        .meta-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          justify-content: flex-end;
        }

        .meta-badges span {
          padding: 0.4rem 0.62rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.84);
          border: 1px solid rgba(27, 36, 48, 0.08);
          font-size: 0.78rem;
          font-family: var(--font-mono);
          color: #4d5b68;
        }

        .sheet-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 1rem;
        }

        .sheet-card {
          min-height: 180px;
          border-radius: 20px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
          padding: 1rem;
        }

        .prose-card p,
        .animation-notes li {
          color: #4c5967;
        }

        .equation {
          font-family: var(--font-mono);
          font-size: 1.02rem;
          color: #1f4b99;
        }

        .code-card pre {
          margin: 0;
          white-space: pre-wrap;
          font-family: var(--font-mono);
          font-size: 0.88rem;
          line-height: 1.65;
          color: #293442;
        }

        .demo-card {
          grid-column: span 2;
        }

        .prototype-rail h3 {
          margin-bottom: 0.65rem;
        }

        .prototype-rail ul {
          margin: 0;
          padding-left: 1rem;
          display: grid;
          gap: 0.75rem;
          color: #4d5a67;
        }

        .demo-surface {
          min-height: 240px;
        }

        .demo-svg {
          display: block;
          width: min(100%, 760px);
          height: auto;
          margin: 0 auto;
        }

        .panel-soft {
          fill: rgba(255, 251, 245, 0.88);
          stroke: rgba(27, 36, 48, 0.08);
        }

        .panel-title {
          fill: #334155;
          font-family: var(--font-mono);
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .feature-link {
          stroke: rgba(27, 36, 48, 0.18);
          stroke-width: 1.5;
        }

        .chart-line {
          fill: none;
          stroke: #1f4b99;
          stroke-width: 3.4;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .axis-line {
          stroke: rgba(27, 36, 48, 0.4);
          stroke-width: 1.5;
        }

        .control-chip {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0.38rem 0.55rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          font-family: var(--font-mono);
          font-size: 0.74rem;
          color: #4e5b67;
        }

        .animation-notes ul {
          margin: 0;
          padding-left: 1rem;
          display: grid;
          gap: 0.8rem;
        }

        @media (max-width: 1080px) {
          .concept-lab {
            grid-template-columns: 1fr;
          }

        }

        @media (max-width: 720px) {
          .editorial-shell {
            padding-bottom: 2rem;
          }

          .sheet-grid {
            grid-template-columns: 1fr;
          }

          .demo-card {
            grid-column: auto;
          }

          .sheet-header {
            flex-direction: column;
            align-items: start;
          }
        }
      `}</style>

      <style jsx global>{`
        .editorial-shell ~ * {
          text-shadow: none;
        }

        .editorial-shell {
          --prototype-paper: #f8f3ea;
        }

        body:has(.editorial-shell) {
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.08), transparent 26%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.08), transparent 28%),
            linear-gradient(180deg, #efe8db 0%, #f7f2e9 100%);
          color: #1b2430;
        }

        body:has(.editorial-shell) a:hover {
          color: inherit;
        }
      `}</style>
    </div>
  )
}
