import dynamic from 'next/dynamic'

const KnowledgeGraph = dynamic(
  () => import('../components/KnowledgeGraph'),
  { ssr: false }
)

export default function GraphPage() {
  return <KnowledgeGraph />
}
