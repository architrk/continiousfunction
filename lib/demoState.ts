export const DEMO_STATE_EVENT = 'continuous-function:demo-state'

export type DemoStateSummary = {
  conceptId: string
  label: string
  summary: string
  values?: string[]
  phase?: 'pre-prediction' | 'predicted' | 'revealed' | 'observing'
  prediction?: {
    prompt: string
    learnerChoice?: string
    actual?: string
    correct?: boolean
  }
  measurements?: Record<string, string | number | boolean>
  invariant?: string
  nextQuestion?: string
  updatedAt?: string
}

export type DemoStateClear = {
  conceptId: string
  cleared: true
  updatedAt?: string
}

export type DemoStateEventDetail = DemoStateSummary | DemoStateClear

const latestDemoStates = new Map<string, DemoStateSummary>()

export function formatDemoStateForPrompt(state: DemoStateSummary): string {
  const lines = [
    'Current interactive demo state:',
    `${state.label}: ${state.summary}`,
    state.phase ? `Phase: ${state.phase}` : null,
    state.prediction
      ? `Prediction: ${state.prediction.prompt}; learner=${state.prediction.learnerChoice ?? 'none'}; actual=${state.prediction.actual ?? 'hidden'}; correct=${typeof state.prediction.correct === 'boolean' ? (state.prediction.correct ? 'yes' : 'no') : 'not checked'}`
      : null,
    state.invariant ? `Invariant: ${state.invariant}` : null,
    state.nextQuestion ? `Next question: ${state.nextQuestion}` : null,
    state.values?.length ? `Visible values: ${state.values.join('; ')}` : null,
  ].filter(Boolean)

  return lines.join('\n')
}

export function getLatestDemoState(conceptId: string) {
  return latestDemoStates.get(conceptId) ?? null
}

export function emitDemoState(state: DemoStateSummary) {
  if (typeof window === 'undefined') return

  const detail = {
    ...state,
    updatedAt: state.updatedAt ?? new Date().toISOString(),
  }

  latestDemoStates.set(detail.conceptId, detail)

  window.dispatchEvent(
    new CustomEvent<DemoStateEventDetail>(DEMO_STATE_EVENT, {
      detail,
    })
  )
}

export function clearDemoState(conceptId: string) {
  if (typeof window === 'undefined') return

  const detail: DemoStateClear = {
    conceptId,
    cleared: true,
    updatedAt: new Date().toISOString(),
  }

  latestDemoStates.delete(conceptId)

  window.dispatchEvent(
    new CustomEvent<DemoStateEventDetail>(DEMO_STATE_EVENT, {
      detail,
    })
  )
}
