import {
  clearLocalObjectActionDraft,
  clearLocalObjectActionResolution,
  getLocalObjectActionDraft,
  getLocalObjectActionJournal,
  getLocalObjectActionResolution,
  isLocalObjectActionDraft,
  isLocalObjectActionResolution,
  localObjectActionJournalKey,
  saveLocalObjectActionDraft,
  saveLocalObjectActionResolution,
  type LocalObjectActionDraft,
  type LocalObjectActionResolution,
} from './localObjectActionJournal'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string) {
    this.values.set(key, value)
  }

  removeItem(key: string) {
    this.values.delete(key)
  }
}

function draft(overrides: Partial<LocalObjectActionDraft> = {}): LocalObjectActionDraft {
  return {
    version: 'cf-object-action-draft-v1',
    objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
    objectTitle: 'Iteration scheduling claim',
    note: 'PagedAttention changes the memory accounting object, not the attention equation.',
    nextAction: 'Check the source span against the code witness.',
    updatedAt: '2026-05-06T00:00:00.000Z',
    source: 'research-reading-room',
    ...overrides,
  }
}

function resolution(overrides: Partial<LocalObjectActionResolution> = {}): LocalObjectActionResolution {
  return {
    version: 'cf-object-action-resolution-v1',
    objectKey: draft().objectKey,
    objectTitle: 'Iteration scheduling claim',
    resolvedAction: 'Check the source span against the code witness.',
    resolutionNote: 'The source span supports the memory-accounting object.',
    updatedAt: '2026-05-06T00:02:00.000Z',
    source: 'research-reading-room',
    ...overrides,
  }
}

