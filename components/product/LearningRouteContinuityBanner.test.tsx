import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import {
  clearLearningRouteSnapshot,
  getSavedLearningRouteSnapshot,
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
} from '@/lib/learningRouteSnapshot'
import {
  clearLocalObjectActionJournal,
  saveLocalObjectActionDraft,
  saveLocalObjectActionResolution,
} from '@/lib/localObjectActionJournal'
import LearningRouteContinuityBanner from './LearningRouteContinuityBanner'

const flashEquationObjectKey = 'equation:attention-transformers/flash-attention#math-object-1'

function attentionServingSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return {
    version: 'cf-route-snapshot-v1',
    source: 'attention-serving',
    paperTitle: 'Public trail: attention to serving',
    paperClueLabel: 'Attention to serving',
    inputKind: 'public local learning trail',
    mappingId: 'kv-cache',
    mappingTitle: 'Attention to Serving',
    routeLabels: ['Attention', 'Efficient Attention', 'RoPE'],
    routeConceptIds: ['attention-transformers', 'efficient-attention', 'rope'],
    routeConcepts: [
      {
        label: 'Attention',
        href: '/domains/attention-transformers/attention-transformers/',
      },
      {
        label: 'Efficient Attention',
        href: '/domains/attention-transformers/efficient-attention/',
      },
    ],
    nextRepair: 'Efficient Attention',
    currentQuestion: 'How does attention become a serving bottleneck?',
    labGoal: 'Predict which KV-cache term changes memory before opening the lab.',
    labStatus: 'live',
    currentObject: {
      type: 'concept',
      id: 'attention-transformers',
      title: 'Attention',
      href: '/domains/attention-transformers/attention-transformers/',
      role: 'Start with the weighted-copy equation.',
      status: 'first concept',
      confidence: 'high',
    },
    createdAt: '2026-05-08T00:00:00.000Z',
    ...overrides,
  }
}

function longContextKvPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  return attentionServingSnapshot({
    source: 'concept-notebook',
    mappingId: 'concept:long-context',
    paperTitle: 'Concept notebook: Long Context Engineering',
    paperClueLabel: 'Long Context Engineering',
    labStatus: undefined,
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
    },
    sourceObjects: [
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
        objectKey: flashEquationObjectKey,
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
      stageReadiness: [],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
          updatedAt: '2026-05-12T01:40:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
      ],
      nextRepair: 'SSM Hybrids',
      updatedAt: '2026-05-12T01:40:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
      detail: 'Current interactive demo state: active demo: KV Cache; expected constraint: KV memory.',
      nextQuestion: 'Open SSM Hybrids next, with KV cache memory preserved as the long-context constraint.',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T01:40:00.000Z',
    },
    ...overrides,
  })
}

function ssmSelectiveGatePredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const longContextSnapshot = longContextKvPredictionSnapshot()
  const ssmObservation =
    'A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup.'
  return attentionServingSnapshot({
    source: 'concept-notebook',
    mappingId: 'concept:ssm-hybrids',
    paperTitle: 'Concept notebook: SSM Hybrids',
    paperClueLabel: 'SSM Hybrids',
    labStatus: undefined,
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
      ...(longContextSnapshot.routeConcepts ?? []),
      {
        label: 'SwiGLU: Gated MLP Blocks in Transformers',
        href: '/domains/attention-transformers/swiglu/',
      },
    ],
    nextRepair: 'SwiGLU: Gated MLP Blocks in Transformers',
    currentQuestion: 'Which selective-gate recurrence preserves the marked tokens through distractors?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:attention-transformers/ssm-hybrids#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/attention-transformers/ssm-hybrids/interactive-demo',
      title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
      href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
      role: ssmObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'SSM selective-gate memory prediction',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/long-context#interactive-demo',
        title: 'Long Context Engineering interactive demo',
        href: '/domains/attention-transformers/long-context/#interactive-demo',
        role: 'Previous active repair before SSM Hybrids',
        status: 'route handoff history',
        sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
        confidence: 'medium',
      },
      ...(longContextSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: ssmObservation,
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
      value: ssmObservation,
      detail: 'Current interactive demo state: winner: selective-gate toy; mechanism: token-dependent delta controls write/copy/forget; prediction correct: yes.',
      nextQuestion: 'Which slider or state change in the SSM Hybrids demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T02:20:00.000Z',
    },
    ...overrides,
  })
}

function swigluGatedMlpPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const ssmSnapshot = ssmSelectiveGatePredictionSnapshot()
  const swigluObservation =
    'SwiGLU gated-MLP prediction: Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276.'

  return attentionServingSnapshot({
    source: 'concept-notebook',
    mappingId: 'concept:swiglu',
    paperTitle: 'Concept notebook: SwiGLU',
    paperClueLabel: 'SwiGLU',
    labStatus: undefined,
    routeLabels: [
      ...(ssmSnapshot.routeLabels ?? []),
      'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    ],
    routeConceptIds: [
      ...(ssmSnapshot.routeConceptIds ?? []),
      'mixture-of-experts',
    ],
    routeConcepts: [
      ...(ssmSnapshot.routeConcepts ?? []),
      {
        label: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
        href: '/domains/efficiency/mixture-of-experts/',
      },
    ],
    nextRepair: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    currentQuestion: 'Which slider or state change in the SwiGLU demo would test the central claim most directly?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:attention-transformers/swiglu#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/attention-transformers/swiglu/interactive-demo',
      title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
      href: '/domains/attention-transformers/swiglu/#interactive-demo',
      role: swigluObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'SwiGLU gated-MLP prediction',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/ssm-hybrids#interactive-demo',
        title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo',
        href: '/domains/attention-transformers/ssm-hybrids/#interactive-demo',
        role: 'Previous active repair before SwiGLU: Gated MLP Blocks in Transformers',
        status: 'route handoff history',
        sourceDetail:
          'Demo prediction: A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup.',
        confidence: 'medium',
      },
      ...(ssmSnapshot.sourceObjects ?? []),
    ],
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
          detail: swigluObservation,
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
      value: swigluObservation,
      detail:
        'Current interactive demo state: actual gate regime: suppress; SiLU(g_i): -0.276; v_i * SiLU(g_i): -0.309; parameter-budget ratio: 100.0%.',
      nextQuestion: 'Which slider or state change in the SwiGLU demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T03:10:00.000Z',
    },
    ...overrides,
  })
}

function mixtureOfExpertsActivationSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const swigluSnapshot = swigluGatedMlpPredictionSnapshot()

  return attentionServingSnapshot({
    source: 'concept-notebook',
    mappingId: 'concept:mixture-of-experts',
    paperTitle: 'Concept notebook: Sparse Mixture of Experts',
    paperClueLabel: 'Sparse Mixture of Experts',
    labStatus: undefined,
    routeLabels: [
      ...(swigluSnapshot.routeLabels ?? []),
      'MoE Serving: Expert Parallelism in Production',
    ],
    routeConceptIds: [
      ...(swigluSnapshot.routeConceptIds ?? []),
      'moe-serving',
    ],
    routeConcepts: [
      ...(swigluSnapshot.routeConcepts ?? []),
      {
        label: 'MoE Serving: Expert Parallelism in Production',
        href: '/domains/llm-systems/moe-serving/',
      },
    ],
    nextRepair: 'MoE Serving: Expert Parallelism in Production',
    currentQuestion: 'What is the smallest routing example that separates selected experts from served capacity?',
    currentObject: {
      type: 'concept',
      id: 'mixture-of-experts',
      objectKey: 'concept:efficiency/mixture-of-experts',
      discussionAnchorId: 'concept/concept-notebook/efficiency/mixture-of-experts',
      title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      href: '/domains/efficiency/mixture-of-experts/',
      role: 'Use the selected object to compare dense token-local gating with sparse expert routing.',
      status: 'selected in concept room',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:attention-transformers/swiglu#interactive-demo',
        title: 'SwiGLU: Gated MLP Blocks in Transformers interactive demo',
        href: '/domains/attention-transformers/swiglu/#interactive-demo',
        role: 'Previous active repair before Sparse Mixture of Experts',
        status: 'route handoff history',
        sourceDetail:
          'Demo prediction: SwiGLU gated-MLP prediction: Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276.',
        confidence: 'medium',
      },
      ...(swigluSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'intuition',
          label: 'Intuition',
          status: 'ready',
          updatedAt: '2026-05-12T03:35:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'concept/concept-notebook/efficiency/mixture-of-experts',
      ],
      nextRepair: 'MoE Serving: Expert Parallelism in Production',
      updatedAt: '2026-05-12T03:35:00.000Z',
    },
    lastObservation: {
      label: 'Concept object focus',
      value: 'concept: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
      detail: 'Mixture of Experts reading-room object selected for grounded AI handoff.',
      nextQuestion: 'What is the smallest routing example that separates selected experts from served capacity?',
      source: 'learning-route',
      updatedAt: '2026-05-12T03:35:00.000Z',
    },
    ...overrides,
  })
}

function mixtureOfExpertsCapacityPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const moeSnapshot = mixtureOfExpertsActivationSnapshot()
  const moeObservation =
    'MoE capacity drop reveal: Learner predicted Overloaded expert drops/overflows assignments; revealed capacity overflow with 3 overflowed token-expert assignments.'

  return attentionServingSnapshot({
    ...moeSnapshot,
    currentQuestion: 'Which capacity constraint separates routed expert choices from assignments the system can actually serve?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:efficiency/mixture-of-experts#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/efficiency/mixture-of-experts/interactive-demo',
      title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
      href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
      role: moeObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'MoE capacity drop reveal',
    },
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
      nextRepair: 'MoE Serving: Expert Parallelism in Production',
      updatedAt: '2026-05-12T04:15:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: moeObservation,
      detail:
        'Current interactive demo state: actual: capacity-overflow; servedAssignments: T0:E0; T0:E1; droppedAssignments: T2:E0; overflowExpertIds: E0, E1.',
      nextQuestion: 'Open MoE Serving next, with token dispatch capacity preserved as the production constraint.',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T04:15:00.000Z',
    },
    ...overrides,
  })
}

function moeServingActivationSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const moeSnapshot = mixtureOfExpertsCapacityPredictionSnapshot()

  return attentionServingSnapshot({
    ...moeSnapshot,
    mappingId: 'concept:moe-serving',
    paperTitle: 'Concept notebook: MoE Serving & Scheduling',
    paperClueLabel: 'MoE Serving & Scheduling',
    routeLabels: [
      ...(moeSnapshot.routeLabels ?? []),
      'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      'Speculative Decoding',
    ],
    routeConceptIds: [
      ...(moeSnapshot.routeConceptIds ?? []),
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
    nextRepair: 'Speculative Decoding',
    currentQuestion: 'Which token-dispatch or expert-scheduling constraint explains the serving bottleneck?',
    currentObject: {
      type: 'concept',
      id: 'moe-serving',
      objectKey: 'concept:llm-systems/moe-serving',
      discussionAnchorId: 'concept/concept-notebook/llm-systems/moe-serving',
      title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      href: '/domains/llm-systems/moe-serving/',
      role: 'Use the selected object to compare MoE capacity overflow with serving-time token dispatch.',
      status: 'selected in concept room',
    },
    sourceObjects: [
      {
        type: 'visualization',
        id: 'interactive-demo',
        objectKey: 'demo:efficiency/mixture-of-experts#interactive-demo',
        title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo',
        href: '/domains/efficiency/mixture-of-experts/#interactive-demo',
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
          stageId: 'intuition',
          label: 'Intuition',
          status: 'ready',
          updatedAt: '2026-05-12T04:40:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'concept/concept-notebook/llm-systems/moe-serving',
      ],
      nextRepair: 'Speculative Decoding',
      updatedAt: '2026-05-12T04:40:00.000Z',
    },
    lastObservation: {
      label: 'Concept object focus',
      value: 'concept: MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
      detail: 'MoE Serving reading-room object selected for grounded AI handoff.',
      nextQuestion: 'Which token-dispatch or expert-scheduling constraint explains the serving bottleneck?',
      source: 'learning-route',
      updatedAt: '2026-05-12T04:40:00.000Z',
    },
    ...overrides,
  })
}

function moeServingRoutingSkewPredictionSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const servingSnapshot = moeServingActivationSnapshot()
  const servingObservation =
    'A quantity moves: 2048 tokens, E=16, top-k=2, hot routing: winner Hot expert straggler, max/mean load 5.83x, communication 64.0 MiB.'

  return attentionServingSnapshot({
    ...servingSnapshot,
    currentQuestion: 'Which slider or state change in the MoE Serving demo would test the central claim most directly?',
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
    },
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
    ...overrides,
  })
}

function speculativeActivationFromMoeServingSnapshot(overrides: Partial<LearningRouteSnapshot> = {}): LearningRouteSnapshot {
  const servingSnapshot = moeServingRoutingSkewPredictionSnapshot()

  return attentionServingSnapshot({
    ...servingSnapshot,
    mappingId: 'concept:speculative-decoding',
    paperTitle: 'Concept notebook: Speculative Decoding',
    paperClueLabel: 'Speculative Decoding',
    routeLabels: [
      ...(servingSnapshot.routeLabels ?? []),
      'Long Context Engineering',
    ],
    routeConceptIds: [
      ...(servingSnapshot.routeConceptIds ?? []),
      'long-context',
    ],
    routeConcepts: [
      ...(servingSnapshot.routeConcepts ?? []),
      {
        label: 'Long Context Engineering',
        href: '/domains/attention-transformers/long-context/',
        role: 'next repair',
      },
    ],
    nextRepair: 'Long Context Engineering',
    currentQuestion: 'What condition makes draft-target verification lossless and fast?',
    currentObject: {
      type: 'concept',
      id: 'speculative-decoding',
      objectKey: 'concept:llm-systems/speculative-decoding',
      discussionAnchorId: 'concept/concept-notebook/llm-systems/speculative-decoding',
      title: 'Speculative Decoding: Lossless Multi-Token Generation',
      href: '/domains/llm-systems/speculative-decoding/',
      role: 'Use the selected object to compare serving bottlenecks with draft-target verification.',
      status: 'selected in concept room',
    },
    sourceObjects: [
      {
        ...servingSnapshot.currentObject!,
        role: 'Previous active repair before Speculative Decoding',
        status: 'route handoff history',
        sourceDetail: `Demo prediction: ${servingSnapshot.lastObservation!.value}`,
        confidence: 'medium',
      },
      ...(servingSnapshot.sourceObjects ?? []),
    ],
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'intuition',
          label: 'Intuition',
          status: 'ready',
          updatedAt: '2026-05-12T05:35:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'concept/concept-notebook/llm-systems/speculative-decoding',
      ],
      nextRepair: 'Long Context Engineering',
      updatedAt: '2026-05-12T05:35:00.000Z',
    },
    lastObservation: {
      label: 'Concept object focus',
      value: 'concept: Speculative Decoding: Lossless Multi-Token Generation',
      detail: 'Speculative Decoding reading-room object selected for grounded AI handoff.',
      nextQuestion: 'What condition makes draft-target verification lossless and fast?',
      source: 'learning-route',
      updatedAt: '2026-05-12T05:35:00.000Z',
    },
    ...overrides,
  })
}

