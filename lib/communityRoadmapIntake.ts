import {
  contentObjectTypeFromKey,
  isContentObjectKey,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'

export const communityRoadmapIntakeVersion = 'cf-community-roadmap-intake-v1' as const

export const communityContributorRoles = [
  'learner',
  'student',
  'professor',
  'ta',
  'researcher',
  'practitioner',
  'visualization-builder',
  'maintainer',
  'founder',
  'ai-agent',
] as const

export const communityContributionTypes = [
  'question',
  'derivation-correction',
  'source-evidence',
  'practitioner-example',
  'counterexample',
  'experiment-result',
  'visualization-idea',
  'misconception-report',
  'route-suggestion',
  'canonical-improvement-proposal',
] as const

export const platformRoadmapObjectKey = 'route:continuous-function/platform-roadmap' as ContentObjectKey

export type CommunityContributorRole = (typeof communityContributorRoles)[number]
export type CommunityContributionType = (typeof communityContributionTypes)[number]

export type CommunityRoadmapSuggestionScope = 'object' | 'route' | 'platform'

export type CommunityRoadmapSuggestionInput = {
  scope?: CommunityRoadmapSuggestionScope
  objectKey?: string
  contributionType?: string
  contributorRole?: string
  title?: string
  body?: string
  proposedChange?: string
  evidenceObjectKeys?: string[]
  confidence?: 'low' | 'medium' | 'high'
  aiGenerated?: boolean
}

export type CommunityRoadmapReviewLane =
  | 'learner-pilot'
  | 'expert-review'
  | 'practitioner-review'
  | 'demo-design-review'
  | 'maintainer-review'
  | 'founder-roadmap'

export type CommunityRoadmapArea =
  | 'content-quality'
  | 'source-grounding'
  | 'demo-and-code'
  | 'learning-route'
  | 'personalization'
  | 'platform-roadmap'

export type CommunityRoadmapIntakeStatus =
  | 'ready-for-review'
  | 'needs-object'
  | 'needs-evidence'
  | 'needs-proposed-change'
  | 'blocked-low-signal'

export type CommunityRoadmapBlocker = {
  id:
    | 'missing-object-key'
    | 'invalid-object-key'
    | 'invalid-contribution-type'
    | 'thin-title'
    | 'thin-body'
    | 'missing-evidence'
    | 'invalid-evidence-object-key'
    | 'missing-proposed-change'
  label: string
  detail: string
}

export type CommunityRoadmapSuggestion = {
  objectKey: ContentObjectKey
  objectType: ContentObjectType
  contributionType: CommunityContributionType
  contributorRole: CommunityContributorRole
  title: string
  body: string
  proposedChange?: string
  evidenceObjectKeys: ContentObjectKey[]
  confidence: 'low' | 'medium' | 'high'
  aiGenerated: boolean
}

export type CommunityRoadmapReviewPacket = {
  version: typeof communityRoadmapIntakeVersion
  status: CommunityRoadmapIntakeStatus
  acceptedForReview: boolean
  canonical: false
  suggestion?: CommunityRoadmapSuggestion
  reviewLane?: CommunityRoadmapReviewLane
  roadmapArea?: CommunityRoadmapArea
  founderDecisionRequired: boolean
  qualitySignals: string[]
  blockers: CommunityRoadmapBlocker[]
  canonicalBoundary: string
  nextAction: string
}

const minTitleLength = 8
const maxTitleLength = 160
const minBodyLength = 32
const maxBodyLength = 4000
const maxProposedChangeLength = 2000
const maxEvidenceObjects = 8

const evidenceRequiredContributionTypes = new Set<CommunityContributionType>([
  'derivation-correction',
  'source-evidence',
  'counterexample',
  'experiment-result',
])

const proposedChangeRequiredContributionTypes = new Set<CommunityContributionType>([
  'canonical-improvement-proposal',
])

function isOneOf<T extends readonly string[]>(options: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

function compact(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trimEnd() : trimmed
}

function normalizedObjectKey(input: CommunityRoadmapSuggestionInput) {
  const rawObjectKey = compact(input.objectKey, 260)
  if (rawObjectKey) return rawObjectKey
  return input.scope === 'platform' ? platformRoadmapObjectKey : ''
}

function reviewLaneFor(type: CommunityContributionType): CommunityRoadmapReviewLane {
  switch (type) {
    case 'question':
    case 'misconception-report':
      return 'learner-pilot'
    case 'derivation-correction':
    case 'source-evidence':
    case 'counterexample':
      return 'expert-review'
    case 'practitioner-example':
    case 'experiment-result':
      return 'practitioner-review'
    case 'visualization-idea':
      return 'demo-design-review'
    case 'canonical-improvement-proposal':
      return 'maintainer-review'
    case 'route-suggestion':
      return 'founder-roadmap'
    default:
      return 'maintainer-review'
  }
}

function roadmapAreaFor(objectType: ContentObjectType, type: CommunityContributionType): CommunityRoadmapArea {
  if (type === 'route-suggestion' || objectType === 'route') return 'learning-route'
  if (objectType === 'paper' || objectType === 'source' || objectType === 'source-span' || type === 'source-evidence') {
    return 'source-grounding'
  }
  if (objectType === 'demo' || objectType === 'code' || type === 'visualization-idea' || type === 'practitioner-example') {
    return 'demo-and-code'
  }
  if (objectType === 'misconception' || type === 'misconception-report' || type === 'question') {
    return 'personalization'
  }
  return 'content-quality'
}

function statusFromBlockers(blockers: CommunityRoadmapBlocker[]): CommunityRoadmapIntakeStatus {
  if (blockers.some((blocker) => blocker.id === 'missing-object-key' || blocker.id === 'invalid-object-key')) {
    return 'needs-object'
  }
  if (blockers.some((blocker) => blocker.id === 'missing-evidence' || blocker.id === 'invalid-evidence-object-key')) {
    return 'needs-evidence'
  }
  if (blockers.some((blocker) => blocker.id === 'missing-proposed-change')) {
    return 'needs-proposed-change'
  }
  if (blockers.length > 0) return 'blocked-low-signal'
  return 'ready-for-review'
}

function canonicalBoundaryFor(input: CommunityRoadmapSuggestionInput, founderDecisionRequired: boolean) {
  if (input.aiGenerated) {
    return 'This is an AI-assisted suggestion. It may help triage or draft, but it is non-canonical until human review and founder/editor approval.'
  }
  if (founderDecisionRequired) {
    return 'This suggestion can guide the roadmap, but it is non-canonical until maintainer review and founder/editor approval.'
  }
  return 'This contribution is review material only. It can improve an object room or review queue, but it does not change canonical atlas content by itself.'
}

function nextActionFor(status: CommunityRoadmapIntakeStatus, reviewLane?: CommunityRoadmapReviewLane) {
  switch (status) {
    case 'ready-for-review':
      return `Queue this in the ${reviewLane} lane, summarize it against the object, and decide whether it becomes a canonical improvement proposal.`
    case 'needs-object':
      return 'Attach the suggestion to a valid content object key, or mark it as a platform-scope suggestion so it attaches to the platform roadmap object.'
    case 'needs-evidence':
      return 'Add source, claim, equation, demo, code, or paper object evidence before this can guide canonical work.'
    case 'needs-proposed-change':
      return 'State the exact canonical change requested, not only the concern.'
    case 'blocked-low-signal':
      return 'Ask the contributor to make the suggestion concrete: name the confusion, object, proposed change, or evidence.'
    default:
      return 'Review manually.'
  }
}

function buildQualitySignals(suggestion: CommunityRoadmapSuggestion, founderDecisionRequired: boolean) {
  return [
    `object-attached: ${suggestion.objectKey}`,
    `contribution type: ${suggestion.contributionType}`,
    suggestion.evidenceObjectKeys.length > 0 ? `evidence objects: ${suggestion.evidenceObjectKeys.length}` : undefined,
    suggestion.proposedChange ? 'proposed canonical change present' : undefined,
    founderDecisionRequired ? 'founder/editor decision required' : undefined,
    suggestion.aiGenerated ? 'AI-assisted draft boundary active' : undefined,
  ].filter((signal): signal is string => Boolean(signal))
}

export function buildCommunityRoadmapReviewPacket(
  input: CommunityRoadmapSuggestionInput
): CommunityRoadmapReviewPacket {
  const blockers: CommunityRoadmapBlocker[] = []
  const objectKeyCandidate = normalizedObjectKey(input)
  const contributionTypeCandidate = compact(input.contributionType, 80)
  const title = compact(input.title, maxTitleLength)
  const body = compact(input.body, maxBodyLength)
  const proposedChange = compact(input.proposedChange, maxProposedChangeLength)
  const contributorRole = isOneOf(communityContributorRoles, input.contributorRole)
    ? input.contributorRole
    : 'learner'
  const contributionType = isOneOf(communityContributionTypes, contributionTypeCandidate)
    ? contributionTypeCandidate
    : null

  if (!objectKeyCandidate) {
    blockers.push({
      id: 'missing-object-key',
      label: 'Object required',
      detail: 'Suggestions must attach to an object, route, or explicit platform roadmap scope.',
    })
  } else if (!isContentObjectKey(objectKeyCandidate)) {
    blockers.push({
      id: 'invalid-object-key',
      label: 'Invalid object key',
      detail: 'The object key must use the Continuous Function content-object grammar.',
    })
  }

  if (!contributionType) {
    blockers.push({
      id: 'invalid-contribution-type',
      label: 'Contribution type required',
      detail: 'Use one of the structured object-room contribution types.',
    })
  }

  if (title.length < minTitleLength) {
    blockers.push({
      id: 'thin-title',
      label: 'Title too thin',
      detail: 'Use a short, concrete title naming the issue or opportunity.',
    })
  }

  if (body.length < minBodyLength) {
    blockers.push({
      id: 'thin-body',
      label: 'Body too thin',
      detail: 'Describe the confusion, evidence, or proposed improvement with enough detail to review.',
    })
  }

  const evidenceObjectKeys = (input.evidenceObjectKeys ?? [])
    .slice(0, maxEvidenceObjects)
    .map((key) => compact(key, 260))
    .filter(Boolean)

  const validEvidenceObjectKeys: ContentObjectKey[] = []
  for (const key of evidenceObjectKeys) {
    if (isContentObjectKey(key)) {
      validEvidenceObjectKeys.push(key)
    } else {
      blockers.push({
        id: 'invalid-evidence-object-key',
        label: 'Invalid evidence object',
        detail: `Evidence object key is invalid: ${key}`,
      })
    }
  }

  if (contributionType && evidenceRequiredContributionTypes.has(contributionType) && validEvidenceObjectKeys.length === 0) {
    blockers.push({
      id: 'missing-evidence',
      label: 'Evidence required',
      detail: 'Corrections, source claims, counterexamples, and experiment results need at least one evidence object key.',
    })
  }

  if (contributionType && proposedChangeRequiredContributionTypes.has(contributionType) && !proposedChange) {
    blockers.push({
      id: 'missing-proposed-change',
      label: 'Proposed change required',
      detail: 'Canonical improvement proposals must state the exact change requested.',
    })
  }

  const status = statusFromBlockers(blockers)
  const objectKey = isContentObjectKey(objectKeyCandidate) ? objectKeyCandidate : null
  const objectType = objectKey ? contentObjectTypeFromKey(objectKey) : null
  const reviewLane = contributionType ? reviewLaneFor(contributionType) : undefined
  const roadmapArea = objectType && contributionType ? roadmapAreaFor(objectType, contributionType) : undefined
  const founderDecisionRequired =
    input.scope === 'platform' ||
    objectKey === platformRoadmapObjectKey ||
    contributionType === 'route-suggestion' ||
    contributionType === 'canonical-improvement-proposal' ||
    input.aiGenerated === true

  const suggestion =
    status === 'ready-for-review' && objectKey && objectType && contributionType
      ? {
          objectKey,
          objectType,
          contributionType,
          contributorRole,
          title,
          body,
          proposedChange: proposedChange || undefined,
          evidenceObjectKeys: validEvidenceObjectKeys,
          confidence: input.confidence ?? 'medium',
          aiGenerated: input.aiGenerated === true,
        }
      : undefined

  return {
    version: communityRoadmapIntakeVersion,
    status,
    acceptedForReview: status === 'ready-for-review',
    canonical: false,
    suggestion,
    reviewLane: status === 'ready-for-review' ? reviewLane : undefined,
    roadmapArea: status === 'ready-for-review' ? roadmapArea : undefined,
    founderDecisionRequired,
    qualitySignals: suggestion ? buildQualitySignals(suggestion, founderDecisionRequired) : [],
    blockers,
    canonicalBoundary: canonicalBoundaryFor(input, founderDecisionRequired),
    nextAction: nextActionFor(status, reviewLane),
  }
}
