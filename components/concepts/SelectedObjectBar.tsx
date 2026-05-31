export type SelectedObjectOption = {
  id: string
  label: string
  typeLabel: string
  contextLabel: string
  href?: string
}

export type SelectedObjectAction = {
  id: 'predict' | 'code' | 'ask' | 'return' | 'inspect'
  label: string
  detail?: string
  href: string
  primary?: boolean
  onClick?: () => void
}

export type SelectedObjectBadge = {
  label: string
  tone?: 'neutral' | 'source' | 'claim' | 'saved' | 'warning'
}

export type SelectedObjectSavedAction = {
  label: string
  title: string
  detail: string
  resolved?: boolean
}

export type SelectedObjectHistoryBridge = {
  label: string
  title: string
  detail: string
  href?: string
  links?: Array<{ href: string; label: string }>
  nextRepairLabel?: string | null
  nextRepairHref?: string | null
}

export type SelectedObjectWitness = {
  label: string
  title: string
  detail: string
  href: string
  onClick?: () => void
}

export type SelectedObjectBarProps = {
  progressLabel: string
  options: SelectedObjectOption[]
  selectedId: string
  selected: {
    typeLabel: string
    title: string
    context: string
    question?: string
    keyLabel?: string | null
  }
  badges?: SelectedObjectBadge[]
  actions: SelectedObjectAction[]
  savedAction?: SelectedObjectSavedAction | null
  historyBridge?: SelectedObjectHistoryBridge | null
  witnesses?: SelectedObjectWitness[]
  onSelect: (id: string) => void
}

