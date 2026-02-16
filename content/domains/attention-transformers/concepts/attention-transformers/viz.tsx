import { useId, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'

import dynamic from 'next/dynamic'

const AttentionGeometryViz = dynamic(
  () => import('../../../../../components/foundations/AttentionGeometryViz'),
  { ssr: false }
)
const SelfAttentionViz = dynamic(() => import('../../../../../components/foundations/SelfAttentionViz'), {
  ssr: false,
})
const TransformerArchitectureViz = dynamic(
  () => import('../../../../../components/foundations/TransformerArchitectureViz'),
  { ssr: false }
)
const AttentionBackpropViz = dynamic(
  () => import('../../../../../components/foundations/AttentionBackpropViz'),
  { ssr: false }
)

type TabId = 'geometry' | 'mechanics' | 'architecture' | 'backprop'

export default function AttentionTransformersViz() {
  const uid = useId()
  const tabs = useMemo(
    () =>
      [
        {
          id: 'geometry' as const,
          label: 'Geometry',
          note: 'Dot products become attention weights: watch the similarities turn into a distribution.',
          Component: AttentionGeometryViz,
        },
        {
          id: 'mechanics' as const,
          label: 'Self-Attention',
          note: 'Queries/keys/values + masking: the actual computation you run in an LM layer.',
          Component: SelfAttentionViz,
        },
        {
          id: 'architecture' as const,
          label: 'Transformer Block',
          note: 'How attention, MLP, residuals, and normalization fit together into a layer.',
          Component: TransformerArchitectureViz,
        },
        {
          id: 'backprop' as const,
          label: 'Backprop',
          note: 'How gradients flow through attention weights and value mixing.',
          Component: AttentionBackpropViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('geometry')
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
      <div className="tabs" role="tablist" aria-label="Attention demos">
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
          border-color: rgba(99, 102, 241, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
        }

        .tab:focus-visible {
          outline: 2px solid rgba(148, 163, 184, 0.6);
          outline-offset: 2px;
        }

        .tab.active {
          border-color: rgba(99, 102, 241, 0.8);
          background: rgba(99, 102, 241, 0.18);
          color: #c7d2fe;
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
