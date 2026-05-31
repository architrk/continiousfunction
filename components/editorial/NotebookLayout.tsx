import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'
import Breadcrumbs, { type BreadcrumbItem } from '../site/Breadcrumbs'

type Action = {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
}

type Props = {
  eyebrow?: string
  title: string
  lede?: string
  breadcrumb?: BreadcrumbItem[]
  meta?: string[]
  actions?: Action[]
  heroVisual?: ReactNode
  ambientImage?: string
  preHero?: ReactNode
  rail?: ReactNode
  children: ReactNode
}

export default function NotebookLayout({
  eyebrow,
  title,
  lede,
  breadcrumb = [],
  meta = [],
  actions = [],
  heroVisual,
  ambientImage,
  preHero,
  rail,
  children,
}: Props) {
  const titleClass = title.length > 44 ? 'long-title' : ''
  const pageClass = `notebook-page ${titleClass} ${ambientImage ? 'has-ambient-image' : ''}`.trim()
  const pageStyle = ambientImage
    ? ({ '--ambient-image': `url("${ambientImage}")` } as CSSProperties)
    : undefined

  return (
    <div className={pageClass} style={pageStyle}>
      {preHero ? <div className="pre-hero">{preHero}</div> : null}

      <section className="notebook-hero">
        <div className="hero-copy">
          <Breadcrumbs items={breadcrumb} />
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1>{title}</h1>
          {lede ? <p className="lede">{lede}</p> : null}

          {meta.length ? (
            <div className="meta-row">
              {meta.map((item) => (
                <span key={item} className="meta-chip">{item}</span>
              ))}
            </div>
          ) : null}

          {actions.length ? (
            <div className="action-row">
              {actions.map((action) => (
                <Link
                  key={`${action.href}-${action.label}`}
                  href={action.href}
                  className={`cta ${action.variant === 'secondary' ? 'secondary' : 'primary'}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>

        {heroVisual ? <div className="hero-visual">{heroVisual}</div> : null}
      </section>

      <section className={`notebook-body ${rail ? 'with-rail' : ''}`}>
        <div className="body-main">{children}</div>
        {rail ? <aside className="body-rail">{rail}</aside> : null}
      </section>

      <style jsx>{`
        .notebook-page {
          position: relative;
          isolation: isolate;
          min-width: 0;
          margin: -0.8rem -0.8rem 0;
          padding: clamp(1.1rem, 2.2vw, 2rem);
          overflow: hidden;
          border-radius: 34px;
          color: #1b2430;
        }

        .notebook-page::before {
          content: '';
          position: absolute;
          z-index: -2;
          inset: 0 -3rem auto;
          height: min(88vh, 860px);
          background:
            linear-gradient(90deg, rgba(5, 12, 20, 0.92), rgba(8, 20, 32, 0.62) 46%, rgba(24, 21, 31, 0.84)),
            linear-gradient(180deg, rgba(5, 12, 20, 0.76), rgba(247, 242, 233, 0.78) 88%),
            var(--ambient-image);
          background-size: cover;
          background-position: center;
          opacity: 0.12;
          transform: scale(1.04);
          filter: saturate(0.82) contrast(0.9) blur(1px);
          pointer-events: none;
        }

        .notebook-page.has-ambient-image::before {
          opacity: 0.06;
        }

        .notebook-page::after {
          content: '';
          position: absolute;
          z-index: -1;
          inset: 0;
          background:
            linear-gradient(rgba(95, 165, 185, 0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(95, 165, 185, 0.06) 1px, transparent 1px),
            radial-gradient(ellipse at 78% 8%, rgba(45, 212, 191, 0.14), transparent 32%),
            radial-gradient(ellipse at 12% 16%, rgba(167, 139, 250, 0.1), transparent 30%),
            linear-gradient(180deg, rgba(5, 12, 20, 0.06), rgba(239, 232, 219, 0.9) 48%);
          background-size: 32px 32px, 32px 32px, auto, auto;
          pointer-events: none;
        }

        .notebook-hero {
          position: relative;
          overflow: hidden;
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
          gap: 1.5rem;
          align-items: center;
          margin-bottom: 1.4rem;
          min-height: min(560px, calc(100vh - 210px));
          min-width: 0;
          padding: clamp(1rem, 2vw, 1.35rem);
          border-radius: 28px;
          border: 1px solid rgba(139, 198, 191, 0.18);
          background:
            linear-gradient(rgba(95, 165, 185, 0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(95, 165, 185, 0.07) 1px, transparent 1px),
            radial-gradient(circle at 16% 18%, rgba(45, 212, 191, 0.18), transparent 28%),
            radial-gradient(circle at 82% 12%, rgba(167, 139, 250, 0.2), transparent 30%),
            radial-gradient(circle at 72% 92%, rgba(245, 158, 11, 0.12), transparent 28%),
            linear-gradient(135deg, #07111d 0%, #101827 52%, #18151f 100%);
          background-size: 34px 34px, 34px 34px, auto, auto, auto, auto;
          box-shadow:
            0 28px 72px rgba(5, 12, 20, 0.18),
            inset 0 1px 0 rgba(255, 255, 255, 0.08);
        }

        .notebook-hero::before {
          content: '';
          position: absolute;
          inset: 1rem;
          border: 1px solid rgba(248, 243, 234, 0.06);
          border-radius: 20px;
          pointer-events: none;
        }

        .pre-hero {
          max-width: 1120px;
          margin: 0 auto 1rem;
        }

        .body-main,
        .body-rail {
          min-width: 0;
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.1), transparent 34%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.08), transparent 36%),
            rgba(248, 243, 234, 0.93);
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 28px;
          box-shadow: 0 20px 50px rgba(5, 12, 20, 0.08);
        }

        .hero-copy {
          position: relative;
          z-index: 1;
          min-width: 0;
          padding: clamp(1rem, 3vw, 2.4rem) clamp(0.4rem, 1.3vw, 1rem) clamp(1rem, 3vw, 2.2rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .hero-visual {
          position: relative;
          z-index: 1;
          min-width: 0;
          min-height: min(500px, calc(100vh - 260px));
          overflow: hidden;
          border-radius: 28px;
          border: 1px solid rgba(248, 243, 234, 0.18);
          background:
            linear-gradient(rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 30% 18%, rgba(45, 212, 191, 0.16), transparent 30%),
            rgba(5, 12, 20, 0.72);
          background-size: 30px 30px, 30px 30px, auto, auto;
          box-shadow:
            0 24px 58px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(8px) saturate(118%);
        }

        .notebook-page .hero-copy .eyebrow {
          margin: 0 0 0.8rem;
          font-family: var(--font-mono);
          letter-spacing: 0.14em;
          text-transform: uppercase;
          font-size: 0.74rem;
          color: #7dd3fc;
        }

        .hero-copy :global(.breadcrumbs) {
          color: rgba(248, 243, 234, 0.54);
        }

        .hero-copy :global(.crumb-link) {
          color: #7dd3fc;
        }

        .hero-copy :global(.crumb-current) {
          color: rgba(248, 243, 234, 0.78);
        }

        .hero-copy :global(.crumb-sep) {
          color: rgba(248, 243, 234, 0.28);
        }

        .notebook-page .hero-copy h1 {
          margin: 0;
          font-family: var(--font-display);
          font-size: clamp(2.2rem, 4.3vw, 3.65rem);
          line-height: 0.98;
          letter-spacing: 0;
          color: #fff8ed;
          text-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
          overflow-wrap: break-word;
        }

        .notebook-page.long-title .hero-copy h1 {
          font-size: clamp(1.78rem, 3.35vw, 3.05rem);
          line-height: 1.02;
        }

        .notebook-page .hero-copy h1::after {
          content: none;
          display: none;
        }

        .notebook-page .hero-copy .lede {
          margin: 1rem 0 0;
          max-width: 58ch;
          color: rgba(248, 243, 234, 0.74);
          font-size: 1rem;
          line-height: 1.75;
          overflow-wrap: anywhere;
        }

        .notebook-page .hero-copy .meta-row {
          margin-top: 1.2rem;
          display: flex;
          flex-wrap: wrap;
          min-width: 0;
          gap: 0.6rem;
        }

        .notebook-page .hero-copy .meta-chip {
          display: inline-flex;
          align-items: center;
          min-height: 34px;
          padding: 0.45rem 0.75rem;
          border-radius: 999px;
          background: rgba(45, 212, 191, 0.08);
          border: 1px solid rgba(45, 212, 191, 0.18);
          font-size: 0.79rem;
          font-family: var(--font-mono);
          color: #d9f4ee;
          max-width: 100%;
          overflow-wrap: anywhere;
        }

        .notebook-page .hero-copy .action-row {
          margin-top: 1.3rem;
          display: flex;
          flex-wrap: wrap;
          min-width: 0;
          gap: 0.85rem;
        }

        .notebook-page .hero-copy .action-row :global(.cta) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 46px;
          max-width: 100%;
          padding: 0.78rem 1.08rem;
          border-radius: 999px;
          font-weight: 600;
          line-height: 1.3;
          text-align: center;
          text-decoration: none;
          white-space: normal;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }

        .notebook-page .hero-copy .action-row :global(.cta.primary) {
          background: #f8d16d;
          color: #07111d;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.24);
        }

        .notebook-page .hero-copy .action-row :global(.cta.secondary) {
          color: #f8f3ea;
          background: rgba(248, 243, 234, 0.08);
          border: 1px solid rgba(248, 243, 234, 0.18);
        }

        .notebook-page .hero-copy .action-row :global(.cta:hover) {
          transform: translateY(-2px);
          text-shadow: none;
        }

        .notebook-body {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
          min-width: 0;
        }

        .notebook-body.with-rail {
          grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
          align-items: start;
        }

        .body-main {
          padding: 1.7rem;
        }

        .body-rail {
          padding: 1.3rem;
          position: sticky;
          top: 88px;
        }

        @media (max-width: 1080px) {
          .notebook-hero,
          .notebook-body.with-rail {
            grid-template-columns: 1fr;
          }

          .notebook-hero {
            min-height: auto;
          }

          .hero-visual {
            min-height: auto;
          }

          .body-rail {
            position: static;
          }
        }

        @media (max-width: 720px) {
          .notebook-hero {
            width: 100%;
            max-width: 100%;
            gap: 1rem;
            margin-bottom: 1rem;
            padding: 0.8rem;
            overflow: hidden;
          }

          .body-main,
          .body-rail {
            padding: 1.2rem;
            border-radius: 20px;
          }

          .hero-visual {
            border-radius: 20px;
          }

          .notebook-page {
            margin: 0;
            padding: 0;
            border-radius: 0;
            overflow: hidden;
          }

          .pre-hero {
            margin: 0 0 0.8rem;
          }

          .hero-copy {
            padding: 0.85rem 0 0.25rem;
            width: 100%;
            max-width: 100%;
            min-width: 0;
            overflow: visible;
          }

          .notebook-page .hero-copy .lede {
            margin-top: 0.75rem;
            font-size: 0.94rem;
            line-height: 1.56;
          }

          .notebook-page .hero-copy .meta-row {
            margin-top: 0.9rem;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            width: 100%;
            max-width: 100%;
            gap: 0.5rem;
          }

          .notebook-page .hero-copy .meta-chip {
            justify-content: center;
            min-height: 32px;
            min-width: 0;
            width: 100%;
            padding-inline: 0.55rem;
            font-size: 0.72rem;
          }

          .notebook-page .hero-copy .action-row {
            margin-top: 0.9rem;
            display: grid;
            grid-template-columns: 1fr;
            width: 100%;
            gap: 0.6rem;
          }

          .notebook-page .hero-copy .action-row :global(.cta) {
            width: 100%;
            min-height: 40px;
            padding-inline: 0.7rem;
          }

          .notebook-page .hero-copy h1 {
            max-width: 100%;
            font-size: clamp(1.62rem, 7.4vw, 1.95rem);
            line-height: 1.04;
            overflow-wrap: anywhere;
            word-break: normal;
            text-wrap: wrap;
          }

          .notebook-page.long-title .hero-copy h1 {
            font-size: clamp(1.18rem, 5.45vw, 1.42rem);
            line-height: 1.08;
          }
        }

        @media (max-width: 520px) {
          .notebook-page .hero-copy .meta-row {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 340px) {
          .notebook-page .hero-copy .action-row {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
