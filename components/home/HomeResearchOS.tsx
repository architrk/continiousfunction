import Link from 'next/link'

const operatingLoop = [
  {
    label: 'Paper',
    title: 'Paste the source',
    body: 'arXiv links, PDFs, blog posts, and model reports become a structured reading object instead of another tab.',
  },
  {
    label: 'Map',
    title: 'Reveal prerequisites',
    body: 'The graph places the paper inside concepts, equations, prior work, and the ideas the reader should repair first.',
  },
  {
    label: 'Lab',
    title: 'Test the mechanism',
    body: 'Small controlled experiments turn the central claim into sliders, curves, tensors, and failure cases.',
  },
  {
    label: 'Discuss',
    title: 'Ask one sharper question',
    body: 'Discussion prompts attach to the exact concept, equation, lab, or paper claim so the next conversation has a clear anchor.',
  },
]

const flagshipSlice = [
  { label: 'Attention', href: '/domains/attention-transformers/attention-transformers/' },
  { label: 'Efficient Attention', href: '/domains/attention-transformers/efficient-attention/' },
  { label: 'RoPE', href: '/domains/attention-transformers/rope/' },
  { label: 'FlashAttention', href: '/domains/attention-transformers/flash-attention/' },
  { label: 'Long Context', href: '/domains/attention-transformers/long-context/' },
  { label: 'LLM Serving', href: '/domains/llm-systems/llm-serving/' },
  { label: 'Decoding', href: '/domains/llm-systems/decoding-sampling/' },
]

const agentLanes = [
  {
    title: 'Concept Coach',
    body: 'Answers from the current notebook, prerequisites, equations, demos, and learner context.',
  },
  {
    title: 'Paper Mapper',
    body: 'Extracts contribution, prerequisites, equations, novelty, limitations, and graph placement.',
  },
  {
    title: 'Lab Builder',
    body: 'Produces safe visualization specs and small experiments rather than arbitrary broken demo code.',
  },
  {
    title: 'Claim Checker',
    body: 'Keeps factual paper and model claims source-linked, confidence-aware, and last-verified.',
  },
]

const planRows = [
  {
    plan: 'Live now',
    price: 'Public',
    audience: 'Readers today',
    includes: 'Public notebooks, paper-map preview, concept routes, graph routes, attention-serving module, local carried equations.',
  },
  {
    plan: 'Local preview',
    price: 'Browser',
    audience: 'Current study loop',
    includes: 'Source check preview, equation extraction, generated lab specs, saved browser route, copyable study prompts.',
  },
  {
    plan: 'Not live yet',
    price: 'Future',
    audience: 'Serious learners',
    includes: 'Accounts, saved paths, private rooms, full discussion, team annotations, billing, and weekly briefings.',
  },
]

