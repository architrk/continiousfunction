import dynamic from 'next/dynamic'
import VizShell from '@/components/viz/VizShell'
import VizStageAdapter from '@/components/viz/VizStageAdapter'

const GQAViz = dynamic(() => import('@/components/foundations/GQAViz'), {
  ssr: false,
})

export default function GroupedQueryAttentionConceptViz() {
  return (
    <VizShell
      eyebrow="Interactive demo"
      title="Grouped-query attention: predict the KV sharing invariant"
      subtitle="Change the query-head and KV-head counts, then predict the head-sharing group size and KV-cache fraction before revealing the exact mapping."
      metrics={['Hq query heads', 'Hkv KV heads', 'group size Hq/Hkv', 'KV cache ratio Hkv/Hq']}
      notes={
        <p>
          The demo isolates decoding-time KV-cache memory. It keeps batch,
          layer count, dtype, and K/V storage assumptions fixed so the only
          structural variable is how many KV heads are cached.
        </p>
      }
      challenge={
        <p>
          Before reveal, commit both the query-heads-per-KV-head group size and
          the cache fraction relative to full multi-head attention.
        </p>
      }
    >
      <VizStageAdapter
        padding="none"
        overflowX
        ariaLabel="Scrollable grouped-query attention head-sharing visualization"
      >
        <GQAViz chrome="notebook" conceptId="grouped-query-attention" />
      </VizStageAdapter>
    </VizShell>
  )
}
