export default function ResearchHeroFigure() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <svg viewBox="0 0 560 420" className="hero-svg">
        <defs>
          <linearGradient id="curveA" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1f4b99" />
            <stop offset="50%" stopColor="#1f6f78" />
            <stop offset="100%" stopColor="#c24a2d" />
          </linearGradient>
          <linearGradient id="curveB" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c8a96b" />
            <stop offset="100%" stopColor="#1b2430" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="560" height="420" rx="28" className="paper-panel" />

        <g className="grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <line key={`vx-${i}`} x1={36 + i * 40} y1="30" x2={36 + i * 40} y2="390" />
          ))}
          {Array.from({ length: 8 }).map((_, i) => (
            <line key={`hx-${i}`} x1="36" y1={40 + i * 42} x2="524" y2={40 + i * 42} />
          ))}
        </g>

        <path
          d="M 42 310 C 112 220, 156 132, 220 148 S 342 322, 418 246 S 496 112, 518 124"
          className="curve-main"
        />
        <path
          d="M 52 342 C 134 286, 206 242, 274 266 S 398 350, 514 290"
          className="curve-secondary"
        />

        <g className="nodes">
          {[
            ['vectors', 118, 182],
            ['derivatives', 198, 144],
            ['diffusion', 304, 232],
            ['attention', 394, 286],
            ['sae', 462, 178],
          ].map(([label, x, y]) => (
            <g key={label} transform={`translate(${x} ${y})`}>
              <circle r="10" className="node-dot" />
              <text y="-18">{label}</text>
            </g>
          ))}
        </g>
      </svg>

      <style jsx>{`
        .hero-visual {
          min-height: 420px;
        }

        .hero-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .paper-panel {
          fill: rgba(248, 243, 234, 0.98);
          stroke: rgba(27, 36, 48, 0.08);
        }

        .grid line {
          stroke: rgba(27, 36, 48, 0.09);
          stroke-width: 1;
        }

        .curve-main {
          fill: none;
          stroke: url(#curveA);
          stroke-width: 5;
          stroke-linecap: round;
        }

        .curve-secondary {
          fill: none;
          stroke: url(#curveB);
          stroke-width: 3;
          stroke-linecap: round;
          opacity: 0.9;
        }

        .nodes text {
          font-size: 12px;
          font-family: var(--font-mono);
          fill: #334155;
        }

        .node-dot {
          fill: #f8f3ea;
          stroke: #1f4b99;
          stroke-width: 3;
        }
      `}</style>
    </div>
  )
}
