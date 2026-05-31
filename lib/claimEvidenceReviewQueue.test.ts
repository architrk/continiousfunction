import {
  buildClaimEvidenceReviewQueue,
  buildClaimEvidenceReviewQueueArtifact,
  serializeClaimEvidenceReviewQueueArtifact,
} from './claimEvidenceReviewQueue'
import { loadConceptMetas, type ConceptMeta } from './contentLoader'

function concept(overrides: Partial<ConceptMeta>): ConceptMeta {
  return {
    id: 'sample-concept',
    title: 'Sample Concept',
    domain: 'sample-domain',
    slug: 'sample-concept',
    difficulty: 3,
    status: 'published',
    importance: 'important',
    prerequisites: [],
    leads_to: [],
    related: [],
    tags: [],
    has_visualization: true,
    has_interactive_demo: true,
    has_code_example: true,
    math_level: 'undergraduate',
    sources: [],
    claim_checks: [],
    short_description: 'A sample concept.',
    author: 'codex',
    created: '2026-05-06',
    updated: '2026-05-06',
    estimated_read_time: 10,
    _dirPath: '',
    _conceptYamlPath: '',
    _contentMdxPath: '',
    _vizPath: 'viz.tsx',
    ...overrides,
  }
}

describe('claim evidence review queue', () => {
  it('queues non-substantive claim checks with conservative evidence state', () => {
    const items = buildClaimEvidenceReviewQueue([
      concept({
        claim_checks: [
          {
            id: 'source-linked-claim',
            claim: 'A source-linked claim still needs substantive review.',
            status: 'source-checked',
            source_ids: ['source-a'],
            support: 'Support note.',
            caveat: 'Caveat note.',
            object_refs: ['#math-object-1'],
          },
          {
            id: 'reviewed-claim',
            claim: 'A reviewed claim should leave the queue.',
            status: 'source-checked',
            source_ids: ['source-a'],
            support: 'Support note.',
            caveat: 'Caveat note.',
            object_refs: ['#math-object-1'],
            evidence_review: {
              state: 'substantive-reviewed',
              reviewed_at: '2026-05-06',
              reviewer: 'oracle',
              summary: 'The exact source span supports the bounded claim.',
            },
          },
        ],
      }),
    ])

    expect(items).toHaveLength(1)
    expect(items[0]).toEqual(
      expect.objectContaining({
        claimCheckId: 'source-linked-claim',
        evidenceReviewState: 'source-linked',
        evidenceReviewLabel: 'Source-linked; substantive support review pending',
        support: 'Support note.',
        caveat: 'Caveat note.',
        href: '/domains/sample-domain/sample-concept/#claim-check-source-linked-claim',
        objectKey: 'claim:sample-domain/sample-concept#source-linked-claim',
      })
    )
    expect(items[0].nextReviewAction).toContain('only then add a substantive evidence_review summary')
  })

  it('sorts published and critical or flagship claims before lower-priority review concepts', () => {
    const items = buildClaimEvidenceReviewQueue([
      concept({
        id: 'review-concept',
        title: 'Review Concept',
        status: 'review',
        importance: 'supplementary',
        claim_checks: [
          {
            id: 'review-claim',
            claim: 'Review claim.',
            status: 'needs-review',
          },
        ],
      }),
      concept({
        id: 'attention-claim',
        title: 'Attention Claim',
        domain: 'attention-transformers',
        slug: 'attention-claim',
        importance: 'critical',
        claim_checks: [
          {
            id: 'critical-claim',
            claim: 'Critical attention claim.',
            status: 'source-checked',
            source_ids: ['source-a'],
            support: 'Support note.',
            caveat: 'Caveat note.',
            object_refs: ['#interactive-demo'],
          },
        ],
      }),
    ])

    expect(items.map((item) => item.claimCheckId)).toEqual(['critical-claim', 'review-claim'])
  })

  it('sorts riskier pending claims earlier inside the same concept priority band', () => {
    const items = buildClaimEvidenceReviewQueue([
      concept({
        claim_checks: [
          {
            id: 'cleaner-claim',
            claim: 'A cleaner claim still needs review.',
            status: 'source-checked',
            source_ids: ['source-a'],
            support: 'Support note.',
            caveat: 'Caveat note.',
            object_refs: ['#math-object-1'],
          },
          {
            id: 'riskier-claim',
            claim: 'A riskier claim should surface first.',
            status: 'needs-review',
          },
        ],
      }),
    ])

    expect(items.map((item) => item.claimCheckId)).toEqual(['riskier-claim', 'cleaner-claim'])
    expect(items[0].riskSignals).toEqual([
      'missing-source-ids',
      'missing-local-witness-refs',
      'missing-support-note',
      'missing-caveat',
      'claim-status-needs-review',
    ])
  })

  it('builds a deterministic artifact for the current corpus', () => {
    const artifact = buildClaimEvidenceReviewQueueArtifact(loadConceptMetas())
    const serialized = serializeClaimEvidenceReviewQueueArtifact(artifact)

    expect(artifact.summary.totalStructuredClaimChecks).toBeGreaterThan(0)
    expect(artifact.summary.reviewPendingClaimChecks).toBe(artifact.items.length)
    expect(artifact.summary.publishedReviewPendingClaimChecks).toBeGreaterThan(0)
    expect(serialized).toBe(serializeClaimEvidenceReviewQueueArtifact(artifact))
  })
})
