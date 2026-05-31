import {
  CLAIM_EVIDENCE_REVIEW_VERSION,
  type ClaimEvidenceReviewState,
  claimEvidenceReviewLabel,
  claimEvidenceReviewWarning,
  isSubstantiveEvidenceReview,
  normalizeClaimEvidenceReview,
} from './claimEvidenceReview'
import { buildConceptContentObjectKey, type ContentObjectKey } from './contentObjectKeys'
import type { ConceptClaimCheck, ConceptMeta } from './contentLoader'

export const CLAIM_EVIDENCE_REVIEW_QUEUE_VERSION = 'cf-claim-evidence-review-queue-v1' as const

export type ClaimEvidenceReviewQueueItem = {
  domain: string
  conceptId: string
  conceptTitle: string
  slug: string
  conceptStatus: string
  importance: string
  claimCheckId: string
  claim: string
  claimStatus: string
  evidenceReviewState: string
  evidenceReviewLabel: string
  sourceIds: string[]
  objectRefs: string[]
  support?: string
  caveat?: string
  href: string
  objectKey: ContentObjectKey
  priorityScore: number
  riskSignals: string[]
  nextReviewAction: string
}

export type ClaimEvidenceReviewQueueArtifact = {
  version: typeof CLAIM_EVIDENCE_REVIEW_QUEUE_VERSION
  evidenceReviewVersion: typeof CLAIM_EVIDENCE_REVIEW_VERSION
  summary: {
    totalStructuredClaimChecks: number
    substantiveReviewedClaimChecks: number
    reviewPendingClaimChecks: number
    publishedReviewPendingClaimChecks: number
  }
  items: ClaimEvidenceReviewQueueItem[]
}

function compactList(value: readonly string[] | undefined) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean)
}

function importanceRank(value: string) {
  if (value === 'critical') return 0
  if (value === 'important') return 1
  if (value === 'advanced') return 2
  if (value === 'supplementary') return 3
  return 4
}

function statusRank(value: string) {
  if (value === 'published') return 0
  if (value === 'review') return 1
  if (value === 'draft') return 2
  return 3
}

function flagshipDomainBonus(domain: string) {
  return ['attention-transformers', 'llm-systems', 'optimization', 'probability'].includes(domain) ? -2 : 0
}

function riskSignalsForClaimCheck(claimCheck: ConceptClaimCheck) {
  const signals: string[] = []
  const sourceIds = compactList(claimCheck.source_ids)
  const objectRefs = compactList(claimCheck.object_refs)

  if (!sourceIds.length) signals.push('missing-source-ids')
  if (!objectRefs.length) signals.push('missing-local-witness-refs')
  if (!claimCheck.support?.trim()) signals.push('missing-support-note')
  if (!claimCheck.caveat?.trim()) signals.push('missing-caveat')
  if (claimCheck.status !== 'source-checked') signals.push(`claim-status-${claimCheck.status}`)

  return signals
}

function priorityScore(concept: ConceptMeta, claimCheck: ConceptClaimCheck) {
  return (
    statusRank(concept.status) * 100 +
    importanceRank(concept.importance) * 10 +
    flagshipDomainBonus(concept.domain) +
    riskSignalsForClaimCheck(claimCheck).length * -2
  )
}

function nextReviewActionFor(concept: ConceptMeta, claimCheck: ConceptClaimCheck) {
  const sourceIds = compactList(claimCheck.source_ids)
  const objectRefs = compactList(claimCheck.object_refs)
  const sourcePart = sourceIds.length ? `source IDs ${sourceIds.join(', ')}` : 'the missing source IDs'
  const objectPart = objectRefs.length ? `witness refs ${objectRefs.join(', ')}` : 'the missing local witness refs'

  return `Check whether ${sourcePart} and ${objectPart} substantively support ${concept.domain}/${concept.id}#${claimCheck.id}; only then add a substantive evidence_review summary.`
}

