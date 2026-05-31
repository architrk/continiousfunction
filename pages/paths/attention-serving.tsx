import Head from 'next/head'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import AttentionServingModule from '@/components/product/AttentionServingModule'

function AttentionServingHeroFigure() {
  const nodes = [
    { label: 'QK^T', x: '14%', y: '34%' },
    { label: 'KV cache', x: '36%', y: '58%' },
    { label: 'GQA', x: '57%', y: '30%' },
    { label: 'TPOT', x: '78%', y: '55%' },
  ]

  return (
    <div className="serving-hero-figure" aria-label="Attention to serving route diagram">
      <img
        className="serving-hero-image"
        src="/images/editorial/product-loop/kv-memory-lab.jpg"
        alt="A physical KV memory lab with attention heads feeding a smaller cache."
      />
      <div className="board">
        <span className="route primary" />
        <span className="route secondary" />
        {nodes.map((node, index) => (
          <article key={node.label} style={{ left: node.x, top: node.y }}>
            <span>{String(index + 1).padStart(2, '0')}</span>
            <strong>{node.label}</strong>
          </article>
        ))}
        <div className="memory-meter">
          <span>decode memory</span>
          <strong>Mem_KV</strong>
          <em>B * L * T * H_kv * d * 2</em>
        </div>
      </div>

      <style jsx>{`
        .serving-hero-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          overflow: hidden;
          background:
            radial-gradient(circle at 22% 26%, rgba(31, 111, 120, 0.16), transparent 30%),
            radial-gradient(circle at 78% 68%, rgba(194, 74, 45, 0.12), transparent 34%),
            linear-gradient(180deg, rgba(255, 251, 245, 0.92), rgba(239, 232, 219, 0.94));
        }

        .serving-hero-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          opacity: 0.48;
          filter: saturate(0.95) contrast(0.95);
        }

        .board {
          position: relative;
          width: min(86%, 590px);
          aspect-ratio: 16 / 11;
          margin: clamp(2.8rem, 7vw, 4.8rem) auto;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            rgba(255, 251, 245, 0.68);
          background-size: 32px 32px;
          box-shadow: 0 20px 46px rgba(7, 15, 25, 0.08);
        }

        .route {
          position: absolute;
          inset: auto;
          border-radius: 999px;
          pointer-events: none;
        }

        .route.primary {
          left: 15%;
          right: 14%;
          top: 47%;
          height: 3px;
          background: linear-gradient(90deg, rgba(31, 75, 153, 0.22), rgba(31, 111, 120, 0.34), rgba(194, 74, 45, 0.26));
          transform: rotate(8deg);
        }

        .route.secondary {
          left: 25%;
          top: 21%;
          width: 52%;
          height: 54%;
          border-top: 2px dashed rgba(194, 74, 45, 0.22);
          border-right: 2px solid rgba(31, 111, 120, 0.18);
          transform: rotate(-7deg);
        }

        article,
        .memory-meter {
          position: absolute;
          z-index: 2;
          display: grid;
          gap: 0.35rem;
          min-width: 124px;
          padding: 0.82rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.92);
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.08);
          transform: translate(-50%, -50%);
        }

        article span,
        .memory-meter span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.66rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
        }

        article strong,
        .memory-meter strong {
          color: #17202a;
          font-family: var(--font-display);
          font-size: clamp(1.2rem, 2vw, 1.55rem);
          line-height: 1.04;
        }

        .memory-meter {
          right: 7%;
          bottom: 8%;
          width: min(44%, 230px);
          transform: none;
          border-color: rgba(31, 111, 120, 0.16);
          background: rgba(239, 247, 245, 0.86);
        }

        .memory-meter em {
          color: #52606b;
          font-style: normal;
          line-height: 1.3;
        }

        @media (max-width: 720px) {
          .serving-hero-figure {
            min-height: 440px;
          }

          .board {
            width: 92%;
            min-height: 350px;
            aspect-ratio: auto;
            margin: 2.2rem auto;
          }

          article {
            min-width: 110px;
            padding: 0.72rem;
          }

          .memory-meter {
            left: 8%;
            right: 8%;
            bottom: 7%;
            width: auto;
          }
        }
      `}</style>
    </div>
  )
}

export default function AttentionServingPathPage() {
  return (
    <>
      <Head>
        <title>Attention to Serving Module — Continuous Function</title>
        <meta
          name="description"
          content="A flagship Continuous Function module connecting attention math, KV cache memory, GQA/MQA, FlashAttention, long context, serving latency, and decoding controls."
        />
      </Head>

      <NotebookLayout
        eyebrow="Study Module"
        title="Attention to serving, end to end"
        lede="Move from the attention equation to KV cache memory, GQA/MQA tradeoffs, FlashAttention's memory schedule, long-context pressure, serving latency, and decoding behavior in one connected workspace."
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Paths' },
          { label: 'Attention Serving' },
        ]}
        meta={['interactive path', 'KV calculator', 'carried equations', 'questions to carry']}
        actions={[
          { href: '/paper-map/', label: 'Map a Paper' },
          { href: '/domains/attention-transformers/attention-transformers/', label: 'Start at Attention', variant: 'secondary' },
        ]}
        heroVisual={<AttentionServingHeroFigure />}
      >
        <AttentionServingModule />
      </NotebookLayout>
    </>
  )
}
