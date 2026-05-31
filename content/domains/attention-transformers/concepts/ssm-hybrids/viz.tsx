import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const MambaViz = dynamic(() => import('@/components/foundations/MambaViz'), {
  ssr: false,
})

export default function SsmHybridsViz() {
  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Selective gates decide what fixed state writes, copies, or forgets"
      subtitle="Predict whether a fixed-update recurrence, a token-dependent selective gate, or a tie preserves marked tokens through distractors."
      metrics={['fixed recurrent state', 'per-token delta gate', 'reveal-gated readout', 'compressed memory caveat']}
      notes={
        <p>
          This is a scalar gate mechanism isolate. It does not implement full
          Mamba layers, learned token-dependent B/C projections, convolutional
          mixing, hardware-aware scan kernels, hybrid local attention, MoE
          routing, or production latency behavior.
        </p>
      }
      challenge={
        <p>
          Before revealing the traces, inspect the token sequence and gate preset,
          then predict which recurrence keeps the marked signal cleanest.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable SSM selective-gate memory prediction visualization"
      >
        <MambaViz chrome="notebook" conceptId="ssm-hybrids" />
      </VizStageAdapter>
    </VizShell>
  )
}
