import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const DiffusionProcessViz = dynamic(() => import('@/components/foundations/DiffusionProcessViz'), {
  ssr: false,
})

export default function DiffusionViz() {
  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable diffusion forward-process visualization"
    >
      <DiffusionProcessViz chrome="notebook" conceptId="diffusion" />
    </VizStageAdapter>
  )
}
