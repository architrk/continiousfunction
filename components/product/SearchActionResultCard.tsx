import Link from 'next/link'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'

export type SearchActionBucketKind = 'repair' | 'inspect' | 'witness' | 'source' | 'continue'

export type SearchActionResultItem = {
  kind: 'foundation' | 'content'
  id: string
  title: string
  href: string
  badge: string
  description: string
  snippet?: string
  tags: string[]
  nextAction: string
  pathHint: string
  hasInteractiveDemo: boolean
  hasCodeExample: boolean
  prerequisiteLabels: string[]
  leadLabels: string[]
}

export type SearchActionClassification = {
  bucket: SearchActionBucketKind
  relation: string
  routeFit: string
  why: string
  nextAction: string
  ctaLabel: string
  ctaHref: string
  usesObservation: boolean
}

export const searchActionBucketDefinitions: Record<
  SearchActionBucketKind,
  { label: string; description: string }
> = {
  repair: {
    label: 'Repair first',
    description: 'Fix the prerequisite that makes the target concept computable.',
  },
  inspect: {
    label: 'Inspect mechanism',
    description: 'Open the object and name the moving part that explains the idea.',
  },
  witness: {
    label: 'Run witness',
    description: 'Turn the idea into a prediction before reading more prose.',
  },
  source: {
    label: 'Source or claim',
    description: 'Attach the route to a paper, claim, source, or question.',
  },
  continue: {
    label: 'Continue route',
    description: 'Keep the observation attached while moving to the next step.',
  },
}

export const searchActionBucketOrder: SearchActionBucketKind[] = [
  'repair',
  'inspect',
  'witness',
  'source',
  'continue',
]

