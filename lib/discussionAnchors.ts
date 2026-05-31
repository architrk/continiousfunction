import {
  contentObjectTypeFromKey,
  isContentObjectKey,
  type ContentObjectKey,
  type ContentObjectType,
} from './contentObjectKeys'

export const DISCUSSION_ANCHOR_VERSION = 'cf-discussion-anchor-v1' as const
export const DISCUSSION_THREAD_PLACEHOLDER_VERSION = 'cf-discussion-thread-placeholder-v1' as const
export const maxDiscussionSeedPromptLength = 3200

export const discussionObjectTypes = [
  'concept',
  'equation',
  'source',
  'paper',
  'code-witness',
  'visualization',
  'toy-experiment',
  'claim',
  'misconception',
] as const

export const discussionSurfaces = ['paper-map', 'graph', 'attention-serving', 'concept-notebook'] as const

export type DiscussionObjectType = (typeof discussionObjectTypes)[number]
export type DiscussionSurface = (typeof discussionSurfaces)[number]
export type DiscussionAnchorId = `${DiscussionObjectType}/${DiscussionSurface}/${string}`

export type DiscussionAnchor = {
  version: typeof DISCUSSION_ANCHOR_VERSION
  id: DiscussionAnchorId
  objectType: DiscussionObjectType
  surface: DiscussionSurface
  title: string
  contextLabel?: string
  href?: string
  sourceIds?: string[]
  objectKey?: ContentObjectKey
}

export type DiscussionThreadPlaceholder = {
  version: typeof DISCUSSION_THREAD_PLACEHOLDER_VERSION
  anchorId: DiscussionAnchorId
  state: 'placeholder' | 'external'
  seedPrompt: string
  externalThreadUrl?: string
}

export type DiscussionAnchorListItem = {
  anchor: DiscussionAnchor
  thread: DiscussionThreadPlaceholder
}

export type BuildDiscussionAnchorInput = {
  objectType: DiscussionObjectType
  surface: DiscussionSurface
  segments: [string, ...string[]]
  title: string
  contextLabel?: string
  href?: string
  sourceIds?: string[]
  objectKey?: ContentObjectKey
}

const discussionSegmentPattern = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/
const discussionInternalHrefBase = 'https://continuous-function.local'

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength
}

function isOptionalBoundedString(value: unknown, maxLength: number) {
  return value === undefined || isBoundedString(value, maxLength)
}

export function isDiscussionObjectType(value: unknown): value is DiscussionObjectType {
  return typeof value === 'string' && (discussionObjectTypes as readonly string[]).includes(value)
}

export function isDiscussionSurface(value: unknown): value is DiscussionSurface {
  return typeof value === 'string' && (discussionSurfaces as readonly string[]).includes(value)
}

export function isDiscussionSegment(value: unknown): value is string {
  return typeof value === 'string' && discussionSegmentPattern.test(value)
}

export function buildDiscussionAnchorId(
  objectType: DiscussionObjectType,
  surface: DiscussionSurface,
  segments: [string, ...string[]]
): DiscussionAnchorId | null {
  if (!isDiscussionObjectType(objectType) || !isDiscussionSurface(surface) || !segments.every(isDiscussionSegment)) {
    return null
  }

  const id = `${objectType}/${surface}/${segments.join('/')}`
  return id.length <= 220 ? (id as DiscussionAnchorId) : null
}

export function isDiscussionAnchorId(value: unknown): value is DiscussionAnchorId {
  if (!isBoundedString(value, 220)) return false

  const [objectType, surface, ...segments] = value.split('/')
  return (
    isDiscussionObjectType(objectType) &&
    isDiscussionSurface(surface) &&
    segments.length > 0 &&
    segments.every(isDiscussionSegment)
  )
}

export function discussionAnchorDomId(anchorId: DiscussionAnchorId) {
  return `discussion__${anchorId.replaceAll('/', '__')}`
}

function discussionAnchorIdParts(anchorId: DiscussionAnchorId) {
  const [objectType, surface] = anchorId.split('/')
  return {
    objectType: objectType as DiscussionObjectType,
    surface: surface as DiscussionSurface,
  }
}

