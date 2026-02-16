import Link from 'next/link'
import { useState } from 'react'
import {
  foundationsConcepts,
  getConceptRelations,
  RELATION_COLORS,
  RELATION_LABELS,
  RelationType,
  Concept
} from '../../data/foundationsData'

interface Props {
  concept: Concept
}

// Icons for each relation type
const RELATION_ICONS: Record<RelationType, string> = {
  same_trick: '🔄',
  duality: '↔️',
  breaks_when: '⚠️',
  invented_to_fix: '🔧',
  analogy: '≈'
}

// Question type definitions for "mathematician's mind" navigation
const QUESTION_TYPES = [
  {
    id: 'unpack',
    label: 'Unpack',
    icon: '📦',
    question: 'What concepts make this up?',
    description: 'Decompose into component ideas'
  },
  {
    id: 'reframe',
    label: 'Reframe',
    icon: '🔍',
    question: 'See this in a different context?',
    description: 'Same technique, new lens'
  },
  {
    id: 'stress-test',
    label: 'Stress-test',
    icon: '⚡',
    question: 'When does this break?',
    description: 'Failure modes and edge cases'
  },
  {
    id: 'motivate',
    label: 'Motivate',
    icon: '🎯',
    question: 'Why was this invented?',
    description: 'What problem did this solve'
  },
  {
    id: 'apply',
    label: 'Apply',
    icon: '🚀',
    question: 'Where is this used?',
    description: 'Applications in frontier models'
  }
] as const

