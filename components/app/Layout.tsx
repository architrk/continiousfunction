import Link from 'next/link'
import Head from 'next/head'
import { ReactNode } from 'react'
import { useRouter } from 'next/router'
import RouteStateStrip from '@/components/product/RouteStateStrip'

type Props = {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  const router = useRouter()
  const routePath = router.pathname
  const editorialSurface =
    routePath === '/' ||
    routePath === '/editorial-prototype' ||
    routePath === '/search' ||
    routePath === '/me' ||
    routePath === '/vision' ||
    routePath === '/graph' ||
    routePath === '/paper-map' ||
    routePath.startsWith('/paths') ||
    routePath === '/pillars' ||
    routePath.startsWith('/pillars/') ||
    routePath.startsWith('/foundations') ||
    routePath.startsWith('/domains')
  const routeStateSurface =
    routePath === '/'
      ? 'home'
      : routePath === '/search'
        ? 'search'
      : routePath === '/me'
        ? 'memory'
      : routePath === '/graph'
        ? 'graph'
      : routePath === '/paper-map'
        ? 'paper-map'
      : routePath.startsWith('/paths/attention-serving')
        ? 'attention-serving'
      : routePath === '/domains'
        ? 'domains'
      : routePath.startsWith('/domains') && routePath.includes('[slug]')
        ? 'concept-notebook'
      : routePath.startsWith('/domains')
        ? 'domain-detail'
      : routePath.startsWith('/foundations')
        ? 'foundations'
      : routePath.startsWith('/pillars')
        ? 'pillars'
      : routePath === '/vision'
        ? 'vision'
        : 'other'

  return (
    <div className={`app-root${editorialSurface ? ' editorial-surface' : ''}`}>
      <Head>
        <title>Continuous Function</title>
        <meta name="description" content="Explorable explanations of deep learning mathematics through interactive visualizations." />
        <meta property="og:title" content="Continuous Function" />
        <meta property="og:description" content="Explorable explanations of deep learning mathematics through interactive visualizations." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/" className="brand">
            <span className="brand-pill">∇</span>
            <span className="brand-text">Continuous Function</span>
          </Link>
          <nav className="nav" aria-label="Primary navigation">
            <Link href="/foundations/" className="nav-link">
              <span className="nav-full">Foundations</span>
              <span className="nav-short">Learn</span>
            </Link>
            <Link href="/domains/" className="nav-link">
              <span className="nav-full">Domains</span>
              <span className="nav-short">Domains</span>
            </Link>
            <Link href="/paper-map/" className="nav-link">
              <span className="nav-full">Paper Mapper</span>
              <span className="nav-short">Papers</span>
            </Link>
            <Link href="/graph" className="nav-link">
              <span className="nav-full">Graph</span>
              <span className="nav-short">Graph</span>
            </Link>
            <Link href="/search/" className="nav-link">
              <span className="nav-full">Search</span>
              <span className="nav-short">Search</span>
            </Link>
            <Link href="/me" className="nav-link nav-optional">
              <span className="nav-full">Memory</span>
              <span className="nav-short">Memory</span>
            </Link>
            <Link href="/paths/attention-serving/" className="nav-link">
              <span className="nav-full">Attention Path</span>
              <span className="nav-short">Path</span>
            </Link>
            <Link href="/pillars" className="nav-link nav-optional">
              <span className="nav-full">Pillars</span>
              <span className="nav-short">Pillars</span>
            </Link>
            <Link href="/vision" className="nav-link nav-optional">
              <span className="nav-full">Vision</span>
              <span className="nav-short">Vision</span>
            </Link>
          </nav>
        </div>
        {editorialSurface && routeStateSurface !== 'home' ? <RouteStateStrip surface={routeStateSurface} /> : null}
      </header>
      <main id="main-content" className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
      <footer className="app-footer">
        <p>Interactive explorations of deep learning mathematics.</p>
        <a
          href="https://www.linkedin.com/in/architkhare/"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-contact"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ marginRight: '6px', verticalAlign: 'middle' }}
          >
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
          </svg>
          Contact
        </a>
      </footer>
      <style jsx global>{`
        .app-root.editorial-surface {
          --bg-deep: #f7f2e9;
          --bg-surface: rgba(255, 251, 245, 0.82);
          --bg-elevated: rgba(239, 232, 219, 0.78);
          --gradient-orange: #c24a2d;
          --gradient-orange-dim: rgba(194, 74, 45, 0.11);
          --gradient-orange-glow: rgba(194, 74, 45, 0.2);
          --converge-teal: #1f6f78;
          --converge-teal-dim: rgba(31, 111, 120, 0.12);
          --converge-teal-glow: rgba(31, 111, 120, 0.2);
          --text-primary: #17202a;
          --text-secondary: #455361;
          --text-tertiary: #6a7480;
          --text-muted: #64707c;
          --grid-line: rgba(31, 75, 153, 0.05);
          --grid-line-strong: rgba(31, 75, 153, 0.09);
          --border-subtle: rgba(27, 36, 48, 0.1);
          --border-accent: rgba(31, 111, 120, 0.28);
          --shadow-glow: 0 18px 46px rgba(5, 12, 20, 0.08);
          --shadow-deep: 0 22px 60px rgba(5, 12, 20, 0.1);
        }

        .app-root.editorial-surface .app-header {
          background: linear-gradient(
            to bottom,
            rgba(247, 242, 233, 0.94),
            rgba(247, 242, 233, 0.84)
          );
          border-bottom-color: rgba(27, 36, 48, 0.08);
        }

        .app-root.editorial-surface .app-header::after {
          background: linear-gradient(
            90deg,
            transparent,
            rgba(31, 75, 153, 0.55) 25%,
            rgba(31, 111, 120, 0.55) 72%,
            transparent
          );
          opacity: 0.55;
        }

        .app-root.editorial-surface .brand-pill {
          background: linear-gradient(135deg, #1f4b99, #1f6f78);
          color: #f8f3ea;
          box-shadow:
            0 0 18px rgba(31, 75, 153, 0.18),
            inset 0 1px 0 rgba(255,255,255,0.25);
        }

        .app-root.editorial-surface .brand-text,
        .app-root.editorial-surface .nav-link {
          color: #23313f;
        }

        .app-root.editorial-surface .nav-link:hover {
          color: #151d27;
          background: rgba(31, 75, 153, 0.08);
          border-color: rgba(27, 36, 48, 0.08);
        }

        .app-root.editorial-surface .nav-link::before {
          background: #1f6f78;
        }

        .nav-short {
          display: none;
        }

        .app-root.editorial-surface .app-footer {
          color: #5a6773;
          border-top-color: rgba(27, 36, 48, 0.08);
          background: linear-gradient(to bottom, rgba(247, 242, 233, 0.35), rgba(239, 232, 219, 0.72));
        }

        .app-root.editorial-surface .app-main-inner {
          max-width: 1520px;
          padding-top: 1.5rem;
        }

        .app-root.editorial-surface .app-main-inner > div:not(.notebook-page) {
          position: relative;
          overflow: hidden;
          padding: clamp(1.1rem, 2.2vw, 2rem);
          border-radius: 28px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            linear-gradient(rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(31, 75, 153, 0.045) 1px, transparent 1px),
            radial-gradient(ellipse at 80% 8%, rgba(31, 111, 120, 0.1), transparent 30%),
            rgba(255, 251, 245, 0.74);
          background-size: 32px 32px, 32px 32px, auto, auto;
          box-shadow: 0 20px 50px rgba(5, 12, 20, 0.08);
        }

        .app-root.editorial-surface .app-footer::before {
          color: #1f6f78;
          opacity: 0.45;
        }

        .app-root.editorial-surface .footer-contact {
          color: #23313f;
          border-color: rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.78);
        }

        .app-root.editorial-surface .footer-contact:hover {
          color: #1f4b99;
          border-color: rgba(31, 75, 153, 0.3);
          background: rgba(31, 75, 153, 0.08);
        }

        body:has(.app-root.editorial-surface) {
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.08), transparent 24%),
            radial-gradient(circle at bottom right, rgba(194, 74, 45, 0.08), transparent 28%),
            linear-gradient(180deg, #efe8db 0%, #f7f2e9 100%);
          color: #1b2430;
        }

        @media (min-width: 769px) and (max-width: 1180px) {
          .app-root.editorial-surface .app-header-inner {
            gap: 0.75rem;
            padding: 0.75rem 1rem;
          }

          .app-root.editorial-surface .brand-text {
            font-size: 1.04rem;
            white-space: nowrap;
          }

          .app-root.editorial-surface .nav {
            flex-wrap: nowrap;
            gap: 0.18rem;
          }

          .app-root.editorial-surface .nav-link {
            padding: 0.42rem 0.58rem;
            font-size: 0.84rem;
            white-space: nowrap;
          }

          .app-root.editorial-surface .nav-optional {
            display: none;
          }
        }

        @media (min-width: 769px) and (max-width: 940px) {
          .app-root.editorial-surface .nav-full {
            display: none;
          }

          .app-root.editorial-surface .nav-short {
            display: inline;
          }
        }

        @media (max-width: 768px) {
          .app-root.editorial-surface .app-header {
            position: static !important;
          }

          body:has(.app-root.editorial-surface),
          .app-root.editorial-surface,
          .app-root.editorial-surface .app-header,
          .app-root.editorial-surface .app-header-inner,
          .app-root.editorial-surface .app-main,
          .app-root.editorial-surface .app-main-inner {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: hidden !important;
          }

          .app-root.editorial-surface .app-header-inner {
            gap: 0.5rem !important;
            padding: 0.65rem 0.85rem !important;
            width: 100% !important;
            max-width: 100% !important;
          }

          .app-root.editorial-surface .brand-pill {
            width: 32px !important;
            height: 32px !important;
            font-size: 1.12rem !important;
          }

          .app-root.editorial-surface .brand-text {
            font-size: 1rem !important;
          }

          .app-root.editorial-surface .nav {
            display: grid !important;
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            width: 100% !important;
            justify-content: flex-start !important;
            gap: 0.28rem !important;
            overflow: visible !important;
            padding-bottom: 0 !important;
          }

          .app-root.editorial-surface .nav-link {
            min-width: 0 !important;
            min-height: 34px !important;
            padding: 0.3rem 0.34rem !important;
            font-size: 0.76rem !important;
            text-align: center !important;
            white-space: normal !important;
            line-height: 1.15 !important;
            border-color: rgba(27, 36, 48, 0.08) !important;
            background: rgba(255, 251, 245, 0.66) !important;
          }

          .app-root.editorial-surface .nav-optional {
            display: none !important;
          }

          .nav-full {
            display: none;
          }

          .nav-short {
            display: inline;
          }
        }
      `}</style>
    </div>
  )
}