function discussionObjectMatchesContentObjectKey(objectType: DiscussionObjectType, objectKey: ContentObjectKey) {
  const contentType = contentObjectTypeFromKey(objectKey)
  const allowedContentTypesByDiscussionType: Record<DiscussionObjectType, readonly ContentObjectType[]> = {
    concept: ['concept'],
    equation: ['equation'],
    source: ['source', 'source-span'],
    paper: ['paper'],
    'code-witness': ['code'],
    visualization: ['demo'],
    'toy-experiment': ['demo', 'route'],
    claim: ['claim'],
    misconception: ['misconception'],
  }

  return allowedContentTypesByDiscussionType[objectType].includes(contentType)
}

export function isSafeDiscussionInternalHref(value: unknown): value is string {
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
    return new URL(value, discussionInternalHrefBase).origin === discussionInternalHrefBase
  } catch {
    return false
  }
}

export function isSafeDiscussionExternalUrl(value: unknown): value is string {
  if (!isBoundedString(value, 300) || /[\u0000-\u001F\u007F\\]/.test(value)) return false

  try {
    const parsed = new URL(value)
    return parsed.protocol === 'https:' && parsed.hostname.length > 0 && parsed.username === '' && parsed.password === ''
  } catch {
    return false
  }
}

function isOptionalSourceIds(value: unknown): value is string[] | undefined {
  return (
    value === undefined ||
    (Array.isArray(value) &&
      value.length <= 8 &&
      value.every((item) => isBoundedString(item, 80) && !/[\u0000-\u001F\u007F]/.test(item)))
  )
}

export function isDiscussionAnchor(value: unknown): value is DiscussionAnchor {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<DiscussionAnchor>
  if (
    candidate.version !== DISCUSSION_ANCHOR_VERSION ||
    !isDiscussionAnchorId(candidate.id) ||
    !isDiscussionObjectType(candidate.objectType) ||
    !isDiscussionSurface(candidate.surface)
  ) {
    return false
  }

  const parts = discussionAnchorIdParts(candidate.id)

  return (
    parts.objectType === candidate.objectType &&
    parts.surface === candidate.surface &&
    isBoundedString(candidate.title, 160) &&
    isOptionalBoundedString(candidate.contextLabel, 140) &&
    (candidate.href === undefined || isSafeDiscussionInternalHref(candidate.href)) &&
    isOptionalSourceIds(candidate.sourceIds) &&
    (candidate.objectKey === undefined ||
      (isContentObjectKey(candidate.objectKey) &&
        discussionObjectMatchesContentObjectKey(candidate.objectType, candidate.objectKey)))
  )
}

export function isDiscussionThreadPlaceholder(value: unknown): value is DiscussionThreadPlaceholder {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<DiscussionThreadPlaceholder>

  return (
    candidate.version === DISCUSSION_THREAD_PLACEHOLDER_VERSION &&
    isDiscussionAnchorId(candidate.anchorId) &&
    isBoundedString(candidate.seedPrompt, maxDiscussionSeedPromptLength) &&
    (candidate.state === 'placeholder'
      ? candidate.externalThreadUrl === undefined
      : candidate.state === 'external' && isSafeDiscussionExternalUrl(candidate.externalThreadUrl))
  )
}

export function buildDiscussionAnchor(input: BuildDiscussionAnchorInput): DiscussionAnchor | null {
  const id = buildDiscussionAnchorId(input.objectType, input.surface, input.segments)
  if (!id) return null

  const anchor: DiscussionAnchor = {
    version: DISCUSSION_ANCHOR_VERSION,
    id,
    objectType: input.objectType,
    surface: input.surface,
    title: input.title,
    contextLabel: input.contextLabel,
    href: input.href,
    sourceIds: input.sourceIds,
    objectKey: input.objectKey,
  }

  return isDiscussionAnchor(anchor) ? anchor : null
}

export function buildDiscussionPlaceholder(
  anchor: DiscussionAnchor,
  seedPrompt: string,
  externalThreadUrl?: string
): DiscussionThreadPlaceholder | null {
  const thread: DiscussionThreadPlaceholder = {
    version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
    anchorId: anchor.id,
    state: externalThreadUrl ? 'external' : 'placeholder',
    seedPrompt,
    externalThreadUrl,
  }

  return isDiscussionThreadPlaceholder(thread) ? thread : null
}

export function isDiscussionAnchorListItem(value: unknown): value is DiscussionAnchorListItem {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<DiscussionAnchorListItem>
  return (
    isDiscussionAnchor(candidate.anchor) &&
    isDiscussionThreadPlaceholder(candidate.thread) &&
    candidate.thread.anchorId === candidate.anchor.id
  )
}
