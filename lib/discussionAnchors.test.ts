import {
  DISCUSSION_ANCHOR_VERSION,
  DISCUSSION_THREAD_PLACEHOLDER_VERSION,
  buildDiscussionAnchor,
  buildDiscussionAnchorId,
  buildDiscussionPlaceholder,
  discussionAnchorDomId,
  isDiscussionAnchor,
  isDiscussionAnchorId,
  isDiscussionAnchorListItem,
  isDiscussionThreadPlaceholder,
  isSafeDiscussionExternalUrl,
  isSafeDiscussionInternalHref,
} from './discussionAnchors'

describe('discussion anchors', () => {
  it('builds stable path-like ids', () => {
    expect(buildDiscussionAnchorId('equation', 'attention-serving', ['kv-memory'])).toBe(
      'equation/attention-serving/kv-memory'
    )
    expect(buildDiscussionAnchorId('source', 'concept-notebook', ['llm-systems', 'moe-serving', 'sources'])).toBe(
      'source/concept-notebook/llm-systems/moe-serving/sources'
    )
    expect(buildDiscussionAnchorId('code-witness', 'concept-notebook', ['llm-systems', 'moe-serving', 'code'])).toBe(
      'code-witness/concept-notebook/llm-systems/moe-serving/code'
    )
    expect(discussionAnchorDomId('equation/attention-serving/kv-memory')).toBe(
      'discussion__equation__attention-serving__kv-memory'
    )
  })

  it('rejects invalid object types and segments', () => {
    expect(buildDiscussionAnchorId('thread' as never, 'graph', ['attention-serving'])).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'bad-surface' as never, ['attention-serving'])).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'attention-serving', [''] as never)).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'attention-serving', ['KV-memory'])).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'attention-serving', ['..'])).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'attention-serving', ['escape/route'])).toBeNull()
    expect(buildDiscussionAnchorId('equation', 'attention-serving', [`a${'b'.repeat(220)}`])).toBeNull()
  })

  it('validates anchor id shape', () => {
    expect(isDiscussionAnchorId('claim/paper-map/kv-cache/decode-memory-first')).toBe(true)
    expect(isDiscussionAnchorId('thread/paper-map/kv-cache')).toBe(false)
    expect(isDiscussionAnchorId('claim/paper-map/KV-cache')).toBe(false)
    expect(isDiscussionAnchorId('claim')).toBe(false)
  })

  it('validates internal and external discussion URLs', () => {
    expect(isSafeDiscussionInternalHref('/paths/attention-serving/#serving-module')).toBe(true)
    expect(isSafeDiscussionInternalHref('#discussion-equation-attention-serving-kv-memory')).toBe(true)
    expect(isSafeDiscussionInternalHref('https://example.com')).toBe(false)
    expect(isSafeDiscussionInternalHref('/\\evil.com')).toBe(false)
    expect(isSafeDiscussionInternalHref('//evil.com')).toBe(false)
    expect(isSafeDiscussionInternalHref('javascript:alert(1)')).toBe(false)

    expect(isSafeDiscussionExternalUrl('https://discuss.example.com/t/123')).toBe(true)
    expect(isSafeDiscussionExternalUrl('http://discuss.example.com/t/123')).toBe(false)
    expect(isSafeDiscussionExternalUrl('/local-thread')).toBe(false)
  })

  it('validates anchors and thread placeholders', () => {
    const anchor = buildDiscussionAnchor({
      objectType: 'claim',
      surface: 'paper-map',
      segments: ['kv-cache', 'decode-memory-first'],
      title: 'Decode-time memory first',
      contextLabel: 'Claim check',
      href: '/paper-map/#discussion__claim__paper-map__kv-cache__decode-memory-first',
      sourceIds: ['input', 'llm-serving'],
    })

    expect(anchor).toEqual({
      version: DISCUSSION_ANCHOR_VERSION,
      id: 'claim/paper-map/kv-cache/decode-memory-first',
      objectType: 'claim',
      surface: 'paper-map',
      title: 'Decode-time memory first',
      contextLabel: 'Claim check',
      href: '/paper-map/#discussion__claim__paper-map__kv-cache__decode-memory-first',
      sourceIds: ['input', 'llm-serving'],
    })
    expect(isDiscussionAnchor(anchor)).toBe(true)

    const thread = anchor ? buildDiscussionPlaceholder(anchor, 'What exact evidence supports this claim?') : null

    expect(thread).toEqual({
      version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
      anchorId: 'claim/paper-map/kv-cache/decode-memory-first',
      state: 'placeholder',
      seedPrompt: 'What exact evidence supports this claim?',
      externalThreadUrl: undefined,
    })
    expect(isDiscussionThreadPlaceholder(thread)).toBe(true)
    expect(isDiscussionAnchorListItem({ anchor, thread })).toBe(true)
    expect(isDiscussionAnchorListItem({ anchor, thread: { ...thread!, anchorId: 'claim/paper-map/other-paper/other-claim' } })).toBe(false)
  })

  it('accepts longer structured seed prompts for exact claim-check handoffs', () => {
    const anchor = buildDiscussionAnchor({
      objectType: 'claim',
      surface: 'concept-notebook',
      segments: ['llm-systems', 'moe-serving', 'claim-check', 'routing-load-balance-support'],
      title: 'Sparse routing claim',
    })
    const seedPrompt = [
      'Review this claim check.',
      `Claim: ${'routing skew creates stragglers '.repeat(10).trim()}`,
      `Support note: ${'source-backed support detail '.repeat(20).trim()}`,
      `Caveat: ${'scope caveat '.repeat(12).trim()}`,
      'Object refs: #source-span-shazeer-2017-sparsely-gated-moe, #math-object-1, #code-witness-1, #interactive-demo',
    ].join('\n')
    const thread = anchor ? buildDiscussionPlaceholder(anchor, seedPrompt) : null

    expect(seedPrompt.length).toBeGreaterThan(360)
    expect(isDiscussionThreadPlaceholder(thread)).toBe(true)
    expect(thread?.seedPrompt).toBe(seedPrompt)
  })

  it('accepts canonical object keys when they match the discussion object type', () => {
    const equationAnchor = buildDiscussionAnchor({
      objectType: 'equation',
      surface: 'concept-notebook',
      segments: ['attention-transformers', 'rope', 'math', 'equation-1'],
      title: 'RoPE equation',
      objectKey: 'equation:attention-transformers/rope#math-object-1',
    })
    const codeAnchor = buildDiscussionAnchor({
      objectType: 'code-witness',
      surface: 'concept-notebook',
      segments: ['optimization', 'adam', 'code', 'code-witness-1'],
      title: 'Adam code witness',
      objectKey: 'code:optimization/adam#code-witness-1',
    })
    const sourceSpanAnchor = buildDiscussionAnchor({
      objectType: 'source',
      surface: 'concept-notebook',
      segments: ['llm-systems', 'llm-serving', 'source-span', 'yu-2022-orca'],
      title: 'Orca source span',
      objectKey: 'source-span:llm-systems/llm-serving#yu-2022-orca',
    })

    expect(equationAnchor?.objectKey).toBe('equation:attention-transformers/rope#math-object-1')
    expect(codeAnchor?.objectKey).toBe('code:optimization/adam#code-witness-1')
    expect(sourceSpanAnchor?.objectKey).toBe('source-span:llm-systems/llm-serving#yu-2022-orca')
  })

  it('rejects object keys that disagree with the discussion object type', () => {
    expect(
      buildDiscussionAnchor({
        objectType: 'equation',
        surface: 'concept-notebook',
        segments: ['attention-transformers', 'rope', 'math'],
        title: 'RoPE equation',
        objectKey: 'demo:attention-transformers/rope#interactive-demo',
      })
    ).toBeNull()
  })

  it('rejects unsafe anchor and external placeholder shapes', () => {
    expect(
      isDiscussionAnchor({
        version: DISCUSSION_ANCHOR_VERSION,
        id: 'claim/paper-map/kv-cache',
        objectType: 'claim',
        surface: 'paper-map',
        title: 'Claim',
        href: 'https://example.com',
      })
    ).toBe(false)

    expect(
      isDiscussionAnchor({
        version: DISCUSSION_ANCHOR_VERSION,
        id: 'claim/paper-map/kv-cache',
        objectType: 'claim',
        surface: 'graph',
        title: 'Claim',
      })
    ).toBe(false)

    expect(
      isDiscussionThreadPlaceholder({
        version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
        anchorId: 'claim/paper-map/kv-cache',
        state: 'external',
        seedPrompt: 'Open this thread',
        externalThreadUrl: 'http://example.com/thread',
      })
    ).toBe(false)
    expect(isSafeDiscussionExternalUrl('https://user:pass@example.com/thread')).toBe(false)
    expect(isSafeDiscussionExternalUrl('https://example.com/\\thread')).toBe(false)
  })
})