export default function HomeResearchOS() {
  return (
    <section id="paper-map" className="research-os" aria-labelledby="research-os-title">
      <div className="section-header">
        <p className="eyebrow">Paper-To-Understanding Loop</p>
        <h2 id="research-os-title">Map a paper into a route you can test.</h2>
        <p>
          Continuous Function should help a serious learner move from a frontier paper to the prerequisite repair, the
          central equation, a toy lab, and one next question without losing the thread.
        </p>
      </div>

      <div className="loop-grid">
        {operatingLoop.map((step, index) => (
          <article key={step.label} className="loop-step">
            <div className="step-top">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
            </div>
            <h3>{step.title}</h3>
            <p>{step.body}</p>
          </article>
        ))}
      </div>

      <div className="product-grid">
        <section className="flagship-module" aria-labelledby="flagship-title">
          <p className="eyebrow">First Study Module</p>
          <h3 id="flagship-title">Attention to serving, end to end.</h3>
          <p>
            The first complete module should help students, engineers, and researchers understand transformer inference
            from the attention equation to production tradeoffs.
          </p>
          <Link href="/paths/attention-serving/" className="module-cta">
            Study module
          </Link>

          <div className="module-path" aria-label="Flagship module path">
            {flagshipSlice.map((item, index) => (
              <Link key={item.href} href={item.href} className="module-node">
                <span>{index + 1}</span>
                {item.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="agent-layer" aria-labelledby="agent-layer-title">
          <p className="eyebrow">Ask Beside The Notebook</p>
          <h3 id="agent-layer-title">Specific help attached to the route.</h3>
          <div className="agent-list">
            {agentLanes.map((lane) => (
              <article key={lane.title} className="agent-item">
                <h4>{lane.title}</h4>
                <p>{lane.body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section id="pricing" className="pricing-panel" aria-labelledby="pricing-title">
        <div className="pricing-intro">
          <p className="eyebrow">Status</p>
          <h3 id="pricing-title">What is live, previewed, and not live yet.</h3>
          <p>
            The product stays trustworthy by separating what a learner can use now from what still needs accounts,
            storage, discussion infrastructure, or billing.
          </p>
        </div>

        <div className="plan-table" role="table" aria-label="Continuous Function plan sketch">
          <div className="plan-row plan-head" role="row">
            <span role="columnheader">Status</span>
            <span role="columnheader">Availability</span>
            <span role="columnheader">For</span>
            <span role="columnheader">Includes</span>
          </div>
          {planRows.map((row) => (
            <div key={row.plan} className="plan-row" role="row">
              <strong role="cell">{row.plan}</strong>
              <span role="cell">{row.price}</span>
              <span role="cell">{row.audience}</span>
              <span role="cell">{row.includes}</span>
            </div>
          ))}
        </div>
      </section>

      <style jsx>{`
        .research-os {
          display: grid;
          gap: 1rem;
          min-width: 0;
          margin: 0 0 2.2rem;
          padding: 1.2rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.76), rgba(248, 243, 234, 0.92)),
            radial-gradient(circle at 12% 14%, rgba(15, 118, 110, 0.11), transparent 32%),
            radial-gradient(circle at 88% 20%, rgba(194, 74, 45, 0.1), transparent 28%);
        }

        .section-header {
          max-width: 62rem;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        h3,
        h4,
        p {
          overflow-wrap: break-word;
        }

        h2 {
          margin: 0;
          max-width: 18ch;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4vw, 3.1rem);
          line-height: 1;
          color: #151d27;
        }

        h2::before,
        h3::before,
        h4::before {
          content: none;
          display: none;
        }

        .section-header p:last-child,
        .flagship-module > p,
        .pricing-intro p {
          margin: 0.85rem 0 0;
          color: #455361;
          line-height: 1.76;
        }

        .loop-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.8rem;
        }

        .loop-step,
        .flagship-module,
        .agent-layer,
        .pricing-panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.82);
          box-shadow: 0 16px 32px rgba(27, 36, 48, 0.05);
        }

        .loop-step {
          display: flex;
          flex-direction: column;
          min-height: 218px;
          padding: 1rem;
          border-radius: 20px;
        }

        .step-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          margin-bottom: 1rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #5b6874;
        }

        .step-top span {
          color: #c24a2d;
        }

        .loop-step h3,
        .flagship-module h3,
        .agent-layer h3,
        .pricing-intro h3 {
          margin: 0;
          color: #151d27;
          font-size: 1.22rem;
          line-height: 1.25;
        }

        .loop-step p,
        .agent-item p {
          margin: 0.72rem 0 0;
          color: #455361;
          line-height: 1.68;
        }

        .product-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(280px, 0.85fr);
          gap: 1rem;
          min-width: 0;
        }

        .flagship-module,
        .agent-layer,
        .pricing-panel {
          border-radius: 22px;
          padding: 1rem;
        }

        .module-path {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
          margin-top: 1rem;
          min-width: 0;
        }

        .flagship-module :global(.module-cta) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: fit-content;
          min-height: 40px;
          margin-top: 0.85rem;
          padding: 0.62rem 0.88rem;
          border-radius: 999px;
          background: #1b2430;
          color: #fbf4e8;
          font-weight: 700;
          line-height: 1.25;
          text-decoration: none;
        }

        .flagship-module :global(.module-cta:hover) {
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
          text-shadow: none;
        }

        .module-path :global(.module-node) {
          display: grid;
          align-content: start;
          gap: 0.5rem;
          min-height: 98px;
          padding: 0.7rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.96), rgba(248, 243, 234, 0.9));
          color: #1b2430;
          text-decoration: none;
          font-weight: 650;
          line-height: 1.22;
        }

        .module-path :global(.module-node:hover) {
          transform: translateY(-2px);
          color: #1f6f78;
          text-shadow: none;
        }

        .module-path :global(.module-node span) {
          display: inline-grid;
          place-items: center;
          width: 1.55rem;
          height: 1.55rem;
          border-radius: 999px;
          background: rgba(194, 74, 45, 0.12);
          color: #9f341d;
          font-family: var(--font-mono);
          font-size: 0.72rem;
        }

        .agent-list {
          display: grid;
          gap: 0.65rem;
          margin-top: 0.9rem;
        }

        .agent-item {
          padding: 0.8rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(248, 243, 234, 0.76);
        }

        .agent-item h4 {
          margin: 0;
          color: #151d27;
          font-size: 1rem;
        }

        .pricing-panel {
          display: grid;
          grid-template-columns: minmax(240px, 0.45fr) minmax(0, 1fr);
          gap: 1rem;
          align-items: start;
        }

        .plan-table {
          display: grid;
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 18px;
          overflow: hidden;
          background: rgba(255, 251, 245, 0.74);
        }

        .plan-row {
          display: grid;
          grid-template-columns: minmax(76px, 0.54fr) minmax(88px, 0.56fr) minmax(150px, 1fr) minmax(220px, 1.7fr);
          gap: 0.7rem;
          padding: 0.72rem 0.8rem;
          border-bottom: 1px solid rgba(27, 36, 48, 0.08);
          color: #455361;
          line-height: 1.45;
        }

        .plan-row:last-child {
          border-bottom: 0;
        }

        .plan-head {
          background: #1b2430;
          color: #f8f3ea;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .plan-row strong {
          color: #151d27;
        }

        .plan-head strong {
          color: inherit;
        }

        @media (max-width: 1160px) {
          .loop-grid,
          .product-grid,
          .pricing-panel {
            grid-template-columns: 1fr;
          }

          .module-path {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 780px) {
          .research-os {
            padding: 1rem;
          }

          .loop-grid,
          .module-path {
            grid-template-columns: 1fr;
          }

          h2 {
            max-width: 100%;
          }

          .plan-table {
            border-radius: 16px;
            background: transparent;
            border: 0;
            gap: 0.65rem;
          }

          .plan-head {
            display: none;
          }

          .plan-row {
            grid-template-columns: 1fr;
            gap: 0.35rem;
            border: 1px solid rgba(27, 36, 48, 0.08);
            border-radius: 16px;
            background: rgba(255, 251, 245, 0.82);
          }

          .plan-row span:nth-child(2)::before {
            content: 'Price: ';
            font-family: var(--font-mono);
            font-size: 0.72rem;
            color: #5b6874;
          }
        }
      `}</style>
    </section>
  )
}
