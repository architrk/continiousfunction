import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const MoERoutingViz = dynamic(() => import('@/components/foundations/MoERoutingViz'), {
  ssr: false,
})

export default function MixtureOfExpertsViz() {
  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable mixture-of-experts routing visualization"
    >
      <MoERoutingViz chrome="notebook" conceptId="mixture-of-experts" />
    </VizStageAdapter>
  )
}
