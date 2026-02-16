import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'

const DiffusionProcessViz = dynamic(() => import('../../../../../components/foundations/DiffusionProcessViz'), {
  ssr: false,
})
const DiffusionScoreViz = dynamic(() => import('../../../../../components/foundations/DiffusionScoreViz'), {
  ssr: false,
})
const FlowMatchingViz = dynamic(() => import('../../../../../components/foundations/FlowMatchingViz'), {
  ssr: false,
})

type TabId = 'process' | 'score' | 'flow'

export default function DiffusionViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'process' as const,
          label: 'Process',
          note: 'Forward noising and reverse denoising as a step-by-step transformation.',
          Component: DiffusionProcessViz,
        },
        {
          id: 'score' as const,
          label: 'Score Matching',
          note: 'Denoising as learning directions of increasing log-density (the score).',
          Component: DiffusionScoreViz,
        },
        {
          id: 'flow' as const,
          label: 'Flow Matching',
          note: 'Learn a continuous-time vector field that transports noise to data.',
          Component: FlowMatchingViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('process')
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
      <div className="tabs" role="tablist" aria-label="Diffusion demos">
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
        }

        .tab:hover {
          border-color: rgba(236, 72, 153, 0.6);
          color: var(--text-primary);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(236, 72, 153, 0.85);
          background: rgba(236, 72, 153, 0.18);
          color: rgba(251, 207, 232, 1);
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
