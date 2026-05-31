import { useMemo } from 'react'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'
import ObservationLedgerCard from './ObservationLedgerCard'
import { useSavedLearningRouteSnapshot } from './useSavedLearningRouteSnapshot'

type SearchRouteBridgeProps = {
  onSelectQuery?: (query: string) => void
}

type SearchRouteChip = {
  source: string
  query: string
}

function compactUnique(values: Array<SearchRouteChip | null | undefined>, limit: number) {
  const seen = new Set<string>()
  const result: SearchRouteChip[] = []

  for (const chip of values) {
    const value = chip?.query.trim()
    if (!value || seen.has(value.toLowerCase())) continue

    seen.add(value.toLowerCase())
    result.push({ source: chip?.source ?? 'Route', query: value })
    if (result.length >= limit) break
  }

  return result
}

function observationQuery(snapshot: LearningRouteSnapshot) {
  const observation = snapshot.lastObservation
  if (!observation) return null
  const label = observation.label.replace(/\s+witness$/i, '').trim()
  return label || observation.nextQuestion || observation.value
}

function suggestedQueries(snapshot: LearningRouteSnapshot) {
  const observation = observationQuery(snapshot)

  return compactUnique(
    [
      snapshot.currentObject?.title ? { source: 'Object', query: snapshot.currentObject.title } : null,
      snapshot.nextRepair ? { source: 'Repair', query: snapshot.nextRepair } : null,
      observation ? { source: 'Observation', query: observation } : null,
      snapshot.primaryEquation?.label ? { source: 'Equation', query: snapshot.primaryEquation.label } : null,
      ...(snapshot.routeConcepts?.map((concept) => ({ source: 'Concept', query: concept.label })) ?? []),
      ...snapshot.routeLabels.map((label) => ({ source: 'Route', query: label })),
    ],
    6
  )
}

export default function SearchRouteBridge({ onSelectQuery }: SearchRouteBridgeProps) {
  const snapshot = useSavedLearningRouteSnapshot()
  const queries = useMemo(() => (snapshot ? suggestedQueries(snapshot) : []), [snapshot])

  if (!snapshot) return null

  return (
    <section id="route-search-lens" className="route-search-lens" aria-label="Saved route search lens">
      <div className="route-query-panel">
        <div className="route-query-copy">
          <p className="eyebrow">Route Search Lens</p>
          <h2>Search inside the route you already started.</h2>
          <p>
            Keep discovery attached to the saved question, current object, and next repair instead of falling back to a
            cold catalog.
          </p>
        </div>

        {queries.length ? (
          <div className="route-query-chips" aria-label="Search this route">
            {queries.map((chip) => (
              <button key={`${chip.source}:${chip.query}`} type="button" onClick={() => onSelectQuery?.(chip.query)}>
                <span>{chip.source}</span>
                <strong>{chip.query}</strong>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {snapshot.lastObservation ? (
        <ObservationLedgerCard
          snapshot={snapshot}
          variant="inline"
          contextLabel="Search with saved evidence"
          actions={[
            {
              href: snapshot.currentObject?.href ?? '/graph/?from=search#learning-route',
              label: 'Resume object',
              primary: true,
            },
            {
              href: `/search/?q=${encodeURIComponent(snapshot.lastObservation.nextQuestion ?? snapshot.nextRepair ?? snapshot.currentObject?.title ?? snapshot.paperTitle)}&from=route#route-search-lens`,
              label: 'Search repair',
            },
          ]}
        />
      ) : null}

      <style jsx>{`
        .route-search-lens {
          display: grid;
          gap: 0.85rem;
          min-width: 0;
        }

        .route-query-panel {
          display: grid;
          grid-template-columns: minmax(0, 0.72fr) minmax(0, 1fr);
          gap: 0.85rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 20px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.84), rgba(239, 247, 245, 0.82)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.08), rgba(194, 74, 45, 0.06));
        }

        .route-query-copy {
          min-width: 0;
        }

        .eyebrow {
          margin: 0 0 0.45rem;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          color: #151d27;
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.4vw, 1.85rem);
          line-height: 1.05;
          letter-spacing: 0;
        }

        h2::before {
          content: none;
          display: none;
        }

        p {
          margin: 0.6rem 0 0;
          color: #455361;
          line-height: 1.58;
        }

        .route-query-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          min-width: 0;
          align-content: start;
        }

        .route-query-chips button {
          display: inline-grid;
          align-items: center;
          justify-content: center;
          gap: 0.12rem;
          min-height: 38px;
          padding: 0.55rem 0.72rem;
          border-radius: 999px;
          border: 1px solid rgba(31, 111, 120, 0.18);
          background: rgba(255, 251, 245, 0.94);
          color: #1b2430;
          font: inherit;
          font-weight: 720;
          cursor: pointer;
        }

        .route-query-chips span {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: inherit;
          opacity: 0.72;
        }

        .route-query-chips strong {
          min-width: 0;
          font-size: 0.92rem;
          line-height: 1.12;
          overflow-wrap: anywhere;
        }

        .route-query-chips button:hover {
          border-color: rgba(31, 111, 120, 0.32);
          background: #1f6f78;
          color: #fbf4e8;
          transform: translateY(-1px);
        }

        .route-query-chips button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.42);
          outline-offset: 2px;
        }

        @media (max-width: 860px) {
          .route-query-panel {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .route-search-lens {
            gap: 0.56rem;
          }

          .route-query-panel {
            gap: 0.56rem;
            padding: 0.64rem;
            border-radius: 15px;
          }

          .eyebrow {
            margin-bottom: 0.26rem;
            font-size: 0.62rem;
            letter-spacing: 0.1em;
          }

          h2 {
            font-size: 1.08rem;
            line-height: 1.12;
          }

          .route-query-copy > p:not(.eyebrow) {
            display: none;
          }

          .route-query-chips {
            flex-wrap: wrap;
            gap: 0.36rem;
            overflow-x: visible;
            padding-bottom: 0.05rem;
          }

          .route-query-chips button {
            flex: 1 1 calc(50% - 0.36rem);
            min-height: 32px;
            padding: 0.42rem 0.56rem;
            border-radius: 12px;
            font-size: 0.78rem;
            line-height: 1.12;
            width: auto;
          }

          .route-query-chips span {
            font-size: 0.5rem;
            letter-spacing: 0.06em;
          }

          .route-query-chips strong {
            font-size: 0.76rem;
          }
        }
      `}</style>
    </section>
  )
}
