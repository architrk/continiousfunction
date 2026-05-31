import { isContentObjectKey, type ContentObjectKey } from './contentObjectKeys'

export const localObjectActionJournalKey = 'cf:object-action-journal'
export const localObjectActionJournalEventName = 'cf:object-action-journal-change'
export const LOCAL_OBJECT_ACTION_DRAFT_VERSION = 'cf-object-action-draft-v1' as const
export const LOCAL_OBJECT_ACTION_RESOLUTION_VERSION = 'cf-object-action-resolution-v1' as const
export const LOCAL_OBJECT_ACTION_JOURNAL_VERSION = 'cf-object-action-journal-v1' as const

const maxDrafts = 48
const maxResolutions = 48
const maxRawJournalLength = 24000
const maxNoteLength = 800
const maxResolutionNoteLength = 800
const maxNextActionLength = 180
const maxResolvedActionLength = 180
const maxObjectTitleLength = 180

export type LocalObjectActionDraft = {
  version: typeof LOCAL_OBJECT_ACTION_DRAFT_VERSION
  objectKey: ContentObjectKey
  objectTitle: string
  note: string
  nextAction: string
  updatedAt: string
  source: 'research-reading-room'
}

export type LocalObjectActionResolution = {
  version: typeof LOCAL_OBJECT_ACTION_RESOLUTION_VERSION
  objectKey: ContentObjectKey
  objectTitle: string
  resolvedAction: string
  resolutionNote: string
  updatedAt: string
  source: 'research-reading-room'
}

export type LocalObjectActionJournal = {
  version: typeof LOCAL_OBJECT_ACTION_JOURNAL_VERSION
  drafts: Record<ContentObjectKey, LocalObjectActionDraft>
  resolutions: Record<ContentObjectKey, LocalObjectActionResolution>
}

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): StorageLike | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function dispatchJournalEvent(draft: LocalObjectActionDraft | null) {
  if (typeof window === 'undefined') return
  if (typeof window.dispatchEvent !== 'function' || typeof CustomEvent !== 'function') return
  window.dispatchEvent(new CustomEvent(localObjectActionJournalEventName, { detail: draft }))
}

function emptyJournal(): LocalObjectActionJournal {
  return {
    version: LOCAL_OBJECT_ACTION_JOURNAL_VERSION,
    drafts: {},
    resolutions: {},
  }
}

function isBoundedText(value: unknown, maxLength: number) {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength && !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value)
}

export function isLocalObjectActionDraft(value: unknown): value is LocalObjectActionDraft {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalObjectActionDraft>
  return (
    candidate.version === LOCAL_OBJECT_ACTION_DRAFT_VERSION &&
    isContentObjectKey(candidate.objectKey) &&
    isBoundedText(candidate.objectTitle, maxObjectTitleLength) &&
    isBoundedText(candidate.note, maxNoteLength) &&
    isBoundedText(candidate.nextAction, maxNextActionLength) &&
    typeof candidate.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.updatedAt)) &&
    candidate.source === 'research-reading-room'
  )
}

export function isLocalObjectActionResolution(value: unknown): value is LocalObjectActionResolution {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalObjectActionResolution>
  return (
    candidate.version === LOCAL_OBJECT_ACTION_RESOLUTION_VERSION &&
    isContentObjectKey(candidate.objectKey) &&
    isBoundedText(candidate.objectTitle, maxObjectTitleLength) &&
    isBoundedText(candidate.resolvedAction, maxResolvedActionLength) &&
    isBoundedText(candidate.resolutionNote, maxResolutionNoteLength) &&
    typeof candidate.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(candidate.updatedAt)) &&
    candidate.source === 'research-reading-room'
  )
}

export function isLocalObjectActionJournal(value: unknown): value is LocalObjectActionJournal {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<LocalObjectActionJournal>
  if (candidate.version !== LOCAL_OBJECT_ACTION_JOURNAL_VERSION) return false
  if (!candidate.drafts || typeof candidate.drafts !== 'object' || Array.isArray(candidate.drafts)) return false
  if (
    candidate.resolutions !== undefined &&
    (!candidate.resolutions || typeof candidate.resolutions !== 'object' || Array.isArray(candidate.resolutions))
  ) {
    return false
  }

  const entries = Object.entries(candidate.drafts)
  if (entries.length > maxDrafts) return false
  const resolutionEntries = Object.entries(candidate.resolutions ?? {})
  if (resolutionEntries.length > maxResolutions) return false

  return (
    entries.every(([key, draft]) => isContentObjectKey(key) && isLocalObjectActionDraft(draft) && draft.objectKey === key) &&
    resolutionEntries.every(
      ([key, resolution]) =>
        isContentObjectKey(key) && isLocalObjectActionResolution(resolution) && resolution.objectKey === key
    )
  )
}

function readJournal(storage: StorageLike | null = browserStorage()) {
  if (!storage) return emptyJournal()

  try {
    const raw = storage.getItem(localObjectActionJournalKey)
    if (!raw || raw.length > maxRawJournalLength) return emptyJournal()
    const parsed = JSON.parse(raw)
    return isLocalObjectActionJournal(parsed)
      ? {
          ...parsed,
          resolutions: boundedResolutions(parsed.resolutions ?? {}),
        }
      : emptyJournal()
  } catch {
    return emptyJournal()
  }
}

export function getLocalObjectActionJournal(storage?: StorageLike | null) {
  return readJournal(storage)
}

export function getLocalObjectActionDraft(objectKey: ContentObjectKey | null | undefined, storage?: StorageLike | null) {
  if (!isContentObjectKey(objectKey)) return null
  return readJournal(storage).drafts[objectKey] ?? null
}

