import type { ReactNode } from 'react'

type Props = {
  children: ReactNode
  padded?: boolean
  tone?: 'default' | 'warm' | 'cool'
  className?: string
}

export default function PaperPanel({
  children,
  padded = true,
  tone = 'default',
  className = '',
}: Props) {
  return (
    <div className={`paper-panel ${tone} ${padded ? 'padded' : ''} ${className}`.trim()}>
      {children}

      <style jsx>{`
        .paper-panel {
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          box-shadow: 0 18px 42px rgba(5, 12, 20, 0.06);
        }

        .paper-panel.padded {
          padding: 1.25rem;
        }

        .paper-panel.default {
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.08), transparent 34%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.06), transparent 34%),
            rgba(248, 243, 234, 0.92);
        }

        .paper-panel.warm {
          background:
            radial-gradient(circle at top left, rgba(200, 169, 107, 0.12), transparent 36%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.05), transparent 32%),
            rgba(246, 239, 227, 0.92);
        }

        .paper-panel.cool {
          background:
            radial-gradient(circle at top left, rgba(31, 111, 120, 0.1), transparent 34%),
            radial-gradient(circle at bottom right, rgba(31, 75, 153, 0.08), transparent 34%),
            rgba(245, 248, 247, 0.92);
        }

        @media (max-width: 720px) {
          .paper-panel {
            border-radius: 18px;
          }

          .paper-panel.padded {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  )
}
