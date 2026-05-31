import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const DiffusionScoreViz = dynamic(() => import('@/components/foundations/DiffusionScoreViz'), {
  ssr: false,
})

export default function ScoreMatchingViz() {
  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable score-matching visualization"
    >
      <DiffusionScoreViz chrome="notebook" conceptId="score-matching" />
    </VizStageAdapter>
  )
}
