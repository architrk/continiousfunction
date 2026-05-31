import manifestJson from '../content/_generated/content-object-manifest.json'
import {
  validateClaimCheckHandoffIntegrity,
  type ClaimCheckHandoffIntegrityConcept,
} from './claimCheckHandoffIntegrity'
import { buildConceptDiscussionItems } from './conceptNotebookDiscussion'
import { loadConceptMetas } from './contentLoader'
import type { ContentObjectManifest } from './contentObjectManifest'
import { maxDiscussionSeedPromptLength, type DiscussionAnchorListItem } from './discussionAnchors'

const manifest = manifestJson as ContentObjectManifest

const sampleConcept: ClaimCheckHandoffIntegrityConcept = {
  id: 'sample-concept',
  domain: 'sample-domain',
  slug: 'sample-concept',
  title: 'Sample Concept',
  short_description: 'A sample claim-check handoff concept.',
  has_interactive_demo: true,
  _vizPath: 'sample/viz.tsx',
  sources: [
    {
      id: 'source-a',
      title: 'Source A',
      note: 'Grounds the sample claim.',
    },
    {
      id: 'source-b',
      title: 'Source B',
      note: 'Adds a second support witness.',
    },
  ],
  claim_checks: [
    {
      id: 'sample-claim',
      claim: 'Sample claim text with exact mechanism.',
      status: 'source-checked',
      source_ids: ['source-a', 'source-b'],
      support: 'The source support note must survive the handoff.',
      caveat: 'The caveat must also survive the handoff.',
      object_refs: ['#source-span-source-a', '#math-object-1', '#code-witness-1', '#interactive-demo'],
    },
  ],
}

const sampleManifestObjects = [
  {
    key: 'claim:sample-domain/sample-concept#sample-claim',
    type: 'claim',
    href: '/domains/sample-domain/sample-concept/#claim-check-sample-claim',
    sourceIds: ['source-a', 'source-b'],
    objectRefs: [
      'code:sample-domain/sample-concept#code-witness-1',
      'demo:sample-domain/sample-concept#interactive-demo',
      'equation:sample-domain/sample-concept#math-object-1',
      'source-span:sample-domain/sample-concept#source-a',
    ],
    discussionAnchorId: 'claim/concept-notebook/sample-domain/sample-concept/claim-check/sample-claim',
  },
] as const

function validateSample(
  overrides: Partial<Parameters<typeof validateClaimCheckHandoffIntegrity>[0]> = {}
) {
  return validateClaimCheckHandoffIntegrity({
    concepts: [sampleConcept],
    manifestObjects: sampleManifestObjects,
    ...overrides,
  })
}

function mutatedSampleItems(mutator: (item: DiscussionAnchorListItem) => DiscussionAnchorListItem) {
  return () => buildConceptDiscussionItems(sampleConcept, 'Sample Domain', true).map((item) =>
    item.anchor.objectKey === 'claim:sample-domain/sample-concept#sample-claim' ? mutator(item) : item
  )
}

