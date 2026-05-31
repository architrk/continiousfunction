import {
  buildContentObjectKey,
  contentObjectTypeFromKey,
  parseContentObjectKey,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'

const conceptScopedObjectTypes = new Set<ContentObjectType>([
  'concept',
  'demo',
  'equation',
  'code',
  'source',
  'source-span',
  'claim',
  'misconception',
])

export function routeObjectKeyFromContentObjectKey(objectKey: ContentObjectKey): ContentObjectKey | null {
  if (contentObjectTypeFromKey(objectKey) === 'route') return objectKey

  const parsed = parseContentObjectKey(objectKey)
  if (!parsed || !conceptScopedObjectTypes.has(parsed.type) || parsed.pathSegments.length < 2) {
    return null
  }

  return buildContentObjectKey('route', ['domains', parsed.pathSegments[0], parsed.pathSegments[1]])
}

export function routeObjectKeyFromLearningRouteSnapshot(snapshot: LearningRouteSnapshot): ContentObjectKey | null {
  const currentObjectKey = snapshot.currentObject?.objectKey
  return currentObjectKey ? routeObjectKeyFromContentObjectKey(currentObjectKey) : null
}
