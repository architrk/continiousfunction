export type CompanionMode = 'concept' | 'home'

export type CompanionSource = 'home-panel' | 'concept-panel' | 'concept-section' | 'practice-shell'

export type CompanionTask = {
  id: string
  label: string
  instruction: string
}

export type CompanionContext = {
  contextLabel?: string
  domainTitle?: string
  surfaceTitle: string
  description?: string
  currentSection?: string
  sectionStep?: string
  sectionSummary?: string
  sectionSnippet?: string
  prerequisites?: string[]
  nextConcept?: string
  nextStep?: string
}

export type CompanionLearnerState = {
  question?: string
  selectedText?: string
  goal?: string
  comfortLevel?: string
  explanationStyle?: string
  stuckReason?: string
}

export type CompanionGatewayRequest = {
  version: 'continuous-function.ai-companion.v1'
  source: CompanionSource
  mode: CompanionMode
  prompt: string
  task: CompanionTask
  context: CompanionContext
  learner: CompanionLearnerState
  safety: {
    audience: 'stem-learner'
    style: string[]
    boundaries: string[]
  }
}

export type CompanionGatewayResponse = {
  answer: string
  followups?: string[]
  nextAction?: string
}

const safetyContract = {
  audience: 'stem-learner' as const,
  style: [
    'Use intuition before notation.',
    'Define symbols before using them.',
    'Prefer small examples over broad claims.',
    'End with one thing the learner should try on the page.',
  ],
  boundaries: [
    'Do not invent prerequisites or graph links.',
    'Do not hide uncertainty behind fluent language.',
    'Do not replace the concept page; help the learner use it.',
    'Do not request secrets, private keys, passwords, or payment data.',
  ],
}

export function getCompanionGatewayUrl(): string {
  const env = typeof process === 'undefined' ? undefined : process.env
  return env?.NEXT_PUBLIC_CF_AI_GATEWAY_URL?.trim() ?? ''
}

export function isCompanionGatewayConfigured(): boolean {
  return Boolean(getCompanionGatewayUrl())
}

export function buildCompanionPrompt({
  task,
  context,
  learner = {},
}: {
  task: CompanionTask
  context: CompanionContext
  learner?: CompanionLearnerState
}): string {
  const prerequisites = context.prerequisites?.length
    ? context.prerequisites.join(', ')
    : undefined

  const lines = [
    'You are my AI learning companion for Continuous Function.',
    context.contextLabel ? `Current context: ${context.contextLabel}.` : null,
    context.domainTitle ? `Domain: ${context.domainTitle}.` : null,
    `Learning surface: ${context.surfaceTitle}.`,
    context.description ? `What this page says: ${context.description}` : null,
    context.currentSection ? `Current section: ${context.currentSection}.` : null,
    context.sectionStep && context.sectionSummary
      ? `Section goal (${context.sectionStep}): ${context.sectionSummary}`
      : null,
    prerequisites ? `Known prerequisites: ${prerequisites}.` : null,
    context.nextConcept ? `Likely next concept: ${context.nextConcept}.` : null,
    context.nextStep ? `Suggested next step: ${context.nextStep}.` : null,
    context.sectionSnippet ? `Section excerpt:\n${context.sectionSnippet}` : null,
    learner.goal ? `Learner goal: ${learner.goal}.` : null,
    learner.comfortLevel ? `Learner comfort level: ${learner.comfortLevel}.` : null,
    learner.explanationStyle ? `Preferred explanation style: ${learner.explanationStyle}.` : null,
    learner.stuckReason ? `Current stuck reason: ${learner.stuckReason}.` : null,
    learner.selectedText ? `Learner-selected text:\n${learner.selectedText}` : null,
    `Task: ${task.instruction}`,
    learner.question?.trim() ? `My question: ${learner.question.trim()}` : null,
    'Answer in a way that helps me learn: ask one clarifying question only if needed, use intuition before notation, and end with one thing I should try on the page.',
  ].filter(Boolean)

  return lines.join('\n')
}

export function buildCompanionGatewayRequest({
  source,
  mode,
  task,
  context,
  learner = {},
}: {
  source: CompanionSource
  mode: CompanionMode
  task: CompanionTask
  context: CompanionContext
  learner?: CompanionLearnerState
}): CompanionGatewayRequest {
  return {
    version: 'continuous-function.ai-companion.v1',
    source,
    mode,
    prompt: buildCompanionPrompt({ task, context, learner }),
    task,
    context,
    learner,
    safety: safetyContract,
  }
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined
  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return strings.length ? strings : undefined
}

export async function requestCompanionAnswer(
  request: CompanionGatewayRequest,
  gatewayUrl = getCompanionGatewayUrl()
): Promise<CompanionGatewayResponse> {
  if (!gatewayUrl) {
    throw new Error('AI companion gateway is not configured.')
  }

  const response = await fetch(gatewayUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  const text = await response.text()
  let payload: unknown = text

  try {
    payload = text ? JSON.parse(text) : {}
  } catch {
    payload = text
  }

  if (!response.ok) {
    throw new Error(typeof payload === 'string' && payload.trim() ? payload : `Gateway returned ${response.status}.`)
  }

  if (typeof payload === 'string') {
    return { answer: payload }
  }

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>
    const answer =
      typeof record.answer === 'string' ? record.answer :
      typeof record.message === 'string' ? record.message :
      typeof record.output === 'string' ? record.output :
      ''

    return {
      answer: answer || 'The companion returned an empty response.',
      followups: asStringArray(record.followups),
      nextAction: typeof record.nextAction === 'string' ? record.nextAction : undefined,
    }
  }

  return { answer: 'The companion returned an empty response.' }
}
