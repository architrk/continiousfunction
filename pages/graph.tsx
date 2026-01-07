import dynamic from 'next/dynamic'
import Head from 'next/head'

const KnowledgeGraph = dynamic(
  () => import('../components/KnowledgeGraph'),
  { ssr: false }
)

export default function GraphPage() {
  return (
    <>
      <Head>
        <title>Knowledge Graph — Continuous Function</title>
      </Head>
      <KnowledgeGraph />
    </>
  )
}
