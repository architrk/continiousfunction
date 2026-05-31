import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import ConceptNotebookPage, { ConceptClaimReviewPanel } from './ConceptNotebookPage'
import type { ConceptObjectSpan } from '@/lib/conceptObjectSpans'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import { clearDemoState, emitDemoState } from '@/lib/demoState'
import {
  clearLocalObjectActionJournal,
  saveLocalObjectActionDraft,
  saveLocalObjectActionResolution,
} from '@/lib/localObjectActionJournal'

const objectSpans: ConceptObjectSpan[] = [
  {
    kind: 'equation',
    domId: 'math-object-1',
    snippet: 'S = QK^T / sqrt(d)',
  },
  {
    kind: 'code-witness',
    domId: 'code-witness-1',
    snippet: 'scores = q @ k.T / np.sqrt(d)',
  },
]

const concept = {
  id: 'flash-attention',
  title: 'FlashAttention',
  domain: 'attention-transformers',
  slug: 'flash-attention',
  difficulty: 4,
  status: 'published',
  importance: 'core',
  short_description: 'IO-aware exact attention.',
}

const ssmSelectiveGateObservation =
  'A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup.'
const swigluGateProductObservation =
  'SwiGLU gated-MLP prediction: Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276.'

function ssmSelectiveGatePredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'concept-notebook',
    paperTitle: 'Concept notebook: SSM Hybrids',
    paperClueLabel: 'SSM Hybrids',
    inputKind: 'concept notebook',
    mappingId: 'concept:ssm-hybrids',
    mappingTitle: 'Attention & Transformers concept notebook',
    routeLabels: [
      'FlashAttention',
      'LLM Serving',
      'Decoding and Sampling',
      'Speculative Decoding',
      'Long Context',
      'SSM Hybrids',
      'SwiGLU',
    ],
    routeConceptIds: [
      'flash-attention',
      'llm-serving',
      'decoding-sampling',
      'speculative-decoding',
      'long-context',
      'ssm-hybrids',
      'swiglu',
    ],
    routeConcepts: [
      {
        label: 'FlashAttention',
        href: '/domains/attention-transformers/flash-attention/',
      },
      {
        label: 'LLM Serving',
        href: '/domains/llm-systems/llm-serving/',
      },
      {
        label: 'Decoding and Sampling',
        href: '/domains/llm-systems/decoding-sampling/',
      },
      {
        label: 'Speculative Decoding',
        href: '/domains/llm-systems/speculative-decoding/',
      },
      {
        label: 'Long Context',
        href: '/domains/attention-transformers/long-context/',
      },
      {
        label: 'SSM Hybrids',
        href: '/domains/attention-transformers/ssm-hybrids/',
      },
      {
        label: 'SwiGLU: Gated MLP Blocks in Transformers',
        href: '/domains/attention-transformers/swiglu/',
      },
    ],
    nextRepair: 'SwiGLU: Gated MLP Blocks in Transformers',
    currentQuestion: 'Which slider or state change in the SSM Hybrids demo would test the central claim most directly?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:attention-transformers/ssm-hybrids#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/attention-transformers/ssm-hybrids/interactive-demo',
      title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
      href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
      role: 'A quantity moves: selective-gate toy preserves marked tokens; recurrence is compressed memory, not exact lookup.',
      status: 'prediction checkpoint revealed',
      sourceDetail: 'SSM selective-gate memory prediction',
      confidence: 'medium',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/long-context#interactive-demo',
        discussionAnchorId: 'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
        title: 'Long Context Engineering interactive demo',
        href: '/domains/attention-transformers/long-context/#interactive-demo',
        role: 'Previous active repair before SSM Hybrids',
        status: 'route handoff history',
        sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
        confidence: 'medium',
      },
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
        discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
        title: 'Speculative Decoding interactive demo',
        href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        role: 'Previous active repair before Long Context',
        status: 'route handoff history',
        sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
        confidence: 'medium',
      },
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
        discussionAnchorId: 'visualization/concept-notebook/llm-systems/decoding-sampling/interactive-demo',
        title: 'Decoding & Sampling interactive demo',
        href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        role: 'Previous active repair before Speculative Decoding',
        status: 'route handoff history',
        sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
        confidence: 'medium',
      },
      {
        type: 'concept',
        id: 'llm-serving',
        objectKey: 'concept:llm-systems/llm-serving',
        title: 'LLM Serving at Scale',
        href: '/domains/llm-systems/llm-serving/',
        role: 'Previous active repair before Decoding and Sampling',
        status: 'route handoff history',
        sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
        confidence: 'medium',
      },
      {
        type: 'equation',
        id: 'equation-1',
        objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
        discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
        title: 'FlashAttention equation 1',
        href: '/domains/attention-transformers/flash-attention/#math-object-1',
        role: 'Answer the carried question: which slider tests the memory claim?',
        status: 'resolved route history',
        sourceDetail: 'The memory slider is the direct witness.',
        confidence: 'high',
      },
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'interactive-demo',
          label: 'Interactive Demo',
          status: 'ready',
          updatedAt: '2026-05-12T02:20:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: ssmSelectiveGateObservation,
          updatedAt: '2026-05-12T02:20:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/attention-transformers/ssm-hybrids/interactive-demo',
      ],
      nextRepair: 'SwiGLU: Gated MLP Blocks in Transformers',
      updatedAt: '2026-05-12T02:20:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: ssmSelectiveGateObservation,
      detail: 'Current interactive demo state: winner: selective-gate toy; mechanism: token-dependent delta controls write/copy/forget; prediction correct: yes.',
      nextQuestion: 'Which slider or state change in the SSM Hybrids demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T02:20:00.000Z',
    },
    createdAt: '2026-05-12T02:20:00.000Z',
    ...overrides,
  }
}

function swigluConceptFocusSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const ssmSnapshot = ssmSelectiveGatePredictionSnapshot()

  return {
    ...ssmSnapshot,
    mappingId: 'concept:swiglu',
    paperTitle: 'Concept notebook: SwiGLU',
    paperClueLabel: 'SwiGLU',
    nextRepair: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    currentQuestion: 'How does the SiLU gate decide whether a token-local MLP write is suppressed, passed, or amplified?',
    routeLabels: [
      ...ssmSnapshot.routeLabels,
      'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    ],
    routeConceptIds: [...ssmSnapshot.routeConceptIds, 'mixture-of-experts'],
    routeConcepts: [
      ...(ssmSnapshot.routeConcepts ?? []),
      {
        label: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
        href: '/domains/efficiency/mixture-of-experts/',
      },
    ],
    currentObject: {
      type: 'concept',
      id: 'swiglu',
      objectKey: 'concept:attention-transformers/swiglu',
      discussionAnchorId: 'concept/concept-notebook/attention-transformers/swiglu',
      title: 'SwiGLU: Gated MLP Blocks in Transformers',
      href: '/domains/attention-transformers/swiglu/',
      role: 'Use the selected object to compare sequence-memory gating with token-local MLP gating.',
      status: 'selected in concept room',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/ssm-hybrids#interactive-demo',
        discussionAnchorId: 'visualization/concept-notebook/attention-transformers/ssm-hybrids/interactive-demo',
        title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
        href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
        role: 'Previous active repair before SwiGLU: Gated MLP Blocks in Transformers',
        status: 'route handoff history',
        sourceDetail: `Demo prediction: ${ssmSelectiveGateObservation}`,
        confidence: 'medium',
      },
      ...(ssmSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'intuition',
          label: 'Intuition',
          status: 'ready',
          updatedAt: '2026-05-12T02:45:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'concept/concept-notebook/attention-transformers/swiglu',
      ],
      nextRepair: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      updatedAt: '2026-05-12T02:45:00.000Z',
    },
    lastObservation: {
      label: 'Concept object focus',
      value: 'concept: SwiGLU: Gated MLP Blocks in Transformers',
      detail: 'SwiGLU reading-room object selected for grounded AI handoff.',
      nextQuestion: 'How does the SiLU gate decide whether a token-local MLP write is suppressed, passed, or amplified?',
      source: 'learning-route',
      updatedAt: '2026-05-12T02:45:00.000Z',
    },
    createdAt: '2026-05-12T02:45:00.000Z',
    ...overrides,
  }
}

function swigluGatedMlpPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const swigluSnapshot = swigluConceptFocusSnapshot()

  return {
    ...swigluSnapshot,
    currentQuestion: 'Which slider or state change in the SwiGLU demo would test the central claim most directly?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:attention-transformers/swiglu#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/attention-transformers/swiglu/interactive-demo',
      title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
      href: '/domains/attention-transformers/swiglu/#interactive-demo',
      role: swigluGateProductObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'SwiGLU gated-MLP prediction',
      confidence: 'medium',
    },
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'interactive-demo',
          label: 'Interactive Demo',
          status: 'ready',
          updatedAt: '2026-05-12T03:10:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: swigluGateProductObservation,
          updatedAt: '2026-05-12T03:10:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/attention-transformers/swiglu/interactive-demo',
      ],
      nextRepair: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      updatedAt: '2026-05-12T03:10:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: swigluGateProductObservation,
      detail:
        'Current interactive demo state: actual gate regime: suppress; SiLU(g_i): -0.276; v_i * SiLU(g_i): -0.309; parameter-budget ratio: 100.0%.',
      nextQuestion: 'Which slider or state change in the SwiGLU demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T03:10:00.000Z',
    },
    createdAt: '2026-05-12T03:10:00.000Z',
    ...overrides,
  }
}

function mixtureOfExpertsCapacityPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const swigluSnapshot = swigluGatedMlpPredictionSnapshot()
  const moeObservation =
    'A quantity moves: Learner predicted Overloaded expert drops/overflows assignments; revealed capacity overflow with 3 overflowed token-expert assignments.'

  return {
    ...swigluSnapshot,
    mappingId: 'concept:mixture-of-experts',
    paperTitle: 'Concept notebook: Sparse Mixture of Experts',
    paperClueLabel: 'Sparse Mixture of Experts',
    nextRepair: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
    currentQuestion: 'Which capacity constraint separates routed expert choices from assignments the system can actually serve?',
    routeLabels: [
      'FlashAttention',
      'LLM Serving',
      'Decoding and Sampling',
      'Speculative Decoding',
      'Long Context',
      'SSM Hybrids',
      'SwiGLU',
      'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
    ],
    routeConceptIds: [
      ...swigluSnapshot.routeConceptIds,
      'moe-serving',
    ],
    routeConcepts: [
      ...(swigluSnapshot.routeConcepts ?? []),
      {
        label: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
        href: '/domains/llm-systems/moe-serving/',
        role: 'next repair',
      },
    ],
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:efficiency/mixture-of-experts#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/efficiency/mixture-of-experts/interactive-demo',
      title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
      href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
      role: 'A quantity moves: capacity overflow separates routed expert choices from served assignments.',
      status: 'prediction checkpoint revealed',
      sourceDetail: 'MoE capacity drop reveal',
      confidence: 'medium',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/swiglu#interactive-demo',
        discussionAnchorId: 'visualization/concept-notebook/attention-transformers/swiglu/interactive-demo',
        title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
        href: '/domains/attention-transformers/swiglu/#interactive-demo',
        role: 'Previous active repair before Sparse Mixture of Experts',
        status: 'route handoff history',
        sourceDetail: `Demo prediction: ${swigluGateProductObservation}`,
        confidence: 'medium',
      },
      ...(swigluSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'interactive-demo',
          label: 'Interactive Demo',
          status: 'ready',
          updatedAt: '2026-05-12T04:15:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: moeObservation,
          updatedAt: '2026-05-12T04:15:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/efficiency/mixture-of-experts/interactive-demo',
      ],
      nextRepair: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      updatedAt: '2026-05-12T04:15:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: moeObservation,
      detail:
        'Current interactive demo state: actual: capacity-overflow; servedAssignments: T0:E0; T0:E5; droppedAssignments: T2:E0; overflowExpertIds: E0, E5.',
      nextQuestion: 'Open MoE Serving next, with token dispatch capacity preserved as the production constraint.',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T04:15:00.000Z',
    },
    createdAt: '2026-05-12T04:15:00.000Z',
    ...overrides,
  }
}

function moeServingRoutingSkewPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const moeSnapshot = mixtureOfExpertsCapacityPredictionSnapshot()
  const servingObservation =
    'A quantity moves: 2048 tokens, E=16, top-k=2, hot routing: winner Hot expert straggler, max/mean load 5.83x, communication 64.0 MiB.'

  return {
    ...moeSnapshot,
    mappingId: 'concept:moe-serving',
    paperTitle: 'Concept notebook: MoE Serving & Scheduling',
    paperClueLabel: 'MoE Serving & Scheduling',
    nextRepair: 'Speculative Decoding',
    currentQuestion: 'Which slider or state change in the MoE Serving demo would test the central claim most directly?',
    routeLabels: [
      'FlashAttention',
      'LLM Serving',
      'Decoding and Sampling',
      'Speculative Decoding',
      'Long Context',
      'SSM Hybrids',
      'SwiGLU',
      'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
    ],
    routeConceptIds: [
      ...moeSnapshot.routeConceptIds,
      'speculative-decoding',
    ],
    routeConcepts: [
      ...(moeSnapshot.routeConcepts ?? []),
      {
        label: 'Speculative Decoding',
        href: '/domains/llm-systems/speculative-decoding/',
        role: 'next repair',
      },
    ],
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:llm-systems/moe-serving#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/llm-systems/moe-serving/interactive-demo',
      title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo',
      href: '/domains/llm-systems/moe-serving/#interactive-demo',
      role: servingObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'MoE serving routing-skew demo',
      confidence: 'medium',
    },
    sourceObjects: [
      {
        ...(moeSnapshot.currentObject!),
        role: 'Previous active repair before MoE Serving & Scheduling',
        status: 'route handoff history',
        sourceDetail: 'Demo prediction: Overloaded expert capacity overflow dropped assignments.',
        confidence: 'medium',
      },
      ...(moeSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'interactive-demo',
          label: 'Interactive Demo',
          status: 'ready',
          updatedAt: '2026-05-12T05:10:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: servingObservation,
          updatedAt: '2026-05-12T05:10:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/llm-systems/moe-serving/interactive-demo',
      ],
      nextRepair: 'Speculative Decoding',
      updatedAt: '2026-05-12T05:10:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: servingObservation,
      detail:
        'Current interactive demo state: winner: Hot expert straggler; prediction correct: yes; max/mean load: 5.83x; all-to-all bytes: 64.0 MiB; communication time: 0.07 ms; expert straggler time: 0.11 ms.',
      nextQuestion: 'Which slider or state change in the MoE Serving demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T05:10:00.000Z',
    },
    createdAt: '2026-05-12T05:10:00.000Z',
    ...overrides,
  }
}

describe('ConceptClaimReviewPanel', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      originalConsoleError(...args)
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders exact claim-check anchors and never turns object keys into raw hrefs', () => {
    const { container } = render(
      <ConceptClaimReviewPanel
        concept={concept}
        sources={[
          {
            id: 'dao-2022-flashattention',
            title: 'FlashAttention',
            kind: 'paper',
            year: 2022,
            note: 'Tiling plus online softmax avoids materializing full attention.',
          },
        ]}
        claimChecks={[
          {
            id: 'exact-io-aware-tiling',
            status: 'source-checked',
            claim: 'FlashAttention computes exact attention with IO-aware tiling.',
            source_ids: ['dao-2022-flashattention'],
            support: 'Dao et al. describe tiling and online softmax.',
            caveat: 'Performance depends on hardware and sequence length.',
            object_refs: [
              '#math-object-1',
              'source-span:attention-transformers/flash-attention#dao-2022-flashattention',
              'claim:attention-transformers/flash-attention#exact-io-aware-tiling',
            ],
          },
        ]}
        objectSpans={objectSpans}
        hasVisualization
      />
    )

    const card = document.getElementById('claim-check-exact-io-aware-tiling')
    expect(card).toBeInTheDocument()
    expect(screen.getByLabelText('Structured claim checks')).toBeInTheDocument()
    expect(screen.queryByLabelText('Reviewed claim checks')).not.toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('Source-linked; substantive support review pending')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('Claim metadata: source checked')).toBeInTheDocument()
    expect(within(card as HTMLElement).getByText('Attached source IDs and witness refs are review targets, not proof.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'math-object-1' })).toHaveAttribute('href', '#math-object-1')
    expect(screen.getByLabelText('Rendered equation witness: Equation 1')).toBeInTheDocument()
    expect(container.querySelector('.claim-review-equation-snippet .katex')).toBeInTheDocument()
    expect(
      card?.querySelector('a[href="source-span:attention-transformers/flash-attention#dao-2022-flashattention"]')
    ).toBeNull()
    expect(
      card?.querySelector('a[href="claim:attention-transformers/flash-attention#exact-io-aware-tiling"]')
    ).toBeNull()
    expect(
      within(card as HTMLElement).getByText('source-span:attention-transformers/flash-attention#dao-2022-flashattention')
    ).toBeInTheDocument()
    expect(
      within(card as HTMLElement).getByText('claim:attention-transformers/flash-attention#exact-io-aware-tiling')
    ).toBeInTheDocument()
  })

  it('renders substantive evidence review only when explicit metadata exists', () => {
    render(
      <ConceptClaimReviewPanel
        concept={concept}
        sources={[
          {
            id: 'dao-2022-flashattention',
            title: 'FlashAttention',
            kind: 'paper',
            year: 2022,
            note: 'Tiling plus online softmax avoids materializing full attention.',
          },
        ]}
        claimChecks={[
          {
            id: 'exact-io-aware-tiling',
            status: 'source-checked',
            claim: 'FlashAttention computes exact attention with IO-aware tiling.',
            source_ids: ['dao-2022-flashattention'],
            support: 'Dao et al. describe tiling and online softmax.',
            caveat: 'Performance depends on hardware and sequence length.',
            object_refs: ['#math-object-1'],
            evidence_review: {
              state: 'substantive-reviewed',
              reviewed_at: '2026-05-06',
              reviewer: 'oracle',
              summary: 'Checked source span and local witness against the exact claim.',
            },
          },
        ]}
        objectSpans={objectSpans}
        hasVisualization
      />
    )

    expect(screen.getByText('1 substantive review recorded')).toBeInTheDocument()
    expect(screen.getByText('Substantively reviewed')).toBeInTheDocument()
    expect(screen.getByText('Checked source span and local witness against the exact claim.')).toBeInTheDocument()
    expect(screen.getByText('Reviewer: oracle; reviewed 2026-05-06')).toBeInTheDocument()
  })
})