function normalize(value: string | undefined) {
  return (value ?? '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function hrefPath(value: string | undefined) {
  if (!value) return ''
  return value.split('#')[0]?.replace(/\/+$/, '') ?? ''
}

function isSameLabel(a: string | undefined, b: string | undefined) {
  const left = normalize(a)
  const right = normalize(b)
  if (!left || !right) return false
  return left === right || left.replace(/\s/g, '') === right.replace(/\s/g, '')
}

function sectionHref(href: string, sectionId: string) {
  return `${href.split('#')[0]}#${sectionId}`
}

function routeConceptMatchesItem(snapshot: LearningRouteSnapshot, item: SearchActionResultItem) {
  return snapshot.routeConcepts?.some(
    (concept) => hrefPath(concept.href) === hrefPath(item.href) || isSameLabel(concept.label, item.title)
  )
}

function routeIdMatchesItem(snapshot: LearningRouteSnapshot, item: SearchActionResultItem) {
  return snapshot.routeConceptIds.some((id) => isSameLabel(id, item.id)) || snapshot.routeLabels.some((label) => isSameLabel(label, item.title))
}

function currentObjectMatchesItem(snapshot: LearningRouteSnapshot, item: SearchActionResultItem) {
  return (
    hrefPath(snapshot.currentObject?.href) === hrefPath(item.href) ||
    isSameLabel(snapshot.currentObject?.title, item.title) ||
    isSameLabel(snapshot.currentObject?.id, item.id)
  )
}

function nextRepairMatchesItem(snapshot: LearningRouteSnapshot, item: SearchActionResultItem) {
  return isSameLabel(snapshot.nextRepair, item.title) || isSameLabel(snapshot.nextRepair, item.id)
}

function prerequisiteMatchesCurrentObject(item: SearchActionResultItem, snapshot: LearningRouteSnapshot) {
  return item.leadLabels.some(
    (label) => isSameLabel(label, snapshot.currentObject?.title) || isSameLabel(label, snapshot.mappingTitle)
  )
}

function hasSourceSignal(item: SearchActionResultItem) {
  const sourceHaystack = normalize(`${item.title} ${item.description} ${item.tags.join(' ')}`)
  return /\b(paper|source|claim|evidence|reference|citation|benchmark)\b/.test(sourceHaystack)
}

function hasRouteContext(item: SearchActionResultItem, snapshot: LearningRouteSnapshot) {
  return (
    currentObjectMatchesItem(snapshot, item) ||
    nextRepairMatchesItem(snapshot, item) ||
    routeConceptMatchesItem(snapshot, item) ||
    routeIdMatchesItem(snapshot, item) ||
    prerequisiteMatchesCurrentObject(item, snapshot)
  )
}

function observationSummary(snapshot: LearningRouteSnapshot) {
  const observation = snapshot.lastObservation
  if (!observation) return null
  return `${observation.label}: ${observation.value}`
}

export function classifySearchActionResult(
  item: SearchActionResultItem,
  snapshot?: LearningRouteSnapshot | null
): SearchActionClassification {
  const firstPrerequisite = item.prerequisiteLabels[0]
  const firstLead = item.leadLabels[0]
  const witnessHref = sectionHref(item.href, item.hasInteractiveDemo ? 'interactive-demo' : item.hasCodeExample ? 'code' : 'math')
  const sourceHref = item.kind === 'content' ? sectionHref(item.href, 'source-grounding') : item.href
  const continueHref = snapshot ? `/graph/?from=search&focus=${encodeURIComponent(item.id)}#learning-route` : '/graph/?from=search#learning-route'
  const observed = snapshot ? observationSummary(snapshot) : null

  if (snapshot && (nextRepairMatchesItem(snapshot, item) || prerequisiteMatchesCurrentObject(item, snapshot))) {
    return {
      bucket: 'repair',
      relation: nextRepairMatchesItem(snapshot, item) ? 'Matches saved next repair' : 'Prerequisite repair',
      routeFit: observed ? `Evidence being carried: ${observed}.` : `Current route: ${snapshot.paperClueLabel ?? snapshot.paperTitle}.`,
      why: nextRepairMatchesItem(snapshot, item)
        ? 'This matches the repair named by your saved route.'
        : `This helps repair the object before returning to ${snapshot.currentObject?.title ?? snapshot.mappingTitle ?? 'the route'}.`,
      nextAction: item.hasInteractiveDemo ? 'Repair with the witness, then return to the route.' : 'Repair the prerequisite, then continue the route.',
      ctaLabel: item.hasInteractiveDemo ? 'Repair with witness' : 'Repair prerequisite',
      ctaHref: sectionHref(item.href, item.hasInteractiveDemo ? 'interactive-demo' : 'intuition'),
      usesObservation: Boolean(observed),
    }
  }

  if (!snapshot && item.kind === 'foundation') {
    return {
      bucket: 'repair',
      relation: 'Foundation repair',
      routeFit: firstLead ? `Builds toward ${firstLead}.` : 'Use this as a prerequisite patch.',
      why: 'Foundational results are best used to repair the mental model before going deeper.',
      nextAction: 'Open the foundation and restate the invariant in one sentence.',
      ctaLabel: 'Repair foundation',
      ctaHref: item.href,
      usesObservation: false,
    }
  }

  if (snapshot && currentObjectMatchesItem(snapshot, item)) {
    return {
      bucket: 'inspect',
      relation: 'Current object',
      routeFit: observed ? `Evidence from your ledger: ${observed}.` : 'This is the object already attached to the route.',
      why: 'Inspect the mechanism that could explain the saved route state.',
      nextAction: 'Name which term, state, or operation is doing the work.',
      ctaLabel: 'Open mechanism',
      ctaHref: item.href,
      usesObservation: Boolean(observed),
    }
  }

  if ((item.hasInteractiveDemo || item.hasCodeExample) && (!snapshot || hasRouteContext(item, snapshot))) {
    return {
      bucket: 'witness',
      relation: item.hasInteractiveDemo ? 'Interactive witness' : 'Code witness',
      routeFit: observed ? `Use the saved observation carefully: ${observed}.` : 'This result can create a concrete observation.',
      why: snapshot ? 'This witness is close enough to the saved route to test another prediction.' : 'A witness turns the search result into something you can test.',
      nextAction: item.hasInteractiveDemo
        ? 'Make a prediction before changing the controls.'
        : 'Run the code witness and compare it to the notation.',
      ctaLabel: item.hasInteractiveDemo ? 'Run witness' : 'Open code witness',
      ctaHref: witnessHref,
      usesObservation: Boolean(observed),
    }
  }

  if (snapshot && (routeConceptMatchesItem(snapshot, item) || routeIdMatchesItem(snapshot, item))) {
    return {
      bucket: 'inspect',
      relation: 'On saved route',
      routeFit: observed ? `Compare this step with ${observed}.` : `Route step in ${snapshot.paperClueLabel ?? snapshot.paperTitle}.`,
      why: 'This result is part of the route you already started.',
      nextAction: 'Inspect the mechanism before treating it as solved.',
      ctaLabel: 'Inspect mechanism',
      ctaHref: item.href,
      usesObservation: Boolean(observed),
    }
  }

  if (hasSourceSignal(item)) {
    return {
      bucket: 'source',
      relation: 'Source-linked result',
      routeFit: observed ? `Attach the source to ${observed}.` : 'Use the source or claim panel to keep the explanation honest.',
      why: 'This result has source, claim, paper, or evidence language.',
      nextAction: 'Open the grounding panel and decide what the source supports.',
      ctaLabel: 'Open source',
      ctaHref: sourceHref,
      usesObservation: Boolean(observed),
    }
  }

  if (snapshot && firstLead) {
    return {
      bucket: 'continue',
      relation: 'Possible next step',
      routeFit: observed ? `Carry ${observed} forward.` : `Can lead toward ${firstLead}.`,
      why: 'This result extends from the current search into another connected concept.',
      nextAction: snapshot.nextRepair ? `Compare it with the saved repair: ${snapshot.nextRepair}.` : `Use it only if it advances ${snapshot.currentQuestion ?? 'the current question'}.`,
      ctaLabel: 'Continue route',
      ctaHref: continueHref,
      usesObservation: Boolean(observed),
    }
  }

  return {
    bucket: item.hasInteractiveDemo || item.hasCodeExample ? 'witness' : 'inspect',
    relation: item.hasInteractiveDemo ? 'Interactive result' : item.hasCodeExample ? 'Runnable result' : 'Concept result',
    routeFit: firstPrerequisite ? `Before this: ${firstPrerequisite}.` : item.pathHint,
    why: 'This is a plain search match. Open it if it helps the current question.',
    nextAction: item.nextAction,
    ctaLabel: item.hasInteractiveDemo ? 'Run witness' : 'Open result',
    ctaHref: item.hasInteractiveDemo || item.hasCodeExample ? witnessHref : item.href,
    usesObservation: false,
  }
}

type SearchActionResultCardProps = {
  item: SearchActionResultItem
  snapshot?: LearningRouteSnapshot | null
}

export default function SearchActionResultCard({ item, snapshot }: SearchActionResultCardProps) {
  const classification = classifySearchActionResult(item, snapshot)
  const bucket = searchActionBucketDefinitions[classification.bucket]

  return (
    <article className={`action-result-card bucket-${classification.bucket}`} data-search-action-card={classification.bucket}>
      <div className="cardTop">
        <span className={`bucketBadge ${classification.bucket}`}>{bucket.label}</span>
        <span className={`kind ${item.kind}`}>{item.kind === 'content' ? 'domain' : 'foundation'}</span>
        <span className="badge">{item.badge}</span>
        {classification.usesObservation ? <span className="evidenceBadge">uses saved evidence</span> : null}
        <span className="id mono">{item.id}</span>
      </div>

      <Link href={item.href} className="action-card-title-link">
        <span className="title">{item.title}</span>
      </Link>

      {item.description ? <div className="desc">{item.description}</div> : null}
      {item.kind === 'content' && item.snippet ? <div className="snippet">{item.snippet}</div> : null}

      <div className="learningMove">
        <div>
          <span>{classification.usesObservation ? 'Evidence from your ledger' : 'Route fit'}</span>
          <p>{classification.routeFit}</p>
        </div>
        <div>
          <span>Why this result now</span>
          <p>{classification.why}</p>
        </div>
        <div>
          <span>Next learner action</span>
          <p>{classification.nextAction}</p>
        </div>
      </div>

      <div className="cardActions">
        <Link href={classification.ctaHref} className="action-card-primary-action">
          {classification.ctaLabel}
        </Link>
        <span>{classification.relation}</span>
      </div>

      {item.tags.length ? (
        <div className="tags">
          {item.tags.slice(0, 8).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <style jsx>{`
        .action-result-card {
          display: grid;
          gap: 0.62rem;
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-top: 3px solid #1f6f78;
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.88);
          padding: 0.88rem;
          box-shadow: 0 14px 28px rgba(7, 15, 25, 0.05);
          transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
        }

        .action-result-card:hover {
          transform: translateY(-1px);
          border-color: rgba(20, 184, 166, 0.28);
          background: rgba(255, 251, 245, 0.97);
        }

        .bucket-repair {
          border-top-color: #d69235;
        }

        .bucket-witness {
          border-top-color: #3b6fb6;
        }

        .bucket-source {
          border-top-color: #b75b6a;
        }

        .bucket-continue {
          border-top-color: #303947;
        }

        .cardTop,
        .tags,
        .cardActions {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
          min-width: 0;
        }

        .cardTop {
          margin-bottom: -0.04rem;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .bucketBadge,
        .kind,
        .badge,
        .evidenceBadge,
        .tag {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          padding: 0.17rem 0.46rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: #4f5c68;
          background: rgba(255, 251, 245, 0.9);
          line-height: 1.25;
        }

        .bucketBadge {
          color: #17202a;
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.9);
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .bucketBadge.repair {
          border-color: rgba(214, 146, 53, 0.28);
        }

        .bucketBadge.witness {
          border-color: rgba(59, 111, 182, 0.26);
        }

        .bucketBadge.source {
          border-color: rgba(183, 91, 106, 0.26);
        }

        .bucketBadge.continue {
          border-color: rgba(48, 57, 71, 0.22);
        }

        .kind {
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .kind.foundation {
          border-color: rgba(245, 158, 11, 0.26);
        }

        .kind.content {
          border-color: rgba(20, 184, 166, 0.28);
        }

        .evidenceBadge {
          color: #1f6f78;
          background: rgba(31, 111, 120, 0.08);
        }

        .id {
          font-size: 0.72rem;
          color: #6a7681;
          overflow-wrap: anywhere;
        }

        :global(.action-card-title-link) {
          display: inline-flex;
          max-width: 100%;
          color: inherit;
          text-decoration: none;
        }

        :global(.action-card-title-link:hover) {
          text-decoration: underline;
          text-decoration-thickness: 0.08em;
          text-underline-offset: 0.14em;
          text-shadow: none;
        }

        .title {
          color: #151d27;
          font-size: 1.05rem;
          font-weight: 700;
          line-height: 1.18;
          overflow-wrap: anywhere;
        }

        .desc,
        .snippet {
          color: #455361;
          font-size: 0.88rem;
          line-height: 1.38;
          overflow-wrap: anywhere;
        }

        .snippet {
          color: #596672;
          font-size: 0.82rem;
        }

        .learningMove {
          display: grid;
          gap: 0.44rem;
          padding: 0.62rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.12);
          background: rgba(239, 247, 245, 0.66);
        }

        .learningMove div {
          display: grid;
          gap: 0.16rem;
          min-width: 0;
        }

        .learningMove span,
        .cardActions span {
          font-family: var(--font-mono);
          font-size: 0.63rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .learningMove p {
          margin: 0;
          color: #43515e;
          font-size: 0.8rem;
          line-height: 1.34;
          overflow-wrap: anywhere;
        }

        :global(.action-card-primary-action) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0.38rem 0.68rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1b2430;
          color: #fbf4e8;
          font-size: 0.8rem;
          font-weight: 780;
          text-decoration: none;
          white-space: nowrap;
        }

        :global(.action-card-primary-action:hover) {
          background: #1f6f78;
          text-shadow: none;
        }

        .cardActions span {
          color: #596672;
          letter-spacing: 0.06em;
          text-transform: none;
        }

        .tags {
          margin-top: 0.04rem;
        }

        .tag {
          color: #4f5c68;
          background: rgba(239, 247, 245, 0.82);
        }

        @media (max-width: 640px) {
          .action-result-card {
            gap: 0.5rem;
            padding: 0.72rem;
          }

          .bucketBadge,
          .kind,
          .badge,
          .evidenceBadge,
          .tag {
            font-size: 0.62rem;
            padding: 0.15rem 0.38rem;
          }

          .title {
            font-size: 0.98rem;
          }

          .desc {
            font-size: 0.84rem;
          }

          .snippet {
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 3;
            overflow: hidden;
          }

          .learningMove {
            gap: 0.36rem;
            padding: 0.52rem;
          }

          .learningMove p {
            font-size: 0.76rem;
          }

          :global(.action-card-primary-action) {
            flex: 1 1 150px;
            min-height: 34px;
            white-space: normal;
            text-align: center;
          }
        }
      `}</style>
    </article>
  )
}
