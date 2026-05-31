import { useMemo, useState, type CSSProperties } from 'react'
import SurfaceBackplate from '../editorial/SurfaceBackplate'

type ConceptImage = {
  src: string
  alt: string
}

type InquirySection = {
  id: string
  label: string
  step: string
  summary: string
  ready: boolean
}

type VisualLens = {
  id: string
  label: string
  shortLabel: string
  prompt: string
  response: string
  x: number
  y: number
  crop: string
}

type PredictionChoice = {
  id: string
  label: string
  response: string
}

export type ConceptVisualInquiryReveal = {
  lensId: string
  lensLabel: string
  predictionId: string
  predictionLabel: string
  depth: number
  check: string
}

type Props = {
  conceptTitle: string
  conceptDescription?: string
  image?: ConceptImage | null
  sections: InquirySection[]
  nextConcept?: string
  hasVisualization: boolean
  onReveal?: (reveal: ConceptVisualInquiryReveal) => void
}

const visualLenses: VisualLens[] = [
  {
    id: 'picture',
    label: 'Picture',
    shortLabel: 'Visual cue',
    prompt: 'Which visible object should carry the first intuition?',
    response: 'Start with the most concrete object, then ask which quantity it stands for.',
    x: 30,
    y: 36,
    crop: '30% 34%',
  },
  {
    id: 'motion',
    label: 'Motion',
    shortLabel: 'Moving path',
    prompt: 'Where should the mechanism visibly move?',
    response: 'Follow the path from input cue to changed outcome before naming the formula.',
    x: 64,
    y: 42,
    crop: '64% 38%',
  },
  {
    id: 'symbol',
    label: 'Symbol',
    shortLabel: 'Math bridge',
    prompt: 'Which symbol should explain the image?',
    response: 'Bind one symbol to one visible cue, then check whether the units and shape agree.',
    x: 45,
    y: 67,
    crop: '46% 66%',
  },
  {
    id: 'probe',
    label: 'Probe',
    shortLabel: 'Test point',
    prompt: 'Which part should break or stay stable under a change?',
    response: 'Use the demo or code witness to perturb the cue and keep the claimed invariant honest.',
    x: 76,
    y: 70,
    crop: '76% 68%',
  },
]

const predictionChoices: PredictionChoice[] = [
  {
    id: 'path',
    label: 'Active path',
    response: 'The strongest next move is to track the highlighted path from cause to consequence.',
  },
  {
    id: 'invariant',
    label: 'Stable constraint',
    response: 'The useful question is what remains true while the representation changes.',
  },
  {
    id: 'boundary',
    label: 'Edge case',
    response: 'The fastest understanding check is to push the boundary and watch the assumption surface.',
  },
]

function clampDepth(value: number) {
  return Math.max(1, Math.min(4, Math.round(value)))
}

