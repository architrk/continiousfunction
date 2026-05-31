import {
  DISCUSSION_ANCHOR_VERSION,
  DISCUSSION_THREAD_PLACEHOLDER_VERSION,
  type DiscussionAnchorListItem,
} from './discussionAnchors'
import {
  buildResearchDiscussionPrompt,
  buildResearchDiscussionRoomPacket,
  routeSourceObjectFromDiscussionItem,
} from './researchDiscussionRoom'

const item: DiscussionAnchorListItem = {
  anchor: {
    version: DISCUSSION_ANCHOR_VERSION,
    id: 'claim/paper-map/kv-cache/decode-memory-first',
    objectType: 'claim',
    surface: 'paper-map',
    title: 'Decode-time KV memory should be inspected first',
    contextLabel: 'high confidence claim',
    sourceIds: ['input', 'efficient-attention'],
  },
  thread: {
    version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
    anchorId: 'claim/paper-map/kv-cache/decode-memory-first',
    state: 'placeholder',
    seedPrompt: 'What evidence would make this claim stronger or weaker?',
  },
}

describe('research discussion room helpers', () => {
  it('turns a discussion item into a route source object', () => {
    expect(routeSourceObjectFromDiscussionItem(item)).toEqual({
      type: 'claim',
      id: 'decode-memory-first',
      discussionAnchorId: 'claim/paper-map/kv-cache/decode-memory-first',
      title: 'Decode-time KV memory should be inspected first',
      href: undefined,
      role: 'What evidence would make this claim stronger or weaker?',
      status: 'high confidence claim',
      sourceIds: ['input', 'efficient-attention'],
    })
  })

  it('keeps generated route object role and status within snapshot validator limits', () => {
    const routeObject = routeSourceObjectFromDiscussionItem({
      anchor: {
        ...item.anchor,
        contextLabel: 'x'.repeat(180),
      },
      thread: {
        ...item.thread,
        seedPrompt: 'Which exact part of this unusually long research question should be carried forward into the saved route snapshot before the learner leaves the page?',
      },
    })

    expect(routeObject.role).toHaveLength(140)
    expect(routeObject.role?.endsWith('...')).toBe(true)
    expect(routeObject.status).toHaveLength(120)
    expect(routeObject.status?.endsWith('...')).toBe(true)
  })

  it('builds evidence, resolution, and AI handoff prompts around the exact object', () => {
    const packet = buildResearchDiscussionRoomPacket(item)
    const prompt = buildResearchDiscussionPrompt(item)

    expect(packet.objectTypeLabel).toBe('claim')
    expect(packet.evidenceChecklist).toContain('Source ids to inspect: input, efficient-attention')
    expect(packet.evidenceChecklist).toContain('Exact source quote or local paper clue that motivates the claim')
    expect(packet.resolutionRubric).toContain('The claim is either source-supported, weakened, or marked unverified')
    expect(prompt).toContain('Anchor id: claim/paper-map/kv-cache/decode-memory-first')
    expect(prompt).toContain('Open question: What evidence would make this claim stronger or weaker?')
    expect(prompt).toContain('Answer as a careful research tutor')
  })

  it('preserves canonical object keys in route objects and prompts', () => {
    const keyedItem: DiscussionAnchorListItem = {
      anchor: {
        ...item.anchor,
        objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
      },
      thread: item.thread,
    }
    const packet = buildResearchDiscussionRoomPacket(keyedItem)

    expect(packet.routeObject.objectKey).toBe('claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory')
    expect(packet.aiPrompt).toContain(
      'Object key: claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory'
    )
  })

  it('includes carried route observations in the AI handoff prompt', () => {
    const packet = buildResearchDiscussionRoomPacket(item, {
      label: 'Demo prediction',
      value: 'Prediction lens: An invariant holds',
      detail: 'Name what stays true while controls change.',
      nextQuestion: 'Which slider tests the central claim?',
      source: 'prediction-checkpoint',
    })

    expect(packet.carriedObservation?.value).toBe('Prediction lens: An invariant holds')
    expect(packet.aiPrompt).toContain('Carried route observation:')
    expect(packet.aiPrompt).toContain('- Demo prediction: Prediction lens: An invariant holds')
    expect(packet.aiPrompt).toContain('- Observation source: prediction-checkpoint')
  })

  it('includes selected object-room context and distilled cards in the AI handoff prompt', () => {
    const packet = buildResearchDiscussionRoomPacket(item, undefined, undefined, {
      objectContext: 'A paper claim says grouped-query attention compresses the KV cache during decode.',
      sourceBoundary: 'Use Shazeer for MQA and Ainslie for GQA; do not attribute KV-cache shrinkage to FlashAttention.',
      nextExperiment: 'Hold layers and d_head fixed, then change Hkv before changing sequence length.',
      canonicality: 'Treat this as a local object-room draft.',
      roomCards: [
        {
          label: 'Best explanation',
          title: 'Separate cache writes, reads, and IO-aware attention.',
          body: 'GQA changes the KV-head factor while FlashAttention changes exact attention tiling.',
          meta: 'attached room card',
        },
        {
          label: 'Professor note',
          title: 'Make the invariant a shape statement first.',
          body: 'Name B, L, T, Hkv, d_head, and bytes before saying efficient.',
        },
      ],
    })

    expect(packet.objectRoomContext?.roomCards).toHaveLength(2)
    expect(packet.aiPrompt).toContain('Selected object-room context:')
    expect(packet.aiPrompt).toContain('Source boundary: Use Shazeer for MQA and Ainslie for GQA')
    expect(packet.aiPrompt).toContain('Distilled room cards:')
    expect(packet.aiPrompt).toContain('Best explanation: Separate cache writes, reads, and IO-aware attention.')
    expect(packet.aiPrompt).toContain('Next experiment: Hold layers and d_head fixed')
    expect(packet.aiPrompt).toContain('Non-canonical boundary: Treat this as a local object-room draft.')
  })

  it('includes only the selected object local draft in the AI handoff prompt', () => {
    const keyedItem: DiscussionAnchorListItem = {
      anchor: {
        ...item.anchor,
        objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
      },
      thread: item.thread,
    }
    const packet = buildResearchDiscussionRoomPacket(keyedItem, undefined, {
      objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
      note: 'The memory claim needs the source span checked against the equation object.',
      nextAction: 'Inspect the code witness before trusting the summary.',
      updatedAt: '2026-05-06T00:00:00.000Z',
    })

    expect(packet.localDraft?.nextAction).toBe('Inspect the code witness before trusting the summary.')
    expect(packet.aiPrompt).toContain('Local action draft:')
    expect(packet.aiPrompt).toContain(
      '- Object key: claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory'
    )
    expect(packet.aiPrompt).toContain(
      '- Draft note: The memory claim needs the source span checked against the equation object.'
    )
    expect(packet.aiPrompt).toContain('- Next action: Inspect the code witness before trusting the summary.')
  })

  it('rejects mismatched or unkeyed local drafts before building the AI handoff prompt', () => {
    const keyedItem: DiscussionAnchorListItem = {
      anchor: {
        ...item.anchor,
        objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
      },
      thread: item.thread,
    }
    const wrongDraft = {
      objectKey: 'equation:attention-transformers/rope#math-object-1' as const,
      note: 'This equation note must not leak into the claim prompt.',
      nextAction: 'Inspect the equation.',
      updatedAt: '2026-05-06T00:00:00.000Z',
    }

    const mismatchedPacket = buildResearchDiscussionRoomPacket(keyedItem, undefined, wrongDraft)
    const unkeyedPacket = buildResearchDiscussionRoomPacket(item, undefined, {
      objectKey: 'claim:llm-systems/llm-serving#iteration-scheduling-kv-cache-memory',
      note: 'This claim note must not attach to an unkeyed item.',
      nextAction: 'Add a canonical object key first.',
      updatedAt: '2026-05-06T00:00:00.000Z',
    })

    expect(mismatchedPacket.localDraft).toBeUndefined()
    expect(mismatchedPacket.aiPrompt).not.toContain('This equation note must not leak')
    expect(unkeyedPacket.localDraft).toBeUndefined()
    expect(unkeyedPacket.aiPrompt).not.toContain('This claim note must not attach')
  })

  it('builds source and code-witness packets without losing the exact anchor', () => {
    const sourceItem: DiscussionAnchorListItem = {
      anchor: {
        version: DISCUSSION_ANCHOR_VERSION,
        id: 'source/concept-notebook/llm-systems/moe-serving/sources',
        objectType: 'source',
        surface: 'concept-notebook',
        title: 'MoE Serving source grounding',
        contextLabel: 'Switch Transformers',
        sourceIds: ['fedus-2021-switch-transformer'],
      },
      thread: {
        version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
        anchorId: 'source/concept-notebook/llm-systems/moe-serving/sources',
        state: 'placeholder',
        seedPrompt: 'Which source supports the serving mechanism?',
      },
    }
    const codeItem: DiscussionAnchorListItem = {
      anchor: {
        version: DISCUSSION_ANCHOR_VERSION,
        id: 'code-witness/concept-notebook/llm-systems/moe-serving/code',
        objectType: 'code-witness',
        surface: 'concept-notebook',
        title: 'MoE Serving code witness',
      },
      thread: {
        version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
        anchorId: 'code-witness/concept-notebook/llm-systems/moe-serving/code',
        state: 'placeholder',
        seedPrompt: 'Which line mirrors the equation?',
      },
    }

    expect(buildResearchDiscussionRoomPacket(sourceItem)).toEqual(
      expect.objectContaining({
        objectTypeLabel: 'source',
        routeObject: expect.objectContaining({
          type: 'source',
          discussionAnchorId: 'source/concept-notebook/llm-systems/moe-serving/sources',
        }),
      })
    )
    expect(buildResearchDiscussionRoomPacket(sourceItem).evidenceChecklist).toContain(
      'Source ids to inspect: fedus-2021-switch-transformer'
    )
    expect(buildResearchDiscussionRoomPacket(codeItem).objectTypeLabel).toBe('code witness')
    expect(buildResearchDiscussionRoomPacket(codeItem).resolutionRubric).toContain(
      'The code and math name the same objects'
    )
  })

  it('adds exact source-note span evidence for source-span objects', () => {
    const sourceSpanItem: DiscussionAnchorListItem = {
      anchor: {
        version: DISCUSSION_ANCHOR_VERSION,
        id: 'source/concept-notebook/llm-systems/moe-serving/source-span/shazeer-2017-sparsely-gated-moe',
        objectType: 'source',
        surface: 'concept-notebook',
        title: 'Sparsely-Gated MoE support span',
        contextLabel: 'Grounds sparse expert routing',
        href: '/domains/llm-systems/moe-serving/#source-span-shazeer-2017-sparsely-gated-moe',
        sourceIds: ['shazeer-2017-sparsely-gated-moe'],
      },
      thread: {
        version: DISCUSSION_THREAD_PLACEHOLDER_VERSION,
        anchorId: 'source/concept-notebook/llm-systems/moe-serving/source-span/shazeer-2017-sparsely-gated-moe',
        state: 'placeholder',
        seedPrompt: 'Which exact mechanism claim does this note support?',
      },
    }

    const packet = buildResearchDiscussionRoomPacket(sourceSpanItem)

    expect(packet.evidenceChecklist).toContain('Exact source-note span and the surrounding source-card metadata')
    expect(packet.aiPrompt).toContain('Exact source-note span and the surrounding source-card metadata')
  })
})