describe('claim check handoff integrity', () => {
  it('passes the current real corpus', () => {
    const concepts = loadConceptMetas().map((concept) => ({
      ...concept,
      has_interactive_demo: concept.has_interactive_demo,
      _vizPath: concept._vizPath,
    }))

    expect(
      validateClaimCheckHandoffIntegrity({
        concepts,
        manifestObjects: manifest.objects,
      })
    ).toEqual([])
  })

  it('passes concepts without claim checks unchanged', () => {
    expect(
      validateClaimCheckHandoffIntegrity({
        concepts: [{ ...sampleConcept, claim_checks: [] }],
        manifestObjects: [],
      })
    ).toEqual([])
  })

  it('fails when support, caveat, source ids, or object refs are absent from the handoff prompt', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        anchor: {
          ...item.anchor,
          contextLabel: 'source checked - source-a',
          sourceIds: ['source-a'],
        },
        thread: {
          ...item.thread,
          seedPrompt: [
            'Review this claim check for Sample Concept.',
            'Claim: Sample claim text with exact mechanism.',
            'Status: source-checked',
            'Source IDs: source-a',
            'Question: Do the cited sources and local witnesses support this precise claim?',
          ].join('\n'),
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CLAIM_CHECK_HANDOFF_PROMPT_SOURCE_ID',
        'CLAIM_CHECK_HANDOFF_PROMPT_SUPPORT',
        'CLAIM_CHECK_HANDOFF_PROMPT_CAVEAT',
        'CLAIM_CHECK_HANDOFF_PROMPT_OBJECT_REF',
        'CLAIM_CHECK_HANDOFF_PROMPT_EVIDENCE_REVIEW',
        'CLAIM_CHECK_HANDOFF_PROMPT_EVIDENCE_WARNING',
        'CLAIM_CHECK_HANDOFF_PROMPT_NO_PROOF_WARNING',
      ])
    )
  })

  it('fails when the reading-room href points at the panel instead of the exact claim card', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        anchor: {
          ...item.anchor,
          href: '/domains/sample-domain/sample-concept/#claim-review',
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toContain('CLAIM_CHECK_HANDOFF_DISCUSSION_HREF')
  })

  it('fails when the object key and anchor id disagree', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        anchor: {
          ...item.anchor,
          id: 'claim/concept-notebook/sample-domain/sample-concept/claim-check/aliased-claim' as never,
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toContain('CLAIM_CHECK_HANDOFF_DISCUSSION_ANCHOR')
  })

  it('fails when source IDs are reordered in the reading-room or route-object handoff', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        anchor: {
          ...item.anchor,
          sourceIds: ['source-b', 'source-a'],
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CLAIM_CHECK_HANDOFF_DISCUSSION_SOURCE_IDS',
        'CLAIM_CHECK_HANDOFF_ROUTE_OBJECT_SOURCE_IDS',
      ])
    )
  })

  it('fails when a claim-check prompt exceeds the accepted seed-prompt bound', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        thread: {
          ...item.thread,
          seedPrompt: 'x'.repeat(maxDiscussionSeedPromptLength + 1),
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toContain('CLAIM_CHECK_HANDOFF_PROMPT_BOUND')
  })

  it('fails when the reading-room object key is missing or wrong', () => {
    const issues = validateSample({
      buildDiscussionItems: mutatedSampleItems((item) => ({
        ...item,
        anchor: {
          ...item.anchor,
          objectKey: 'claim:sample-domain/sample-concept#other-claim',
        },
      })),
    })

    expect(issues.map((issue) => issue.code)).toContain('CLAIM_CHECK_HANDOFF_DISCUSSION_MATCH')
  })

  it('fails when manifest source ids or object refs are sliced', () => {
    const issues = validateSample({
      manifestObjects: [
        {
          ...sampleManifestObjects[0],
          sourceIds: ['source-a'],
          objectRefs: sampleManifestObjects[0].objectRefs.slice(0, 2),
        },
      ],
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CLAIM_CHECK_HANDOFF_MANIFEST_SOURCE_IDS',
        'CLAIM_CHECK_HANDOFF_MANIFEST_OBJECT_REFS',
      ])
    )
  })

  it('fails when manifest source IDs are reordered or typed as a non-claim object', () => {
    const issues = validateSample({
      manifestObjects: [
        {
          ...sampleManifestObjects[0],
          type: 'source',
          sourceIds: ['source-b', 'source-a'],
        },
      ],
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CLAIM_CHECK_HANDOFF_MANIFEST_TYPE',
        'CLAIM_CHECK_HANDOFF_MANIFEST_SOURCE_IDS',
      ])
    )
  })

  it('fails when manifest href or discussion anchor diverges from the exact claim-card target', () => {
    const issues = validateSample({
      manifestObjects: [
        {
          ...sampleManifestObjects[0],
          href: '/domains/sample-domain/sample-concept/#claim-review',
          discussionAnchorId: 'claim/concept-notebook/sample-domain/sample-concept/claim-check/alias',
        },
      ],
    })

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining([
        'CLAIM_CHECK_HANDOFF_MANIFEST_HREF',
        'CLAIM_CHECK_HANDOFF_MANIFEST_ANCHOR',
      ])
    )
  })
})
