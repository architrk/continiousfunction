import {
  buildConceptDiscussionItems,
  claimCheckDomIdForConceptClaimCheck,
  sourceDomIdForConceptSource,
  sourceSegmentForConceptSource,
  sourceSpanDomIdForConceptSource,
  type ConceptNotebookDiscussionConcept,
} from './conceptNotebookDiscussion'
import { maxDiscussionSeedPromptLength } from './discussionAnchors'

const moeConcept: ConceptNotebookDiscussionConcept = {
  id: 'moe-serving',
  title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
  domain: 'llm-systems',
  slug: 'moe-serving',
  short_description:
    'Serving MoE turns sparse compute into a scheduling problem: routing skew can create stragglers and token-dispatch communication can bottleneck.',
  objectSpans: [
    {
      kind: 'equation',
      domId: 'math-object-1',
      snippet: '\\\\mathrm{Bytes}_{comm} \\\\approx 2 T k d_{model} b',
    },
    {
      kind: 'code-witness',
      domId: 'code-witness-1',
      snippet: 'loads = route(tokens, experts)',
      language: 'python',
    },
  ],
  sources: [
    {
      id: 'shazeer-2017-sparsely-gated-moe',
      title: 'Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer',
      authors: 'Noam Shazeer et al.',
      year: 2017,
      kind: 'paper',
      note: 'Introduces sparse expert routing and load-balancing losses.',
    },
    {
      id: 'fedus-2021-switch-transformer',
      title: 'Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity',
      authors: 'William Fedus, Barret Zoph, Noam Shazeer',
      year: 2021,
      kind: 'paper',
      note: 'Shows top-1 routing and practical sparse Transformer scaling.',
    },
  ],
  claim_checks: [
    {
      id: 'routing-load-balance-support',
      status: 'source-checked',
      claim: 'Sparse MoE serving needs load-balancing evidence because routing skew can create stragglers.',
      source_ids: ['shazeer-2017-sparsely-gated-moe', 'fedus-2021-switch-transformer'],
      support: 'Shazeer shows routing pressure.',
      caveat: 'Not a universal serving benchmark.',
      object_refs: ['#source-span-shazeer-2017-sparsely-gated-moe', '#math-object-1', '#code-witness-1'],
    },
    {
      id: 'capacity-drop-needs-review',
      status: 'needs-review',
      claim: 'Capacity limits can force overflow tokens onto a different path in practical MoE systems.',
      source_ids: ['fedus-2021-switch-transformer'],
      support: 'Switch Transformer discusses practical routing capacity.',
      caveat: 'The local page still needs exact evidence for the serving scheduler variant.',
      object_refs: ['#source-span-fedus-2021-switch-transformer', '#interactive-demo'],
    },
  ],
}

