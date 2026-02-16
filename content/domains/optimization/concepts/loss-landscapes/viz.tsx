import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'

const LossLandscapeViz = dynamic(() => import('../../../../../components/foundations/LossLandscapeViz'), {
  ssr: false,
})
const LossLandscape3DViz = dynamic(() => import('../../../../../components/foundations/LossLandscape3DViz'), {
  ssr: false,
})
const EdgeOfStabilityViz = dynamic(() => import('../../../../../components/foundations/EdgeOfStabilityViz'), {
  ssr: false,
})

type TabId = 'slice' | 'surface' | 'stability'

export default function LossLandscapesViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'slice' as const,
          label: '2D Slice',
          note: 'A readable 2D slice: see valleys, saddles, and why some directions feel "sharp".',
          Component: LossLandscapeViz,
        },
        {
          id: 'surface' as const,
          label: '3D View',
          note: 'A more literal surface view: rotate to see curvature and basins.',
          Component: LossLandscape3DViz,
        },
        {
          id: 'stability' as const,
          label: 'Edge Of Stability',
          note: 'What happens as learning rate approaches the stability boundary.',
          Component: EdgeOfStabilityViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('slice')
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component

  const panelId = `${uid}-panel`
  const tabId = (id: TabId) => `${uid}-tab-${id}`
  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    const idx = tabs.findIndex((t) => t.id === active)
    if (idx < 0) return
    let next: TabId | null = null
    if (e.key === 'ArrowRight') next = tabs[(idx + 1) % tabs.length].id
    else if (e.key === 'ArrowLeft') next = tabs[(idx - 1 + tabs.length) % tabs.length].id
    else if (e.key === 'Home') next = tabs[0].id
    else if (e.key === 'End') next = tabs[tabs.length - 1].id
    if (!next) return
    e.preventDefault()
    setActive(next)
    requestAnimationFrame(() => document.getElementById(tabId(next))?.focus())
  }

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Loss landscape demos">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${t.id === active ? 'active' : ''}`}
            role="tab"
            id={tabId(t.id)}
            aria-selected={t.id === active}
            aria-controls={panelId}
            tabIndex={t.id === active ? 0 : -1}
            onClick={() => setActive(t.id)}
            onKeyDown={onKeyDown}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="note">{current.note}</div>

      <div className="panel" role="tabpanel" id={panelId} aria-labelledby={tabId(active)} tabIndex={0}>
        <Active />
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .tabs {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .tab {
          appearance: none;
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.65rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(59, 130, 246, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(59, 130, 246, 0.85);
          background: rgba(59, 130, 246, 0.18);
          color: rgba(191, 219, 254, 1);
        }

        .note {
          font-size: 0.9rem;
          color: var(--text-muted);
          line-height: 1.5;
        }

        .panel {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
        }
      `}</style>
    </div>
  )
}

