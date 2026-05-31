import type { GetStaticProps } from 'next'
import Head from 'next/head'
import HomeLanding, { type HomeLandingProps } from '@/components/home/HomeLanding'

type Importance = 'critical' | 'important' | 'supplementary' | 'advanced'
type ConceptLink = {
  title: string
  href: string
  description: string
  readTime: number
  hasDemo: boolean
  hasCode: boolean
}

const importanceWeight: Record<Importance, number> = {
  critical: 0,
  important: 1,
  supplementary: 2,
  advanced: 3,
}

export const getStaticProps: GetStaticProps<HomeLandingProps> = async () => {
  const { loadDomains, loadConceptMetas } = await import('../lib/contentLoader')

  const domains = loadDomains()
  const concepts = loadConceptMetas()

  const conceptById = new Map(concepts.map((concept) => [concept.id, concept]))
  const publishedConcepts = concepts.filter((concept) => concept.status === 'published')
  const liveDemos = concepts.filter((concept) => concept.has_visualization || concept.has_interactive_demo).length
  const codeExamples = concepts.filter((concept) => concept.has_code_example).length

  const toConceptLink = (conceptId: string): ConceptLink | null => {
    const concept = conceptById.get(conceptId)
    if (!concept) {
      return null
    }

    return {
      title: concept.title,
      href: `/domains/${concept.domain}/${concept.slug}/`,
      description: concept.short_description,
      readTime: concept.estimated_read_time,
      hasDemo: concept.has_visualization || concept.has_interactive_demo,
      hasCode: concept.has_code_example,
    }
  }

  const toPathwayLink = (conceptId: string) => {
    const concept = toConceptLink(conceptId)
    if (!concept) return null

    return {
      href: concept.href,
      linkLabel: concept.title,
    }
  }

  const isConceptLink = (concept: ConceptLink | null): concept is ConceptLink => concept !== null

  const sortConcepts = (left: typeof concepts[number], right: typeof concepts[number]) => {
    const importanceDelta = importanceWeight[left.importance as Importance] - importanceWeight[right.importance as Importance]
    if (importanceDelta !== 0) {
      return importanceDelta
    }

    const demoDelta = Number(right.has_visualization || right.has_interactive_demo) - Number(left.has_visualization || left.has_interactive_demo)
    if (demoDelta !== 0) {
      return demoDelta
    }

    return left.title.localeCompare(right.title)
  }

  const homeDomains = domains.map((domain) => {
    const inDomain = concepts.filter((concept) => concept.domain === domain.id)
    const featuredConcepts = inDomain
      .filter((concept) => concept.status === 'published')
      .sort(sortConcepts)
      .slice(0, 3)
      .map((concept) => concept.title)

    return {
      id: domain.id,
      title: domain.title,
      description: domain.description,
      color: domain.color,
      conceptCount: inDomain.length,
      demoCount: inDomain.filter((concept) => concept.has_visualization || concept.has_interactive_demo).length,
      featuredConcepts,
    }
  })

  const pathwaySeeds = [
    {
      id: 'intuition',
      title: 'Intuition',
      kicker: 'Start with motion, shape, and analogy.',
      description: 'Each concept opens with a mental model you can carry before the notation starts.',
      note: 'Geometry, routing, density, and flow before formalism.',
      accent: '#0f766e',
      conceptId: 'dot-product',
    },
    {
      id: 'math',
      title: 'Math',
      kicker: 'Write the objects down precisely.',
      description: 'Definitions, symbols, and derivations stay close to the intuition instead of replacing it.',
      note: 'Derivatives, KL, vector spaces, and chain rule done step by step.',
      accent: '#f97316',
      conceptId: 'chain-rule',
    },
    {
      id: 'code',
      title: 'Code',
      kicker: 'Match notation to runnable Python.',
      description: 'The symbols on the page become short NumPy or PyTorch fragments you can actually run.',
      note: 'Code mirrors the math instead of hiding it behind frameworks.',
      accent: '#3b82f6',
      conceptId: 'adam',
    },
    {
      id: 'demo',
      title: 'Demo',
      kicker: 'Manipulate the system and watch it respond.',
      description: 'Interactive diagrams turn abstract machinery into something you can stress-test, poke, and break.',
      note: 'Attention, diffusion, routing, and serving concepts become explorable.',
      accent: '#6366f1',
      conceptId: 'attention-transformers',
    },
  ]

  const pathway = pathwaySeeds.flatMap((step) => {
    const concept = toPathwayLink(step.conceptId)
    if (!concept) return []
    return [{
      id: step.id,
      title: step.title,
      kicker: step.kicker,
      description: step.description,
      note: step.note,
      accent: step.accent,
      ...concept,
    }]
  })

  const tracks = [
    {
      title: 'Foundations First',
      description: 'Build the minimum mathematical language needed to understand optimization and modern model training.',
      href: '/domains/linear-algebra/',
      accent: '#0f766e',
      concepts: [
        toConceptLink('dot-product'),
        toConceptLink('vector-spaces'),
        toConceptLink('derivatives'),
        toConceptLink('maximum-likelihood'),
      ].filter(isConceptLink),
    },
    {
      title: 'Transformer Systems',
      description: 'Move from attention mechanics to the engineering decisions that make long-context inference work.',
      href: '/domains/attention-transformers/',
      accent: '#6366f1',
      concepts: [
        toConceptLink('dot-product'),
        toConceptLink('attention-transformers'),
        toConceptLink('efficient-attention'),
        toConceptLink('long-context'),
      ].filter(isConceptLink),
    },
    {
      title: 'Frontier Notebooks',
      description: 'Use the foundations to step into generation, alignment, and inspectable model representations.',
      href: '/domains/representation-learning/',
      accent: '#ec4899',
      concepts: [
        toConceptLink('attention-transformers'),
        toConceptLink('sparse-autoencoders'),
        toConceptLink('dpo'),
        toConceptLink('diffusion'),
      ].filter(isConceptLink),
    },
  ]

  const startHere = [
    toConceptLink('vector-spaces'),
    toConceptLink('derivatives'),
    toConceptLink('maximum-likelihood'),
    toConceptLink('attention-transformers'),
  ].filter(isConceptLink)

  return {
    props: {
      stats: [
        { value: String(domains.length), label: 'domains' },
        { value: String(concepts.length), label: 'live concepts' },
        { value: String(codeExamples), label: 'code examples' },
        { value: String(liveDemos), label: 'interactive demos' },
      ],
      domains: homeDomains,
      pathway,
      tracks,
      startHere,
      totalPublished: publishedConcepts.length,
    },
  }
}

export default function HomePage(props: HomeLandingProps) {
  return (
    <>
      <Head>
        <title>Continuous Function — Understand Frontier AI Papers</title>
        <meta
          name="description"
          content="Understand frontier AI papers through interactive math, concept maps, equation explanations, toy labs, source-grounded AI tutoring, and structured discussion."
        />
      </Head>
      <HomeLanding {...props} />
    </>
  )
}
