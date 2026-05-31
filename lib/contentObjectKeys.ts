export const CONTENT_OBJECT_KEY_VERSION = 'cf-content-object-key-v1' as const

export const contentObjectTypes = [
  'concept',
  'route',
  'demo',
  'equation',
  'code',
  'source',
  'source-span',
  'claim',
  'misconception',
  'paper',
] as const

export type ContentObjectType = (typeof contentObjectTypes)[number]
export type ContentObjectKey = `${ContentObjectType}:${string}`

const maxContentObjectKeyLength = 260
const maxContentObjectPathSegments = 6
const contentObjectSegmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/
const contentObjectFragmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/
const mathObjectRefPattern = /^#math-object-[1-9]\d*$/
const codeWitnessRefPattern = /^#code-witness-[1-9]\d*$/
const sourceSpanRefPattern = /^#source-span-[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/

export type ParsedContentObjectKey = {
  type: ContentObjectType
  path: string
  pathSegments: string[]
  fragment?: string
}

export function isContentObjectType(value: unknown): value is ContentObjectType {
  return typeof value === 'string' && (contentObjectTypes as readonly string[]).includes(value)
}

export function isContentObjectSegment(value: unknown): value is string {
  return typeof value === 'string' && contentObjectSegmentPattern.test(value)
}

export function isContentObjectFragment(value: unknown): value is string {
  return typeof value === 'string' && contentObjectFragmentPattern.test(value)
}

function hasUnsafeContentObjectCharacters(value: string) {
  return /[\u0000-\u001F\u007F\\\s]/.test(value)
}

export function parseContentObjectKey(value: unknown): ParsedContentObjectKey | null {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxContentObjectKeyLength ||
    hasUnsafeContentObjectCharacters(value) ||
    value.includes('//')
  ) {
    return null
  }

  const separator = value.indexOf(':')
  if (separator <= 0) return null

  const type = value.slice(0, separator)
  if (!isContentObjectType(type)) return null

  const body = value.slice(separator + 1)
  if (!body || body.startsWith('/') || body.startsWith('#')) return null

  const hashIndex = body.indexOf('#')
  const pathPart = hashIndex >= 0 ? body.slice(0, hashIndex) : body
  const fragment = hashIndex >= 0 ? body.slice(hashIndex + 1) : undefined
  const pathSegments = pathPart.split('/')

  if (
    !pathSegments.length ||
    pathSegments.length > maxContentObjectPathSegments ||
    !pathSegments.every(isContentObjectSegment)
  ) {
    return null
  }

  if (fragment !== undefined && !isContentObjectFragment(fragment)) return null

  return {
    type,
    path: pathSegments.join('/'),
    pathSegments,
    fragment,
  }
}

export function isContentObjectKey(value: unknown): value is ContentObjectKey {
  return parseContentObjectKey(value) !== null
}

export function contentObjectTypeFromKey(value: ContentObjectKey): ContentObjectType {
  return parseContentObjectKey(value)!.type
}

export function buildContentObjectKey(
  type: ContentObjectType,
  pathSegments: [string, ...string[]],
  fragment?: string
): ContentObjectKey | null {
  if (!isContentObjectType(type)) return null
  if (!pathSegments.length || pathSegments.length > maxContentObjectPathSegments) return null
  if (!pathSegments.every(isContentObjectSegment)) return null
  if (fragment !== undefined && !isContentObjectFragment(fragment)) return null

  const key = `${type}:${pathSegments.join('/')}${fragment ? `#${fragment}` : ''}`
  return isContentObjectKey(key) ? (key as ContentObjectKey) : null
}

export function conceptContentObjectPath(domain: string, conceptId: string): [string, string] | null {
  return isContentObjectSegment(domain) && isContentObjectSegment(conceptId) ? [domain, conceptId] : null
}

export function buildConceptContentObjectKey(
  type: ContentObjectType,
  domain: string,
  conceptId: string,
  fragment?: string
): ContentObjectKey | null {
  const path = conceptContentObjectPath(domain, conceptId)
  return path ? buildContentObjectKey(type, path, fragment) : null
}

export function contentObjectKeyForConceptFragmentRef(
  domain: string,
  conceptId: string,
  ref: string
): ContentObjectKey | null {
  if (!ref.startsWith('#')) return null

  const fragment = ref.slice(1)
  if (mathObjectRefPattern.test(ref)) {
    return buildConceptContentObjectKey('equation', domain, conceptId, fragment)
  }
  if (codeWitnessRefPattern.test(ref)) {
    return buildConceptContentObjectKey('code', domain, conceptId, fragment)
  }
  if (fragment === 'interactive-demo') {
    return buildConceptContentObjectKey('demo', domain, conceptId, fragment)
  }
  if (sourceSpanRefPattern.test(ref)) {
    return buildConceptContentObjectKey('source-span', domain, conceptId, fragment.replace(/^source-span-/, ''))
  }

  return null
}
