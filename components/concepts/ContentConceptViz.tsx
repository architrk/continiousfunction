import { contentConceptVizMap } from '../../content/_generated/vizMap'

type Props = {
  conceptId: string
}

export default function ContentConceptViz({ conceptId }: Props) {
  const Viz = contentConceptVizMap[conceptId]

  return Viz ? <Viz /> : null
}
