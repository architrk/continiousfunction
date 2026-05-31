import Link from 'next/link'

export type BreadcrumbItem = {
  label: string
  href?: string
}

type Props = {
  items: BreadcrumbItem[]
}

export default function Breadcrumbs({ items }: Props) {
  if (!items.length) return null

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={`${item.label}-${index}`} className="crumb">
            {item.href && !isLast ? (
              <Link href={item.href} className="crumb-link">
                {item.label}
              </Link>
            ) : (
              <span className="crumb-current">{item.label}</span>
            )}
            {!isLast ? <span className="crumb-sep">/</span> : null}
          </span>
        )
      })}

      <style jsx>{`
        .breadcrumbs {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          min-width: 0;
          max-width: 100%;
          gap: 0.4rem;
          margin-bottom: 1rem;
          font-family: var(--font-mono);
          font-size: 0.76rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #5b6874;
        }

        .crumb {
          display: inline-flex;
          align-items: center;
          min-width: 0;
          gap: 0.4rem;
        }

        .crumb-link {
          color: #1f6f78;
          text-decoration: none;
          overflow-wrap: anywhere;
        }

        .crumb-link:hover {
          color: #1b2430;
          text-shadow: none;
        }

        .crumb-current {
          color: #1b2430;
          overflow-wrap: anywhere;
        }

        .crumb-sep {
          color: rgba(27, 36, 48, 0.35);
        }
      `}</style>
    </nav>
  )
}
