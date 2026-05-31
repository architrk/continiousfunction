import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const SparseAutoencoderViz = dynamic(() => import('@/components/foundations/SparseAutoencoderViz'), {
  ssr: false,
})

export default function SparseAutoencodersNotebookViz() {
  return (
    <VizShell
      eyebrow="Mechanistic interpretability lab"
      title="Sparse autoencoder frontier"
      subtitle="Predict how the active-feature budget changes reconstruction error, then compare L1, TopK, and gated SAE mechanisms at the same L0 budget."
      metrics={['toy frontier', 'same L0 comparison', 'reconstruction metric only']}
      notes={
        <p>
          This chart is a hand-shaped teaching model, not a trained SAE benchmark.
          Use it to test reconstruction-sparsity tradeoffs and shrinkage mechanisms,
          not to rank real architectures globally.
        </p>
      }
      challenge={
        <p>
          Predict first: at fixed active-feature budget, which methods should avoid
          L1 shrinkage, and why?
        </p>
      }
    >
      <VizStageAdapter padding="compact">
        <SparseAutoencoderViz chrome="notebook" />
      </VizStageAdapter>
    </VizShell>
  )
}
