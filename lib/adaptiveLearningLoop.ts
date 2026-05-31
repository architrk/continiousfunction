import {
  contentObjectTypeFromKey,
  isContentObjectKey,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'
import { routeObjectKeyFromLearningRouteSnapshot } from './learningRouteObjectKeys'

export const adaptiveLearningLoopVersion = 'cf-adaptive-learning-loop-v1' as const

export const adaptiveLearningSignalTypes = [
  'question-asked',
  'confusion-marked',
  'helpful-marked',
  'prediction-submitted',
  'prediction-revealed',
  'confidence-reported',
  'demo-manipulated',
  'source-opened',
  'code-opened',
  'note-saved',
  'route-abandoned',
  'concept-revisited',
] as const

export type AdaptiveLearningSignalType = (typeof adaptiveLearningSignalTypes)[number]

export type AdaptiveLearningSignalInput = {
  type?: string
  objectKey?: string
  value?: string
  confidenceBefore?: number
  confidenceAfter?: number
  predictionCorrect?: boolean
  dwellSeconds?: number
  timestamp?: string
}

export type AdaptiveLearningLoopInput = {
  routeSnapshot?: LearningRouteSnapshot | null
  signals?: AdaptiveLearningSignalInput[]
}

export type AdaptiveLearningLoopStatus = 'empty' | 'ready' | 'needs-object' | 'blocked-low-signal'

export type AdaptiveLearningPosture =
  | 'orientation'
  | 'repair'
  | 'prediction-repair'
  | 'mechanism-testing'
  | 'research-grounding'
  | 'consolidation'

export type AdaptiveLearningNextAction =
  | 'ask-one-calibrating-question'
  | 'show-prerequisite-bridge'
  | 'contrast-prediction-with-invariant'
  | 'run-variable-change-witness'
  | 'open-source-grounded-room'
  | 'offer-harder-adjacent-object'
  | 'start-route'

export type AdaptiveLearningImprovementType =
  | 'rewrite-intuition'
  | 'add-prerequisite-bridge'
  | 'add-prediction-check'
  | 'improve-demo-feedback'
  | 'review-route-order'

export type AdaptiveLearningSignal = {
  type: AdaptiveLearningSignalType
  objectKey: ContentObjectKey
  objectType: ContentObjectType
  value?: string
  confidenceBefore?: number
  confidenceAfter?: number
  predictionCorrect?: boolean
  dwellSeconds?: number
  timestamp?: string
}

export type AdaptiveLearningBlocker = {
  id: 'invalid-signal-type' | 'missing-object-key' | 'invalid-object-key' | 'thin-signal'
  label: string
  detail: string
}

export type AdaptiveLearningModel = {
  objectKey?: ContentObjectKey
  objectType?: ContentObjectType
  posture: AdaptiveLearningPosture
  inferredNeeds: string[]
  confidenceTrend: 'unknown' | 'up' | 'down' | 'flat'
  needsCalibratingQuestion: boolean
}

export type AdaptiveLearningExperiencePlan = {
  action: AdaptiveLearningNextAction
  label: string
  prompt: string
  objectKey?: ContentObjectKey
}

export type AdaptiveLearningImprovementDraft = {
  objectKey: ContentObjectKey
  objectType: ContentObjectType
  type: AdaptiveLearningImprovementType
  title: string
  reason: string
  suggestedReviewLane: 'learner-pilot' | 'expert-review' | 'demo-design-review' | 'maintainer-review'
  canonical: false
}

export type AdaptiveLearningLoopPacket = {
  version: typeof adaptiveLearningLoopVersion
  status: AdaptiveLearningLoopStatus
  ready: boolean
  signals: AdaptiveLearningSignal[]
  learnerModel: AdaptiveLearningModel
  nextExperience: AdaptiveLearningExperiencePlan
  improvementDraft?: AdaptiveLearningImprovementDraft
  blockers: AdaptiveLearningBlocker[]
  privacyBoundary: string
  canonicalBoundary: string
  agentBoundary: string
}

const maxSignals = 24
const maxSignalValueLength = 1000
const minSignalValueLength = 3

function isOneOf<T extends readonly string[]>(options: T, value: unknown): value is T[number] {
  return typeof value === 'string' && (options as readonly string[]).includes(value)
}

function compact(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength).trimEnd() : trimmed
}

function confidenceValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1 ? value : undefined
}

function dwellValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 60 * 60 ? value : undefined
}

function timestampValue(value: unknown) {
  if (typeof value !== 'string' || value.length > 64) return undefined
  return Number.isNaN(Date.parse(value)) ? undefined : value
}

function fallbackObjectKey(snapshot?: LearningRouteSnapshot | null) {
  const currentObjectKey = snapshot?.currentObject?.objectKey
  if (isContentObjectKey(currentObjectKey)) return currentObjectKey
  return snapshot ? routeObjectKeyFromLearningRouteSnapshot(snapshot) : null
}

function normalizeSignals(input: AdaptiveLearningLoopInput) {
  const fallbackKey = fallbackObjectKey(input.routeSnapshot)
  const signals = (input.signals ?? []).slice(0, maxSignals)
  const normalized: AdaptiveLearningSignal[] = []
  const blockers: AdaptiveLearningBlocker[] = []

  signals.forEach((signal, index) => {
    if (!isOneOf(adaptiveLearningSignalTypes, signal.type)) {
      blockers.push({
        id: 'invalid-signal-type',
        label: 'Signal type is not supported',
        detail: `Signal ${index + 1} needs one of the adaptive learning signal types.`,
      })
      return
    }

    const candidateObjectKey = compact(signal.objectKey, 260) ?? fallbackKey
    if (!candidateObjectKey) {
      blockers.push({
        id: 'missing-object-key',
        label: 'Signal needs a learning object',
        detail: 'Adaptive personalization should attach to a concept, equation, demo, claim, source span, code witness, misconception, paper, or route object.',
      })
      return
    }

    if (!isContentObjectKey(candidateObjectKey)) {
      blockers.push({
        id: 'invalid-object-key',
        label: 'Signal object key is malformed',
        detail: `${candidateObjectKey} is not a valid Continuous Function object key.`,
      })
      return
    }

    const value = compact(signal.value, maxSignalValueLength)
    if (
      (signal.type === 'question-asked' || signal.type === 'confusion-marked') &&
      (!value || value.length < minSignalValueLength)
    ) {
      blockers.push({
        id: 'thin-signal',
        label: 'Signal is too thin to adapt from',
        detail: 'Questions and confusion marks need a short phrase so the tutor can respond without guessing.',
      })
      return
    }

    normalized.push({
      type: signal.type,
      objectKey: candidateObjectKey,
      objectType: contentObjectTypeFromKey(candidateObjectKey),
      value,
      confidenceBefore: confidenceValue(signal.confidenceBefore),
      confidenceAfter: confidenceValue(signal.confidenceAfter),
      predictionCorrect: typeof signal.predictionCorrect === 'boolean' ? signal.predictionCorrect : undefined,
      dwellSeconds: dwellValue(signal.dwellSeconds),
      timestamp: timestampValue(signal.timestamp),
    })
  })

  return { signals: normalized, blockers }
}

function mostRecentSignal(signals: AdaptiveLearningSignal[]) {
  return signals[signals.length - 1]
}

function confidenceTrend(signals: AdaptiveLearningSignal[]): AdaptiveLearningModel['confidenceTrend'] {
  const withConfidence = signals
    .map((signal) =>
      typeof signal.confidenceBefore === 'number' && typeof signal.confidenceAfter === 'number'
        ? signal.confidenceAfter - signal.confidenceBefore
        : null
    )
    .filter((delta): delta is number => delta !== null)

  if (!withConfidence.length) return 'unknown'
  const averageDelta = withConfidence.reduce((sum, delta) => sum + delta, 0) / withConfidence.length
  if (averageDelta > 0.08) return 'up'
  if (averageDelta < -0.08) return 'down'
  return 'flat'
}

