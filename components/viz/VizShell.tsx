import type { ReactNode } from 'react'
import SurfaceBackplate, { type SurfaceBackplateVariant } from '../editorial/SurfaceBackplate'

type Props = {
  eyebrow?: string
  title: string
  subtitle?: string
  surface?: SurfaceBackplateVariant
  metrics?: string[]
  controls?: ReactNode
  notes?: ReactNode
  challenge?: ReactNode
  challengePlacement?: 'before-stage' | 'after-stage'
  children: ReactNode
}

export default function VizShell({
  eyebrow,
  title,
  subtitle,
  surface = 'demo',
  metrics = [],
  controls,
  notes,
  challenge,
  challengePlacement = 'after-stage',
  children,
}: Props) {
  const challengeBeforeStage = Boolean(challenge && challengePlacement === 'before-stage')

  return (
    <section className="viz-shell">
      <SurfaceBackplate variant={surface} density="quiet" />
      <header className="viz-header">
        <div className="viz-copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h3>{title}</h3>
          {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        </div>
        {metrics.length ? (
          <div className="metric-strip">
            {metrics.map((metric) => (
              <span key={metric} className="metric-pill">{metric}</span>
            ))}
          </div>
        ) : null}
      </header>

      {controls ? <div className="control-rail">{controls}</div> : null}

      {challengeBeforeStage ? <div className="challenge challenge-before">{challenge}</div> : null}

      <div className="stage">{children}</div>

      {(notes || (challenge && !challengeBeforeStage)) ? (
        <div className="lower-grid">
          {notes ? <div className="notes">{notes}</div> : null}
          {challenge && !challengeBeforeStage ? <div className="challenge">{challenge}</div> : null}
        </div>
      ) : null}

      <style jsx>{`
        .viz-shell {
          position: relative;
          overflow: hidden;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.96), rgba(243, 236, 223, 0.92));
          padding: 1rem;
        }

        .viz-header,
        .control-rail,
        .stage,
        .challenge-before,
        .lower-grid {
          position: relative;
          z-index: 1;
        }

        .viz-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: start;
          margin-bottom: 0.8rem;
        }

        .eyebrow {
          margin: 0 0 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.2rem;
          color: #17202a;
          letter-spacing: -0.02em;
        }

        .subtitle {
          margin: 0.45rem 0 0;
          color: #52606c;
          font-size: 0.94rem;
          line-height: 1.6;
        }

        .metric-strip {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 0.5rem;
        }

        .metric-pill {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0.4rem 0.62rem;
          border-radius: 999px;
          background: rgba(255, 251, 245, 0.9);
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4b5965;
          font-size: 0.75rem;
          font-family: var(--font-mono);
        }

        .control-rail {
          display: flex;
          flex-wrap: wrap;
          gap: 0.6rem;
          padding: 0.7rem 0.85rem;
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.7);
          border: 1px solid rgba(27, 36, 48, 0.08);
          margin-bottom: 0.8rem;
        }

        .stage {
          border-radius: 18px;
          overflow: hidden;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.06), transparent 26%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.95), rgba(242, 235, 222, 0.9));
        }

        .lower-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.8rem;
          margin-top: 0.8rem;
        }

        .notes,
        .challenge {
          padding: 0.9rem;
          border-radius: 16px;
          background: rgba(255, 251, 245, 0.75);
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4d5a67;
        }

        .challenge-before {
          margin-bottom: 0.8rem;
        }

        @media (max-width: 720px) {
          .viz-header,
          .lower-grid {
            grid-template-columns: 1fr;
            display: grid;
          }

          .metric-strip {
            justify-content: flex-start;
          }
        }

        @media (max-width: 640px) {
          .viz-shell {
            padding: 0.68rem;
            border-radius: 16px;
          }

          .viz-header {
            gap: 0.65rem;
            margin-bottom: 0.6rem;
          }

          h3 {
            font-size: 0.92rem;
            line-height: 1.14;
            overflow-wrap: anywhere;
          }

          .subtitle {
            display: none;
          }

          .stage {
            border-radius: 12px;
          }

          .challenge {
            padding: 0.74rem;
            border-radius: 12px;
          }

          .metric-strip {
            gap: 0.38rem;
          }

          .metric-pill {
            min-height: 28px;
            padding: 0.32rem 0.48rem;
            font-size: 0.68rem;
          }
        }
      `}</style>
    </section>
  )
}
