import Link from 'next/link'

export type DomainAtlasItem = {
  name: string
  color: string
  motif: string
  href: string
}

type Props = {
  items: DomainAtlasItem[]
}

export default function DomainAtlasGrid({ items }: Props) {
  return (
    <div className="atlas-grid">
      {items.map((item) => (
        <Link key={item.name} href={item.href} className="atlas-card">
          <span className="atlas-swatch" style={{ background: item.color }} />
          <div className="atlas-card-copy">
            <h3>{item.name}</h3>
            <p>{item.motif}</p>
          </div>
        </Link>
      ))}

      <style jsx>{`
        .atlas-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 1rem;
        }

        .atlas-card {
          display: flex;
          gap: 0.9rem;
          align-items: start;
          padding: 1rem;
          border-radius: 20px;
          background: rgba(255, 251, 245, 0.78);
          border: 1px solid rgba(27, 36, 48, 0.08);
          color: inherit;
          text-decoration: none;
          transition: transform 0.2s ease;
        }

        .atlas-card:hover {
          transform: translateY(-2px);
          text-shadow: none;
        }

        .atlas-swatch {
          width: 14px;
          height: 14px;
          margin-top: 0.28rem;
          border-radius: 999px;
          flex: 0 0 auto;
        }

        .atlas-card-copy h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.05rem;
          color: #151d27;
          letter-spacing: -0.02em;
        }

        .atlas-card-copy p {
          margin: 0.3rem 0 0;
          color: #5a6774;
          font-size: 0.92rem;
        }

        @media (max-width: 1080px) {
          .atlas-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 720px) {
          .atlas-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