describe('ConceptNotebookPage object flow bar', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      if (message.includes('Not implemented: navigation')) return
      originalConsoleError(...args)
    })
    window.history.pushState({}, '', '/')
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
    clearDemoState('flash-attention')
    clearDemoState('decoding-sampling')
    clearDemoState('speculative-decoding')
    clearDemoState('long-context')
    clearDemoState('ssm-hybrids')
    clearDemoState('swiglu')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('renders prioritized object chips and persists focused object selection into the learning route snapshot', () => {
    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          domain: 'attention-transformers',
          slug: 'flash-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'IO-aware exact attention.',
          tags: ['attention', 'transformers'],
          sources: [
            {
              id: 'dao-2022-flashattention',
              title: 'FlashAttention',
              kind: 'paper',
              year: 2022,
              note: 'Online softmax plus tiling.',
            },
          ],
          claim_checks: [
            {
              id: 'exact-io-aware-tiling',
              status: 'source-checked',
              claim: 'FlashAttention computes exact attention with IO-aware tiling.',
              source_ids: ['dao-2022-flashattention'],
              support: 'Dao et al. describe tiling and online softmax.',
              caveat: 'Toy page witnesses are not hardware benchmarks.',
              object_refs: ['#math-object-1', '#code-witness-1'],
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Build the story first.</p>',
          mathHtml: '<p>Math object lives here.</p>',
          codeHtml: '<p>Code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'softmax',
            title: 'Softmax',
            href: '/domains/attention-transformers/softmax/',
          },
        ]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>viz</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    expect(within(objectFlowBar).getByRole('link', { name: /Concept\s+FlashAttention\s+Attention Transformers/i })).toBeInTheDocument()
    expect(within(objectFlowBar).getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(within(objectFlowBar).getByText('FlashAttention code witness 1')).toBeInTheDocument()
    expect(within(objectFlowBar).getByText('FlashAttention interactive demo')).toBeInTheDocument()
    expect(within(objectFlowBar).getByText('FlashAttention computes exact attention with IO-aware tiling.')).toBeInTheDocument()
    expect(within(objectFlowBar).getByRole('link', { name: /Source\s+FlashAttention\s+Exact source object/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Ask AI Companion/i })).not.toBeInTheDocument()
    expect(within(objectFlowBar).getByRole('link', { name: /Ask about this/i })).toHaveAttribute(
      'href',
      '#research-reading-room-workspace'
    )
    expect(within(objectFlowBar).getByRole('link', { name: /Research room/i })).toHaveAttribute(
      'href',
      '#research-reading-room-workspace'
    )
    expect(within(screen.getByLabelText('Mobile learning map')).getByText('Before')).toBeInTheDocument()

    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Research room/i }))
    expect(getSavedLearningRouteSnapshot()?.currentObject?.type).toBe('concept')

    const equationChip = within(objectFlowBar).getByRole('link', { name: /FlashAttention equation 1/i })
    fireEvent.focus(equationChip)

    const selectedObjectContext = screen.getByLabelText('Selected object context')
    expect(within(selectedObjectContext).getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText('1 source attached')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText('Claim metadata checked')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText('Local snapshot saved')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText(/equation:attention-transformers\/flash-attention#math-object-1/)).toBeInTheDocument()
    const selectedObjectActions = within(selectedObjectContext).getByLabelText('Selected object actions')
    expect(within(selectedObjectActions).getByRole('link', { name: /Code witness nearby/i })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#code-witness-1'
    )
    expect(within(selectedObjectActions).getByRole('link', { name: /Predict before reveal/i })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#interactive-demo'
    )
    expect(within(selectedObjectActions).getByRole('link', { name: /Room object handoff/i })).toHaveAttribute(
      'href',
      '#research-reading-room-workspace'
    )
    const drawerContext = screen.getByLabelText('Selected object drawer context')
    expect(within(drawerContext).getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(within(drawerContext).getByRole('link', { name: 'Code witness' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#code-witness-1'
    )
    expect(within(drawerContext).getByRole('link', { name: 'Prediction checkpoint' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#interactive-demo'
    )
    const drawerProximity = screen.getByLabelText('Drawer prediction and code context')
    expect(within(drawerProximity).getByRole('link', { name: /Code witness comparison/i })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#code-witness-1'
    )
    expect(within(drawerProximity).getByText('scores = q @ k.T / np.sqrt(d)')).toBeInTheDocument()
    expect(within(drawerProximity).getByRole('link', { name: /Prediction before reveal/i })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#interactive-demo'
    )
    expect(within(drawerProximity).getByText('Manipulate one control and predict the visible change.')).toBeInTheDocument()
    expect(within(drawerProximity).getByText('Grounded room question')).toBeInTheDocument()
    expect(screen.getByText('Close').closest('a')).toHaveAttribute('href', '#selected-object-context')
    expect(screen.getByRole('heading', { name: 'FlashAttention equation 1' })).toBeInTheDocument()
    const localDraft = screen.getByLabelText('Local action draft')
    expect(localDraft.tagName).toBe('DETAILS')
    expect(localDraft).not.toHaveAttribute('open')
    expect(within(localDraft).getByText('No local draft saved yet')).toBeInTheDocument()
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.source).toBe('concept-notebook')
    expect(snapshot?.currentObject?.type).toBe('equation')
    expect(snapshot?.currentObject?.title).toBe('FlashAttention equation 1')
    expect(snapshot?.currentObject?.discussionAnchorId).toBe(
      'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1'
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toContain(
      'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1'
    )
  })

  it('preserves a resolved prior object as route history when saving the next repair object', () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: FlashAttention',
        inputKind: 'concept notebook',
        mappingId: 'concept:flash-attention',
        routeLabels: ['FlashAttention', 'LLM Serving'],
        routeConceptIds: ['flash-attention', 'llm-serving'],
        nextRepair: 'LLM Serving',
        currentQuestion: 'Which slider tests the FlashAttention memory claim?',
        currentObject: {
          type: 'equation',
          id: 'math-object-1',
          objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
          discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'prediction checkpoint revealed',
        },
        createdAt: '2026-05-11T00:00:00.000Z',
      })
    ).toBe(true)
    expect(
      saveLocalObjectActionResolution({
        version: 'cf-object-action-resolution-v1',
        objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
        objectTitle: 'FlashAttention equation 1',
        resolvedAction: 'Answer the carried question: which slider tests the memory claim?',
        resolutionNote: 'The memory slider is the direct witness.',
        updatedAt: '2026-05-11T00:10:00.000Z',
        source: 'research-reading-room',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'llm-serving',
          title: 'LLM Serving',
          domain: 'llm-systems',
          slug: 'llm-serving',
          difficulty: 4,
          status: 'published',
          importance: 'core',
          short_description: 'Serving systems connect prefill, decode, batching, and KV memory.',
          sources: [
            {
              id: 'serving-note',
              title: 'Serving systems note',
              kind: 'paper',
              year: 2024,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Serving starts with a throughput bottleneck.</p>',
          mathHtml: '<p>Serving math object lives here.</p>',
          codeHtml: '<p>Serving code witness lives here.</p>',
          demoHtml: '<p>Serving demo notes.</p>',
        }}
        objectSpans={[]}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={undefined}
      />
    )

    fireEvent.click(within(screen.getByLabelText('Object-attached flow')).getByRole('link', { name: /Ask about this/i }))

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:llm-serving')
    expect(snapshot?.currentObject?.title).toBe('LLM Serving')
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'equation',
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'resolved route history',
          role: 'Answer the carried question: which slider tests the memory claim?',
          sourceDetail: 'The memory slider is the direct witness.',
        }),
      ])
    )
  })

  it('opens a resolved history object from the hash without overwriting the active repair route', async () => {
    window.history.pushState({}, '', '/domains/attention-transformers/flash-attention/#math-object-1')
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: LLM Serving',
        paperClueLabel: 'LLM Serving',
        inputKind: 'concept notebook',
        mappingId: 'concept:llm-serving',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
            role: 'resolved route history',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
            role: 'active repair',
          },
        ],
        nextRepair: 'Decoding and Sampling',
        currentQuestion: 'How does the serving bottleneck move after memory is fixed?',
        currentObject: {
          type: 'concept',
          id: 'llm-serving',
          objectKey: 'concept:llm-systems/llm-serving',
          title: 'LLM Serving at Scale',
          href: '/domains/llm-systems/llm-serving/',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        createdAt: '2026-05-11T00:20:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          domain: 'attention-transformers',
          slug: 'flash-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'IO-aware exact attention.',
          tags: ['attention', 'transformers'],
          sources: [
            {
              id: 'dao-2022-flashattention',
              title: 'FlashAttention',
              kind: 'paper',
              year: 2022,
              note: 'Online softmax plus tiling.',
            },
          ],
          claim_checks: [
            {
              id: 'exact-io-aware-tiling',
              status: 'source-checked',
              claim: 'FlashAttention computes exact attention with IO-aware tiling.',
              source_ids: ['dao-2022-flashattention'],
              support: 'Dao et al. describe tiling and online softmax.',
              caveat: 'Toy page witnesses are not hardware benchmarks.',
              object_refs: ['#math-object-1', '#code-witness-1'],
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Build the story first.</p>',
          mathHtml: '<p>Math object lives here.</p>',
          codeHtml: '<p>Code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'llm-serving',
            title: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={undefined}
      />
    )

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Inspecting history: FlashAttention' })).toBeInTheDocument()
    })

    expect(within(screen.getByLabelText('Selected object context')).getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to active repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(
      within(screen.getByLabelText('Selected object actions')).getByRole('link', { name: /Return active repair/i })
    ).toHaveAttribute('href', '/domains/llm-systems/llm-serving/')
    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:llm-serving')
    expect(getSavedLearningRouteSnapshot()?.currentObject?.title).toBe('LLM Serving at Scale')
  })

  it('surfaces a comparison bridge after returning to the active repair', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: LLM Serving',
        paperClueLabel: 'LLM Serving',
        inputKind: 'concept notebook',
        mappingId: 'concept:llm-serving',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
        ],
        nextRepair: 'Decoding and Sampling',
        currentQuestion: 'How does the serving bottleneck move after memory is fixed?',
        currentObject: {
          type: 'concept',
          id: 'llm-serving',
          objectKey: 'concept:llm-systems/llm-serving',
          title: 'LLM Serving at Scale',
          href: '/domains/llm-systems/llm-serving/',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        createdAt: '2026-05-11T00:30:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'llm-serving',
          title: 'LLM Serving',
          domain: 'llm-systems',
          slug: 'llm-serving',
          difficulty: 4,
          status: 'published',
          importance: 'core',
          short_description: 'Serving systems connect prefill, decode, batching, and KV memory.',
          sources: [
            {
              id: 'serving-note',
              title: 'Serving systems note',
              kind: 'paper',
              year: 2024,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Serving starts with a throughput bottleneck.</p>',
          mathHtml: '<p>Serving math object lives here.</p>',
          codeHtml: '<p>Serving code witness lives here.</p>',
          demoHtml: '<p>Serving demo notes.</p>',
        }}
        objectSpans={[]}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={undefined}
      />
    )

    await waitFor(() => {
      expect(screen.getByLabelText('Route history comparison bridge')).toBeInTheDocument()
    })

    const bridge = screen.getByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Comparison bridge')).toBeInTheDocument()
    expect(within(bridge).getByText('FlashAttention equation 1 -> LLM Serving')).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Memory math is fixed; next compare decode-time choices in Decoding and Sampling.'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
    expect(within(bridge).getByRole('link', { name: 'Open Decoding and Sampling' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/'
    )
    expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:llm-serving')
  })

  it('activates the Decoding next repair while preserving LLM Serving and FlashAttention history', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: LLM Serving',
        paperClueLabel: 'LLM Serving',
        inputKind: 'concept notebook',
        mappingId: 'concept:llm-serving',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
        ],
        nextRepair: 'Decoding and Sampling',
        currentQuestion: 'How does the serving bottleneck move after memory is fixed?',
        currentObject: {
          type: 'concept',
          id: 'llm-serving',
          objectKey: 'concept:llm-systems/llm-serving',
          title: 'LLM Serving at Scale',
          href: '/domains/llm-systems/llm-serving/',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        createdAt: '2026-05-11T00:40:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'decoding-sampling',
          title: 'Decoding & Sampling: Temperature, Top-p & Inference-Time Control',
          domain: 'llm-systems',
          slug: 'decoding-sampling',
          difficulty: 3,
          status: 'published',
          importance: 'important',
          short_description: 'Inference settings reshape the next-token distribution.',
          sources: [
            {
              id: 'holtzman-2019-nucleus',
              title: 'The Curious Case of Neural Text Degeneration',
              kind: 'paper',
              year: 2019,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Decoding starts with a probability surface.</p>',
          mathHtml: '<p>Temperature and top-p objects live here.</p>',
          codeHtml: '<p>Sampler code witness lives here.</p>',
          demoHtml: '<p>Sampler demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'speculative-decoding',
            title: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={undefined}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:decoding-sampling')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toContain('Decoding & Sampling')
    expect(snapshot?.nextRepair).toBe('Speculative Decoding')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining(['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding'])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'concept',
          title: 'LLM Serving at Scale',
          href: '/domains/llm-systems/llm-serving/',
          status: 'route handoff history',
          sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
        }),
        expect.objectContaining({
          type: 'equation',
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'resolved route history',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByText(/LLM Serving at Scale -> Decoding & Sampling/i)).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Serving bottlenecks are preserved as the prior repair; now test decode-time controls before Speculative Decoding.'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByText('Earlier history: FlashAttention equation 1')).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
    expect(within(bridge).getByRole('link', { name: 'Open Speculative Decoding' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/'
    )
  })

  it('preserves activation history when a Decoding prediction checkpoint is saved', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Decoding and Sampling',
        paperClueLabel: 'Decoding and Sampling',
        inputKind: 'concept notebook',
        mappingId: 'concept:decoding-sampling',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling', 'speculative-decoding'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ],
        nextRepair: 'Speculative Decoding',
        currentQuestion: 'Which decode-time control changes the next token?',
        currentObject: {
          type: 'concept',
          id: 'decoding-sampling',
          objectKey: 'concept:llm-systems/decoding-sampling',
          discussionAnchorId: 'concept/concept-notebook/llm-systems/decoding-sampling',
          title: 'Decoding & Sampling',
          href: '/domains/llm-systems/decoding-sampling/',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        createdAt: '2026-05-11T00:50:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'decoding-sampling',
          title: 'Decoding & Sampling: Temperature, Top-p & Inference-Time Control',
          domain: 'llm-systems',
          slug: 'decoding-sampling',
          difficulty: 3,
          status: 'published',
          importance: 'important',
          short_description: 'Inference settings reshape the next-token distribution.',
          sources: [
            {
              id: 'holtzman-2019-nucleus',
              title: 'The Curious Case of Neural Text Degeneration',
              kind: 'paper',
              year: 2019,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Decoding starts with a probability surface.</p>',
          mathHtml: '<p>Temperature and top-p objects live here.</p>',
          codeHtml: '<p>Sampler code witness lives here.</p>',
          demoHtml: '<p>Sampler demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'speculative-decoding',
            title: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Live decoding sampling demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'decoding-sampling',
        label: 'Prediction-first decoding distribution reveal',
        summary: 'Learner predicted Entropy shape; decoding reveals Entropy shape.',
        values: [
          'prediction: Entropy shape',
          'revealed: yes',
          'prediction correct: yes',
          'expected mechanism: Entropy shape',
          'decoding invariant: Temperature and filtering reshape next-token uncertainty before sampling.',
          'sampling lab: mounted',
        ],
      })
    })

    expect(await screen.findAllByText('Prediction-first decoding distribution reveal')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:decoding-sampling')
    expect(snapshot?.nextRepair).toBe('Speculative Decoding')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.lastObservation?.value).toContain('Learner predicted Entropy shape')
    expect(snapshot?.lastObservation?.detail).toContain('Current interactive demo state:')
    expect(snapshot?.lastObservation?.detail).toContain('decoding invariant')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
      })
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'visualization/concept-notebook/llm-systems/decoding-sampling/interactive-demo',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
    expect(within(bridge).getByRole('link', { name: 'Open Speculative Decoding' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/'
    )
  })

  it('activates Speculative Decoding while preserving the Decoding observation and deeper history', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Decoding and Sampling',
        paperClueLabel: 'Decoding and Sampling',
        inputKind: 'concept notebook',
        mappingId: 'concept:decoding-sampling',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling', 'speculative-decoding'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ],
        nextRepair: 'Speculative Decoding',
        currentQuestion: 'Ask how top-p and temperature change the next-token distribution.',
        currentObject: {
          type: 'visualization',
          id: 'interactive-demo',
          objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
          discussionAnchorId: 'visualization/concept-notebook/llm-systems/decoding-sampling/interactive-demo',
          title: 'Decoding & Sampling interactive demo',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
          role: 'A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.',
          status: 'prediction checkpoint revealed',
          sourceDetail: 'Prediction-first decoding distribution reveal',
        },
        sourceObjects: [
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        lastObservation: {
          label: 'Demo prediction',
          value: 'A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.',
          detail: 'Current interactive demo state: decoding invariant preserved.',
          nextQuestion: 'Ask how top-p and temperature change the next-token distribution.',
          source: 'prediction-checkpoint',
          updatedAt: '2026-05-11T00:55:00.000Z',
        },
        createdAt: '2026-05-11T00:55:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          domain: 'llm-systems',
          slug: 'speculative-decoding',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Draft tokens are verified in parallel without changing the target distribution.',
          sources: [
            {
              id: 'leviathan-2022-speculative-decoding',
              title: 'Fast Inference from Transformers via Speculative Decoding',
              kind: 'paper',
              year: 2022,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Speculation starts with a draft model.</p>',
          mathHtml: '<p>Acceptance and residual objects live here.</p>',
          codeHtml: '<p>Draft verify code witness lives here.</p>',
          demoHtml: '<p>Speculative demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Speculative decoding demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:speculative-decoding')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toContain('Speculative Decoding')
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          href: '/domains/llm-systems/llm-serving/',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'resolved route history',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(
      within(bridge).getByText(/Decoding & Sampling interactive demo -> Speculative Decoding/i)
    ).toBeInTheDocument()
    expect(within(bridge).getByText('Earlier history: LLM Serving at Scale; FlashAttention equation 1')).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('saves a Speculative Decoding prediction reveal while preserving the full route stack', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Speculative Decoding',
        paperClueLabel: 'Speculative Decoding',
        inputKind: 'concept notebook',
        mappingId: 'concept:speculative-decoding',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling', 'speculative-decoding'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ],
        nextRepair: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
        currentQuestion: 'What condition makes speculative decoding actually faster?',
        currentObject: {
          type: 'concept',
          id: 'speculative-decoding',
          objectKey: 'concept:llm-systems/speculative-decoding',
          discussionAnchorId: 'concept/concept-notebook/llm-systems/speculative-decoding',
          title: 'Speculative Decoding',
          href: '/domains/llm-systems/speculative-decoding/',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        createdAt: '2026-05-11T01:00:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          domain: 'llm-systems',
          slug: 'speculative-decoding',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Draft tokens are verified in parallel without changing the target distribution.',
          sources: [
            {
              id: 'leviathan-2022-speculative-decoding',
              title: 'Fast Inference from Transformers via Speculative Decoding',
              kind: 'paper',
              year: 2022,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Speculation starts with a draft model.</p>',
          mathHtml: '<p>Acceptance and residual objects live here.</p>',
          codeHtml: '<p>Draft verify code witness lives here.</p>',
          demoHtml: '<p>Speculative demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'long-context',
            title: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Speculative decoding demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'speculative-decoding',
        label: 'Prediction-first speculative speedup reveal',
        summary: 'Learner predicted Draft-target match; speculation reveals Draft-target match.',
        values: [
          'prediction: Draft-target match',
          'revealed: yes',
          'prediction correct: yes',
          'expected condition: Draft-target match',
          'speculation invariant: speedup appears only when a long draft prefix survives target verification',
          'draft-verify lab: mounted',
        ],
      })
    })

    expect(await screen.findAllByText('Prediction-first speculative speedup reveal')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:speculative-decoding')
    expect(snapshot?.nextRepair).toBe('Long Context')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining(['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding'])
    )
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toContain('Speculative Decoding')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.lastObservation?.value).toContain('Learner predicted Draft-target match')
    expect(snapshot?.lastObservation?.detail).toContain('expected condition: Draft-target match')
    expect(snapshot?.lastObservation?.detail).toContain('speculation invariant')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
      })
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByText(/Decoding & Sampling interactive demo -> Speculative Decoding/i)).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speedup before Long Context.'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByText('Earlier history: LLM Serving at Scale; FlashAttention equation 1')).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('activates Long Context from a Speculative Decoding demo observation with the full route stack', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Speculative Decoding',
        paperClueLabel: 'Speculative Decoding',
        inputKind: 'concept notebook',
        mappingId: 'concept:speculative-decoding',
        mappingTitle: 'LLM Systems concept notebook',
        routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding and Sampling', 'Speculative Decoding', 'Long Context'],
        routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling', 'speculative-decoding', 'long-context'],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
          {
            label: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
        ],
        nextRepair: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
        currentQuestion: 'Which slider or state change in the Speculative Decoding demo would test the central claim most directly?',
        currentObject: {
          type: 'visualization',
          id: 'interactive-demo',
          objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
          discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
          title: 'Speculative Decoding interactive demo',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
          role: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
          status: 'prediction checkpoint revealed',
          sourceDetail: 'Prediction-first speculative speedup reveal',
          confidence: 'medium',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'interactive-demo',
              label: 'Interactive Demo',
              status: 'active',
              updatedAt: '2026-05-12T01:05:00.000Z',
            },
          ],
          checkpoints: [
            {
              id: 'demo-prediction',
              label: 'Demo prediction',
              status: 'observed',
              detail: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
              updatedAt: '2026-05-12T01:05:00.000Z',
            },
          ],
          resolvedObjectIds: [
            'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
          ],
          nextRepair: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          updatedAt: '2026-05-12T01:05:00.000Z',
        },
        lastObservation: {
          label: 'Demo prediction',
          value: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
          detail: 'Current interactive demo state: expected condition: Draft-target match.',
          nextQuestion: 'Which slider or state change in the Speculative Decoding demo would test the central claim most directly?',
          source: 'prediction-checkpoint',
          updatedAt: '2026-05-12T01:05:00.000Z',
        },
        createdAt: '2026-05-12T01:00:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'long-context',
          title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          domain: 'attention-transformers',
          slug: 'long-context',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Long contexts stretch positional extrapolation and KV-cache memory.',
          sources: [
            {
              id: 'kwon-2023-pagedattention',
              title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
              kind: 'paper',
              year: 2023,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Long context creates several bottlenecks.</p>',
          mathHtml: '<p>KV memory and position phase live here.</p>',
          codeHtml: '<p>KV sizing witness lives here.</p>',
          demoHtml: '<p>Long context demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'ssm-hybrids',
            title: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Long context demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:long-context')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.nextRepair).toBe('SSM Hybrids')
    expect(snapshot?.currentObject?.title).toContain('Long Context Engineering')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining(['Speculative Decoding', 'Long Context', 'SSM Hybrids'])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(
      within(bridge).getByText(/Speculative Decoding interactive demo -> Long Context Engineering/i)
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Speculative speedup is preserved as prior history; now test which long-context constraint dominates before SSM Hybrids.'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Earlier history: Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
    expect(within(bridge).getByRole('link', { name: 'Open SSM Hybrids' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids/'
    )
  })

  it('keeps Long Context active while inspecting the Speculative Decoding history demo', async () => {
    window.history.pushState({}, '', '/domains/llm-systems/speculative-decoding/#interactive-demo')
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Long Context Engineering',
        paperClueLabel: 'Long Context Engineering',
        inputKind: 'concept notebook',
        mappingId: 'concept:long-context',
        mappingTitle: 'Attention & Transformers concept notebook',
        routeLabels: [
          'FlashAttention',
          'LLM Serving',
          'Decoding and Sampling',
          'Speculative Decoding',
          'Long Context',
          'SSM Hybrids',
        ],
        routeConceptIds: [
          'flash-attention',
          'llm-serving',
          'decoding-sampling',
          'speculative-decoding',
          'long-context',
          'ssm-hybrids',
        ],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
          {
            label: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
          {
            label: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ],
        nextRepair: 'SSM Hybrids',
        currentQuestion: 'Which constraint should this long-context demo expose?',
        currentObject: {
          type: 'concept',
          id: 'long-context',
          objectKey: 'concept:attention-transformers/long-context',
          discussionAnchorId: 'concept/concept-notebook/attention-transformers/long-context',
          title: 'Long Context Engineering',
          href: '/domains/attention-transformers/long-context/',
          role: 'Use the selected object to ask a grounded research question before moving on.',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
            title: 'Speculative Decoding interactive demo',
            href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
            role: 'Previous active repair before Long Context',
            status: 'route handoff history',
            sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            confidence: 'medium',
          },
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'intuition',
              label: 'Intuition',
              status: 'ready',
              updatedAt: '2026-05-12T01:20:00.000Z',
            },
          ],
          nextRepair: 'SSM Hybrids',
          updatedAt: '2026-05-12T01:20:00.000Z',
        },
        lastObservation: {
          label: 'Concept object focus',
          value: 'concept: Long Context Engineering',
          detail: 'Long Context Engineering reading-room object selected for grounded AI handoff.',
          nextQuestion: 'Which constraint should this long-context demo expose?',
          source: 'learning-route',
          updatedAt: '2026-05-12T01:20:00.000Z',
        },
        createdAt: '2026-05-12T01:20:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding',
          domain: 'llm-systems',
          slug: 'speculative-decoding',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Draft tokens are checked by the target model without changing the target distribution.',
        }}
        sections={{
          intuitionHtml: '<p>Speculation helps only when draft and target agree.</p>',
          mathHtml: '<p>Acceptance math lives here.</p>',
          codeHtml: '<p>Residual repair code lives here.</p>',
          demoHtml: '<p>Speculative speedup demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'long-context',
            title: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Speculative decoding demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    const demoChip = within(objectFlowBar)
      .getAllByRole('link')
      .find((link) => /Speculative Decoding.*interactive demo/i.test(link.textContent ?? ''))
    expect(demoChip).toBeTruthy()
    fireEvent.focus(demoChip as HTMLElement)
    fireEvent.click(demoChip as HTMLElement)

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:long-context')
    })

    expect(getSavedLearningRouteSnapshot()?.currentObject?.title).toBe('Long Context Engineering')
    expect(getSavedLearningRouteSnapshot()?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
        }),
      ])
    )
    expect(screen.getByRole('link', { name: 'Return to active repair' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context'
    )
  })

  it('saves a Long Context demo prediction while preserving the full route stack', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Long Context Engineering',
        paperClueLabel: 'Long Context Engineering',
        inputKind: 'concept notebook',
        mappingId: 'concept:long-context',
        mappingTitle: 'Attention & Transformers concept notebook',
        routeLabels: [
          'FlashAttention',
          'LLM Serving',
          'Decoding and Sampling',
          'Speculative Decoding',
          'Long Context',
          'SSM Hybrids',
        ],
        routeConceptIds: [
          'flash-attention',
          'llm-serving',
          'decoding-sampling',
          'speculative-decoding',
          'long-context',
          'ssm-hybrids',
        ],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
          {
            label: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
          {
            label: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ],
        nextRepair: 'SSM Hybrids',
        currentQuestion: 'Which constraint should this long-context demo expose?',
        currentObject: {
          type: 'concept',
          id: 'long-context',
          objectKey: 'concept:attention-transformers/long-context',
          discussionAnchorId: 'concept/concept-notebook/attention-transformers/long-context',
          title: 'Long Context Engineering',
          href: '/domains/attention-transformers/long-context/',
          role: 'Use the selected object to ask a grounded research question before moving on.',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
            title: 'Speculative Decoding interactive demo',
            href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
            role: 'Previous active repair before Long Context',
            status: 'route handoff history',
            sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            confidence: 'medium',
          },
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'intuition',
              label: 'Intuition',
              status: 'ready',
              updatedAt: '2026-05-12T01:25:00.000Z',
            },
          ],
          nextRepair: 'SSM Hybrids',
          updatedAt: '2026-05-12T01:25:00.000Z',
        },
        lastObservation: {
          label: 'Concept object focus',
          value: 'concept: Long Context Engineering',
          detail: 'Long Context Engineering reading-room object selected for grounded AI handoff.',
          nextQuestion: 'Which constraint should this long-context demo expose?',
          source: 'learning-route',
          updatedAt: '2026-05-12T01:25:00.000Z',
        },
        createdAt: '2026-05-12T01:25:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'long-context',
          title: 'Long Context Engineering',
          domain: 'attention-transformers',
          slug: 'long-context',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Long-context systems must manage attention work, position phase, and KV memory.',
          sources: [
            {
              id: 'kwon-2023-pagedattention',
              title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
              kind: 'paper',
              year: 2023,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Long context creates several bottlenecks.</p>',
          mathHtml: '<p>KV memory and position phase live here.</p>',
          codeHtml: '<p>KV sizing witness lives here.</p>',
          demoHtml: '<p>Long context demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'ssm-hybrids',
            title: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Long context demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'long-context',
        label: 'Prediction-first long-context constraint router',
        summary: 'Learner predicted KV memory; KV Cache reveals KV memory.',
        values: [
          'active demo: KV Cache',
          'prediction: KV memory',
          'revealed: yes',
          'prediction correct: yes',
          'expected constraint: KV memory',
          'constraint invariant: KV cache cost grows with layers, heads, context length, and value width.',
          'demo panel: mounted',
        ],
      })
    })

    expect(await screen.findAllByText('Prediction-first long-context constraint router')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:long-context')
    expect(snapshot?.nextRepair).toBe('SSM Hybrids')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toContain('Long Context Engineering interactive demo')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.lastObservation?.value).toContain('Learner predicted KV memory')
    expect(snapshot?.lastObservation?.detail).toContain('active demo: KV Cache')
    expect(snapshot?.lastObservation?.detail).toContain('expected constraint: KV memory')
    expect(snapshot?.lastObservation?.detail).toContain('constraint invariant')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('Learner predicted KV memory'),
      })
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
          sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )
  })

  it('activates SSM Hybrids from the Long Context demo observation with the five-deep route stack', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Long Context Engineering',
        paperClueLabel: 'Long Context Engineering',
        inputKind: 'concept notebook',
        mappingId: 'concept:long-context',
        mappingTitle: 'Attention & Transformers concept notebook',
        routeLabels: [
          'FlashAttention',
          'LLM Serving',
          'Decoding and Sampling',
          'Speculative Decoding',
          'Long Context',
          'SSM Hybrids',
        ],
        routeConceptIds: [
          'flash-attention',
          'llm-serving',
          'decoding-sampling',
          'speculative-decoding',
          'long-context',
          'ssm-hybrids',
        ],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
          {
            label: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
          {
            label: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ],
        nextRepair: 'SSM Hybrids',
        currentQuestion: 'Which slider or state change in the Long Context demo would test the central claim most directly?',
        currentObject: {
          type: 'visualization',
          id: 'interactive-demo',
          objectKey: 'demo:attention-transformers/long-context#interactive-demo',
          discussionAnchorId: 'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
          title: 'Long Context Engineering interactive demo',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
          role: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
          status: 'prediction checkpoint revealed',
          sourceDetail: 'Prediction-first long-context constraint router',
          confidence: 'medium',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
            title: 'Speculative Decoding interactive demo',
            href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
            role: 'Previous active repair before Long Context',
            status: 'route handoff history',
            sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            confidence: 'medium',
          },
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'interactive-demo',
              label: 'Interactive Demo',
              status: 'ready',
              updatedAt: '2026-05-12T01:35:00.000Z',
            },
          ],
          checkpoints: [
            {
              id: 'demo-prediction',
              label: 'Demo prediction',
              status: 'observed',
              detail: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
              updatedAt: '2026-05-12T01:35:00.000Z',
            },
          ],
          resolvedObjectIds: [
            'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
          ],
          nextRepair: 'SSM Hybrids',
          updatedAt: '2026-05-12T01:35:00.000Z',
        },
        lastObservation: {
          label: 'Demo prediction',
          value: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
          detail: 'Current interactive demo state: active demo: KV Cache; expected constraint: KV memory.',
          nextQuestion: 'Open SSM Hybrids next, with KV cache memory preserved as the long-context constraint.',
          source: 'prediction-checkpoint',
          updatedAt: '2026-05-12T01:35:00.000Z',
        },
        createdAt: '2026-05-12T01:35:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'ssm-hybrids',
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          domain: 'attention-transformers',
          slug: 'ssm-hybrids',
          difficulty: 4,
          status: 'review',
          importance: 'important',
          short_description: 'State-space hybrids trade explicit KV memory for a compressed recurrent state.',
          sources: [
            {
              id: 'gu-2023-mamba',
              title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
              kind: 'paper',
              year: 2023,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>SSM hybrids ask what fixed state can preserve.</p>',
          mathHtml: '<p>Selective recurrence equations live here.</p>',
          codeHtml: '<p>State-memory witness lives here.</p>',
          demoHtml: '<p>Selective-gate demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'long-context',
            title: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>SSM selective gate demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:ssm-hybrids')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toContain('SSM Hybrids')
    expect(snapshot?.nextRepair).toBeUndefined()
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
          sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByText(/Long Context Engineering interactive demo -> SSM Hybrids/i)).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Long-context KV memory is preserved as prior history; now compare fixed-state recurrence against a growing KV cache.'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Earlier history: Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('saves an SSM Hybrids demo prediction while preserving Long Context and deeper history', async () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: SSM Hybrids',
        paperClueLabel: 'SSM Hybrids',
        inputKind: 'concept notebook',
        mappingId: 'concept:ssm-hybrids',
        mappingTitle: 'Attention & Transformers concept notebook',
        routeLabels: [
          'FlashAttention',
          'LLM Serving',
          'Decoding and Sampling',
          'Speculative Decoding',
          'Long Context',
          'SSM Hybrids',
          'SwiGLU',
        ],
        routeConceptIds: [
          'flash-attention',
          'llm-serving',
          'decoding-sampling',
          'speculative-decoding',
          'long-context',
          'ssm-hybrids',
          'swiglu',
        ],
        routeConcepts: [
          {
            label: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
          {
            label: 'LLM Serving',
            href: '/domains/llm-systems/llm-serving/',
          },
          {
            label: 'Decoding and Sampling',
            href: '/domains/llm-systems/decoding-sampling/',
          },
          {
            label: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
          {
            label: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
          {
            label: 'SSM Hybrids',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
          {
            label: 'SwiGLU: Gated MLP Blocks in Transformers',
            href: '/domains/attention-transformers/swiglu/',
          },
        ],
        nextRepair: 'SwiGLU: Gated MLP Blocks in Transformers',
        currentQuestion: 'What does fixed-state recurrence preserve that a growing KV cache stored explicitly?',
        currentObject: {
          type: 'concept',
          id: 'ssm-hybrids',
          objectKey: 'concept:attention-transformers/ssm-hybrids',
          discussionAnchorId: 'concept/concept-notebook/attention-transformers/ssm-hybrids',
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          href: '/domains/attention-transformers/ssm-hybrids/',
          role: 'Use the selected object to compare fixed recurrent state with explicit KV memory.',
          status: 'selected in concept room',
        },
        sourceObjects: [
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:attention-transformers/long-context#interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
            title: 'Long Context Engineering interactive demo',
            href: '/domains/attention-transformers/long-context/#interactive-demo',
            role: 'Previous active repair before SSM Hybrids',
            status: 'route handoff history',
            sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
            confidence: 'medium',
          },
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
            title: 'Speculative Decoding interactive demo',
            href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
            role: 'Previous active repair before Long Context',
            status: 'route handoff history',
            sourceDetail: 'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            confidence: 'medium',
          },
          {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
            title: 'Decoding & Sampling interactive demo',
            href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
            role: 'Previous active repair before Speculative Decoding',
            status: 'route handoff history',
            sourceDetail: 'Opened Speculative Decoding from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'concept',
            id: 'llm-serving',
            objectKey: 'concept:llm-systems/llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
            role: 'Previous active repair before Decoding and Sampling',
            status: 'route handoff history',
            sourceDetail: 'Opened Decoding and Sampling from this comparison bridge.',
            confidence: 'medium',
          },
          {
            type: 'equation',
            id: 'equation-1',
            objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            role: 'Answer the carried question: which slider tests the memory claim?',
            status: 'resolved route history',
            sourceDetail: 'The memory slider is the direct witness.',
            confidence: 'high',
          },
        ],
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'interactive-demo',
              label: 'Interactive Demo',
              status: 'ready',
              updatedAt: '2026-05-12T02:10:00.000Z',
            },
          ],
          resolvedObjectIds: [
            'concept/concept-notebook/attention-transformers/ssm-hybrids',
          ],
          nextRepair: 'SwiGLU: Gated MLP Blocks in Transformers',
          updatedAt: '2026-05-12T02:10:00.000Z',
        },
        lastObservation: {
          label: 'Concept object focus',
          value: 'concept: SSM Hybrids: Fixed-State Sequence Models for Long Context',
          detail: 'SSM Hybrids reading-room object selected for grounded AI handoff.',
          nextQuestion: 'What does fixed-state recurrence preserve that a growing KV cache stored explicitly?',
          source: 'learning-route',
          updatedAt: '2026-05-12T02:10:00.000Z',
        },
        createdAt: '2026-05-12T02:10:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'ssm-hybrids',
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          domain: 'attention-transformers',
          slug: 'ssm-hybrids',
          difficulty: 4,
          status: 'review',
          importance: 'important',
          short_description: 'State-space hybrids trade explicit KV memory for a compressed recurrent state.',
          sources: [
            {
              id: 'gu-2023-mamba',
              title: 'Mamba: Linear-Time Sequence Modeling with Selective State Spaces',
              kind: 'paper',
              year: 2023,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>SSM hybrids ask what fixed state can preserve.</p>',
          mathHtml: '<p>Selective recurrence equations live here.</p>',
          codeHtml: '<p>State-memory witness lives here.</p>',
          demoHtml: '<p>Selective-gate demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'long-context',
            title: 'Long Context',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={{
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          href: '/domains/attention-transformers/swiglu/',
        }}
        Viz={() => <div>SSM selective gate demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'ssm-hybrids',
        label: 'SSM selective-gate memory prediction',
        summary: 'selective-gate toy outcome for Single marked span under balanced selectivity; recurrence is compressed memory, not exact lookup.',
        values: [
          'pattern: Single marked span',
          'gate preset: balanced selectivity',
          'prediction: selective-gate toy',
          'revealed: yes',
          'winner: selective-gate toy',
          'mechanism: token-dependent delta controls write/copy/forget',
          'prediction correct: yes',
        ],
      })
    })

    expect(await screen.findAllByText('SSM selective-gate memory prediction')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:ssm-hybrids')
    expect(snapshot?.nextRepair).toBe('SwiGLU: Gated MLP Blocks in Transformers')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toContain('SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.currentObject?.sourceDetail).toBe('SSM selective-gate memory prediction')
    expect(snapshot?.lastObservation?.value).toContain('selective-gate toy outcome')
    expect(snapshot?.lastObservation?.detail).toContain('winner: selective-gate toy')
    expect(snapshot?.lastObservation?.detail).toContain('token-dependent delta controls write/copy/forget')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('selective-gate toy outcome'),
      })
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'visualization/concept-notebook/attention-transformers/ssm-hybrids/interactive-demo',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
          sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )
  })

  it('keeps SSM Hybrids active while inspecting the Long Context history demo', async () => {
    window.history.pushState({}, '', '/domains/attention-transformers/long-context/#interactive-demo')

    const activeSsmSnapshot = ssmSelectiveGatePredictionSnapshot()
    expect(saveLearningRouteSnapshot(activeSsmSnapshot)).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'long-context',
          title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          domain: 'attention-transformers',
          slug: 'long-context',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description:
            'How frontier LLMs stretch context windows with positional extrapolation and KV cache memory tricks.',
          sources: [
            {
              id: 'kwon-2023-pagedattention',
              title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
              kind: 'paper',
              year: 2023,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Long context pressure starts with KV memory.</p>',
          mathHtml: '<p>KV cache scaling equations live here.</p>',
          codeHtml: '<p>KV memory witness lives here.</p>',
          demoHtml: '<p>Long-context router demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'flash-attention',
            title: 'FlashAttention',
            href: '/domains/attention-transformers/flash-attention/',
          },
        ]}
        leadsTo={[
          {
            id: 'ssm-hybrids',
            title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
            href: '/domains/attention-transformers/ssm-hybrids/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Long-context KV cache demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:ssm-hybrids')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toContain('SSM Hybrids')
    expect(snapshot?.nextRepair).toBe('SwiGLU: Gated MLP Blocks in Transformers')
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
      ])
    )
  })

  it('activates SwiGLU from the saved SSM demo observation while preserving the full route stack', async () => {
    expect(saveLearningRouteSnapshot(ssmSelectiveGatePredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'swiglu',
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          domain: 'attention-transformers',
          slug: 'swiglu',
          difficulty: 4,
          status: 'review',
          importance: 'important',
          short_description: 'SwiGLU turns a transformer MLP into a token-local gated write.',
          sources: [
            {
              id: 'shazeer-2020-glu-variants',
              title: 'GLU Variants Improve Transformer',
              kind: 'paper',
              year: 2020,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>SwiGLU asks value and gate branches to cooperate.</p>',
          mathHtml: '<p>Value, gate, SiLU, and product equations live here.</p>',
          codeHtml: '<p>Gated MLP witness lives here.</p>',
          demoHtml: '<p>Gated MLP prediction demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'attention-transformers',
            title: 'Attention',
            href: '/domains/attention-transformers/attention-transformers/',
          },
          {
            id: 'linear-transformations',
            title: 'Linear Transformations',
            href: '/domains/linear-algebra/linear-transformations/',
          },
        ]}
        leadsTo={[
          {
            id: 'mixture-of-experts',
            title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
            href: '/domains/efficiency/mixture-of-experts/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>SwiGLU gated MLP demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:swiglu')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.nextRepair).toBe('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism')
    expect(snapshot?.currentObject?.title).toBe('SwiGLU: Gated MLP Blocks in Transformers')
    expect(snapshot?.currentObject?.status).toBe('selected in concept room')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
        'SwiGLU',
        'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
          status: 'route handoff history',
          sourceDetail:
            'Demo prediction: A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup.',
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo -> SwiGLU: Gated MLP Blocks in Transformers'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Selective recurrent memory is preserved as prior history; now test token-local gated writes before Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism.'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Earlier history: Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: Speculative Decoding interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving/'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
    expect(
      within(bridge).getByRole('link', { name: 'Open Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism' })
    ).toHaveAttribute('href', '/domains/efficiency/mixture-of-experts/')
  })

  it('saves a SwiGLU demo prediction while preserving SSM and deeper history', async () => {
    expect(saveLearningRouteSnapshot(swigluConceptFocusSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention & Transformers"
        concept={{
          id: 'swiglu',
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          domain: 'attention-transformers',
          slug: 'swiglu',
          difficulty: 4,
          status: 'review',
          importance: 'important',
          short_description: 'SwiGLU turns a transformer MLP into a token-local gated write.',
          sources: [
            {
              id: 'shazeer-2020-glu-variants',
              title: 'GLU Variants Improve Transformer',
              kind: 'paper',
              year: 2020,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>SwiGLU asks value and gate branches to cooperate.</p>',
          mathHtml: '<p>Value, gate, SiLU, and product equations live here.</p>',
          codeHtml: '<p>Gated MLP witness lives here.</p>',
          demoHtml: '<p>Gated MLP prediction demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'attention-transformers',
            title: 'Attention',
            href: '/domains/attention-transformers/attention-transformers/',
          },
          {
            id: 'linear-transformations',
            title: 'Linear Transformations',
            href: '/domains/linear-algebra/linear-transformations/',
          },
        ]}
        leadsTo={[
          {
            id: 'mixture-of-experts',
            title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
            href: '/domains/efficiency/mixture-of-experts/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>SwiGLU gated MLP demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'swiglu',
        label: 'SwiGLU gated-MLP prediction',
        summary: 'Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276.',
        values: [
          'preset: Token A',
          'channel: channel 1',
          'visible value v_i: +1.120',
          'visible gate logit g_i: -1.450',
          'prediction: suppress',
          'revealed: yes',
          'actual gate regime: suppress',
          'SiLU(g_i): -0.276',
          'v_i * SiLU(g_i): -0.309',
          'selected-channel contribution: [-0.179, +0.105, -0.068]',
          'parameter-budget ratio: 100.0%',
        ],
      })
    })

    expect(await screen.findAllByText('SwiGLU gated-MLP prediction')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:swiglu')
    expect(snapshot?.nextRepair).toBe('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toBe('SwiGLU: Gated MLP Blocks in Transformers interactive demo')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.currentObject?.sourceDetail).toBe('SwiGLU gated-MLP prediction')
    expect(snapshot?.lastObservation?.value).toContain('Token A channel 1 was suppressed')
    expect(snapshot?.lastObservation?.detail).toContain('actual gate regime: suppress')
    expect(snapshot?.lastObservation?.detail).toContain('SiLU(g_i): -0.276')
    expect(snapshot?.lastObservation?.detail).toContain('v_i * SiLU(g_i): -0.309')
    expect(snapshot?.lastObservation?.detail).toContain('parameter-budget ratio: 100.0%')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('Token A channel 1 was suppressed'),
      })
    )
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'visualization/concept-notebook/attention-transformers/swiglu/interactive-demo',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
          sourceDetail: `Demo prediction: ${ssmSelectiveGateObservation}`,
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )
  })

  it('activates Mixture of Experts from the saved SwiGLU demo observation while preserving the full route stack', async () => {
    expect(saveLearningRouteSnapshot(swigluGatedMlpPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Efficiency"
        concept={{
          id: 'mixture-of-experts',
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          domain: 'efficiency',
          slug: 'mixture-of-experts',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'A router sends each token to a few expert MLPs, trading dense activated compute for sparse conditional capacity.',
          sources: [
            {
              id: 'shazeer-2017-sparsely-gated-moe',
              title: 'Outrageously Large Neural Networks',
              kind: 'paper',
              year: 2017,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>MoE routes tokens to sparse experts.</p>',
          mathHtml: '<p>Router probabilities, top-k gating, and capacity constraints live here.</p>',
          codeHtml: '<p>Load-balancing code witness lives here.</p>',
          demoHtml: '<p>Capacity prediction demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'attention-transformers',
            title: 'Attention',
            href: '/domains/attention-transformers/attention-transformers/',
          },
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'moe-serving',
            title: 'MoE Serving: Expert Parallelism in Production',
            href: '/domains/llm-systems/moe-serving/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>MoE top-k routing demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:mixture-of-experts')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toBe('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism')
    expect(snapshot?.currentObject?.status).toBe('selected in concept room')
    expect(snapshot?.nextRepair).toBe('MoE Serving: Expert Parallelism in Production')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
        'SwiGLU',
        'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          href: '/domains/attention-transformers/swiglu/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: `Demo prediction: ${swigluGateProductObservation}`,
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: `Demo prediction: ${ssmSelectiveGateObservation}`,
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(
      within(bridge).getByText(/SwiGLU: Gated MLP Blocks in Transformers interactive demo -> Sparse Mixture of Experts/)
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Dense token-local gating is preserved as prior history; now test sparse expert routing before MoE Serving: Expert Parallelism in Production.'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Earlier history: SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: Long Context Engineering interactive demo' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: Speculative Decoding interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding/#interactive-demo'
    )
  })

  it('saves a Mixture of Experts capacity prediction while preserving diagnostic detail and route history', async () => {
    expect(saveLearningRouteSnapshot(swigluGatedMlpPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Efficiency"
        concept={{
          id: 'mixture-of-experts',
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          domain: 'efficiency',
          slug: 'mixture-of-experts',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'A router sends each token to a few expert MLPs, trading dense activated compute for sparse conditional capacity.',
          sources: [
            {
              id: 'shazeer-2017-sparsely-gated-moe',
              title: 'Outrageously Large Neural Networks',
              kind: 'paper',
              year: 2017,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>MoE routes tokens to sparse experts.</p>',
          mathHtml: '<p>Router probabilities, top-k gating, and capacity constraints live here.</p>',
          codeHtml: '<p>Load-balancing code witness lives here.</p>',
          demoHtml: '<p>Capacity prediction demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'attention-transformers',
            title: 'Attention',
            href: '/domains/attention-transformers/attention-transformers/',
          },
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'moe-serving',
            title: 'MoE Serving: Expert Parallelism in Production',
            href: '/domains/llm-systems/moe-serving/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>MoE top-k routing demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'mixture-of-experts',
        label: 'MoE capacity drop reveal',
        summary:
          'Learner predicted Overloaded expert drops/overflows assignments; revealed capacity overflow with 3 overflowed token-expert assignments.',
        values: [
          'slice: mixture-of-experts-capacity-drop-reveal',
          'prediction: Overloaded expert drops/overflows assignments',
          'actual: capacity-overflow',
          'prediction correct: yes',
          'batch preset: Batch A',
          'token count: 6',
          'expert count: 4',
          'topK: 2',
          'capacity per expert: 2',
          'token order: T0, T1, T2, T3, T4, T5',
          'topKAssignments: T0:E0,E1; T1:E0,E1; T2:E0,E1; T3:E2,E3',
          'servedAssignments: T0:E0; T0:E1; T1:E0; T1:E1; T3:E2; T3:E3',
          'droppedAssignments: T2:E0; T2:E1; T4:E0',
          'overflowExpertIds: E0, E1',
          'expertLoads: E0:2/2, E1:2/2, E2:1/2, E3:1/2',
          'overflowRate: 25.0%',
          'slotUtilization: 75.0%',
        ],
      })
    })

    expect(await screen.findAllByText('MoE capacity drop reveal')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:mixture-of-experts')
    expect(snapshot?.nextRepair).toBe('MoE Serving: Expert Parallelism in Production')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toBe('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.currentObject?.sourceDetail).toBe('MoE capacity drop reveal')
    expect(snapshot?.lastObservation?.value).toContain('Learner predicted Overloaded expert')
    expect(snapshot?.lastObservation?.value).toContain('capacity overflow')
    expect(snapshot?.lastObservation?.detail).toContain('actual: capacity-overflow')
    expect(snapshot?.lastObservation?.detail).toContain('servedAssignments:')
    expect(snapshot?.lastObservation?.detail).toContain('droppedAssignments:')
    expect(snapshot?.lastObservation?.detail).toContain('overflowExpertIds:')
    expect(snapshot?.lastObservation?.detail).not.toContain('token order:')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
        'SwiGLU',
        'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      ])
    )
    expect(snapshot?.routeConcepts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'MoE Serving: Expert Parallelism in Production',
          href: '/domains/llm-systems/moe-serving/',
          role: 'next repair',
        }),
      ])
    )
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('Learner predicted Overloaded expert'),
      })
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/swiglu/#interactive-demo',
          sourceDetail: `Demo prediction: ${swigluGateProductObservation}`,
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
          sourceDetail: `Demo prediction: ${ssmSelectiveGateObservation}`,
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )
  })

  it('activates MoE Serving from the saved MoE capacity observation while preserving the full route stack', async () => {
    expect(saveLearningRouteSnapshot(mixtureOfExpertsCapacityPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'moe-serving',
          title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
          domain: 'llm-systems',
          slug: 'moe-serving',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Serving MoE turns sparse compute into a scheduling problem.',
          sources: [
            {
              id: 'zhu-2025-megascale-infer',
              title: 'MegaScale-Infer',
              kind: 'paper',
              year: 2025,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Token dispatch turns routing skew into a serving bottleneck.</p>',
          mathHtml: '<p>Dispatch bytes, expert loads, and straggler terms live here.</p>',
          codeHtml: '<p>Scheduling code witness lives here.</p>',
          demoHtml: '<p>Expert dispatch scheduling demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'mixture-of-experts',
            title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
            href: '/domains/efficiency/mixture-of-experts/',
          },
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'speculative-decoding',
            title: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>MoE serving dispatch demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:moe-serving')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toBe('MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism')
    expect(snapshot?.currentObject?.status).toBe('selected in concept room')
    expect(snapshot?.nextRepair).toBe('Speculative Decoding')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
        'SwiGLU',
        'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
        'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
          status: 'route handoff history',
          href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
          sourceDetail: expect.stringContaining('Learner predicted Overloaded expert'),
        }),
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/swiglu/#interactive-demo',
          sourceDetail: `Demo prediction: ${swigluGateProductObservation}`,
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
          sourceDetail: `Demo prediction: ${ssmSelectiveGateObservation}`,
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(
      within(bridge).getByText(/Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo -> MoE Serving/)
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Capacity overflow is preserved as prior history; now test token dispatch and expert scheduling before Speculative Decoding.'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('saves a MoE Serving routing-skew prediction while preserving serving diagnostics and route history', async () => {
    expect(saveLearningRouteSnapshot(mixtureOfExpertsCapacityPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'moe-serving',
          title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
          domain: 'llm-systems',
          slug: 'moe-serving',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Serving MoE turns sparse compute into a scheduling problem.',
          sources: [
            {
              id: 'zhu-2025-megascale-infer',
              title: 'MegaScale-Infer',
              kind: 'paper',
              year: 2025,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Token dispatch turns routing skew into a serving bottleneck.</p>',
          mathHtml: '<p>Dispatch bytes, expert loads, and straggler terms live here.</p>',
          codeHtml: '<p>Scheduling code witness lives here.</p>',
          demoHtml: '<p>Expert dispatch scheduling demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'mixture-of-experts',
            title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
            href: '/domains/efficiency/mixture-of-experts/',
          },
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'speculative-decoding',
            title: 'Speculative Decoding',
            href: '/domains/llm-systems/speculative-decoding/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>MoE serving dispatch demo</div>}
      />
    )

    act(() => {
      emitDemoState({
        conceptId: 'moe-serving',
        label: 'MoE serving routing-skew demo',
        summary:
          '2048 tokens, E=16, top-k=2, hot routing: winner Hot expert straggler, max/mean load 5.30x, communication 64.0 MiB.',
        values: [
          'tokens: 2048',
          'experts: 16',
          'top-k: 2',
          'skew: hot',
          'fabric: fast (900Gbps)',
          'prediction: Hot expert straggler',
          'winner: Hot expert straggler',
          'prediction correct: yes',
          'max/mean load: 5.30x',
          'max expert load: 1358',
          'all-to-all bytes: 64.0 MiB',
          'communication time: 0.07 ms',
          'expert straggler time: 0.10 ms',
          'layer proxy: 0.10 ms',
          'revealed: yes',
        ],
      })
    })

    expect(await screen.findAllByText('MoE serving routing-skew demo')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:moe-serving')
    expect(snapshot?.nextRepair).toBe('Speculative Decoding')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toBe(
      'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo'
    )
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.currentObject?.sourceDetail).toBe('MoE serving routing-skew demo')
    expect(snapshot?.lastObservation?.value).toContain('winner Hot expert straggler')
    expect(snapshot?.lastObservation?.detail).toContain('winner: Hot expert straggler')
    expect(snapshot?.lastObservation?.detail).toContain('prediction correct: yes')
    expect(snapshot?.lastObservation?.detail).toContain('max/mean load: 5.30x')
    expect(snapshot?.lastObservation?.detail).toContain('all-to-all bytes: 64.0 MiB')
    expect(snapshot?.lastObservation?.detail).toContain('communication time: 0.07 ms')
    expect(snapshot?.lastObservation?.detail).toContain('expert straggler time: 0.10 ms')
    expect(snapshot?.lastObservation?.detail).not.toContain('tokens: 2048')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('winner Hot expert straggler'),
      })
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
          status: 'route handoff history',
          href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
          sourceDetail: expect.stringContaining('Learner predicted Overloaded expert'),
        }),
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/swiglu/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
          href: '/domains/attention-transformers/long-context/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
          href: '/domains/llm-systems/decoding-sampling/#interactive-demo',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
          href: '/domains/llm-systems/llm-serving/',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )
  })

  it('activates Speculative Decoding from the saved MoE Serving bottleneck while preserving the full route stack', async () => {
    expect(saveLearningRouteSnapshot(moeServingRoutingSkewPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          domain: 'llm-systems',
          slug: 'speculative-decoding',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Draft tokens are verified in parallel without changing the target distribution.',
          sources: [
            {
              id: 'leviathan-2022-speculative-decoding',
              title: 'Fast Inference from Transformers via Speculative Decoding',
              kind: 'paper',
              year: 2022,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Speculation starts with a draft model.</p>',
          mathHtml: '<p>Acceptance and residual objects live here.</p>',
          codeHtml: '<p>Draft verify code witness lives here.</p>',
          demoHtml: '<p>Speculative demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'long-context',
            title: 'Long Context Engineering',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Speculative decoding demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:speculative-decoding')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.title).toBe('Speculative Decoding: Lossless Multi-Token Generation')
    expect(snapshot?.currentObject?.status).toBe('selected in concept room')
    expect(snapshot?.nextRepair).toBe('Long Context Engineering')
    expect(snapshot?.routeLabels).toEqual(
      expect.arrayContaining([
        'FlashAttention',
        'LLM Serving',
        'Decoding and Sampling',
        'Speculative Decoding',
        'Long Context',
        'SSM Hybrids',
        'SwiGLU',
        'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
        'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      ])
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo',
          href: '/domains/llm-systems/moe-serving/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: expect.stringContaining('winner Hot expert straggler'),
        }),
        expect.objectContaining({
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
          href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: expect.stringContaining('capacity overflow'),
        }),
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByText(/MoE Serving .* interactive demo -> Speculative Decoding/i)).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'MoE serving bottleneck is preserved as prior history; now test draft-target verification before Long Context Engineering.'
      )
    ).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'Earlier history: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo; SwiGLU: Gated MLP Blocks in Transformers interactive demo; SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('saves a Speculative Decoding draft-target prediction from the MoE Serving route stack', async () => {
    expect(saveLearningRouteSnapshot(moeServingRoutingSkewPredictionSnapshot())).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="LLM Systems"
        concept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          domain: 'llm-systems',
          slug: 'speculative-decoding',
          difficulty: 4,
          status: 'published',
          importance: 'important',
          short_description: 'Draft tokens are verified in parallel without changing the target distribution.',
          sources: [
            {
              id: 'leviathan-2022-speculative-decoding',
              title: 'Fast Inference from Transformers via Speculative Decoding',
              kind: 'paper',
              year: 2022,
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Speculation starts with a draft model.</p>',
          mathHtml: '<p>Acceptance and residual objects live here.</p>',
          codeHtml: '<p>Draft verify code witness lives here.</p>',
          demoHtml: '<p>Speculative demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[
          {
            id: 'llm-serving',
            title: 'LLM Serving at Scale',
            href: '/domains/llm-systems/llm-serving/',
          },
        ]}
        leadsTo={[
          {
            id: 'long-context',
            title: 'Long Context Engineering',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>Speculative decoding demo</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.click(within(objectFlowBar).getByRole('link', { name: /Ask about this/i }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.mappingId).toBe('concept:speculative-decoding')
    })

    act(() => {
      emitDemoState({
        conceptId: 'speculative-decoding',
        label: 'Prediction-first speculative speedup reveal',
        summary: 'Learner predicted Draft-target match; speculation reveals Draft-target match.',
        values: [
          'prediction: Draft-target match',
          'revealed: yes',
          'prediction correct: yes',
          'expected condition: Draft-target match',
          'speculation invariant: speedup appears only when a long draft prefix survives target verification',
          'draft-verify lab: mounted',
        ],
      })
    })

    expect(await screen.findAllByText('Prediction-first speculative speedup reveal')).not.toHaveLength(0)

    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })

    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.mappingId).toBe('concept:speculative-decoding')
    expect(snapshot?.nextRepair).toBe('Long Context Engineering')
    expect(snapshot?.currentObject?.type).toBe('visualization')
    expect(snapshot?.currentObject?.title).toContain('Speculative Decoding')
    expect(snapshot?.currentObject?.status).toBe('prediction checkpoint revealed')
    expect(snapshot?.currentObject?.sourceDetail).toBe('Prediction-first speculative speedup reveal')
    expect(snapshot?.lastObservation?.value).toContain('Learner predicted Draft-target match')
    expect(snapshot?.lastObservation?.detail).toContain('prediction correct: yes')
    expect(snapshot?.lastObservation?.detail).toContain('expected condition: Draft-target match')
    expect(snapshot?.lastObservation?.detail).toContain('speculation invariant')
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(
      expect.objectContaining({
        id: 'demo-prediction',
        status: 'observed',
        detail: expect.stringContaining('Draft-target match'),
      })
    )
    expect(snapshot?.sourceObjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo',
          href: '/domains/llm-systems/moe-serving/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: expect.stringContaining('winner Hot expert straggler'),
        }),
        expect.objectContaining({
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
          href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
          status: 'route handoff history',
          sourceDetail: expect.stringContaining('capacity overflow'),
        }),
        expect.objectContaining({
          title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Long Context Engineering interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Speculative Decoding interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'Decoding & Sampling interactive demo',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'LLM Serving at Scale',
          status: 'route handoff history',
        }),
        expect.objectContaining({
          title: 'FlashAttention equation 1',
          status: 'resolved route history',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
        }),
      ])
    )

    const bridge = await screen.findByLabelText('Route history comparison bridge')
    expect(within(bridge).getByText('Activation bridge')).toBeInTheDocument()
    expect(within(bridge).getByText(/MoE Serving .* interactive demo -> Speculative Decoding/i)).toBeInTheDocument()
    expect(
      within(bridge).getByText(
        'MoE serving bottleneck is preserved as prior history; now test draft-target verification before Long Context Engineering.'
      )
    ).toBeInTheDocument()
    expect(within(bridge).getByRole('link', { name: 'Inspect prior repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving/#interactive-demo'
    )
    expect(within(bridge).getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention/#math-object-1'
    )
  })

  it('lands a public saved-action link on the exact object with the draft visible', async () => {
    window.history.pushState({}, '', '/domains/attention-transformers/flash-attention/#math-object-1')
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: FlashAttention',
        paperClueLabel: 'FlashAttention prediction checkpoint',
        inputKind: 'browser-local concept object action',
        mappingId: 'concept:flash-attention',
        routeLabels: ['Attention', 'Efficient Attention', 'FlashAttention'],
        routeConceptIds: ['attention-transformers', 'efficient-attention', 'flash-attention'],
        currentQuestion: 'Which slider tests the FlashAttention memory claim?',
        currentObject: {
          type: 'equation',
          id: 'math-object-1',
          objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
          title: 'FlashAttention equation 1',
          href: '/domains/attention-transformers/flash-attention/#math-object-1',
          status: 'prediction checkpoint revealed',
        },
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'math',
              label: 'Math',
              status: 'active',
              updatedAt: '2026-05-11T00:00:00.000Z',
            },
          ],
          checkpoints: [
            {
              id: 'demo-prediction',
              label: 'Demo prediction',
              status: 'saved',
              updatedAt: '2026-05-11T00:00:00.000Z',
            },
          ],
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
        createdAt: '2026-05-11T00:00:00.000Z',
      })
    ).toBe(true)
    expect(
      saveLocalObjectActionDraft({
        version: 'cf-object-action-draft-v1',
        objectKey: 'equation:attention-transformers/flash-attention#math-object-1',
        objectTitle: 'FlashAttention equation 1',
        note: 'Prediction observation: use the memory slider as the next witness.',
        nextAction: 'Answer the carried question: test the memory claim.',
        updatedAt: '2026-05-11T00:00:00.000Z',
        source: 'research-reading-room',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          domain: 'attention-transformers',
          slug: 'flash-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'IO-aware exact attention.',
          tags: ['attention', 'transformers'],
          sources: [
            {
              id: 'dao-2022-flashattention',
              title: 'FlashAttention',
              kind: 'paper',
              year: 2022,
              note: 'Online softmax plus tiling.',
            },
          ],
          claim_checks: [
            {
              id: 'exact-io-aware-tiling',
              status: 'source-checked',
              claim: 'FlashAttention computes exact attention with IO-aware tiling.',
              source_ids: ['dao-2022-flashattention'],
              object_refs: ['#math-object-1', '#code-witness-1'],
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Build the story first.</p>',
          mathHtml: '<p>Math object lives here.</p>',
          codeHtml: '<p>Code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>viz</div>}
      />
    )

    const selectedObjectContext = await screen.findByLabelText('Selected object context')
    expect(within(selectedObjectContext).getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText('Local snapshot saved')).toBeInTheDocument()
    expect(within(selectedObjectContext).getByText(/equation:attention-transformers\/flash-attention#math-object-1/)).toBeInTheDocument()
    const selectedSavedAction = await screen.findByLabelText('Selected object saved action')
    expect(within(selectedSavedAction).getByText('Saved action')).toBeInTheDocument()
    expect(within(selectedSavedAction).getByText('Answer the carried question: test the memory claim.')).toBeInTheDocument()
    expect(within(selectedSavedAction).getByText('Prediction observation: use the memory slider as the next witness.')).toBeInTheDocument()

    const localDraft = screen.getByLabelText('Local action draft')
    expect(within(localDraft).getByText('Answer the carried question: test the memory claim.')).toBeInTheDocument()
    expect(within(localDraft).queryByText('No local draft saved yet')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FlashAttention equation 1' })).toBeInTheDocument()
  })

  it('carries prediction reveal state into the selected exact object drawer', async () => {
    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          domain: 'attention-transformers',
          slug: 'flash-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'IO-aware exact attention.',
          tags: ['attention', 'transformers'],
          sources: [
            {
              id: 'dao-2022-flashattention',
              title: 'FlashAttention',
              kind: 'paper',
              year: 2022,
              note: 'Online softmax plus tiling.',
            },
          ],
          claim_checks: [
            {
              id: 'exact-io-aware-tiling',
              status: 'source-checked',
              claim: 'FlashAttention computes exact attention with IO-aware tiling.',
              source_ids: ['dao-2022-flashattention'],
              object_refs: ['#math-object-1', '#code-witness-1'],
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Build the story first.</p>',
          mathHtml: '<p>Math object lives here.</p>',
          codeHtml: '<p>Code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>viz</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    fireEvent.focus(within(objectFlowBar).getByRole('link', { name: /FlashAttention equation 1/i }))
    const demoCheckpoint = screen.getByText('Demo Prediction Checkpoint').closest('.demo-checkpoint') as HTMLElement
    fireEvent.click(within(demoCheckpoint).getByRole('button', { name: 'Reveal check' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()?.lastObservation?.source).toBe('prediction-checkpoint')
    })
    const snapshot = getSavedLearningRouteSnapshot()
    expect(snapshot?.currentObject?.type).toBe('equation')
    expect(snapshot?.currentObject?.discussionAnchorId).toBe(
      'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1'
    )
    expect(snapshot?.routeProgress?.checkpoints?.[0]).toEqual(expect.objectContaining({ id: 'demo-prediction' }))
    expect(snapshot?.routeProgress?.resolvedObjectIds).toEqual(
      expect.arrayContaining([
        'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
        'visualization/concept-notebook/attention-transformers/flash-attention/interactive-demo',
      ])
    )

    const stateStrip = await screen.findByLabelText('Drawer route state summary')
    expect(within(stateStrip).getByText('Carried prediction observation')).toBeInTheDocument()
    expect(within(stateStrip).getByText('Prediction lens: A quantity moves')).toBeInTheDocument()
    expect(within(stateStrip).getByText(/Answer the carried question:/)).toBeInTheDocument()
    expect(within(stateStrip).queryByText('No local draft saved yet')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'FlashAttention equation 1' })).toBeInTheDocument()
  })

  it('does not show progress from another concept notebook snapshot', () => {
    expect(
      saveLearningRouteSnapshot({
        version: 'cf-route-snapshot-v1',
        source: 'concept-notebook',
        paperTitle: 'Concept notebook: Other Concept',
        inputKind: 'concept notebook',
        mappingId: 'concept:other-concept',
        routeLabels: ['Other Concept'],
        routeConceptIds: ['other-concept'],
        currentQuestion: 'Why does the other equation matter?',
        currentObject: {
          type: 'equation',
          discussionAnchorId: 'equation/concept-notebook/other-concept/math',
          title: 'Other concept math objects',
          href: '/domains/attention-transformers/other-concept/#math',
        },
        routeProgress: {
          version: 'cf-route-progress-v1',
          stageReadiness: [
            {
              stageId: 'intuition',
              label: 'Intuition',
              status: 'ready',
              updatedAt: '2026-05-11T00:00:00.000Z',
            },
            {
              stageId: 'math',
              label: 'Math',
              status: 'ready',
              updatedAt: '2026-05-11T00:00:00.000Z',
            },
          ],
          updatedAt: '2026-05-11T00:00:00.000Z',
        },
        createdAt: '2026-05-11T00:00:00.000Z',
      })
    ).toBe(true)

    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          domain: 'attention-transformers',
          slug: 'flash-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'IO-aware exact attention.',
          tags: ['attention', 'transformers'],
        }}
        sections={{
          intuitionHtml: '<p>Build the story first.</p>',
          mathHtml: '<p>Math object lives here.</p>',
          codeHtml: '<p>Code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={objectSpans}
        prerequisites={[]}
        leadsTo={[]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>viz</div>}
      />
    )

    const objectFlowBar = screen.getByLabelText('Object-attached flow')
    expect(within(objectFlowBar).queryByText('2/2 sections ready')).not.toBeInTheDocument()
  })

  it('saves the Efficient Attention workbench as a validated route-memory observation', async () => {
    render(
      <ConceptNotebookPage
        domainTitle="Attention Transformers"
        concept={{
          id: 'efficient-attention',
          title: 'Efficient Attention',
          domain: 'attention-transformers',
          slug: 'efficient-attention',
          difficulty: 4,
          status: 'published',
          importance: 'critical',
          short_description: 'Grouped-query attention reduces KV-cache memory by storing fewer K/V heads.',
          tags: ['attention', 'transformers', 'inference'],
          sources: [
            {
              id: 'ainslie-2023-gqa',
              title: 'GQA',
              kind: 'paper',
              year: 2023,
              note: 'Grouped-query attention reduces stored key/value heads.',
            },
          ],
        }}
        sections={{
          intuitionHtml: '<p>Share stored K/V heads while keeping query heads visible.</p>',
          mathHtml: '<p>KV memory equation lives here.</p>',
          codeHtml: '<p>KV cache code witness lives here.</p>',
          demoHtml: '<p>Demo notes.</p>',
        }}
        objectSpans={[
          {
            kind: 'equation',
            domId: 'math-object-1',
            snippet: 'H_kv = H_q / g',
          },
          {
            kind: 'equation',
            domId: 'math-object-2',
            snippet: 'M_KV = B * L * T * 2 * H_kv * d * s',
          },
          {
            kind: 'code-witness',
            domId: 'code-witness-1',
            snippet: 'cache_bytes = batch * layers * T * 2 * kv_heads * d_head * bytes',
          },
        ]}
        prerequisites={[]}
        leadsTo={[
          {
            id: 'long-context',
            title: 'Long Context Engineering',
            href: '/domains/attention-transformers/long-context/',
          },
        ]}
        related={[]}
        prevInDomain={null}
        nextInDomain={null}
        Viz={() => <div>viz</div>}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Sharing-factor drop/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Carry observation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Observation carried' })).toBeInTheDocument()
    })

    const snapshot = getSavedLearningRouteSnapshot()

    expect(snapshot?.mappingId).toBe('concept:efficient-attention')
    expect(snapshot?.currentObject?.type).toBe('equation')
    expect(snapshot?.currentObject?.objectKey).toBe(
      'equation:attention-transformers/efficient-attention#math-object-2'
    )
    expect(snapshot?.currentObject?.status).toBe('workbench observation carried')
    expect(snapshot?.lastObservation?.label).toBe('Efficient attention workbench')
    expect(snapshot?.lastObservation?.source).toBe('kv-memory-lab')
    expect(snapshot?.lastObservation?.detail).toContain('predictionId=quarter')
    expect(snapshot?.lastObservation?.workbench).toEqual(
      expect.objectContaining({
        type: 'formula-workbench',
        equationObject: expect.objectContaining({
          objectKey: 'equation:attention-transformers/efficient-attention#math-object-2',
        }),
        committedPrediction: expect.objectContaining({
          id: 'quarter',
          label: 'It drops by the sharing factor',
        }),
        lab: expect.objectContaining({
          id: 'efficient-attention-kv-cache-workbench',
          version: '2026-05-31',
          state: expect.objectContaining({
            context: 32768,
            kvHeads: 8,
          }),
        }),
      })
    )
    expect(snapshot?.lastObservation?.labState).toEqual(
      expect.objectContaining({
        context: 32768,
        layers: 32,
        queryHeads: 32,
        kvHeads: 8,
        dHead: 128,
        batch: 1,
        bytes: 2,
      })
    )
    expect(snapshot?.routeProgress?.checkpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'efficient-attention-workbench',
          status: 'saved',
        }),
      ])
    )
  })
})
