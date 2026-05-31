export type SurfaceBackplateVariant = 'atlas' | 'companion' | 'demo' | 'path' | 'assessment'

type Props = {
  variant?: SurfaceBackplateVariant
  density?: 'quiet' | 'standard'
}

export default function SurfaceBackplate({ variant = 'atlas', density = 'standard' }: Props) {
  return (
    <span className={`surface-backplate ${variant} ${density}`} aria-hidden="true">
      <svg viewBox="0 0 420 260" focusable="false">
        <path className="route route-primary" d="M26 208 C84 154 126 148 178 178 S274 220 386 82" />
        <path className="route route-secondary" d="M42 70 C108 118 142 110 198 74 S288 32 376 126" />
        <path className="route route-tertiary" d="M74 230 C134 206 152 128 218 126 S298 150 352 44" />
        <g className="nodes">
          <circle cx="42" cy="70" r="5" />
          <circle cx="116" cy="156" r="4" />
          <circle cx="178" cy="178" r="7" />
          <circle cx="218" cy="126" r="5" />
          <circle cx="286" cy="198" r="4" />
          <circle cx="352" cy="44" r="6" />
          <circle cx="386" cy="82" r="5" />
        </g>
        <g className="tiles">
          <rect x="70" y="28" width="42" height="24" rx="4" />
          <rect x="228" y="36" width="50" height="28" rx="4" />
          <rect x="310" y="152" width="58" height="30" rx="4" />
          <rect x="118" y="208" width="46" height="26" rx="4" />
        </g>
      </svg>
      <span className="measure-lines" />

      <style jsx>{`
        .surface-backplate {
          --accent-a: #1f6f78;
          --accent-b: #1f4b99;
          --accent-c: #c24a2d;
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          border-radius: inherit;
          opacity: 0.6;
          z-index: 0;
        }

        .surface-backplate.quiet {
          opacity: 0.38;
        }

        .surface-backplate::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            repeating-linear-gradient(0deg, rgba(27, 36, 48, 0.045) 0 1px, transparent 1px 34px),
            repeating-linear-gradient(90deg, rgba(27, 36, 48, 0.035) 0 1px, transparent 1px 34px),
            linear-gradient(135deg, color-mix(in srgb, var(--accent-a) 9%, transparent), transparent 36%),
            linear-gradient(315deg, color-mix(in srgb, var(--accent-c) 9%, transparent), transparent 42%);
        }

        .atlas {
          --accent-a: #1f4b99;
          --accent-b: #1f6f78;
          --accent-c: #c24a2d;
        }

        .companion {
          --accent-a: #1f6f78;
          --accent-b: #0f766e;
          --accent-c: #8b5e34;
        }

        .demo {
          --accent-a: #8b5e34;
          --accent-b: #1f4b99;
          --accent-c: #1f6f78;
        }

        .path {
          --accent-a: #1f4b99;
          --accent-b: #c24a2d;
          --accent-c: #1f6f78;
        }

        .assessment {
          --accent-a: #c24a2d;
          --accent-b: #1f6f78;
          --accent-c: #8b5e34;
        }

        svg {
          position: absolute;
          right: -5%;
          bottom: -12%;
          width: min(72%, 560px);
          min-width: 340px;
          height: auto;
        }

        .route {
          fill: none;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .route-primary {
          stroke: var(--accent-a);
          stroke-width: 3.4;
          opacity: 0.38;
        }

        .route-secondary {
          stroke: var(--accent-b);
          stroke-width: 2.4;
          opacity: 0.24;
          stroke-dasharray: 10 10;
        }

        .route-tertiary {
          stroke: var(--accent-c);
          stroke-width: 2;
          opacity: 0.2;
        }

        .nodes circle {
          fill: rgba(255, 251, 245, 0.86);
          stroke: var(--accent-a);
          stroke-width: 2;
          opacity: 0.58;
        }

        .tiles rect {
          fill: rgba(255, 251, 245, 0.42);
          stroke: color-mix(in srgb, var(--accent-b) 36%, transparent);
          stroke-width: 1.4;
        }

        .measure-lines {
          position: absolute;
          left: 6%;
          top: 12%;
          width: 38%;
          height: 48%;
          border-top: 1px solid color-mix(in srgb, var(--accent-a) 24%, transparent);
          border-left: 1px solid color-mix(in srgb, var(--accent-b) 22%, transparent);
          transform: skewY(-5deg);
        }

        .measure-lines::before,
        .measure-lines::after {
          content: '';
          position: absolute;
          left: 0;
          right: 18%;
          height: 1px;
          background: color-mix(in srgb, var(--accent-c) 18%, transparent);
        }

        .measure-lines::before {
          top: 34%;
        }

        .measure-lines::after {
          top: 68%;
        }

        @media (max-width: 720px) {
          svg {
            right: -32%;
            bottom: -14%;
            width: 120%;
            min-width: 0;
          }

          .measure-lines {
            width: 54%;
            height: 40%;
          }
        }
      `}</style>
    </span>
  )
}
