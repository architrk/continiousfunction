import Head from 'next/head'
import NotebookLayout from '@/components/editorial/NotebookLayout'
import LearningRouteContinuityBanner from '@/components/product/LearningRouteContinuityBanner'
import LivingLearningLoopRail from '@/components/product/LivingLearningLoopRail'
import PaperConceptMapper from '@/components/product/PaperConceptMapper'

function PaperMapperHeroFigure() {
  return (
    <figure className="paper-map-hero-figure">
      <img
        src="/images/editorial/product-loop/paper-mapper-handoff.jpg"
        alt="A paper clue becoming one equation, one prerequisite repair, and a lab target."
      />
      <figcaption>
        <span>Map</span>
        One paper clue, one equation, one next experiment.
      </figcaption>

      <style jsx>{`
        .paper-map-hero-figure {
          position: relative;
          min-height: min(590px, calc(100vh - 240px));
          margin: 0;
          overflow: hidden;
          background: #f8f3ea;
        }

        img {
          width: 100%;
          height: 100%;
          min-height: inherit;
          object-fit: cover;
          display: block;
          filter: saturate(0.98) contrast(0.98);
        }

        figcaption {
          position: absolute;
          left: 1rem;
          right: 1rem;
          bottom: 1rem;
          display: grid;
          gap: 0.28rem;
          max-width: 24rem;
          padding: 0.82rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          box-shadow: 0 16px 34px rgba(7, 15, 25, 0.1);
        }

        span {
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        @media (max-width: 720px) {
          .paper-map-hero-figure {
            min-height: 360px;
          }
        }
      `}</style>
    </figure>
  )
}

export default function PaperMapPage() {
  return (
    <>
      <Head>
        <title>Paper-to-Concept Mapper — Continuous Function</title>
        <meta
          name="description"
          content="Paste a frontier AI paper clue and map it to Continuous Function concepts, source evidence, equations, toy labs, and discussion prompts."
        />
      </Head>

      <NotebookLayout
        eyebrow="Paper Mapper"
        title="Map papers into learning paths"
        lede="Map a paper clue into concepts, inspect which claims are grounded in the pasted source and Continuous Function pages, then turn the route into equations, labs, and discussion objects."
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Paper Mapper' },
        ]}
        meta={['source check', 'confidence labels', 'saved in this browser', 'not live yet actions']}
        actions={[
          { href: '#paper-mapper-tool', label: 'Start Mapping' },
          { href: '/paths/attention-serving/', label: 'Open Serving Module', variant: 'secondary' },
        ]}
        ambientImage="/images/editorial/product-loop/paper-mapper-handoff.jpg"
        heroVisual={<PaperMapperHeroFigure />}
      >
        <LearningRouteContinuityBanner surface="paper-map" />
        <LivingLearningLoopRail
          surface="Paper Mapper as research bridge"
          activeKey="evidence"
          summary="A paper clue should become a grounded route: one object to inspect, one claim to source-check, one experiment to run next."
          steps={[
            { key: 'question', label: 'Question', detail: 'Paste the paper clue or carry a saved route observation.' },
            { key: 'object', label: 'Object', detail: 'Map it to concepts, equations, claims, and source objects.' },
            { key: 'evidence', label: 'Evidence', detail: 'Separate local confidence from external paper verification.' },
            { key: 'next', label: 'Next move', detail: 'Open the repair concept, route lab, or discussion prompt.' },
          ]}
        />
        <PaperConceptMapper />
      </NotebookLayout>
    </>
  )
}