export default function NextMovesPanel({ concept }: Props) {
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [_hoveredRelation, setHoveredRelation] = useState<string | null>(null)

  const { outgoing, incoming } = getConceptRelations(concept.id)

  // Combined relation type with direction
  type RelationWithDirection = (typeof outgoing)[number] | (typeof incoming)[number]

  // Group relations by type for organized display
  const allRelations: RelationWithDirection[] = [...outgoing, ...incoming]
  const relationsByType = allRelations.reduce((acc, rel) => {
    if (!acc[rel.type]) acc[rel.type] = []
    acc[rel.type].push(rel)
    return acc
  }, {} as Record<string, RelationWithDirection[]>)

  // Map relation types to question types for smart suggestions
  const questionToRelations: Record<string, RelationType[]> = {
    'unpack': [], // Prerequisites from concept.prereqs
    'reframe': ['same_trick', 'analogy'],
    'stress-test': ['breaks_when'],
    'motivate': ['invented_to_fix'],
    'apply': ['same_trick'] // Where is this used in practice
  }

  const getRelationsForQuestion = (questionId: string): RelationWithDirection[] => {
    const types = questionToRelations[questionId] || []
    return allRelations.filter(r => types.includes(r.type))
  }

  const hasRelationsForQuestion = (questionId: string) => {
    if (questionId === 'unpack') {
      return concept.prereqs.length > 0
    }
    return getRelationsForQuestion(questionId).length > 0
  }

  return (
    <div className="next-moves-panel">
      <h2>Next Moves</h2>
      <p className="panel-intro">
        Explore this concept from different angles — like a mathematician would.
      </p>

      {/* Question type chips */}
      <div className="question-chips">
        {QUESTION_TYPES.map(qt => {
          const isActive = expandedType === qt.id
          const hasContent = hasRelationsForQuestion(qt.id)

          return (
            <button
              key={qt.id}
              className={`question-chip ${isActive ? 'active' : ''} ${hasContent ? 'has-content' : 'no-content'}`}
              onClick={() => setExpandedType(isActive ? null : qt.id)}
              disabled={!hasContent}
            >
              <span className="chip-icon">{qt.icon}</span>
              <span className="chip-label">{qt.label}</span>
            </button>
          )
        })}
      </div>

      {/* Expanded question panel */}
      {expandedType && (
        <div className="expanded-question">
          {(() => {
            const qt = QUESTION_TYPES.find(q => q.id === expandedType)
            if (!qt) return null

            return (
              <>
                <h3>
                  {qt.icon} {qt.question}
                </h3>

                {/* For "Unpack" - show prerequisites */}
                {expandedType === 'unpack' && concept.prereqs.length > 0 && (
                  <div className="relation-cards">
                    {concept.prereqs.map(prereqId => {
                      const prereq = foundationsConcepts.find(c => c.id === prereqId)
                      if (!prereq) return null
                      return (
                        <Link
                          key={prereqId}
                          href={`/foundations/${prereqId}/`}
                          className="relation-card"
                          style={{ borderColor: prereq.color }}
                        >
                          <div className="card-header">
                            <span className="card-icon">{prereq.icon}</span>
                            <span className="card-title">{prereq.shortTitle}</span>
                          </div>
                          <p className="card-description">
                            Required foundation for understanding {concept.shortTitle}
                          </p>
                        </Link>
                      )
                    })}
                  </div>
                )}

                {/* For other questions - show typed relations */}
                {expandedType !== 'unpack' && (
                  <div className="relation-cards">
                    {getRelationsForQuestion(expandedType).map((rel, i) => {
                      const targetId = rel.direction === 'outgoing' ? rel.to : rel.from
                      const target = foundationsConcepts.find(c => c.id === targetId)
                      if (!target) return null

                      return (
                        <Link
                          key={`${rel.from}-${rel.to}-${i}`}
                          href={`/foundations/${targetId}/`}
                          className="relation-card"
                          style={{
                            borderColor: RELATION_COLORS[rel.type as keyof typeof RELATION_COLORS]
                          }}
                          onMouseEnter={() => setHoveredRelation(`${rel.from}-${rel.to}`)}
                          onMouseLeave={() => setHoveredRelation(null)}
                        >
                          <div className="card-header">
                            <span className="relation-type-badge">
                              {RELATION_ICONS[rel.type]} {rel.label}
                            </span>
                          </div>
                          <div className="card-target">
                            <span className="card-icon">{target.icon}</span>
                            <span className="card-title">{target.shortTitle}</span>
                          </div>
                          <p className="card-why">{rel.why}</p>
                        </Link>
                      )
                    })}
                    {getRelationsForQuestion(expandedType).length === 0 && (
                      <p className="no-relations">
                        No {qt.label.toLowerCase()} connections mapped yet for this concept.
                      </p>
                    )}
                  </div>
                )}
              </>
            )
          })()}
        </div>
      )}

      {/* Typed relations overview (when no question is selected) */}
      {!expandedType && Object.keys(relationsByType).length > 0 && (
        <div className="relations-overview">
          <h3>Semantic Connections</h3>
          <div className="relation-groups">
            {Object.entries(relationsByType).map(([type, rels]) => (
              <div key={type} className="relation-group">
                <span
                  className="group-label"
                  style={{ color: RELATION_COLORS[type as keyof typeof RELATION_COLORS] }}
                >
                  {RELATION_ICONS[type as RelationType]} {RELATION_LABELS[type as keyof typeof RELATION_LABELS]}
                </span>
                <div className="group-links">
                  {rels.map((rel, i) => {
                    const targetId = rel.direction === 'outgoing' ? rel.to : rel.from
                    const target = foundationsConcepts.find(c => c.id === targetId)
                    if (!target) return null

                    return (
                      <Link
                        key={`${rel.from}-${rel.to}-${i}`}
                        href={`/foundations/${targetId}/`}
                        className="relation-link"
                        title={rel.why}
                      >
                        <span className="link-icon">{target.icon}</span>
                        <span className="link-label">{rel.label}</span>
                        <span className="link-arrow">→</span>
                        <span className="link-target">{target.shortTitle}</span>
                      </Link>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .next-moves-panel {
          background: rgba(8, 12, 20, 0.6);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 12px;
          padding: 1.5rem;
          margin-top: 2rem;
        }

        .next-moves-panel h2 {
          font-family: var(--font-display);
          font-size: 1.25rem;
          margin-bottom: 0.5rem;
          color: var(--accent);
        }

        .panel-intro {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 1.5rem;
        }

        .question-chips {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
        }

        .question-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.5rem 0.75rem;
          border-radius: 20px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.3);
          color: var(--text-primary);
          cursor: pointer;
          font-size: 0.85rem;
          transition: all 0.2s;
        }

        .question-chip:hover:not(:disabled) {
          background: rgba(245, 158, 11, 0.2);
          border-color: var(--accent);
        }

        .question-chip.active {
          background: var(--accent);
          color: #0a0a0a;
          border-color: var(--accent);
        }

        .question-chip.no-content {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .chip-icon {
          font-size: 1rem;
        }

        .expanded-question {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 8px;
          padding: 1rem;
          margin-bottom: 1rem;
        }

        .expanded-question h3 {
          font-size: 1rem;
          margin-bottom: 1rem;
          color: var(--accent);
        }

        .relation-cards {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .relation-card {
          display: block;
          padding: 1rem;
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-left-width: 3px;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.2s;
        }

        .relation-card:hover {
          background: rgba(245, 158, 11, 0.1);
          transform: translateX(4px);
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .card-icon {
          font-size: 1.2rem;
        }

        .card-title {
          font-weight: 600;
          color: var(--text-primary);
        }

        .card-target {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
        }

        .relation-type-badge {
          font-size: 0.75rem;
          padding: 0.2rem 0.5rem;
          border-radius: 4px;
          background: rgba(245, 158, 11, 0.15);
          color: var(--accent);
        }

        .card-description,
        .card-why {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        .no-relations {
          font-size: 0.85rem;
          color: var(--text-tertiary);
          font-style: italic;
        }

        .relations-overview h3 {
          font-size: 0.9rem;
          color: var(--text-secondary);
          margin-bottom: 1rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .relation-groups {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .relation-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .group-label {
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .group-links {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-left: 1.5rem;
        }

        .relation-link {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.4rem 0.75rem;
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 6px;
          text-decoration: none;
          font-size: 0.8rem;
          transition: all 0.2s;
        }

        .relation-link:hover {
          background: rgba(245, 158, 11, 0.15);
          border-color: rgba(245, 158, 11, 0.3);
        }

        .link-icon {
          font-size: 0.9rem;
        }

        .link-label {
          color: var(--text-secondary);
        }

        .link-arrow {
          color: var(--text-tertiary);
        }

        .link-target {
          color: var(--text-primary);
          font-weight: 500;
        }

        @media (max-width: 600px) {
          .question-chips {
            flex-wrap: wrap;
          }

          .question-chip {
            flex: 1 1 calc(50% - 0.25rem);
            justify-content: center;
          }

          .group-links {
            margin-left: 0;
          }
        }
      `}</style>
    </div>
  )
}