function speculativeDraftTargetPredictionFromMoeServingSnapshot(
  overrides: Partial<LearningRouteSnapshot> = {}
): LearningRouteSnapshot {
  const speculativeSnapshot = speculativeActivationFromMoeServingSnapshot()
  const speculativeObservation =
    'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.'

  return attentionServingSnapshot({
    ...speculativeSnapshot,
    currentQuestion: 'Which slider or state change in the Speculative Decoding demo would test the central claim most directly?',
    currentObject: {
      type: 'visualization',
      id: 'interactive-demo',
      objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
      discussionAnchorId: 'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
      title: 'Speculative Decoding: Lossless Multi-Token Generation interactive demo',
      href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
      role: speculativeObservation,
      status: 'prediction checkpoint revealed',
      sourceDetail: 'Prediction-first speculative speedup reveal',
    },
    routeProgress: {
      version: 'cf-route-progress-v1',
      stageReadiness: [
        {
          stageId: 'interactive-demo',
          label: 'Interactive Demo',
          status: 'ready',
          updatedAt: '2026-05-12T06:05:00.000Z',
        },
      ],
      checkpoints: [
        {
          id: 'demo-prediction',
          label: 'Demo prediction',
          status: 'observed',
          detail: speculativeObservation,
          updatedAt: '2026-05-12T06:05:00.000Z',
        },
      ],
      resolvedObjectIds: [
        'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
      ],
      nextRepair: 'Long Context Engineering',
      updatedAt: '2026-05-12T06:05:00.000Z',
    },
    lastObservation: {
      label: 'Demo prediction',
      value: speculativeObservation,
      detail:
        'Current interactive demo state: prediction correct: yes; expected condition: Draft-target match; speculation invariant: speedup appears only when a long draft prefix survives target verification; revealed: yes.',
      nextQuestion: 'Which slider or state change in the Speculative Decoding demo would test the central claim most directly?',
      source: 'prediction-checkpoint',
      updatedAt: '2026-05-12T06:05:00.000Z',
    },
    ...overrides,
  })
}

