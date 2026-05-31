import dynamic from 'next/dynamic'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const StructuredDecodingViz = dynamic(() => import('@/components/foundations/StructuredDecodingViz'), {
  ssr: false,
})

export default function StructuredDecodingDemo() {
  return (
    <VizStageAdapter
      padding="none"
      overflowX
      ariaLabel="Scrollable structured decoding schema-mask visualization"
    >
      <StructuredDecodingViz chrome="notebook" conceptId="structured-decoding" />
    </VizStageAdapter>
  )
}
