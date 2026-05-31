import Link from 'next/link'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'

type Observation = NonNullable<LearningRouteSnapshot['lastObservation']>

export type ObservationLedgerAction = {
  href: string
  label: string
  primary?: boolean
}

export type ObservationLedgerCardProps = {
  snapshot?: LearningRouteSnapshot | null
  observation?: Observation | null
  variant?: 'compact' | 'detailed' | 'inline'
  showEmpty?: boolean
  contextLabel?: string
  actions?: ObservationLedgerAction[]
}

function observationSourceLabel(source: Observation['source']) {
  switch (source) {
    case 'kv-memory-lab':
      return 'KV memory lab'
    case 'prediction-checkpoint':
      return 'prediction checkpoint'
    case 'learning-route':
    default:
      return 'learning route'
  }
}

function dateLabel(updatedAt: string) {
  const date = new Date(updatedAt)
  if (Number.isNaN(date.getTime())) return 'saved locally'

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function numberLabel(value: number) {
  return Number.isInteger(value) ? value.toLocaleString() : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

function unitLabel(unit: NonNullable<Observation['result']>['unit'] | undefined) {
  if (unit === 'GB-decimal') return 'GB'
  if (unit === 'GiB') return 'GiB'
  return ''
}

function heldFixedSummary(observation: Observation) {
  if (!observation.heldFixed?.length) return null

  return observation.heldFixed
    .map((item) => `${item.symbol}=${typeof item.value === 'number' ? numberLabel(item.value) : item.value}`)
    .join(', ')
}

function changedSummary(observation: Observation) {
  if (!observation.changed) return null

  return `${observation.changed.symbol}: ${numberLabel(observation.changed.from)} -> ${numberLabel(observation.changed.to)}`
}

function resultSummary(observation: Observation) {
  if (!observation.result) return null

  const unit = unitLabel(observation.result.unit)
  const before = `${numberLabel(observation.result.before)}${unit ? ` ${unit}` : ''}`
  const after = `${numberLabel(observation.result.after)}${unit ? ` ${unit}` : ''}`
  return `${before} -> ${after} (${numberLabel(observation.result.ratio)}x)`
}

function defaultActions(snapshot: LearningRouteSnapshot | null | undefined): ObservationLedgerAction[] {
  if (!snapshot) return []

  const actions: ObservationLedgerAction[] = []
  if (snapshot.currentObject?.href) {
    actions.push({
      href: snapshot.currentObject.href,
      label: 'Resume object',
      primary: true,
    })
  }

  actions.push({
    href: `/search/?q=${encodeURIComponent(snapshot.lastObservation?.nextQuestion ?? snapshot.nextRepair ?? snapshot.currentObject?.title ?? snapshot.paperTitle)}#route-search-lens`,
    label: 'Search next repair',
  })

  return actions.slice(0, 2)
}

export default function ObservationLedgerCard({
  snapshot,
  observation: controlledObservation,
  variant = 'compact',
  showEmpty = false,
  contextLabel,
  actions,
}: ObservationLedgerCardProps) {
  const observation = controlledObservation ?? snapshot?.lastObservation ?? null
  const actionList = actions ?? defaultActions(snapshot)

  if (!observation) {
    if (!showEmpty) return null

    return (
      <aside className={`observation-ledger-card ${variant} empty`} data-observation-ledger="empty" aria-label="Observation ledger">
        <p className="ledger-eyebrow">Observation Ledger</p>
        <strong>No observation saved yet</strong>
        <span>Make a prediction, reveal the witness, then save the result in this browser.</span>
        <style jsx>{ledgerStyles}</style>
      </aside>
    )
  }

  const changed = changedSummary(observation)
  const heldFixed = heldFixedSummary(observation)
  const result = resultSummary(observation)
  const hasFormulaDetails = observation.kind === 'formula-comparison' && (changed || heldFixed || result)
  const workbench = observation.workbench
  const title = variant === 'detailed' ? observation.label : `${observation.label}: ${observation.value}`
  const detail =
    workbench && variant === 'detailed'
      ? [observation.value, workbench.evidence, workbench.invariant].filter(Boolean).join(' ')
      : workbench
        ? workbench.evidence
        : variant === 'detailed'
          ? [observation.value, observation.detail].filter(Boolean).join('. ')
          : observation.detail ?? observation.nextQuestion ?? 'Observation saved in this browser.'

  return (
    <aside
      className={`observation-ledger-card ${variant} ${hasFormulaDetails ? 'formula' : ''}`}
      data-observation-ledger="saved"
      aria-label="Observation ledger"
    >
      <div className="ledger-main">
        <p className="ledger-eyebrow">Observation Ledger</p>
        <div className="ledger-title-row">
          <strong>{title}</strong>
          <span>{contextLabel ?? observation.label}</span>
        </div>
        <p>{detail}</p>
      </div>

      {hasFormulaDetails ? (
        <div className="ledger-facts" aria-label="Saved observation facts">
          {changed ? (
            <span>
              <em>Changed</em>
              <b>{changed}</b>
            </span>
          ) : null}
          {heldFixed ? (
            <span>
              <em>Held fixed</em>
              <b>{heldFixed}</b>
            </span>
          ) : null}
          {result ? (
            <span>
              <em>Result</em>
              <b>{result}</b>
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="ledger-meta">
        <span>{observationSourceLabel(observation.source)}</span>
        <span>{dateLabel(observation.updatedAt)}</span>
        {observation.caveat ? <span>{observation.caveat}</span> : null}
      </div>

      {actionList.length ? (
        <div className="ledger-actions" aria-label="Observation actions">
          {actionList.map((action) => (
            <Link
              key={`${action.href}-${action.label}`}
              href={action.href}
              className={`ledger-action ${action.primary ? 'primary' : ''}`}
            >
              {action.label}
            </Link>
          ))}
        </div>
      ) : null}

      <style jsx>{ledgerStyles}</style>
    </aside>
  )
}

const ledgerStyles = `
  .observation-ledger-card {
    display: grid;
    grid-column: 1 / -1;
    gap: 0.62rem;
    min-width: 0;
    padding: 0.78rem;
    border-radius: 16px;
    border: 1px solid rgba(31, 111, 120, 0.16);
    background:
      linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 247, 245, 0.88)),
      linear-gradient(90deg, rgba(31, 111, 120, 0.08), rgba(243, 176, 71, 0.08));
    box-shadow: 0 12px 26px rgba(8, 16, 26, 0.06);
  }

  .observation-ledger-card.inline {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.46rem;
    padding: 0.64rem;
    box-shadow: none;
  }

  .observation-ledger-card.compact {
    gap: 0.5rem;
    box-shadow: none;
  }

  .observation-ledger-card.inline .ledger-main > p:not(.ledger-eyebrow),
  .observation-ledger-card.inline .ledger-facts,
  .observation-ledger-card.inline .ledger-meta span:nth-child(n + 2),
  .observation-ledger-card.inline .ledger-action:not(.primary),
  .observation-ledger-card.compact .ledger-main > p:not(.ledger-eyebrow),
  .observation-ledger-card.compact .ledger-facts,
  .observation-ledger-card.compact .ledger-meta span:nth-child(n + 3) {
    display: none;
  }

  .observation-ledger-card.detailed {
    padding: 0.95rem;
  }

  .ledger-main,
  .ledger-title-row,
  .ledger-facts span {
    display: grid;
    gap: 0.22rem;
    min-width: 0;
  }

  .ledger-eyebrow,
  .ledger-title-row span,
  .ledger-facts em,
  .ledger-meta span {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.61rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #1f6f78;
    font-style: normal;
  }

  .ledger-title-row {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
    gap: 0.52rem;
  }

  .ledger-title-row strong,
  .observation-ledger-card.empty > strong {
    color: #17202a;
    font-size: 1rem;
    line-height: 1.18;
    overflow-wrap: anywhere;
  }

  .observation-ledger-card.compact .ledger-title-row strong,
  .observation-ledger-card.inline .ledger-title-row strong {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    overflow: hidden;
  }

  .ledger-title-row span {
    width: fit-content;
    max-width: 100%;
    padding: 0.18rem 0.42rem;
    border-radius: 999px;
    border: 1px solid rgba(31, 111, 120, 0.14);
    background: rgba(255, 251, 245, 0.74);
    color: #55616d;
  }

  .ledger-main p,
  .observation-ledger-card.empty > span {
    margin: 0;
    color: #52606b;
    font-size: 0.86rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .ledger-facts {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0.42rem;
    min-width: 0;
  }

  .ledger-facts span {
    padding: 0.48rem;
    border-radius: 10px;
    border: 1px solid rgba(27, 36, 48, 0.08);
    background: rgba(255, 251, 245, 0.74);
  }

  .ledger-facts b {
    color: #1b2430;
    font-size: 0.82rem;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .ledger-meta,
  .ledger-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.36rem;
    min-width: 0;
  }

  .ledger-meta span {
    padding: 0.18rem 0.38rem;
    border-radius: 999px;
    background: rgba(31, 111, 120, 0.08);
    color: #53606b;
    letter-spacing: 0.06em;
    text-transform: none;
  }

  .ledger-actions {
    align-items: center;
  }

  .ledger-action {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    justify-content: center;
    padding: 0.36rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(27, 36, 48, 0.1);
    background: rgba(255, 251, 245, 0.8);
    color: #17202a;
    font-size: 0.78rem;
    font-weight: 760;
    text-decoration: none;
    white-space: nowrap;
  }

  .ledger-action.primary,
  .ledger-action:hover {
    background: #1b2430;
    color: #fbf4e8;
  }

  @media (max-width: 760px) {
    .observation-ledger-card,
    .observation-ledger-card.inline {
      grid-template-columns: 1fr;
      gap: 0.36rem;
      padding: 0.54rem;
      border-radius: 14px;
    }

    .ledger-title-row {
      grid-template-columns: 1fr;
      gap: 0.32rem;
    }

    .ledger-title-row strong,
    .observation-ledger-card.empty > strong {
      font-size: 0.92rem;
    }

    .ledger-main p,
    .observation-ledger-card.empty > span {
      font-size: 0.8rem;
      line-height: 1.35;
    }

    .ledger-facts {
      grid-template-columns: 1fr;
      gap: 0.34rem;
    }

    .observation-ledger-card.compact .ledger-facts span:nth-child(n + 3),
    .observation-ledger-card.inline .ledger-facts {
      display: none;
    }

    .observation-ledger-card.inline .ledger-main > p:not(.ledger-eyebrow) {
      display: none;
    }

    .observation-ledger-card.inline .ledger-meta span:nth-child(n + 2),
    .observation-ledger-card.inline .ledger-action:not(.primary),
    .observation-ledger-card.compact .ledger-meta span:nth-child(n + 2),
    .observation-ledger-card.compact .ledger-action:not(.primary),
    .observation-ledger-card.compact .ledger-title-row span,
    .observation-ledger-card.inline .ledger-title-row span {
      display: none;
    }

    .observation-ledger-card.compact .ledger-facts {
      display: none;
    }

    .ledger-action {
      flex: 1 1 120px;
      min-height: 31px;
      padding: 0.32rem 0.48rem;
      font-size: 0.74rem;
    }
  }
`
