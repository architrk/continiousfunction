import type { CSSProperties } from 'react'
import Link from 'next/link'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type DomainCard = {
  id: string
  title: string
  description: string
  color: string
  conceptCount: number
  demoCount: number
  featuredConcepts: string[]
}

type Props = {
  domains: DomainCard[]
}

export default function HomeDomainAtlas({ domains }: Props) {
  return (
    <section className="atlas-section">
      <SurfaceBackplate variant="atlas" density="quiet" />
      <div className="section-header">
        <div>
          <p className="eyebrow">Domain Atlas</p>
          <h2>Navigate by mathematical territory</h2>
        </div>
        <Link href="/domains/" className="section-link">
          Browse the full atlas
        </Link>
      </div>

      <div className="atlas-grid">
        {domains.map((domain) => (
          <Link
            key={domain.id}
            href={`/domains/${domain.id}/`}
            className="domain-card"
            style={{ '--accent': domain.color || '#1f6f78' } as CSSProperties}
          >
            <div className="card-header">
              <span className="card-dot" />
              <span className="card-id">{domain.id}</span>
            </div>

            <h3>{domain.title}</h3>
            <p className="card-description">{domain.description}</p>

            <div className="card-stats">
              <span>{domain.conceptCount} concepts</span>
              <span>{domain.demoCount} demos</span>
            </div>

            <div className="concept-list">
              {domain.featuredConcepts.map((concept) => (
                <span key={concept} className="concept-chip">{concept}</span>
              ))}
            </div>
          </Link>
        ))}
      </div>

      <style jsx>{`
        .atlas-section {
          position: relative;
          overflow: hidden;
          margin: 0 0 2.2rem;
          padding: 1.1rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.54);
        }

        .section-header,
        .atlas-grid {
          position: relative;
          z-index: 1;
        }

        .section-header {
          display: flex;
          align-items: end;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .eyebrow {
          margin: 0 0 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #3b82f6;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 4vw, 2.5rem);
          line-height: 1;
        }

        .section-header :global(.section-link) {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0.7rem 1rem;
          border-radius: 999px;
          text-decoration: none;
          background: rgba(255, 251, 245, 0.9);
          border: 1px solid rgba(27, 36, 48, 0.1);
          color: #1b2430;
          font-weight: 600;
        }

        .section-header :global(.section-link:hover) {
          text-shadow: none;
          transform: translateY(-1px);
        }

        .atlas-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .atlas-grid :global(.domain-card) {
          display: flex;
          flex-direction: column;
          min-height: 250px;
          padding: 1.15rem;
          border-radius: 24px;
          text-decoration: none;
          color: inherit;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.96), rgba(248, 243, 234, 0.96)),
            radial-gradient(circle at top left, color-mix(in srgb, var(--accent) 18%, white), transparent 34%);
          box-shadow: 0 18px 34px rgba(27, 36, 48, 0.07);
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .atlas-grid :global(.domain-card:hover) {
          transform: translateY(-3px);
          box-shadow: 0 24px 40px rgba(27, 36, 48, 0.1);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          margin-bottom: 1rem;
        }

        .card-dot {
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: var(--accent);
          box-shadow: 0 0 0 6px color-mix(in srgb, var(--accent) 16%, white);
        }

        .card-id {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #5b6874;
        }

        h3 {
          margin: 0;
          font-size: 1.25rem;
          line-height: 1.2;
          color: #151d27;
        }

        .card-description {
          margin: 0.75rem 0 0;
          color: #455361;
          line-height: 1.7;
          flex: 1;
        }

        .card-stats {
          display: flex;
          flex-wrap: wrap;
          gap: 0.65rem;
          margin-top: 1rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          color: #4f5c68;
        }

        .card-stats span {
          padding: 0.4rem 0.6rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.9);
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .concept-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          margin-top: 1rem;
        }

        .concept-chip {
          padding: 0.4rem 0.58rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 12%, white);
          border: 1px solid color-mix(in srgb, var(--accent) 26%, white);
          font-size: 0.78rem;
          color: #334155;
        }

        @media (max-width: 1080px) {
          .atlas-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .section-header {
            flex-direction: column;
            align-items: stretch;
          }

          .atlas-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