function inferPosture(signals: AdaptiveLearningSignal[]): AdaptiveLearningPosture {
  const recent = mostRecentSignal(signals)
  const hasWrongPrediction = signals.some(
    (signal) => signal.type === 'prediction-revealed' && signal.predictionCorrect === false
  )
  const hasConfusion = signals.some((signal) => signal.type === 'confusion-marked' || signal.type === 'question-asked')
  const hasResearchSignal = recent?.type === 'source-opened'
  const hasMechanismSignal = recent?.type === 'demo-manipulated' || recent?.type === 'code-opened'
  const hasConsolidationSignal = recent?.type === 'helpful-marked' || recent?.type === 'note-saved'

  if (hasWrongPrediction) return 'prediction-repair'
  if (hasConfusion) return 'repair'
  if (hasResearchSignal) return 'research-grounding'
  if (hasMechanismSignal) return 'mechanism-testing'
  if (hasConsolidationSignal) return 'consolidation'
  return 'orientation'
}

function inferredNeedsFor(posture: AdaptiveLearningPosture, trend: AdaptiveLearningModel['confidenceTrend']) {
  const needs: string[] = []

  if (posture === 'prediction-repair') {
    needs.push('contrast the learner prediction with the invariant')
    needs.push('show a smaller failure case before adding notation')
  }

  if (posture === 'repair') {
    needs.push('repair the nearest prerequisite')
    needs.push('ask only one discriminating question')
  }

  if (posture === 'research-grounding') {
    needs.push('keep claims tied to source spans')
    needs.push('separate paper claim from teaching analogy')
  }

  if (posture === 'mechanism-testing') {
    needs.push('vary one parameter and hold the rest fixed')
    needs.push('connect demo state to the equation')
  }

  if (posture === 'consolidation') {
    needs.push('offer a harder adjacent object')
    needs.push('turn the observation into a reusable route checkpoint')
  }

  if (trend === 'down') {
    needs.push('slow down and reduce abstraction')
  }

  return needs.length ? needs : ['orient the learner around the selected object']
}

function nextExperienceFor(model: AdaptiveLearningModel): AdaptiveLearningExperiencePlan {
  switch (model.posture) {
    case 'prediction-repair':
      return {
        action: 'contrast-prediction-with-invariant',
        label: 'Repair the prediction',
        prompt: 'Show what the learner predicted, what actually changed, and the invariant that stayed fixed.',
        objectKey: model.objectKey,
      }
    case 'repair':
      return {
        action: model.needsCalibratingQuestion ? 'ask-one-calibrating-question' : 'show-prerequisite-bridge',
        label: model.needsCalibratingQuestion ? 'Ask one precise question' : 'Open the prerequisite bridge',
        prompt: model.needsCalibratingQuestion
          ? 'Ask one question that separates missing notation, missing intuition, and missing prerequisite knowledge.'
          : 'Explain the nearest prerequisite in the context of the current object before continuing.',
        objectKey: model.objectKey,
      }
    case 'research-grounding':
      return {
        action: 'open-source-grounded-room',
        label: 'Ground the claim',
        prompt: 'Show the source span, the exact claim it supports, and one thing the explanation should not overstate.',
        objectKey: model.objectKey,
      }
    case 'mechanism-testing':
      return {
        action: 'run-variable-change-witness',
        label: 'Run one witness',
        prompt: 'Change one variable, hold the others fixed, and ask the learner what should remain invariant.',
        objectKey: model.objectKey,
      }
    case 'consolidation':
      return {
        action: 'offer-harder-adjacent-object',
        label: 'Move one step deeper',
        prompt: 'Offer the next adjacent object only after preserving the saved observation as route memory.',
        objectKey: model.objectKey,
      }
    default:
      return {
        action: 'start-route',
        label: 'Start from the selected object',
        prompt: 'Orient the learner around the current object, the question it answers, and the next useful action.',
        objectKey: model.objectKey,
      }
  }
}

function dominantObject(signals: AdaptiveLearningSignal[]) {
  const counts = new Map<ContentObjectKey, { count: number; objectType: ContentObjectType }>()
  signals.forEach((signal) => {
    const existing = counts.get(signal.objectKey)
    counts.set(signal.objectKey, {
      count: (existing?.count ?? 0) + 1,
      objectType: signal.objectType,
    })
  })

  return [...counts.entries()].sort((a, b) => b[1].count - a[1].count)[0]
}

