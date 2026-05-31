import Link from 'next/link'
import LearningCompanionPanel from '../ai/LearningCompanionPanel'
import NotebookLayout from '../editorial/NotebookLayout'
import HomeDomainAtlas from './HomeDomainAtlas'
import HomeLearningLoop from './HomeLearningLoop'
import HomeModeSwitchboard from './HomeModeSwitchboard'
import HomePaperMapperSurface from './HomePaperMapperSurface'
import HomeResumeRoutePanel from './HomeResumeRoutePanel'
import HomeResearchOS from './HomeResearchOS'
import HomeTrackGrid from './HomeTrackGrid'
import ReaderLensPanel from '../learning/ReaderLensPanel'

export type HomeLandingProps = {
  stats: Array<{ value: string; label: string }>
  domains: Array<{
    id: string
    title: string
    description: string
    color: string
    conceptCount: number
    demoCount: number
    featuredConcepts: string[]
  }>
  pathway: Array<{
    id: string
    title: string
    kicker: string
    description: string
    note: string
    href: string
    linkLabel: string
    accent: string
  }>
  tracks: Array<{
    title: string
    description: string
    href: string
    accent: string
    concepts: Array<{
      title: string
      href: string
      description: string
      readTime: number
      hasDemo: boolean
      hasCode: boolean
    }>
  }>
  startHere: Array<{ title: string; href: string }>
  totalPublished: number
}

