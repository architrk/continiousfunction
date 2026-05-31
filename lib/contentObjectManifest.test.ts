import manifestJson from '../content/_generated/content-object-manifest.json'
import { loadConceptMetas } from './contentLoader'
import { validateContentObjectManifest, type ContentObjectManifest } from './contentObjectManifest'

const manifest = manifestJson as ContentObjectManifest
const manifestKeys = new Set(manifest.objects.map((object) => object.key))

describe('content object manifest', () => {
  it('is valid, deterministic, sorted, and duplicate-free', () => {
    expect(validateContentObjectManifest(manifest)).toEqual([])

    const sortedKeys = [...manifestKeys].sort((a, b) => a.localeCompare(b))
    expect(manifest.objects.map((object) => object.key)).toEqual(sortedKeys)
    expect(manifestKeys.size).toBe(manifest.objects.length)
  })

  it('contains canonical concept and route objects for published filesystem concepts', () => {
    const publishedConcepts = loadConceptMetas().filter((concept) => concept.status === 'published')

    for (const concept of publishedConcepts) {
      expect(manifestKeys.has(`concept:${concept.domain}/${concept.id}`)).toBe(true)
      expect(manifestKeys.has(`route:domains/${concept.domain}/${concept.id}`)).toBe(true)
    }
  })

  it('contains demo objects only when a concept has a real visualization', () => {
    const concepts = loadConceptMetas()

    for (const concept of concepts) {
      const hasDemoKey = manifestKeys.has(`demo:${concept.domain}/${concept.id}#interactive-demo`)
      expect(hasDemoKey).toBe(Boolean(concept.has_interactive_demo && concept._vizPath))
    }
  })

  it('indexes high-value concepts down to sources, source spans, equations, code, demos, and claims', () => {
    expect([...manifestKeys]).toEqual(
      expect.arrayContaining([
        'concept:attention-transformers/flash-attention',
        'source:attention-transformers/flash-attention#dao-2022-flashattention',
        'source-span:attention-transformers/flash-attention#dao-2022-flashattention',
        'equation:attention-transformers/flash-attention#math-object-1',
        'code:attention-transformers/flash-attention#code-witness-1',
        'demo:attention-transformers/flash-attention#interactive-demo',
        'claim:attention-transformers/flash-attention#exact-io-aware-tiling',
        'concept:llm-systems/llm-serving',
        'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
        'concept:optimization/adam',
        'claim:optimization/adam#adam-moment-bias-corrected-adaptive-step',
      ])
    )
  })

  it('points claim-check manifest objects at exact claim-review cards with matching discussion anchors', () => {
    const flashClaim = manifest.objects.find(
      (object) => object.key === 'claim:attention-transformers/flash-attention#exact-io-aware-tiling'
    )

    expect(flashClaim).toMatchObject({
      type: 'claim',
      href: '/domains/attention-transformers/flash-attention/#claim-check-exact-io-aware-tiling',
      discussionAnchorId:
        'claim/concept-notebook/attention-transformers/flash-attention/claim-check/exact-io-aware-tiling',
      sourceIds: ['dao-2022-flashattention'],
    })
    expect(flashClaim?.objectRefs).toEqual(
      expect.arrayContaining([
        'source-span:attention-transformers/flash-attention#dao-2022-flashattention',
        'equation:attention-transformers/flash-attention#math-object-1',
        'code:attention-transformers/flash-attention#code-witness-1',
        'demo:attention-transformers/flash-attention#interactive-demo',
      ])
    )
  })

  it('does not invent source-span keys for concepts without structured source notes', () => {
    expect(manifestKeys.has('concept:attention-transformers/grouped-query-attention')).toBe(true)
    expect(
      [...manifestKeys].some((key) => key.startsWith('source-span:attention-transformers/grouped-query-attention#'))
    ).toBe(false)
  })

  it('fails validation for duplicate keys and dangling object refs', () => {
    const duplicateManifest = {
      ...manifest,
      objects: [manifest.objects[0], manifest.objects[0], ...manifest.objects.slice(1)],
    }
    const danglingRefManifest = {
      ...manifest,
      objects: [
        {
          ...manifest.objects[0],
          objectRefs: ['demo:attention-transformers/rope#missing-demo-object'],
        },
        ...manifest.objects.slice(1),
      ],
    }

    expect(validateContentObjectManifest(duplicateManifest).some((issue) => issue.includes('duplicate'))).toBe(true)
    expect(
      validateContentObjectManifest(danglingRefManifest).some((issue) => issue.includes('references missing object'))
    ).toBe(true)
  })
})
