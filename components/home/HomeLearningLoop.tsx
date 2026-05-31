import type { CSSProperties } from 'react'
import Link from 'next/link'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type Step = {
  id: string
  title: string
  kicker: string
  description: string
  note: string
  href: string
  linkLabel: string
  accent: string
}

type Props = {
  steps: Step[]
}

export default function HomeLearningLoop({ steps }: Props) {
  return (
    <section className="learning-loop">
      <SurfaceBackplate variant="path" density="quiet" />
      <div className="section-header">
        <p className="eyebrow">Editorial Method</p>
        <h2>Every page follows the same teaching contract</h2>
        <p>
          The site is not an archive of notes. It is a repeatable notebook format for turning abstract ML ideas into
          something you can reason through from first contact to implementation.
        </p>
      </div>

      <div className="loop-grid">
        {steps.map((step, index) => (
          <article key={step.id} className="step-card" style={{ '--accent': step.accent } as CSSProperties}>
            <div className="step-meta">
              <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="step-label">{step.title}</span>
            </div>
            <h3>{step.kicker}</h3>
            <p className="step-description">{step.description}</p>
            <p className="step-note">{step.note}</p>
            <Link href={step.href} className="step-link">
              Study {step.linkLabel}
            </Link>
          </article>
        ))}
      </div>

      <style jsx>{`
        .learning-loop {
          position: relative;
          overflow: hidden;
          margin: 0 0 2.2rem;
          padding: 1.4rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.68);
        }

        .section-header,
        .loop-grid {
          position: relative;
          z-index: 1;
        }

        .section-header {
          max-width: 58rem;
          margin-bottom: 1.2rem;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.74rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #0f766e;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.8rem, 4vw, 2.6rem);
          line-height: 1;
        }

        .section-header p:last-child {
          margin: 0.85rem 0 0;
          color: #4f5c68;
          line-height: 1.75;
        }

        .loop-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .step-card {
          position: relative;
          display: flex;
          flex-direction: column;
          min-height: 260px;
          padding: 1.1rem;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            radial-gradient(circle at top right, color-mix(in srgb, var(--accent) 18%, white), transparent 34%),
            rgba(248, 243, 234, 0.95);
          box-shadow: 0 14px 28px rgba(27, 36, 48, 0.06);
        }

        .step-card::before {
          content: '';
          position: absolute;
          inset: 0 0 auto;
          height: 5px;
          border-radius: 22px 22px 0 0;
          background: var(--accent);
        }

        .step-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.1rem;
          font-family: var(--font-mono);
        }

        .step-index {
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          color: #5b6874;
        }

        .step-label {
          font-size: 0.78rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: color-mix(in srgb, var(--accent) 76%, #1b2430);
        }

        h3 {
          margin: 0;
          font-size: 1.15rem;
          line-height: 1.35;
          color: #151d27;
        }

        .step-description {
          margin: 0.85rem 0 0;
          color: #455361;
          line-height: 1.72;
        }

        .step-note {
          margin: auto 0 0;
          padding-top: 1rem;
          font-size: 0.94rem;
          color: #4f5c68;
        }

        .step-card :global(.step-link) {
          display: inline-flex;
          margin-top: 1rem;
          font-weight: 600;
          color: #1b2430;
          text-decoration: none;
        }

        .step-card :global(.step-link:hover) {
          text-shadow: none;
          color: color-mix(in srgb, var(--accent) 78%, #1b2430);
        }

        @media (max-width: 1080px) {
          .loop-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .learning-loop {
            padding: 1rem;
          }

          .loop-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
