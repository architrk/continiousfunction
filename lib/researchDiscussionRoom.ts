import type { DiscussionAnchorListItem, DiscussionObjectType } from './discussionAnchors'
import type { LocalObjectActionDraft } from './localObjectActionJournal'
import type { LearningRouteSourceObject } from './learningRouteSnapshot'

export type ResearchDiscussionRoomPacket = {
  objectTypeLabel: string
  evidenceChecklist: string[]
  resolutionRubric: string[]
  aiPrompt: string
  routeObject: LearningRouteSourceObject
  carriedObservation?: ResearchDiscussionCarriedObservation
  localDraft?: ResearchDiscussionLocalDraft
  objectRoomContext?: ResearchDiscussionRoomContext
}

export type ResearchDiscussionCarriedObservation = {
  label: string
  value: string
  detail?: string
  nextQuestion?: string
  source?: string
}

export type ResearchDiscussionLocalDraft = Pick<LocalObjectActionDraft, 'objectKey' | 'note' | 'nextAction' | 'updatedAt'>

export type ResearchDiscussionRoomCard = {
  label: string
  title: string
  body: string
  meta?: string
}

export type ResearchDiscussionRoomContext = {
  objectContext?: string
  sourceBoundary?: string
  roomCards?: ResearchDiscussionRoomCard[]
  nextExperiment?: string
  canonicality?: string
}

const maxRoleLength = 140
const maxStatusLength = 120
const maxPromptCardLength = 240

const guidanceByObjectType: Record<
  DiscussionObjectType,
  {
    evidence: string[]
    resolution: string[]
  }
> = {
  concept: {
    evidence: [
      'Definition, prerequisite, and contrast concept links',
      'The equation or code witness that makes the concept operational',
      'One demo state that shows the invariant instead of a slogan',
    ],
    resolution: [
      'The learner can state the mechanism in their own words',
      'The learner can name the prerequisite that would repair confusion',
      'The learner can predict how the mechanism changes under one perturbation',
    ],
  },
  equation: {
    evidence: [
      'Symbol meanings, shapes, units, and hidden assumptions',
      'The source line, page, or concept section where the equation is justified',
      'A runnable code witness that mirrors the same terms',
    ],
    resolution: [
      'Every symbol has a clear role and shape',
      'The learner knows which term changes in the paper or demo',
      'The equation predicts the observed behavior without extra hand-waving',
    ],
  },
  source: {
    evidence: [
      'Source id, paper title, author/date metadata, and the page note attached to the concept',
      'Which local equation, code witness, or demo claim the source is supposed to support',
      'Any unsupported mechanism, benchmark, or history claim that should stay marked as an assumption',
    ],
    resolution: [
      'The cited source supports the exact mechanism being taught',
      'Local explanation claims are separated from source facts',
      'The next source or paper section to inspect is explicit',
    ],
  },
  paper: {
    evidence: [
      'Paper metadata, abstract claim, and any pasted source spans',
      'Mapped concepts, equations, and prerequisite repairs',
      'Which claims are source-checked and which remain local-preview only',
    ],
    resolution: [
      'The paper contribution is mapped to a concrete mechanism',
      'Unverified author, date, benchmark, and novelty claims are separated from learning claims',
      'The next concept or lab action is specific enough to resume later',
    ],
  },
  'code-witness': {
    evidence: [
      'Inputs, outputs, tensor shapes, and held-fixed assumptions in the code',
      'The equation term or mechanism each line is meant to witness',
      'A small perturbation that should change the output predictably',
    ],
    resolution: [
      'The code and math name the same objects',
      'The learner can predict one output before running the snippet',
      'The snippet exposes its toy limitations instead of pretending to be production code',
    ],
  },
  visualization: {
    evidence: [
      'Visible controls, hidden/revealed values, and current demo state',
      'The invariant the visualization is supposed to teach',
      'A counterexample or parameter setting where the intuition breaks',
    ],
    resolution: [
      'The learner can predict the reveal before running it',
      'The displayed state supports the stated mechanism',
      'The visual does not leak the answer before prediction',
    ],
  },
  'toy-experiment': {
    evidence: [
      'Controls, held-fixed variables, saved observation, and caveat',
      'The prediction the learner committed before reveal',
      'The failure mode or quality risk the toy setup cannot prove',
    ],
    resolution: [
      'Changed and held-fixed variables are explicit',
      'The observation answers one narrow question',
      'The next experiment targets the remaining risk rather than broad curiosity',
    ],
  },
  claim: {
    evidence: [
      'Exact source quote or local paper clue that motivates the claim',
      'The equation, concept, or toy lab that could falsify the claim',
      'Benchmarks, assumptions, and counterexamples that would change confidence',
    ],
    resolution: [
      'The claim is either source-supported, weakened, or marked unverified',
      'The mechanism is separated from benchmark or marketing language',
      'The learner knows what evidence would raise or lower confidence',
    ],
  },
  misconception: {
    evidence: [
      'The false belief in the learner-facing wording',
      'A minimal example that breaks the misconception',
      'The corrected invariant and where it appears in math or demo state',
    ],
    resolution: [
      'The misconception is restated precisely',
      'The counterexample is small enough to remember',
      'The corrected rule transfers to a nearby concept or paper claim',
    ],
  },
}

