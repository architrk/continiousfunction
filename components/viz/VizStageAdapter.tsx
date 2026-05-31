import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  className?: string
  padding?: 'none' | 'compact' | 'normal'
  overflowX?: boolean
  ariaLabel?: string
}

export default function VizStageAdapter({
  children,
  className = '',
  padding = 'compact',
  overflowX = false,
  ariaLabel,
}: Props) {
  const classNames = [
    'viz-stage-adapter',
    `pad-${padding}`,
    overflowX ? 'overflow-x' : '',
    className,
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classNames}
      role={overflowX ? 'region' : undefined}
      aria-label={overflowX ? ariaLabel ?? 'Scrollable visualization stage' : undefined}
      tabIndex={overflowX ? 0 : undefined}
    >
      {children}

      <style jsx>{`
        .viz-stage-adapter {
          min-width: 0;
          color: #17202a;
          overflow-wrap: anywhere;
        }

        .pad-none {
          padding: 0;
        }

        .pad-compact {
          padding: 0.85rem;
        }

        .pad-normal {
          padding: 1rem;
        }

        .overflow-x {
          max-width: 100%;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
        }

        @media (max-width: 640px) {
          .pad-compact,
          .pad-normal {
            padding: 0.7rem;
          }
        }
      `}</style>
    </div>
  )
}
