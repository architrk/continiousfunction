import Link from 'next/link'
import type { CSSProperties } from 'react'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

const modes = [
  {
    label: 'Learner',
    title: 'Repair the missing prerequisite before the paper gets dense.',
    prompt: 'I know the topic, but the notation keeps slipping.',
    href: '/paths/attention-serving/',
    action: 'Follow a route',
    details: ['Prerequisite order', 'Notation checkpoints', 'Resume state'],
    accent: '#0f766e',
  },
  {
    label: 'Researcher',
    title: 'Attach a question to the exact claim, equation, or demo state.',
    prompt: 'I need to test what this paper is really claiming.',
    href: '/paper-map/',
    action: 'Map a paper',
    details: ['Paper clue', 'Source object', 'Next experiment'],
    accent: '#1f4b99',
  },
  {
    label: 'Experimenter',
    title: 'Predict the mechanism, reveal the invariant, then stress it.',
    prompt: 'I want the idea to fail somewhere visible.',
    href: '/domains/attention-transformers/long-context/',
    action: 'Open a lab',
    details: ['Prediction gate', 'Live controls', 'Failure regime'],
    accent: '#c24a2d',
  },
  {
    label: 'Professor',
    title: 'Use the notebook as a teachable spine from intuition to code.',
    prompt: 'I need a rigorous sequence students can reason through.',
    href: '/domains/probability/maximum-likelihood/',
    action: 'Open a lesson',
    details: ['Mental model', 'Derivation', 'Runnable witness'],
    accent: '#6d4cc2',
  },
]

const flow = [
  'Question',
  'Concept',
  'Equation',
  'Code',
  'Prediction',
  'Discussion',
]

export default function HomeModeSwitchboard() {
  return (
    <section className="mode-switchboard" aria-labelledby="mode-switchboard-title">
      <SurfaceBackplate variant="atlas" density="quiet" />

      <div className="switchboard-header">
        <p className="eyebrow">Choose The Working Mode</p>
        <h2 id="mode-switchboard-title">The same atlas should meet different kinds of thinking.</h2>
        <p>
          Start from the job in front of you: learn a path, inspect a research claim, run a toy experiment, or teach the
          mechanism. Each entry keeps the route tied to concepts, equations, code, and prediction-first demos.
        </p>
      </div>

      <div className="mode-grid">
        {modes.map((mode) => (
          <Link
            key={mode.label}
            href={mode.href}
            className="mode-card"
            style={{ '--mode-accent': mode.accent } as CSSProperties}
          >
            <span className="mode-label">{mode.label}</span>
            <h3>{mode.title}</h3>
            <p>{mode.prompt}</p>
            <div className="detail-row" aria-label={`${mode.label} route signals`}>
              {mode.details.map((detail) => (
                <span key={detail}>{detail}</span>
              ))}
            </div>
            <strong>{mode.action}</strong>
          </Link>
        ))}
      </div>

      <div className="flow-strip" aria-label="Object-attached learning flow">
        {flow.map((item, index) => (
          <span key={item} className={index === flow.length - 1 ? 'final' : ''}>
            {item}
          </span>
        ))}
      </div>

      <style jsx>{`
        .mode-switchboard {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          padding: 1.15rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.72), rgba(248, 243, 234, 0.92)),
            radial-gradient(circle at 82% 18%, rgba(31, 75, 153, 0.1), transparent 30%),
            radial-gradient(circle at 12% 86%, rgba(194, 74, 45, 0.08), transparent 34%);
        }

        .switchboard-header,
        .mode-grid,
        .flow-strip {
          position: relative;
          z-index: 1;
        }

        .switchboard-header {
          max-width: 66rem;
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
          overflow-wrap: break-word;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          max-width: 19ch;
          font-family: var(--font-display);
          font-size: clamp(1.7rem, 3.4vw, 2.75rem);
          line-height: 1;
        }

        .switchboard-header p:last-child {
          margin: 0.85rem 0 0;
          max-width: 70ch;
          color: #455361;
          line-height: 1.72;
        }

        .mode-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.85rem;
        }

        .mode-grid :global(.mode-card) {
          position: relative;
          display: grid;
          align-content: start;
          gap: 0.7rem;
          min-width: 0;
          min-height: 280px;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.94), rgba(248, 243, 234, 0.98)),
            radial-gradient(circle at top right, color-mix(in srgb, var(--mode-accent) 16%, white), transparent 34%);
          color: inherit;
          text-decoration: none;
          box-shadow: 0 14px 30px rgba(7, 15, 25, 0.06);
          transition: transform 0.18s ease, border-color 0.18s ease, box-shadow 0.18s ease;
        }

        .mode-grid :global(.mode-card)::before {
          content: '';
          position: absolute;
          inset: 0 0 auto;
          height: 4px;
          border-radius: 8px 8px 0 0;
          background: var(--mode-accent);
        }

        .mode-grid :global(.mode-card:hover) {
          transform: translateY(-3px);
          border-color: color-mix(in srgb, var(--mode-accent) 34%, rgba(27, 36, 48, 0.1));
          box-shadow: 0 18px 38px rgba(7, 15, 25, 0.09);
          text-shadow: none;
        }

        .mode-label {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: color-mix(in srgb, var(--mode-accent) 76%, #1b2430);
        }

        h3 {
          font-size: 1.1rem;
          line-height: 1.28;
        }

        .mode-card p {
          margin: 0;
          color: #4c5967;
          line-height: 1.58;
        }

        .detail-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          margin-top: auto;
          padding-top: 0.35rem;
        }

        .detail-row span {
          display: inline-flex;
          align-items: center;
          min-height: 26px;
          padding: 0.28rem 0.45rem;
          border-radius: 999px;
          background: color-mix(in srgb, var(--mode-accent) 10%, white);
          border: 1px solid color-mix(in srgb, var(--mode-accent) 18%, rgba(27, 36, 48, 0.08));
          color: #455361;
          font-size: 0.72rem;
          line-height: 1.2;
        }

        .mode-card strong {
          color: #151d27;
          line-height: 1.25;
        }

        .flow-strip {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
          padding: 0.55rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .flow-strip span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 36px;
          padding: 0.42rem 0.5rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #254852;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-align: center;
          line-height: 1.2;
        }

        .flow-strip .final {
          background: rgba(194, 74, 45, 0.12);
          color: #743520;
        }

        @media (max-width: 1180px) {
          .mode-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .mode-switchboard {
            padding: 1rem;
          }

          h2 {
            max-width: 100%;
          }

          .mode-grid,
          .flow-strip {
            grid-template-columns: 1fr;
          }

          .mode-grid :global(.mode-card) {
            min-height: 0;
          }
        }
      `}</style>
    </section>
  )
}
