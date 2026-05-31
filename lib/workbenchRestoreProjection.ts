import type { ContentObjectKey } from './contentObjectKeys'
import { isContentObjectKey } from './contentObjectKeys'
import type { LearningRouteSnapshot, LearningRouteWorkbenchPayload } from './learningRouteSnapshot'

export const accountWorkbenchRestoreStateVersion = 'cf-learning-observation-workbench-state-v1' as const

const internalHrefBase = 'https://continuous-function.local'

export type AccountWorkbenchRestoreState = {
  version: typeof accountWorkbenchRestoreStateVersion
  type: LearningRouteWorkbenchPayload['type']
  equationObject: {
    label: string
    equation: string
    objectKey: ContentObjectKey
    href: string
  }
  committedPrediction: {
    id: string
    label: string
    text: string
  }
  evidence: string
  invariant: string
  nextMove: string
  changed: LearningRouteWorkbenchPayload['changed']
  heldFixed: LearningRouteWorkbenchPayload['heldFixed']
  result: LearningRouteWorkbenchPayload['result']
  caveat: string
  lab: {
    id: string
    version: string
    state: LearningRouteWorkbenchPayload['lab']['state']
    restoreHref: string
  }
}

export function projectLearningRouteWorkbenchRestoreState(
  snapshot: LearningRouteSnapshot
): AccountWorkbenchRestoreState | null {
  const workbench = snapshot.lastObservation?.workbench
  if (!workbench) return null

  const equationObjectKey = workbench.equationObject.objectKey
  const equation = workbench.equationObject.equation
  const equationHref = workbench.equationObject.href
  const predictionText = workbench.committedPrediction.text
  const restoreHref = workbench.lab.restoreHref

  if (
    !isContentObjectKey(equationObjectKey) ||
    !equation ||
    !isInternalHref(equationHref) ||
    !predictionText ||
    !isInternalHref(restoreHref)
  ) {
    return null
  }

  return {
    version: accountWorkbenchRestoreStateVersion,
    type: workbench.type,
    equationObject: {
      label: workbench.equationObject.label,
      equation,
      objectKey: equationObjectKey,
      href: equationHref,
    },
    committedPrediction: {
      id: workbench.committedPrediction.id,
      label: workbench.committedPrediction.label,
      text: predictionText,
    },
    evidence: workbench.evidence,
    invariant: workbench.invariant,
    nextMove: workbench.nextMove,
    changed: workbench.changed,
    heldFixed: workbench.heldFixed,
    result: workbench.result,
    caveat: workbench.caveat,
    lab: {
      id: workbench.lab.id,
      version: workbench.lab.version,
      state: workbench.lab.state,
      restoreHref,
    },
  }
}

function isInternalHref(value: unknown): value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 260 ||
    /[\u0000-\u001F\u007F\\]/.test(value)
  ) {
    return false
  }

  if (value.startsWith('#')) {
    return value.length > 1 && !value.includes(' ')
  }

  if (!value.startsWith('/') || value.startsWith('//')) return false

  try {
    return new URL(value, internalHrefBase).origin === internalHrefBase
  } catch {
    return false
  }
}
