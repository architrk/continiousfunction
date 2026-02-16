import { useMemo, useState } from 'react'

import RLHFViz from '../../../../../components/foundations/RLHFViz'
import DPOViz from '../../../../../components/foundations/DPOViz'

type TabId = 'rlhf' | 'dpo'

export default function RLHFDemo() {
  const tabs = useMemo(
    () =>
      [
        {
          id: 'rlhf' as const,
          label: 'RLHF',
          note: 'Reward modeling + KL-regularized policy optimization.',
          Component: RLHFViz,
        },
        {
          id: 'dpo' as const,
          label: 'DPO',
          note: 'Directly optimize preferences without running RL in the inner loop.',
          Component: DPOViz,
        },
      ] as const,
    []
  )

  const [active, setActive] = useState<TabId>('rlhf')
  const current = tabs.find((t) => t.id === active) ?? tabs[0]
  const Active = current.Component

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Alignment demos">
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
          border-color: rgba(239, 68, 68, 0.6);
          color: var(--text-primary);
        }

        .tab.active {
          border-color: rgba(239, 68, 68, 0.85);
          background: rgba(239, 68, 68, 0.14);
          color: rgba(254, 226, 226, 1);
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

