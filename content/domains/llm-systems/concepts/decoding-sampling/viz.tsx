import dynamic from 'next/dynamic'

const DecodingSamplingViz = dynamic(() => import('../../../../../components/foundations/DecodingSamplingViz'), {
  ssr: false,
})

export default function DecodingSamplingDemo() {
  return (
    <div className="wrap">
      <div className="panel">
        <DecodingSamplingViz />
      </div>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .panel {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.75rem;
        }
      `}</style>
    </div>
  )
}

