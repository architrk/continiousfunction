import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const SwiGLUViz = dynamic(() => import('@/components/foundations/SwiGLUViz'), {
  ssr: false,
})

export default function SwiGLUConceptViz() {
  return (
    <VizShell
      eyebrow="Interactive demo"
      title="SwiGLU: a gated MLP write, not just a smoother activation"
      subtitle="Inspect one hidden channel: the value branch proposes a token-local write, while the gate branch decides how much of it reaches the residual stream."
      metrics={['value projection', 'SiLU gate', 'elementwise product', '2/3 hidden-width budget']}
      notes={
        <p>
          This is a channel-level toy for a transformer feedforward block. Real
          models learn value, gate, and output projections jointly; this demo
          isolates the elementwise product rather than claiming a benchmark win.
        </p>
      }
      challenge={
        <p>
          Before revealing the product, predict whether the gate suppresses,
          passes, or amplifies the selected value projection.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable SwiGLU gated-MLP visualization"
      >
        <SwiGLUViz chrome="notebook" conceptId="swiglu" />
      </VizStageAdapter>
    </VizShell>
  )
}
