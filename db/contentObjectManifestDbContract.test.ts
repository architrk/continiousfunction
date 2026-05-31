import { contentObjectTypeFromKey, isContentObjectKey } from '../lib/contentObjectKeys'
import {
  validateContentObjectManifest,
  type ContentObjectManifest,
} from '../lib/contentObjectManifest'
import {
  contentObjectManifestObjectToRefInsert,
  contentObjectManifestToRefInserts,
} from './objectMemoryMappers'
import manifestJson from '../content/_generated/content-object-manifest.json'

const manifest = manifestJson as ContentObjectManifest

describe('content object manifest database contract', () => {
  it('maps every generated manifest object to a content_object_refs row', () => {
    expect(validateContentObjectManifest(manifest)).toEqual([])

    const rows = contentObjectManifestToRefInserts(manifest)

    expect(rows).toHaveLength(manifest.objects.length)
    expect(rows.length).toBeGreaterThan(800)
    for (const row of rows) {
      expect(isContentObjectKey(row.objectKey)).toBe(true)
      expect(row.objectType).toBe(contentObjectTypeFromKey(row.objectKey))
      expect(row.origin).toBe('atlas-manifest')
      expect(row.href === null || row.href?.startsWith('/') || row.href?.startsWith('#')).toBe(true)
    }
  })

  it('rejects a manifest object with mismatched key and type', () => {
    const first = manifest.objects[0]

    expect(() =>
      contentObjectManifestObjectToRefInsert({
        ...first,
        type: first.type === 'concept' ? 'route' : 'concept',
      })
    ).toThrow(/mismatched type/)
  })

  it('preserves objectRefs as object keys, not href identities', () => {
    const rowWithRefs = contentObjectManifestToRefInserts(manifest).find((row) => row.objectRefs && row.objectRefs.length > 0)

    expect(rowWithRefs).toBeDefined()
    expect(rowWithRefs!.objectRefs!.every((ref) => isContentObjectKey(ref))).toBe(true)
    expect(rowWithRefs!.objectRefs!.every((ref) => !ref.startsWith('/'))).toBe(true)
  })
})
