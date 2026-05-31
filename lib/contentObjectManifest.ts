import {
  CONTENT_OBJECT_KEY_VERSION,
  contentObjectTypeFromKey,
  isContentObjectKey,
  isContentObjectType,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'

export const CONTENT_OBJECT_MANIFEST_VERSION = 'cf-content-object-manifest-v1' as const

export const contentObjectStabilities = [
  'canonical',
  'content-derived',
  'generated-span',
  'route-derived',
] as const

export type ContentObjectStability = (typeof contentObjectStabilities)[number]

export type ContentObjectManifestObject = {
  key: ContentObjectKey
  type: ContentObjectType
  title: string
  href?: string
  domain?: string
  conceptId?: string
  status?: string
  stability: ContentObjectStability
  sourceIds?: readonly string[]
  objectRefs?: readonly ContentObjectKey[]
  discussionAnchorId?: string
}

export type ContentObjectManifest = {
  version: typeof CONTENT_OBJECT_MANIFEST_VERSION
  keyVersion: typeof CONTENT_OBJECT_KEY_VERSION
  objects: readonly ContentObjectManifestObject[]
}

const internalHrefBase = 'https://continuous-function.local'

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isOptionalBoundedString(value: unknown, maxLength: number) {
  return value === undefined || isBoundedString(value, maxLength)
}

function isContentObjectStability(value: unknown): value is ContentObjectStability {
  return typeof value === 'string' && (contentObjectStabilities as readonly string[]).includes(value)
}

function isSafeInternalHref(value: unknown): value is string {
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

function isOptionalSourceIds(value: unknown): value is readonly string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 8 &&
      value.every((item) => isBoundedString(item, 80) && !/[\u0000-\u001F\u007F]/.test(item)))
  )
}

function validateManifestObjectShape(value: unknown, index: number): string[] {
  const issues: string[] = []
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return [`objects[${index}] must be an object`]
  }

  const object = value as Partial<ContentObjectManifestObject>
  if (!isContentObjectKey(object.key)) {
    issues.push(`objects[${index}].key must be a valid content object key`)
  }
  if (!isContentObjectType(object.type)) {
    issues.push(`objects[${index}].type must be a valid content object type`)
  }
  if (isContentObjectKey(object.key) && isContentObjectType(object.type) && contentObjectTypeFromKey(object.key) !== object.type) {
    issues.push(`objects[${index}].type must match key type`)
  }
  if (!isBoundedString(object.title, 180)) {
    issues.push(`objects[${index}].title must be a useful bounded string`)
  }
  if (object.href !== undefined && !isSafeInternalHref(object.href)) {
    issues.push(`objects[${index}].href must be a safe internal href`)
  }
  if (!isContentObjectStability(object.stability)) {
    issues.push(`objects[${index}].stability must be a known stability label`)
  }
  if (!isOptionalBoundedString(object.domain, 80)) {
    issues.push(`objects[${index}].domain must be bounded when present`)
  }
  if (!isOptionalBoundedString(object.conceptId, 80)) {
    issues.push(`objects[${index}].conceptId must be bounded when present`)
  }
  if (!isOptionalBoundedString(object.status, 40)) {
    issues.push(`objects[${index}].status must be bounded when present`)
  }
  if (!isOptionalSourceIds(object.sourceIds)) {
    issues.push(`objects[${index}].sourceIds must be a compact bounded list`)
  }
  if (
    object.objectRefs !== undefined &&
    (!Array.isArray(object.objectRefs) ||
      object.objectRefs.length > 12 ||
      !object.objectRefs.every(isContentObjectKey))
  ) {
    issues.push(`objects[${index}].objectRefs must be valid content object keys`)
  }
  if (!isOptionalBoundedString(object.discussionAnchorId, 220)) {
    issues.push(`objects[${index}].discussionAnchorId must be bounded when present`)
  }

  return issues
}

export function validateContentObjectManifest(value: unknown): string[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['manifest must be an object']
  }

  const manifest = value as Partial<ContentObjectManifest>
  const issues: string[] = []

  if (manifest.version !== CONTENT_OBJECT_MANIFEST_VERSION) {
    issues.push(`manifest.version must be ${CONTENT_OBJECT_MANIFEST_VERSION}`)
  }
  if (manifest.keyVersion !== CONTENT_OBJECT_KEY_VERSION) {
    issues.push(`manifest.keyVersion must be ${CONTENT_OBJECT_KEY_VERSION}`)
  }
  if (!Array.isArray(manifest.objects)) {
    issues.push('manifest.objects must be an array')
    return issues
  }

  const seen = new Set<string>()
  let previousKey = ''

  manifest.objects.forEach((object, index) => {
    issues.push(...validateManifestObjectShape(object, index))

    if (!object || typeof object !== 'object') return
    const key = (object as Partial<ContentObjectManifestObject>).key
    if (!isContentObjectKey(key)) return

    if (seen.has(key)) {
      issues.push(`duplicate content object key: ${key}`)
    }
    seen.add(key)

    if (previousKey && key.localeCompare(previousKey) < 0) {
      issues.push(`manifest objects must be sorted by key: ${key} appears after ${previousKey}`)
    }
    previousKey = key
  })

  manifest.objects.forEach((object) => {
    if (!object || typeof object !== 'object') return
    const refs = (object as Partial<ContentObjectManifestObject>).objectRefs
    if (!Array.isArray(refs)) return

    refs.forEach((ref) => {
      if (isContentObjectKey(ref) && !seen.has(ref)) {
        issues.push(`content object ${String((object as Partial<ContentObjectManifestObject>).key)} references missing object ${ref}`)
      }
    })
  })

  return issues
}

export function isContentObjectManifest(value: unknown): value is ContentObjectManifest {
  return validateContentObjectManifest(value).length === 0
}

export function findContentObjectByKey(
  manifest: ContentObjectManifest,
  key: ContentObjectKey
): ContentObjectManifestObject | null {
  return manifest.objects.find((object) => object.key === key) ?? null
}