function objectTypeLabel(type: DiscussionObjectType) {
  return type.replaceAll('-', ' ')
}

function truncate(value: string | undefined, limit: number) {
  if (!value) return undefined
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function sourceIdsEvidence(item: DiscussionAnchorListItem) {
  return item.anchor.sourceIds?.length ? [`Source ids to inspect: ${item.anchor.sourceIds.join(', ')}`] : []
}

function sourceSpanEvidence(item: DiscussionAnchorListItem) {
  return item.anchor.objectType === 'source' && item.anchor.id.includes('/source-span/')
    ? ['Exact source-note span and the surrounding source-card metadata']
    : []
}

function evidenceChecklistForItem(item: DiscussionAnchorListItem) {
  const guidance = guidanceByObjectType[item.anchor.objectType]
  return [...sourceIdsEvidence(item), ...sourceSpanEvidence(item), ...guidance.evidence]
}

function carriedObservationLines(observation: ResearchDiscussionCarriedObservation | undefined) {
  if (!observation) return []

  return [
    '',
    'Carried route observation:',
    `- ${observation.label}: ${observation.value}`,
    observation.detail ? `- Detail: ${observation.detail}` : undefined,
    observation.nextQuestion ? `- Next question: ${observation.nextQuestion}` : undefined,
    observation.source ? `- Observation source: ${observation.source}` : undefined,
  ].filter((line): line is string => line !== undefined)
}

function localDraftLines(draft: ResearchDiscussionLocalDraft | undefined) {
  if (!draft) return []

  return [
    '',
    'Local action draft:',
    `- Object key: ${draft.objectKey}`,
    `- Draft note: ${draft.note}`,
    `- Next action: ${draft.nextAction}`,
    `- Saved locally in this browser at: ${draft.updatedAt}`,
  ]
}

function objectRoomContextLines(context: ResearchDiscussionRoomContext | undefined) {
  if (!context) return []

  const lines = [
    '',
    'Selected object-room context:',
    context.objectContext ? `- Object context: ${truncate(context.objectContext, maxPromptCardLength)}` : undefined,
    context.sourceBoundary ? `- Source boundary: ${truncate(context.sourceBoundary, maxPromptCardLength)}` : undefined,
  ]

  if (context.roomCards?.length) {
    lines.push(
      'Distilled room cards:',
      ...context.roomCards.slice(0, 8).map((card) => {
        const meta = card.meta ? ` (${truncate(card.meta, 80)})` : ''
        return `- ${card.label}: ${truncate(card.title, 120)}${meta} - ${truncate(card.body, maxPromptCardLength)}`
      })
    )
  }

  if (context.nextExperiment) {
    lines.push(`- Next experiment: ${truncate(context.nextExperiment, maxPromptCardLength)}`)
  }

  lines.push(
    `- Non-canonical boundary: ${
      context.canonicality ??
      'Treat object-room material as a local high-signal draft. Do not silently promote it into canonical atlas content.'
    }`
  )

  return lines.filter((line): line is string => line !== undefined)
}

function matchingLocalDraftForItem(
  item: DiscussionAnchorListItem,
  draft: ResearchDiscussionLocalDraft | undefined
) {
  if (!draft || !item.anchor.objectKey || draft.objectKey !== item.anchor.objectKey) return undefined
  return draft
}

export function routeSourceObjectFromDiscussionItem(item: DiscussionAnchorListItem): LearningRouteSourceObject {
  const id = item.anchor.id.split('/').at(-1)

  return {
    type: item.anchor.objectType,
    id,
    discussionAnchorId: item.anchor.id,
    title: item.anchor.title,
    href: item.anchor.href,
    ...(item.anchor.objectKey ? { objectKey: item.anchor.objectKey } : {}),
    role: truncate(item.thread.seedPrompt, maxRoleLength),
    status: truncate(item.anchor.contextLabel ?? 'research reading-room object', maxStatusLength),
    sourceIds: item.anchor.sourceIds,
  }
}

export function buildResearchDiscussionPrompt(
  item: DiscussionAnchorListItem,
  carriedObservation?: ResearchDiscussionCarriedObservation,
  localDraft?: ResearchDiscussionLocalDraft,
  objectRoomContext?: ResearchDiscussionRoomContext
) {
  const guidance = guidanceByObjectType[item.anchor.objectType]
  const evidenceChecklist = evidenceChecklistForItem(item)
  const resolutionRubric = guidance.resolution
  const selectedLocalDraft = matchingLocalDraftForItem(item, localDraft)

  return [
    'I am working in Continuous Function\'s research reading room.',
    `Object: ${objectTypeLabel(item.anchor.objectType)} - ${item.anchor.title}`,
    item.anchor.objectKey ? `Object key: ${item.anchor.objectKey}` : undefined,
    item.anchor.contextLabel ? `Context: ${item.anchor.contextLabel}` : undefined,
    `Anchor id: ${item.anchor.id}`,
    `Open question: ${item.thread.seedPrompt}`,
    ...objectRoomContextLines(objectRoomContext),
    '',
    'Evidence to inspect:',
    ...evidenceChecklist.map((entry) => `- ${entry}`),
    ...carriedObservationLines(carriedObservation),
    ...localDraftLines(selectedLocalDraft),
    '',
    'What would resolve this:',
    ...resolutionRubric.map((entry) => `- ${entry}`),
    '',
    'Answer as a careful research tutor: stay source-grounded, separate verified evidence from assumptions, name the relevant math objects, and end with one next action.',
  ]
    .filter((line): line is string => line !== undefined)
    .join('\n')
}

export function buildResearchDiscussionRoomPacket(
  item: DiscussionAnchorListItem,
  carriedObservation?: ResearchDiscussionCarriedObservation,
  localDraft?: ResearchDiscussionLocalDraft,
  objectRoomContext?: ResearchDiscussionRoomContext
): ResearchDiscussionRoomPacket {
  const guidance = guidanceByObjectType[item.anchor.objectType]
  const selectedLocalDraft = matchingLocalDraftForItem(item, localDraft)

  return {
    objectTypeLabel: objectTypeLabel(item.anchor.objectType),
    evidenceChecklist: evidenceChecklistForItem(item),
    resolutionRubric: guidance.resolution,
    aiPrompt: buildResearchDiscussionPrompt(item, carriedObservation, selectedLocalDraft, objectRoomContext),
    routeObject: routeSourceObjectFromDiscussionItem(item),
    carriedObservation,
    localDraft: selectedLocalDraft,
    objectRoomContext,
  }
}