export function buildClaimEvidenceReviewQueue(concepts: readonly ConceptMeta[]): ClaimEvidenceReviewQueueItem[] {
  return concepts
    .flatMap((concept) =>
      concept.claim_checks.flatMap((claimCheck) => {
        const review = normalizeClaimEvidenceReview(claimCheck.evidence_review)
        if (isSubstantiveEvidenceReview(review)) return []

        const objectKey = buildConceptContentObjectKey('claim', concept.domain, concept.id, claimCheck.id)
        if (!objectKey) return []

        return [{
          domain: concept.domain,
          conceptId: concept.id,
          conceptTitle: concept.title,
          slug: concept.slug,
          conceptStatus: concept.status,
          importance: concept.importance,
          claimCheckId: claimCheck.id,
          claim: claimCheck.claim,
          claimStatus: claimCheck.status,
          evidenceReviewState: review.state,
          evidenceReviewLabel: claimEvidenceReviewLabel(review),
          sourceIds: compactList(claimCheck.source_ids),
          objectRefs: compactList(claimCheck.object_refs),
          support: claimCheck.support?.trim() || undefined,
          caveat: claimCheck.caveat?.trim() || undefined,
          href: `/domains/${concept.domain}/${concept.slug}/#claim-check-${claimCheck.id}`,
          objectKey,
          priorityScore: priorityScore(concept, claimCheck),
          riskSignals: riskSignalsForClaimCheck(claimCheck),
          nextReviewAction: nextReviewActionFor(concept, claimCheck),
        }]
      })
    )
    .sort((a, b) =>
      a.priorityScore - b.priorityScore ||
      a.domain.localeCompare(b.domain) ||
      a.conceptTitle.localeCompare(b.conceptTitle) ||
      a.claimCheckId.localeCompare(b.claimCheckId)
    )
}

export function buildClaimEvidenceReviewQueueArtifact(
  concepts: readonly ConceptMeta[]
): ClaimEvidenceReviewQueueArtifact {
  const totalStructuredClaimChecks = concepts.reduce((sum, concept) => sum + concept.claim_checks.length, 0)
  const substantiveReviewedClaimChecks = concepts.reduce(
    (sum, concept) =>
      sum + concept.claim_checks.filter((claimCheck) => isSubstantiveEvidenceReview(claimCheck.evidence_review)).length,
    0
  )
  const items = buildClaimEvidenceReviewQueue(concepts)

  return {
    version: CLAIM_EVIDENCE_REVIEW_QUEUE_VERSION,
    evidenceReviewVersion: CLAIM_EVIDENCE_REVIEW_VERSION,
    summary: {
      totalStructuredClaimChecks,
      substantiveReviewedClaimChecks,
      reviewPendingClaimChecks: items.length,
      publishedReviewPendingClaimChecks: items.filter((item) => item.conceptStatus === 'published').length,
    },
    items,
  }
}

export function serializeClaimEvidenceReviewQueueArtifact(artifact: ClaimEvidenceReviewQueueArtifact) {
  return `${JSON.stringify(artifact, null, 2)}\n`
}

export function formatClaimEvidenceReviewQueueMarkdown(artifact: ClaimEvidenceReviewQueueArtifact) {
  const lines = [
    '# Claim Evidence Review Queue',
    '',
    'Generated from structured `claim_checks[]`. This queue tracks substantive source-support review, not handoff plumbing.',
    '',
    '## Summary',
    '',
    `- Structured claim checks: ${artifact.summary.totalStructuredClaimChecks}`,
    `- Substantively reviewed: ${artifact.summary.substantiveReviewedClaimChecks}`,
    `- Review pending: ${artifact.summary.reviewPendingClaimChecks}`,
    `- Published review pending: ${artifact.summary.publishedReviewPendingClaimChecks}`,
    '',
    '## Top Review Items',
    '',
  ]

  artifact.items.slice(0, 25).forEach((item, index) => {
    lines.push(
      `${index + 1}. **${item.domain}/${item.conceptId}#${item.claimCheckId}**`,
      `   - Claim: ${item.claim}`,
      `   - Evidence state: ${item.evidenceReviewLabel}`,
      `   - Warning: ${claimEvidenceReviewWarning({ state: item.evidenceReviewState as ClaimEvidenceReviewState })}`,
      `   - Sources: ${item.sourceIds.length ? item.sourceIds.join(', ') : 'missing'}`,
      `   - Witness refs: ${item.objectRefs.length ? item.objectRefs.join(', ') : 'missing'}`,
      `   - Support note: ${item.support ?? 'missing'}`,
      `   - Caveat: ${item.caveat ?? 'missing'}`,
      `   - Next: ${item.nextReviewAction}`,
      ''
    )
  })

  return `${lines.join('\n').trimEnd()}\n`
}
