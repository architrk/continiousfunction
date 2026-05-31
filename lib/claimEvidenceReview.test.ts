import {
  claimEvidenceReviewLabel,
  claimEvidenceReviewPromptLines,
  claimEvidenceReviewWarning,
  isSubstantiveEvidenceReview,
  validateSubstantiveEvidenceReviewSourceIds,
} from './claimEvidenceReview'

describe('claim evidence review', () => {
  it('keeps default source-linked labels conservative', () => {
    expect(claimEvidenceReviewLabel(undefined)).toBe('Source-linked; substantive support review pending')
    expect(claimEvidenceReviewWarning(undefined)).toBe('Attached source IDs and witness refs are review targets, not proof.')
    expect(claimEvidenceReviewPromptLines(undefined)).toContain(
      'Do not treat attached sources or witness refs as proof; check whether they support the exact claim.'
    )
  })

  it('recognizes substantive review only from explicit state metadata', () => {
    expect(isSubstantiveEvidenceReview({ state: 'substantive-reviewed' })).toBe(true)
    expect(isSubstantiveEvidenceReview({ state: 'source-note-reviewed' })).toBe(false)
  })

  it('requires substantive reviews to cite at least one valid listed source id', () => {
    const knownSourceIds = new Set(['listed-source'])

    expect(validateSubstantiveEvidenceReviewSourceIds(['listed-source'], knownSourceIds)).toEqual([])
    expect(validateSubstantiveEvidenceReviewSourceIds([' '], knownSourceIds)).toEqual([
      expect.objectContaining({
        code: 'ITEM',
      }),
      expect.objectContaining({
        code: 'MISSING',
      }),
    ])
    expect(validateSubstantiveEvidenceReviewSourceIds(['missing-source'], knownSourceIds)).toEqual([
      expect.objectContaining({
        code: 'UNKNOWN',
      }),
      expect.objectContaining({
        code: 'MISSING',
      }),
    ])
  })
})
