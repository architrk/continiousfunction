import {
  getSavedLearningRouteSnapshot,
  learningRouteSnapshotKey,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from './learningRouteSnapshot'

function installWindowStorage() {
  const store = new Map<string, string>()

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value)
        },
        removeItem: (key: string) => {
          store.delete(key)
        },
      },
    },
  })

  return store
}

function writeRawSnapshot(store: Map<string, string>, value: unknown) {
  store.set(learningRouteSnapshotKey, JSON.stringify(value))
}

function baseSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'graph',
    paperTitle: 'Computed graph route to State-Space Duality',
    inputKind: 'computed graph route',
    mappingId: 'graph-route:state-space-duality',
    mappingTitle: 'Computed graph route',
    routeLabels: ['Attention', 'Efficient Attention', 'Long Context', 'SSM Hybrids', 'Parallel Scan'],
    routeConceptIds: ['attention', 'efficient-attention', 'long-context', 'ssm-hybrids', 'parallel-scan'],
    routeConcepts: [
      {
        label: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
        role: 'weighted copying',
      },
      {
        label: 'SSM Hybrids',
        href: '/domains/attention-transformers/ssm-hybrids/',
        role: 'fixed-state sequence models',
      },
    ],
    nextRepair: 'Efficient Attention',
    currentQuestion: 'I know Attention. What do I need for State-Space Duality?',
    groundingStatus: 'local-preview',
    createdAt: '2026-05-04T00:00:00.000Z',
    ...overrides,
  }
}

function computedGraphSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return baseSnapshot({
    sourceObjects: [
      {
        type: 'concept',
        id: 'attention',
        discussionAnchorId: 'concept/concept-notebook/attention-transformers/attention',
        title: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
        role: 'Known concept: weighted copying',
        status: 'live',
      },
      {
        type: 'concept',
        id: 'state-space-duality',
        title: 'State-Space Duality',
        role: 'Chosen target: Mamba-style bridge',
        status: 'planned',
      },
    ],
    graphRoute: {
      knownConceptIds: ['attention'],
      targetConceptId: 'state-space-duality',
      routeNodes: [
        {
          id: 'attention',
          label: 'Attention',
          role: 'weighted copying',
          group: 'transformers',
          status: 'live',
          href: '/domains/attention-transformers/attention-transformers/',
        },
        {
          id: 'state-space-duality',
          label: 'State-Space Duality',
          role: 'Mamba-style bridge',
          group: 'frontier',
          status: 'planned',
        },
      ],
      edgeWitnesses: [
        {
          from: 'attention',
          to: 'state-space-duality',
          type: 'paper-specific bridge',
          why: 'The route crosses from attention memory to fixed-state recurrence.',
          weight: 3.5,
        },
      ],
      totalWeight: 3.5,
      nextRepairId: 'state-space-duality',
    },
    ...overrides,
  })
}