function compact(value: string, limit = 78) {
  if (value.length <= limit) return value
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

export default function ConceptVisualInquiryPanel({
  conceptTitle,
  conceptDescription,
  image,
  sections,
  nextConcept,
  hasVisualization,
  onReveal,
}: Props) {
  const [activeLensId, setActiveLensId] = useState(visualLenses[0].id)
  const [predictionId, setPredictionId] = useState(predictionChoices[0].id)
  const [depth, setDepth] = useState(2)
  const [revealed, setRevealed] = useState(false)

  const activeLens = visualLenses.find((lens) => lens.id === activeLensId) ?? visualLenses[0]
  const activePrediction = predictionChoices.find((choice) => choice.id === predictionId) ?? predictionChoices[0]
  const readySections = sections.filter((section) => section.ready).length
  const bridgeTarget = nextConcept || 'the next connected idea'
  const revealCheck = `${activeLens.response} ${activePrediction.response} Carry that read into ${bridgeTarget}.`

  const stageStyle = useMemo(() => ({
    '--concept-visual': image ? `url("${image.src}")` : 'linear-gradient(135deg, #fff7ea, #eaf4f1)',
    '--focus-x': `${activeLens.x}%`,
    '--focus-y': `${activeLens.y}%`,
    '--tile-crop': activeLens.crop,
    '--scan-duration': `${Math.max(3.2, 7.2 - depth)}s`,
    '--focus-size': `${82 + depth * 16}px`,
  } as CSSProperties), [activeLens.crop, activeLens.x, activeLens.y, depth, image])

  function chooseLens(lensId: string) {
    setActiveLensId(lensId)
    setRevealed(false)
  }

  function reveal() {
    setRevealed(true)
    onReveal?.({
      lensId: activeLens.id,
      lensLabel: activeLens.label,
      predictionId: activePrediction.id,
      predictionLabel: activePrediction.label,
      depth,
      check: revealCheck,
    })
  }

  return (
    <section
      id="visual-inquiry"
      className={`visual-inquiry ${image ? 'has-image' : 'no-image'}`}
      style={stageStyle}
      aria-labelledby="visual-inquiry-title"
    >
      <SurfaceBackplate variant="atlas" density="quiet" />

      <header className="inquiry-header">
        <div className="heading-copy">
          <p className="eyebrow">Visual Inquiry</p>
          <h2 id="visual-inquiry-title">Make the image answer a mathematical question</h2>
          <p>{conceptDescription || `${conceptTitle} as an inspectable visual mechanism.`}</p>
        </div>
        <div className="readiness-card" aria-live="polite">
          <span>{readySections}/{sections.length || 4} stages ready</span>
          <strong>{hasVisualization ? 'Live demo connected' : 'Demo notes connected'}</strong>
        </div>
      </header>

      <div className="inquiry-grid">
        <div className="image-stage" role="img" aria-label={image?.alt ?? `${conceptTitle} visual mechanism field`}>
          <span className="image-field" />
          <span className="scan-line" />
          <span className="focus-ring" />
          <svg className="motion-layer" viewBox="0 0 640 380" aria-hidden="true">
            <path className="flow-shadow" d="M72 280 C172 104 264 310 356 174 S500 68 578 208" />
            <path className="flow-line" d="M72 280 C172 104 264 310 356 174 S500 68 578 208" />
            <g className="probe-grid">
              <circle cx="124" cy="258" r="10" />
              <circle cx="246" cy="180" r="8" />
              <circle cx="356" cy="174" r="12" />
              <circle cx="492" cy="126" r="8" />
              <circle cx="560" cy="214" r="10" />
            </g>
            <g className="symbol-marks">
              <path d="M118 92 h88" />
              <path d="M142 124 h128" />
              <path d="M416 284 c32-76 82-84 126-24" />
              <path d="M430 230 h104" />
            </g>
          </svg>
          <div className="lens-badge">
            <span>{activeLens.shortLabel}</span>
            <strong>{compact(activeLens.prompt, 68)}</strong>
          </div>
        </div>

        <div className="control-board">
          <div className="lens-grid" aria-label={`${conceptTitle} visual lenses`}>
            {visualLenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                className={lens.id === activeLens.id ? 'active' : ''}
                aria-pressed={lens.id === activeLens.id}
                onClick={() => chooseLens(lens.id)}
              >
                <span>{lens.shortLabel}</span>
                {lens.label}
              </button>
            ))}
          </div>

          <label className="depth-control">
            <span>Inspection depth</span>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={depth}
              onChange={(event) => setDepth(clampDepth(Number(event.target.value)))}
            />
            <strong>{depth}/4</strong>
          </label>

          <div className="prediction-panel">
            <span>Prediction</span>
            <h3>{activeLens.prompt}</h3>
            <div className="choice-grid" aria-label={`${conceptTitle} visual prediction choices`}>
              {predictionChoices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  className={choice.id === activePrediction.id ? 'active' : ''}
                  aria-pressed={choice.id === activePrediction.id}
                  onClick={() => {
                    setPredictionId(choice.id)
                    setRevealed(false)
                  }}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <button type="button" className="reveal-button" onClick={reveal}>
              Reveal visual check
            </button>
          </div>

          <div className={`check-panel ${revealed ? 'open' : ''}`} aria-live="polite">
            <span>{revealed ? 'Visual check' : 'Commit first'}</span>
            <p>
              {revealed
                ? revealCheck
                : `Pick the cue that should make ${conceptTitle} easier to reason about before the page gives the answer.`}
            </p>
          </div>
        </div>
      </div>

      <div className="image-strip" aria-label={`${conceptTitle} visual cue strip`}>
        {visualLenses.map((lens) => (
          <button
            key={lens.id}
            type="button"
            className={lens.id === activeLens.id ? 'active' : ''}
            aria-pressed={lens.id === activeLens.id}
            onClick={() => chooseLens(lens.id)}
            style={{ '--tile-crop': lens.crop } as CSSProperties}
          >
            <span className="tile-image" />
            <span className="tile-copy">
              <strong>{lens.label}</strong>
              <em>{lens.shortLabel}</em>
            </span>
          </button>
        ))}
      </div>

      <style jsx>{`
        .visual-inquiry {
          position: relative;
          overflow: hidden;
          display: grid;
          gap: 1rem;
          min-width: 0;
          padding: 1.1rem;
          border-radius: 22px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(135deg, rgba(255, 251, 245, 0.96), rgba(239, 247, 245, 0.9)),
            rgba(255, 251, 245, 0.9);
        }

        .inquiry-header,
        .inquiry-grid,
        .image-strip {
          position: relative;
          z-index: 1;
        }

        .inquiry-header {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(11rem, 15rem);
          gap: 1rem;
          align-items: start;
        }

        .heading-copy {
          display: grid;
          gap: 0.38rem;
          min-width: 0;
          max-width: 58rem;
        }

        .eyebrow,
        .readiness-card span,
        .lens-badge span,
        .depth-control span,
        .prediction-panel > span,
        .check-panel span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.7rem;
          text-transform: uppercase;
          letter-spacing: 0;
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

        .heading-copy p,
        .check-panel p {
          color: #52606b;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .readiness-card {
          display: grid;
          gap: 0.36rem;
          min-width: 0;
          padding: 0.84rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
        }

        .readiness-card strong {
          color: #17202a;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .inquiry-grid {
          display: grid;
          grid-template-columns: minmax(20rem, 1.08fr) minmax(19rem, 0.92fr);
          gap: 0.9rem;
          min-width: 0;
        }

        .image-stage,
        .control-board {
          min-width: 0;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.82);
        }

        .image-stage {
          position: relative;
          min-height: 25rem;
          overflow: hidden;
          isolation: isolate;
        }

        .image-field {
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(90deg, rgba(255, 251, 245, 0.82), rgba(255, 251, 245, 0.2) 48%, rgba(255, 251, 245, 0.82)),
            var(--concept-visual);
          background-size: cover;
          background-position: center;
          transform: scale(1.04);
          filter: saturate(0.96) contrast(0.96);
        }

        .image-stage::after {
          content: '';
          position: absolute;
          inset: 0;
          z-index: -1;
          background:
            linear-gradient(rgba(27, 36, 48, 0.052) 1px, transparent 1px),
            linear-gradient(90deg, rgba(27, 36, 48, 0.045) 1px, transparent 1px),
            radial-gradient(circle at var(--focus-x) var(--focus-y), rgba(255, 251, 245, 0.18), rgba(255, 251, 245, 0.76) 42%, rgba(255, 251, 245, 0.9));
          background-size: 32px 32px, 32px 32px, auto;
        }

        .scan-line {
          position: absolute;
          inset: 8% auto 8% var(--focus-x);
          width: 2px;
          background: linear-gradient(180deg, transparent, rgba(31, 111, 120, 0.55), transparent);
          transform: translateX(-50%);
          animation: visual-scan var(--scan-duration) ease-in-out infinite;
        }

        .focus-ring {
          position: absolute;
          left: var(--focus-x);
          top: var(--focus-y);
          width: var(--focus-size);
          height: var(--focus-size);
          border-radius: 999px;
          border: 2px solid rgba(194, 74, 45, 0.46);
          box-shadow:
            0 0 0 10px rgba(194, 74, 45, 0.08),
            0 0 42px rgba(31, 111, 120, 0.18);
          transform: translate(-50%, -50%);
          animation: visual-focus 2.2s ease-in-out infinite;
        }

        .motion-layer {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .flow-shadow,
        .flow-line,
        .symbol-marks path {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .flow-shadow {
          stroke: rgba(27, 36, 48, 0.14);
          stroke-width: 12;
        }

        .flow-line {
          stroke: #1f6f78;
          stroke-width: 5;
          stroke-dasharray: 64 260;
          animation: visual-flow 5.4s ease-in-out infinite;
        }

        .probe-grid circle {
          fill: rgba(255, 251, 245, 0.82);
          stroke: rgba(31, 75, 153, 0.34);
          stroke-width: 2;
        }

        .symbol-marks path {
          stroke: rgba(194, 74, 45, 0.34);
          stroke-width: 4;
          stroke-dasharray: 10 12;
        }

        .lens-badge {
          position: absolute;
          left: 0.85rem;
          bottom: 0.85rem;
          display: grid;
          gap: 0.25rem;
          max-width: min(24rem, calc(100% - 1.7rem));
          padding: 0.74rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.86);
          backdrop-filter: blur(8px);
        }

        .lens-badge strong {
          color: #17202a;
          line-height: 1.28;
          overflow-wrap: anywhere;
        }

        .control-board {
          display: grid;
          align-content: start;
          gap: 0.74rem;
          padding: 0.86rem;
        }

        .lens-grid,
        .choice-grid {
          display: grid;
          gap: 0.45rem;
          min-width: 0;
        }

        .lens-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .choice-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        button {
          min-width: 0;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #213040;
          font: inherit;
          cursor: pointer;
          transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
        }

        .lens-grid button {
          display: grid;
          gap: 0.2rem;
          min-height: 4.05rem;
          padding: 0.62rem;
          text-align: left;
          font-weight: 800;
          line-height: 1.14;
        }

        .lens-grid button span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          font-weight: 500;
          color: #65717c;
        }

        .choice-grid button {
          min-height: 2.8rem;
          padding: 0.58rem;
          font-weight: 800;
          line-height: 1.16;
        }

        button.active,
        .image-strip button.active {
          border-color: rgba(31, 111, 120, 0.34);
          background: rgba(239, 247, 245, 0.96);
        }

        button:hover {
          transform: translateY(-1px);
          border-color: rgba(31, 75, 153, 0.28);
        }

        button:focus-visible,
        input:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.28);
          outline-offset: 2px;
        }

        .depth-control {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(9rem, 1.4fr) auto;
          gap: 0.65rem;
          align-items: center;
          min-width: 0;
          padding: 0.7rem;
          border-radius: 8px;
          border: 1px solid rgba(31, 111, 120, 0.12);
          background: rgba(239, 247, 245, 0.72);
        }

        input[type='range'] {
          width: 100%;
          min-width: 0;
          accent-color: #1f6f78;
        }

        .depth-control strong {
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.82rem;
        }

        .prediction-panel,
        .check-panel {
          display: grid;
          gap: 0.62rem;
          min-width: 0;
          padding: 0.84rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.84);
        }

        .prediction-panel h3 {
          color: #17202a;
          font-size: 1rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .reveal-button {
          justify-self: start;
          min-height: 2.7rem;
          padding: 0.6rem 0.9rem;
          background: #1f6f78;
          color: #fffaf2;
          border-color: rgba(31, 111, 120, 0.6);
          font-weight: 850;
        }

        .check-panel {
          min-height: 6.2rem;
        }

        .check-panel.open {
          border-color: rgba(194, 74, 45, 0.22);
          background: rgba(255, 247, 236, 0.92);
        }

        .image-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
          min-width: 0;
        }

        .image-strip button {
          display: grid;
          grid-template-columns: 4.6rem minmax(0, 1fr);
          gap: 0.65rem;
          align-items: center;
          min-height: 5.1rem;
          padding: 0.48rem;
          text-align: left;
          background: rgba(255, 251, 245, 0.88);
        }

        .tile-image {
          display: block;
          height: 100%;
          min-height: 4rem;
          border-radius: 7px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(180deg, rgba(255, 251, 245, 0.18), rgba(255, 251, 245, 0.5)),
            var(--concept-visual);
          background-size: cover;
          background-position: var(--tile-crop);
        }

        .tile-copy {
          display: grid;
          gap: 0.16rem;
          min-width: 0;
        }

        .tile-copy strong {
          color: #17202a;
          overflow-wrap: anywhere;
        }

        .tile-copy em {
          color: #5a6874;
          font-style: normal;
          font-size: 0.82rem;
          line-height: 1.25;
          overflow-wrap: anywhere;
        }

        @keyframes visual-flow {
          0% {
            stroke-dashoffset: 280;
          }
          54% {
            stroke-dashoffset: 88;
          }
          100% {
            stroke-dashoffset: -120;
          }
        }

        @keyframes visual-scan {
          0%,
          100% {
            opacity: 0.18;
            transform: translateX(-54px);
          }
          50% {
            opacity: 0.8;
            transform: translateX(54px);
          }
        }

        @keyframes visual-focus {
          0%,
          100% {
            opacity: 0.74;
            transform: translate(-50%, -50%) scale(0.98);
          }
          50% {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1.05);
          }
        }

        @media (max-width: 980px) {
          .inquiry-header,
          .inquiry-grid {
            grid-template-columns: 1fr;
          }

          .image-stage {
            min-height: 21rem;
          }
        }

        @media (max-width: 760px) {
          .image-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .choice-grid,
          .depth-control {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .visual-inquiry {
            padding: 0.9rem;
          }

          .image-stage {
            min-height: 17rem;
          }

          .lens-grid,
          .image-strip {
            grid-template-columns: 1fr;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .scan-line,
          .focus-ring,
          .flow-line {
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
