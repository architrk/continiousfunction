import type { ReactNode } from 'react'

type Props = {
  eyebrow?: string
  title: string
  intro?: string
  aside?: ReactNode
  children: ReactNode
}

export default function NotebookSection({
  eyebrow,
  title,
  intro,
  aside,
  children,
}: Props) {
  return (
    <section className="notebook-section">
      <div className="section-header">
        <div className="section-copy">
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h2>{title}</h2>
          {intro ? <p className="intro">{intro}</p> : null}
        </div>
        {aside ? <div className="section-aside">{aside}</div> : null}
      </div>

      <div className="section-body">{children}</div>

      <style jsx>{`
        .notebook-section {
          padding: 1.35rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.08), transparent 32%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.06), transparent 34%),
            rgba(248, 243, 234, 0.9);
          box-shadow: 0 18px 42px rgba(5, 12, 20, 0.06);
        }

        .section-header {
          display: flex;
          align-items: start;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .eyebrow {
          margin: 0 0 0.45rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.4rem, 2vw, 2rem);
          line-height: 1.05;
          color: #17202a;
          letter-spacing: -0.02em;
        }

        .intro {
          margin: 0.65rem 0 0;
          color: #52606c;
          line-height: 1.7;
        }

        .section-aside {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          justify-content: flex-end;
        }

        .section-body {
          min-width: 0;
        }

        @media (max-width: 720px) {
          .notebook-section {
            padding: 1rem;
            border-radius: 18px;
          }

          .section-header {
            flex-direction: column;
          }

          .section-aside {
            justify-content: flex-start;
          }
        }
      `}</style>
    </section>
  )
}
