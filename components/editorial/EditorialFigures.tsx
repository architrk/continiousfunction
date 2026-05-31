import type { CSSProperties } from 'react'
import SurfaceBackplate from './SurfaceBackplate'

type PillarSignal = {
  symbol: string
  label: string
}

const pillarSignals: PillarSignal[] = [
  { symbol: 'S', label: 'sequence' },
  { symbol: 'O', label: 'optimize' },
  { symbol: 'G', label: 'generate' },
  { symbol: 'E', label: 'geometry' },
  { symbol: 'M', label: 'mechanism' },
]

const domainAtlasStages = [
  {
    label: 'Foundations',
    note: 'geometry, probability, calculus',
    style: { left: '9%', top: '54%' },
  },
  {
    label: 'Mechanics',
    note: 'networks, attention, generation',
    style: { left: '33%', top: '31%' },
  },
  {
    label: 'Systems',
    note: 'scaling, efficiency, decoding',
    style: { left: '58%', top: '57%' },
  },
  {
    label: 'Frontiers',
    note: 'alignment, interpretation, causality',
    style: { left: '78%', top: '27%' },
  },
]

export function DomainsHeroFigure() {
  return (
    <div className="domains-figure" aria-label="Domain atlas from foundations to model behavior and frontier questions">
      <SurfaceBackplate variant="atlas" />
      <div className="atlas-board">
        <span className="route route-foundations" />
        <span className="route route-systems" />
        <span className="route route-frontier" />

        {domainAtlasStages.map((stage, index) => (
          <div key={stage.label} className={`atlas-stage stage-${index + 1}`} style={stage.style}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{stage.label}</strong>
            <em>{stage.note}</em>
          </div>
        ))}

        <div className="companion-chip">
          <span>AI companion</span>
          <strong>ask, test, repair</strong>
        </div>
      </div>

      <style jsx>{`
        .domains-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 28% 22%, rgba(31, 111, 120, 0.14), transparent 32%),
            radial-gradient(circle at 74% 72%, rgba(194, 74, 45, 0.1), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 232, 219, 0.94));
        }

        .atlas-board {
          position: relative;
          z-index: 1;
          width: min(86%, 590px);
          aspect-ratio: 16 / 11;
          margin: clamp(2.8rem, 7vw, 4.8rem) auto;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.66);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .route {
          position: absolute;
          z-index: 1;
          border-radius: 999px;
          pointer-events: none;
        }

        .route-foundations {
          left: 17%;
          right: 17%;
          top: 50%;
          height: 3px;
          background: linear-gradient(90deg, rgba(31, 75, 153, 0.2), rgba(31, 111, 120, 0.28));
          transform: rotate(-10deg);
        }

        .route-systems {
          left: 27%;
          top: 29%;
          width: 45%;
          height: 42%;
          border-top: 2px dashed rgba(194, 74, 45, 0.24);
          border-right: 2px solid rgba(194, 74, 45, 0.12);
          transform: rotate(8deg);
        }

        .route-frontier {
          left: 45%;
          top: 22%;
          width: 38%;
          height: 44%;
          border-top: 2px solid rgba(31, 111, 120, 0.2);
          border-left: 2px dashed rgba(31, 111, 120, 0.16);
          transform: rotate(-14deg);
        }

        .atlas-stage,
        .companion-chip {
          position: absolute;
          z-index: 2;
          display: grid;
          gap: 0.35rem;
          width: min(29%, 160px);
          min-height: 118px;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.92);
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.08);
          transform: translate(-50%, -50%);
        }

        .atlas-stage span,
        .companion-chip span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .atlas-stage strong,
        .companion-chip strong {
          color: #17202a;
          font-family: var(--font-display);
          font-size: clamp(1.15rem, 2vw, 1.55rem);
          line-height: 1.04;
        }

        .atlas-stage em {
          color: #52606b;
          font-style: normal;
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .companion-chip {
          right: 7%;
          bottom: 8%;
          width: min(42%, 220px);
          min-height: 0;
          transform: none;
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.82);
        }

        @media (max-width: 720px) {
          .domains-figure {
            min-height: 440px;
          }

          .atlas-board {
            width: 92%;
            min-height: 350px;
            aspect-ratio: auto;
            margin: 2.2rem auto;
          }

          .atlas-stage {
            width: 43%;
            min-height: 104px;
            padding: 0.72rem;
          }

          .stage-1 { left: 28% !important; top: 26% !important; }
          .stage-2 { left: 72% !important; top: 36% !important; }
          .stage-3 { left: 30% !important; top: 67% !important; }
          .stage-4 { left: 73% !important; top: 72% !important; }

          .atlas-stage strong {
            font-size: 1.05rem;
          }

          .atlas-stage em {
            font-size: 0.74rem;
          }

          .companion-chip {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}

export function PillarsHeroFigure() {
  return (
    <div className="pillar-figure" aria-label="Connected pillar map">
      <SurfaceBackplate variant="atlas" />
      <div className="pillar-board">
        <div className="hub">atlas</div>
        {pillarSignals.map((signal, index) => (
          <div key={signal.label} className={`pillar-node node-${index + 1}`}>
            <strong>{signal.symbol}</strong>
            <span>{signal.label}</span>
          </div>
        ))}
        <span className="bridge-line line-a" />
        <span className="bridge-line line-b" />
        <span className="bridge-line line-c" />
      </div>

      <style jsx>{`
        .pillar-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 28% 24%, rgba(31, 111, 120, 0.13), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 232, 219, 0.94));
        }

        .pillar-board {
          position: relative;
          z-index: 1;
          width: min(82%, 520px);
          aspect-ratio: 1;
          margin: clamp(2.5rem, 7vw, 4.4rem) auto;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.62);
          background-size: 34px 34px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .hub,
        .pillar-node {
          position: absolute;
          display: grid;
          place-items: center;
          text-align: center;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.08);
        }

        .hub {
          left: 50%;
          top: 50%;
          width: 96px;
          height: 96px;
          transform: translate(-50%, -50%);
          border-radius: 999px;
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          z-index: 3;
        }

        .pillar-node {
          width: 118px;
          min-height: 86px;
          padding: 0.7rem;
          border-radius: 8px;
          z-index: 2;
        }

        .pillar-node strong {
          color: #17202a;
          font-family: var(--font-display);
          font-size: 1.65rem;
          line-height: 1;
        }

        .pillar-node span {
          color: #52606b;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .node-1 {
          left: 8%;
          top: 12%;
        }

        .node-2 {
          right: 8%;
          top: 16%;
        }

        .node-3 {
          right: 12%;
          bottom: 10%;
        }

        .node-4 {
          left: 10%;
          bottom: 14%;
        }

        .node-5 {
          left: 50%;
          top: 5%;
          transform: translateX(-50%);
        }

        .bridge-line {
          position: absolute;
          left: 18%;
          right: 18%;
          top: 50%;
          height: 2px;
          background: rgba(31, 75, 153, 0.18);
          transform-origin: center;
          z-index: 1;
        }

        .line-a {
          transform: rotate(27deg);
        }

        .line-b {
          transform: rotate(-28deg);
          background: rgba(31, 111, 120, 0.18);
        }

        .line-c {
          transform: rotate(90deg);
          background: rgba(194, 74, 45, 0.16);
        }

        @media (max-width: 720px) {
          .pillar-figure {
            min-height: 420px;
          }

          .pillar-node {
            width: 94px;
            min-height: 80px;
          }
        }
      `}</style>
    </div>
  )
}

export function GraphHeroFigure() {
  return (
    <div className="graph-figure" aria-label="Knowledge graph as navigable learning route">
      <SurfaceBackplate variant="path" />
      <div className="graph-map" aria-hidden="true">
        {Array.from({ length: 12 }, (_, index) => (
          <span key={index} className={`graph-dot dot-${index + 1}`} />
        ))}
        <span className="graph-route primary" />
        <span className="graph-route secondary" />
        <span className="graph-route tertiary" />
      </div>

      <style jsx>{`
        .graph-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 68% 28%, rgba(31, 75, 153, 0.13), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(239, 232, 219, 0.94));
        }

        .graph-map {
          position: relative;
          z-index: 1;
          width: min(84%, 560px);
          aspect-ratio: 16 / 10;
          margin: clamp(3rem, 8vw, 5rem) auto;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.64);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .graph-dot {
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          border: 2px solid rgba(31, 111, 120, 0.54);
          background: rgba(255, 251, 245, 0.9);
          box-shadow: 0 10px 24px rgba(7, 15, 25, 0.08);
          z-index: 2;
        }

        .dot-1 { left: 10%; top: 28%; }
        .dot-2 { left: 22%; top: 56%; }
        .dot-3 { left: 34%; top: 22%; }
        .dot-4 { left: 43%; top: 66%; }
        .dot-5 { left: 54%; top: 42%; }
        .dot-6 { left: 66%; top: 20%; }
        .dot-7 { left: 72%; top: 58%; }
        .dot-8 { left: 84%; top: 36%; }
        .dot-9 { left: 18%; top: 14%; }
        .dot-10 { left: 36%; top: 45%; }
        .dot-11 { left: 58%; top: 72%; }
        .dot-12 { left: 78%; top: 76%; }

        .graph-route {
          position: absolute;
          left: 12%;
          top: 38%;
          width: 74%;
          height: 34%;
          border-top: 3px solid rgba(31, 75, 153, 0.22);
          border-right: 2px solid rgba(31, 75, 153, 0.12);
          border-radius: 999px 999px 0 0;
          transform: rotate(4deg);
          z-index: 1;
        }

        .graph-route.secondary {
          left: 18%;
          top: 18%;
          width: 58%;
          height: 48%;
          border-top-style: dashed;
          border-color: rgba(194, 74, 45, 0.2);
          transform: rotate(-14deg);
        }

        .graph-route.tertiary {
          left: 22%;
          top: 52%;
          width: 60%;
          height: 24%;
          border-color: rgba(31, 111, 120, 0.18);
          transform: rotate(12deg);
        }

        @media (max-width: 720px) {
          .graph-figure {
            min-height: 380px;
          }
        }
      `}</style>
    </div>
  )
}

export function VisionHeroFigure() {
  return (
    <div className="vision-figure" aria-label="Vision map from mathematical ideas to interactive notebooks">
      <SurfaceBackplate variant="companion" />
      <div className="vision-sheet">
        <div className="vision-row">
          <span>intuition</span>
          <strong>mental model</strong>
        </div>
        <div className="vision-row">
          <span>math</span>
          <strong>symbolic claim</strong>
        </div>
        <div className="vision-row">
          <span>code</span>
          <strong>executable witness</strong>
        </div>
        <div className="vision-row active">
          <span>demo</span>
          <strong>falsifiable object</strong>
        </div>
      </div>

      <style jsx>{`
        .vision-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 30% 18%, rgba(31, 111, 120, 0.16), transparent 32%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 232, 219, 0.94));
        }

        .vision-sheet {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 0.85rem;
          width: min(82%, 520px);
          margin: clamp(3rem, 8vw, 5rem) auto;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.66);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .vision-row {
          display: grid;
          grid-template-columns: minmax(7rem, 0.35fr) minmax(0, 1fr);
          gap: 0.9rem;
          align-items: center;
          min-height: 76px;
          padding: 0.85rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
        }

        .vision-row.active {
          border-color: rgba(31, 111, 120, 0.22);
          background: rgba(239, 247, 245, 0.88);
        }

        .vision-row span {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .vision-row strong {
          color: #17202a;
          font-size: 1.06rem;
          overflow-wrap: anywhere;
        }

        @media (max-width: 720px) {
          .vision-figure {
            min-height: 420px;
          }

          .vision-row {
            grid-template-columns: 1fr;
            gap: 0.25rem;
          }
        }
      `}</style>
    </div>
  )
}

type FoundationConceptHeroFigureProps = {
  number: number
  shortTitle: string
  category: string
  color: string
  equation: string
}

export function FoundationsHeroFigure() {
  const phases = [
    { label: 'Core', y: '52%' },
    { label: 'Optim', y: '34%' },
    { label: 'Gen', y: '62%' },
    { label: 'Rep', y: '28%' },
    { label: 'Scale', y: '55%' },
    { label: 'Systems', y: '40%' },
  ]

  return (
    <div className="foundations-figure" aria-label="Foundations atlas route from basics to frontier systems">
      <SurfaceBackplate variant="atlas" />
      <div className="foundation-map">
        <div className="route-line" />
        {phases.map((phase, index) => (
          <div
            key={phase.label}
            className={`phase-node phase-${index + 1}`}
            style={{ top: phase.y }}
          >
            <strong>{index + 1}</strong>
            <span>{phase.label}</span>
          </div>
        ))}
        <div className="demo-window">
          <span>lab surface</span>
          <strong>predict, drag, test</strong>
        </div>
      </div>

      <style jsx>{`
        .foundations-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 72% 24%, rgba(31, 75, 153, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 232, 219, 0.94));
        }

        .foundation-map {
          position: relative;
          z-index: 1;
          width: min(84%, 560px);
          aspect-ratio: 16 / 11;
          margin: clamp(3rem, 8vw, 5rem) auto;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.64);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .route-line {
          position: absolute;
          left: 10%;
          right: 10%;
          top: 50%;
          height: 3px;
          border-radius: 999px;
          background: linear-gradient(90deg, rgba(31, 75, 153, 0.18), rgba(31, 111, 120, 0.28));
          transform: rotate(-8deg);
        }

        .phase-node {
          position: absolute;
          display: grid;
          place-items: center;
          width: 86px;
          height: 76px;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.92);
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.08);
          transform: translate(-50%, -50%);
          text-align: center;
        }

        .phase-node strong {
          color: #17202a;
          font-family: var(--font-display);
          font-size: 1.45rem;
          line-height: 1;
        }

        .phase-node span,
        .demo-window span {
          color: #52606b;
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .phase-1 { left: 12%; }
        .phase-2 { left: 28%; }
        .phase-3 { left: 44%; }
        .phase-4 { left: 60%; }
        .phase-5 { left: 76%; }
        .phase-6 { left: 88%; }

        .demo-window {
          position: absolute;
          left: 50%;
          bottom: 9%;
          display: grid;
          gap: 0.35rem;
          width: min(72%, 320px);
          padding: 0.9rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.78);
          transform: translateX(-50%);
          text-align: center;
        }

        .demo-window strong {
          color: #17202a;
          font-size: 1.05rem;
        }

        @media (max-width: 720px) {
          .foundations-figure {
            min-height: 420px;
          }

          .phase-node {
            width: 72px;
            height: 66px;
          }
        }
      `}</style>
    </div>
  )
}

export function FoundationConceptHeroFigure({
  number,
  shortTitle,
  category,
  color,
  equation,
}: FoundationConceptHeroFigureProps) {
  return (
    <div className="foundation-concept-figure" aria-label={`${shortTitle} legacy concept lab`}>
      <SurfaceBackplate variant="demo" />
      <div className="concept-lab" style={{ '--concept-color': color } as CSSProperties}>
        <div className="concept-token">
          <span>#{number}</span>
          <strong>{shortTitle}</strong>
          <em>{category}</em>
        </div>
        <div className="equation-card">
          <span>key equation</span>
          <code>{equation}</code>
        </div>
        <div className="lab-strip">
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>

      <style jsx>{`
        .foundation-concept-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 68% 24%, rgba(31, 111, 120, 0.13), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.9), rgba(239, 232, 219, 0.94));
        }

        .concept-lab {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 0.9rem;
          width: min(82%, 520px);
          margin: clamp(3rem, 8vw, 5rem) auto;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.66);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .concept-token,
        .equation-card {
          display: grid;
          gap: 0.45rem;
          padding: 1rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
        }

        .concept-token span,
        .equation-card span {
          color: var(--concept-color);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        .concept-token strong {
          color: #17202a;
          font-family: var(--font-display);
          font-size: clamp(1.6rem, 4vw, 2.35rem);
          line-height: 1.02;
        }

        .concept-token em {
          color: #52606b;
          font-style: normal;
          text-transform: capitalize;
        }

        .equation-card code {
          color: #1b2430;
          font-size: 0.95rem;
          line-height: 1.6;
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .lab-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.5rem;
        }

        .lab-strip i {
          display: block;
          height: 78px;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 247, 245, 0.86)),
            linear-gradient(90deg, transparent, var(--concept-color), transparent);
        }

        @media (max-width: 720px) {
          .foundation-concept-figure {
            min-height: 420px;
          }

          .lab-strip {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </div>
  )
}
