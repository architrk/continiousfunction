type LearningLoopStep = {
  key: string
  label: string
  detail: string
}

type LivingLearningLoopRailProps = {
  surface: string
  summary: string
  activeKey: string
  steps: LearningLoopStep[]
}

export default function LivingLearningLoopRail({
  surface,
  summary,
  activeKey,
  steps,
}: LivingLearningLoopRailProps) {
  return (
    <section className="loop-rail cf-next-move-dock" aria-label={`${surface} learning loop`}>
      <div className="loop-copy">
        <p className="loop-eyebrow">Living Notebook Lab</p>
        <h2>{surface}</h2>
        <p>{summary}</p>
      </div>

      <ol className="loop-steps">
        {steps.map((step, index) => {
          const isActive = step.key === activeKey
          const isComplete = steps.findIndex((item) => item.key === activeKey) > index
          return (
            <li
              key={step.key}
              className={`loop-step ${isActive ? 'is-active' : ''} ${isComplete ? 'is-complete' : ''}`}
            >
              <span className="loop-index">{index + 1}</span>
              <span className="loop-step-copy">
                <strong>{step.label}</strong>
                <small>{step.detail}</small>
              </span>
            </li>
          )
        })}
      </ol>

      <style jsx>{`
        .loop-rail {
          display: grid;
          grid-template-columns: minmax(0, 0.78fr) minmax(0, 1.22fr);
          gap: 1rem;
          align-items: stretch;
          padding: 1rem;
          border-radius: 14px;
          color: var(--cf-ink);
          box-shadow: 0 14px 32px rgba(16, 32, 51, 0.08);
        }

        .loop-copy {
          display: grid;
          align-content: center;
          gap: 0.42rem;
          min-width: 0;
        }

        .loop-eyebrow {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--cf-invariant);
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(1.15rem, 2vw, 1.55rem);
          line-height: 1.05;
          color: var(--cf-ink);
          letter-spacing: 0;
        }

        .loop-copy p:last-child {
          margin: 0;
          color: var(--cf-ink-muted);
          line-height: 1.55;
          font-size: 0.92rem;
        }

        .loop-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
          min-width: 0;
        }

        .loop-step {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.48rem;
          align-items: start;
          min-width: 0;
          min-height: 5.2rem;
          padding: 0.72rem;
          border-radius: 12px;
          border: 1px solid rgba(16, 32, 51, 0.1);
          background: rgba(255, 251, 245, 0.58);
        }

        .loop-step.is-complete {
          border-color: rgba(79, 143, 216, 0.28);
          background: var(--cf-evidence-soft);
        }

        .loop-step.is-active {
          border-color: rgba(232, 180, 73, 0.46);
          background: linear-gradient(135deg, var(--cf-active-soft), rgba(255, 251, 245, 0.72));
        }

        .loop-index {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.45rem;
          height: 1.45rem;
          border-radius: 999px;
          border: 1px solid rgba(16, 32, 51, 0.14);
          color: var(--cf-ink-muted);
          font-family: var(--font-mono);
          font-size: 0.68rem;
          background: rgba(255, 251, 245, 0.72);
        }

        .loop-step.is-active .loop-index {
          border-color: rgba(232, 180, 73, 0.5);
          color: #7a4c00;
          background: rgba(232, 180, 73, 0.18);
        }

        .loop-step-copy {
          min-width: 0;
          display: grid;
          gap: 0.16rem;
        }

        .loop-step-copy strong {
          color: var(--cf-ink);
          font-size: 0.82rem;
          line-height: 1.2;
        }

        .loop-step-copy small {
          color: var(--cf-ink-muted);
          font-size: 0.74rem;
          line-height: 1.35;
        }

        @media (max-width: 900px) {
          .loop-rail {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .loop-rail {
            padding: 0.82rem;
          }

          .loop-steps {
            grid-template-columns: 1fr;
          }

          .loop-step {
            min-height: 4.25rem;
          }
        }
      `}</style>
    </section>
  )
}
