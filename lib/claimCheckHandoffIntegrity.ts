import {
  buildConceptDiscussionItems,
  type ConceptNotebookClaimCheck,
  type ConceptNotebookDiscussionConcept,
} from './conceptNotebookDiscussion'
import {
  maxDiscussionSeedPromptLength,
  type DiscussionAnchorListItem,
} from './discussionAnchors'
import {
  buildConceptContentObjectKey,
  contentObjectKeyForConceptFragmentRef,
  isContentObjectKey,
  type ContentObjectKey,
} from './contentObjectKeys'
import { buildResearchDiscussionRoomPacket } from './researchDiscussionRoom'
import type { ContentObjectManifestObject } from './contentObjectManifest'
import {
  claimEvidenceReviewLabel,
  claimEvidenceReviewWarning,
} from './claimEvidenceReview'

export type ClaimCheckHandoffIntegrityConcept = ConceptNotebookDiscussionConcept & {
  has_interactive_demo?: boolean
  has_visualization?: boolean
  _vizPath?: string | null
}

export type ClaimCheckHandoffIntegrityIssue = {
  code: string
  message: string
  conceptId: string
  claimCheckId?: string
}

type ValidateClaimCheckHandoffIntegrityInput = {
  concepts: readonly ClaimCheckHandoffIntegrityConcept[]
  manifestObjects: readonly Pick<
    ContentObjectManifestObject,
    'key' | 'type' | 'href' | 'sourceIds' | 'objectRefs' | 'discussionAnchorId'
  >[]
  domainTitleById?: Readonly<Record<string, string>>
  buildDiscussionItems?: (
    concept: ClaimCheckHandoffIntegrityConcept,
    domainTitle: string,
    hasVisualization: boolean
  ) => readonly DiscussionAnchorListItem[]
}

function compactList(value: readonly string[] | undefined) {
  return (value ?? []).map((item) => item.trim()).filter(Boolean)
}

