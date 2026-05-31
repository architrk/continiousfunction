import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { normalizeLearningRoutePathId } from '@/lib/learningRouteConstants'
import {
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotEventName,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'

type RouteStateSurface =
  | 'home'
  | 'domains'
  | 'domain-detail'
  | 'concept-notebook'
  | 'paper-map'
  | 'graph'
  | 'search'
  | 'memory'
  | 'attention-serving'
  | 'pillars'
  | 'vision'
  | 'foundations'
  | 'other'

type RouteStateStripProps = {
  surface: RouteStateSurface
}

function truncate(value: string, limit: number) {
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function surfaceLabel(surface: RouteStateSurface) {
  switch (surface) {
    case 'home':
      return 'Command deck'
    case 'domains':
      return 'Domain atlas'
    case 'domain-detail':
      return 'Domain route'
    case 'concept-notebook':
      return 'Concept notebook'
    case 'paper-map':
      return 'Paper mapper'
    case 'graph':
      return 'Knowledge graph'
    case 'search':
      return 'Search lens'
    case 'memory':
      return 'Study memory'
    case 'attention-serving':
      return 'Attention path'
    case 'pillars':
      return 'Pillar notebook'
    case 'vision':
      return 'Vision'
    case 'foundations':
      return 'Foundations'
    default:
      return 'Learning surface'
  }
}

function groundingLabel(status: LearningRouteSnapshot['groundingStatus']) {
  switch (status) {
    case 'metadata-resolved':
      return 'metadata resolved'
    case 'source-checked':
      return 'source checked'
    case 'source-check-error':
      return 'source check needed'
    case 'local-preview':
    default:
      return 'local preview'
  }
}

function firstRepairHref(snapshot: LearningRouteSnapshot) {
  const concepts = snapshot.routeConcepts ?? []
  return (
    concepts.find((concept) => concept.label === snapshot.nextRepair)?.href ??
    concepts.find((concept, index) => index > 0 && concept.href)?.href ??
    concepts[0]?.href ??
    null
  )
}

function routeHref(snapshot: LearningRouteSnapshot, surface: RouteStateSurface) {
  if (snapshot.graphRoute) return `/graph/?from=${encodeURIComponent(surface)}#learning-route`

  const normalizedRouteId = normalizeLearningRoutePathId(snapshot.mappingId)
  if (!normalizedRouteId) return null

  return `/graph/?route=${encodeURIComponent(snapshot.mappingId)}&from=${encodeURIComponent(surface)}#learning-route`
}

function searchRouteHref(snapshot: LearningRouteSnapshot, surface: RouteStateSurface) {
  const query =
    snapshot.nextRepair ??
    snapshot.currentObject?.title ??
    snapshot.primaryEquation?.label ??
    snapshot.routeLabels[0] ??
    snapshot.paperClueLabel ??
    snapshot.paperTitle

  return `/search?q=${encodeURIComponent(query)}&from=${encodeURIComponent(surface)}#route-search-lens`
}

function continueHref(snapshot: LearningRouteSnapshot, surface: RouteStateSurface) {
  if (snapshot.currentObject?.href) return snapshot.currentObject.href
  if (snapshot.mappingId === 'kv-cache' && snapshot.labStatus === 'live') {
    return `/paths/attention-serving/?focus=kv-cache&from=${encodeURIComponent(surface)}#serving-module`
  }

  return routeHref(snapshot, surface) ?? firstRepairHref(snapshot) ?? '/paper-map/'
}

function objectLabel(snapshot: LearningRouteSnapshot) {
  return (
    snapshot.currentObject?.title ??
    snapshot.primaryEquation?.label ??
    snapshot.nextRepair ??
    snapshot.routeLabels[0] ??
    'Route object pending'
  )
}

function nextLabel(snapshot: LearningRouteSnapshot) {
  if (snapshot.lastObservation?.nextQuestion) return snapshot.lastObservation.nextQuestion
  if (snapshot.nextRepair) return `Repair ${snapshot.nextRepair}`
  if (snapshot.labGoal) return snapshot.labGoal
  return 'Choose the next object to test'
}

export default function RouteStateStrip({ surface }: RouteStateStripProps) {
  const [snapshot, setSnapshot] = useState<LearningRouteSnapshot | null>(null)

  useEffect(() => {
    const refreshSnapshot = () => {
      setSnapshot(getSavedLearningRouteSnapshot())
    }

    refreshSnapshot()
    window.addEventListener('storage', refreshSnapshot)
    window.addEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    return () => {
      window.removeEventListener('storage', refreshSnapshot)
      window.removeEventListener(learningRouteSnapshotEventName, refreshSnapshot)
    }
  }, [])

  const routeState = useMemo(() => {
    if (!snapshot) return null

    return {
      question: truncate(snapshot.currentQuestion ?? snapshot.paperTitle, 120),
      object: truncate(objectLabel(snapshot), 72),
      next: truncate(nextLabel(snapshot), 92),
      status: snapshot.labStatus === 'live' ? 'live lab' : groundingLabel(snapshot.groundingStatus),
      continueHref: continueHref(snapshot, surface),
      searchHref: surface === 'search' ? null : searchRouteHref(snapshot, surface),
    }
  }, [snapshot, surface])

  return (
    <section className={`route-state-strip ${routeState ? 'active' : 'empty'}`} aria-label="Learning route state">
      <div className="route-state-inner">
        {routeState ? (
          <>
            <div className="route-state-copy">
              <span>Current investigation</span>
              <strong>{routeState.question}</strong>
              <em>{routeState.object} -&gt; {routeState.next}</em>
            </div>
            <div className="route-state-facts" aria-label="Current route facts">
              <p>
                <span>Object</span>
                <strong>{routeState.object}</strong>
              </p>
              <p>
                <span>Next</span>
                <strong>{routeState.next}</strong>
              </p>
              <p>
                <span>Status</span>
                <strong>{routeState.status}</strong>
              </p>
            </div>
            <div className="route-state-actions" aria-label="Continue route">
              <Link href={routeState.continueHref}>Continue</Link>
              {routeState.searchHref ? <Link href={routeState.searchHref}>Search route</Link> : null}
            </div>
          </>
        ) : (
          <>
            <div className="route-state-copy">
              <span>{surfaceLabel(surface)}</span>
              <strong>No active investigation yet</strong>
              <em>Start from a paper, equation, concept, behavior, or system tradeoff.</em>
            </div>
            <div className="route-state-actions" aria-label="Start a route">
              <Link href="/paper-map/">Map paper</Link>
              <Link href="/search/">Search</Link>
              <Link href="/graph/">Graph</Link>
            </div>
          </>
        )}
      </div>
      <style jsx>{`
  .route-state-strip {
    border-top: 1px solid rgba(27, 36, 48, 0.06);
    border-bottom: 1px solid rgba(27, 36, 48, 0.08);
    background:
      linear-gradient(90deg, rgba(255, 251, 245, 0.9), rgba(239, 232, 219, 0.86)),
      rgba(247, 242, 233, 0.86);
  }

  .route-state-inner {
    width: 100%;
    max-width: 1600px;
    margin: 0 auto;
    padding: 0.42rem 2rem;
    display: grid;
    grid-template-columns: minmax(220px, 0.82fr) minmax(340px, 1.35fr) auto;
    align-items: center;
    gap: 0.72rem;
    min-width: 0;
  }

  .route-state-strip.empty .route-state-inner {
    grid-template-columns: minmax(220px, 1fr) auto;
  }

  .route-state-copy,
  .route-state-facts p {
    min-width: 0;
  }

  .route-state-copy {
    display: grid;
    gap: 0.08rem;
  }

  .route-state-copy span,
  .route-state-facts span {
    font-family: var(--font-mono);
    font-size: 0.58rem;
    letter-spacing: 0.11em;
    text-transform: uppercase;
    color: #1f6f78;
  }

  .route-state-copy strong,
  .route-state-facts strong {
    color: #17202a;
    font-size: 0.9rem;
    line-height: 1.24;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .route-state-copy strong,
  .route-state-copy em,
  .route-state-facts strong {
    white-space: nowrap;
  }

  .route-state-copy em {
    color: #5f6b76;
    font-size: 0.74rem;
    font-style: normal;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .route-state-facts {
    display: grid;
    grid-template-columns: minmax(120px, 0.9fr) minmax(160px, 1.2fr) minmax(92px, 0.58fr);
    gap: 0.42rem;
    min-width: 0;
  }

  .route-state-facts p {
    display: grid;
    gap: 0.1rem;
    margin: 0;
    padding: 0.34rem 0.46rem;
    border: 1px solid rgba(27, 36, 48, 0.07);
    border-radius: 10px;
    background: rgba(255, 251, 245, 0.62);
  }

  .route-state-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.35rem;
    min-width: 0;
  }

  .route-state-actions :global(a) {
    display: inline-flex;
    min-height: 32px;
    align-items: center;
    justify-content: center;
    padding: 0.34rem 0.62rem;
    border-radius: 999px;
    border: 1px solid rgba(27, 36, 48, 0.1);
    background: rgba(255, 251, 245, 0.75);
    color: #17202a;
    font-size: 0.78rem;
    font-weight: 760;
    text-decoration: none;
    white-space: nowrap;
  }

  .route-state-actions :global(a:first-child) {
    background: #1b2430;
    color: #fbf4e8;
  }

  .route-state-actions :global(a:hover) {
    border-color: rgba(31, 111, 120, 0.3);
    background: #1f6f78;
    color: #fbf4e8;
  }

  .route-state-actions :global(a:focus-visible) {
    outline: 2px solid rgba(31, 111, 120, 0.42);
    outline-offset: 2px;
  }

  @media (max-width: 1120px) {
    .route-state-inner {
      grid-template-columns: minmax(180px, 0.8fr) minmax(240px, 1fr) auto;
      padding-inline: 1rem;
      gap: 0.5rem;
    }

    .route-state-facts {
      grid-template-columns: minmax(120px, 1fr) minmax(150px, 1.1fr);
    }

    .route-state-facts p:last-child {
      display: none;
    }

    .route-state-actions :global(a) {
      padding-inline: 0.52rem;
    }
  }

  @media (max-width: 768px) {
    .route-state-strip {
      border-top-color: rgba(27, 36, 48, 0.08);
    }

    .route-state-inner,
    .route-state-strip.empty .route-state-inner {
      grid-template-columns: 1fr;
      padding: 0.42rem 0.85rem;
      gap: 0.34rem;
    }

    .route-state-strip.active .route-state-inner {
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }

    .route-state-copy {
      gap: 0.05rem;
    }

    .route-state-copy span {
      font-size: 0.54rem;
      letter-spacing: 0.1em;
    }

    .route-state-copy strong {
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
      white-space: normal;
      font-size: 0.84rem;
      line-height: 1.18;
    }

    .route-state-copy em {
      max-width: 100%;
      font-size: 0.68rem;
      white-space: nowrap;
    }

    .route-state-facts {
      display: none;
    }

    .route-state-actions {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      justify-content: stretch;
      width: 100%;
    }

    .route-state-strip.active .route-state-actions {
      grid-template-columns: minmax(78px, 1fr);
      width: auto;
    }

    .route-state-strip.active .route-state-actions :global(a:not(:first-child)) {
      display: none;
    }

    .route-state-actions :global(a) {
      min-height: 30px;
      padding: 0.32rem 0.42rem;
      font-size: 0.74rem;
    }
  }
      `}</style>
    </section>
  )
}
