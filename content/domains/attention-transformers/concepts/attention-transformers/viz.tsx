import { useMemo, useState } from 'react'

import AttentionGeometryViz from '../../../../../components/foundations/AttentionGeometryViz'
import SelfAttentionViz from '../../../../../components/foundations/SelfAttentionViz'
import TransformerArchitectureViz from '../../../../../components/foundations/TransformerArchitectureViz'
import AttentionBackpropViz from '../../../../../components/foundations/AttentionBackpropViz'

type TabId = 'geometry' | 'mechanics' | 'architecture' | 'backprop'

export default function AttentionTransformersViz() {
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

  return (
    <div className="wrap">
      <div className="tabs" role="tablist" aria-label="Attention demos">
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
          transition: border-color 120ms ease, transform 120ms ease, color 120ms ease;
        }

        .tab:hover {
          border-color: rgba(99, 102, 241, 0.6);
          color: var(--text-primary);
          transform: translateY(-1px);
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

