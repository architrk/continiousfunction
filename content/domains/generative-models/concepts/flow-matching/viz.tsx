import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const FlowMatchingViz = dynamic(() => import('@/components/foundations/FlowMatchingViz'), {
  ssr: false,
})

export default function FlowMatchingConceptViz() {
  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable flow-matching velocity-target visualization"
    >
      <FlowMatchingViz chrome="notebook" conceptId="flow-matching" />
    </VizStageAdapter>
  )
}