export default function SelectedObjectBar({
  progressLabel,
  options,
  selectedId,
  selected,
  badges = [],
  actions,
  savedAction,
  historyBridge,
  witnesses = [],
  onSelect,
}: SelectedObjectBarProps) {
  if (!options.length) return null

  return (
    <section className="selected-object-control" aria-labelledby="selected-object-control-heading">
      <label className="object-selector" htmlFor="selected-object-control-picker">
        <span>Object</span>
        <select
          id="selected-object-control-picker"
          value={selectedId}
          onChange={(event) => onSelect(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.typeLabel}: {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="selected-object-main">
        <span>{progressLabel}</span>
        <h2 id="selected-object-control-heading">
          {selected.typeLabel}: {selected.title}
        </h2>
        <p>{selected.question ?? selected.context}</p>
      </div>

      <nav className="selected-object-actions" aria-label="Selected object actions">
        {actions.map((action) => (
          <a
            key={action.id}
            href={action.href}
            className={action.primary ? 'primary' : ''}
            onClick={action.onClick}
          >
            <strong>{action.label}</strong>
            {action.detail ? <span>{action.detail}</span> : null}
          </a>
        ))}
      </nav>

      <details className="selected-object-details">
        <summary>
          <span>Object context</span>
          <em>{selected.context}</em>
        </summary>

        <div className="details-grid">
          <div className="details-card">
            <span>State</span>
            <strong>{selected.context}</strong>
            {badges.length ? (
              <div className="badge-row" aria-label="Selected object badges">
                {badges.map((badge) => (
                  <em key={`${badge.tone ?? 'neutral'}-${badge.label}`} className={badge.tone ?? 'neutral'}>
                    {badge.label}
                  </em>
                ))}
              </div>
            ) : null}
            {selected.keyLabel ? <code>{selected.keyLabel}</code> : null}
          </div>

          {witnesses.length ? (
            <div className="witness-list" aria-label="Math, code, and demo witnesses">
              {witnesses.map((witness) => (
                <a key={witness.label} href={witness.href} onClick={witness.onClick}>
                  <span>{witness.label}</span>
                  <strong>{witness.title}</strong>
                  <em>{witness.detail}</em>
                </a>
              ))}
            </div>
          ) : null}

          {savedAction ? (
            <div className={`details-card saved ${savedAction.resolved ? 'resolved' : ''}`}>
              <span>{savedAction.label}</span>
              <strong>{savedAction.title}</strong>
              <em>{savedAction.detail}</em>
            </div>
          ) : null}

          {historyBridge ? (
            <div className="details-card history">
              <span>{historyBridge.label}</span>
              <strong>{historyBridge.title}</strong>
              <em>{historyBridge.detail}</em>
              <div className="history-links">
                {historyBridge.links?.map((link) => (
                  <a key={link.href} href={link.href}>
                    {link.label}
                  </a>
                ))}
                {historyBridge.nextRepairHref ? (
                  <a href={historyBridge.nextRepairHref}>Open {historyBridge.nextRepairLabel}</a>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      </details>

      <style jsx>{`
        .selected-object-control {
          position: sticky;
          top: 5.5rem;
          z-index: 9;
          display: grid;
          grid-template-columns: minmax(9rem, 0.24fr) minmax(18rem, 1fr) minmax(13rem, auto);
          gap: 0.62rem;
          align-items: center;
          min-width: 0;
          padding: 0.7rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background:
            linear-gradient(135deg, rgba(248, 243, 234, 0.96), rgba(239, 247, 245, 0.92)),
            rgba(255, 251, 245, 0.96);
          box-shadow: 0 14px 30px rgba(8, 16, 26, 0.09);
          backdrop-filter: blur(18px);
        }

        .object-selector,
        .selected-object-main,
        .details-card {
          display: grid;
          gap: 0.22rem;
          min-width: 0;
        }

        .object-selector span,
        .selected-object-main > span,
        .selected-object-details summary span,
        .details-card > span,
        .witness-list span {
          font-family: var(--font-mono);
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .object-selector select {
          width: 100%;
          min-width: 0;
          min-height: 2.25rem;
          padding: 0.42rem 0.55rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 75, 153, 0.14);
          background: rgba(255, 251, 245, 0.86);
          color: #17202a;
          font: inherit;
          font-size: 0.82rem;
        }

        .selected-object-main h2 {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          margin: 0;
          overflow: hidden;
          color: #17202a;
          font-family: var(--font-display);
          font-size: clamp(1rem, 1.35vw, 1.2rem);
          line-height: 1.08;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .selected-object-main h2::before {
          content: none;
          display: none;
        }

        .selected-object-main p,
        .selected-object-details summary em,
        .details-card em,
        .witness-list em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          margin: 0;
          overflow: hidden;
          color: #52606b;
          font-size: 0.78rem;
          font-style: normal;
          line-height: 1.32;
          overflow-wrap: anywhere;
        }

        .selected-object-main p {
          -webkit-line-clamp: 1;
        }

        .selected-object-actions {
          display: grid;
          grid-template-columns: repeat(3, minmax(4.15rem, 1fr));
          gap: 0.36rem;
          min-width: 0;
        }

        .selected-object-actions a {
          display: grid;
          justify-items: center;
          align-content: center;
          min-width: 0;
          min-height: 2.3rem;
          padding: 0.32rem 0.46rem;
          border-radius: 999px;
          border: 1px solid rgba(31, 75, 153, 0.14);
          background: rgba(255, 251, 245, 0.78);
          color: #1f4b99;
          text-align: center;
          text-decoration: none;
        }

        .selected-object-actions a.primary {
          border-color: rgba(244, 192, 111, 0.5);
          background: #f4c06f;
          color: #15282f;
        }

        .selected-object-actions strong {
          color: inherit;
          font-size: 0.76rem;
          line-height: 1.08;
        }

        .selected-object-actions span {
          color: #52606b;
          font-size: 0.58rem;
          line-height: 1.1;
        }

        .selected-object-actions a:hover,
        .witness-list a:hover,
        .history-links a:hover {
          border-color: rgba(31, 75, 153, 0.34);
          transform: translateY(-1px);
          text-shadow: none;
        }

        .selected-object-details {
          grid-column: 1 / -1;
          min-width: 0;
        }

        .selected-object-details summary {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.5rem;
          align-items: center;
          min-width: 0;
          cursor: pointer;
          padding: 0.34rem 0.48rem;
          border-radius: 9px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.64);
        }

        .selected-object-details summary em {
          -webkit-line-clamp: 1;
        }

        .details-grid {
          display: grid;
          grid-template-columns: minmax(12rem, 0.56fr) minmax(0, 1fr);
          gap: 0.5rem;
          min-width: 0;
          padding-top: 0.5rem;
        }

        .details-card {
          padding: 0.58rem;
          border-radius: 10px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .details-card strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #17202a;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .details-card em {
          -webkit-line-clamp: 2;
        }

        .details-card code {
          display: block;
          max-width: 100%;
          overflow-x: auto;
          padding: 0.32rem 0.42rem;
          border-radius: 7px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(247, 242, 233, 0.86);
          color: #394653;
          font-size: 0.62rem;
          white-space: nowrap;
        }

        .badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.28rem;
        }

        .badge-row em {
          display: inline-flex;
          align-items: center;
          min-height: 1.35rem;
          padding: 0.18rem 0.34rem;
          border-radius: 999px;
          background: rgba(239, 247, 245, 0.86);
          color: #394653;
          font-size: 0.56rem;
          line-height: 1.1;
        }

        .badge-row .claim,
        .badge-row .warning {
          background: rgba(255, 244, 238, 0.9);
          color: #92402a;
        }

        .badge-row .saved,
        .badge-row .source {
          background: rgba(231, 248, 244, 0.92);
          color: #1f6f78;
        }

        .witness-list {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.42rem;
          min-width: 0;
        }

        .witness-list a {
          display: grid;
          gap: 0.18rem;
          min-width: 0;
          min-height: 5rem;
          padding: 0.58rem;
          border-radius: 10px;
          border: 1px solid rgba(31, 75, 153, 0.12);
          background: rgba(255, 251, 245, 0.78);
          color: #17202a;
          text-decoration: none;
        }

        .witness-list strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #17202a;
          font-size: 0.84rem;
          line-height: 1.22;
          overflow-wrap: anywhere;
        }

        .witness-list em {
          -webkit-line-clamp: 2;
          font-size: 0.7rem;
        }

        .details-card.saved {
          grid-column: 1 / -1;
          border-color: rgba(194, 74, 45, 0.16);
          background:
            linear-gradient(90deg, rgba(194, 74, 45, 0.1), rgba(31, 111, 120, 0.08)),
            rgba(255, 251, 245, 0.82);
        }

        .details-card.saved.resolved,
        .details-card.history {
          grid-column: 1 / -1;
          border-color: rgba(31, 111, 120, 0.2);
          background:
            linear-gradient(90deg, rgba(31, 111, 120, 0.11), rgba(244, 192, 111, 0.1)),
            rgba(255, 251, 245, 0.84);
        }

        .history-links {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
          gap: 0.36rem;
        }

        .history-links a {
          display: inline-flex;
          justify-content: center;
          min-height: 1.9rem;
          padding: 0.32rem 0.42rem;
          border-radius: 7px;
          border: 1px solid rgba(31, 75, 153, 0.12);
          background: rgba(255, 251, 245, 0.82);
          color: #1f4b99;
          font-size: 0.7rem;
          font-weight: 760;
          line-height: 1.14;
          text-align: center;
          text-decoration: none;
        }

        @media (max-width: 900px) {
          .selected-object-control {
            grid-template-columns: 1fr;
            align-items: stretch;
          }

          .selected-object-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .details-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .selected-object-control {
            order: -3;
            top: 0.35rem;
            gap: 0.32rem;
            padding: 0.44rem;
            border-radius: 14px;
            box-shadow: 0 12px 24px rgba(8, 16, 26, 0.1);
          }

          .object-selector {
            gap: 0;
          }

          .object-selector span {
            position: absolute;
            width: 1px;
            height: 1px;
            margin: -1px;
            overflow: hidden;
            clip: rect(0, 0, 0, 0);
            white-space: nowrap;
          }

          .object-selector span,
          .selected-object-main > span,
          .selected-object-details summary span,
          .details-card > span,
          .witness-list span {
            font-size: 0.52rem;
          }

          .object-selector select {
            min-height: 1.78rem;
            padding: 0.22rem 0.4rem;
            font-size: 0.68rem;
          }

          .selected-object-main {
            gap: 0.12rem;
          }

          .selected-object-main h2 {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 1;
            overflow: hidden;
            font-size: 0.9rem;
            line-height: 1.08;
          }

          .selected-object-main p {
            display: none;
          }

          .selected-object-actions {
            gap: 0.28rem;
          }

          .selected-object-actions a {
            min-height: 1.6rem;
            padding: 0.18rem 0.28rem;
          }

          .selected-object-actions strong {
            font-size: 0.62rem;
          }

          .selected-object-actions span {
            display: none;
          }

          .selected-object-details {
            display: none;
          }

          .witness-list {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 0.34rem;
          }

          .witness-list a {
            min-height: 3.55rem;
            padding: 0.42rem;
          }

          .witness-list strong {
            -webkit-line-clamp: 1;
            font-size: 0.64rem;
          }

          .witness-list em {
            -webkit-line-clamp: 1;
            font-size: 0.54rem;
          }
        }
      `}</style>
    </section>
  )
}
