import Link from 'next/link'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type ReaderLens = {
  role: string
  value: string
  evidence: string
  href?: string
  linkLabel?: string
}

type Props = {
  lenses?: ReaderLens[]
  compact?: boolean
}

const defaultLenses: ReaderLens[] = [
  {
    role: 'Learner',
    value: 'A guided route through prerequisites, notation, code, and demos.',
    evidence: 'Start from a path, predict the demo, then ask the companion to repair the exact gap.',
    href: '/domains/linear-algebra/',
    linkLabel: 'Start foundations',
  },
  {
    role: 'Researcher',
    value: 'A quick way to inspect the mechanism, assumptions, and executable witness.',
    evidence: 'Use concept pages as small, testable models before jumping back to papers or experiments.',
    href: '/domains/alignment/process-reward-models/',
    linkLabel: 'Inspect a bridge',
  },
  {
    role: 'Professor',
    value: 'A teachable sequence with visual hooks, derivation checkpoints, and failure regimes.',
    evidence: 'Use the same page as a lecture spine: intuition first, then math, code, and manipulation.',
    href: '/domains/probability/maximum-likelihood/',
    linkLabel: 'Open a lesson',
  },
]

export default function ReaderLensPanel({ lenses = defaultLenses, compact = false }: Props) {
  return (
    <section className={`reader-lenses ${compact ? 'compact' : ''}`} aria-label="Reader value lenses">
      <SurfaceBackplate variant="path" density="quiet" />
      <div className="lens-header">
        <p className="eyebrow">Reader Lenses</p>
        <h2>One atlas, different depths of use.</h2>
      </div>

      <div className="lens-grid">
        {lenses.map((lens) => (
          <article key={lens.role} className="lens-card">
            <span>{lens.role}</span>
            <h3>{lens.value}</h3>
            <p>{lens.evidence}</p>
            {lens.href && lens.linkLabel ? (
              <Link href={lens.href} className="lens-link">
                {lens.linkLabel}
              </Link>
            ) : null}
          </article>
        ))}
      </div>

      <style jsx>{`
        .reader-lenses {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          padding: 1.15rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.68);
        }

        .reader-lenses.compact {
          padding: 1rem;
        }

        .lens-header,
        .lens-grid {
          position: relative;
          z-index: 1;
        }

        .lens-header {
          max-width: 56rem;
        }

        .eyebrow {
          margin: 0 0 0.5rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        h3 {
          margin: 0;
          color: #151d27;
          letter-spacing: 0;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          font-family: var(--font-display);
          font-size: clamp(1.55rem, 3vw, 2.35rem);
          line-height: 1.02;
        }

        .lens-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .lens-card {
          display: grid;
          align-content: start;
          gap: 0.65rem;
          min-width: 0;
          min-height: 230px;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.06);
        }

        .lens-card span {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #5a6874;
        }

        h3 {
          font-size: 1.12rem;
          line-height: 1.28;
        }

        p {
          margin: 0;
          color: #4c5967;
          line-height: 1.62;
        }

        :global(.lens-link) {
          align-self: end;
          margin-top: auto;
          color: #1f4b99;
          font-weight: 700;
          text-decoration: none;
        }

        :global(.lens-link:hover) {
          color: #17202a;
          text-shadow: none;
        }

        @media (max-width: 980px) {
          .lens-grid {
            grid-template-columns: 1fr;
          }

          .lens-card {
            min-height: 0;
          }
        }
      `}</style>
    </section>
  )
}
