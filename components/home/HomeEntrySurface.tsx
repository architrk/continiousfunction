import type { CSSProperties } from 'react'
import Link from 'next/link'

type ConceptTeaser = {
  title: string
  href: string
  description: string
  readTime: number
  hasDemo: boolean
  hasCode: boolean
}

type EntryPath = {
  title: string
  description: string
  href: string
  accent: string
  concepts: ConceptTeaser[]
}

type Props = {
  tracks: EntryPath[]
}

export default function HomeEntrySurface({ tracks }: Props) {
  return (
    <section className="entry-surface" aria-label="Choose a learning path">
      <div className="entry-header">
        <p className="eyebrow">Start Here</p>
        <h2>Choose a thread and enter the first notebook.</h2>
      </div>

      <div className="entry-list">
        {tracks.map((track) => {
          const firstConcept = track.concepts[0]

          return (
            <Link
              key={track.title}
              href={firstConcept?.href ?? track.href}
              className="entry-row"
              style={{ '--accent': track.accent } as CSSProperties}
            >
              <div className="entry-main">
                <span className="entry-rule" />
                <div>
                  <h3>{track.title}</h3>
                  <p>{track.description}</p>
                </div>
              </div>

              {firstConcept ? (
                <div className="first-step">
                  <span className="step-label">Begin with</span>
                  <strong>{firstConcept.title}</strong>
                  <div className="signals">
                    <span>{firstConcept.readTime || 10} min</span>
                    {firstConcept.hasCode ? <span>code</span> : null}
                    {firstConcept.hasDemo ? <span>demo</span> : null}
                  </div>
                </div>
              ) : null}

              <div className="sequence" aria-label={`${track.title} sequence`}>
                {track.concepts.slice(0, 4).map((concept, index) => (
                  <span key={concept.href} className="sequence-item">
                    <span className="sequence-index">{index + 1}</span>
                    {concept.title}
                  </span>
                ))}
              </div>
            </Link>
          )
        })}
      </div>

      <style jsx>{`
        .entry-surface {
          min-height: auto;
          padding: 1rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.13), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(248, 243, 234, 0.96));
          backdrop-filter: blur(12px) saturate(112%);
        }

        .entry-header {
          padding: 0.15rem 0.15rem 0;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #0f766e;
        }

        h2 {
          margin: 0;
          max-width: 15ch;
          font-family: var(--font-display);
          font-size: clamp(1.55rem, 3.2vw, 2.15rem);
          line-height: 0.98;
          color: #151d27;
        }

        .entry-list {
          display: grid;
          gap: 0;
          border-top: 1px solid rgba(27, 36, 48, 0.1);
        }

        .entry-list :global(.entry-row) {
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(132px, 0.48fr);
          gap: 0.75rem;
          padding: 0.72rem 0.15rem;
          border-bottom: 1px solid rgba(27, 36, 48, 0.1);
          color: inherit;
          text-decoration: none;
          transition: transform 0.18s ease, background 0.18s ease;
        }

        .entry-list :global(.entry-row:hover) {
          transform: translateX(4px);
          background: rgba(255, 251, 245, 0.36);
          text-shadow: none;
        }

        .entry-main {
          display: grid;
          grid-template-columns: 4px minmax(0, 1fr);
          gap: 0.75rem;
          align-items: start;
        }

        .entry-rule {
          width: 4px;
          min-height: 100%;
          border-radius: 999px;
          background: var(--accent);
        }

        h3 {
          margin: 0;
          font-size: 1.08rem;
          line-height: 1.2;
          color: #151d27;
        }

        p {
          margin: 0.35rem 0 0;
          color: #455361;
          line-height: 1.45;
        }

        .first-step {
          display: grid;
          align-content: start;
          justify-items: start;
          gap: 0.35rem;
        }

        .step-label {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5b6874;
        }

        .first-step strong {
          color: #151d27;
          line-height: 1.25;
        }

        .signals {
          display: flex;
          flex-wrap: wrap;
          gap: 0.32rem;
        }

        .signals span {
          padding: 0.22rem 0.42rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.9);
          border: 1px solid rgba(27, 36, 48, 0.09);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          color: #4f5c68;
        }

        .sequence {
          grid-column: 1 / -1;
          display: flex;
          flex-wrap: wrap;
          gap: 0.36rem;
          padding-left: 0.65rem;
        }

        .sequence-item {
          display: inline-flex;
          align-items: center;
          gap: 0.38rem;
          color: #4f5c68;
          font-size: 0.78rem;
        }

        .sequence-index {
          display: inline-grid;
          place-items: center;
          width: 1.35rem;
          height: 1.35rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--accent) 16%, white);
          color: color-mix(in srgb, var(--accent) 72%, #1b2430);
          font-family: var(--font-mono);
          font-size: 0.68rem;
        }

        @media (max-width: 720px) {
          .entry-surface {
            padding: 1rem;
          }

          .entry-list :global(.entry-row) {
            grid-template-columns: 1fr;
          }

          h2 {
            max-width: 100%;
          }
        }
      `}</style>
    </section>
  )
}
