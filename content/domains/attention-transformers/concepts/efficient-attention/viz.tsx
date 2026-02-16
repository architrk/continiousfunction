import { useMemo, useState } from 'react'

import KVCacheDashboard from '../../../../../components/foundations/KVCacheDashboard'
import KVCacheViz from '../../../../../components/foundations/KVCacheViz'
import GQAViz from '../../../../../components/foundations/GQAViz'

type TabId = 'dashboard' | 'kvcache' | 'gqa'

export default function EfficientAttentionViz() {
  const tabs = useMemo(
    () =>
      [
        {
          id: 'dashboard' as const,
          label: 'KV Cache Budget',
          note: 'How context length, layers, and head choices turn into GB and latency.',
          Component: KVCacheDashboard,
        },
        {
          id: 'kvcache' as const,
          label: 'KV Cache Mechanics',
          note: 'What gets cached during decoding and why this changes serving cost.',
          Component: KVCacheViz,
        },
        {
          id: 'gqa' as const,
          label: 'GQA',
          note: 'Share K/V heads across many query heads to reduce cache size and bandwidth.',
          Component: GQAViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('dashboard')
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Efficient attention demos">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab ${t.id === active ? 'active' : ''}`}
            role="tab"
            aria-selected={t.id === active}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="note">{current.note}</div>

      <div className="panel" role="tabpanel">
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
          border-color: rgba(99, 102, 241, 0.55);
          color: var(--text-primary);
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

