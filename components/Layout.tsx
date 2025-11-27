import Link from 'next/link'
import { ReactNode } from 'react'

type Props = {
  children: ReactNode
}

export default function Layout({ children }: Props) {
  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header-inner">
          <Link href="/" className="brand">
            <span className="brand-pill">∇</span>
            <span className="brand-text">Continuous Function</span>
          </Link>
          <nav className="nav">
            <Link href="/concepts/optimizers/overview" className="nav-link">
              Optimizers
            </Link>
            <Link href="/concepts/optimizers/muon" className="nav-link">
              Muon
            </Link>
            <Link href="/graph" className="nav-link">
              Concept Graph
            </Link>
          </nav>
        </div>
      </header>
      <main className="app-main">
        <div className="app-main-inner">{children}</div>
      </main>
      <footer className="app-footer">
        <p>Explorable explanations of optimization in deep learning.</p>
      </footer>
    </div>
  )
}
