import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  computeGraphRoute,
  getProductGraphNode,
  routeKnownOptions,
  routeTargetOptions,
  type ComputedGraphRoute,
} from '@/lib/productGraphRoutes'
import type { LearningRouteSnapshot } from '@/lib/learningRouteSnapshot'

const defaultKnown = ['attention', 'adam', 'cross-entropy']

type GraphRouteEngineProps = {
  savedSnapshot?: LearningRouteSnapshot | null
  onSaveSnapshot?: (snapshot: LearningRouteSnapshot) => void
}

function compactKnownLabel(labels: string[]) {
  if (labels.length <= 4) return labels.join(', ')
  return `${labels.slice(0, 4).join(', ')} +${labels.length - 4} more`
}

function buildComputedGraphSnapshot(
  knownIds: string[],
  targetId: string,
  route: ComputedGraphRoute
): LearningRouteSnapshot {
  const knownNodes = knownIds.map(getProductGraphNode).filter((node): node is NonNullable<typeof node> => Boolean(node))
  const targetNode = getProductGraphNode(targetId)
  const knownLabel = compactKnownLabel(knownNodes.map((node) => node.label))
  const targetLabel = targetNode?.label ?? targetId
  const nextRepair = route.nextRepair ?? targetNode ?? route.nodes.at(-1)
  const sourceObjects = [
    ...knownNodes.map((node) => ({
      type: 'concept' as const,
      id: node.id,
      title: node.label,
      href: node.href,
      role: `Known concept: ${node.role}`,
      status: node.status,
    })),
    ...(targetNode
      ? [
          {
            type: 'concept' as const,
            id: targetNode.id,
            title: targetNode.label,
            href: targetNode.href,
            role: `Chosen target: ${targetNode.role}`,
            status: targetNode.status,
          },
        ]
      : []),
  ].slice(0, 12)

  return {
    version: 'cf-route-snapshot-v1',
    source: 'graph',
    paperClueLabel: `Known: ${knownLabel}; target: ${targetLabel}`,
    paperTitle: `Computed graph route to ${targetLabel}`,
    inputKind: 'computed graph route',
    mappingId: `graph-route:${targetId}`,
    mappingTitle: 'Computed graph route',
    routeLabels: route.nodes.map((node) => node.label),
    routeConceptIds: route.nodes.map((node) => node.id),
    routeConcepts: route.nodes
      .filter((node): node is typeof node & { href: string } => Boolean(node.href))
      .map((node) => ({
        label: node.label,
        href: node.href,
        role: node.role,
      })),
    nextRepair: nextRepair?.label,
    currentQuestion: `I know ${knownLabel}. What do I need for ${targetLabel}?`,
    sourceObjects,
    currentObject:
      sourceObjects.find((object) => object.id === nextRepair?.id) ??
      sourceObjects.find((object) => object.id === targetId) ??
      sourceObjects[0],
    graphRoute: {
      knownConceptIds: knownIds,
      targetConceptId: targetId,
      routeNodes: route.nodes.map((node) => ({
        id: node.id,
        label: node.label,
        role: node.role,
        group: node.group,
        status: node.status,
        href: node.href,
      })),
      edgeWitnesses: route.edges.map((edge) => ({
        from: edge.from,
        to: edge.to,
        type: edge.type,
        why: edge.why,
        weight: edge.weight,
      })),
      totalWeight: Number(route.totalWeight.toFixed(3)),
      nextRepairId: nextRepair?.id,
    },
    groundingStatus: 'local-preview',
    createdAt: new Date().toISOString(),
  }
}