export function getLocalObjectActionResolution(objectKey: ContentObjectKey | null | undefined, storage?: StorageLike | null) {
  if (!isContentObjectKey(objectKey)) return null
  return readJournal(storage).resolutions[objectKey] ?? null
}

function trimDraft(draft: LocalObjectActionDraft): LocalObjectActionDraft {
  return {
    ...draft,
    objectTitle: draft.objectTitle.trim(),
    note: draft.note.trim(),
    nextAction: draft.nextAction.trim(),
  }
}

function trimResolution(resolution: LocalObjectActionResolution): LocalObjectActionResolution {
  return {
    ...resolution,
    objectTitle: resolution.objectTitle.trim(),
    resolvedAction: resolution.resolvedAction.trim(),
    resolutionNote: resolution.resolutionNote.trim(),
  }
}

function boundedDrafts(drafts: Record<ContentObjectKey, LocalObjectActionDraft>) {
  return Object.fromEntries(
    Object.values(drafts)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.objectKey.localeCompare(b.objectKey))
      .slice(0, maxDrafts)
      .sort((a, b) => a.objectKey.localeCompare(b.objectKey))
      .map((draft) => [draft.objectKey, draft])
  ) as Record<ContentObjectKey, LocalObjectActionDraft>
}

function boundedResolutions(resolutions: Record<ContentObjectKey, LocalObjectActionResolution>) {
  return Object.fromEntries(
    Object.values(resolutions)
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt) || a.objectKey.localeCompare(b.objectKey))
      .slice(0, maxResolutions)
      .sort((a, b) => a.objectKey.localeCompare(b.objectKey))
      .map((resolution) => [resolution.objectKey, resolution])
  ) as Record<ContentObjectKey, LocalObjectActionResolution>
}

export function saveLocalObjectActionDraft(draft: LocalObjectActionDraft, storage: StorageLike | null = browserStorage()) {
  if (!storage) return false

  const nextDraft = trimDraft(draft)
  if (!isLocalObjectActionDraft(nextDraft)) return false

  const current = readJournal(storage)
  const nextResolutions = { ...current.resolutions }
  delete nextResolutions[nextDraft.objectKey]
  const nextJournal: LocalObjectActionJournal = {
    version: LOCAL_OBJECT_ACTION_JOURNAL_VERSION,
    drafts: boundedDrafts({
      ...current.drafts,
      [nextDraft.objectKey]: nextDraft,
    }),
    resolutions: boundedResolutions(nextResolutions),
  }

  if (!isLocalObjectActionJournal(nextJournal)) return false

  try {
    const raw = JSON.stringify(nextJournal)
    if (raw.length > maxRawJournalLength) return false
    storage.setItem(localObjectActionJournalKey, raw)
    dispatchJournalEvent(nextDraft)
    return true
  } catch {
    return false
  }
}

export function saveLocalObjectActionResolution(
  resolution: LocalObjectActionResolution,
  storage: StorageLike | null = browserStorage()
) {
  if (!storage) return false

  const nextResolution = trimResolution(resolution)
  if (!isLocalObjectActionResolution(nextResolution)) return false

  const current = readJournal(storage)
  const nextDrafts = { ...current.drafts }
  delete nextDrafts[nextResolution.objectKey]
  const nextJournal: LocalObjectActionJournal = {
    version: LOCAL_OBJECT_ACTION_JOURNAL_VERSION,
    drafts: boundedDrafts(nextDrafts),
    resolutions: boundedResolutions({
      ...current.resolutions,
      [nextResolution.objectKey]: nextResolution,
    }),
  }

  if (!isLocalObjectActionJournal(nextJournal)) return false

  try {
    const raw = JSON.stringify(nextJournal)
    if (raw.length > maxRawJournalLength) return false
    storage.setItem(localObjectActionJournalKey, raw)
    dispatchJournalEvent(null)
    return true
  } catch {
    return false
  }
}

export function clearLocalObjectActionDraft(objectKey: ContentObjectKey | null | undefined, storage: StorageLike | null = browserStorage()) {
  if (!storage || !isContentObjectKey(objectKey)) return false

  const current = readJournal(storage)
  if (!current.drafts[objectKey]) return true

  const nextDrafts = { ...current.drafts }
  delete nextDrafts[objectKey]
  const nextJournal: LocalObjectActionJournal = {
    version: LOCAL_OBJECT_ACTION_JOURNAL_VERSION,
    drafts: boundedDrafts(nextDrafts),
    resolutions: current.resolutions,
  }

  try {
    storage.setItem(localObjectActionJournalKey, JSON.stringify(nextJournal))
    dispatchJournalEvent(null)
    return true
  } catch {
    return false
  }
}

export function clearLocalObjectActionResolution(
  objectKey: ContentObjectKey | null | undefined,
  storage: StorageLike | null = browserStorage()
) {
  if (!storage || !isContentObjectKey(objectKey)) return false

  const current = readJournal(storage)
  if (!current.resolutions[objectKey]) return true

  const nextResolutions = { ...current.resolutions }
  delete nextResolutions[objectKey]
  const nextJournal: LocalObjectActionJournal = {
    version: LOCAL_OBJECT_ACTION_JOURNAL_VERSION,
    drafts: current.drafts,
    resolutions: boundedResolutions(nextResolutions),
  }

  try {
    storage.setItem(localObjectActionJournalKey, JSON.stringify(nextJournal))
    dispatchJournalEvent(null)
    return true
  } catch {
    return false
  }
}

export function clearLocalObjectActionJournal(storage: StorageLike | null = browserStorage()) {
  if (!storage) return false
  try {
    storage.removeItem(localObjectActionJournalKey)
    dispatchJournalEvent(null)
    return true
  } catch {
    return false
  }
}
