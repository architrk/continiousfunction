import Link from 'next/link'
import { kvMemoryEquation } from '@/lib/learningRouteConstants'

const mappedConcepts = [
  { label: 'Attention', href: '/domains/attention-transformers/attention-transformers/' },
  { label: 'Efficient Attention', href: '/domains/attention-transformers/efficient-attention/' },
  { label: 'RoPE', href: '/domains/attention-transformers/rope/' },
  { label: 'Long Context', href: '/domains/attention-transformers/long-context/' },
  { label: 'LLM Serving', href: '/domains/llm-systems/llm-serving/' },
]

const workflowSteps = [
  'Extract equations',
  'Find prerequisites',
  'Open a lab',
  'Ask one question',
]

export default function HomePaperMapperSurface() {
  return (
    <section className="paper-mapper-surface" aria-label="Paper to concept mapper preview">
      <div className="surface-top">
        <div>
          <p className="eyebrow">Paper Mapper</p>
          <h2>Turn a paper clue into a route, one equation, and one experiment.</h2>
        </div>
        <span className="status-pill">Preview</span>
      </div>

      <div className="paper-input-wrap">
        <label htmlFor="paper-url-preview">Try this paper clue</label>
        <div className="paper-input-row">
          <input
            id="paper-url-preview"
            readOnly
            value="arXiv: long-context KV cache compression"
            aria-label="Example paper input"
          />
          <Link href="/paper-map/" className="map-action">
            Open Mapper
          </Link>
        </div>
      </div>

      <div className="mapped-output">
        <div className="concept-path" aria-label="Mapped concept path">
          {mappedConcepts.map((concept, index) => (
            <Link key={concept.href} href={concept.href} className="concept-node">
              <span>{String(index + 1).padStart(2, '0')}</span>
              {concept.label}
            </Link>
          ))}
        </div>

        <div className="equation-card">
          <p className="mini-label">Clickable equation</p>
          <code>{kvMemoryEquation}</code>
          <p>
            The mapper turns the bottleneck into a calculator, then links the symbols back to attention and serving.
          </p>
        </div>
      </div>

      <div className="synthesis-panel">
        <p className="mini-label">AI synthesis</p>
        <h3>What changed from old work?</h3>
        <p>
          The paper trades exact key-value retention for a bounded decode-time memory budget. Learn attention first,
          test the memory curve, then inspect where retrieval quality can break.
        </p>
      </div>

      <div className="workflow-strip" aria-label="Operating workflow">
        {workflowSteps.map((step) => (
          <span key={step}>{step}</span>
        ))}
      </div>

      <style jsx>{`
        .paper-mapper-surface {
          display: grid;
          gap: 0.9rem;
          min-width: 0;
          padding: clamp(0.9rem, 2vw, 1.1rem);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.94), rgba(248, 243, 234, 0.97)),
            radial-gradient(circle at 18% 8%, rgba(15, 118, 110, 0.16), transparent 32%),
            radial-gradient(circle at 92% 14%, rgba(194, 74, 45, 0.13), transparent 28%);
          backdrop-filter: blur(12px) saturate(112%);
        }

        .surface-top {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 0.9rem;
          min-width: 0;
        }

        .eyebrow,
        .mini-label,
        label {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2 {
          margin: 0.45rem 0 0;
          max-width: 17ch;
          font-family: var(--font-display);
          font-size: clamp(1.65rem, 3vw, 2.25rem);
          line-height: 1;
          color: #151d27;
          overflow-wrap: break-word;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        .status-pill {
          flex: 0 0 auto;
          padding: 0.42rem 0.58rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1b2430;
          color: #f8f3ea;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .paper-input-wrap {
          display: grid;
          gap: 0.5rem;
          min-width: 0;
        }

        .paper-input-row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto;
          gap: 0.5rem;
          min-width: 0;
        }

        input {
          min-width: 0;
          width: 100%;
          min-height: 46px;
          padding: 0.75rem 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background: rgba(255, 251, 245, 0.96);
          color: #151d27;
          font: inherit;
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.5);
          text-overflow: ellipsis;
        }

        .paper-input-row :global(.map-action) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          padding: 0.75rem 0.95rem;
          border-radius: 16px;
          background: #c24a2d;
          color: #fffaf3;
          text-decoration: none;
          font-weight: 700;
        }

        .mapped-output {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(190px, 0.75fr);
          gap: 0.75rem;
          min-width: 0;
        }

        .concept-path {
          display: grid;
          gap: 0.4rem;
          min-width: 0;
        }

        .concept-path :global(.concept-node) {
          display: grid;
          grid-template-columns: 2.2rem minmax(0, 1fr);
          align-items: center;
          gap: 0.55rem;
          min-height: 40px;
          padding: 0.52rem 0.62rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          color: #1b2430;
          text-decoration: none;
          font-weight: 600;
        }

        .concept-path :global(.concept-node:hover),
        .paper-input-row :global(.map-action:hover) {
          transform: translateY(-1px);
          text-shadow: none;
        }

        .concept-path :global(.concept-node span) {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: #c24a2d;
        }

        .equation-card,
        .synthesis-panel {
          min-width: 0;
          padding: 0.85rem;
          border-radius: 18px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.72);
        }

        .equation-card code {
          display: block;
          margin-top: 0.45rem;
          padding: 0.65rem;
          border-radius: 12px;
          background: #151d27;
          color: #fbf4e8;
          font-size: 0.78rem;
          line-height: 1.45;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .equation-card p:last-child,
        .synthesis-panel p {
          margin: 0.58rem 0 0;
          color: #455361;
          line-height: 1.62;
        }

        .synthesis-panel h3 {
          margin: 0.42rem 0 0;
          color: #151d27;
          font-size: 1.08rem;
          line-height: 1.25;
        }

        .workflow-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        .workflow-strip span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0.45rem 0.5rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #254852;
          font-size: 0.74rem;
          text-align: center;
          line-height: 1.25;
        }

        @media (max-width: 720px) {
          .surface-top,
          .paper-input-row,
          .mapped-output,
          .workflow-strip {
            grid-template-columns: 1fr;
          }

          .surface-top {
            display: grid;
          }

          h2 {
            max-width: 100%;
          }

          .status-pill {
            justify-self: start;
          }
        }
      `}</style>
    </section>
  )
}
