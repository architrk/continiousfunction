import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Head from 'next/head'
import dynamic from 'next/dynamic'
import { foundationsConcepts, studyOrder, CATEGORY_LABELS, generateFoundationsGraphData } from '../../data/foundationsData'
import { conceptVisualizationMap } from '../../data/visualizationMappings'

// Calculate total connections from graph data (prereqs + semantic relations)
const graphData = generateFoundationsGraphData()
const totalConnections = graphData.links.length
const conceptsWithDemos = new Set(Object.keys(conceptVisualizationMap))
const totalDemos = conceptsWithDemos.size
const totalConcepts = foundationsConcepts.length

// Helper to count connections for a concept
function getConnectionCount(conceptId: string): number {
  const concept = foundationsConcepts.find(c => c.id === conceptId)
  if (!concept) return 0

  // Count prereqs
  const prereqCount = concept.prereqs.length

  // Count concepts that have this as a prereq (dependents)
  const dependentCount = foundationsConcepts.filter(c => c.prereqs.includes(conceptId)).length

  return prereqCount + dependentCount
}

// Dynamic import for the graph to avoid SSR issues with D3
const FoundationsGraph = dynamic(
  () => import('../../components/FoundationsGraph'),
  {
    ssr: false,
    loading: () => (
      <div className="graph-loading">
        <div className="loading-spinner" />
        <p>Loading concept map...</p>
        <style jsx>{`
          .graph-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 550px;
            background: rgba(8, 12, 20, 0.5);
            border-radius: 8px;
            border: 1px solid rgba(245, 158, 11, 0.2);
          }
          .loading-spinner {
            width: 40px;
            height: 40px;
            border: 3px solid rgba(245, 158, 11, 0.2);
            border-top-color: var(--accent);
            border-radius: 50%;
            animation: spin 1s linear infinite;
          }
          .graph-loading p {
            margin-top: 1rem;
            color: var(--text-secondary);
            font-size: 0.9rem;
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }
)

// Get unique categories for filtering
const categories = [...new Set(foundationsConcepts.map(c => c.category))]

export default function FoundationsIndex() {
  const router = useRouter()
  const [graphWidth, setGraphWidth] = useState(900)
  const [mounted, setMounted] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [onlyWithDemos, setOnlyWithDemos] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  useEffect(() => {
    setMounted(true)
    const updateWidth = () => {
      // Scale graph width based on viewport - larger on wide screens
      const maxWidth = window.innerWidth >= 1600 ? 1200 :
                       window.innerWidth >= 1200 ? 1000 : 900
      setGraphWidth(Math.min(maxWidth, window.innerWidth - 48))
    }
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // Filter concepts based on search and category
  const filteredConcepts = useMemo(() => {
    return foundationsConcepts.filter(concept => {
      const matchesSearch = searchQuery === '' ||
        concept.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        concept.shortTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
        concept.id.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesCategory = !selectedCategory || concept.category === selectedCategory
      const matchesDemos = !onlyWithDemos || conceptsWithDemos.has(concept.id)
      return matchesSearch && matchesCategory && matchesDemos
    })
  }, [searchQuery, selectedCategory, onlyWithDemos])

  const handleNodeClick = (conceptId: string) => {
    router.push(`/foundations/${conceptId}/`)
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedCategory(null)
    setOnlyWithDemos(false)
  }

  return (
    <div className="foundations-page">
      <Head>
        <title>Mathematical Foundations — Continuous Function</title>
      </Head>

      {/* Breadcrumb */}
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span className="breadcrumb-sep">/</span>
        <span className="breadcrumb-current">Foundations</span>
      </nav>

      <section className="hero">
        <h1>Mathematical Foundations</h1>
        <p className="hero-tagline">
          {totalConcepts} core concepts explaining how modern AI systems work.
          Interactive visualizations are available for many concepts (and expanding).
        </p>
        <div className="hero-stats">
          <span className="hero-stat"><strong>{totalConcepts}</strong> concepts</span>
          <span className="hero-stat"><strong>{totalDemos}</strong> demos</span>
          <span className="hero-stat"><strong>{totalConnections}</strong> connections</span>
          <span className="hero-stat"><strong>13</strong> learning phases</span>
        </div>
      </section>

      {/* Quick Navigation */}
      <nav className="page-nav">
        <a href="#concept-map" className="page-nav-link">
          <span className="page-nav-icon">🗺️</span>
          <span>Concept Map</span>
        </a>
        <a href="#study-path" className="page-nav-link">
          <span className="page-nav-icon">📚</span>
          <span>Study Path</span>
        </a>
        <a href="#all-concepts" className="page-nav-link">
          <span className="page-nav-icon">📖</span>
          <span>All Concepts</span>
        </a>
      </nav>

      <section id="concept-map" className="graph-section">
        {mounted && (
          <FoundationsGraph
            width={graphWidth}
            height={550}
            onNodeClick={handleNodeClick}
          />
        )}
      </section>

      <section id="study-path" className="study-path-section">
        <h2>Recommended Study Order</h2>
        <p className="muted">
          Build understanding from fundamentals to frontier techniques. Each phase
          builds on the previous one.
        </p>

        <div className="study-phases">
          {studyOrder.map((phase) => (
            <div key={phase.phase} className="phase-card">
              <div className="phase-header">
                <span className="phase-number">{phase.phase}</span>
                <h3>{phase.title}</h3>
              </div>
              <div className="phase-concepts">
                {phase.concepts.map((conceptId) => {
                  const concept = foundationsConcepts.find(c => c.id === conceptId)
                  if (!concept) return null
                  return (
                    <Link
                      key={concept.id}
                      href={`/foundations/${concept.id}/`}
                      className="concept-chip"
                      style={{ borderColor: concept.color }}
                      title={concept.title}
                    >
                      <span className="concept-icon">{concept.icon}</span>
                      <span className="concept-name">{concept.shortTitle}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="all-concepts" className="concepts-grid-section">
        <div className="concepts-header">
          <div>
            <h2>All {totalConcepts} Concepts</h2>
            <p className="muted">
              Search and filter to find what you're looking for.
            </p>
          </div>
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="1" width="6" height="6" rx="1" />
                <rect x="9" y="1" width="6" height="6" rx="1" />
                <rect x="1" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
              </svg>
            </button>
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="14" height="2" rx="1" />
                <rect x="1" y="7" width="14" height="2" rx="1" />
                <rect x="1" y="12" width="14" height="2" rx="1" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="filter-bar">
          <div className="search-wrapper">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Search concepts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search concepts"
            />
            {searchQuery && (
              <button className="search-clear" onClick={() => setSearchQuery('')} aria-label="Clear search">
                ×
              </button>
            )}
          </div>
          <div className="category-filters">
            <button
              className={`category-btn ${!selectedCategory ? 'active' : ''}`}
              onClick={() => setSelectedCategory(null)}
            >
              All
            </button>
            <button
              className={`category-btn ${onlyWithDemos ? 'active' : ''}`}
              onClick={() => setOnlyWithDemos(v => !v)}
              style={{ '--cat-color': 'var(--converge-teal)' } as React.CSSProperties}
              title="Show only concepts with interactive demos"
            >
              Demos
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                className={`category-btn ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                style={{
                  '--cat-color': foundationsConcepts.find(c => c.category === cat)?.color || 'var(--accent)'
                } as React.CSSProperties}
              >
                {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
              </button>
            ))}
          </div>
        </div>

        {/* Results info */}
        {(searchQuery || selectedCategory || onlyWithDemos) && (
          <div className="filter-results">
            <span>
              Showing {filteredConcepts.length} of {foundationsConcepts.length} concepts
            </span>
            <button className="clear-filters" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}

        <div className={viewMode === 'grid' ? 'concepts-grid' : 'concepts-list'}>
          {filteredConcepts.map((concept) => {
            const connectionCount = getConnectionCount(concept.id)
            const isHubConcept = connectionCount >= 10
            return (
            <Link
              key={concept.id}
              href={`/foundations/${concept.id}/`}
              className={viewMode === 'grid'
                ? `concept-card${isHubConcept ? ' highly-connected' : ''}`
                : 'concept-list-item'}
            >
              {viewMode === 'grid' ? (
                <>
                  <div className="concept-card-header">
                    <span
                      className="concept-badge"
                      style={{ backgroundColor: concept.color }}
                    >
                      {concept.number}
                    </span>
                    <span className="concept-icon-large">{concept.icon}</span>
                  </div>
                  <h3>{concept.shortTitle}</h3>
                  <p className="concept-full-title">{concept.title}</p>
	                  <div className="concept-meta">
	                    <span
	                      className="category-tag"
	                      style={{
	                        backgroundColor: `${concept.color}20`,
	                        color: concept.color
	                      }}
	                    >
	                      {CATEGORY_LABELS[concept.category as keyof typeof CATEGORY_LABELS]}
	                    </span>
	                    <span
	                      className={`connection-count${isHubConcept ? ' hub' : ''}`}
	                      title={isHubConcept ? 'Hub concept - highly connected' : 'Connected concepts'}
	                    >
	                      {isHubConcept ? '⭐ ' : '🔗 '}{connectionCount}
	                    </span>
	                    <span className="paper-count">
	                      {concept.canonicalPapers.length} paper{concept.canonicalPapers.length !== 1 ? 's' : ''}
	                    </span>
	                    {conceptsWithDemos.has(concept.id) && (
	                      <span className="demo-badge" title="Interactive demo available">
	                        ▶ Demo
	                      </span>
	                    )}
	                  </div>
	                  <span className="concept-cta">Explore →</span>
	                </>
	              ) : (
                <>
                  <span className="list-number" style={{ backgroundColor: concept.color }}>
                    {concept.number}
                  </span>
                  <span className="list-icon">{concept.icon}</span>
                  <span className="list-title">{concept.shortTitle}</span>
                  <span className="list-full-title">{concept.title}</span>
                  <span
                    className="list-category"
                    style={{ color: concept.color }}
                  >
                    {CATEGORY_LABELS[concept.category as keyof typeof CATEGORY_LABELS]}
                  </span>
                </>
              )}
            </Link>
          )})}
        </div>

        {filteredConcepts.length === 0 && (
          <div className="no-results">
            <p>No concepts match your search.</p>
            <button onClick={clearFilters} className="btn ghost">
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="cta-section">
        <h2>Why These {totalConcepts} Concepts?</h2>
        <div className="cta-grid">
          <div className="cta-card">
            <h3>Complete Coverage</h3>
            <p>
              Together, these concepts explain the core mechanisms behind
              language models, diffusion models, and multimodal systems.
            </p>
          </div>
          <div className="cta-card">
            <h3>Missing Intuition</h3>
            <p>
              Each concept includes what's still poorly explained in
              textbooks and papers - the intuition gaps we aim to fill.
            </p>
          </div>
          <div className="cta-card">
            <h3>Connected Knowledge</h3>
            <p>
              See how concepts build on each other. Understand prerequisites
              and what each idea unlocks.
            </p>
          </div>
        </div>
      </section>

      <style jsx>{`
        .foundations-page {
          max-width: 1400px;
          margin: 0 auto;
        }

        @media (min-width: 1600px) {
          .foundations-page {
            max-width: 1600px;
          }
        }

        /* Breadcrumb */
        .breadcrumb {
          font-size: 0.85rem;
          margin-bottom: 1rem;
          color: var(--text-muted);
        }

        .breadcrumb a {
          color: var(--text-secondary);
          text-decoration: none;
        }

        .breadcrumb a:hover {
          color: var(--accent);
        }

        .breadcrumb-sep {
          margin: 0 0.5rem;
          opacity: 0.5;
        }

        .breadcrumb-current {
          color: var(--text-primary);
        }

        /* Page Navigation */
        .page-nav {
          display: flex;
          justify-content: center;
          gap: 1rem;
          margin: 1.5rem 0 2rem;
          padding: 1rem;
          background: var(--bg-surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
        }

        .page-nav-link {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          color: var(--text-secondary);
          text-decoration: none;
          border-radius: var(--radius-md);
          transition: all 0.2s;
        }

        .page-nav-link:hover {
          background: var(--bg-elevated);
          color: var(--text-primary);
        }

        .page-nav-icon {
          font-size: 1rem;
        }

        .hero {
          text-align: center;
          padding: 2rem 0;
        }

        .hero h1 {
          font-family: var(--font-display);
          font-size: 2.5rem;
          margin-bottom: 1rem;
        }

        .hero-tagline {
          max-width: 700px;
          margin: 0 auto 1.5rem;
          color: var(--text-secondary);
          line-height: 1.6;
        }

        .hero-stats {
          display: flex;
          justify-content: center;
          gap: 2rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
        }

        .hero-stat strong {
          color: var(--accent);
          font-size: 1.1rem;
        }

        .graph-section {
          margin: 2rem 0;
          display: flex;
          justify-content: center;
        }

        .study-path-section {
          margin: 4rem 0;
        }

        .study-path-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.5rem;
          padding-left: 0;
        }

        .study-path-section h2::before {
          content: none;
        }

        .study-phases {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-top: 2rem;
        }

        .phase-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .phase-header {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }

        .phase-number {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: #0a0a0a;
          border-radius: 50%;
          font-weight: bold;
          font-size: 0.9rem;
        }

        .phase-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }

        .phase-concepts {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .concept-chip {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.8rem;
          background: rgba(8, 12, 20, 0.8);
          border: 1px solid;
          border-radius: 20px;
          font-size: 0.85rem;
          text-decoration: none;
          color: var(--text-primary);
          transition: all 0.2s;
        }

        .concept-chip:hover {
          background: rgba(245, 158, 11, 0.1);
          transform: translateY(-1px);
        }

        .concept-icon {
          font-size: 1rem;
          font-family: var(--font-symbol);
        }

        .concepts-grid-section {
          margin: 4rem 0;
        }

        .concepts-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .concepts-grid-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 0.25rem;
          padding-left: 0;
        }

        .concepts-grid-section h2::before {
          content: none;
        }

        .view-toggle {
          display: flex;
          gap: 0.25rem;
          background: var(--bg-elevated);
          padding: 0.25rem;
          border-radius: var(--radius-sm);
        }

        .view-btn {
          padding: 0.5rem;
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          border-radius: var(--radius-sm);
          transition: all 0.2s;
        }

        .view-btn:hover {
          color: var(--text-secondary);
        }

        .view-btn.active {
          background: var(--bg-surface);
          color: var(--accent);
        }

        /* Filter Bar */
        .filter-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: var(--bg-surface);
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
        }

        .search-wrapper {
          position: relative;
          flex: 1;
          min-width: 200px;
          max-width: 400px;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 0.75rem 2.5rem 0.75rem 2.5rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          color: var(--text-primary);
          font-size: 0.9rem;
        }

        .search-input:focus {
          outline: none;
          border-color: var(--accent);
        }

        .search-input::placeholder {
          color: var(--text-muted);
        }

        .search-clear {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 0.25rem 0.5rem;
        }

        .search-clear:hover {
          color: var(--text-primary);
        }

        .category-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .category-btn {
          padding: 0.5rem 0.75rem;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 999px;
          color: var(--text-secondary);
          font-size: 0.8rem;
          cursor: pointer;
          transition: all 0.2s;
        }

        .category-btn:hover {
          border-color: var(--cat-color, var(--accent));
          color: var(--cat-color, var(--accent));
        }

        .category-btn.active {
          background: var(--cat-color, var(--accent));
          border-color: var(--cat-color, var(--accent));
          color: var(--bg-deep);
        }

        .filter-results {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .clear-filters {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: 0.85rem;
        }

        .clear-filters:hover {
          text-decoration: underline;
        }

        .no-results {
          text-align: center;
          padding: 3rem;
          color: var(--text-muted);
        }

        .no-results p {
          margin-bottom: 1rem;
        }

        .concepts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        @media (min-width: 1200px) {
          .concepts-grid {
            grid-template-columns: repeat(4, 1fr);
            gap: 2rem;
          }
        }

        @media (min-width: 1600px) {
          .concepts-grid {
            grid-template-columns: repeat(5, 1fr);
          }
        }

        /* List View */
        .concepts-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .concept-list-item {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 0.75rem 1rem;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }

        .concept-list-item:hover {
          border-color: var(--accent);
          background: rgba(245, 158, 11, 0.05);
        }

        .list-number {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: bold;
          color: var(--bg-deep);
          flex-shrink: 0;
        }

        .list-icon {
          font-size: 1.25rem;
          flex-shrink: 0;
        }

        .list-title {
          font-weight: 600;
          color: var(--text-primary);
          min-width: 150px;
        }

        .list-full-title {
          flex: 1;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .list-category {
          font-size: 0.75rem;
          flex-shrink: 0;
        }

        .concept-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
          text-decoration: none;
          color: inherit;
          transition: all 0.2s;
        }

        .concept-card:hover {
          border-color: var(--accent);
          transform: translateY(-2px);
          box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1);
        }

        .concept-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 0.75rem;
        }

        .concept-badge {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: bold;
          color: #0a0a0a;
        }

        .concept-icon-large {
          font-size: 1.5rem;
          font-family: var(--font-symbol);
        }

        .concept-card h3 {
          margin: 0 0 0.25rem;
          font-size: 1.1rem;
        }

        .concept-full-title {
          font-size: 0.8rem;
          color: var(--text-secondary);
          margin: 0 0 1rem;
          line-height: 1.4;
        }

        .concept-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }

        .category-tag {
          padding: 0.2rem 0.6rem;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 500;
        }

        .connection-count {
          font-size: 0.7rem;
          color: var(--converge-teal);
          opacity: 0.8;
        }

        .connection-count.hub {
          background: rgba(20, 184, 166, 0.15);
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          opacity: 1;
          font-weight: 500;
        }

        .concept-card.highly-connected {
          border-color: rgba(20, 184, 166, 0.3);
          background: linear-gradient(135deg, rgba(8, 12, 20, 0.5), rgba(20, 184, 166, 0.03));
        }

        .concept-card.highly-connected:hover {
          border-color: var(--converge-teal);
          box-shadow: 0 4px 20px rgba(20, 184, 166, 0.15);
        }

        .paper-count {
          font-size: 0.7rem;
          color: var(--text-tertiary);
        }

        .demo-badge {
          font-size: 0.7rem;
          color: var(--accent);
          background: rgba(245, 158, 11, 0.12);
          border: 1px solid rgba(245, 158, 11, 0.18);
          padding: 0.15rem 0.45rem;
          border-radius: 6px;
          letter-spacing: 0.01em;
        }

        .concept-cta {
          display: block;
          margin-top: 1rem;
          font-size: 0.85rem;
          color: var(--converge-teal);
          transition: color 0.2s;
        }

        .concept-card:hover .concept-cta {
          color: var(--accent);
        }

        .cta-section {
          margin: 4rem 0;
          text-align: center;
        }

        .cta-section h2 {
          font-family: var(--font-display);
          font-size: 1.5rem;
          margin-bottom: 2rem;
          padding-left: 0;
        }

        .cta-section h2::before {
          content: none;
        }

        .cta-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }

        @media (min-width: 1000px) {
          .cta-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 2rem;
          }
        }

        .cta-card {
          background: rgba(8, 12, 20, 0.5);
          border: 1px solid rgba(245, 158, 11, 0.15);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: left;
        }

        .cta-card h3 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
        }

        .cta-card p {
          font-size: 0.85rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.5;
        }

        @media (max-width: 768px) {
          .hero h1 {
            font-size: 1.8rem;
          }

          .hero-stats {
            flex-direction: column;
            gap: 0.5rem;
          }

          .page-nav {
            flex-wrap: wrap;
            gap: 0.5rem;
          }

          .page-nav-link {
            flex: 1;
            min-width: 100px;
            justify-content: center;
          }

          .filter-bar {
            flex-direction: column;
          }

          .search-wrapper {
            max-width: none;
          }

          .category-filters {
            overflow-x: auto;
            flex-wrap: nowrap;
            padding-bottom: 0.5rem;
            margin: -0.25rem;
            padding: 0.25rem;
          }

          .category-btn {
            white-space: nowrap;
            flex-shrink: 0;
          }

          .concepts-grid {
            grid-template-columns: 1fr;
          }

          .concept-list-item {
            flex-wrap: wrap;
          }

          .list-full-title {
            width: 100%;
            order: 5;
            margin-top: 0.5rem;
          }
        }
      `}</style>
    </div>
  )
}
