import Link from 'next/link'
import LearningCompanionPanel from '../ai/LearningCompanionPanel'

type ResolvedLink = {
  id: string
  title?: string
  href?: string
}

type Neighbor = {
  title: string
  href: string
}

type SectionItem = {
  id: string
  label: string
  ready: boolean
}

type Props = {
  domainTitle: string
  domainHref: string
  tags: string[]
  sections: SectionItem[]
  prerequisites: ResolvedLink[]
  leadsTo: ResolvedLink[]
  related: ResolvedLink[]
  demoPrompt: string
  nextLearning: ResolvedLink | null
  prevInDomain: Neighbor | null
  nextInDomain: Neighbor | null
  conceptId: string
  conceptTitle: string
  conceptDescription?: string
}

function LinkCluster({ title, items }: { title: string; items: ResolvedLink[] }) {
  if (!items.length) return null

  return (
    <section className="rail-block">
      <h3>{title}</h3>
      <div className="chip-list">
        {items.map((item) => (
          item.href ? (
            <Link key={item.id} href={item.href} className="chip">
              {item.title ?? item.id}
            </Link>
          ) : (
            <span key={item.id} className="chip muted">
              {item.title ?? item.id}
            </span>
          )
        ))}
      </div>

      <style jsx>{`
        .rail-block + .rail-block {
          margin-top: 1rem;
        }

        h3 {
          margin: 0 0 0.55rem;
          font-size: 0.85rem;
          font-family: var(--font-mono);
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #4a5865;
        }

        .chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .chip-list :global(.chip) {
          display: inline-flex;
          align-items: center;
          min-height: 32px;
          padding: 0.35rem 0.6rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          color: #1b2430;
          text-decoration: none;
          font-size: 0.82rem;
        }

        .chip-list :global(.chip:hover) {
          border-color: rgba(31, 75, 153, 0.3);
          color: #1f4b99;
          text-shadow: none;
        }

        .chip-list :global(.chip.muted) {
          opacity: 0.62;
          cursor: not-allowed;
        }
      `}</style>
    </section>
  )
}

