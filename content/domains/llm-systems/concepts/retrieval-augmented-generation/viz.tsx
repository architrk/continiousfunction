import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const RetrievalAugmentedGenerationViz = dynamic(
  () => import('@/components/foundations/RetrievalAugmentedGenerationViz'),
  { ssr: false }
)

export default function RetrievalAugmentedGenerationConceptViz() {
  return (
    <VizShell
      eyebrow="Interactive demo"
      title="External memory mixer: coverage is not correctness"
      subtitle="Choose the evidence budget and freshness rerank, predict the regime, then reveal how retrieval weights become an answer distribution."
      metrics={['top-k evidence set', 'evidence mass', 'answer mixture', 'citation support']}
      challenge={
        <p>
          Before revealing, predict whether this setting retrieves no current
          evidence, retrieves current evidence but still answers wrongly, or
          answers correctly because fresh evidence gets enough weight.
        </p>
      }
      notes={
        <p>
          This is a finite toy RAG system. It isolates evidence selection,
          weighting, and citation support; it is not a vector-database survey,
          agent architecture, or guarantee that retrieval prevents hallucination.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable retrieval-augmented-generation evidence mixer"
      >
        <RetrievalAugmentedGenerationViz
          chrome="notebook"
          conceptId="retrieval-augmented-generation"
        />
      </VizStageAdapter>
    </VizShell>
  )
}