describe('LearningRouteContinuityBanner', () => {
  const originalConsoleError = console.error

  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation((...args) => {
      const message = args.map((arg) => String(arg)).join(' ')
      if (message.includes('non-boolean attribute') && message.includes('jsx')) return
      if (message.includes('Not implemented: navigation')) return
      originalConsoleError(...args)
    })
    clearLearningRouteSnapshot()
    clearLocalObjectActionJournal()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('prefers graph route over KV lab for fresh attention-serving snapshots off graph surface', () => {
    render(<LearningRouteContinuityBanner surface="home" snapshot={attentionServingSnapshot()} />)

    const primaryAction = screen.getByRole('link', { name: 'Continue route' })
    expect(primaryAction).toHaveAttribute('href', '/graph?route=kv-cache&from=home#learning-route')
    expect(screen.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('uses the search surface as a route-aware graph handoff', () => {
    render(<LearningRouteContinuityBanner surface="search" snapshot={attentionServingSnapshot()} />)

    const primaryAction = screen.getByRole('link', { name: 'Continue graph route' })
    expect(primaryAction).toHaveAttribute('href', '/graph?route=kv-cache&from=search#learning-route')
    expect(screen.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('prefers graph route over KV lab for graph-saved kv-cache snapshots with no observation', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        snapshot={attentionServingSnapshot({
          source: 'graph',
        })}
      />
    )

    const primaryAction = screen.getByRole('link', { name: 'Continue route' })
    expect(primaryAction).toHaveAttribute('href', '/graph?route=kv-cache&from=home#learning-route')
    expect(screen.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('shows local progress in compact route cockpit mode', () => {
    render(
      <LearningRouteContinuityBanner
        surface="search"
        compact
        snapshot={attentionServingSnapshot({
          routeProgress: {
            version: 'cf-route-progress-v1',
            stageReadiness: [
              {
                stageId: 'attention-transformers',
                label: 'Attention',
                status: 'ready',
                updatedAt: '2026-05-11T00:00:00.000Z',
              },
              {
                stageId: 'efficient-attention',
                label: 'Efficient Attention',
                status: 'active',
                updatedAt: '2026-05-11T00:05:00.000Z',
              },
            ],
            updatedAt: '2026-05-11T00:05:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Local progress')).toBeInTheDocument()
    expect(screen.getByText('1/2 stages ready')).toBeInTheDocument()
    expect(screen.getByText('Now: Efficient Attention')).toBeInTheDocument()
  })

  it('clears browser-local route state from the uncontrolled compact cockpit', async () => {
    saveLearningRouteSnapshot(attentionServingSnapshot())

    render(<LearningRouteContinuityBanner surface="home" compact />)

    expect(await screen.findByRole('heading', { name: 'How does attention become a serving bottleneck?' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Clear route' }))

    await waitFor(() => {
      expect(getSavedLearningRouteSnapshot()).toBeNull()
    })
    expect(screen.queryByRole('heading', { name: 'How does attention become a serving bottleneck?' })).not.toBeInTheDocument()
  })

  it('prefers first repair concept on graph surface for fresh attention-serving snapshots', () => {
    render(<LearningRouteContinuityBanner surface="graph" snapshot={attentionServingSnapshot()} />)

    const primaryAction = screen.getByRole('link', { name: 'Open Efficient Attention' })
    expect(primaryAction).toHaveAttribute('href', '/domains/attention-transformers/efficient-attention')
    expect(screen.getByRole('link', { name: 'Search route' })).toHaveAttribute(
      'href',
      '/search?q=Efficient%20Attention&from=graph#route-search-lens'
    )
    expect(screen.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('prefers first repair concept on graph surface for graph-saved kv-cache snapshots with no observation', () => {
    render(
      <LearningRouteContinuityBanner
        surface="graph"
        snapshot={attentionServingSnapshot({
          source: 'graph',
        })}
      />
    )

    const primaryAction = screen.getByRole('link', { name: 'Open Efficient Attention' })
    expect(primaryAction).toHaveAttribute('href', '/domains/attention-transformers/efficient-attention')
    expect(screen.queryByRole('link', { name: 'Open KV memory lab' })).not.toBeInTheDocument()
  })

  it('keeps KV lab as primary when attention-serving snapshot already has an observation', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        snapshot={attentionServingSnapshot({
          lastObservation: {
            label: 'KV memory prediction',
            value: 'Reducing kv heads lowers cache size.',
            nextQuestion: 'Now compare grouped-query attention to multi-query.',
            source: 'kv-memory-lab',
            updatedAt: '2026-05-08T01:00:00.000Z',
          },
        })}
      />
    )

    const primaryAction = screen.getByRole('link', { name: 'Open KV memory lab' })
    expect(primaryAction).toHaveAttribute('href', '/paths/attention-serving?focus=kv-cache&from=home#serving-module')
    expect(screen.getByText('Now compare grouped-query attention to multi-query.')).toBeInTheDocument()
  })

  it('preserves concept-notebook primary resume behavior', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:efficient-attention',
          labStatus: undefined,
          currentObject: {
            type: 'concept',
            id: 'efficient-attention',
            title: 'Efficient Attention',
            href: '/domains/attention-transformers/efficient-attention/',
            status: 'active',
          },
        })}
      />
    )

    const primaryAction = screen.getByRole('link', { name: 'Resume concept object' })
    expect(primaryAction).toHaveAttribute('href', '/domains/attention-transformers/efficient-attention')
  })

  it('surfaces a matching saved object action as the public resume step', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: flashEquationObjectKey,
      objectTitle: 'FlashAttention equation 1',
      note: 'Prediction observation: memory traffic changed after reveal.',
      nextAction: 'Answer the carried question: which slider tests the memory claim?',
      updatedAt: '2026-05-11T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:flash-attention',
          labStatus: undefined,
          currentObject: {
            type: 'equation',
            id: 'equation-1',
            objectKey: flashEquationObjectKey,
            discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            status: 'prediction checkpoint revealed',
          },
        })}
      />
    )

    expect(screen.getByText('Saved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: which slider tests the memory claim?')).toBeInTheDocument()
    expect(screen.getByText('Prediction observation: memory traffic changed after reveal.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open saved action' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('advances to the next repair after a saved object action is resolved', () => {
    saveLocalObjectActionResolution({
      version: 'cf-object-action-resolution-v1',
      objectKey: flashEquationObjectKey,
      objectTitle: 'FlashAttention equation 1',
      resolvedAction: 'Answer the carried question: which slider tests the memory claim?',
      resolutionNote: 'The memory slider is the direct witness.',
      updatedAt: '2026-05-11T00:10:00.000Z',
      source: 'research-reading-room',
    })

    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:flash-attention',
          labStatus: undefined,
          routeConcepts: [
            {
              label: 'FlashAttention: IO-Aware Attention',
              href: '/domains/attention-transformers/flash-attention/',
            },
            {
              label: 'LLM Serving',
              href: '/domains/llm-systems/llm-serving/',
            },
          ],
          nextRepair: 'LLM Serving',
          currentObject: {
            type: 'equation',
            id: 'equation-1',
            objectKey: flashEquationObjectKey,
            discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            status: 'prediction checkpoint revealed',
          },
        })}
      />
    )

    expect(screen.getByText('Resolved object action')).toBeInTheDocument()
    expect(screen.getByText('Answer the carried question: which slider tests the memory claim?')).toBeInTheDocument()
    expect(screen.getByText('The memory slider is the direct witness.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Continue next repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.queryByRole('link', { name: 'Open saved action' })).not.toBeInTheDocument()
  })

  it('shows resolved prior object as route history on the next repair landing', () => {
    saveLocalObjectActionResolution({
      version: 'cf-object-action-resolution-v1',
      objectKey: flashEquationObjectKey,
      objectTitle: 'FlashAttention equation 1',
      resolvedAction: 'Answer the carried question: which slider tests the memory claim?',
      resolutionNote: 'The memory slider is the direct witness.',
      updatedAt: '2026-05-11T00:10:00.000Z',
      source: 'research-reading-room',
    })

    render(
      <LearningRouteContinuityBanner
        surface="concept-notebook"
        compact
        activeConcept={{
          id: 'llm-serving',
          title: 'LLM Serving',
          href: '/domains/llm-systems/llm-serving/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:flash-attention',
          labStatus: undefined,
          routeLabels: ['FlashAttention', 'LLM Serving'],
          routeConcepts: [
            {
              label: 'FlashAttention: IO-Aware Attention',
              href: '/domains/attention-transformers/flash-attention/',
            },
            {
              label: 'LLM Serving',
              href: '/domains/llm-systems/llm-serving/',
            },
          ],
          nextRepair: 'LLM Serving',
          currentObject: {
            type: 'equation',
            id: 'equation-1',
            objectKey: flashEquationObjectKey,
            discussionAnchorId: 'equation/concept-notebook/attention-transformers/flash-attention/math/equation-1',
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            status: 'prediction checkpoint revealed',
          },
        })}
      />
    )

    expect(screen.getByRole('heading', { name: 'Next repair: LLM Serving' })).toBeInTheDocument()
    expect(screen.getByText('Active repair')).toBeInTheDocument()
    expect(screen.getByText('New concept is active')).toBeInTheDocument()
    expect(screen.getByText('Route history')).toBeInTheDocument()
    expect(screen.getByText('FlashAttention equation 1: The memory slider is the direct witness.')).toBeInTheDocument()
    expect(screen.queryByText('Current object')).not.toBeInTheDocument()
    expect(screen.queryByText('Resolved object action')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start LLM Serving' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving#intuition'
    )
    expect(screen.getByRole('link', { name: 'Inspect resolved object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('keeps prior resolved object inspectable after the current object moves to the next repair', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:llm-serving',
          paperTitle: 'Concept notebook: LLM Serving',
          paperClueLabel: 'LLM Serving',
          routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding'],
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
              objectKey: flashEquationObjectKey,
              title: 'FlashAttention equation 1',
              href: '/domains/attention-transformers/flash-attention/#math-object-1',
              role: 'Answer the carried question: which slider tests the memory claim?',
              status: 'resolved route history',
              sourceDetail: 'The memory slider is the direct witness.',
              confidence: 'high',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('Current object')).toBeInTheDocument()
    expect(screen.getByText('LLM Serving at Scale')).toBeInTheDocument()
    expect(screen.getByText('Route history')).toBeInTheDocument()
    expect(screen.getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getByText('The memory slider is the direct witness.')).toBeInTheDocument()
    expect(screen.getByText('Comparison bridge')).toBeInTheDocument()
    const bridgeCard = screen.getByText('Comparison bridge').closest('article') as HTMLElement
    expect(screen.getByText('FlashAttention equation 1 -> LLM Serving at Scale')).toBeInTheDocument()
    expect(
      screen.getByText('Memory math is fixed; next compare decode-time choices in Decoding and Sampling.')
    ).toBeInTheDocument()
    expect(within(bridgeCard).getByText('Next repair: Decoding and Sampling')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Decoding and Sampling' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling'
    )
  })

  it('surfaces activation history after Decoding becomes the active route', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:decoding-sampling',
          paperTitle: 'Concept notebook: Decoding and Sampling',
          paperClueLabel: 'Decoding and Sampling',
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
              objectKey: flashEquationObjectKey,
              title: 'FlashAttention equation 1',
              href: '/domains/attention-transformers/flash-attention/#math-object-1',
              role: 'Answer the carried question: which slider tests the memory claim?',
              status: 'resolved route history',
              sourceDetail: 'The memory slider is the direct witness.',
              confidence: 'high',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('Current object')).toBeInTheDocument()
    expect(screen.getByText('Decoding & Sampling')).toBeInTheDocument()
    expect(screen.getByText('Route history')).toBeInTheDocument()
    expect(screen.getByText('LLM Serving at Scale')).toBeInTheDocument()
    expect(screen.getByText('Opened Decoding and Sampling from this comparison bridge. Earlier: FlashAttention equation 1.')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('LLM Serving at Scale -> Decoding & Sampling')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Serving bottlenecks are preserved as the prior repair; now test decode-time controls before Speculative Decoding.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Earlier history: FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: Speculative Decoding').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Speculative Decoding' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding'
    )
  })

  it('surfaces a Decoding prediction observation without losing activation history', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'decoding-sampling',
          title: 'Decoding and Sampling',
          href: '/domains/llm-systems/decoding-sampling/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:decoding-sampling',
          paperTitle: 'Concept notebook: Decoding and Sampling',
          paperClueLabel: 'Decoding and Sampling',
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
          currentQuestion: 'Save the decoding distribution observation.',
          currentObject: {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/decoding-sampling#interactive-demo',
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
              objectKey: flashEquationObjectKey,
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
            stageReadiness: [],
            checkpoints: [
              {
                id: 'demo-prediction',
                label: 'Demo prediction',
                status: 'observed',
                detail: 'A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.',
                updatedAt: '2026-05-11T00:55:00.000Z',
              },
            ],
            nextRepair: 'Speculative Decoding',
            updatedAt: '2026-05-11T00:55:00.000Z',
          },
          lastObservation: {
            label: 'Demo prediction',
            value: 'A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.',
            detail: 'Current interactive demo state: decoding invariant preserved.',
            nextQuestion: 'Ask how top-p and temperature change the next token distribution.',
            source: 'prediction-checkpoint',
            updatedAt: '2026-05-11T00:55:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Decoding & Sampling interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText('A quantity moves: Learner predicted Entropy shape; decoding reveals Entropy shape.')
    ).toBeInTheDocument()
    expect(screen.getByText('Demo prediction')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('LLM Serving at Scale -> Decoding & Sampling interactive demo')).toBeInTheDocument()
    expect(screen.getByText('Earlier history: FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: Speculative Decoding').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Speculative Decoding' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding'
    )
  })

  it('surfaces deeper history after Speculative Decoding becomes active', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding',
          href: '/domains/llm-systems/speculative-decoding/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:speculative-decoding',
          paperTitle: 'Concept notebook: Speculative Decoding',
          paperClueLabel: 'Speculative Decoding',
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
          currentQuestion: 'What condition makes speculative decoding actually faster?',
          currentObject: {
            type: 'concept',
            id: 'speculative-decoding',
            objectKey: 'concept:llm-systems/speculative-decoding',
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
              objectKey: flashEquationObjectKey,
              title: 'FlashAttention equation 1',
              href: '/domains/attention-transformers/flash-attention/#math-object-1',
              role: 'Answer the carried question: which slider tests the memory claim?',
              status: 'resolved route history',
              sourceDetail: 'The memory slider is the direct witness.',
              confidence: 'high',
            },
          ],
        })}
      />
    )

    expect(screen.getByText('Speculative Decoding')).toBeInTheDocument()
    expect(screen.getByText('Decoding & Sampling interactive demo')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('Decoding & Sampling interactive demo -> Speculative Decoding')).toBeInTheDocument()
    expect(screen.getByText('Earlier history: LLM Serving at Scale; FlashAttention equation 1')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Opened Speculative Decoding from this comparison bridge. Earlier: LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('surfaces a Speculative Decoding prediction observation while preserving deeper history', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding',
          href: '/domains/llm-systems/speculative-decoding/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:speculative-decoding',
          paperTitle: 'Concept notebook: Speculative Decoding',
          paperClueLabel: 'Speculative Decoding',
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
          nextRepair: 'Long Context',
          currentQuestion: 'What condition makes speculative decoding actually faster?',
          currentObject: {
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:llm-systems/speculative-decoding#interactive-demo',
            title: 'Speculative Decoding interactive demo',
            href: '/domains/llm-systems/speculative-decoding/#interactive-demo',
            role: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            status: 'prediction checkpoint revealed',
            sourceDetail: 'Prediction-first speculative speedup reveal',
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
              objectKey: flashEquationObjectKey,
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
            stageReadiness: [],
            checkpoints: [
              {
                id: 'demo-prediction',
                label: 'Demo prediction',
                status: 'observed',
                detail: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
                updatedAt: '2026-05-11T01:05:00.000Z',
              },
            ],
            resolvedObjectIds: [
              'visualization/concept-notebook/llm-systems/speculative-decoding/interactive-demo',
            ],
            nextRepair: 'Long Context',
            updatedAt: '2026-05-11T01:05:00.000Z',
          },
          lastObservation: {
            label: 'Demo prediction',
            value: 'A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.',
            detail: 'Current interactive demo state: expected condition: Draft-target match.',
            nextQuestion: 'Which slider or state change in the Speculative Decoding demo would test the central claim most directly?',
            source: 'prediction-checkpoint',
            updatedAt: '2026-05-11T01:05:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Speculative Decoding interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText('A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.')
    ).toBeInTheDocument()
    expect(screen.getByText(/Prediction-first speculative speedup reveal/)).toBeInTheDocument()
    expect(screen.getByText('Demo prediction')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('Decoding & Sampling interactive demo -> Speculative Decoding interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Decode-time behavior is preserved as prior history; now test whether draft-target match creates real speedup before Long Context.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Earlier history: LLM Serving at Scale; FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: Long Context').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('surfaces a Long Context handoff while preserving the four-deep route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'long-context',
          title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          href: '/domains/attention-transformers/long-context/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:long-context',
          paperTitle: 'Concept notebook: Long Context Engineering',
          paperClueLabel: 'Long Context Engineering',
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
              objectKey: flashEquationObjectKey,
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
                updatedAt: '2026-05-12T01:10:00.000Z',
              },
            ],
            nextRepair: 'SSM Hybrids',
            updatedAt: '2026-05-12T01:10:00.000Z',
          },
          lastObservation: {
            label: 'Concept object focus',
            value: 'concept: Long Context Engineering',
            detail: 'Long Context Engineering reading-room object selected for grounded AI handoff.',
            nextQuestion: 'Which constraint should this long-context demo expose?',
            source: 'learning-route',
            updatedAt: '2026-05-12T01:10:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Long Context Engineering')).toBeInTheDocument()
    expect(screen.getByText('Speculative Decoding interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match. Earlier: Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('Speculative Decoding interactive demo -> Long Context Engineering')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Speculative speedup is preserved as prior history; now test which long-context constraint dominates before SSM Hybrids.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: SSM Hybrids').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open SSM Hybrids' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids'
    )
  })

  it('resumes a Long Context demo prediction while preserving the four-deep route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'long-context',
          title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          href: '/domains/attention-transformers/long-context/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:long-context',
          paperTitle: 'Concept notebook: Long Context Engineering',
          paperClueLabel: 'Long Context Engineering',
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
            type: 'visualization',
            id: 'interactive-demo',
            objectKey: 'demo:attention-transformers/long-context#interactive-demo',
            discussionAnchorId: 'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
            title: 'Long Context Engineering interactive demo',
            href: '/domains/attention-transformers/long-context/#interactive-demo',
            role: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
            status: 'prediction checkpoint revealed',
            sourceDetail: 'Prediction-first long-context constraint router',
          },
          sourceObjects: [
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
              objectKey: flashEquationObjectKey,
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
            stageReadiness: [],
            checkpoints: [
              {
                id: 'demo-prediction',
                label: 'Demo prediction',
                status: 'observed',
                detail: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
                updatedAt: '2026-05-12T01:20:00.000Z',
              },
            ],
            resolvedObjectIds: [
              'visualization/concept-notebook/attention-transformers/long-context/interactive-demo',
            ],
            nextRepair: 'SSM Hybrids',
            updatedAt: '2026-05-12T01:20:00.000Z',
          },
          lastObservation: {
            label: 'Demo prediction',
            value: 'A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
            detail: 'Current interactive demo state: active demo: KV Cache; prediction: KV memory; expected constraint: KV memory; constraint invariant: KV cache bytes scale with retained tokens, heads, layers, and precision.',
            nextQuestion: 'Open SSM Hybrids next, with KV cache memory preserved as the long-context constraint.',
            source: 'prediction-checkpoint',
            updatedAt: '2026-05-12T01:20:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Long Context Engineering interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText('A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.')
    ).toBeInTheDocument()
    expect(screen.getByText(/Prediction-first long-context constraint router/)).toBeInTheDocument()
    expect(screen.getByText('Demo prediction')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('Speculative Decoding interactive demo -> Long Context Engineering interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Speculative speedup is preserved as prior history; now test which long-context constraint dominates before SSM Hybrids.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: SSM Hybrids').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open SSM Hybrids' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids'
    )
  })

  it('shows SSM Hybrids as the next-repair landing from the Long Context demo observation', () => {
    render(
      <LearningRouteContinuityBanner
        surface="concept-notebook"
        compact
        activeConcept={{
          id: 'ssm-hybrids',
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          href: '/domains/attention-transformers/ssm-hybrids/',
        }}
        snapshot={longContextKvPredictionSnapshot()}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Next repair: SSM Hybrids' })
    ).toBeInTheDocument()
    expect(screen.getByText(/Arrived from Long Context Engineering interactive demo comparison bridge/)).toBeInTheDocument()
    expect(screen.getByText('Active repair')).toBeInTheDocument()
    expect(screen.getByText('SSM Hybrids: Fixed-State Sequence Models for Long Context')).toBeInTheDocument()
    expect(screen.getByText('New concept is active')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Use the Long Context KV-memory observation to predict how SSM Hybrids trades growing KV cache for fixed-state recurrence.'
      )
    ).toBeInTheDocument()
    expect(screen.queryByText(/LLM Serving comparison/)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start SSM Hybrids' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#intuition'
    )
    expect(screen.getByRole('link', { name: 'Inspect object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('resumes SSM Hybrids after activation while preserving Long Context and deeper history', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'ssm-hybrids',
          title: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          href: '/domains/attention-transformers/ssm-hybrids/',
        }}
        snapshot={longContextKvPredictionSnapshot({
          mappingId: 'concept:ssm-hybrids',
          paperTitle: 'Concept notebook: SSM Hybrids',
          paperClueLabel: 'SSM Hybrids',
          nextRepair: undefined,
          currentQuestion: 'What does fixed-state recurrence preserve that a growing KV cache stored explicitly?',
          currentObject: {
            type: 'concept',
            id: 'ssm-hybrids',
            objectKey: 'concept:attention-transformers/ssm-hybrids',
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
              title: 'Long Context Engineering interactive demo',
              href: '/domains/attention-transformers/long-context/#interactive-demo',
              role: 'Previous active repair before SSM Hybrids',
              status: 'route handoff history',
              sourceDetail: 'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory.',
              confidence: 'medium',
            },
            ...(longContextKvPredictionSnapshot().sourceObjects ?? []),
          ],
          routeProgress: {
            version: 'cf-route-progress-v1',
            stageReadiness: [
              {
                stageId: 'intuition',
                label: 'Intuition',
                status: 'ready',
                updatedAt: '2026-05-12T01:45:00.000Z',
              },
            ],
            resolvedObjectIds: [
              'concept/concept-notebook/attention-transformers/ssm-hybrids',
            ],
            updatedAt: '2026-05-12T01:45:00.000Z',
          },
          lastObservation: {
            label: 'Concept object focus',
            value: 'concept: SSM Hybrids: Fixed-State Sequence Models for Long Context',
            detail: 'SSM Hybrids reading-room object selected for grounded AI handoff.',
            nextQuestion: 'What does fixed-state recurrence preserve that a growing KV cache stored explicitly?',
            source: 'learning-route',
            updatedAt: '2026-05-12T01:45:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('SSM Hybrids: Fixed-State Sequence Models for Long Context')).toBeInTheDocument()
    expect(screen.getByText('Long Context Engineering interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: Learner predicted KV memory; KV Cache reveals KV memory. Earlier: Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(screen.getByText('Long Context Engineering interactive demo -> SSM Hybrids: Fixed-State Sequence Models for Long Context')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Long-context KV memory is preserved as prior history; now compare fixed-state recurrence against a growing KV cache.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('shows SwiGLU as the next-repair landing from the SSM demo observation', () => {
    render(
      <LearningRouteContinuityBanner
        surface="concept-notebook"
        compact
        activeConcept={{
          id: 'swiglu',
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          href: '/domains/attention-transformers/swiglu/',
        }}
        snapshot={ssmSelectiveGatePredictionSnapshot()}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Next repair: SwiGLU: Gated MLP Blocks in Transformers' })
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Arrived from SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo comparison bridge/)
    ).toBeInTheDocument()
    expect(screen.getByText('Active repair')).toBeInTheDocument()
    expect(screen.getByText('SwiGLU: Gated MLP Blocks in Transformers')).toBeInTheDocument()
    expect(screen.getByText('New concept is active')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Use the SSM selective-gate observation to predict how SwiGLU: Gated MLP Blocks in Transformers gates token-local MLP writes after sequence memory.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Start SwiGLU: Gated MLP Blocks in Transformers' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#intuition'
    )
    expect(screen.getByRole('link', { name: 'Inspect object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
  })

  it('resumes SwiGLU after activation while preserving SSM and the deeper route stack', () => {
    const ssmSnapshot = ssmSelectiveGatePredictionSnapshot()
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'swiglu',
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          href: '/domains/attention-transformers/swiglu/',
        }}
        snapshot={ssmSelectiveGatePredictionSnapshot({
          mappingId: 'concept:swiglu',
          paperTitle: 'Concept notebook: SwiGLU',
          paperClueLabel: 'SwiGLU',
          nextRepair: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          currentQuestion: 'How does the SiLU gate decide whether a token-local MLP write is suppressed, passed, or amplified?',
          routeLabels: [
            ...(ssmSnapshot.routeLabels ?? []),
            'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          ],
          routeConceptIds: [
            ...(ssmSnapshot.routeConceptIds ?? []),
            'mixture-of-experts',
          ],
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
              sourceDetail:
                'Demo prediction: A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup.',
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
        })}
      />
    )

    expect(screen.getByText('SwiGLU: Gated MLP Blocks in Transformers')).toBeInTheDocument()
    expect(screen.getByText('SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup. Earlier: Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(
      screen.getByText(
        'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo -> SwiGLU: Gated MLP Blocks in Transformers'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Selective recurrent memory is preserved as prior history; now test token-local gated writes before Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Speculative Decoding interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts'
    )
  })

  it('resumes a SwiGLU demo prediction while preserving SSM and the deeper route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'swiglu',
          title: 'SwiGLU: Gated MLP Blocks in Transformers',
          href: '/domains/attention-transformers/swiglu/',
        }}
        snapshot={swigluGatedMlpPredictionSnapshot()}
      />
    )

    expect(screen.getByText('SwiGLU: Gated MLP Blocks in Transformers interactive demo')).toBeInTheDocument()
    expect(screen.getByText('visualization · prediction checkpoint revealed · SwiGLU gated-MLP prediction')).toBeInTheDocument()
    expect(
      screen.getByText(
        'SwiGLU gated-MLP prediction: Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: selective-gate toy outcome for Marked span in the middle under Balanced; recurrence is compressed memory, not exact lookup. Earlier: Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(
      screen.getByText(
        'SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo -> SwiGLU: Gated MLP Blocks in Transformers interactive demo'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Selective recurrent memory is preserved as prior history; now test token-local gated writes before Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Speculative Decoding interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Decoding & Sampling interactive demo' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/decoding-sampling#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: LLM Serving at Scale' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts'
    )
  })

  it('lands on Mixture of Experts from the saved SwiGLU demo prediction without overwriting the route', () => {
    render(
      <LearningRouteContinuityBanner
        surface="concept-notebook"
        compact
        activeConcept={{
          id: 'mixture-of-experts',
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          href: '/domains/efficiency/mixture-of-experts/',
        }}
        snapshot={swigluGatedMlpPredictionSnapshot()}
      />
    )

    expect(screen.getByText('Next repair: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism')).toBeInTheDocument()
    expect(screen.getByText('Active repair')).toBeInTheDocument()
    expect(screen.getByText('New concept is active')).toBeInTheDocument()
    expect(
      screen.getByText(/Use the SwiGLU gate\/product observation to predict how Sparse Mixture of Experts/)
    ).toBeInTheDocument()
    const startLink = screen.getByRole('link', {
      name: 'Start Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
    })
    expect(startLink.getAttribute('href')).toContain('/domains/efficiency/mixture-of-experts')
    expect(startLink.getAttribute('href')).toContain('#intuition')
    expect(screen.getByRole('link', { name: 'Inspect object' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
  })

  it('resumes a Mixture of Experts activation while preserving SwiGLU and the deeper route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'mixture-of-experts',
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          href: '/domains/efficiency/mixture-of-experts/',
        }}
        snapshot={mixtureOfExpertsActivationSnapshot()}
      />
    )

    expect(screen.getByText('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism')).toBeInTheDocument()
    expect(screen.getByText('concept · selected in concept room')).toBeInTheDocument()
    expect(screen.getByText('SwiGLU: Gated MLP Blocks in Transformers interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: SwiGLU gated-MLP prediction: Token A channel 1 was suppressed: product -0.309 after SiLU gate -0.276. Earlier: SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Dense token-local gating is preserved as prior history; now test sparse expert routing before MoE Serving: Expert Parallelism in Production.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText('Earlier history: SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Long Context Engineering interactive demo' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Open MoE Serving: Expert Parallelism in Production' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving'
    )
  })

  it('resumes a Mixture of Experts capacity prediction while preserving SwiGLU and the deeper route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'mixture-of-experts',
          title: 'Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism',
          href: '/domains/efficiency/mixture-of-experts/',
        }}
        snapshot={mixtureOfExpertsCapacityPredictionSnapshot()}
      />
    )

    expect(screen.getByText('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo')).toBeInTheDocument()
    expect(screen.getByText('visualization · prediction checkpoint revealed · MoE capacity drop reveal')).toBeInTheDocument()
    expect(
      screen.getByText(
        'MoE capacity drop reveal: Learner predicted Overloaded expert drops/overflows assignments; revealed capacity overflow with 3 overflowed token-expert assignments.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('SwiGLU: Gated MLP Blocks in Transformers interactive demo')).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Dense token-local gating is preserved as prior history; now test sparse expert routing before MoE Serving: Expert Parallelism in Production.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Long Context Engineering interactive demo' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open MoE Serving: Expert Parallelism in Production' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving'
    )
  })

  it('resumes MoE Serving activation while preserving the MoE capacity checkpoint and deeper route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'moe-serving',
          title: 'MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism',
          href: '/domains/llm-systems/moe-serving/',
        }}
        snapshot={moeServingActivationSnapshot()}
      />
    )

    expect(screen.getByText('MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism')).toBeInTheDocument()
    expect(screen.getByText('concept · selected in concept room')).toBeInTheDocument()
    expect(screen.getByText('Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        /Demo prediction: .*capacity overflow.*Earlier: SwiGLU: Gated MLP Blocks in Transformers interactive demo; SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1\./
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Capacity overflow is preserved as prior history; now test token dispatch and expert scheduling before Speculative Decoding.'
      )
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/swiglu#interactive-demo'
    )
    expect(screen.getByRole('link', { name: /Inspect deeper history: SSM Hybrids/ })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/ssm-hybrids#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Speculative Decoding' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding'
    )
  })

  it('resumes Speculative Decoding activation from the saved MoE Serving bottleneck route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          href: '/domains/llm-systems/speculative-decoding/',
        }}
        snapshot={speculativeActivationFromMoeServingSnapshot()}
      />
    )

    expect(screen.getByText('Speculative Decoding: Lossless Multi-Token Generation')).toBeInTheDocument()
    expect(screen.getByText('concept · selected in concept room')).toBeInTheDocument()
    expect(screen.getByText('MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: 2048 tokens, E=16, top-k=2, hot routing: winner Hot expert straggler, max/mean load 5.83x, communication 64.0 MiB. Earlier: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo; SwiGLU: Gated MLP Blocks in Transformers interactive demo; SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'MoE serving bottleneck is preserved as prior history; now test draft-target verification before Long Context Engineering.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Earlier history: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo; SwiGLU: Gated MLP Blocks in Transformers interactive demo; SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: Long Context Engineering').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Long Context Engineering' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context'
    )
  })

  it('resumes a Speculative Decoding draft-target checkpoint from the MoE Serving route stack', () => {
    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'speculative-decoding',
          title: 'Speculative Decoding: Lossless Multi-Token Generation',
          href: '/domains/llm-systems/speculative-decoding/',
        }}
        snapshot={speculativeDraftTargetPredictionFromMoeServingSnapshot()}
      />
    )

    expect(screen.getByText('Speculative Decoding: Lossless Multi-Token Generation interactive demo')).toBeInTheDocument()
    expect(screen.getByText('visualization · prediction checkpoint revealed · Prediction-first speculative speedup reveal')).toBeInTheDocument()
    expect(
      screen.getByText('A quantity moves: Learner predicted Draft-target match; speculation reveals Draft-target match.')
    ).toBeInTheDocument()
    expect(screen.getByText('Demo prediction')).toBeInTheDocument()
    expect(screen.getByText('MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Demo prediction: A quantity moves: 2048 tokens, E=16, top-k=2, hot routing: winner Hot expert straggler, max/mean load 5.83x, communication 64.0 MiB. Earlier: Sparse Mixture of Experts: Routing, Load Balancing & Expert Parallelism interactive demo; SwiGLU: Gated MLP Blocks in Transformers interactive demo; SSM Hybrids: Fixed-State Sequence Models for Long Context interactive demo; Long Context Engineering interactive demo; Speculative Decoding interactive demo; Decoding & Sampling interactive demo; LLM Serving at Scale; FlashAttention equation 1.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Activation bridge')).toBeInTheDocument()
    expect(
      screen.getByText(
        /MoE Serving & Scheduling: Token Dispatch, All-to-All, Disaggregated Parallelism interactive demo -> Speculative Decoding.*interactive demo/
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'MoE serving bottleneck is preserved as prior history; now test draft-target verification before Long Context Engineering.'
      )
    ).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: Long Context Engineering').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/speculative-decoding#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect history' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/moe-serving#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect earlier history' })).toHaveAttribute(
      'href',
      '/domains/efficiency/mixture-of-experts#interactive-demo'
    )
    expect(screen.getByRole('link', { name: 'Inspect deeper history: FlashAttention equation 1' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/flash-attention#math-object-1'
    )
    expect(screen.getByRole('link', { name: 'Open Long Context Engineering' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context'
    )
  })

  it('routes Long Context next repair to SSM Hybrids instead of older Long Context history', () => {
    const speculativeSnapshot = speculativeDraftTargetPredictionFromMoeServingSnapshot()

    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        activeConcept={{
          id: 'long-context',
          title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
          href: '/domains/attention-transformers/long-context/',
        }}
        snapshot={attentionServingSnapshot({
          ...speculativeSnapshot,
          mappingId: 'concept:long-context',
          paperTitle: 'Concept notebook: Long Context Engineering',
          paperClueLabel: 'Long Context Engineering',
          nextRepair: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
          currentQuestion: 'Which constraint should this long-context demo expose?',
          currentObject: {
            type: 'concept',
            id: 'long-context',
            objectKey: 'concept:attention-transformers/long-context',
            discussionAnchorId: 'concept/concept-notebook/attention-transformers/long-context',
            title: 'Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization',
            href: '/domains/attention-transformers/long-context/#intuition',
            role: 'Use the selected object to compare speculative speedup with context-memory pressure.',
            status: 'selected in concept room',
          },
          sourceObjects: [
            {
              ...speculativeSnapshot.currentObject!,
              role: 'Previous active repair before Long Context',
              status: 'route handoff history',
              sourceDetail: `Demo prediction: ${speculativeSnapshot.lastObservation!.value}`,
              confidence: 'medium',
            },
            ...(speculativeSnapshot.sourceObjects ?? []),
          ],
          routeConcepts: [
            ...(speculativeSnapshot.routeConcepts ?? []),
            {
              label: 'SSM Hybrids',
              href: '/domains/attention-transformers/ssm-hybrids/',
              role: 'next repair',
            },
          ],
          routeProgress: {
            version: 'cf-route-progress-v1',
            stageReadiness: [
              {
                stageId: 'intuition',
                label: 'Intuition',
                status: 'ready',
                updatedAt: '2026-05-12T06:40:00.000Z',
              },
            ],
            resolvedObjectIds: ['concept/concept-notebook/attention-transformers/long-context'],
            nextRepair: 'SSM Hybrids: Fixed-State Sequence Models for Long Context',
            updatedAt: '2026-05-12T06:40:00.000Z',
          },
          lastObservation: {
            label: 'Concept object focus',
            value: 'concept: Long Context Engineering',
            detail: 'Long Context Engineering reading-room object selected for grounded AI handoff.',
            nextQuestion: 'Which constraint should this long-context demo expose?',
            source: 'learning-route',
            updatedAt: '2026-05-12T06:40:00.000Z',
          },
        })}
      />
    )

    expect(screen.getByText('Speculative Decoding: Lossless Multi-Token Generation interactive demo')).toBeInTheDocument()
    expect(screen.getByText('Long Context Engineering: RoPE Scaling, KV Compression & Memory Optimization')).toBeInTheDocument()
    expect(screen.getAllByText('Next repair: SSM Hybrids: Fixed-State Sequence Models for Long Context').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Inspect deeper history: Long Context Engineering interactive demo' })).toHaveAttribute(
      'href',
      '/domains/attention-transformers/long-context#interactive-demo'
    )
    expect(screen.queryByRole('link', { name: 'Inspect deeper history: Speculative Decoding interactive demo' })).toBeNull()
    expect(
      screen.getByRole('link', { name: 'Open SSM Hybrids: Fixed-State Sequence Models for Long Context' })
    ).toHaveAttribute('href', '/domains/attention-transformers/ssm-hybrids')
  })

  it('shows a return path when the learner is inspecting route history', () => {
    render(
      <LearningRouteContinuityBanner
        surface="concept-notebook"
        compact
        activeConcept={{
          id: 'flash-attention',
          title: 'FlashAttention',
          href: '/domains/attention-transformers/flash-attention/',
        }}
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:llm-serving',
          paperTitle: 'Concept notebook: LLM Serving',
          paperClueLabel: 'LLM Serving',
          routeLabels: ['FlashAttention', 'LLM Serving', 'Decoding'],
          routeConceptIds: ['flash-attention', 'llm-serving', 'decoding-sampling'],
          nextRepair: 'Decoding and Sampling',
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
              objectKey: flashEquationObjectKey,
              title: 'FlashAttention equation 1',
              href: '/domains/attention-transformers/flash-attention/#math-object-1',
              role: 'Answer the carried question: which slider tests the memory claim?',
              status: 'resolved route history',
              sourceDetail: 'The memory slider is the direct witness.',
              confidence: 'high',
            },
          ],
        })}
      />
    )

    expect(screen.getByRole('heading', { name: 'Inspecting history: FlashAttention' })).toBeInTheDocument()
    expect(screen.getByText(/Active repair remains LLM Serving at Scale/)).toBeInTheDocument()
    expect(screen.getByText('Inspecting history')).toBeInTheDocument()
    expect(screen.getByText('FlashAttention equation 1')).toBeInTheDocument()
    expect(screen.getByText('Active repair')).toBeInTheDocument()
    expect(screen.getByText('LLM Serving at Scale')).toBeInTheDocument()
    expect(screen.getByText('Return path preserved')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Return to active repair' })).toHaveAttribute(
      'href',
      '/domains/llm-systems/llm-serving'
    )
    expect(screen.queryByRole('link', { name: 'Inspect history' })).not.toBeInTheDocument()
  })

  it('does not leak a saved action from another object into the public cockpit', () => {
    saveLocalObjectActionDraft({
      version: 'cf-object-action-draft-v1',
      objectKey: 'equation:attention-transformers/flash-attention#math-object-2',
      objectTitle: 'FlashAttention equation 2',
      note: 'Wrong equation draft.',
      nextAction: 'Inspect the other equation.',
      updatedAt: '2026-05-11T00:00:00.000Z',
      source: 'research-reading-room',
    })

    render(
      <LearningRouteContinuityBanner
        surface="home"
        compact
        snapshot={attentionServingSnapshot({
          source: 'concept-notebook',
          mappingId: 'concept:flash-attention',
          labStatus: undefined,
          currentObject: {
            type: 'equation',
            id: 'equation-1',
            objectKey: flashEquationObjectKey,
            title: 'FlashAttention equation 1',
            href: '/domains/attention-transformers/flash-attention/#math-object-1',
            status: 'prediction checkpoint revealed',
          },
        })}
      />
    )

    expect(screen.queryByText('Saved object action')).not.toBeInTheDocument()
    expect(screen.queryByText('Inspect the other equation.')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Resume concept object' })).toBeInTheDocument()
  })
})
