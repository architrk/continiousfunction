type Direction = {
  title: string
  role: string
  image: string
  alt: string
  implementation: string
}

type Props = {
  directions: Direction[]
}

export default function ImageDirectionGallery({ directions }: Props) {
  return (
    <div className="direction-gallery">
      {directions.map((direction) => (
        <figure key={direction.image} className="direction-card">
          <img src={direction.image} alt={direction.alt} loading="lazy" />
          <figcaption>
            <span>{direction.role}</span>
            <h3>{direction.title}</h3>
            <p>{direction.implementation}</p>
          </figcaption>
        </figure>
      ))}

      <style jsx>{`
        .direction-gallery {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.9rem;
        }

        .direction-card {
          margin: 0;
          overflow: hidden;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.86);
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.08);
        }

        .direction-card img {
          display: block;
          width: 100%;
          aspect-ratio: 16 / 9;
          object-fit: cover;
          background: #f8f3ea;
        }

        .direction-card:first-child img {
          aspect-ratio: 1 / 1;
        }

        figcaption {
          display: grid;
          gap: 0.45rem;
          padding: 0.9rem;
        }

        span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h3 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.08rem;
          line-height: 1.15;
          color: #151d27;
          letter-spacing: 0;
        }

        p {
          margin: 0;
          color: #4c5967;
          line-height: 1.55;
        }

        @media (max-width: 900px) {
          .direction-gallery {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