describe('learning route snapshot validation', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = installWindowStorage()
  })

  afterEach(() => {
    Reflect.deleteProperty(globalThis, 'window')
  })

  it('loads older snapshots without source objects or computed graph state', () => {
    writeRawSnapshot(store, baseSnapshot({ mappingId: 'kv-cache', inputKind: 'learning question' }))

    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('kv-cache')
  })

  it('returns whether the save helper actually persisted a valid snapshot', () => {
    expect(saveLearningRouteSnapshot(baseSnapshot({ mappingId: 'saved-route' }))).toBe(true)
    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('saved-route')
  })

  it('loads a computed graph route with known concepts, target, route nodes, edges, and source objects', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          id: 'kv-memory-equation',
          discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
          title: 'KV memory equation',
          role: 'Focused equation for AI context',
          status: 'selected',
          sourceIds: ['input', 'efficient-attention'],
          sourceDetail: 'Page 3, line 4',
          confidence: 'high',
        },
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'attention',
              label: 'Attention',
              status: 'ready',
              evidence: 'Route opened',
              updatedAt: '2026-05-04T00:00:00.000Z',
            },
            {
              stageId: 'efficient-attention',
              label: 'Efficient Attention',
              status: 'active',
            },
          ],
          checkpoints: [
            {
              id: 'kv-prediction',
              label: 'KV prediction',
              status: 'observed',
              detail: 'H_kv was selected',
              updatedAt: '2026-05-04T00:00:00.000Z',
            },
          ],
          resolvedObjectIds: ['equation/attention-serving/kv-memory-symbol'],
          nextRepair: 'Efficient Attention',
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      })
    )

    const snapshot = getSavedLearningRouteSnapshot()

    expect(snapshot?.graphRoute?.knownConceptIds).toEqual(['attention'])
    expect(snapshot?.graphRoute?.targetConceptId).toBe('state-space-duality')
    expect(snapshot?.graphRoute?.routeNodes).toHaveLength(2)
    expect(snapshot?.graphRoute?.edgeWitnesses[0]?.weight).toBe(3.5)
    expect(snapshot?.sourceObjects?.map((object) => object.title)).toEqual(['Attention', 'State-Space Duality'])
    expect(snapshot?.sourceObjects?.[0]?.discussionAnchorId).toBe(
      'concept/concept-notebook/attention-transformers/attention'
    )
    expect(snapshot?.currentObject?.title).toBe('KV memory equation')
    expect(snapshot?.currentObject?.discussionAnchorId).toBe('equation/attention-serving/kv-memory-symbol')
    expect(snapshot?.currentObject?.sourceIds).toEqual(['input', 'efficient-attention'])
    expect(snapshot?.currentObject?.sourceDetail).toBe('Page 3, line 4')
    expect(snapshot?.currentObject?.confidence).toBe('high')
    expect(snapshot?.routeProgress?.stageReadiness[0]?.status).toBe('ready')
    expect(snapshot?.routeProgress?.checkpoints?.[0]?.status).toBe('observed')
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(['equation/attention-serving/kv-memory-symbol'])
  })

  it('accepts concept-notebook source and code-witness route objects', () => {
    const saved = saveLearningRouteSnapshot(
      computedGraphSnapshot({
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: MoE Serving',
        inputKind: 'concept notebook',
        mappingId: 'concept:moe-serving',
        sourceObjects: [
          {
            type: 'source',
            id: 'sources',
            objectKey: 'source:llm-systems/moe-serving#sources',
            discussionAnchorId: 'source/concept-notebook/llm-systems/moe-serving/sources',
            title: 'MoE Serving source grounding',
            href: '#source-grounding',
            sourceIds: ['fedus-2021-switch-transformer'],
          },
          {
            type: 'code-witness',
            id: 'code',
            objectKey: 'code:llm-systems/moe-serving#code-witness-1',
            discussionAnchorId: 'code-witness/concept-notebook/llm-systems/moe-serving/code',
            title: 'MoE Serving code witness',
            href: '#code',
          },
        ],
        currentObject: {
          type: 'code-witness',
          id: 'code',
          objectKey: 'code:llm-systems/moe-serving#code-witness-1',
          discussionAnchorId: 'code-witness/concept-notebook/llm-systems/moe-serving/code',
          title: 'MoE Serving code witness',
          href: '#code',
          role: 'x'.repeat(140),
        },
      })
    )

    expect(saved).toBe(true)

    const snapshot = getSavedLearningRouteSnapshot()

    expect(snapshot?.sourceObjects?.map((object) => object.type)).toEqual(['source', 'code-witness'])
    expect(snapshot?.currentObject?.type).toBe('code-witness')
    expect(snapshot?.currentObject?.objectKey).toBe('code:llm-systems/moe-serving#code-witness-1')
  })

  it('rejects malformed or mismatched content object keys while accepting legacy snapshots without keys', () => {
    expect(saveLearningRouteSnapshot(computedGraphSnapshot())).toBe(true)

    const malformed = saveLearningRouteSnapshot(
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          id: 'kv-memory-equation',
          objectKey: '/domains/attention-transformers/rope/#math-object-1' as never,
          discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
          title: 'KV memory equation',
        },
      })
    )
    const mismatched = saveLearningRouteSnapshot(
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          id: 'kv-memory-equation',
          objectKey: 'demo:attention-transformers/rope#interactive-demo' as never,
          discussionAnchorId: 'equation/attention-serving/kv-memory-symbol',
          title: 'KV memory equation',
        },
      })
    )

    expect(malformed).toBe(false)
    expect(mismatched).toBe(false)
  })

  it('accepts concept-notebook demo prediction observations focused on a visualization object', () => {
    const saved = saveLearningRouteSnapshot(
      baseSnapshot({
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Efficient Attention',
        inputKind: 'concept notebook',
        mappingId: 'concept:efficient-attention',
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/attention-transformers/efficient-attention/interactive-demo',
            title: 'Efficient Attention interactive demo',
            href: '/domains/attention-transformers/efficient-attention/#interactive-demo',
            role: 'Prediction lens: An invariant holds',
            status: 'prediction checkpoint revealed',
            sourceIds: ['shazeer-2019-fast-transformer-decoding'],
          },
        ],
        currentObject: {
          type: 'visualization',
          id: 'interactive-demo',
          discussionAnchorId: 'visualization/concept-notebook/attention-transformers/efficient-attention/interactive-demo',
          title: 'Efficient Attention interactive demo',
          href: '/domains/attention-transformers/efficient-attention/#interactive-demo',
          role: 'Prediction lens: An invariant holds',
          status: 'prediction checkpoint revealed',
        },
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'interactive-demo',
              label: 'Interactive Demo',
              status: 'ready',
              evidence: 'Section available in the concept notebook.',
              updatedAt: '2026-05-04T00:00:00.000Z',
            },
          ],
          checkpoints: [
            {
              id: 'demo-prediction',
              label: 'Demo prediction',
              status: 'observed',
              detail: 'An invariant holds: name what should remain true while controls change.',
              updatedAt: '2026-05-04T00:00:00.000Z',
            },
          ],
          resolvedObjectIds: [
            'visualization/concept-notebook/attention-transformers/efficient-attention/interactive-demo',
          ],
          nextRepair: 'LLM Serving',
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
        lastObservation: {
          label: 'Demo prediction',
          value: 'An invariant holds: GQA maps Q9 to KV2; KV cache is 67 GB, 25% of MHA.',
          detail:
            'Name the thing that should remain true even while the visual representation changes.\n\nCurrent interactive demo state:\nGrouped-query attention sharing prediction: GQA maps Q9 to KV2.',
          nextQuestion: 'Which slider or state change tests the central claim most directly?',
          source: 'prediction-checkpoint',
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      })
    )

    expect(saved).toBe(true)

    const snapshot = getSavedLearningRouteSnapshot()

    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
      })
    )
    expect(snapshot?.lastObservation?.source).toBe('prediction-checkpoint')
    expect(snapshot?.lastObservation?.value).toContain('GQA maps Q9 to KV2')
    expect(snapshot?.lastObservation?.detail).toContain('Current interactive demo state:')
  })

  it('rejects unsafe hrefs inside graph state and source objects', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        sourceObjects: [
          {
            type: 'concept',
            title: 'External concept',
            href: 'https://example.com',
          },
        ],
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'concept',
          title: 'External current object',
          href: 'https://example.com',
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        graphRoute: {
          ...computedGraphSnapshot().graphRoute!,
          routeNodes: [
            {
              ...computedGraphSnapshot().graphRoute!.routeNodes[0],
              href: '//example.com',
            },
          ],
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects backslash hrefs that can resolve off-origin', () => {
    writeRawSnapshot(
      store,
      baseSnapshot({
        routeConcepts: [
          {
            label: 'Poisoned concept',
            href: '/\\evil.com',
          },
        ],
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        sourceObjects: [
          {
            type: 'concept',
            title: 'Poisoned source',
            href: '/\\evil.com',
          },
        ],
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    const graphRoute = computedGraphSnapshot().graphRoute!
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        graphRoute: {
          ...graphRoute,
          routeNodes: [
            {
              ...graphRoute.routeNodes[0],
              href: '/\\evil.com',
            },
            ...graphRoute.routeNodes.slice(1),
          ],
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects unsafe discussion anchor ids on source objects', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        sourceObjects: [
          {
            type: 'claim',
            title: 'Route claim',
            discussionAnchorId: 'thread/graph/kv-cache' as never,
          },
        ],
      })
    )

    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects unsafe source evidence metadata on source objects', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          title: 'Oversized source detail',
          sourceDetail: 'x'.repeat(161),
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          title: 'Bad source id',
          sourceIds: ['valid', 'bad\u0000id'],
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'equation',
          title: 'Bad confidence',
          confidence: 'certain' as never,
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects unsafe route progress metadata', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'attention',
              label: 'Attention',
              status: 'done' as never,
            },
          ],
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'attention',
              label: 'Attention',
              status: 'ready',
              updatedAt: 'not-a-date',
            },
          ],
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [],
          resolvedObjectIds: ['x'.repeat(221)],
          updatedAt: '2026-05-04T00:00:00.000Z',
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects discussion anchor ids that do not match the source object type', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        sourceObjects: [
          {
            type: 'claim',
            title: 'Route claim',
            discussionAnchorId: 'equation/graph/kv-cache/kv-memory' as never,
          },
        ],
      })
    )

    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        currentObject: {
          type: 'claim',
          title: 'Focused route claim',
          discussionAnchorId: 'equation/graph/kv-cache/kv-memory' as never,
        },
      })
    )

    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('rejects oversized or non-finite graph snapshots', () => {
    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        sourceObjects: Array.from({ length: 13 }, (_, index) => ({
          type: 'concept',
          title: `Concept ${index}`,
        })),
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        graphRoute: {
          ...computedGraphSnapshot().graphRoute!,
          routeNodes: Array.from({ length: 13 }, (_, index) => ({
            id: `node-${index}`,
            label: `Node ${index}`,
            role: 'route node',
            group: 'test',
            status: 'planned',
          })),
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        graphRoute: {
          ...computedGraphSnapshot().graphRoute!,
          edgeWitnesses: [
            {
              from: 'attention',
              to: 'state-space-duality',
              type: 'paper-specific bridge',
              why: 'x'.repeat(281),
              weight: 3.5,
            },
          ],
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    writeRawSnapshot(
      store,
      computedGraphSnapshot({
        graphRoute: {
          ...computedGraphSnapshot().graphRoute!,
          totalWeight: Number.POSITIVE_INFINITY,
        },
      })
    )
    expect(getSavedLearningRouteSnapshot()).toBeNull()

    store.set(learningRouteSnapshotKey, JSON.stringify({ padding: 'x'.repeat(24001) }))
    expect(getSavedLearningRouteSnapshot()).toBeNull()
  })

  it('does not write invalid snapshots through the save helper', () => {
    expect(saveLearningRouteSnapshot({
      ...computedGraphSnapshot(),
      graphRoute: {
        ...computedGraphSnapshot().graphRoute!,
        totalWeight: Number.POSITIVE_INFINITY,
      },
    })).toBe(false)

    expect(store.get(learningRouteSnapshotKey)).toBeUndefined()
  })
})
