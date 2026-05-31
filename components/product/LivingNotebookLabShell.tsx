import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

export type LivingNotebookLabStep = {
  key: string
  label: string
  value: string
  detail?: string
}

export type LivingNotebookLabObject = {
  typeLabel: string
  title: string
  lensLabel?: string
}

export type LivingNotebookLabPrediction = {
  id: string
  label: string
  claim: string
  accent?: string
}

export type LivingNotebookLabAction = {
  id: string
  label: string
  href?: string
  onClick?: () => void
  variant?: 'primary' | 'secondary'
}

export type LivingNotebookLabInvariant = {
  label?: string
  title: string
  detail?: string
  accent?: string
}

type LivingNotebookLabShellProps = {
  id?: string
  eyebrow?: string
  title: string
  intro: string
  selectedObject: LivingNotebookLabObject
  steps: LivingNotebookLabStep[]
  predictionPrompt: string
  predictions: LivingNotebookLabPrediction[]
  activePredictionId?: string
  invariant: LivingNotebookLabInvariant
  actions: LivingNotebookLabAction[]
  onSelectPrediction: (predictionId: string) => void
  children?: ReactNode
}

export default function LivingNotebookLabShell({
  id,
  eyebrow = 'Mathematical Workbench',
  title,
  intro,
  selectedObject,
  steps,
  predictionPrompt,
  predictions,
  activePredictionId,
  invariant,
  actions,
  onSelectPrediction,
  children,
}: LivingNotebookLabShellProps) {
  const selectedPrediction = predictions.find((prediction) => prediction.id === activePredictionId)
  const activePrediction = selectedPrediction ?? predictions[0]
  const activeAccent = invariant.accent ?? activePrediction?.accent ?? '#1f6f78'

  return (
    <section
      id={id}
      className="living-lab-shell"
      aria-labelledby={id ? `${id}-title` : undefined}
      data-living-notebook-lab-shell="v1"
    >
      <div className="shell-header">
        <div>
          <p className="shell-eyebrow">{eyebrow}</p>
          <h2 id={id ? `${id}-title` : undefined}>{title}</h2>
          <p>{intro}</p>
        </div>

        <div className="object-badge" aria-label="Selected learning object">
          <span>{selectedObject.typeLabel}</span>
          <strong>{selectedObject.title}</strong>
          {selectedObject.lensLabel ? <em>{selectedObject.lensLabel}</em> : null}
        </div>
      </div>

      <div className="shell-loop" aria-label="Learning object workbench loop">
        {steps.map((step, index) => (
          <article key={step.key}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <p>{step.value}</p>
            {step.detail ? <em>{step.detail}</em> : null}
          </article>
        ))}
      </div>

      <div className="shell-main">
        <div className="prediction-gate" aria-label="Prediction gate">
          <div>
            <p className="shell-eyebrow">Prediction Gate</p>
            <h3>{predictionPrompt}</h3>
          </div>
          <div className="prediction-list">
            {predictions.map((prediction) => (
              <button
                key={prediction.id}
                type="button"
                className={prediction.id === activePredictionId ? 'active' : ''}
                style={{ '--shell-accent': prediction.accent ?? '#1f6f78' } as CSSProperties}
                aria-pressed={prediction.id === activePredictionId}
                onClick={() => onSelectPrediction(prediction.id)}
              >
                <span>{prediction.label}</span>
                <strong>{prediction.claim}</strong>
              </button>
            ))}
          </div>
        </div>

        <article className="invariant-card" style={{ '--shell-accent': activeAccent } as CSSProperties}>
          <span>{invariant.label ?? 'Invariant To Carry'}</span>
          <strong>{invariant.title}</strong>
          {invariant.detail ? <p>{invariant.detail}</p> : null}
          <div className="shell-actions">
            {actions.map((action) =>
              action.href ? (
                <Link
                  key={action.id}
                  href={action.href}
                  className={action.variant === 'primary' ? 'primary' : undefined}
                  onClick={action.onClick}
                >
                  {action.label}
                </Link>
              ) : (
                <button
                  key={action.id}
                  type="button"
                  className={action.variant === 'primary' ? 'primary' : undefined}
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </article>
      </div>

      {children ? <div className="shell-extension">{children}</div> : null}

      <style jsx>{`
        .living-lab-shell {
          display: grid;
          gap: 0.9rem;
          min-width: 0;
          padding: 1rem;
          scroll-margin-top: 9rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background:
            linear-gradient(135deg, rgba(231, 248, 244, 0.86), rgba(255, 251, 245, 0.92) 48%, rgba(255, 244, 238, 0.76)),
            rgba(255, 251, 245, 0.9);
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        .shell-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(15rem, 0.35fr);
          gap: 0.85rem;
          align-items: stretch;
          min-width: 0;
        }

        .shell-eyebrow,
        .object-badge span,
        .object-badge em,
        .shell-loop span,
        .shell-loop em,
        .invariant-card > span,
        .prediction-list span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .shell-eyebrow,
        .object-badge span,
        .shell-loop span,
        .invariant-card > span,
        .prediction-list span {
          color: #1f6f78;
        }

        h2,
        h3 {
          margin: 0;
          padding-left: 0;
          color: #151d27;
          letter-spacing: 0;
          position: static;
          overflow-wrap: anywhere;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          font-family: var(--font-display);
          font-size: clamp(1.72rem, 3vw, 2.52rem);
          line-height: 1.08;
        }

        h3 {
          font-size: 1.1rem;
          line-height: 1.2;
        }

        .shell-header p:not(.shell-eyebrow),
        .invariant-card p {
          margin: 0.62rem 0 0;
          color: #455361;
          line-height: 1.62;
          overflow-wrap: anywhere;
        }

        .object-badge {
          display: grid;
          align-content: center;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.8rem;
          border-radius: 18px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(255, 251, 245, 0.84);
        }

        .object-badge strong {
          color: #151d27;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .object-badge em {
          color: #c24a2d;
          font-style: normal;
        }

        .shell-loop {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(9.25rem, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .shell-loop article {
          display: grid;
          align-content: start;
          gap: 0.32rem;
          min-width: 0;
          min-height: 148px;
          padding: 0.68rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .shell-loop strong {
          color: #151d27;
          line-height: 1.25;
        }

        .shell-loop p {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 4;
          margin: 0;
          overflow: hidden;
          color: #455361;
          font-size: 0.84rem;
          line-height: 1.42;
          overflow-wrap: anywhere;
        }

        .shell-loop em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          margin-top: auto;
          overflow: hidden;
          color: #6a5660;
          font-style: normal;
          line-height: 1.32;
          text-transform: none;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .shell-main {
          display: grid;
          grid-template-columns: minmax(0, 1.05fr) minmax(18rem, 0.85fr);
          gap: 0.75rem;
          min-width: 0;
        }

        .prediction-gate,
        .invariant-card {
          display: grid;
          align-content: start;
          gap: 0.65rem;
          min-width: 0;
          padding: 0.85rem;
          border-radius: 18px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .prediction-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.5rem;
          min-width: 0;
        }

        .prediction-list button {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          min-height: 128px;
          padding: 0.68rem;
          border-radius: 15px;
          border: 1px solid color-mix(in srgb, var(--shell-accent) 20%, rgba(27, 36, 48, 0.1));
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--shell-accent) 11%, transparent), transparent 78%),
            rgba(255, 251, 245, 0.88);
          color: #1b2430;
          font: inherit;
          text-align: left;
          cursor: pointer;
        }

        .prediction-list button.active,
        .prediction-list button:hover {
          border-color: color-mix(in srgb, var(--shell-accent) 54%, rgba(27, 36, 48, 0.1));
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--shell-accent) 18%, transparent), transparent 76%),
            rgba(255, 251, 245, 0.94);
          transform: translateY(-1px);
        }

        .prediction-list strong {
          color: #24313e;
          font-size: 0.86rem;
          line-height: 1.38;
          overflow-wrap: anywhere;
        }

        .invariant-card {
          border-color: color-mix(in srgb, var(--shell-accent) 28%, rgba(27, 36, 48, 0.08));
          border-left: 4px solid var(--shell-accent);
        }

        .invariant-card > strong {
          color: #151d27;
          line-height: 1.22;
          overflow-wrap: anywhere;
        }

        .shell-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .shell-actions :global(a),
        .shell-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          max-width: 100%;
          padding: 0.58rem 0.82rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          font: inherit;
          font-weight: 760;
          line-height: 1.15;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
        }

        .shell-actions :global(a.primary),
        .shell-actions button.primary {
          background: #1b2430;
          color: #fbf4e8;
        }

        .shell-actions :global(a:hover),
        .shell-actions button:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
        }

        .shell-extension {
          min-width: 0;
        }

        @media (max-width: 1120px) {
          .shell-header,
          .shell-main {
            grid-template-columns: 1fr;
          }

          .shell-loop {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 760px) {
          .living-lab-shell {
            padding: 0.9rem;
            border-radius: 20px;
          }

          .shell-loop,
          .prediction-list {
            grid-template-columns: 1fr;
          }

          .shell-loop article {
            min-height: 0;
          }

          .shell-actions,
          .shell-actions :global(a),
          .shell-actions button {
            width: 100%;
          }
        }
      `}</style>
    </section>
  )
}