function sameOrderedList(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const a = compactList(left)
  const b = compactList(right)
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function sameSet(left: readonly string[] | undefined, right: readonly string[] | undefined) {
  const a = compactList(left).sort()
  const b = compactList(right).sort()
  return a.length === b.length && a.every((item, index) => item === b[index])
}

function hasText(haystack: string, needle: string | undefined) {
  const text = needle?.trim()
  return !text || haystack.includes(text)
}

function expectedClaimCheckObjectRefs(concept: ClaimCheckHandoffIntegrityConcept, claimCheck: ConceptNotebookClaimCheck) {
  const refs: ContentObjectKey[] = []
  const unsupported: string[] = []

  for (const objectRef of compactList(claimCheck.object_refs)) {
    if (isContentObjectKey(objectRef)) {
      refs.push(objectRef)
      continue
    }

    const key = contentObjectKeyForConceptFragmentRef(concept.domain, concept.id, objectRef)
    if (key) {
      refs.push(key)
    } else {
      unsupported.push(objectRef)
    }
  }

  return { refs, unsupported }
}

function claimCheckIssue(
  concept: ClaimCheckHandoffIntegrityConcept,
  claimCheck: Pick<ConceptNotebookClaimCheck, 'id'>,
  code: string,
  message: string
): ClaimCheckHandoffIntegrityIssue {
  return {
    code,
    message,
    conceptId: `${concept.domain}/${concept.id}`,
    claimCheckId: claimCheck.id,
  }
}

function findClaimCheckItems(items: readonly DiscussionAnchorListItem[], objectKey: ContentObjectKey) {
  return items.filter((item) => item.anchor.objectType === 'claim' && item.anchor.objectKey === objectKey)
}

export function validateClaimCheckHandoffIntegrity({
  concepts,
  manifestObjects,
  domainTitleById = {},
  buildDiscussionItems = buildConceptDiscussionItems,
}: ValidateClaimCheckHandoffIntegrityInput): ClaimCheckHandoffIntegrityIssue[] {
  const issues: ClaimCheckHandoffIntegrityIssue[] = []
  const manifestByKey = new Map(manifestObjects.map((object) => [object.key, object]))

  for (const concept of concepts) {
    const claimChecks = (concept.claim_checks ?? []).filter((claimCheck) => claimCheck.id && claimCheck.claim)
    if (!claimChecks.length) continue

    const items = buildDiscussionItems(
      concept,
      domainTitleById[concept.domain] ?? concept.domain,
      Boolean(concept.has_interactive_demo && concept._vizPath)
    )

    for (const claimCheck of claimChecks) {
      const expectedKey = buildConceptContentObjectKey('claim', concept.domain, concept.id, claimCheck.id)
      if (!expectedKey) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_KEY_INVALID',
            `Unable to build claim-check object key for ${concept.domain}/${concept.id}#${claimCheck.id}.`
          )
        )
        continue
      }

      const expectedHref = `/domains/${concept.domain}/${concept.slug}/#claim-check-${claimCheck.id}`
      const expectedAnchorId = `claim/concept-notebook/${concept.domain}/${concept.id}/claim-check/${claimCheck.id}`
      const expectedSourceIds = compactList(claimCheck.source_ids)
      const expectedObjectRefs = expectedClaimCheckObjectRefs(concept, claimCheck)

      if (expectedObjectRefs.unsupported.length) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_OBJECT_REF_UNSUPPORTED',
            `Unsupported claim-check object refs: ${expectedObjectRefs.unsupported.join(', ')}.`
          )
        )
      }

      const manifestObject = manifestByKey.get(expectedKey)
      if (!manifestObject) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_MANIFEST_MISSING',
            `Manifest is missing claim-check object ${expectedKey}.`
          )
        )
      } else {
        if (manifestObject.type !== 'claim') {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              'CLAIM_CHECK_HANDOFF_MANIFEST_TYPE',
              `Manifest object ${expectedKey} must have type claim.`
            )
          )
        }
        if (manifestObject.href !== expectedHref) {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              'CLAIM_CHECK_HANDOFF_MANIFEST_HREF',
              `Manifest href for ${expectedKey} must be ${expectedHref}.`
            )
          )
        }
        if (manifestObject.discussionAnchorId !== expectedAnchorId) {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              'CLAIM_CHECK_HANDOFF_MANIFEST_ANCHOR',
              `Manifest discussionAnchorId for ${expectedKey} must be ${expectedAnchorId}.`
            )
          )
        }
        if (!sameOrderedList(manifestObject.sourceIds, expectedSourceIds)) {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              'CLAIM_CHECK_HANDOFF_MANIFEST_SOURCE_IDS',
              `Manifest sourceIds for ${expectedKey} must exactly match claim_check.source_ids.`
            )
          )
        }
        if (!sameSet(manifestObject.objectRefs, expectedObjectRefs.refs)) {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              'CLAIM_CHECK_HANDOFF_MANIFEST_OBJECT_REFS',
              `Manifest objectRefs for ${expectedKey} must preserve every claim_check.object_ref as a content object key.`
            )
          )
        }
      }

      const matches = findClaimCheckItems(items, expectedKey)
      if (matches.length !== 1) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_DISCUSSION_MATCH',
            `Expected exactly one Reading Room claim-check item for ${expectedKey}, found ${matches.length}.`
          )
        )
        continue
      }

      const item = matches[0]
      if (item.anchor.id !== expectedAnchorId) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_DISCUSSION_ANCHOR',
            `Reading Room anchor for ${expectedKey} must be ${expectedAnchorId}, got ${item.anchor.id}.`
          )
        )
      }
      if (item.anchor.href !== expectedHref) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_DISCUSSION_HREF',
            `Reading Room href for ${expectedKey} must be ${expectedHref}.`
          )
        )
      }
      if (!sameOrderedList(item.anchor.sourceIds, expectedSourceIds)) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_DISCUSSION_SOURCE_IDS',
            `Reading Room sourceIds for ${expectedKey} must exactly match claim_check.source_ids.`
          )
        )
      }

      const packet = buildResearchDiscussionRoomPacket(item)
      const handoffPrompt = packet.aiPrompt

      if (packet.routeObject.objectKey !== expectedKey) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_ROUTE_OBJECT_KEY',
            `Route object for ${expectedKey} must preserve the selected claim-check object key.`
          )
        )
      }
      if (packet.routeObject.href !== expectedHref) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_ROUTE_OBJECT_HREF',
            `Route object for ${expectedKey} must preserve the exact claim-check href.`
          )
        )
      }
      if (packet.routeObject.discussionAnchorId !== expectedAnchorId) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_ROUTE_OBJECT_ANCHOR',
            `Route object for ${expectedKey} must preserve the exact claim-check discussion anchor.`
          )
        )
      }
      if (!sameOrderedList(packet.routeObject.sourceIds, expectedSourceIds)) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_ROUTE_OBJECT_SOURCE_IDS',
            `Route object for ${expectedKey} must preserve ordered claim-check source IDs.`
          )
        )
      }

      const requiredStrings = [
        { code: 'CLAIM_CHECK_HANDOFF_PROMPT_CONCEPT', label: 'concept title', value: concept.title },
        { code: 'CLAIM_CHECK_HANDOFF_PROMPT_CLAIM', label: 'claim text', value: claimCheck.claim },
        { code: 'CLAIM_CHECK_HANDOFF_PROMPT_STATUS', label: 'status', value: claimCheck.status },
        {
          code: 'CLAIM_CHECK_HANDOFF_PROMPT_EVIDENCE_REVIEW',
          label: 'evidence review state',
          value: claimEvidenceReviewLabel(claimCheck.evidence_review),
        },
        {
          code: 'CLAIM_CHECK_HANDOFF_PROMPT_EVIDENCE_WARNING',
          label: 'evidence review warning',
          value: claimEvidenceReviewWarning(claimCheck.evidence_review),
        },
        {
          code: 'CLAIM_CHECK_HANDOFF_PROMPT_NO_PROOF_WARNING',
          label: 'no-proof warning',
          value: 'Do not treat attached sources or witness refs as proof',
        },
        ...expectedSourceIds.map((sourceId) => ({
          code: 'CLAIM_CHECK_HANDOFF_PROMPT_SOURCE_ID',
          label: `source id ${sourceId}`,
          value: sourceId,
        })),
        { code: 'CLAIM_CHECK_HANDOFF_PROMPT_SUPPORT', label: 'support note', value: claimCheck.support },
        { code: 'CLAIM_CHECK_HANDOFF_PROMPT_CAVEAT', label: 'caveat note', value: claimCheck.caveat },
        ...compactList(claimCheck.object_refs).map((objectRef) => ({
          code: 'CLAIM_CHECK_HANDOFF_PROMPT_OBJECT_REF',
          label: `object ref ${objectRef}`,
          value: objectRef,
        })),
      ]

      for (const required of requiredStrings) {
        if (!hasText(handoffPrompt, required.value)) {
          issues.push(
            claimCheckIssue(
              concept,
              claimCheck,
              required.code,
              `Grounded handoff prompt for ${expectedKey} is missing ${required.label}.`
            )
          )
        }
      }

      if (item.thread.seedPrompt.length > maxDiscussionSeedPromptLength) {
        issues.push(
          claimCheckIssue(
            concept,
            claimCheck,
            'CLAIM_CHECK_HANDOFF_PROMPT_BOUND',
            `Claim-check seed prompt for ${expectedKey} exceeds ${maxDiscussionSeedPromptLength} characters.`
          )
        )
      }
    }
  }

  return issues
}
