import { buildAdaptiveLearningLoopPacket } from './adaptiveLearningLoop'
import type { LearningRouteSnapshot } from './learningRouteSnapshot'

function sampleSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperTitle: 'Efficient Attention notebook',
    inputKind: 'concept',
    mappingId: 'concept:efficient-attention',
    mappingTitle: 'Efficient Attention',
    routeLabels: ['Attention', 'Efficient Attention', 'FlashAttention'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'flash-attention'],
    currentQuestion: 'Which object explains why the cache changes memory movement?',
    currentObject: {
      type: 'equation',
      objectKey: 'equation:attention-transformers/efficient-attention#math-object-1',
      title: 'KV cache memory equation',
      href: '/domains/attention-transformers/efficient-attention/#math-object-1',
    },
    createdAt: '2026-05-23T00:00:00.000Z',
    ...overrides,
  }
}

describe('adaptive learning loop', () => {
  it('returns an honest empty state before a learner has a route or signal', () => {
    const packet = buildAdaptiveLearningLoopPacket({})

    expect(packet.status).toBe('empty')
    expect(packet.ready).toBe(false)
    expect(packet.nextExperience.action).toBe('start-route')
  })

  it('can orient from a saved route snapshot before any explicit signal is recorded', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      routeSnapshot: sampleSnapshot(),
    })

    expect(packet.status).toBe('ready')
    expect(packet.ready).toBe(true)
    expect(packet.learnerModel.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-1')
    expect(packet.learnerModel.posture).toBe('orientation')
    expect(packet.nextExperience.action).toBe('start-route')
    expect(packet.nextExperience.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-1')
  })

  it('uses the selected route object instead of forcing a fixed learner persona', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      routeSnapshot: sampleSnapshot(),
      signals: [
        {
          type: 'question-asked',
          value: 'Why does reducing KV heads change cache size but not query count?',
        },
      ],
    })

    expect(packet.status).toBe('ready')
    expect(packet.learnerModel.objectKey).toBe('equation:attention-transformers/efficient-attention#math-object-1')
    expect(packet.learnerModel.posture).toBe('repair')
    expect(packet.learnerModel.needsCalibratingQuestion).toBe(true)
    expect(packet.nextExperience.action).toBe('ask-one-calibrating-question')
    expect('fixedPersona' in packet.learnerModel).toBe(false)
  })

  it('turns a wrong revealed prediction into a prediction-repair experience', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      signals: [
        {
          type: 'prediction-revealed',
          objectKey: 'demo:attention-transformers/efficient-attention#interactive-demo',
          predictionCorrect: false,
          confidenceBefore: 0.7,
          confidenceAfter: 0.35,
        },
      ],
    })

    expect(packet.status).toBe('ready')
    expect(packet.learnerModel.posture).toBe('prediction-repair')
    expect(packet.learnerModel.confidenceTrend).toBe('down')
    expect(packet.nextExperience.action).toBe('contrast-prediction-with-invariant')
    expect(packet.learnerModel.inferredNeeds).toContain('slow down and reduce abstraction')
  })

  it('drafts a non-canonical demo improvement after repeated failed predictions', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      signals: [
        {
          type: 'prediction-revealed',
          objectKey: 'demo:attention-transformers/efficient-attention#interactive-demo',
          predictionCorrect: false,
        },
        {
          type: 'prediction-revealed',
          objectKey: 'demo:attention-transformers/efficient-attention#interactive-demo',
          predictionCorrect: false,
        },
      ],
    })

    expect(packet.status).toBe('ready')
    expect(packet.improvementDraft).toMatchObject({
      type: 'improve-demo-feedback',
      suggestedReviewLane: 'demo-design-review',
      canonical: false,
    })
  })

  it('drafts a learner-pilot repair when questions accumulate around one object', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      signals: [
        {
          type: 'question-asked',
          objectKey: 'claim:attention-transformers/efficient-attention#io-awareness',
          value: 'What exactly is IO awareness?',
        },
        {
          type: 'confusion-marked',
          objectKey: 'claim:attention-transformers/efficient-attention#io-awareness',
          value: 'The claim sounds like speed is only FLOPs, but the page says memory movement.',
        },
      ],
    })

    expect(packet.status).toBe('ready')
    expect(packet.improvementDraft).toMatchObject({
      objectKey: 'claim:attention-transformers/efficient-attention#io-awareness',
      type: 'rewrite-intuition',
      suggestedReviewLane: 'learner-pilot',
      canonical: false,
    })
  })

  it('blocks malformed object keys instead of adapting from ambiguous signals', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      signals: [
        {
          type: 'demo-manipulated',
          objectKey: 'https://example.com/not-an-object',
        },
      ],
    })

    expect(packet.status).toBe('needs-object')
    expect(packet.ready).toBe(false)
    expect(packet.blockers[0].id).toBe('invalid-object-key')
  })

  it('keeps Codex-style patch generation behind the accepted review boundary', () => {
    const packet = buildAdaptiveLearningLoopPacket({
      signals: [
        {
          type: 'route-abandoned',
          objectKey: 'route:domains/attention-transformers/efficient-attention',
        },
      ],
    })

    expect(packet.improvementDraft?.canonical).toBe(false)
    expect(packet.canonicalBoundary).toContain('non-canonical')
    expect(packet.agentBoundary).toContain('accepted review items')
  })
})