function improvementDraftFor(signals: AdaptiveLearningSignal[]): AdaptiveLearningImprovementDraft | undefined {
  const dominant = dominantObject(signals)
  if (!dominant) return undefined

  const [objectKey, { count, objectType }] = dominant
  const confusionCount = signals.filter(
    (signal) => signal.objectKey === objectKey && (signal.type === 'confusion-marked' || signal.type === 'question-asked')
  ).length
  const wrongPredictionCount = signals.filter(
    (signal) => signal.objectKey === objectKey && signal.type === 'prediction-revealed' && signal.predictionCorrect === false
  ).length
  const abandonedCount = signals.filter((signal) => signal.type === 'route-abandoned').length

  if (wrongPredictionCount >= 2) {
    return {
      objectKey,
      objectType,
      type: 'improve-demo-feedback',
      title: 'Repeated wrong predictions on this object',
      reason: 'Multiple revealed predictions missed the target, so the demo or explanation should expose the invariant more clearly.',
      suggestedReviewLane: 'demo-design-review',
      canonical: false,
    }
  }

  if (confusionCount >= 2 || count >= 4) {
    return {
      objectKey,
      objectType,
      type: objectType === 'concept' || objectType === 'route' ? 'add-prerequisite-bridge' : 'rewrite-intuition',
      title: 'Repeated learner friction around this object',
      reason: 'The same object is accumulating questions or confusion, which is a strong candidate for a smaller bridge, clearer intuition, or misconception note.',
      suggestedReviewLane: 'learner-pilot',
      canonical: false,
    }
  }

  if (abandonedCount >= 1) {
    return {
      objectKey,
      objectType,
      type: 'review-route-order',
      title: 'Route abandonment signal',
      reason: 'A route was abandoned near this object, so the route order or next repair concept should be reviewed before scaling the path.',
      suggestedReviewLane: 'maintainer-review',
      canonical: false,
    }
  }

  return undefined
}

function statusFrom(
  blockers: AdaptiveLearningBlocker[],
  signals: AdaptiveLearningSignal[],
  baseObjectKey: ContentObjectKey | null
) {
  if (!signals.length && baseObjectKey && !blockers.length) return 'ready'
  if (!signals.length && !blockers.length) return 'empty'
  if (blockers.some((blocker) => blocker.id === 'missing-object-key' || blocker.id === 'invalid-object-key')) return 'needs-object'
  if (blockers.length) return 'blocked-low-signal'
  return 'ready'
}

export function buildAdaptiveLearningLoopPacket(input: AdaptiveLearningLoopInput): AdaptiveLearningLoopPacket {
  const { signals, blockers } = normalizeSignals(input)
  const baseObjectKey = fallbackObjectKey(input.routeSnapshot)
  const baseObjectType = baseObjectKey ? contentObjectTypeFromKey(baseObjectKey) : undefined
  const status = statusFrom(blockers, signals, baseObjectKey)
  const latest = mostRecentSignal(signals)
  const posture = inferPosture(signals)
  const trend = confidenceTrend(signals)
  const model: AdaptiveLearningModel = {
    objectKey: latest?.objectKey ?? baseObjectKey ?? undefined,
    objectType: latest?.objectType ?? baseObjectType,
    posture,
    inferredNeeds: inferredNeedsFor(posture, trend),
    confidenceTrend: trend,
    needsCalibratingQuestion:
      posture === 'repair' && signals.some((signal) => signal.type === 'question-asked' || signal.type === 'confusion-marked'),
  }

  return {
    version: adaptiveLearningLoopVersion,
    status,
    ready: status === 'ready',
    signals,
    learnerModel: model,
    nextExperience: nextExperienceFor(model),
    improvementDraft: status === 'ready' ? improvementDraftFor(signals) : undefined,
    blockers,
    privacyBoundary:
      'Private learner signals can personalize the learner experience. Only anonymized aggregate patterns should become product-improvement proposals.',
    canonicalBoundary:
      'Adaptive improvement drafts are non-canonical. They should enter the review queue before changing atlas content, routes, demos, or prompts.',
    agentBoundary:
      'A Codex-style backend agent may draft patches only from accepted review items, in an isolated branch/worktree, with tests and human approval before merge.',
  }
}