export default function ConceptNotebookRail({
  domainTitle,
  domainHref,
  tags,
  sections,
  prerequisites,
  leadsTo,
  related,
  demoPrompt,
  nextLearning,
  prevInDomain,
  nextInDomain,
  conceptId,
  conceptTitle,
  conceptDescription,
}: Props) {
  const firstPrereq = prerequisites[0]
  const beforeLabel = firstPrereq?.title ?? firstPrereq?.id ?? 'No hard prerequisite'
  const nextLabel = nextLearning?.title ?? nextLearning?.id ?? 'Choose a related idea'
  const modeLenses = [
    { label: 'Learner', cue: 'picture first', href: '#intuition' },
    { label: 'Researcher', cue: 'source check', href: '#research-reading-room-workspace' },
    { label: 'Experimenter', cue: 'test the demo', href: '#interactive-demo' },
    { label: 'Professor', cue: 'name invariant', href: '#math' },
  ]
  const evidenceLoop = [
    { label: 'Predict', href: '#interactive-demo' },
    { label: 'Ground', href: '#math' },
    { label: 'Code', href: '#code' },
    { label: 'Carry', href: nextLearning?.href ?? '#interactive-demo' },
  ]

  return (
    <div className="rail-stack">
      <section className="rail-block rail-intro">
        <p className="eyebrow">Learning Map</p>
        <h2>Before / Now / Try / Next</h2>
        <div className="orientation-list">
          <div>
            <span>Before</span>
            {firstPrereq?.href ? (
              <Link href={firstPrereq.href}>{beforeLabel}</Link>
            ) : (
              <strong>{beforeLabel}</strong>
            )}
          </div>
          <div>
            <span>Now</span>
            <a href="#intuition">Intuition → Math → Code → Demo</a>
          </div>
          <div>
            <span>Try</span>
            <a href="#interactive-demo">{demoPrompt}</a>
          </div>
          <div>
            <span>Next</span>
            {nextLearning?.href ? (
              <Link href={nextLearning.href}>{nextLabel}</Link>
            ) : (
              <strong>{nextLabel}</strong>
            )}
          </div>
        </div>
        <div className="mode-lens-grid" aria-label="Study mode lenses">
          {modeLenses.map((mode) => (
            <a key={mode.label} href={mode.href}>
              <strong>{mode.label}</strong>
              <span>{mode.cue}</span>
            </a>
          ))}
        </div>
        <div className="rail-evidence-loop" aria-label="Evidence loop shortcuts">
          {evidenceLoop.map((step, index) => (
            <a key={step.label} href={step.href}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{step.label}</strong>
            </a>
          ))}
        </div>
        <ul className="section-list">
          {sections.map((section, index) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={`section-link ${section.ready ? 'ready' : 'pending'}`}>
                <span className="step">{String(index + 1).padStart(2, '0')}</span>
                <span>{section.label}</span>
                <span className="state">{section.ready ? 'ready' : 'planned'}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <LearningCompanionPanel
        id="ai-companion"
        compact
        title={conceptTitle}
        contextLabel={`${domainTitle} concept`}
        description={conceptDescription}
        currentSection="Intuition, math, code, and interactive demo"
        nextStep={demoPrompt}
        demoStateScope={conceptId}
      />

      <section className="rail-block">
        <p className="eyebrow">Domain</p>
        <Link href={domainHref} className="domain-link">
          {domainTitle}
        </Link>
        {tags.length ? (
          <div className="chip-list" style={{ marginTop: '0.8rem' }}>
            {tags.map((tag) => (
              <span key={tag} className="chip muted">
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </section>

      <LinkCluster title="Prerequisites" items={prerequisites} />
      <LinkCluster title="Leads To" items={leadsTo} />
      <LinkCluster title="Related" items={related} />

      {(prevInDomain || nextInDomain) ? (
        <section className="rail-block rail-nav">
          <p className="eyebrow">Within this domain</p>
          {prevInDomain ? (
            <Link href={prevInDomain.href} className="pager-link">
              <span className="pager-kicker">Previous</span>
              <span className="pager-title">{prevInDomain.title}</span>
            </Link>
          ) : null}
          {nextInDomain ? (
            <Link href={nextInDomain.href} className="pager-link">
              <span className="pager-kicker">Next</span>
              <span className="pager-title">{nextInDomain.title}</span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <style jsx>{`
        .rail-stack {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .rail-block {
          padding: 1rem;
          border-radius: 20px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .eyebrow {
          margin: 0 0 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #1f6f78;
        }

        h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.25rem;
          letter-spacing: -0.02em;
          color: #17202a;
        }

        .section-list {
          list-style: none;
          margin: 1rem 0 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.55rem;
        }

        .orientation-list {
          display: grid;
          gap: 0.65rem;
          margin-top: 0.9rem;
        }

        .orientation-list div {
          display: grid;
          gap: 0.25rem;
          padding: 0.7rem 0;
          border-top: 1px solid rgba(27, 36, 48, 0.08);
        }

        .orientation-list span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #5b6874;
        }

        .orientation-list strong,
        .orientation-list :global(a) {
          color: #17202a;
          text-decoration: none;
          line-height: 1.35;
          font-size: 0.92rem;
        }

        .orientation-list :global(a:hover) {
          color: #1f4b99;
          text-shadow: none;
        }

        .mode-lens-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
          margin-top: 0.95rem;
        }

        .mode-lens-grid :global(a) {
          display: grid;
          gap: 0.18rem;
          min-width: 0;
          min-height: 4.4rem;
          align-content: center;
          padding: 0.62rem;
          border-radius: 12px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background:
            linear-gradient(135deg, rgba(31, 111, 120, 0.09), rgba(255, 251, 245, 0.92)),
            rgba(255, 251, 245, 0.92);
          color: #17202a;
          text-decoration: none;
        }

        .mode-lens-grid :global(a:hover) {
          border-color: rgba(31, 111, 120, 0.34);
          transform: translateY(-1px);
          text-shadow: none;
        }

        .mode-lens-grid strong {
          overflow-wrap: anywhere;
          color: #17202a;
          font-size: 0.78rem;
          line-height: 1.12;
        }

        .mode-lens-grid span {
          color: #52606b;
          font-size: 0.68rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .rail-evidence-loop {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.35rem;
          margin-top: 0.85rem;
          padding: 0.45rem;
          border-radius: 13px;
          border: 1px solid rgba(20, 184, 166, 0.18);
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.18), rgba(15, 23, 42, 0.95)),
            #111827;
        }

        .rail-evidence-loop :global(a) {
          display: grid;
          gap: 0.2rem;
          min-width: 0;
          padding: 0.5rem 0.38rem;
          border-radius: 9px;
          border: 1px solid rgba(148, 163, 184, 0.14);
          background: rgba(255, 255, 255, 0.06);
          color: #d7e8ea;
          text-decoration: none;
        }

        .rail-evidence-loop :global(a:hover) {
          border-color: rgba(45, 212, 191, 0.38);
          background: rgba(15, 118, 110, 0.28);
          text-shadow: none;
        }

        .rail-evidence-loop span {
          color: #8bd8d0;
          font-family: var(--font-mono);
          font-size: 0.62rem;
        }

        .rail-evidence-loop strong {
          color: #ecfeff;
          font-size: 0.68rem;
          line-height: 1.1;
          overflow-wrap: anywhere;
        }

        .section-list :global(.section-link) {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr) auto;
          gap: 0.8rem;
          align-items: center;
          padding: 0.72rem 0.82rem;
          border-radius: 14px;
          text-decoration: none;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.95);
          color: #1b2430;
        }

        .section-list :global(.section-link:hover) {
          transform: translateY(-1px);
          text-shadow: none;
        }

        .section-list :global(.section-link.ready) {
          border-color: rgba(31, 111, 120, 0.16);
        }

        .section-list .step {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 1.55rem;
          height: 1.55rem;
          border-radius: 999px;
          background: rgba(31, 111, 120, 0.1);
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.64rem;
        }

        .section-list :global(.section-link > span:nth-child(2)) {
          min-width: 0;
          line-height: 1.15;
          overflow-wrap: anywhere;
        }

        .section-list :global(.section-link.pending) {
          opacity: 0.72;
        }

        .state {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #5b6874;
          white-space: nowrap;
        }

        .rail-block :global(.domain-link) {
          color: #1f4b99;
          text-decoration: none;
          font-weight: 600;
        }

        .rail-block :global(.domain-link:hover) {
          color: #1b2430;
          text-shadow: none;
        }

        .chip-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.45rem;
        }

        .chip {
          display: inline-flex;
          align-items: center;
          min-height: 30px;
          padding: 0.28rem 0.58rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.88);
          font-size: 0.78rem;
          color: #40505c;
        }

        .chip.muted {
          color: #54616c;
        }

        .rail-nav {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }

        .rail-nav :global(.pager-link) {
          display: block;
          padding: 0.85rem;
          border-radius: 16px;
          text-decoration: none;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.94);
          color: #17202a;
        }

        .rail-nav :global(.pager-link:hover) {
          border-color: rgba(31, 75, 153, 0.3);
          text-shadow: none;
        }

        .pager-kicker {
          display: block;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          text-transform: uppercase;
          letter-spacing: 0.12em;
          color: #5c6976;
        }

        .pager-title {
          display: block;
          margin-top: 0.35rem;
          color: #17202a;
          font-family: var(--font-display);
          font-size: 1rem;
          line-height: 1.15;
        }
      `}</style>
    </div>
  )
}