describe('local object action journal', () => {
  it('saves, loads, updates, and clears a valid object-keyed draft', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionDraft(draft(), storage)).toBe(true)

    expect(getLocalObjectActionDraft(draft().objectKey, storage)).toEqual(draft())

    const updated = draft({
      note: 'Updated note.',
      nextAction: 'Compare the equation object next.',
      updatedAt: '2026-05-06T00:01:00.000Z',
    })
    expect(saveLocalObjectActionDraft(updated, storage)).toBe(true)
    expect(getLocalObjectActionDraft(updated.objectKey, storage)?.note).toBe('Updated note.')

    expect(clearLocalObjectActionDraft(updated.objectKey, storage)).toBe(true)
    expect(getLocalObjectActionDraft(updated.objectKey, storage)).toBeNull()
  })

  it('marks an object action resolved and removes the active draft for that object', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionDraft(draft(), storage)).toBe(true)
    expect(saveLocalObjectActionResolution(resolution(), storage)).toBe(true)

    expect(getLocalObjectActionDraft(draft().objectKey, storage)).toBeNull()
    expect(getLocalObjectActionResolution(draft().objectKey, storage)).toEqual(resolution())

    expect(clearLocalObjectActionResolution(draft().objectKey, storage)).toBe(true)
    expect(getLocalObjectActionResolution(draft().objectKey, storage)).toBeNull()
  })

  it('saving a new draft for a resolved object clears the stale resolution', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionResolution(resolution(), storage)).toBe(true)
    expect(saveLocalObjectActionDraft(draft({ nextAction: 'Re-open the source span.' }), storage)).toBe(true)

    expect(getLocalObjectActionResolution(draft().objectKey, storage)).toBeNull()
    expect(getLocalObjectActionDraft(draft().objectKey, storage)?.nextAction).toBe('Re-open the source span.')
  })

  it('rejects invalid identities instead of falling back to hrefs, titles, or anchor ids', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionDraft(draft({ objectKey: '/domains/llm-systems/llm-serving/#claim-review' as never }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ objectKey: 'claim/concept-notebook/llm-systems/llm-serving/central-claim' as never }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ objectKey: 'Iteration scheduling claim' as never }), storage)).toBe(false)
    expect(getLocalObjectActionJournal(storage).drafts).toEqual({})
  })

  it('bounds note, next-action, title, date, and source fields', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionDraft(draft({ note: '' }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ note: 'x'.repeat(801) }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ nextAction: '' }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ nextAction: 'x'.repeat(181) }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ objectTitle: 'x'.repeat(181) }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ updatedAt: 'not-a-date' }), storage)).toBe(false)
    expect(saveLocalObjectActionDraft(draft({ source: 'server' as never }), storage)).toBe(false)
    expect(saveLocalObjectActionResolution(resolution({ resolvedAction: '' }), storage)).toBe(false)
    expect(saveLocalObjectActionResolution(resolution({ resolvedAction: 'x'.repeat(181) }), storage)).toBe(false)
    expect(saveLocalObjectActionResolution(resolution({ resolutionNote: '' }), storage)).toBe(false)
    expect(saveLocalObjectActionResolution(resolution({ resolutionNote: 'x'.repeat(801) }), storage)).toBe(false)
    expect(getLocalObjectActionJournal(storage).drafts).toEqual({})
    expect(getLocalObjectActionJournal(storage).resolutions).toEqual({})
  })

  it('trims user-entered draft text before storing', () => {
    const storage = new MemoryStorage()
    expect(saveLocalObjectActionDraft(draft({ note: '  remember this  ', nextAction: '  inspect source  ' }), storage)).toBe(true)
    expect(getLocalObjectActionDraft(draft().objectKey, storage)).toEqual(
      expect.objectContaining({
        note: 'remember this',
        nextAction: 'inspect source',
      })
    )
  })

  it('bounds total drafts and keeps the most recent entries', () => {
    const storage = new MemoryStorage()
    for (let i = 0; i < 60; i += 1) {
      expect(
        saveLocalObjectActionDraft(
          draft({
            objectKey: `claim:llm-systems/llm-serving#claim-${i}` as never,
            objectTitle: `Claim ${i}`,
            updatedAt: new Date(Date.UTC(2026, 4, 6, 0, i)).toISOString(),
          }),
          storage
        )
      ).toBe(true)
    }

    const journal = getLocalObjectActionJournal(storage)
    expect(Object.keys(journal.drafts)).toHaveLength(48)
    expect(journal.drafts['claim:llm-systems/llm-serving#claim-0' as never]).toBeUndefined()
    expect(journal.drafts['claim:llm-systems/llm-serving#claim-59' as never]).toBeDefined()
  })

  it('returns an empty journal for corrupt or oversized storage', () => {
    const storage = new MemoryStorage()
    storage.setItem(localObjectActionJournalKey, '{not json')
    expect(getLocalObjectActionJournal(storage).drafts).toEqual({})

    storage.setItem(localObjectActionJournalKey, 'x'.repeat(24001))
    expect(getLocalObjectActionJournal(storage).drafts).toEqual({})
  })

  it('fails gracefully when storage is unavailable', () => {
    expect(saveLocalObjectActionDraft(draft(), null)).toBe(false)
    expect(saveLocalObjectActionResolution(resolution(), null)).toBe(false)
    expect(clearLocalObjectActionDraft(draft().objectKey, null)).toBe(false)
    expect(clearLocalObjectActionResolution(draft().objectKey, null)).toBe(false)
    expect(getLocalObjectActionJournal(null).drafts).toEqual({})
  })

  it('validates raw draft objects directly', () => {
    expect(isLocalObjectActionDraft(draft())).toBe(true)
    expect(isLocalObjectActionDraft({ ...draft(), objectKey: 'source:llm-systems/llm-serving#sources' })).toBe(true)
    expect(isLocalObjectActionDraft({ ...draft(), objectKey: 'source/llm-systems/llm-serving/sources' })).toBe(false)
    expect(isLocalObjectActionResolution(resolution())).toBe(true)
    expect(isLocalObjectActionResolution({ ...resolution(), objectKey: 'source/llm-systems/llm-serving/sources' })).toBe(false)
  })
})
