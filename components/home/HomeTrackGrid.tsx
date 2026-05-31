import type { CSSProperties } from 'react'
import Link from 'next/link'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type Track = {
  title: string
  description: string
  href: string
  accent: string
  concepts: Array<{ title: string; href: string }>
}

type Props = {
  tracks: Track[]
}

export default function HomeTrackGrid({ tracks }: Props) {
  return (
    <section className="track-section">
      <SurfaceBackplate variant="atlas" density="quiet" />
      <div className="section-header">
        <p className="eyebrow">Curated Entries</p>
        <h2>Start with a thread, not a random page</h2>
        <p>
          You can browse the full atlas, but the fastest way in is to follow one editorial thread from prerequisites to
          modern applications.
        </p>
      </div>

      <div className="track-grid">
        {tracks.map((track) => (
          <article
            key={track.title}
            className="track-card"
            style={{ '--accent': track.accent } as CSSProperties}
          >
            <div className="track-top">
              <span className="track-badge">track</span>
              <h3>{track.title}</h3>
            </div>

            <p className="track-description">{track.description}</p>

            <div className="track-concepts">
              {track.concepts.map((concept) => (
                <Link key={concept.href} href={concept.href} className="concept-link">
                  {concept.title}
                </Link>
              ))}
            </div>

            <Link href={track.href} className="track-cta">
              Open track domain
            </Link>
          </article>
        ))}
      </div>

      <style jsx>{`
        .track-section {
          position: relative;
          overflow: hidden;
          margin: 0;
          padding: 1.1rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.54);
        }

        .section-header,
        .track-grid {
          position: relative;
          z-index: 1;
        }

        .section-header {
          max-width: 52rem;
          margin-bottom: 1rem;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #6366f1;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 4vw, 2.4rem);
          line-height: 1;
        }

        .section-header p:last-child {
          margin: 0.85rem 0 0;
          color: #4f5c68;
          line-height: 1.75;
        }

        .track-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .track-card {
          display: flex;
          flex-direction: column;
          min-height: 300px;
          padding: 1.15rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, white), transparent 34%),
            rgba(248, 243, 234, 0.9);
          box-shadow: 0 18px 34px rgba(27, 36, 48, 0.06);
        }

        .track-top {
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }

        .track-badge {
          display: inline-flex;
          align-self: flex-start;
          padding: 0.38rem 0.56rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.92);
          border: 1px solid rgba(27, 36, 48, 0.08);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #4f5c68;
        }

        h3 {
          margin: 0;
          font-size: 1.28rem;
          line-height: 1.2;
          color: #151d27;
        }

        .track-description {
          margin: 0.85rem 0 0;
          color: #455361;
          line-height: 1.72;
        }

        .track-concepts {
          display: grid;
          gap: 0.55rem;
          margin-top: 1.1rem;
        }

        .track-concepts :global(.concept-link) {
          display: inline-flex;
          align-items: center;
          min-height: 42px;
          padding: 0.7rem 0.85rem;
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.9);
          border: 1px solid rgba(27, 36, 48, 0.08);
          text-decoration: none;
          color: #1b2430;
          font-weight: 500;
        }

        .track-concepts :global(.concept-link:hover),
        .track-card :global(.track-cta:hover) {
          text-shadow: none;
          color: color-mix(in srgb, var(--accent) 70%, #1b2430);
        }

        .track-card :global(.track-cta) {
          display: inline-flex;
          margin-top: auto;
          padding-top: 1rem;
          text-decoration: none;
          font-weight: 600;
          color: #1b2430;
        }

        @media (max-width: 1080px) {
          .track-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
