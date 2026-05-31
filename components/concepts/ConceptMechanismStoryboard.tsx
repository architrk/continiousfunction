import { useMemo, useState } from 'react'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type ConceptImage = {
  src: string
  alt: string
}

type StoryboardSection = {
  id: string
  label: string
  step: string
  summary: string
  ready: boolean
}

type Props = {
  conceptTitle: string
  conceptDescription?: string
  sections: StoryboardSection[]
  nextConcept?: string
  image?: ConceptImage | null
  hasVisualization: boolean
}

const predictionOptions = [
  {
    id: 'quantity',
    label: 'Quantity moves',
    response: 'Track the measured value first, then ask which equation or control caused the change.',
  },
  {
    id: 'constraint',
    label: 'Invariant holds',
    response: 'Name what should stay fixed while the representation changes form.',
  },
  {
    id: 'failure',
    label: 'Failure appears',
    response: 'Look for the edge case; the strongest understanding usually shows up at the boundary.',
  },
]

function fallbackSection(sections: StoryboardSection[]) {
  return sections[0] ?? {
    id: 'intuition',
    label: 'Intuition',
    step: '01',
    summary: 'Find the central mechanism.',
    ready: true,
  }
}

function compactTitle(value: string, limit = 58) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

export default function ConceptMechanismStoryboard({
  conceptTitle,
  conceptDescription,
  sections,
  nextConcept,
  image,
  hasVisualization,
}: Props) {
  const firstSection = fallbackSection(sections)
  const [activeSectionId, setActiveSectionId] = useState(firstSection.id)
  const [predictionId, setPredictionId] = useState(predictionOptions[0].id)
  const [revealed, setRevealed] = useState(false)

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? firstSection
  const activeIndex = Math.max(0, sections.findIndex((section) => section.id === activeSection.id))
  const activePrediction = predictionOptions.find((option) => option.id === predictionId) ?? predictionOptions[0]
  const bridgeTarget = nextConcept || 'the next connected idea'
  const statusText = revealed
    ? `${activeSection.label} checked`
    : hasVisualization
      ? 'Prediction open'
      : 'Demo notes open'

  const visualNodes = useMemo(() => {
    const fallback = sections.length ? sections : [firstSection]
    return fallback.slice(0, 4).map((section, index) => ({
      ...section,
      x: 58 + index * 108,
      y: index % 2 === 0 ? 82 : 146,
      active: section.id === activeSection.id,
    }))
  }, [activeSection.id, firstSection, sections])

  function switchSection(sectionId: string) {
    setActiveSectionId(sectionId)
    setRevealed(false)
  }

  return (
    <section className="storyboard" aria-labelledby="concept-storyboard-title">
      <SurfaceBackplate variant="demo" density="quiet" />

      <header className="storyboard-header">
        <div className="storyboard-copy">
          <p className="eyebrow">Mechanism Storyboard</p>
          <h2 id="concept-storyboard-title">See the idea move before the page explains it</h2>
          <p>{conceptDescription || `${conceptTitle} as a connected visual, symbolic, coded, and interactive mechanism.`}</p>
        </div>
        <div className="storyboard-status" aria-live="polite">
          <span>{statusText}</span>
          <strong>{activeSection.step} / {activeSection.label}</strong>
        </div>
      </header>

      <div className="storyboard-grid">
        <div className={`visual-board stage-${activeIndex + 1}`}>
          {image ? (
            <figure className="image-anchor">
              <img src={image.src} alt={image.alt} />
            </figure>
          ) : null}

          <svg viewBox="0 0 420 230" role="img" aria-label={`${conceptTitle} mechanism storyboard`}>
            <defs>
              <linearGradient id="storyboard-flow" x1="0" x2="1" y1="0" y2="1">
                <stop offset="0%" stopColor="#1f6f78" />
                <stop offset="52%" stopColor="#1f4b99" />
                <stop offset="100%" stopColor="#c24a2d" />
              </linearGradient>
            </defs>
            <path className="flow-backbone" d="M54 116 C116 44 174 185 232 116 S328 48 382 116" />
            <path className="flow-pulse" d="M54 116 C116 44 174 185 232 116 S328 48 382 116" />
            <g className="symbol-layer">
              <path d="M74 178 h68" />
              <path d="M102 178 v-52" />
              <path d="M92 138 l22 24 46-68" />
              <path d="M252 174 c18-54 54-72 88-38" />
              <path d="M260 132 h86" />
            </g>
            <g className="nodes">
              {visualNodes.map((node, index) => (
                <g key={node.id} className={node.active ? 'active' : ''}>
                  <circle cx={node.x} cy={node.y} r={node.active ? 24 : 17} />
                  <circle className="node-core" cx={node.x} cy={node.y} r={node.active ? 8 : 5} />
                  <path
                    className="node-spark"
                    d={`M${node.x - 18} ${node.y - 24} C${node.x - 5} ${node.y - 40} ${node.x + 10} ${node.y - 40} ${node.x + 22} ${node.y - 24}`}
                  />
                  <rect x={node.x - 20} y={node.y + 31} width="40" height="6" rx="3" opacity={0.24 + index * 0.1} />
                </g>
              ))}
            </g>
          </svg>
        </div>

        <div className="interaction-board">
          <div className="stage-tabs" aria-label="Storyboard stages">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={section.id === activeSection.id ? 'active' : ''}
                aria-pressed={section.id === activeSection.id}
                onClick={() => switchSection(section.id)}
              >
                <span>{section.step}</span>
                {section.label}
              </button>
            ))}
          </div>

          <div className="prediction-panel">
            <span className="panel-kicker">Prediction lens</span>
            <h3>{compactTitle(activeSection.summary)}</h3>
            <div className="prediction-options" aria-label="Prediction options">
              {predictionOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={option.id === activePrediction.id ? 'active' : ''}
                  aria-pressed={option.id === activePrediction.id}
                  onClick={() => {
                    setPredictionId(option.id)
                    setRevealed(false)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button type="button" className="reveal-button" onClick={() => setRevealed(true)}>
              Reveal check
            </button>
          </div>

          <div className={`reveal-panel ${revealed ? 'open' : ''}`} aria-live="polite">
            <span>{revealed ? 'Check' : 'Commit first'}</span>
            <p>
              {revealed
                ? `${activePrediction.response} Carry that observation into ${bridgeTarget}.`
                : `Before reading further, choose the kind of change ${conceptTitle} should make visible.`}
            </p>
          </div>
        </div>
      </div>

      <style jsx>{`
        .storyboard {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          min-width: 0;
          padding: 1.1rem;
          border-radius: 22px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.96), rgba(239, 247, 245, 0.88)),
            linear-gradient(180deg, rgba(31, 75, 153, 0.06), transparent 58%);
          box-shadow: 0 18px 42px rgba(12, 22, 34, 0.08);
        }

        .storyboard-header,
        .storyboard-grid {
          position: relative;
          z-index: 1;
        }

        .storyboard-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(11rem, 15rem);
          gap: 1rem;
          align-items: start;
        }

        .storyboard-copy {
          display: grid;
          gap: 0.4rem;
          min-width: 0;
          max-width: 58rem;
        }

        .eyebrow,
        .storyboard-status span,
        .panel-kicker,
        .reveal-panel span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        h2,
        h3,
        p {
          margin: 0;
        }

        h2 {
          font-family: var(--font-display);
          font-size: clamp(1.35rem, 2.4vw, 1.95rem);
          line-height: 1.05;
          color: #17202a;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .storyboard-copy p,
        .reveal-panel p {
          color: #52606b;
          line-height: 1.55;
        }

        .storyboard-status {
          display: grid;
          gap: 0.35rem;
          min-width: 0;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
        }

        .storyboard-status strong {
          color: #17202a;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        .storyboard-grid {
          display: grid;
          grid-template-columns: minmax(18rem, 0.95fr) minmax(19rem, 1.05fr);
          gap: 0.9rem;
          min-width: 0;
        }

        .visual-board,
        .interaction-board {
          min-width: 0;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .visual-board {
          position: relative;
          overflow: hidden;
          min-height: 23rem;
          padding: 0.8rem;
          display: grid;
          align-items: end;
        }

        .image-anchor {
          position: absolute;
          inset: 0;
          margin: 0;
          opacity: 0.26;
        }

        .image-anchor::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255, 251, 245, 0.92), rgba(255, 251, 245, 0.38) 48%, rgba(255, 251, 245, 0.92)),
            linear-gradient(180deg, rgba(255, 251, 245, 0.2), rgba(255, 251, 245, 0.92));
        }

        .image-anchor img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(0.9) contrast(0.92);
        }

        svg {
          position: relative;
          z-index: 1;
          display: block;
          width: 100%;
          height: auto;
          min-height: 15rem;
        }

        .flow-backbone,
        .flow-pulse,
        .symbol-layer path,
        .node-spark {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .flow-backbone {
          stroke: rgba(27, 36, 48, 0.12);
          stroke-width: 8;
        }

        .flow-pulse {
          stroke: url(#storyboard-flow);
          stroke-width: 4;
          stroke-dasharray: 54 220;
          animation: storyboard-flow 5.6s ease-in-out infinite;
        }

        .symbol-layer path {
          stroke: rgba(31, 75, 153, 0.22);
          stroke-width: 3;
          stroke-dasharray: 8 10;
        }

        .nodes circle:first-child {
          fill: rgba(255, 251, 245, 0.9);
          stroke: rgba(31, 111, 120, 0.32);
          stroke-width: 2;
          transition: r 0.18s ease, stroke 0.18s ease, fill 0.18s ease;
        }

        .nodes .active circle:first-child {
          fill: rgba(239, 247, 245, 0.96);
          stroke: rgba(194, 74, 45, 0.56);
        }

        .node-core {
          fill: #1f6f78;
        }

        .nodes .active .node-core {
          fill: #c24a2d;
          animation: storyboard-pulse 1.8s ease-in-out infinite;
        }

        .node-spark {
          stroke: rgba(194, 74, 45, 0.42);
          stroke-width: 2;
          opacity: 0;
        }

        .nodes .active .node-spark {
          opacity: 1;
          animation: storyboard-spark 2.2s ease-in-out infinite;
        }

        .nodes rect {
          fill: rgba(31, 75, 153, 0.42);
        }

        .interaction-board {
          display: grid;
          align-content: start;
          gap: 0.75rem;
          padding: 0.85rem;
        }

        .stage-tabs {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
        }

        button {
          min-width: 0;
          font: inherit;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .stage-tabs button,
        .prediction-options button,
        .reveal-button {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.9);
          color: #213040;
        }

        .stage-tabs button {
          display: grid;
          gap: 0.2rem;
          min-height: 4rem;
          padding: 0.55rem;
          text-align: left;
          font-size: 0.92rem;
          font-weight: 800;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .stage-tabs button span {
          color: #65717c;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 500;
        }

        .stage-tabs button.active,
        .prediction-options button.active {
          border-color: rgba(31, 111, 120, 0.34);
          background: rgba(239, 247, 245, 0.96);
        }

        .stage-tabs button:hover,
        .prediction-options button:hover,
        .reveal-button:hover {
          transform: translateY(-1px);
          border-color: rgba(31, 75, 153, 0.28);
        }

        .stage-tabs button:focus-visible,
        .prediction-options button:focus-visible,
        .reveal-button:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.28);
          outline-offset: 2px;
        }

        .prediction-panel {
          display: grid;
          gap: 0.65rem;
          padding: 0.85rem;
          border-radius: 8px;
          background: rgba(239, 247, 245, 0.76);
          border: 1px solid rgba(31, 111, 120, 0.12);
        }

        h3 {
          color: #17202a;
          font-size: 1rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .prediction-options {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.45rem;
        }

        .prediction-options button,
        .reveal-button {
          min-height: 2.75rem;
          padding: 0.62rem;
          font-weight: 800;
        }

        .reveal-button {
          justify-self: start;
          padding-inline: 0.9rem;
          background: #1f6f78;
          color: #fffaf2;
          border-color: rgba(31, 111, 120, 0.6);
        }

        .reveal-panel {
          display: grid;
          gap: 0.35rem;
          min-height: 6.2rem;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
        }

        .reveal-panel.open {
          border-color: rgba(194, 74, 45, 0.22);
          background: rgba(255, 247, 236, 0.9);
        }

        @keyframes storyboard-flow {
          0% {
            stroke-dashoffset: 260;
          }
          54% {
            stroke-dashoffset: 80;
          }
          100% {
            stroke-dashoffset: -120;
          }
        }

        @keyframes storyboard-pulse {
          0%,
          100% {
            opacity: 0.72;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.24);
          }
        }

        @keyframes storyboard-spark {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-4px);
          }
        }

        @media (max-width: 980px) {
          .storyboard-grid,
          .storyboard-header {
            grid-template-columns: 1fr;
          }

          .visual-board {
            min-height: 18rem;
          }
        }

        @media (max-width: 700px) {
          .stage-tabs,
          .prediction-options {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 520px) {
          .stage-tabs,
          .prediction-options {
            grid-template-columns: 1fr;
          }

          .visual-board {
            min-height: 15rem;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .flow-pulse,
          .nodes .active .node-core,
          .nodes .active .node-spark {
            animation: none;
          }

          button {
            transition: none;
          }
        }
      `}</style>
    </section>
  )
}
