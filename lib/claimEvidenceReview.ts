export const CLAIM_EVIDENCE_REVIEW_VERSION = 'cf-claim-evidence-review-v1' as const

export const claimEvidenceReviewStates = [
  'source-linked',
  'source-note-reviewed',
  'substantive-reviewed',
] as const

export type ClaimEvidenceReviewState = (typeof claimEvidenceReviewStates)[number]

export type ClaimEvidenceReview = {
  state: ClaimEvidenceReviewState
  reviewed_at?: string
  reviewer?: string
  summary?: string
}

export type ClaimEvidenceReviewInput = Partial<ClaimEvidenceReview> | undefined

export type ClaimEvidenceReviewSourceIdIssue = {
  code: 'MISSING' | 'ITEM' | 'UNKNOWN'
  message: string
}

const stateLabels: Record<ClaimEvidenceReviewState, string> = {
  'source-linked': 'Source-linked; substantive support review pending',
  'source-note-reviewed': 'Source-note reviewed; substantive support review pending',
  'substantive-reviewed': 'Substantively reviewed',
}

const pendingWarnings: Record<ClaimEvidenceReviewState, string> = {
  'source-linked': 'Attached source IDs and witness refs are review targets, not proof.',
  'source-note-reviewed': 'The source note has been inspected, but exact source support still needs substantive review.',
  'substantive-reviewed': 'A bounded review summary is present; still check caveats and exact source scope.',
}

function isClaimEvidenceReviewState(value: unknown): value is ClaimEvidenceReviewState {
  return typeof value === 'string' && (claimEvidenceReviewStates as readonly string[]).includes(value)
}

function boundedString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return undefined
  const text = value.trim()
  if (!text) return undefined
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3).trimEnd()}...`
}

export function normalizeClaimEvidenceReview(value: unknown): ClaimEvidenceReview {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { state: 'source-linked' }
  }

  const input = value as Record<string, unknown>
  const state = isClaimEvidenceReviewState(input.state) ? input.state : 'source-linked'

  return {
    state,
    reviewed_at: boundedString(input.reviewed_at, 24),
    reviewer: boundedString(input.reviewer, 80),
    summary: boundedString(input.summary, 520),
  }
}

export function claimEvidenceReviewLabel(value: ClaimEvidenceReviewInput) {
  const review = normalizeClaimEvidenceReview(value)
  return stateLabels[review.state]
}

export function claimEvidenceReviewWarning(value: ClaimEvidenceReviewInput) {
  const review = normalizeClaimEvidenceReview(value)
  return pendingWarnings[review.state]
}

export function claimEvidenceReviewPromptLines(value: ClaimEvidenceReviewInput) {
  const review = normalizeClaimEvidenceReview(value)
  return [
    `Evidence review: ${stateLabels[review.state]}`,
    review.reviewed_at ? `Evidence reviewed at: ${review.reviewed_at}` : undefined,
    review.reviewer ? `Evidence reviewer: ${review.reviewer}` : undefined,
    review.summary ? `Evidence review summary: ${review.summary}` : undefined,
    `Evidence review warning: ${pendingWarnings[review.state]}`,
    'Do not treat attached sources or witness refs as proof; check whether they support the exact claim.',
  ].filter((line): line is string => Boolean(line))
}

export function isSubstantiveEvidenceReview(value: ClaimEvidenceReviewInput) {
  return normalizeClaimEvidenceReview(value).state === 'substantive-reviewed'
}

export function validateSubstantiveEvidenceReviewSourceIds(
  value: unknown,
  knownSourceIds: ReadonlySet<string>
): ClaimEvidenceReviewSourceIdIssue[] {
  const issues: ClaimEvidenceReviewSourceIdIssue[] = []
  const sourceIds = Array.isArray(value) ? value : []
  const validSourceIds: string[] = []

  for (const sourceId of sourceIds) {
    if (typeof sourceId !== 'string' || !sourceId.trim() || sourceId.length > 80) {
      issues.push({
        code: 'ITEM',
        message: 'substantive-reviewed claim_checks need every source_id to be a compact nonblank string',
      })
      continue
    }

    const trimmed = sourceId.trim()
    if (!knownSourceIds.has(trimmed)) {
      issues.push({
        code: 'UNKNOWN',
        message: `substantive-reviewed claim_check source_id '${trimmed}' must be listed in sources`,
      })
      continue
    }

    validSourceIds.push(trimmed)
  }

  if (!validSourceIds.length) {
    issues.push({
      code: 'MISSING',
      message: 'substantive-reviewed claim_checks need at least one valid listed source_id',
    })
  }

  return issues
}
