import Link from 'next/link'
import Head from 'next/head'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className="app-root">
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
          <nav className="nav">
            <Link href="/foundations/" className="nav-link">
              Foundations
            </Link>
            <Link href="/domains/" className="nav-link">
              Domains
            </Link>
            <Link href="/search/" className="nav-link">
              Search
            </Link>
            <Link href="/pillars" className="nav-link">
              Pillars
            </Link>
            <Link href="/pillars/optimization" className="nav-link">
              Optimization
            </Link>
            <Link href="/graph" className="nav-link">
              Graph
            </Link>
            <Link href="/vision" className="nav-link">
              Vision
            </Link>
          </nav>
        </div>
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
    </div>
  )
}
