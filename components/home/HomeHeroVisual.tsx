type Stat = {
  value: string
  label: string
}

type Props = {
  stats: Stat[]
  stages: string[]
}

export default function HomeHeroVisual({ stats, stages }: Props) {
  return (
    <div className="hero-scene" aria-hidden="true">
      <svg viewBox="0 0 620 430" className="hero-svg">
        <defs>
          <linearGradient id="atlasCurve" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0f766e" />
            <stop offset="35%" stopColor="#3b82f6" />
            <stop offset="70%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
          <linearGradient id="atlasGlow" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgba(15, 118, 110, 0.12)" />
            <stop offset="100%" stopColor="rgba(99, 102, 241, 0.18)" />
          </linearGradient>
        </defs>

        <rect x="18" y="16" width="584" height="398" rx="30" className="paper" />
        <rect x="46" y="48" width="224" height="128" rx="22" className="panel warm" />
        <rect x="306" y="58" width="258" height="110" rx="22" className="panel cool" />
        <rect x="74" y="228" width="196" height="122" rx="22" className="panel neutral" />
        <rect x="332" y="220" width="204" height="136" rx="22" className="panel warm" />

        <g className="grid">
          {Array.from({ length: 11 }).map((_, index) => (
            <line key={`vertical-${index}`} x1={54 + index * 46} y1="36" x2={54 + index * 46} y2="390" />
          ))}
          {Array.from({ length: 8 }).map((_, index) => (
            <line key={`horizontal-${index}`} x1="36" y1={44 + index * 44} x2="586" y2={44 + index * 44} />
          ))}
        </g>

        <path
          d="M 62 300 C 126 216, 178 132, 248 156 S 356 332, 430 250 S 534 112, 568 126"
          className="curve-main"
        />
        <path
          d="M 88 336 C 162 280, 228 244, 296 268 S 424 344, 548 292"
          className="curve-secondary"
        />

        <g className="anchors">
          {[
            ['vectors', 120, 216],
            ['gradients', 198, 150],
            ['attention', 330, 250],
            ['features', 454, 170],
            ['systems', 516, 286],
          ].map(([label, x, y]) => (
            <g key={label} transform={`translate(${x} ${y})`}>
              <circle r="10" className="anchor-dot" />
              <text y="-18">{label}</text>
            </g>
          ))}
        </g>

        <g className="chart">
          <polyline
            points="344,116 380,100 418,92 452,86 490,82 530,80"
            className="chart-line"
          />
          <line x1="340" y1="126" x2="540" y2="126" className="axis" />
          <line x1="340" y1="126" x2="340" y2="74" className="axis" />
        </g>

        <g className="code-block">
          <text x="98" y="264">q @ k.T</text>
          <text x="98" y="286">softmax(...)</text>
          <text x="98" y="308">weights @ values</text>
        </g>

        <g className="notation">
          <text x="362" y="262">x̂ = Wz</text>
          <text x="362" y="292">L = ||x - x̂||²</text>
          <text x="362" y="322">z = TopK(...)</text>
        </g>
      </svg>

      <div className="stat-strip">
        {stats.map((stat) => (
          <div key={stat.label} className="stat-card">
            <span className="stat-value">{stat.value}</span>
            <span className="stat-label">{stat.label}</span>
          </div>
        ))}
      </div>

      <div className="stage-strip">
        {stages.map((stage, index) => (
          <div key={stage} className="stage-chip">
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{stage}</strong>
          </div>
        ))}
      </div>

      <style jsx>{`
        .hero-scene {
          position: relative;
          min-height: 100%;
          padding: 1.2rem;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.14), transparent 32%),
            radial-gradient(circle at bottom right, rgba(99, 102, 241, 0.18), transparent 36%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.95), rgba(247, 241, 232, 0.98));
        }

        .hero-svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .paper {
          fill: rgba(250, 245, 236, 0.96);
          stroke: rgba(27, 36, 48, 0.08);
        }

        .panel {
          stroke: rgba(27, 36, 48, 0.08);
        }

        .panel.warm {
          fill: rgba(248, 203, 110, 0.12);
        }

        .panel.cool {
          fill: rgba(99, 102, 241, 0.1);
        }

        .panel.neutral {
          fill: rgba(15, 118, 110, 0.08);
        }

        .grid line {
          stroke: rgba(27, 36, 48, 0.07);
          stroke-width: 1;
        }

        .curve-main {
          fill: none;
          stroke: url(#atlasCurve);
          stroke-width: 5;
          stroke-linecap: round;
        }

        .curve-secondary {
          fill: none;
          stroke: rgba(27, 36, 48, 0.35);
          stroke-width: 3;
          stroke-linecap: round;
        }

        .anchor-dot {
          fill: #1b2430;
          stroke: rgba(255, 255, 255, 0.9);
          stroke-width: 3;
        }

        .anchors text,
        .code-block text,
        .notation text {
          fill: #334155;
          font-family: var(--font-mono);
          font-size: 12px;
        }

        .chart-line {
          fill: none;
          stroke: #0f766e;
          stroke-width: 3;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .axis {
          stroke: rgba(27, 36, 48, 0.28);
          stroke-width: 1.4;
        }

        .stat-strip {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.8rem;
          margin-top: -1rem;
          position: relative;
          z-index: 2;
        }

        .stat-card {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.8rem 0.9rem;
          border-radius: 18px;
          background: rgba(255, 251, 245, 0.94);
          border: 1px solid rgba(27, 36, 48, 0.1);
          box-shadow: 0 16px 24px rgba(27, 36, 48, 0.08);
        }

        .stat-value {
          font-family: var(--font-display);
          font-size: 1.65rem;
          line-height: 1;
          color: #151d27;
        }

        .stat-label {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #5b6874;
        }

        .stage-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.7rem;
          margin-top: 0.9rem;
        }

        .stage-chip {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.8rem;
          padding: 0.8rem 0.95rem;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.88);
          color: #f8f3ea;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          letter-spacing: 0.05em;
        }

        .stage-chip strong {
          font-family: var(--font-body);
          font-size: 0.9rem;
          letter-spacing: 0;
        }

        @media (max-width: 720px) {
          .hero-scene {
            padding: 1rem;
          }

          .stat-strip,
          .stage-strip {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