export default function HomeLanding({
  stats,
  domains,
  pathway,
  tracks,
  startHere,
  totalPublished,
}: HomeLandingProps) {
  return (
    <NotebookLayout
      eyebrow="Interactive AI Learning"
      title="Understand frontier AI papers through interactive math"
      lede="Turn modern AI research into concepts, equations, visualizations, toy labs, and source-grounded tutoring. Continuous Function is becoming a paper-to-understanding loop for people who need to understand fast without giving up rigor."
      meta={stats.map((stat) => `${stat.value} ${stat.label}`)}
      actions={[
        { href: '/paper-map/', label: 'Map a paper' },
        { href: '/graph/', label: 'Find my next concept', variant: 'secondary' },
        { href: '/paths/attention-serving/', label: 'Study attention to serving', variant: 'secondary' },
      ]}
      ambientImage="/images/editorial/product-loop/paper-to-understanding-loop.jpg"
      preHero={<HomeResumeRoutePanel />}
      heroVisual={(
        <div className="hero-stack">
          <figure className="atlas-image">
            <img
              src="/images/editorial/product-loop/paper-to-understanding-loop.jpg"
              alt="A research paper flowing into concept routes, equations, and an experiment surface."
            />
          </figure>
          <HomePaperMapperSurface />
        </div>
      )}
      rail={(
        <div className="rail-stack">
          <section className="rail-card">
            <p className="rail-eyebrow">How To Read It</p>
            <ul>
              <li>Use the domain atlas when you know the territory you want.</li>
              <li>Use the curated tracks when you want prerequisite order.</li>
              <li>Use the demo-heavy pages when you need intuition before derivations.</li>
            </ul>
          </section>

          <section className="rail-card">
            <p className="rail-eyebrow">Start Here</p>
            <div className="rail-links">
              {startHere.map((item) => (
                <Link key={item.href} href={item.href} className="rail-link">
                  {item.title}
                </Link>
              ))}
            </div>
          </section>

          <section className="rail-card">
            <p className="rail-eyebrow">Live System</p>
            <div className="mini-metrics">
              <div>
                <strong>{totalPublished}</strong>
                <span>published notebooks</span>
              </div>
              <div>
                <strong>{domains.length}</strong>
                <span>active domains</span>
              </div>
            </div>
          </section>
        </div>
      )}
    >
      <div className="home-landing">
        <ReaderLensPanel />
        <HomeModeSwitchboard />
        <HomeResearchOS />

        <section id="ai-companion" className="ai-first-band">
          <div className="ai-first-copy">
            <p className="card-eyebrow">Object-Attached Learning</p>
            <h2>Guided lessons, rigorous notes, coding practice, and a companion attached to the object you are studying.</h2>
            <p>
              Continuous Function should feel like a mathematical playground, a serious course, a code lab, and a
              patient tutor in the same place. The companion helps learners ask sharper questions, recover missing
              prerequisites, turn notation into code, and test understanding against the exact equation or live demo in view.
            </p>
          </div>
          <LearningCompanionPanel
            id="home-ai-companion"
            mode="home"
            title="Continuous Function atlas"
            contextLabel="homepage learning atlas"
            description="Choose a path, study a notebook, manipulate the demo, then use the selected object to explain, quiz, connect, or debug the idea."
            nextStep="Pick a track and ask the companion to turn it into a short plan."
            compact
          />
        </section>

        <HomeLearningLoop steps={pathway} />
        <HomeDomainAtlas domains={domains} />
        <HomeTrackGrid tracks={tracks} />
      </div>

      <style jsx>{`
        .home-landing {
          display: grid;
          gap: 2.2rem;
        }

        :global(.notebook-page .notebook-hero) {
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

        :global(.notebook-page .hero-copy) {
          padding-inline: clamp(0.4rem, 1.3vw, 1rem);
        }

        :global(.notebook-page .hero-copy .eyebrow) {
          color: #7dd3fc !important;
        }

        :global(.notebook-page .hero-copy h1) {
          color: #fff8ed !important;
          text-shadow: 0 18px 42px rgba(0, 0, 0, 0.22);
        }

        :global(.notebook-page .hero-copy .lede) {
          color: rgba(248, 243, 234, 0.74) !important;
        }

        :global(.notebook-page .hero-copy .meta-chip) {
          color: #d9f4ee !important;
          border-color: rgba(45, 212, 191, 0.18) !important;
          background: rgba(45, 212, 191, 0.08) !important;
        }

        :global(.notebook-page .hero-copy .action-row .cta.primary) {
          color: #07111d !important;
          background: #f8d16d !important;
          box-shadow: 0 16px 34px rgba(0, 0, 0, 0.24) !important;
        }

        :global(.notebook-page .hero-copy .action-row .cta.secondary) {
          color: #f8f3ea !important;
          border-color: rgba(248, 243, 234, 0.18) !important;
          background: rgba(248, 243, 234, 0.08) !important;
        }

        .hero-stack {
          position: relative;
          display: grid;
          align-content: end;
          min-height: 100%;
          padding: clamp(0.85rem, 2vw, 1.2rem);
          background:
            linear-gradient(rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            linear-gradient(90deg, rgba(125, 211, 252, 0.08) 1px, transparent 1px),
            radial-gradient(circle at 28% 10%, rgba(45, 212, 191, 0.16), transparent 30%),
            radial-gradient(circle at 88% 76%, rgba(194, 74, 45, 0.16), transparent 30%),
            rgba(5, 12, 20, 0.72);
          background-size: 30px 30px, 30px 30px, auto, auto, auto;
        }

        .atlas-image {
          position: relative;
          position: absolute;
          inset: 0;
          min-height: 0;
          margin: 0;
          overflow: hidden;
          border-bottom: 0;
          background: #07111d;
        }

        .atlas-image::after {
          content: '';
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(5, 12, 20, 0.2), rgba(5, 12, 20, 0.72) 66%, rgba(5, 12, 20, 0.94)),
            linear-gradient(90deg, rgba(5, 12, 20, 0.62), transparent 44%, rgba(5, 12, 20, 0.42));
          pointer-events: none;
        }

        .atlas-image img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: saturate(1.05) contrast(1.08) brightness(0.72);
        }

        .hero-stack :global(.entry-surface) {
          position: relative;
          max-width: 92%;
          margin: clamp(3.5rem, 7vh, 5rem) auto 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 26px;
          box-shadow:
            0 24px 58px rgba(0, 0, 0, 0.28),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          overflow: hidden;
        }

        @media (max-width: 720px) {
          :global(.notebook-page .notebook-hero) {
            border-radius: 20px;
            padding: 0.9rem;
          }
        }

        .hero-stack :global(.paper-mapper-surface) {
          position: relative;
          max-width: min(96%, 660px);
          margin: clamp(2.4rem, 6vh, 4.6rem) auto 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 26px;
          box-shadow:
            0 24px 58px rgba(7, 15, 25, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          overflow: hidden;
        }

        .principles-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 1rem;
        }

        .principle-card {
          padding: 1.2rem;
          border-radius: 24px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            radial-gradient(circle at top left, rgba(15, 118, 110, 0.09), transparent 34%),
            rgba(255, 251, 245, 0.76);
        }

        .card-eyebrow,
        .rail-eyebrow {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: #5b6874;
        }

        .principle-card h2 {
          margin: 0;
          font-family: var(--font-display);
          font-size: 1.35rem;
          line-height: 1.12;
          color: #151d27;
        }

        .principle-card p:last-child {
          margin: 0.8rem 0 0;
          color: #455361;
          line-height: 1.72;
        }

        .ai-first-band {
          display: grid;
          grid-template-columns: minmax(0, 0.92fr) minmax(320px, 0.78fr);
          gap: 1rem;
          align-items: stretch;
          padding: 1.1rem;
          border-radius: 28px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background:
            radial-gradient(circle at top left, rgba(31, 75, 153, 0.1), transparent 34%),
            radial-gradient(circle at bottom right, rgba(31, 111, 120, 0.12), transparent 40%),
            rgba(255, 251, 245, 0.7);
        }

        .ai-first-copy {
          min-width: 0;
          padding: clamp(0.4rem, 2vw, 1rem);
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .ai-first-copy h2 {
          margin: 0;
          max-width: 18ch;
          font-family: var(--font-display);
          font-size: clamp(2rem, 4.5vw, 3.3rem);
          line-height: 0.98;
          color: #151d27;
        }

        .ai-first-copy p:last-child {
          margin: 1rem 0 0;
          max-width: 62ch;
          color: #455361;
          line-height: 1.72;
        }

        .rail-stack {
          display: grid;
          gap: 1rem;
        }

        .rail-card {
          padding: 1rem;
          border-radius: 22px;
          background: rgba(255, 251, 245, 0.7);
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .rail-card ul {
          margin: 0;
          padding-left: 1.1rem;
          color: #455361;
          line-height: 1.7;
        }

        .rail-links {
          display: grid;
          gap: 0.55rem;
        }

        .rail-links :global(.rail-link) {
          display: inline-flex;
          align-items: center;
          min-height: 40px;
          padding: 0.7rem 0.85rem;
          border-radius: 16px;
          text-decoration: none;
          color: #1b2430;
          background: rgba(255, 251, 245, 0.94);
          border: 1px solid rgba(27, 36, 48, 0.08);
          font-weight: 500;
        }

        .rail-links :global(.rail-link:hover) {
          text-shadow: none;
          color: #0f766e;
        }

        .mini-metrics {
          display: grid;
          gap: 0.85rem;
        }

        .mini-metrics div {
          display: grid;
          gap: 0.2rem;
        }

        .mini-metrics strong {
          font-family: var(--font-display);
          font-size: 1.9rem;
          line-height: 1;
          color: #151d27;
        }

        .mini-metrics span {
          color: #4f5c68;
        }

        @media (max-width: 1080px) {
          .principles-grid {
            grid-template-columns: 1fr;
          }

          .ai-first-band {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 720px) {
          .hero-stack {
            padding: 0;
          }

          .hero-stack :global(.entry-surface) {
            max-width: 100%;
            margin-top: 7rem;
            border-radius: 20px;
          }

          .hero-stack :global(.paper-mapper-surface) {
            max-width: 100%;
            margin-top: 3.5rem;
            border-radius: 20px;
          }
        }
      `}</style>
    </NotebookLayout>
  )
}