describe('concept notebook discussion objects', () => {
  it('adds per-source review objects in addition to the aggregate source grounding object', () => {
    const items = buildConceptDiscussionItems(moeConcept, 'LLM Systems', true)
    const sourceItems = items.filter(
      (item) => item.anchor.objectType === 'source' && !item.anchor.id.includes('/source-span/')
    )

    expect(sourceItems.map((item) => item.anchor.id)).toEqual([
      'source/concept-notebook/llm-systems/moe-serving/sources',
      'source/concept-notebook/llm-systems/moe-serving/source/shazeer-2017-sparsely-gated-moe',
      'source/concept-notebook/llm-systems/moe-serving/source/fedus-2021-switch-transformer',
    ])
    expect(sourceItems[1].anchor.href).toBe(
      '/domains/llm-systems/moe-serving/#source-shazeer-2017-sparsely-gated-moe'
    )
    expect(sourceItems[1].anchor.objectKey).toBe('source:llm-systems/moe-serving#shazeer-2017-sparsely-gated-moe')
    expect(sourceItems[1].anchor.sourceIds).toEqual(['shazeer-2017-sparsely-gated-moe'])
    expect(sourceItems[1].thread.seedPrompt).toContain('directly support the mechanism claim')
  })

  it('adds extracted equation and code-span objects with exact object hrefs', () => {
    const items = buildConceptDiscussionItems(moeConcept, 'LLM Systems', true)

    expect(items.map((item) => item.anchor.id)).toEqual(
      expect.arrayContaining([
        'equation/concept-notebook/llm-systems/moe-serving/math/equation-1',
        'code-witness/concept-notebook/llm-systems/moe-serving/code/code-witness-1',
      ])
    )
    expect(items.find((item) => item.anchor.id.endsWith('/math/equation-1'))?.anchor.href).toBe(
      '/domains/llm-systems/moe-serving/#math-object-1'
    )
    expect(items.find((item) => item.anchor.id.endsWith('/math/equation-1'))?.anchor.objectKey).toBe(
      'equation:llm-systems/moe-serving#math-object-1'
    )
    expect(items.find((item) => item.anchor.id.endsWith('/code/code-witness-1'))?.anchor.objectKey).toBe(
      'code:llm-systems/moe-serving#code-witness-1'
    )
    expect(items.find((item) => item.anchor.id.endsWith('/code/code-witness-1'))?.thread.seedPrompt).toContain(
      'which line mirrors the equation'
    )
  })

  it('adds source-span review objects for source notes', () => {
    const items = buildConceptDiscussionItems(moeConcept, 'LLM Systems', true)
    const sourceSpanItem = items.find(
      (item) =>
        item.anchor.id ===
        'source/concept-notebook/llm-systems/moe-serving/source-span/shazeer-2017-sparsely-gated-moe'
    )

    expect(sourceSpanItem?.anchor.href).toBe(
      '/domains/llm-systems/moe-serving/#source-span-shazeer-2017-sparsely-gated-moe'
    )
    expect(sourceSpanItem?.anchor.objectKey).toBe(
      'source-span:llm-systems/moe-serving#shazeer-2017-sparsely-gated-moe'
    )
    expect(sourceSpanItem?.anchor.sourceIds).toEqual(['shazeer-2017-sparsely-gated-moe'])
    expect(sourceSpanItem?.thread.seedPrompt).toContain('which exact')
    expect(sourceSpanItem?.thread.seedPrompt).toContain('remains unverified')
  })

  it('links the central claim object to the claim review panel', () => {
    const items = buildConceptDiscussionItems(moeConcept, 'LLM Systems', true)
    const claimItem = items.find((item) => item.anchor.objectType === 'claim')

    expect(claimItem?.anchor.href).toBe('/domains/llm-systems/moe-serving/#claim-review')
    expect(claimItem?.anchor.objectKey).toBe('claim:llm-systems/moe-serving#central-claim')
  })

  it('adds claim-check objects with exact object keys, anchors, sources, and review prompts', () => {
    const items = buildConceptDiscussionItems(moeConcept, 'LLM Systems', true)
    const claimItems = items.filter((item) => item.anchor.objectType === 'claim')
    const firstClaimCheck = claimItems.find((item) => item.anchor.id.endsWith('/claim-check/routing-load-balance-support'))
    const secondClaimCheck = claimItems.find((item) => item.anchor.id.endsWith('/claim-check/capacity-drop-needs-review'))

    expect(claimItems.map((item) => item.anchor.objectKey)).toEqual(
      expect.arrayContaining([
        'claim:llm-systems/moe-serving#central-claim',
        'claim:llm-systems/moe-serving#routing-load-balance-support',
        'claim:llm-systems/moe-serving#capacity-drop-needs-review',
      ])
    )
    expect(firstClaimCheck?.anchor.href).toBe('/domains/llm-systems/moe-serving/#claim-check-routing-load-balance-support')
    expect(firstClaimCheck?.anchor.contextLabel).toContain('Source-linked')
    expect(firstClaimCheck?.anchor.contextLabel).toContain('shazeer-2017-sparsely-gated-moe')
    expect(firstClaimCheck?.anchor.sourceIds).toEqual([
      'shazeer-2017-sparsely-gated-moe',
      'fedus-2021-switch-transformer',
    ])
    expect(firstClaimCheck?.thread.seedPrompt).toContain(
      'Sparse MoE serving needs load-balancing evidence because routing skew can create stragglers.'
    )
    expect(firstClaimCheck?.thread.seedPrompt).toContain('shazeer-2017-sparsely-gated-moe')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('fedus-2021-switch-transformer')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('Shazeer shows routing pressure.')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('Not a universal serving benchmark.')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('Evidence review: Source-linked')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('Do not treat attached sources or witness refs as proof')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('#source-span-shazeer-2017-sparsely-gated-moe')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('#math-object-1')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('#code-witness-1')
    expect(firstClaimCheck?.thread.seedPrompt).toContain('support this precise claim')
    expect(secondClaimCheck?.anchor.objectKey).toBe('claim:llm-systems/moe-serving#capacity-drop-needs-review')
  })

  it('does not create fallback claim-check aliases for invalid ids', () => {
    const items = buildConceptDiscussionItems(
      {
        ...moeConcept,
        claim_checks: [
          {
            id: 'Not Valid',
            status: 'needs-review',
            claim: 'This invalid id should not become a selectable claim object.',
          },
        ],
      },
      'LLM Systems',
      true
    )

    expect(items.some((item) => item.anchor.id.includes('/claim-check/'))).toBe(false)
    expect(items.some((item) => item.anchor.id.includes('claim-check-1'))).toBe(false)
  })

  it('keeps concepts without claim checks on the existing central claim behavior', () => {
    const items = buildConceptDiscussionItems({ ...moeConcept, claim_checks: undefined }, 'LLM Systems', true)
    const claimItems = items.filter((item) => item.anchor.objectType === 'claim')

    expect(claimItems).toHaveLength(1)
    expect(claimItems[0].anchor.href).toBe('/domains/llm-systems/moe-serving/#claim-review')
    expect(claimItems[0].anchor.objectKey).toBe('claim:llm-systems/moe-serving#central-claim')
  })

  it('keeps source-span fallback ids aligned with source-card positions', () => {
    const items = buildConceptDiscussionItems(
      {
        ...moeConcept,
        sources: [
          { id: 'Not Valid', title: 'Invalid Source Without Note' },
          { id: 'Also Invalid', title: 'Invalid Source With Note', note: 'Carries the support claim.' },
        ],
      },
      'LLM Systems',
      true
    )
    const sourceSpanItem = items.find((item) => item.anchor.id.includes('/source-span/'))

    expect(sourceSpanItem?.anchor.id).toBe('source/concept-notebook/llm-systems/moe-serving/source-span/source-2')
    expect(sourceSpanItem?.anchor.href).toBe('/domains/llm-systems/moe-serving/#source-span-source-2')
    expect(sourceSpanItem?.anchor.objectKey).toBe('source-span:llm-systems/moe-serving#source-2')
  })

  it('keeps long concept and source text inside discussion-anchor validation limits', () => {
    const items = buildConceptDiscussionItems(
      {
        ...moeConcept,
        title: 'Very Long Concept '.repeat(12).trim(),
        short_description: 'A long mechanism claim '.repeat(30).trim(),
        sources: [
          {
            id: 'source-with-a-valid-segment',
            title: 'Very Long Source Title '.repeat(12).trim(),
            note: 'A long source note '.repeat(20).trim(),
          },
        ],
      },
      'Very Long Domain '.repeat(12).trim(),
      true
    )

    expect(items.length).toBeGreaterThan(0)
    expect(items.every((item) => item.anchor.title.length <= 160)).toBe(true)
    expect(items.every((item) => !item.anchor.contextLabel || item.anchor.contextLabel.length <= 140)).toBe(true)
    expect(items.every((item) => item.thread.seedPrompt.length <= maxDiscussionSeedPromptLength)).toBe(true)
    expect(
      items
        .filter((item) => item.anchor.objectType !== 'claim' || !item.anchor.id.includes('/claim-check/'))
        .every((item) => item.thread.seedPrompt.length <= 360)
    ).toBe(true)
  })

  it('uses stable source DOM ids and safe fallback segments', () => {
    expect(sourceSegmentForConceptSource({ id: 'valid-source-id', title: 'Valid Source' }, 0)).toBe('valid-source-id')
    expect(sourceSegmentForConceptSource({ id: 'Not Valid', title: 'Invalid Source' }, 2)).toBe('source-3')
    expect(sourceDomIdForConceptSource({ id: 'valid-source-id', title: 'Valid Source' }, 0)).toBe(
      'source-valid-source-id'
    )
    expect(sourceSpanDomIdForConceptSource({ id: 'valid-source-id', title: 'Valid Source' }, 0)).toBe(
      'source-span-valid-source-id'
    )
    expect(claimCheckDomIdForConceptClaimCheck({ id: 'valid-claim-id' }, 0)).toBe('claim-check-valid-claim-id')
    expect(claimCheckDomIdForConceptClaimCheck({ id: 'Not Valid' }, 2)).toBeNull()
  })
})