export default function GraphRouteEngine({ savedSnapshot, onSaveSnapshot }: GraphRouteEngineProps) {
  const [knownIds, setKnownIds] = useState(defaultKnown)
  const [targetId, setTargetId] = useState<(typeof routeTargetOptions)[number]>('state-space-duality')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')
  const didHydrateSavedRoute = useRef(false)
  const route = useMemo(() => computeGraphRoute(knownIds, targetId), [knownIds, targetId])

  useEffect(() => {
    if (didHydrateSavedRoute.current) return

    const graphRoute = savedSnapshot?.graphRoute
    if (!graphRoute) return

    const validKnownIds = graphRoute.knownConceptIds.filter((id) =>
      (routeKnownOptions as readonly string[]).includes(id)
    )
    const validTargetId = (routeTargetOptions as readonly string[]).includes(graphRoute.targetConceptId)
      ? (graphRoute.targetConceptId as (typeof routeTargetOptions)[number])
      : null

    if (!validKnownIds.length || !validTargetId) return

    didHydrateSavedRoute.current = true
    setKnownIds(validKnownIds)
    setTargetId(validTargetId)
  }, [savedSnapshot])

  useEffect(() => {
    setSaveStatus('idle')
  }, [knownIds, targetId])

  const toggleKnown = (id: string) => {
    setKnownIds((current) => {
      if (current.includes(id)) {
        return current.length === 1 ? current : current.filter((knownId) => knownId !== id)
      }

      return [...current, id]
    })
  }

  return (
    <section className="route-engine" aria-labelledby="route-engine-title">
      <div className="engine-copy">
        <p className="eyebrow">Route Engine</p>
        <h3 id="route-engine-title">Compute the honest next path.</h3>
        <p>
          Choose what the learner already knows and a frontier target. The engine runs a weighted shortest-path query
          over typed concept edges, then names the first missing repair instead of hand-waving across the gap.
        </p>
      </div>

      <div className="engine-controls">
        <div>
          <p className="control-label">Known concepts</p>
          <div className="chip-grid">
            {routeKnownOptions.map((id) => {
              const node = getProductGraphNode(id)
              if (!node) {
                return null
              }

              const selected = knownIds.includes(id)
              return (
                <button key={id} type="button" className={selected ? 'selected' : ''} onClick={() => toggleKnown(id)}>
                  <span>{node.group}</span>
                  {node.label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="control-label">Research target</p>
          <div className="chip-grid target-grid">
            {routeTargetOptions.map((id) => {
              const node = getProductGraphNode(id)
              if (!node) {
                return null
              }

              return (
                <button
                  key={id}
                  type="button"
                  className={id === targetId ? 'selected' : ''}
                  onClick={() => setTargetId(id)}
                >
                  <span>{node.group}</span>
                  {node.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="route-result" aria-live="polite">
        {route ? (
          <>
            <div className="route-summary">
              <div>
                <span>{route.nodes.length} nodes</span>
                <strong>{route.nextRepair ? `Repair ${route.nextRepair.label} next` : 'Target is already in reach'}</strong>
              </div>
              <div>
                <span>weighted cost</span>
                <strong>{route.totalWeight.toFixed(2)}</strong>
              </div>
            </div>

            <div className="engine-actions">
              <button
                type="button"
                disabled={!onSaveSnapshot}
                onClick={() => {
                  if (!onSaveSnapshot) return

                  onSaveSnapshot(buildComputedGraphSnapshot(knownIds, targetId, route))
                  setSaveStatus('saved')
                }}
              >
                Save computed route
              </button>
              <span>
                {saveStatus === 'saved'
                  ? 'Saved in this browser.'
                  : 'Preview only; changing chips does not overwrite your saved route.'}
              </span>
            </div>

            <div className="computed-path" aria-label="Computed route">
              {route.nodes.map((node, index) => {
                const content = (
                  <>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{node.label}</strong>
                    <em>{node.role}</em>
                    {node.status === 'planned' ? <b>planned</b> : null}
                  </>
                )

                return node.href ? (
                  <Link key={node.id} href={node.href} className="computed-node">
                    {content}
                  </Link>
                ) : (
                  <div key={node.id} className="computed-node planned">
                    {content}
                  </div>
                )
              })}
            </div>

            <div className="edge-witness">
              {route.edges.map((edge) => (
                <article key={`${edge.from}-${edge.to}`}>
                  <span>{edge.type}</span>
                  <strong>
                    {getProductGraphNode(edge.from)?.label ?? edge.from}
                    {' -> '}
                    {getProductGraphNode(edge.to)?.label ?? edge.to}
                  </strong>
                  <p>{edge.why}</p>
                </article>
              ))}
            </div>
          </>
        ) : (
          <p className="empty-state">Select at least one known concept and one target to compute a path.</p>
        )}
      </div>

      <style jsx>{`
        .route-engine {
          display: grid;
          grid-template-columns: minmax(0, 0.9fr) minmax(280px, 1.1fr);
          gap: 0.9rem;
          min-width: 0;
          padding: 0.95rem;
          border: 1px solid rgba(31, 111, 120, 0.18);
          border-radius: 20px;
          background: rgba(247, 252, 250, 0.72);
        }

        .engine-copy,
        .engine-controls,
        .route-result {
          min-width: 0;
        }

        .engine-copy {
          align-self: start;
        }

        .eyebrow,
        .control-label,
        button span,
        .route-summary span,
        .computed-node span,
        .edge-witness span {
          font-family: var(--font-mono);
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .eyebrow {
          margin: 0 0 0.55rem;
          font-size: 0.72rem;
          color: #1f6f78;
        }

        h3 {
          margin: 0;
          max-width: 12ch;
          color: #151d27;
          font-size: clamp(1.45rem, 2.6vw, 2.25rem);
          line-height: 1.05;
          overflow-wrap: break-word;
        }

        h3::before {
          content: none;
          display: none;
        }

        .engine-copy p:not(.eyebrow),
        .edge-witness p,
        .empty-state {
          margin: 0.8rem 0 0;
          color: #455361;
          line-height: 1.62;
          overflow-wrap: break-word;
        }

        .engine-controls {
          display: grid;
          gap: 0.85rem;
        }

        .control-label {
          margin: 0 0 0.45rem;
          color: #5b6874;
          font-size: 0.68rem;
        }

        .chip-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .target-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        button {
          display: grid;
          gap: 0.28rem;
          min-height: 64px;
          padding: 0.65rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.86);
          color: #1b2430;
          font: inherit;
          font-size: 0.92rem;
          text-align: left;
          cursor: pointer;
          overflow-wrap: break-word;
        }

        button span {
          color: #66717d;
          font-size: 0.6rem;
        }

        button:hover,
        button.selected {
          border-color: rgba(31, 111, 120, 0.3);
          background: rgba(231, 248, 244, 0.88);
        }

        button:focus-visible,
        .computed-node:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.35);
          outline-offset: 2px;
        }

        .route-result {
          grid-column: 1 / -1;
          display: grid;
          gap: 0.75rem;
          padding: 0.85rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 18px;
          background: rgba(255, 251, 245, 0.82);
        }

        .route-summary {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .route-summary div {
          min-width: 0;
          padding: 0.7rem;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.58);
        }

        .route-summary span {
          display: block;
          color: #c24a2d;
          font-size: 0.64rem;
        }

        .route-summary strong {
          display: block;
          margin-top: 0.26rem;
          color: #151d27;
          line-height: 1.28;
          overflow-wrap: break-word;
        }

        .engine-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.55rem;
          align-items: center;
        }

        .engine-actions button {
          min-height: 40px;
          width: fit-content;
          padding: 0.62rem 0.78rem;
          border-radius: 999px;
          background: #1b2430;
          color: #fbf4e8;
          font-weight: 750;
        }

        .engine-actions button:disabled {
          cursor: not-allowed;
          opacity: 0.54;
        }

        .engine-actions span {
          min-width: min(100%, 18rem);
          color: #52606c;
          font-size: 0.86rem;
          line-height: 1.42;
        }

        .computed-path {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .computed-path :global(.computed-node),
        .computed-node {
          display: grid;
          gap: 0.28rem;
          min-height: 104px;
          padding: 0.68rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.92);
          color: #1b2430;
          text-decoration: none;
        }

        .computed-path :global(.computed-node:hover) {
          color: #1f6f78;
          transform: translateY(-2px);
          text-shadow: none;
        }

        .computed-node.planned {
          background: rgba(239, 232, 219, 0.72);
        }

        .computed-node span {
          color: #c24a2d;
          font-size: 0.64rem;
        }

        .computed-node strong {
          color: #151d27;
          line-height: 1.2;
        }

        .computed-node em,
        .computed-node b {
          color: #5b6874;
          font-style: normal;
          line-height: 1.32;
          overflow-wrap: break-word;
        }

        .computed-node b {
          width: max-content;
          max-width: 100%;
          padding: 0.2rem 0.42rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          font-family: var(--font-mono);
          font-size: 0.62rem;
          text-transform: uppercase;
        }

        .edge-witness {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .edge-witness article {
          min-width: 0;
          padding: 0.7rem;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.5);
        }

        .edge-witness span {
          display: block;
          margin-bottom: 0.34rem;
          color: #c24a2d;
          font-size: 0.62rem;
        }

        .edge-witness strong {
          display: block;
          color: #151d27;
          line-height: 1.28;
          overflow-wrap: break-word;
        }

        @media (max-width: 1120px) {
          .route-engine {
            grid-template-columns: 1fr;
          }

          h3 {
            max-width: 100%;
          }

          .computed-path {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .route-engine {
            padding: 0.8rem;
          }

          .chip-grid,
          .target-grid,
          .route-summary,
          .computed-path,
          .edge-witness {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
