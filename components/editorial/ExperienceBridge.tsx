import Link from 'next/link'
import SurfaceBackplate, { type SurfaceBackplateVariant } from './SurfaceBackplate'

export type ExperienceBridgeItem = {
  label: string
  title: string
  body: string
  href?: string
  cta?: string
}

type Props = {
  eyebrow?: string
  title: string
  intro?: string
  items: ExperienceBridgeItem[]
  variant?: SurfaceBackplateVariant
  compact?: boolean
}

export default function ExperienceBridge({
  eyebrow = 'Experience Bridge',
  title,
  intro,
  items,
  variant = 'path',
  compact = false,
}: Props) {
  return (
    <section className={`experience-bridge ${compact ? 'compact' : ''}`} aria-label={eyebrow}>
      <SurfaceBackplate variant={variant} density="quiet" />
      <div className="bridge-header">
        <p>{eyebrow}</p>
        <h2>{title}</h2>
        {intro ? <span>{intro}</span> : null}
      </div>

      <div className="bridge-grid">
        {items.map((item) => (
          <article key={`${item.label}-${item.title}`} className="bridge-card">
            <span>{item.label}</span>
            <strong>{item.title}</strong>
            <p>{item.body}</p>
            {item.href && item.cta ? (
              <Link href={item.href} className="bridge-link">
                {item.cta}
              </Link>
            ) : null}
          </article>
        ))}
      </div>

      <style jsx>{`
        .experience-bridge {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          padding: 1.15rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.7);
        }

        .experience-bridge.compact {
          padding: 1rem;
        }

        .bridge-header,
        .bridge-grid {
          position: relative;
          z-index: 1;
        }

        .bridge-header {
          display: grid;
          gap: 0.45rem;
          max-width: 58rem;
        }

        .bridge-header p,
        .bridge-card span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .bridge-header h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.45rem, 3vw, 2.15rem);
          line-height: 1.04;
          color: #151d27;
          letter-spacing: 0;
        }

        .bridge-header span {
          color: #52606b;
          line-height: 1.62;
        }

        .bridge-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .experience-bridge.compact .bridge-grid {
          grid-template-columns: 1fr;
        }

        .bridge-card {
          display: grid;
          align-content: start;
          gap: 0.55rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.05);
        }

        .bridge-card span {
          color: #5a6874;
        }

        .bridge-card strong {
          color: #17202a;
          font-size: 1.03rem;
          line-height: 1.3;
          overflow-wrap: anywhere;
        }

        .bridge-card p {
          margin: 0;
          color: #4c5967;
          line-height: 1.55;
        }

        .bridge-card :global(.bridge-link) {
          align-self: end;
          margin-top: auto;
          color: #1f4b99;
          font-weight: 700;
          text-decoration: none;
        }

        .bridge-card :global(.bridge-link:hover) {
          color: #17202a;
          text-shadow: none;
        }

        @media (max-width: 880px) {
          .bridge-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
