import { useMemo, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import {
  saveLearningRouteSnapshot,
  type LearningRouteSnapshot,
  type LearningRouteSourceObject,
} from '@/lib/learningRouteSnapshot'
import { kvMemoryEquation, kvMemoryQuestion, normalizeLearningRoutePathId } from '@/lib/learningRouteConstants'
import {
  PAPER_MAPPER_CONTRACT_VERSION,
  type PaperEquationObject,
  type PaperPdfUpload,
  buildPaperIngestionPreview,
  buildLocalEquationObjects,
  buildPaperMapperGatewayRequest,
} from '@/lib/paperIngestion'
import ResearchReadingRoom from '@/components/discussion/ResearchReadingRoom'
import LivingNotebookLabShell, {
  type LivingNotebookLabAction,
  type LivingNotebookLabStep,
} from './LivingNotebookLabShell'
import {
  buildDiscussionAnchor,
  buildDiscussionPlaceholder,
  type DiscussionAnchorListItem,
} from '@/lib/discussionAnchors'
import { routeSourceObjectFromDiscussionItem } from '@/lib/researchDiscussionRoom'
import ObservationLedgerCard from './ObservationLedgerCard'
import { useSavedLearningRouteSnapshot } from './useSavedLearningRouteSnapshot'

type ConceptLink = {
  label: string
  href: string
  role: string
}

type EquationCard = {
  id: string
  label: string
  equation: string
  explanation: string
  sourceIds: string[]
  confidence: 'high' | 'medium'
}

type SourceEvidence = {
  id: string
  label: string
  kind: 'user input' | 'concept page' | 'planned ingestion'
  signal: string
  href?: string
}

type ClaimEvidence = {
  id: string
  claim: string
  confidence: 'high' | 'medium'
  sourceIds: string[]
}

type Mapping = {
  id: string
  sample: string
  triggers: string[]
  title: string
  contribution: string
  novelty: string
  confidence: string
  sources: SourceEvidence[]
  claims: ClaimEvidence[]
  concepts: ConceptLink[]
  readFirst: string[]
  nextRepair: {
    label: string
    href?: string
  }
  equations: EquationCard[]
  labSpec: string
  lab: {
    label: string
    status: 'live' | 'planned'
    href?: string
  }
  currentQuestion: string
  discussion: string[]
}

type GatewayState = 'idle' | 'loading' | 'local' | 'success' | 'error'

type GatewaySummary = {
  title?: string
  status: string
  detail: string
}

type PaperLensRole = 'Learner' | 'Researcher' | 'Experimenter' | 'Professor'

type PaperLensObject = {
  id: string
  typeLabel: string
  title: string
  detail: string
  evidence: string
  nextMove: string
  href?: string
  actionLabel: string
  discussionAnchorId?: string
  routeObject: LearningRouteSourceObject
}

type RouteSaveStatus = 'idle' | 'saved-with-prior' | 'saved-new' | 'saved-invariant'

type PaperPredictionOption = {
  id: string
  label: string
  claim: string
  evidence: string
  invariant: string
  nextMove: string
  accent: string
}

const paperMapperGatewayUrl = process.env.NEXT_PUBLIC_CF_PAPER_MAPPER_GATEWAY_URL?.trim() ?? ''
const maxClientPdfBytes = 6 * 1024 * 1024

const mappings: Mapping[] = [
  {
    id: 'kv-cache',
    sample: [
      'https://arxiv.org/abs/2405.12345 KV cache compression for long-context LLM serving',
      `[page 3] ${kvMemoryEquation}`,
      '[page 4] softmax(QK^T / sqrt(d_k))V = weighted value copy',
      '[page 3] We reduce KV cache memory for long-context LLM serving by sharing or compressing value states.',
    ].join('\n'),
    triggers: ['kv', 'cache', 'long context', 'serving', 'gqa', 'mqa', 'flashattention', 'memory', 'inference'],
    title: 'KV Cache Compression / Long-Context Serving',
    contribution: 'The paper is probably about reducing decode-time memory while preserving enough token retrieval quality.',
    novelty: 'The central question is what information can be dropped, shared, quantized, or recomputed without breaking downstream attention.',
    confidence: 'High for serving papers that mention KV cache, long context, GQA, MQA, memory, or inference.',
    sources: [
      { id: 'input', label: 'User supplied paper clue', kind: 'user input', signal: 'KV cache, long-context, serving, memory, inference terms in the pasted text.' },
      { id: 'attention', label: 'Continuous Function: Attention', kind: 'concept page', signal: 'Defines the Q/K/V weighted-copy mechanism.', href: '/domains/attention-transformers/attention-transformers/' },
      { id: 'efficient-attention', label: 'Continuous Function: Efficient Attention', kind: 'concept page', signal: 'Connects attention to cache and memory movement.', href: '/domains/attention-transformers/efficient-attention/' },
      { id: 'llm-serving', label: 'Continuous Function: LLM Serving', kind: 'concept page', signal: 'Frames prefill/decode and runtime bottlenecks.', href: '/domains/llm-systems/llm-serving/' },
      { id: 'external-paper', label: 'External paper metadata', kind: 'planned ingestion', signal: 'arXiv/OpenAlex/Semantic Scholar lookup should verify title, authors, date, and equations.' },
    ],
    claims: [
      { id: 'decode-memory-first', claim: 'The map should inspect decode-time KV memory before architectural novelty.', confidence: 'high', sourceIds: ['input', 'efficient-attention', 'llm-serving'] },
      { id: 'attention-equation-grounding', claim: 'The core equation to ground is attention over available keys and values.', confidence: 'high', sourceIds: ['attention', 'efficient-attention'] },
      { id: 'external-metadata-pending', claim: 'External author/date/venue claims are intentionally withheld until live ingestion is connected.', confidence: 'medium', sourceIds: ['external-paper'] },
    ],
    concepts: [
      { label: 'Attention', href: '/domains/attention-transformers/attention-transformers/', role: 'core equation' },
      { label: 'Efficient Attention', href: '/domains/attention-transformers/efficient-attention/', role: 'memory mechanism' },
      { label: 'RoPE', href: '/domains/attention-transformers/rope/', role: 'position behavior' },
      { label: 'Long Context', href: '/domains/attention-transformers/long-context/', role: 'failure pressure' },
      { label: 'LLM Serving', href: '/domains/llm-systems/llm-serving/', role: 'systems consequence' },
      { label: 'Decoding', href: '/domains/llm-systems/decoding-sampling/', role: 'runtime loop' },
    ],
    readFirst: ['Scaled dot-product attention', 'KV cache memory growth', 'GQA/MQA head sharing', 'prefill vs decode latency'],
    nextRepair: { label: 'Efficient Attention', href: '/domains/attention-transformers/efficient-attention/' },
    equations: [
      {
        id: 'kv-memory',
        label: 'KV memory',
        equation: kvMemoryEquation,
        explanation: 'Memory grows linearly with batch size, layers, cached tokens, KV heads, head dimension, and numerical precision.',
        sourceIds: ['efficient-attention', 'llm-serving'],
        confidence: 'high',
      },
      {
        id: 'attention',
        label: 'Attention',
        equation: 'softmax(QK^T / sqrt(d_k))V',
        explanation: 'Compression changes what keys and values are available to the weighted copy operation.',
        sourceIds: ['attention'],
        confidence: 'high',
      },
    ],
    labSpec: 'Compare MHA, MQA, and GQA memory while sweeping context length from 4k to 128k tokens.',
    lab: {
      label: 'KV memory lab',
      status: 'live',
      href: '/paths/attention-serving/?focus=kv-cache&from=paper-map#serving-module',
    },
    currentQuestion: kvMemoryQuestion,
    discussion: [
      'Which tokens or heads can be compressed without hurting retrieval?',
      'Is the bottleneck capacity, bandwidth, latency, or attention quality?',
      'Does the method change the model math or only the serving schedule?',
    ],
  },
  {
    id: 'mamba-ssm',
    sample: 'Mamba-2 and state-space duality for long sequence modeling',
    triggers: ['mamba', 'state space', 'state-space', 'ssm', 'selective', 'recurrence', 'scan', 'duality'],
    title: 'State-Space / Mamba-Style Sequence Models',
    contribution: 'The paper is probably explaining how fixed-state recurrence can compete with attention on long sequences.',
    novelty: 'The key move is replacing an explicit KV memory with a compressed recurrent state and parallel scan computation.',
    confidence: 'High when the text mentions Mamba, SSMs, selectivity, recurrence, scan, or state-space duality.',
    sources: [
      { id: 'input', label: 'User supplied paper clue', kind: 'user input', signal: 'Mamba, SSM, recurrence, scan, and state-space terms in the pasted text.' },
      { id: 'long-context', label: 'Continuous Function: Long Context', kind: 'concept page', signal: 'Explains the pressure that fixed-state models try to relieve.', href: '/domains/attention-transformers/long-context/' },
      { id: 'efficient-attention', label: 'Continuous Function: Efficient Attention', kind: 'concept page', signal: 'Provides the attention-memory contrast class.', href: '/domains/attention-transformers/efficient-attention/' },
      { id: 'linear-transformations', label: 'Continuous Function: Linear Transformations', kind: 'concept page', signal: 'Supplies the state-update language.', href: '/domains/linear-algebra/linear-transformations/' },
      { id: 'external-paper', label: 'External paper metadata', kind: 'planned ingestion', signal: 'Live ingestion should verify the exact SSM equations and paper contribution.' },
    ],
    claims: [
      { id: 'long-context-before-duality', claim: 'The route should start from long-context memory pressure before jumping into state-space duality.', confidence: 'high', sourceIds: ['input', 'long-context', 'efficient-attention'] },
      { id: 'state-update-linear-algebra', claim: 'State-update equations need a linear-transformations repair for many learners.', confidence: 'high', sourceIds: ['linear-transformations'] },
      { id: 'mamba-novelty-source-check', claim: 'Specific Mamba-2 novelty should be source-checked before being stated as fact.', confidence: 'medium', sourceIds: ['external-paper'] },
    ],
    concepts: [
      { label: 'Long Context', href: '/domains/attention-transformers/long-context/', role: 'pressure' },
      { label: 'Attention', href: '/domains/attention-transformers/attention-transformers/', role: 'contrast class' },
      { label: 'Efficient Attention', href: '/domains/attention-transformers/efficient-attention/', role: 'systems contrast' },
      { label: 'Linear Transformations', href: '/domains/linear-algebra/linear-transformations/', role: 'state updates' },
      { label: 'Derivatives', href: '/domains/calculus/derivatives/', role: 'training lens' },
    ],
    readFirst: ['linear recurrences', 'convolution vs recurrence', 'parallel scan', 'attention memory growth'],
    nextRepair: { label: 'Long Context', href: '/domains/attention-transformers/long-context/' },
    equations: [
      {
        id: 'state-update',
        label: 'State update',
        equation: 'h_t = A(x_t) h_{t-1} + B(x_t) x_t',
        explanation: 'A selective SSM lets the input change how the recurrent state is updated.',
        sourceIds: ['linear-transformations', 'external-paper'],
        confidence: 'medium',
      },
      {
        id: 'output-map',
        label: 'Output map',
        equation: 'y_t = C(x_t) h_t',
        explanation: 'The hidden state acts as compressed memory that is read back into the token representation.',
        sourceIds: ['linear-transformations', 'external-paper'],
        confidence: 'medium',
      },
    ],
    labSpec: 'Visualize exponential decay, selective gates, and attention-like retrieval on a synthetic copy task.',
    lab: { label: 'SSM retrieval lab', status: 'planned' },
    currentQuestion: 'What information is irreversibly lost when a fixed-size state replaces explicit KV memory?',
    discussion: [
      'When is Mamba better understood as recurrence, attention, or control theory?',
      'What information is irreversibly lost in a fixed-size state?',
      'Where do hybrids beat pure attention or pure recurrence?',
    ],
  },
  {
    id: 'preference-optimization',
    sample: 'DPO, RLHF, or preference optimization for aligning language models',
    triggers: ['dpo', 'rlhf', 'preference', 'alignment', 'reward', 'kl', 'kto', 'human feedback'],
    title: 'Preference Optimization / Alignment',
    contribution: 'The paper is probably about shaping a policy toward preferred outputs while staying close to a reference model.',
    novelty: 'The important distinction is whether preferences train a reward model, directly train relative log odds, or use binary desirable/undesirable labels.',
    confidence: 'High when the text mentions DPO, RLHF, reward models, KL regularization, KTO, or preference data.',
    sources: [
      { id: 'input', label: 'User supplied paper clue', kind: 'user input', signal: 'Preference optimization, DPO, RLHF, reward, KL, or human-feedback terms.' },
      { id: 'rlhf', label: 'Continuous Function: RLHF', kind: 'concept page', signal: 'Covers reward-model and KL-anchored policy shaping.', href: '/domains/alignment/rlhf/' },
      { id: 'dpo', label: 'Continuous Function: DPO', kind: 'concept page', signal: 'Covers direct preference optimization and log-odds framing.', href: '/domains/alignment/dpo/' },
      { id: 'kl-divergence', label: 'Continuous Function: KL Divergence', kind: 'concept page', signal: 'Provides the reference-distribution math.', href: '/domains/information-theory/kl-divergence/' },
      { id: 'external-paper', label: 'External paper metadata', kind: 'planned ingestion', signal: 'Live ingestion should verify the exact preference loss and dataset claims.' },
    ],
    claims: [
      { id: 'kl-reference-repair', claim: 'The prerequisite repair is distribution comparison, especially KL to a reference model.', confidence: 'high', sourceIds: ['kl-divergence', 'rlhf'] },
      { id: 'reference-relative-preference-shaping', claim: 'DPO should be read as reference-relative preference shaping rather than generic supervised fine-tuning.', confidence: 'high', sourceIds: ['dpo', 'kl-divergence'] },
      { id: 'benchmarks-need-external-verification', claim: 'Dataset, benchmark, and win-rate claims need external paper verification.', confidence: 'medium', sourceIds: ['external-paper'] },
    ],
    concepts: [
      { label: 'RLHF', href: '/domains/alignment/rlhf/', role: 'reward route' },
      { label: 'DPO', href: '/domains/alignment/dpo/', role: 'direct route' },
      { label: 'KTO', href: '/domains/alignment/kto/', role: 'binary feedback' },
      { label: 'KL Divergence', href: '/domains/information-theory/kl-divergence/', role: 'anchor' },
      { label: 'Reward Hacking', href: '/domains/alignment/reward-hacking/', role: 'failure mode' },
    ],
    readFirst: ['cross-entropy', 'KL direction', 'reference policy', 'Bradley-Terry preference model'],
    nextRepair: { label: 'KL Divergence', href: '/domains/information-theory/kl-divergence/' },
    equations: [
      {
        id: 'kl-regularized-objective',
        label: 'KL-regularized objective',
        equation: 'E[r(x,y)] - beta KL(pi || pi_ref)',
        explanation: 'Alignment methods often trade preference reward against distance from a reference model.',
        sourceIds: ['rlhf', 'kl-divergence'],
        confidence: 'high',
      },
      {
        id: 'dpo-log-odds',
        label: 'DPO log odds',
        equation: 'log pi(y_w|x)/pi_ref(y_w|x) - log pi(y_l|x)/pi_ref(y_l|x)',
        explanation: 'DPO trains the preferred output to gain reference-relative log odds over the rejected output.',
        sourceIds: ['dpo', 'kl-divergence'],
        confidence: 'high',
      },
    ],
    labSpec: 'Compare RLHF-style probability shaping, DPO pair updates, and reward hacking under a noisy proxy.',
    lab: { label: 'preference shaping lab', status: 'planned' },
    currentQuestion: 'Which preference assumptions are hidden in the loss?',
    discussion: [
      'Which preference assumptions are hidden in the loss?',
      'When does KL anchoring preserve capability versus block useful change?',
      'How can a proxy reward select outputs humans did not actually want?',
    ],
  },
  {
    id: 'diffusion-flow',
    sample: 'Diffusion, score matching, or flow matching for generative modeling',
    triggers: ['diffusion', 'score', 'flow matching', 'normalizing flow', 'denoising', 'sde', 'ode'],
    title: 'Generative Dynamics / Diffusion and Flow',
    contribution: 'The paper is probably about learning a vector field that moves noise toward data or computes likelihood through an invertible path.',
    novelty: 'The main question is whether the model learns scores, velocities, invertible maps, or a simulation schedule.',
    confidence: 'High when the text mentions diffusion, score matching, flow matching, denoising, SDEs, ODEs, or normalizing flows.',
    sources: [
      { id: 'input', label: 'User supplied paper clue', kind: 'user input', signal: 'Diffusion, score, flow, denoising, SDE, ODE, or normalizing-flow terms.' },
      { id: 'diffusion', label: 'Continuous Function: Diffusion', kind: 'concept page', signal: 'Frames denoising and sampling dynamics.', href: '/domains/generative-models/diffusion/' },
      { id: 'score-matching', label: 'Continuous Function: Score Matching', kind: 'concept page', signal: 'Provides score-field target language.', href: '/domains/generative-models/score-matching/' },
      { id: 'flow-matching', label: 'Continuous Function: Flow Matching', kind: 'concept page', signal: 'Provides velocity-field target language.', href: '/domains/generative-models/flow-matching/' },
      { id: 'external-paper', label: 'External paper metadata', kind: 'planned ingestion', signal: 'Live ingestion should verify whether the paper claims score, velocity, ODE, SDE, or likelihood novelty.' },
    ],
    claims: [
      { id: 'score-vs-velocity-targets', claim: 'The map should distinguish score targets from velocity targets.', confidence: 'high', sourceIds: ['score-matching', 'flow-matching'] },
      { id: 'sampling-likelihood-needs-source', claim: 'Sampling-step and likelihood claims need the external paper before being treated as verified.', confidence: 'medium', sourceIds: ['external-paper'] },
      { id: 'particle-motion-lab', claim: 'The toy lab should show particle motion, not just static density pictures.', confidence: 'high', sourceIds: ['diffusion', 'flow-matching'] },
    ],
    concepts: [
      { label: 'Diffusion', href: '/domains/generative-models/diffusion/', role: 'denoising process' },
      { label: 'Score Matching', href: '/domains/generative-models/score-matching/', role: 'field target' },
      { label: 'Flow Matching', href: '/domains/generative-models/flow-matching/', role: 'velocity target' },
      { label: 'Normalizing Flows', href: '/domains/generative-models/normalizing-flows/', role: 'invertible density' },
      { label: 'KL Divergence', href: '/domains/information-theory/kl-divergence/', role: 'distribution gap' },
    ],
    readFirst: ['random variables', 'distributions', 'change of variables', 'score as gradient of log density'],
    nextRepair: { label: 'Score Matching', href: '/domains/generative-models/score-matching/' },
    equations: [
      {
        id: 'score',
        label: 'Score',
        equation: 's_theta(x,t) approx grad_x log p_t(x)',
        explanation: 'The score points in the direction that increases log density under a noisy distribution.',
        sourceIds: ['score-matching'],
        confidence: 'high',
      },
      {
        id: 'flow',
        label: 'Flow',
        equation: 'dx_t / dt = v_theta(x_t,t)',
        explanation: 'A learned velocity field transports samples through time.',
        sourceIds: ['flow-matching'],
        confidence: 'high',
      },
    ],
    labSpec: 'Show particles moving from Gaussian noise to two clusters under score and flow fields.',
    lab: { label: 'score or flow field lab', status: 'planned' },
    currentQuestion: 'Is the method learning a score, a velocity, or an invertible density transform?',
    discussion: [
      'Is the method learning a score, a velocity, or an invertible density transform?',
      'What changes when sampling steps are reduced?',
      'Which parts are probability identities and which parts are modeling choices?',
    ],
  },
  {
    id: 'muon-optimization',
    sample: 'Muon optimizer, AdamW comparison, or Newton-Schulz orthogonalization',
    triggers: ['muon', 'optimizer', 'adamw', 'newton-schulz', 'orthogonal', 'optimization', 'momentum'],
    title: 'Optimizer Geometry / Muon and AdamW',
    contribution: 'The paper is probably about changing the geometry of parameter updates rather than just changing the learning-rate schedule.',
    novelty: 'The useful question is what the optimizer preserves, normalizes, or orthogonalizes before applying an update.',
    confidence: 'Medium to high when the text mentions Muon, AdamW, Newton-Schulz, orthogonalization, or optimizer geometry.',
    sources: [
      { id: 'input', label: 'User supplied paper clue', kind: 'user input', signal: 'Muon, AdamW, Newton-Schulz, orthogonalization, optimizer, or momentum terms.' },
      { id: 'gradient-descent', label: 'Continuous Function: Gradient Descent', kind: 'concept page', signal: 'Provides the base update rule.', href: '/domains/optimization/gradient-descent/' },
      { id: 'adam', label: 'Continuous Function: Adam', kind: 'concept page', signal: 'Provides the adaptive optimizer baseline.', href: '/domains/optimization/adam/' },
      { id: 'linear-transformations', label: 'Continuous Function: Linear Transformations', kind: 'concept page', signal: 'Supports the matrix-shaped update view.', href: '/domains/linear-algebra/linear-transformations/' },
      { id: 'external-paper', label: 'External paper metadata', kind: 'planned ingestion', signal: 'Live ingestion should verify Muon-specific equations and empirical claims.' },
    ],
    claims: [
      { id: 'base-update-before-comparison', claim: 'The first repair is the base update rule before optimizer comparison.', confidence: 'high', sourceIds: ['gradient-descent', 'adam'] },
      { id: 'matrix-update-geometry', claim: 'Matrix update geometry needs linear-algebra grounding.', confidence: 'high', sourceIds: ['linear-transformations'] },
      { id: 'speedup-benchmarks-pending', claim: 'Speedup or benchmark claims should stay unverified until external ingestion is connected.', confidence: 'medium', sourceIds: ['external-paper'] },
    ],
    concepts: [
      { label: 'Gradient Descent', href: '/domains/optimization/gradient-descent/', role: 'base update' },
      { label: 'Adam', href: '/domains/optimization/adam/', role: 'adaptive baseline' },
      { label: 'Weight Decay AdamW', href: '/domains/optimization/weight-decay-adamw/', role: 'regularized baseline' },
      { label: 'Linear Transformations', href: '/domains/linear-algebra/linear-transformations/', role: 'matrix view' },
      { label: 'Loss Landscapes', href: '/domains/optimization/loss-landscapes/', role: 'geometry' },
    ],
    readFirst: ['gradient descent', 'momentum', 'matrix norms', 'adaptive preconditioning'],
    nextRepair: { label: 'Gradient Descent', href: '/domains/optimization/gradient-descent/' },
    equations: [
      {
        id: 'gradient-step',
        label: 'Gradient step',
        equation: 'theta_{t+1} = theta_t - eta * update_t',
        explanation: 'Optimizers differ mostly in how they construct update_t before the step.',
        sourceIds: ['gradient-descent', 'adam'],
        confidence: 'high',
      },
      {
        id: 'orthogonalization-target',
        label: 'Orthogonalization target',
        equation: 'X -> X (X^T X)^(-1/2)',
        explanation: 'Orthogonalized updates separate direction from scale in matrix-shaped parameters.',
        sourceIds: ['linear-transformations', 'external-paper'],
        confidence: 'medium',
      },
    ],
    labSpec: 'Compare AdamW-style adaptive scaling with orthogonalized matrix updates on a small quadratic loss.',
    lab: { label: 'optimizer geometry lab', status: 'planned' },
    currentQuestion: 'Is the speedup from geometry, scale control, or implementation details?',
    discussion: [
      'Which layers should receive orthogonalized updates?',
      'What changes in practice compared with AdamW?',
      'Is the speedup from geometry, scale control, or implementation details?',
    ],
  },
]

const fallbackMapping = mappings[0]

function scoreMapping(input: string, mapping: Mapping) {
  const text = input.toLowerCase()
  return mapping.triggers.reduce((score, trigger) => score + (text.includes(trigger) ? 1 : 0), 0)
}

function chooseMapping(input: string) {
  if (!input.trim()) return fallbackMapping

  return mappings.reduce((best, candidate) => {
    const bestScore = scoreMapping(input, best)
    const candidateScore = scoreMapping(input, candidate)
    return candidateScore > bestScore ? candidate : best
  }, fallbackMapping)
}

function detectInputKind(input: string) {
  const text = input.trim().toLowerCase()
  if (!text) return 'empty input'
  if (text.includes('.pdf') || text.includes('arxiv.org/pdf')) return 'PDF reference'
  if (text.includes('arxiv') || /(?:\d{4}\.\d{4,5})/.test(text)) return 'arXiv-like clue'
  if (text.length > 420) return 'abstract-like excerpt'
  return 'title or rough note'
}

function matchedTriggers(input: string, mapping: Mapping) {
  const text = input.toLowerCase()
  return mapping.triggers.filter((trigger) => text.includes(trigger)).slice(0, 8)
}

function discussionSegmentFromText(value: string, fallback: string) {
  const segment = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .slice(0, 44)
    .replace(/-+$/g, '')

  return segment || fallback
}

function stableHashSegment(value: string) {
  let hash = 0x811c9dc5

  for (const char of value) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, 0x01000193)
  }

  return `h-${(hash >>> 0).toString(36)}`
}

function conceptIdFromHref(href: string) {
  return href.split('/').filter(Boolean).at(-1) ?? href
}

function sourceBoxText(object: PaperEquationObject) {
  const line =
    object.source.lineStart && object.source.lineEnd && object.source.lineEnd !== object.source.lineStart
      ? `lines ${object.source.lineStart}-${object.source.lineEnd}`
      : object.source.lineStart
        ? `line ${object.source.lineStart}`
        : 'line pending'

  return object.source.page ? `Page ${object.source.page}, ${line}` : line
}

function bboxText(object: PaperEquationObject) {
  const bbox = object.source.bbox
  if (!bbox) return 'bbox pending'
  return `x ${Math.round(bbox.x)}, y ${Math.round(bbox.y)}, w ${Math.round(bbox.width)}, h ${Math.round(bbox.height)}`
}

function compactSnapshotText(value: string, limit: number) {
  if (value.length <= limit) return value
  if (limit <= 3) return value.slice(0, limit)
  return `${value.slice(0, limit - 3).trimEnd()}...`
}

function routeHandoffSourceObject(snapshot: LearningRouteSnapshot | null | undefined): LearningRouteSourceObject | null {
  if (!snapshot?.lastObservation) return null

  const observation = snapshot.lastObservation
  const resumeHref = snapshot.currentObject?.href ?? snapshot.routeConcepts?.find((concept) => concept.href)?.href
  const routeLabel = snapshot.mappingTitle ?? snapshot.paperClueLabel ?? snapshot.paperTitle
  const sourceDetail = observation.nextQuestion ?? snapshot.currentQuestion ?? snapshot.nextRepair ?? observation.detail ?? observation.value

  return {
    type: 'thread',
    id: `route-handoff-${discussionSegmentFromText(`${snapshot.mappingId}-${observation.updatedAt}`, 'observation')}`.slice(0, 80),
    title: compactSnapshotText(`Prior route: ${routeLabel}`, 180),
    href: resumeHref,
    role: compactSnapshotText(`${observation.label}: ${observation.value}`, 140),
    status: 'route handoff history',
    sourceDetail: compactSnapshotText(sourceDetail, 160),
    confidence: 'medium',
  }
}

function paperEquationSourceObject(object: PaperEquationObject | undefined): LearningRouteSourceObject | null {
  if (!object) return null

  const sourceIds = [object.source.sourceId, ...object.graphAttachment.conceptIds]
    .filter((item, index, items) => Boolean(item) && items.indexOf(item) === index)
    .slice(0, 8)

  return {
    type: 'equation',
    id: `paper-equation-${object.id}`.slice(0, 80),
    title: compactSnapshotText(object.label, 180),
    role: compactSnapshotText(object.equation, 140),
    status: `${object.confidence} confidence source box`,
    sourceIds,
    sourceDetail: compactSnapshotText(`${sourceBoxText(object)} · ${bboxText(object)}`, 160),
    confidence: object.confidence,
  }
}

function primaryEquationSource(equation: EquationCard, sourceById: Map<string, SourceEvidence>) {
  return equation.sourceIds.map((id) => sourceById.get(id)?.label ?? id).join(', ')
}

function misconceptionForMapping(mapping: Mapping) {
  if (mapping.id === 'kv-cache') {
    return 'KV compression is not automatically better attention; it may save memory while damaging retrieval.'
  }
  if (mapping.id === 'mamba-ssm') {
    return 'Fixed state is not free infinite context; it changes what information can be retained.'
  }
  if (mapping.id === 'preference-optimization') {
    return 'Preference optimization is not generic supervised fine-tuning; the reference policy matters.'
  }
  if (mapping.id === 'diffusion-flow') {
    return 'A score, velocity field, and invertible density transform are different targets.'
  }
  if (mapping.id === 'muon-optimization') {
    return 'A faster optimizer claim is not proven by naming the update geometry.'
  }
  return `Do not confuse ${mapping.title} with its nearest baseline before the source check is grounded.`
}

function paperLensObjectRouteObject(object: PaperLensObject): LearningRouteSourceObject {
  return {
    ...object.routeObject,
    role: compactSnapshotText(object.nextMove, 140),
    sourceDetail: compactSnapshotText(object.evidence, 160),
  }
}

function paperPredictionOptionsForMapping(mapping: Mapping, equation: EquationCard): PaperPredictionOption[] {
  if (mapping.id === 'kv-cache') {
    return [
      {
        id: 'kv-memory-scales',
        label: 'Token memory grows',
        claim: 'If cached tokens increase while model shape and precision stay fixed, KV memory should grow linearly.',
        evidence: `${equation.label}: ${equation.equation}`,
        invariant: 'For fixed shape and precision, KV-cache memory is proportional to B x N_layers x T x H_kv x d_head x bytes.',
        nextMove: 'Open the KV memory lab, double context length, and check that the memory result roughly doubles.',
        accent: '#1f6f78',
      },
      {
        id: 'kv-head-sharing',
        label: 'Head sharing saves memory',
        claim: 'If a method reduces KV heads, memory can fall without changing the learner-facing attention question.',
        evidence: 'Compare MHA, GQA, and MQA as different values of H_kv in the same memory witness.',
        invariant: 'KV compression must name what is held fixed: layers, context, head dimension, batch, and precision.',
        nextMove: 'Keep T fixed in the lab, reduce KV heads, and ask what retrieval quality might pay for the saving.',
        accent: '#8b5cf6',
      },
      {
        id: 'kv-quality-boundary',
        label: 'Quality needs a witness',
        claim: 'A memory saving is not automatically an attention-quality saving.',
        evidence: 'The paper route needs a source span, equation, or toy retrieval witness before trusting quality claims.',
        invariant: 'Serving wins are only interpretable when memory, latency, and retrieval quality are separated.',
        nextMove: 'Attach the exact source span or benchmark that claims quality survives compression.',
        accent: '#c76548',
      },
    ]
  }

  if (mapping.id === 'mamba-ssm') {
    return [
      {
        id: 'ssm-state-compression',
        label: 'State compresses history',
        claim: 'If the model uses a fixed recurrent state, long-context cost can fall while the retained information changes.',
        evidence: `${equation.label}: ${equation.equation}`,
        invariant: 'A fixed state is a learned summary of history, not a free replacement for addressable token memory.',
        nextMove: 'Compare the recurrence equation against attention and ask which past token details can still be recovered.',
        accent: '#1f6f78',
      },
      {
        id: 'ssm-selectivity',
        label: 'Input gates memory',
        claim: 'If the update matrices depend on the input, the model can choose what to retain at each step.',
        evidence: 'Source-check the selective update terms before treating the mechanism as paper-specific.',
        invariant: 'Selectivity is meaningful only when the input-dependent part is identified and contrasted with a baseline recurrence.',
        nextMove: 'Mark the symbol that changes with x_t and the symbol that stays baseline.',
        accent: '#8b5cf6',
      },
    ]
  }

  return [
    {
      id: 'paper-mechanism-witness',
      label: 'Mechanism needs witness',
      claim: `If this paper's contribution is real, one measurable behavior should change from the baseline route.`,
      evidence: `${equation.label}: ${equation.equation}`,
      invariant: 'A paper is understood when its claim is tied to a source object, equation, witness, and transfer question.',
      nextMove: `Repair ${mapping.nextRepair.label}, then write the smallest experiment that would move confidence.`,
      accent: '#1f6f78',
    },
    {
      id: 'paper-source-boundary',
      label: 'Source boundary first',
      claim: 'Metadata, novelty, and benchmark claims should remain provisional until live source lookup confirms them.',
      evidence: mapping.sources.map((source) => source.label).slice(0, 3).join(', '),
      invariant: 'The route can reason from local clues, but it must label what is verified versus inferred.',
      nextMove: 'Run or attach a source check before turning the paper clue into a teaching object.',
      accent: '#c76548',
    },
  ]
}

function buildPaperPredictionObservation({
  prediction,
  activeObject,
  lensRole,
}: {
  prediction: PaperPredictionOption
  activeObject: PaperLensObject
  lensRole: PaperLensRole
}): NonNullable<LearningRouteSnapshot['lastObservation']> {
  return {
    label: compactSnapshotText(`${lensRole}: ${prediction.label}`, 80),
    value: compactSnapshotText(prediction.invariant, 160),
    detail: compactSnapshotText(`${activeObject.typeLabel}: ${activeObject.title}. Prediction: ${prediction.claim}`, 360),
    nextQuestion: compactSnapshotText(prediction.nextMove, 220),
    source: 'prediction-checkpoint',
    updatedAt: new Date().toISOString(),
  }
}

function paperIdentitySegment({
  mappingId,
  paperText,
  ingestionPreview,
}: {
  mappingId: string
  paperText: string
  ingestionPreview: ReturnType<typeof buildPaperIngestionPreview>
}) {
  const raw =
    (ingestionPreview.arxivId ? `arxiv-${ingestionPreview.arxivId}` : undefined) ??
    ingestionPreview.canonicalUrl ??
    ingestionPreview.pdfFileName ??
    firstPaperClueLine(paperText) ??
    mappingId

  return `${discussionSegmentFromText(raw, 'paper')}-${stableHashSegment(raw)}`
}

function paperMapDiscussionItems(
  mapping: Mapping,
  paperObjectId: string,
  paperTitle: string,
  options?: {
    sourceSpans?: ReturnType<typeof buildPaperIngestionPreview>['sourceSpans']
    equationObjects?: PaperEquationObject[]
    groundingStatus?: NonNullable<LearningRouteSnapshot['groundingStatus']>
    sourceCheckDetail?: string
  }
): DiscussionAnchorListItem[] {
  const paperPrompt =
    mapping.discussion[0] ?? `What should be source-checked before treating ${paperTitle} as understood?`
  const sourceSpans = options?.sourceSpans ?? []
  const equationObjects = options?.equationObjects ?? []
  const nextRouteSegment = discussionSegmentFromText(mapping.nextRepair.label, 'next-route')
  const seeds = [
    {
      objectType: 'paper' as const,
      segments: [mapping.id, paperObjectId] as [string, ...string[]],
      title: paperTitle,
      contextLabel: 'Local paper map',
      prompt: paperPrompt,
      sourceIds: ['input'],
    },
    ...sourceSpans.map((span) => ({
      objectType: 'source' as const,
      segments: [mapping.id, paperObjectId, 'span', span.id] as [string, ...string[]],
      title: span.label,
      contextLabel: compactSnapshotText(span.quote, 140),
      prompt: `What does this paper span assert, and what would count as support or a caveat?\n\n${span.quote}`,
      sourceIds: ['input', span.id],
    })),
    {
      objectType: 'source' as const,
      segments: [mapping.id, paperObjectId, 'source-check'] as [string, ...string[]],
      title: 'Source check status',
      contextLabel: options?.groundingStatus ?? 'local-preview',
      prompt: `Separate what is verified from what is still assumed for this paper map. Current status: ${
        options?.groundingStatus ?? 'local-preview'
      }. ${options?.sourceCheckDetail ?? 'Live source lookup may still be pending.'}`,
      sourceIds: ['input', 'external-paper'],
    },
    ...mapping.claims.map((claim) => ({
      objectType: 'claim' as const,
      segments: [mapping.id, paperObjectId, claim.id] as [string, ...string[]],
      title: claim.claim,
      contextLabel: `${claim.confidence} confidence claim`,
      prompt: `What evidence would make this claim stronger or weaker: ${claim.claim}`,
      sourceIds: claim.sourceIds,
    })),
    ...equationObjects.map((object) => ({
      objectType: 'equation' as const,
      segments: [mapping.id, paperObjectId, 'equation-object', object.id] as [string, ...string[]],
      title: object.label,
      contextLabel: object.equation,
      prompt: `Which symbol in this source-boxed equation carries the paper's mechanism, and which symbols are baseline math?\n\n${object.equation}\n\nSource box: ${sourceBoxText(object)}.`,
      sourceIds: [object.source.sourceId, ...object.graphAttachment.conceptIds].filter(Boolean).slice(0, 8),
    })),
    ...mapping.equations.map((equation) => ({
      objectType: 'equation' as const,
      segments: [mapping.id, paperObjectId, equation.id] as [string, ...string[]],
      title: equation.label,
      contextLabel: 'Equation object',
      prompt: `Which symbols in ${equation.label} carry the paper's main mechanism, and which are unchanged baselines?`,
      sourceIds: equation.sourceIds,
    })),
    {
      objectType: 'toy-experiment' as const,
      segments: [mapping.id, paperObjectId, 'toy-lab'] as [string, ...string[]],
      title: mapping.lab.label,
      contextLabel: mapping.lab.status === 'live' ? 'Live toy lab' : 'Planned toy lab',
      prompt: mapping.labSpec,
      sourceIds: ['input'],
    },
    {
      objectType: 'misconception' as const,
      segments: [mapping.id, paperObjectId, 'misconception'] as [string, ...string[]],
      title: 'Likely misconception',
      contextLabel: mapping.title,
      prompt: misconceptionForMapping(mapping),
      sourceIds: ['input'],
    },
    {
      objectType: 'code-witness' as const,
      segments: [mapping.id, paperObjectId, 'code-witness'] as [string, ...string[]],
      title: 'Code witness to attach',
      contextLabel: 'planned code witness',
      prompt: `What minimal code witness would make ${mapping.title} operational instead of merely summarized?`,
      sourceIds: ['input'],
    },
    {
      objectType: 'concept' as const,
      segments: [mapping.id, paperObjectId, 'next-route', nextRouteSegment] as [string, ...string[]],
      title: `Repair ${mapping.nextRepair.label}`,
      contextLabel: 'Next route',
      href: mapping.nextRepair.href,
      prompt: `What prerequisite, invariant, and paper object should the learner carry into ${mapping.nextRepair.label}?`,
      sourceIds: ['input'],
    },
  ]

  return seeds.flatMap((seed) => {
    const anchor = buildDiscussionAnchor({
      objectType: seed.objectType,
      surface: 'paper-map',
      segments: seed.segments,
      title: seed.title,
      contextLabel: seed.contextLabel,
      href: 'href' in seed ? seed.href : undefined,
      sourceIds: seed.sourceIds,
    })
    if (!anchor) return []

    const thread = buildDiscussionPlaceholder(anchor, seed.prompt)
    return thread ? [{ anchor, thread }] : []
  })
}

function firstPaperClueLine(text: string) {
  const line = text
    .split('\n')
    .map((item) => item.trim())
    .find(Boolean)

  return line ? line.slice(0, 140) : undefined
}

function gatewayGroundingStatus(
  gatewayState: GatewayState,
  gatewaySummary: GatewaySummary | null
): NonNullable<LearningRouteSnapshot['groundingStatus']> {
  if (gatewayState === 'error') return 'source-check-error'
  if (gatewayState === 'success') {
    return gatewaySummary?.status === 'Metadata resolved' ? 'metadata-resolved' : 'source-checked'
  }
  return 'local-preview'
}

export default function PaperConceptMapper() {
  const savedRouteSnapshot = useSavedLearningRouteSnapshot()
  const [paperText, setPaperText] = useState(fallbackMapping.sample)
  const [pdfUpload, setPdfUpload] = useState<PaperPdfUpload | null>(null)
  const [activeEquation, setActiveEquation] = useState(0)
  const [activeEquationObject, setActiveEquationObject] = useState(0)
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [handoffCopyStatus, setHandoffCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  const [routeSaveStatus, setRouteSaveStatus] = useState<RouteSaveStatus>('idle')
  const [carrySavedObservation, setCarrySavedObservation] = useState(false)
  const [activePaperObjectId, setActivePaperObjectId] = useState('paper-object')
  const [activePaperLensRole, setActivePaperLensRole] = useState<PaperLensRole>('Learner')
  const [activePredictionId, setActivePredictionId] = useState('kv-memory-scales')
  const [gatewayState, setGatewayState] = useState<GatewayState>('idle')
  const [gatewaySummary, setGatewaySummary] = useState<GatewaySummary | null>(null)
  const [gatewayEquationObjects, setGatewayEquationObjects] = useState<PaperEquationObject[] | null>(null)
  const mapping = useMemo(() => chooseMapping(paperText), [paperText])
  const equation = mapping.equations[Math.min(activeEquation, mapping.equations.length - 1)]
  const sourceById = useMemo(() => new Map(mapping.sources.map((source) => [source.id, source])), [mapping])
  const triggerMatches = useMemo(() => matchedTriggers(paperText, mapping), [mapping, paperText])
  const inputKind = useMemo(() => (pdfUpload ? 'uploaded PDF' : detectInputKind(paperText)), [paperText, pdfUpload])
  const ingestionPreview = useMemo(
    () => buildPaperIngestionPreview(paperText, triggerMatches, pdfUpload),
    [paperText, pdfUpload, triggerMatches]
  )
  const routeLabels = useMemo(() => mapping.concepts.map((concept) => concept.label), [mapping])
  const routeConceptIds = useMemo(() => mapping.concepts.map((concept) => conceptIdFromHref(concept.href)), [mapping])
  const localEquationObjects = useMemo(
    () =>
      buildLocalEquationObjects(paperText, triggerMatches, {
        conceptIds: routeConceptIds,
        paper: ingestionPreview.pdfFileName ?? ingestionPreview.canonicalUrl ?? mapping.title,
        route: routeLabels,
        sourceKind: ingestionPreview.kind === 'pdf' ? 'pdf' : 'pasted-text',
      }),
    [ingestionPreview.canonicalUrl, ingestionPreview.kind, ingestionPreview.pdfFileName, mapping.title, paperText, routeConceptIds, routeLabels, triggerMatches]
  )
  const equationObjects = gatewayEquationObjects?.length ? gatewayEquationObjects : localEquationObjects
  const selectedEquationObject =
    equationObjects.length > 0
      ? equationObjects[Math.min(activeEquationObject, Math.max(equationObjects.length - 1, 0))]
      : undefined
  const paperClueLabel = useMemo(
    () =>
      gatewaySummary?.title ??
      ingestionPreview.pdfFileName ??
      (ingestionPreview.arxivId ? `arXiv ${ingestionPreview.arxivId}` : undefined) ??
      ingestionPreview.canonicalUrl ??
      firstPaperClueLine(paperText) ??
      mapping.title,
    [
      gatewaySummary?.title,
      ingestionPreview.arxivId,
      ingestionPreview.canonicalUrl,
      ingestionPreview.pdfFileName,
      mapping.title,
      paperText,
    ]
  )
  const nextRepair = mapping.nextRepair.label
  const primaryEquation = mapping.equations[0] ?? equation
  const groundingStatus = gatewayGroundingStatus(gatewayState, gatewaySummary)
  const graphRouteId = normalizeLearningRoutePathId(mapping.id)
  const graphHref = graphRouteId ? `/graph/?route=${encodeURIComponent(mapping.id)}&from=paper-map#learning-route` : undefined
  const primaryRouteHref = graphHref ?? mapping.nextRepair.href ?? mapping.concepts[0]?.href ?? '/graph/'
  const paperObjectId = useMemo(
    () => paperIdentitySegment({ mappingId: mapping.id, paperText, ingestionPreview }),
    [ingestionPreview, mapping.id, paperText]
  )
  const discussionItems = useMemo(
    () =>
      paperMapDiscussionItems(mapping, paperObjectId, paperClueLabel, {
        sourceSpans: ingestionPreview.sourceSpans,
        equationObjects,
        groundingStatus,
        sourceCheckDetail: gatewaySummary?.detail,
      }),
    [equationObjects, gatewaySummary?.detail, groundingStatus, ingestionPreview.sourceSpans, mapping, paperClueLabel, paperObjectId]
  )
  const selectedPaperEquationSourceObject = useMemo(
    () => paperEquationSourceObject(selectedEquationObject),
    [selectedEquationObject]
  )
  const routeSourceObjects = useMemo<LearningRouteSourceObject[]>(() => {
    const anchorFor = (objectType: DiscussionAnchorListItem['anchor']['objectType'], title: string) =>
      discussionItems.find((item) => item.anchor.objectType === objectType && item.anchor.title === title)?.anchor.id
    const paperAnchor = discussionItems.find((item) => item.anchor.objectType === 'paper')?.anchor.id
    const labAnchor = discussionItems.find((item) => item.anchor.objectType === 'toy-experiment')?.anchor.id
    const equationCards = [primaryEquation, equation].filter(
      (item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index
    )

    return [
      {
        type: 'paper' as const,
        id: paperObjectId,
        discussionAnchorId: paperAnchor,
        title: compactSnapshotText(paperClueLabel, 180),
        role: compactSnapshotText(inputKind, 140),
        status: groundingStatus,
        sourceIds: ['input'],
        sourceDetail: compactSnapshotText(
          ingestionPreview.pdfFileName ??
            ingestionPreview.canonicalUrl ??
            (ingestionPreview.arxivId ? `arXiv ${ingestionPreview.arxivId}` : inputKind),
          160
        ),
      },
      ...(selectedPaperEquationSourceObject ? [selectedPaperEquationSourceObject] : []),
      ...mapping.concepts.slice(0, 5).map((concept) => ({
        type: 'concept' as const,
        id: conceptIdFromHref(concept.href),
        title: compactSnapshotText(concept.label, 180),
        href: concept.href,
        role: compactSnapshotText(concept.role, 140),
        status: concept.label === nextRepair ? 'first repair' : 'route concept',
      })),
      ...equationCards.map((equationCard) => ({
        type: 'equation' as const,
        id: `equation-${equationCard.id}`,
        discussionAnchorId: anchorFor('equation', equationCard.label),
        title: compactSnapshotText(equationCard.label, 180),
        role: compactSnapshotText(equationCard.equation, 140),
        status: `${equationCard.confidence} confidence equation`,
        sourceIds: equationCard.sourceIds,
        sourceDetail: compactSnapshotText(primaryEquationSource(equationCard, sourceById), 160),
        confidence: equationCard.confidence,
      })),
      {
        type: 'toy-experiment' as const,
        id: 'toy-lab',
        discussionAnchorId: labAnchor,
        title: compactSnapshotText(mapping.lab.label, 180),
        href: mapping.lab.href,
        role: compactSnapshotText(mapping.labSpec, 140),
        status: mapping.lab.status === 'live' ? 'live lab' : 'planned lab',
        sourceIds: ['input'],
      },
      ...mapping.claims.slice(0, 2).map((claim) => ({
        type: 'claim' as const,
        id: claim.id,
        discussionAnchorId: anchorFor('claim', claim.claim),
        title: compactSnapshotText(claim.claim, 180),
        role: compactSnapshotText(`Evidence: ${claim.sourceIds.join(', ')}`, 140),
        status: `${claim.confidence} confidence claim`,
        sourceIds: claim.sourceIds,
        sourceDetail: compactSnapshotText(
          claim.sourceIds.map((id) => sourceById.get(id)?.label ?? id).join(', '),
          160
        ),
        confidence: claim.confidence,
      })),
    ].slice(0, 12)
  }, [
    discussionItems,
    equation,
    groundingStatus,
    ingestionPreview.arxivId,
    ingestionPreview.canonicalUrl,
    ingestionPreview.pdfFileName,
    inputKind,
    mapping.claims,
    mapping.concepts,
    mapping.lab.href,
    mapping.lab.label,
    mapping.lab.status,
    mapping.labSpec,
    nextRepair,
    paperClueLabel,
    paperObjectId,
    primaryEquation,
    selectedPaperEquationSourceObject,
    sourceById,
  ])
  const currentRouteObject =
    selectedPaperEquationSourceObject ??
    routeSourceObjects.find((object) => object.type === 'equation' && object.id === `equation-${equation.id}`) ??
    routeSourceObjects.find((object) => object.type === 'equation') ??
    routeSourceObjects[0]
  const paperLensObjects = useMemo<PaperLensObject[]>(() => {
    const anchorBy = (objectType: DiscussionAnchorListItem['anchor']['objectType'], title: string) =>
      discussionItems.find((item) => item.anchor.objectType === objectType && item.anchor.title === title)?.anchor.id
    const paperAnchor = discussionItems.find((item) => item.anchor.objectType === 'paper')?.anchor.id
    const sourceCheckAnchor = discussionItems.find((item) => item.anchor.title === 'Source check status')?.anchor.id
    const misconceptionAnchor = discussionItems.find((item) => item.anchor.objectType === 'misconception')?.anchor.id
    const codeWitnessAnchor = discussionItems.find((item) => item.anchor.objectType === 'code-witness')?.anchor.id
    const nextRouteAnchor = discussionItems.find((item) => item.anchor.contextLabel === 'Next route')?.anchor.id
    const labAnchor = discussionItems.find((item) => item.anchor.objectType === 'toy-experiment')?.anchor.id
    const primaryConcept = mapping.concepts[0]

    return [
      {
        id: 'paper-object',
        typeLabel: 'Paper clue',
        title: compactSnapshotText(paperClueLabel, 120),
        detail: 'What does this paper appear to assert, and what must stay unverified for now?',
        evidence: groundingStatus === 'local-preview' ? 'Local preview only; source lookup has not verified metadata.' : gatewaySummary?.detail ?? groundingStatus,
        nextMove: `Repair ${nextRepair}, then inspect one equation or source span.`,
        href: primaryRouteHref,
        actionLabel: 'Continue route',
        discussionAnchorId: paperAnchor,
        routeObject: {
          type: 'paper' as const,
          id: paperObjectId,
          discussionAnchorId: paperAnchor,
          title: compactSnapshotText(paperClueLabel, 180),
          role: compactSnapshotText(inputKind, 140),
          status: groundingStatus,
          sourceIds: ['input'],
          sourceDetail: compactSnapshotText(gatewaySummary?.detail ?? inputKind, 160),
        },
      },
      ...ingestionPreview.sourceSpans.slice(0, 3).map((span) => ({
        id: `source-span-${span.id}`,
        typeLabel: 'Paper span',
        title: span.label,
        detail: compactSnapshotText(span.quote, 180),
        evidence: 'This span is extracted from the pasted clue; treat it as a source object to verify or caveat.',
        nextMove: 'State the exact claim this span supports before continuing the route.',
        actionLabel: 'Inspect span',
        discussionAnchorId: anchorBy('source', span.label),
        routeObject: {
          type: 'source' as const,
          id: `paper-span-${span.id}`,
          discussionAnchorId: anchorBy('source', span.label),
          title: span.label,
          role: compactSnapshotText(span.quote, 140),
          status: 'paper span',
          sourceIds: ['input', span.id],
          sourceDetail: compactSnapshotText(span.quote, 160),
        },
      })),
      ...equationObjects.slice(0, 3).map((object) => ({
        id: `equation-object-${object.id}`,
        typeLabel: `${object.confidence} equation`,
        title: object.label,
        detail: object.equation,
        evidence: `${sourceBoxText(object)} · ${bboxText(object)}`,
        nextMove: 'Name the symbol that carries the paper mechanism and the symbol that stays baseline.',
        actionLabel: 'Inspect equation',
        discussionAnchorId: anchorBy('equation', object.label),
        routeObject: {
          ...(paperEquationSourceObject(object) ?? {
            type: 'equation' as const,
            id: `paper-equation-${object.id}`,
            title: object.label,
            role: object.equation,
            status: `${object.confidence} confidence source box`,
          }),
          discussionAnchorId: anchorBy('equation', object.label),
        },
      })),
      ...mapping.claims.slice(0, 2).map((claim) => ({
        id: `claim-${claim.id}`,
        typeLabel: `${claim.confidence} claim`,
        title: compactSnapshotText(claim.claim, 120),
        detail: `Sources: ${claim.sourceIds.map((id) => sourceById.get(id)?.label ?? id).join(', ')}`,
        evidence: 'Confidence should move only when source spans, equations, or demos support the claim.',
        nextMove: 'List one thing that would raise confidence and one thing that would lower it.',
        actionLabel: 'Check claim',
        discussionAnchorId: anchorBy('claim', claim.claim),
        routeObject: {
          type: 'claim' as const,
          id: claim.id,
          discussionAnchorId: anchorBy('claim', claim.claim),
          title: compactSnapshotText(claim.claim, 180),
          role: compactSnapshotText(`Evidence: ${claim.sourceIds.join(', ')}`, 140),
          status: `${claim.confidence} confidence claim`,
          sourceIds: claim.sourceIds,
          sourceDetail: compactSnapshotText(claim.sourceIds.map((id) => sourceById.get(id)?.label ?? id).join(', '), 160),
          confidence: claim.confidence,
        },
      })),
      {
        id: 'source-check-object',
        typeLabel: 'Source check',
        title: 'What is verified so far?',
        detail: gatewaySummary?.detail ?? 'Local preview only. Author, date, benchmark, venue, and exact novelty are not verified yet.',
        evidence: groundingStatus,
        nextMove: paperMapperGatewayUrl ? 'Run source check before trusting metadata or novelty.' : 'Keep source claims provisional until live lookup is connected.',
        actionLabel: paperMapperGatewayUrl ? 'Run source check' : 'Preview source check',
        discussionAnchorId: sourceCheckAnchor,
        routeObject: {
          type: 'source' as const,
          id: 'source-check',
          discussionAnchorId: sourceCheckAnchor,
          title: 'Source check status',
          role: compactSnapshotText(gatewaySummary?.detail ?? groundingStatus, 140),
          status: groundingStatus,
          sourceIds: ['input', 'external-paper'],
          sourceDetail: compactSnapshotText(gatewaySummary?.detail ?? groundingStatus, 160),
        },
      },
      {
        id: 'demo-witness-object',
        typeLabel: `${mapping.lab.status} demo witness`,
        title: mapping.lab.label,
        detail: mapping.labSpec,
        evidence: mapping.lab.status === 'live' ? 'A prediction-first lab is available.' : 'The lab is a planned witness; carry the prediction question.',
        nextMove: mapping.lab.status === 'live' ? 'Open the lab and commit one prediction before reading further.' : 'Write the smallest toy measurement this claim would need.',
        href: mapping.lab.href,
        actionLabel: mapping.lab.status === 'live' ? 'Open demo witness' : 'Carry demo question',
        discussionAnchorId: labAnchor,
        routeObject: {
          type: 'toy-experiment' as const,
          id: 'toy-lab',
          discussionAnchorId: labAnchor,
          title: compactSnapshotText(mapping.lab.label, 180),
          href: mapping.lab.href,
          role: compactSnapshotText(mapping.labSpec, 140),
          status: mapping.lab.status === 'live' ? 'live lab' : 'planned lab',
          sourceIds: ['input'],
        },
      },
      {
        id: 'misconception-object',
        typeLabel: 'Likely misconception',
        title: 'Do not confuse the mechanism with its nearest baseline.',
        detail: misconceptionForMapping(mapping),
        evidence: 'Misconceptions are kept explicit so the route repairs the right mental model.',
        nextMove: 'State the baseline and the invariant that survives the comparison.',
        actionLabel: 'Repair misconception',
        discussionAnchorId: misconceptionAnchor,
        routeObject: {
          type: 'thread' as const,
          id: 'paper-misconception',
          discussionAnchorId: misconceptionAnchor,
          title: 'Likely misconception',
          role: compactSnapshotText(misconceptionForMapping(mapping), 140),
          status: 'misconception repair',
          sourceDetail: compactSnapshotText(mapping.title, 160),
        },
      },
      {
        id: 'code-witness-object',
        typeLabel: 'Code witness',
        title: 'Attach the minimal implementation line.',
        detail: 'A code witness should make the equation operational, not restate the paper summary.',
        evidence: primaryConcept?.href ? `First route concept: ${primaryConcept.label}` : 'Code witness route pending.',
        nextMove: 'Find the smallest runnable witness after the first repair concept.',
        href: primaryConcept?.href,
        actionLabel: 'Attach code witness',
        discussionAnchorId: codeWitnessAnchor,
        routeObject: {
          type: 'code-witness' as const,
          id: 'paper-code-witness',
          discussionAnchorId: codeWitnessAnchor,
          title: 'Code witness to attach',
          href: primaryConcept?.href,
          role: 'Minimal runnable witness for the mapped mechanism.',
          status: 'planned code witness',
          sourceIds: ['input'],
        },
      },
      {
        id: 'next-route-object',
        typeLabel: 'Next route',
        title: `Repair ${nextRepair}`,
        detail: 'The route should make the paper object legible, not just summarize the abstract.',
        evidence: `Mapped route: ${routeLabels.join(' -> ')}`,
        nextMove: `Open ${nextRepair} before treating the paper as understood.`,
        href: primaryRouteHref,
        actionLabel: 'Continue route',
        discussionAnchorId: nextRouteAnchor,
        routeObject: {
          type: 'concept' as const,
          id: conceptIdFromHref(primaryRouteHref),
          discussionAnchorId: nextRouteAnchor,
          title: compactSnapshotText(nextRepair, 180),
          href: primaryRouteHref,
          role: 'First prerequisite repair for this paper object.',
          status: 'next route',
          sourceIds: ['input'],
        },
      },
    ]
  }, [
    discussionItems,
    equationObjects,
    gatewaySummary?.detail,
    groundingStatus,
    ingestionPreview.sourceSpans,
    inputKind,
    mapping,
    nextRepair,
    paperClueLabel,
    paperObjectId,
    primaryRouteHref,
    routeLabels,
    sourceById,
  ])
  const activePaperObject =
    paperLensObjects.find((object) => object.id === activePaperObjectId) ?? paperLensObjects[0]
  const paperLensModes = useMemo(
    () =>
      [
        {
          role: 'Learner' as const,
          mode: 'Prerequisite repair',
          question: 'What must I understand first for this object to make sense?',
          instruction: `Explain ${activePaperObject.title} in one plain-language sentence, then repair ${nextRepair} before reading more paper detail.`,
          primaryLabel: 'Open first repair',
          href: mapping.nextRepair.href ?? primaryRouteHref,
          accent: '#2f8f89',
        },
        {
          role: 'Researcher' as const,
          mode: 'Source and uncertainty',
          question: 'What exact source span supports this, and what is still assumed?',
          instruction: 'Separate verified evidence from interpretation. Keep author, date, benchmark, and novelty claims provisional until source lookup confirms them.',
          primaryLabel: activePaperObject.typeLabel === 'Source check' ? activePaperObject.actionLabel : 'Check evidence',
          href: undefined,
          accent: '#8b5cf6',
        },
        {
          role: 'Experimenter' as const,
          mode: 'Prediction and witness',
          question: 'If this mechanism is true, what single measurement should change?',
          instruction: `Commit one prediction for ${activePaperObject.title}, then use the smallest toy witness or failure case.`,
          primaryLabel: mapping.lab.status === 'live' ? 'Open toy witness' : 'Save prediction',
          href: mapping.lab.href,
          accent: '#d58a1f',
        },
        {
          role: 'Professor' as const,
          mode: 'Teach and transfer',
          question: 'What sequence would make this object teachable without hiding the hard part?',
          instruction: 'Name the prerequisite, invariant, misconception, and transfer example. The goal is a route another learner could follow.',
          primaryLabel: 'Build teach sequence',
          href: primaryRouteHref,
          accent: '#c76548',
        },
      ],
    [activePaperObject.actionLabel, activePaperObject.title, activePaperObject.typeLabel, mapping.lab.href, mapping.lab.status, mapping.nextRepair.href, nextRepair, primaryRouteHref]
  )
  const activePaperLens = paperLensModes.find((mode) => mode.role === activePaperLensRole) ?? paperLensModes[0]
  const paperLensActionHref = activePaperLens.href ?? activePaperObject.href
  const paperPredictionOptions = useMemo(
    () => paperPredictionOptionsForMapping(mapping, primaryEquation),
    [mapping, primaryEquation]
  )
  const activePrediction =
    paperPredictionOptions.find((prediction) => prediction.id === activePredictionId) ??
    paperPredictionOptions[0] ?? {
      id: 'fallback-prediction',
      label: 'Route invariant',
      claim: `If ${mapping.title} matters, one source-grounded behavior should change from the baseline.`,
      evidence: primaryEquation.equation,
      invariant: 'Understanding means linking the paper object to a question, equation, witness, and next move.',
      nextMove: `Repair ${nextRepair}, then test one measurable claim.`,
      accent: '#1f6f78',
    }
  const routePrimaryEquation = selectedEquationObject
    ? {
        label: selectedEquationObject.label,
        equation: selectedEquationObject.equation,
        confidence: selectedEquationObject.confidence,
        sourceLabel: sourceBoxText(selectedEquationObject),
      }
    : {
        label: primaryEquation.label,
        equation: primaryEquation.equation,
        confidence: primaryEquation.confidence,
        sourceLabel: primaryEquationSource(primaryEquation, sourceById),
      }
  const primaryRouteLabel = graphHref ? 'Continue route' : `Repair ${nextRepair}`
  const labActionLabel = mapping.lab.status === 'live' ? 'Try' : 'Planned lab'
  const labSummary = mapping.lab.status === 'live' ? mapping.labSpec : `Lab question to carry: ${mapping.labSpec}`
  const carriedObservation = carrySavedObservation ? savedRouteSnapshot?.lastObservation : undefined
  const cockpitSteps: LivingNotebookLabStep[] = [
    {
      key: 'question',
      label: 'Question',
      value: activePaperLens.question,
      detail: mapping.currentQuestion,
    },
    {
      key: 'object',
      label: 'Object',
      value: activePaperObject.title,
      detail: activePaperObject.typeLabel,
    },
    {
      key: 'prediction',
      label: 'Prediction',
      value: activePrediction.claim,
      detail: activePrediction.label,
    },
    {
      key: 'evidence',
      label: 'Evidence',
      value: activePrediction.evidence,
      detail: groundingStatus,
    },
    {
      key: 'invariant',
      label: 'Invariant',
      value: activePrediction.invariant,
      detail: 'Save this as the route memory.',
    },
    {
      key: 'next',
      label: 'Next',
      value: activePrediction.nextMove,
      detail: nextRepair,
    },
  ]
  const observationSearchHref = savedRouteSnapshot?.lastObservation
    ? `/search/?q=${encodeURIComponent(
        savedRouteSnapshot.lastObservation.nextQuestion ??
          savedRouteSnapshot.nextRepair ??
          savedRouteSnapshot.currentObject?.title ??
          savedRouteSnapshot.paperTitle
      )}&from=paper-map#route-search-lens`
    : '/search/?from=paper-map#route-search-lens'
  const studyPrompt = [
    `I am studying: ${paperClueLabel}`,
    `Mapped route: ${mapping.title}`,
    carriedObservation ? `Saved observation to preserve: ${carriedObservation.label}: ${carriedObservation.value}` : null,
    `Current object: ${activePaperObject.typeLabel}: ${activePaperObject.title}`,
    `Committed prediction: ${activePrediction.claim}`,
    `Invariant to test: ${activePrediction.invariant}`,
    `Route: ${routeLabels.join(' -> ')}`,
    `Read first: ${nextRepair}`,
    `Equation to inspect: ${primaryEquation.label}: ${primaryEquation.equation}`,
    `${labActionLabel}: ${labSummary}`,
    `Ask: ${mapping.currentQuestion}`,
    'Keep author, date, benchmark, and novelty claims unverified until source lookup is connected.',
  ].filter(Boolean).join('\n')
  const aiHandoffPacket = [
    'Continuous Function object handoff',
    `Paper clue: ${paperClueLabel}`,
    `Route: ${routeLabels.join(' -> ')}`,
    `Learner role: ${activePaperLens.role}`,
    `Question: ${activePaperLens.question}`,
    `Object: ${activePaperObject.typeLabel}: ${activePaperObject.title}`,
    `Prediction: ${activePrediction.claim}`,
    `Evidence boundary: ${activePrediction.evidence}`,
    `Invariant: ${activePrediction.invariant}`,
    `Next move: ${activePrediction.nextMove}`,
    `Grounding status: ${groundingStatus}`,
  ].join('\n')
  const saveInvariantLabel =
    routeSaveStatus === 'saved-invariant'
      ? 'Saved invariant'
      : routeSaveStatus === 'saved-with-prior'
        ? 'Saved with prior witness'
        : routeSaveStatus === 'saved-new'
          ? 'Saved route'
          : 'Save invariant'

  const setSample = (sample: string) => {
    setPaperText(sample)
    setPdfUpload(null)
    setActiveEquation(0)
    setActiveEquationObject(0)
    setCopyStatus('idle')
    setHandoffCopyStatus('idle')
    setRouteSaveStatus('idle')
    setCarrySavedObservation(false)
    setActivePaperObjectId('paper-object')
    setActivePredictionId('kv-memory-scales')
    setGatewayState('idle')
    setGatewaySummary(null)
    setGatewayEquationObjects(null)
  }

  const setTypedPaperText = (value: string) => {
    setPaperText(value)
    setPdfUpload(null)
    setActiveEquation(0)
    setActiveEquationObject(0)
    setCopyStatus('idle')
    setHandoffCopyStatus('idle')
    setRouteSaveStatus('idle')
    setCarrySavedObservation(false)
    setActivePaperObjectId('paper-object')
    setActivePredictionId('kv-memory-scales')
    setGatewayState('idle')
    setGatewaySummary(null)
    setGatewayEquationObjects(null)
  }

  const handlePdfFile = async (file?: File) => {
    setGatewaySummary(null)
    setGatewayEquationObjects(null)
    setCarrySavedObservation(false)
    setActivePaperObjectId('paper-object')
    setActivePredictionId('kv-memory-scales')
    setHandoffCopyStatus('idle')

    if (!file) {
      setPdfUpload(null)
      setRouteSaveStatus('idle')
      return
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      setGatewayState('error')
      setGatewaySummary({
        status: 'PDF rejected',
        detail: 'Choose a PDF file so live source lookup can run page-bounded extraction.',
      })
      setRouteSaveStatus('idle')
      return
    }

    if (file.size > maxClientPdfBytes) {
      setGatewayState('error')
      setGatewaySummary({
        status: 'PDF too large',
        detail: `The current Worker parser accepts PDFs up to ${Math.round(maxClientPdfBytes / 1024 / 1024)} MB.`,
      })
      setRouteSaveStatus('idle')
      return
    }

    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result ?? ''))
      reader.onerror = () => reject(new Error('Unable to read the PDF file.'))
      reader.readAsDataURL(file)
    })

    setPdfUpload({
      fileName: file.name,
      mimeType: file.type || 'application/pdf',
      size: file.size,
      base64: dataUrl.replace(/^data:application\/pdf;base64,/i, ''),
    })
    setPaperText((current) => (current.trim() && current !== fallbackMapping.sample ? current : file.name))
    setActiveEquation(0)
    setActiveEquationObject(0)
    setCopyStatus('idle')
    setHandoffCopyStatus('idle')
    setRouteSaveStatus('idle')
    setGatewayState('idle')
  }

  const buildRouteSnapshot = (
    source: LearningRouteSnapshot['source'] = 'paper-map',
    override?: {
      currentQuestion?: string
      labGoal?: string
      currentObject?: LearningRouteSourceObject
      lastObservation?: LearningRouteSnapshot['lastObservation']
    }
  ): LearningRouteSnapshot => {
    const preservedObservation = carrySavedObservation ? savedRouteSnapshot?.lastObservation : undefined
    const lastObservation = override?.lastObservation ?? preservedObservation
    const routeHandoffObject = preservedObservation ? routeHandoffSourceObject(savedRouteSnapshot) : null
    const lensObject = override?.currentObject
    const baseSourceObjects = lensObject
      ? [
          lensObject,
          ...routeSourceObjects.filter(
            (object) => object.id !== lensObject.id || object.type !== lensObject.type
          ),
        ].slice(0, 12)
      : routeSourceObjects
    const sourceObjects = routeHandoffObject
      ? [
          routeHandoffObject,
          ...baseSourceObjects.filter(
            (object) =>
              object.status !== 'route handoff history' &&
              (object.id !== routeHandoffObject.id || object.type !== routeHandoffObject.type)
          ),
        ].slice(0, 12)
      : baseSourceObjects

    return {
      version: 'cf-route-snapshot-v1',
      source,
      paperClueLabel,
      paperTitle: paperClueLabel,
      inputKind,
      mappingId: mapping.id,
      mappingTitle: mapping.title,
      routeLabels,
      routeConceptIds,
      routeConcepts: mapping.concepts.map((concept) => ({
        label: concept.label,
        href: concept.href,
        role: concept.role,
      })),
      nextRepair,
      currentQuestion: override?.currentQuestion ?? mapping.currentQuestion,
      primaryEquation: {
        label: routePrimaryEquation.label,
        equation: routePrimaryEquation.equation,
        confidence: routePrimaryEquation.confidence,
        sourceLabel: routePrimaryEquation.sourceLabel,
      },
      labGoal: override?.labGoal ?? mapping.labSpec,
      labStatus: mapping.lab.status,
      sourceObjects,
      currentObject: override?.currentObject ?? currentRouteObject,
      lastObservation,
      groundingStatus,
      createdAt: new Date().toISOString(),
    }
  }

  const saveCurrentRoute = () => {
    const lensRouteObject = paperLensObjectRouteObject(activePaperObject)
    const paperObservation = buildPaperPredictionObservation({
      prediction: activePrediction,
      activeObject: activePaperObject,
      lensRole: activePaperLens.role,
    })
    const snapshot = buildRouteSnapshot('paper-map', {
      currentQuestion: activePaperLens.question,
      labGoal: activePaperLens.instruction,
      lastObservation: paperObservation,
      currentObject: {
        ...lensRouteObject,
        status: `${activePaperLens.role.toLowerCase()} lens selected`,
      },
    })
    const didSave = saveLearningRouteSnapshot(snapshot)
    setRouteSaveStatus(didSave ? 'saved-invariant' : snapshot.lastObservation ? 'saved-with-prior' : 'saved-new')
  }

  const focusDiscussionObject = (item: DiscussionAnchorListItem) => {
    const focusedObject = routeSourceObjectFromDiscussionItem(item)
    const matchingPaperObject = paperLensObjects.find((object) => object.discussionAnchorId === item.anchor.id)
    if (matchingPaperObject) setActivePaperObjectId(matchingPaperObject.id)
    const nextSnapshot = buildRouteSnapshot('paper-map', {
      currentQuestion: activePaperLens.question,
      labGoal: activePaperLens.instruction,
      currentObject: focusedObject,
      lastObservation: buildPaperPredictionObservation({
        prediction: activePrediction,
        activeObject: matchingPaperObject ?? activePaperObject,
        lensRole: activePaperLens.role,
      }),
    })
    const sourceObjects = nextSnapshot.sourceObjects ?? routeSourceObjects

    const didSave = saveLearningRouteSnapshot({
      ...nextSnapshot,
      sourceObjects: [
        focusedObject,
        ...sourceObjects.filter(
          (object) =>
            object.discussionAnchorId !== focusedObject.discussionAnchorId &&
            (object.id !== focusedObject.id || object.type !== focusedObject.type)
        ),
      ].slice(0, 12),
      currentObject: focusedObject,
    })
    setRouteSaveStatus(didSave ? 'saved-invariant' : nextSnapshot.lastObservation ? 'saved-with-prior' : 'saved-new')
  }

  const copyStudyPrompt = async () => {
    saveCurrentRoute()

    try {
      await navigator.clipboard.writeText(studyPrompt)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('error')
    }
  }

  const copyAiHandoffPacket = async () => {
    saveCurrentRoute()

    try {
      await navigator.clipboard.writeText(aiHandoffPacket)
      setHandoffCopyStatus('copied')
    } catch {
      setHandoffCopyStatus('error')
    }
  }

  const cockpitActions: LivingNotebookLabAction[] = [
    {
      id: 'save-invariant',
      label: saveInvariantLabel,
      onClick: saveCurrentRoute,
      variant: 'primary',
    },
    ...(mapping.lab.status === 'live' && mapping.lab.href
      ? [
          {
            id: 'open-lab',
            label: 'Open lab witness',
            href: mapping.lab.href,
            onClick: saveCurrentRoute,
          } satisfies LivingNotebookLabAction,
        ]
      : []),
    {
      id: 'continue-route',
      label: 'Continue route',
      href: primaryRouteHref,
      onClick: saveCurrentRoute,
    },
    {
      id: 'copy-ai-handoff',
      label:
        handoffCopyStatus === 'copied'
          ? 'Copied AI handoff'
          : handoffCopyStatus === 'error'
            ? 'Copy failed'
            : 'Copy AI handoff',
      onClick: () => void copyAiHandoffPacket(),
    },
  ]

  const runIngestion = async () => {
    setRouteSaveStatus('idle')
    setCarrySavedObservation(false)
    const request = buildPaperMapperGatewayRequest(paperText, triggerMatches, pdfUpload)
    const localSpanDetail = `${ingestionPreview.sourceSpans.length} source span${
      ingestionPreview.sourceSpans.length === 1 ? '' : 's'
    } and ${ingestionPreview.equationSpans.length} equation span${
      ingestionPreview.equationSpans.length === 1 ? '' : 's'
    } prepared.`
    const pdfDetail = pdfUpload
      ? ` ${pdfUpload.fileName} is selected for live source lookup.`
      : ingestionPreview.pdfUrl
        ? ` ${ingestionPreview.pdfUrl} is ready for live source lookup.`
        : ''

    if (!paperMapperGatewayUrl) {
      setGatewayState('local')
      setGatewayEquationObjects(null)
      setGatewaySummary({
        title: ingestionPreview.arxivId ? `arXiv ${ingestionPreview.arxivId}` : undefined,
        status: 'Local preview only',
        detail: `${localSpanDetail}${pdfDetail} Prepared a source check locally. Live source lookup is not connected in this preview.`,
      })
      return
    }

    setGatewayState('loading')
    setGatewaySummary(null)

    try {
      const response = await fetch(paperMapperGatewayUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request),
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Live source lookup failed.')
      }

      const sourceSpanCount = Array.isArray(payload?.extracted?.sourceSpans)
        ? payload.extracted.sourceSpans.length
        : 0
      const equationSpanCount = Array.isArray(payload?.extracted?.equationSpans)
        ? payload.extracted.equationSpans.length
        : 0
      const gatewaySpanDetail =
        sourceSpanCount || equationSpanCount
          ? `${sourceSpanCount} source span${sourceSpanCount === 1 ? '' : 's'} and ${equationSpanCount} equation span${
              equationSpanCount === 1 ? '' : 's'
            } recovered. `
          : ''
      const pdfStatus = payload?.extracted?.pdf?.status
      const pdfQuality = payload?.extracted?.pdf?.quality?.confidence
      const pdfNeedsOcr = Boolean(payload?.extracted?.pdf?.quality?.needsOcr)
      const ocrStatus = payload?.extracted?.pdf?.ocr?.status
      const equationBlockCount = Array.isArray(payload?.extracted?.pdf?.equationBlocks)
        ? payload.extracted.pdf.equationBlocks.length
        : 0
      const returnedEquationObjects = Array.isArray(payload?.extracted?.equationObjects)
        ? (payload.extracted.equationObjects as PaperEquationObject[])
        : []
      const pdfDetail =
        pdfStatus && pdfStatus !== 'skipped'
          ? `PDF ${pdfStatus}${pdfQuality ? ` with ${pdfQuality} parser confidence` : ''}; ${
              payload?.extracted?.pdf?.pages?.length ?? 0
            } page block${
              payload?.extracted?.pdf?.pages?.length === 1 ? '' : 's'
            } parsed; ${equationBlockCount} coordinate equation block${equationBlockCount === 1 ? '' : 's'} found${
              ocrStatus && ocrStatus !== 'not_needed' ? `; OCR ${ocrStatus}` : ''
            }${pdfNeedsOcr ? '; needs OCR or a cleaner text layer' : ''}. `
          : ''
      const equationObjectDetail = returnedEquationObjects.length
        ? `${returnedEquationObjects.length} carried equation${returnedEquationObjects.length === 1 ? '' : 's'} attached to the graph route. `
        : ''

      setGatewayState('success')
      setGatewayEquationObjects(returnedEquationObjects.length ? returnedEquationObjects : null)
      setActiveEquationObject(0)
      setGatewaySummary({
        title: payload?.metadata?.title,
        status:
          pdfQuality === 'low'
            ? 'Low-confidence PDF extraction'
            : payload?.metadata
              ? 'Metadata resolved'
              : 'Mapper response received',
        detail:
          pdfDetail +
          equationObjectDetail +
          gatewaySpanDetail +
          (payload?.mapping?.summary ??
            payload?.warnings?.join(' ') ??
            'Live source lookup returned a grounded mapping.'),
      })
    } catch (error) {
      setGatewayState('error')
      setGatewayEquationObjects(null)
      setGatewaySummary({
        status: 'Source lookup error',
        detail: error instanceof Error ? error.message : 'Unable to reach live source lookup.',
      })
    }
  }

  return (
    <section id="paper-mapper-tool" className="mapper-tool" aria-label="Paper-to-concept mapper">
      <LivingNotebookLabShell
        id="paper-mapper-workbench"
        eyebrow="Question To Invariant"
        title="Turn one paper clue into a tested route."
        intro="Pick the object, commit the prediction, name the evidence boundary, and save the invariant before continuing into the lab or graph."
        selectedObject={{
          typeLabel: activePaperObject.typeLabel,
          title: activePaperObject.title,
          lensLabel: `${activePaperLens.role} lens`,
        }}
        steps={cockpitSteps}
        predictionPrompt="What should change if this paper mechanism is real?"
        predictions={paperPredictionOptions}
        activePredictionId={activePrediction.id}
        onSelectPrediction={(predictionId) => {
          setActivePredictionId(predictionId)
          setRouteSaveStatus('idle')
          setHandoffCopyStatus('idle')
        }}
        invariant={{
          title: activePrediction.invariant,
          detail: activePrediction.evidence,
          accent: activePrediction.accent,
        }}
        actions={cockpitActions}
      />

      {savedRouteSnapshot?.lastObservation ? (
        <section
          className="paper-route-bridge"
          aria-labelledby="paper-route-bridge-title"
          data-paper-route-bridge="saved-observation"
        >
          <div className="paper-route-bridge-copy">
            <p className="eyebrow">Route Evidence</p>
            <h3 id="paper-route-bridge-title">Carry your saved witness into this paper route?</h3>
            <p>
              Use the saved observation as a prior constraint when this paper clue should be checked against the result
              you already witnessed.
            </p>
          </div>

          <ObservationLedgerCard
            snapshot={savedRouteSnapshot}
            variant="inline"
            contextLabel="Available to carry"
            actions={[
              {
                href: savedRouteSnapshot.currentObject?.href ?? '/graph/?from=paper-map#learning-route',
                label: 'Resume object',
                primary: true,
              },
              {
                href: observationSearchHref,
                label: 'Search repair',
              },
            ]}
          />

          <div className="paper-route-bridge-controls">
            <label className="carry-toggle">
              <input
                type="checkbox"
                aria-label="Use saved observation as a prior constraint"
                data-testid="paper-route-carry-observation"
                checked={carrySavedObservation}
                onChange={(event) => {
                  setCarrySavedObservation(event.target.checked)
                  setRouteSaveStatus('idle')
                }}
              />
              <span>
                <strong>Use saved observation as a prior constraint</strong>
                <em>
                  {carrySavedObservation
                    ? 'This paper route will keep the saved witness visible while you source-check claims, equations, and demos.'
                    : 'This paper route will save the paper clue and mapped route without carrying the prior witness.'}
                </em>
              </span>
            </label>

            <div className="bridge-facts" aria-label="Paper map save behavior">
              <article>
                <span>Saved witness</span>
                <strong>{savedRouteSnapshot.lastObservation.label}</strong>
              </article>
              <article>
                <span>Paper repair</span>
                <strong>{nextRepair}</strong>
              </article>
              <article>
                <span>Save rule</span>
                <strong>{carrySavedObservation ? 'preserve witness' : 'switch is off'}</strong>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      <div className="input-pane">
        <div>
          <p className="eyebrow">Input</p>
          <h2>Paste a paper clue.</h2>
          <p className="lede">
            Start with a title, abstract, arXiv link, PDF, or rough note. The mapper builds a grounded source check,
            then suggests concepts, equations, labs, and discussion prompts.
          </p>
        </div>

        <label className="paper-field">
          <span>Paper title, arXiv link, abstract, or model-report excerpt</span>
          <textarea
            value={paperText}
            onChange={(event) => {
              setTypedPaperText(event.target.value)
            }}
            rows={7}
          />
        </label>

        <label className="pdf-field">
          <span>Optional PDF upload for live source lookup</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => {
              void handlePdfFile(event.target.files?.[0])
              event.currentTarget.value = ''
            }}
          />
          <strong>{pdfUpload ? `${pdfUpload.fileName} · ${Math.round(pdfUpload.size / 1024)} KB` : 'No PDF selected'}</strong>
        </label>

        <div className="sample-list" aria-label="Try a sample paper area">
          {mappings.map((item) => (
            <button key={item.id} type="button" onClick={() => setSample(item.sample)}>
              {item.title}
            </button>
          ))}
        </div>

        <div className="ingestion-card" aria-label="Grounding status">
          <p className="eyebrow">Grounding Status</p>
          <div className="status-row">
            <span>detected</span>
            <strong>{inputKind}</strong>
          </div>
          <div className="status-row">
            <span>matched terms</span>
            <strong>{triggerMatches.length ? triggerMatches.join(', ') : 'none yet'}</strong>
          </div>
          <p>
            Static preview grounds against the pasted clue and Continuous Function pages. When live source lookup is
            connected, arXiv metadata can verify author, date, title, and abstract claims server-side.
          </p>
        </div>

        <div className="ingestion-card" aria-label="Source check packet">
          <p className="eyebrow">Source Check</p>
          <div className="status-row">
            <span>source-check version</span>
            <strong>{PAPER_MAPPER_CONTRACT_VERSION}</strong>
          </div>
          {ingestionPreview.arxivId ? (
            <div className="status-row">
              <span>arxiv id</span>
              <strong>{ingestionPreview.arxivId}</strong>
            </div>
          ) : null}
          {ingestionPreview.pdfUrl || ingestionPreview.pdfFileName ? (
            <div className="status-row">
              <span>pdf source</span>
              <strong>{ingestionPreview.pdfFileName ?? ingestionPreview.pdfUrl}</strong>
            </div>
          ) : null}
          <div className="pipeline-list">
            {ingestionPreview.steps.map((step) => (
              <article key={step.label}>
                <span>{step.status}</span>
                <strong>{step.label}</strong>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
          {ingestionPreview.equationSpans.length ? (
            <div className="span-snippets">
              <span>local equation spans</span>
              {ingestionPreview.equationSpans.map((equationSpan) => (
                <article key={equationSpan.id}>
                  <strong>
                    {equationSpan.page
                      ? `Page ${equationSpan.page}, line ${equationSpan.lineStart}`
                      : `Line ${equationSpan.lineStart}`}
                  </strong>
                  <code>{equationSpan.equation}</code>
                </article>
              ))}
            </div>
          ) : null}
          {ingestionPreview.sourceSpans.length ? (
            <div className="span-snippets source-span-list">
              <span>local source spans</span>
              {ingestionPreview.sourceSpans.map((sourceSpan) => (
                <article key={sourceSpan.id}>
                  <strong>{sourceSpan.label}</strong>
                  <p>{sourceSpan.quote}</p>
                </article>
              ))}
            </div>
          ) : null}
          <button type="button" className="ingest-button" onClick={runIngestion} disabled={gatewayState === 'loading'}>
            {paperMapperGatewayUrl ? 'Run source check' : 'Preview source check'}
          </button>
          {gatewaySummary ? (
            <div className={`gateway-summary ${gatewayState}`}>
              <span>{gatewaySummary.status}</span>
              {gatewaySummary.title ? <strong>{gatewaySummary.title}</strong> : null}
              <p>{gatewaySummary.detail}</p>
            </div>
          ) : null}
        </div>
      </div>

      <div className="output-pane">
        <div className="result-header">
          <div>
            <p className="eyebrow">Mapped Result</p>
            <h2>{mapping.title}</h2>
          </div>
          <span className="confidence">{mapping.confidence}</span>
        </div>

        <p className="contribution">{mapping.contribution}</p>
        <p className="novelty">{mapping.novelty}</p>

        <section className="paper-object-lens-panel" aria-labelledby="paper-object-lens-title">
          <div className="object-lens-heading">
            <p className="eyebrow">Current Paper Object</p>
            <h3 id="paper-object-lens-title">Inspect one object before continuing the route.</h3>
            <p>
              Choose the paper span, equation, claim, source check, witness, misconception, or next route. The lens
              changes what to inspect, predict, verify, or teach next.
            </p>
          </div>

          <div className="paper-object-selector" aria-label="Paper objects">
            {paperLensObjects.map((object) => (
              <button
                key={object.id}
                type="button"
                className={object.id === activePaperObject.id ? 'active' : ''}
                onClick={() => {
                  setActivePaperObjectId(object.id)
                  setRouteSaveStatus('idle')
                }}
              >
                <span>{object.typeLabel}</span>
                <strong>{object.title}</strong>
              </button>
            ))}
          </div>

          <div className="paper-lens-layout">
            <article className="active-paper-object">
              <span>{activePaperObject.typeLabel}</span>
              <h4>{activePaperObject.title}</h4>
              <p>{activePaperObject.detail}</p>
              <div className="paper-object-facts">
                <section>
                  <span>Evidence</span>
                  <strong>{activePaperObject.evidence}</strong>
                </section>
                <section>
                  <span>Next move</span>
                  <strong>{activePaperObject.nextMove}</strong>
                </section>
              </div>
            </article>

            <div className="paper-role-lenses" aria-label="Object role lenses">
              {paperLensModes.map((mode) => (
                <button
                  key={mode.role}
                  type="button"
                  className={mode.role === activePaperLens.role ? 'active' : ''}
                  style={{ '--lens-accent': mode.accent } as CSSProperties}
                  aria-pressed={mode.role === activePaperLens.role}
                  onClick={() => {
                    setActivePaperLensRole(mode.role)
                    setRouteSaveStatus('idle')
                  }}
                >
                  <span>{mode.role}</span>
                  <strong>{mode.mode}</strong>
                </button>
              ))}
            </div>

            <article className="paper-lens-card" style={{ '--lens-accent': activePaperLens.accent } as CSSProperties}>
              <span>{activePaperLens.role} lens</span>
              <strong>{activePaperLens.question}</strong>
              <p>{activePaperLens.instruction}</p>
              <div className="lens-resolution-strip" aria-label="Object lens resolution loop">
                <em>Inspect: {activePaperObject.typeLabel}</em>
                <em>Verify: {activePaperObject.evidence}</em>
                <em>Carry: {activePaperObject.nextMove}</em>
              </div>
              <div className="paper-lens-actions">
                {paperLensActionHref ? (
                  <Link href={paperLensActionHref} className="paper-lens-action-link" onClick={saveCurrentRoute}>
                    {activePaperLens.primaryLabel}
                  </Link>
                ) : (
                  <button type="button" onClick={saveCurrentRoute}>
                    {activePaperLens.primaryLabel}
                  </button>
                )}
                <button type="button" className="secondary" onClick={saveCurrentRoute}>
                  {routeSaveStatus === 'idle' ? 'Save object lens' : saveInvariantLabel}
                </button>
              </div>
            </article>
          </div>
        </section>

        <section className="continue-card" aria-labelledby="continue-paper-title">
          <div className="continue-copy">
            <p className="eyebrow">Next Best Move</p>
            <h3 id="continue-paper-title">Continue this paper as one study route.</h3>
            <p>
              Repair <strong>{nextRepair}</strong> first, carry one equation, then test the claim in the smallest
              available lab.
            </p>
          </div>

          <div className="continue-route" aria-label="Carried paper route">
            <article>
              <span>Read first</span>
              <strong>{nextRepair}</strong>
            </article>
            <article>
              <span>Inspect</span>
              <strong>{primaryEquation.label}</strong>
              <code>{primaryEquation.equation}</code>
            </article>
            <article>
              <span>{labActionLabel}</span>
              <strong>{mapping.lab.status === 'live' ? mapping.lab.label : 'Lab question to carry'}</strong>
              <p>{labSummary}</p>
            </article>
            <article>
              <span>Then ask</span>
              <strong>{mapping.currentQuestion}</strong>
            </article>
          </div>

          <p className="verification-note">
            Do not treat author, date, benchmark, or exact novelty claims as verified until source lookup is connected.
          </p>
          <p className="save-behavior-note">
            {carrySavedObservation
              ? 'Will save the committed invariant with the prior witness kept in the handoff.'
              : 'Will save the committed invariant as this route memory.'}
          </p>

          <div className="continue-actions">
            <Link href={primaryRouteHref} onClick={saveCurrentRoute}>
              {primaryRouteLabel}
            </Link>
            {mapping.lab.status === 'live' && mapping.lab.href ? (
              <Link href={mapping.lab.href} onClick={saveCurrentRoute}>
                Open {mapping.lab.label}
              </Link>
            ) : null}
            <button type="button" onClick={saveCurrentRoute}>
              {routeSaveStatus === 'idle' ? 'Remember on home' : saveInvariantLabel}
            </button>
            <button type="button" onClick={() => void copyStudyPrompt()}>
              {copyStatus === 'copied' ? 'Copied prompt' : copyStatus === 'error' ? 'Copy failed' : 'Copy study prompt'}
            </button>
          </div>
        </section>

        <div className="source-grounding-grid">
          <section className="source-card" aria-labelledby="source-title">
            <p className="eyebrow">Source Check</p>
            <h3 id="source-title">What the answer is allowed to use</h3>
            <div className="source-list">
              {mapping.sources.map((source) => {
                const body = (
                  <>
                    <span>{source.kind}</span>
                    <strong>{source.label}</strong>
                    <p>{source.signal}</p>
                  </>
                )

                return source.href ? (
                  <Link key={source.id} href={source.href} className="source-item">
                    {body}
                  </Link>
                ) : (
                  <article key={source.id} className="source-item">
                    {body}
                  </article>
                )
              })}
            </div>
          </section>

          <section className="claim-card" aria-labelledby="claim-title">
            <p className="eyebrow">Claim Check</p>
            <h3 id="claim-title">Supported, not overclaimed</h3>
            <div className="claim-list">
              {mapping.claims.map((claim) => (
                <article key={claim.id}>
                  <span>{claim.confidence} confidence</span>
                  <strong>{claim.claim}</strong>
                  <p>
                    Sources:{' '}
                    {claim.sourceIds
                      .map((id) => sourceById.get(id)?.label ?? id)
                      .join(', ')}
                  </p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <div className="concept-path" aria-label="Mapped concepts">
          {mapping.concepts.map((concept, index) => (
            <Link key={concept.href} href={concept.href} className="concept-node">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{concept.label}</strong>
              <em>{concept.role}</em>
            </Link>
          ))}
        </div>

        {equationObjects.length ? (
          <section className="equation-object-panel" aria-labelledby="equation-object-title">
            <div className="object-panel-header">
              <div>
                <p className="eyebrow">Carried Equations</p>
                <h3 id="equation-object-title">Source boxes ready for explanation</h3>
              </div>
              <span>{gatewayEquationObjects?.length ? 'live lookup' : 'local preview'}</span>
            </div>

            <div className="equation-object-layout">
              <div className="equation-object-list" aria-label="Recovered carried equations">
                {equationObjects.map((object, index) => (
                  <button
                    key={object.id}
                    type="button"
                    className={object.id === selectedEquationObject?.id ? 'equation-object-card active' : 'equation-object-card'}
                    onClick={() => setActiveEquationObject(index)}
                  >
                    <span>{object.confidence} confidence</span>
                    <strong>{object.label}</strong>
                    <code>{object.equation}</code>
                    <em>{sourceBoxText(object)}</em>
                  </button>
                ))}
              </div>

              {selectedEquationObject ? (
                <article className="equation-object-detail">
                  <div className="source-box">
                    <span>{selectedEquationObject.source.kind}</span>
                    <strong>{sourceBoxText(selectedEquationObject)}</strong>
                    <p>{bboxText(selectedEquationObject)}</p>
                  </div>

                  <div className="object-route">
                    {selectedEquationObject.graphAttachment.route.map((item) => (
                      <span key={item}>{item}</span>
                    ))}
                  </div>

                  <div className="prompt-preview">
                    <span>explainer prompt</span>
                    <p>{selectedEquationObject.prompt}</p>
                  </div>
                </article>
              ) : null}
            </div>
          </section>
        ) : null}

        <div className="detail-grid">
          <section className="read-first" aria-labelledby="read-first-title">
            <p className="eyebrow">Read First</p>
            <h3 id="read-first-title">Prerequisite repairs</h3>
            <ul>
              {mapping.readFirst.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="equation-panel" aria-labelledby="equation-title">
            <p className="eyebrow">Equation Explainer</p>
            <h3 id="equation-title">{equation.label}</h3>
            <div className="equation-tabs">
              {mapping.equations.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  className={index === activeEquation ? 'active' : ''}
                  onClick={() => setActiveEquation(index)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <code>{equation.equation}</code>
            <div className="equation-source">
              <span>{equation.confidence} confidence</span>
              <strong>
                Grounded in{' '}
                {equation.sourceIds
                  .map((id) => sourceById.get(id)?.label ?? id)
                  .join(', ')}
              </strong>
            </div>
            <p>{equation.explanation}</p>
          </section>
        </div>

        <div className="lab-discussion-grid">
          <section className="lab-card" aria-labelledby="lab-title">
            <p className="eyebrow">Demo Witness</p>
            <h3 id="lab-title">{mapping.lab.label}</h3>
            <div className="demo-witness-summary">
              <article>
                <span>Predict</span>
                <strong>{mapping.labSpec}</strong>
              </article>
              <article>
                <span>Measure</span>
                <strong>
                  {mapping.lab.status === 'live'
                    ? 'Run the toy lab before trusting the paper-level intuition.'
                    : 'Name the smallest measurement this planned witness needs.'}
                </strong>
              </article>
              <article>
                <span>Failure case</span>
                <strong>{misconceptionForMapping(mapping)}</strong>
              </article>
            </div>
            {mapping.lab.status === 'live' && mapping.lab.href ? (
              <Link href={mapping.lab.href} className="demo-witness-link" onClick={saveCurrentRoute}>
                Open demo witness
              </Link>
            ) : null}
          </section>

          <ResearchReadingRoom
            eyebrow="Research Room"
            title="Resolve the exact paper object"
            intro="Pick a paper, claim, equation, or lab object. The room keeps evidence, assumptions, and the AI handoff attached to that object."
            items={discussionItems}
            variant="compact"
            preferredAnchorId={activePaperObject.discussionAnchorId}
            showAnchorIds={false}
            objectRoomContext={{
              objectContext: `${activePaperObject.typeLabel}: ${activePaperObject.detail}`,
              sourceBoundary: `Verify with: ${activePaperObject.evidence}`,
              nextExperiment: activePaperLens.instruction,
              canonicality:
                'This is a paper-mapper object lens for route planning. Verify source spans before treating any mapped claim as canonical.',
              roomCards: [
                {
                  label: 'Selected paper object',
                  title: activePaperObject.title,
                  body: activePaperObject.detail,
                  meta: activePaperObject.typeLabel,
                },
                {
                  label: `${activePaperLens.role} lens`,
                  title: activePaperLens.question,
                  body: activePaperLens.instruction,
                  meta: activePaperLens.primaryLabel,
                },
                {
                  label: 'Carry forward',
                  title: activePaperObject.nextMove,
                  body: `Before saving the route, verify ${activePaperObject.evidence}.`,
                  meta: 'route handoff',
                },
              ],
            }}
            onFocusObject={focusDiscussionObject}
          />
        </div>
      </div>

      <style jsx>{`
        .mapper-tool {
          display: grid;
          grid-template-columns: minmax(280px, 0.42fr) minmax(0, 1fr);
          gap: 1rem;
          min-width: 0;
        }

        .input-pane,
        .output-pane,
        .ingestion-card,
        .paper-object-lens-panel,
        .continue-card,
        .source-card,
        .claim-card,
        .equation-object-panel,
        .read-first,
        .equation-panel,
        .lab-card,
        .discussion-card {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.84);
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        :global(#paper-mapper-workbench) {
          grid-column: 1 / -1;
        }

        .input-pane,
        .output-pane {
          display: grid;
          align-content: start;
          gap: 1rem;
          padding: 1rem;
          border-radius: 24px;
        }

        .paper-object-lens-panel {
          display: grid;
          gap: 0.85rem;
          padding: 0.95rem;
          border-radius: 20px;
          background:
            linear-gradient(135deg, rgba(231, 248, 244, 0.72), rgba(255, 251, 245, 0.9)),
            rgba(255, 251, 245, 0.86);
        }

        .object-lens-heading {
          display: grid;
          gap: 0.42rem;
          min-width: 0;
        }

        .object-lens-heading h3,
        .active-paper-object h4,
        .paper-lens-card strong {
          margin: 0;
          color: #151d27;
          line-height: 1.12;
          overflow-wrap: anywhere;
        }

        .object-lens-heading h3::before,
        .active-paper-object h4::before {
          content: none;
          display: none;
        }

        .object-lens-heading p:not(.eyebrow),
        .active-paper-object p,
        .paper-lens-card p {
          margin: 0;
          color: #4f5c68;
          line-height: 1.58;
          overflow-wrap: anywhere;
        }

        .paper-object-selector {
          display: flex;
          gap: 0.5rem;
          min-width: 0;
          padding-bottom: 0.2rem;
          overflow-x: auto;
          scroll-snap-type: x proximity;
        }

        .paper-object-selector button,
        .paper-role-lenses button {
          min-width: 9.4rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 12px;
          background: rgba(255, 251, 245, 0.82);
          color: #1b2430;
          font: inherit;
          text-align: left;
          cursor: pointer;
          scroll-snap-align: start;
        }

        .paper-object-selector button {
          display: grid;
          gap: 0.28rem;
          padding: 0.62rem;
        }

        .paper-object-selector button.active,
        .paper-object-selector button:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: rgba(231, 248, 244, 0.82);
          transform: translateY(-1px);
        }

        .paper-object-selector span,
        .active-paper-object > span,
        .paper-object-facts span,
        .paper-role-lenses span,
        .paper-lens-card > span,
        .lens-resolution-strip em {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .paper-object-selector span,
        .active-paper-object > span,
        .paper-object-facts span {
          color: #1f6f78;
        }

        .paper-object-selector strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          min-height: 2.4em;
          overflow: hidden;
          color: #151d27;
          font-size: 0.9rem;
          line-height: 1.2;
          overflow-wrap: anywhere;
        }

        .paper-lens-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(10rem, 0.36fr);
          gap: 0.65rem;
          min-width: 0;
        }

        .active-paper-object,
        .paper-lens-card {
          display: grid;
          gap: 0.58rem;
          min-width: 0;
          padding: 0.78rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(255, 251, 245, 0.78);
        }

        .paper-object-facts,
        .lens-resolution-strip {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
          min-width: 0;
        }

        .paper-object-facts section,
        .lens-resolution-strip em {
          min-width: 0;
          padding: 0.5rem;
          border-radius: 10px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(247, 252, 250, 0.72);
        }

        .paper-object-facts strong {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 3;
          overflow: hidden;
          color: #33404d;
          font-size: 0.82rem;
          line-height: 1.36;
          overflow-wrap: anywhere;
        }

        .paper-role-lenses {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.45rem;
          min-width: 0;
        }

        .paper-role-lenses button {
          display: grid;
          gap: 0.22rem;
          min-width: 0;
          min-height: 58px;
          padding: 0.58rem;
          border-color: color-mix(in srgb, var(--lens-accent) 22%, rgba(27, 36, 48, 0.1));
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--lens-accent) 10%, transparent), transparent 70%),
            rgba(255, 251, 245, 0.78);
        }

        .paper-role-lenses span,
        .paper-lens-card > span {
          color: color-mix(in srgb, var(--lens-accent) 82%, #1b2430);
        }

        .paper-role-lenses button.active,
        .paper-role-lenses button:hover {
          border-color: color-mix(in srgb, var(--lens-accent) 58%, rgba(27, 36, 48, 0.1));
          background:
            linear-gradient(90deg, color-mix(in srgb, var(--lens-accent) 18%, transparent), transparent 74%),
            rgba(255, 251, 245, 0.9);
        }

        .paper-role-lenses strong {
          color: #151d27;
          font-size: 0.9rem;
          line-height: 1.2;
        }

        .paper-lens-card {
          grid-column: 1 / -1;
          border-color: color-mix(in srgb, var(--lens-accent) 38%, rgba(31, 111, 120, 0.16));
          border-left: 4px solid var(--lens-accent);
          background:
            radial-gradient(circle at 8% 12%, color-mix(in srgb, var(--lens-accent) 14%, transparent), transparent 48%),
            rgba(255, 251, 245, 0.84);
        }

        .lens-resolution-strip {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .lens-resolution-strip em {
          display: -webkit-box;
          -webkit-box-orient: vertical;
          -webkit-line-clamp: 2;
          overflow: hidden;
          color: #52606c;
          font-style: normal;
          line-height: 1.32;
          text-transform: none;
          letter-spacing: 0;
          overflow-wrap: anywhere;
        }

        .paper-lens-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .paper-lens-actions :global(.paper-lens-action-link),
        .paper-lens-actions button,
        .lab-card :global(.demo-witness-link) {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 44px;
          max-width: 100%;
          padding: 0.58rem 0.82rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1f6f78;
          color: #fbf4e8;
          font: inherit;
          font-weight: 780;
          line-height: 1.15;
          text-align: center;
          text-decoration: none;
          cursor: pointer;
        }

        .paper-lens-actions button.secondary {
          background: rgba(255, 251, 245, 0.92);
          color: #1b2430;
        }

        .paper-route-bridge {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: minmax(13rem, 0.78fr) minmax(20rem, 1.15fr) minmax(16rem, 0.85fr);
          align-items: stretch;
          gap: 0.75rem;
          min-width: 0;
          padding: 0.95rem;
          border-radius: 22px;
          border: 1px solid rgba(31, 111, 120, 0.15);
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.9), rgba(255, 251, 245, 0.9)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(243, 176, 71, 0.08));
          box-shadow: 0 16px 34px rgba(27, 36, 48, 0.05);
        }

        .paper-route-bridge-copy,
        .paper-route-bridge-controls {
          display: grid;
          align-content: start;
          gap: 0.62rem;
          min-width: 0;
        }

        .paper-route-bridge :global(.observation-ledger-card) {
          grid-column: auto;
          align-self: stretch;
        }

        .paper-route-bridge :global(.observation-ledger-card.inline .ledger-title-row strong) {
          display: block;
          overflow: visible;
          -webkit-line-clamp: unset;
        }

        .paper-route-bridge-copy p:not(.eyebrow) {
          margin: 0.55rem 0 0;
          color: #455361;
          line-height: 1.6;
        }

        .carry-toggle {
          display: grid;
          grid-template-columns: auto minmax(0, 1fr);
          gap: 0.56rem;
          align-items: start;
          min-width: 0;
          padding: 0.7rem;
          border-radius: 16px;
          border: 1px solid rgba(31, 111, 120, 0.16);
          background: rgba(255, 251, 245, 0.86);
        }

        .carry-toggle input {
          width: 1.05rem;
          height: 1.05rem;
          margin-top: 0.14rem;
          accent-color: #1f6f78;
        }

        .carry-toggle span {
          display: grid;
          gap: 0.22rem;
          min-width: 0;
        }

        .carry-toggle strong {
          color: #151d27;
          line-height: 1.35;
        }

        .carry-toggle em {
          color: #5b6874;
          font-size: 0.84rem;
          font-style: normal;
          line-height: 1.45;
        }

        .bridge-facts {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.42rem;
          min-width: 0;
        }

        .bridge-facts article {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.58rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.07);
          background: rgba(247, 252, 250, 0.82);
        }

        .bridge-facts span {
          font-family: var(--font-mono);
          font-size: 0.58rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .bridge-facts strong {
          color: #151d27;
          font-size: 0.82rem;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .eyebrow,
        .paper-field span {
          margin: 0 0 0.55rem;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        h2,
        h3,
        p,
        li,
        code,
        pre {
          overflow-wrap: break-word;
        }

        h2,
        h3 {
          margin: 0;
          color: #151d27;
          line-height: 1.08;
        }

        h2::before,
        h3::before {
          content: none;
          display: none;
        }

        h2 {
          font-family: var(--font-display);
          font-size: clamp(1.7rem, 3vw, 2.45rem);
        }

        h3 {
          font-size: 1.15rem;
        }

        .lede,
        .contribution,
        .novelty,
        .continue-card p,
        .ingestion-card p,
        .source-item p,
        .claim-list p,
        .equation-panel p {
          margin: 0.75rem 0 0;
          color: #455361;
          line-height: 1.68;
        }

        .paper-field {
          display: grid;
          gap: 0.45rem;
        }

        .pdf-field {
          display: grid;
          gap: 0.48rem;
          min-width: 0;
          padding: 0.78rem;
          border-radius: 16px;
          border: 1px dashed rgba(31, 111, 120, 0.22);
          background: rgba(247, 252, 250, 0.78);
        }

        .pdf-field span {
          margin: 0;
          font-family: var(--font-mono);
          font-size: 0.72rem;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          color: #1f6f78;
        }

        .pdf-field strong {
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .pdf-field input {
          min-width: 0;
          width: 100%;
          color: #455361;
          font: inherit;
          font-size: 0.9rem;
        }

        textarea {
          min-width: 0;
          width: 100%;
          resize: vertical;
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          background: rgba(255, 251, 245, 0.96);
          color: #151d27;
          font: inherit;
          line-height: 1.5;
        }

        textarea:focus,
        button:focus-visible,
        .concept-node:focus-visible {
          outline: 2px solid rgba(31, 111, 120, 0.35);
          outline-offset: 2px;
        }

        .sample-list,
        .equation-tabs,
        .pro-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        button {
          font: inherit;
          min-height: 38px;
          padding: 0.55rem 0.75rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
          cursor: pointer;
        }

        button:hover:not(:disabled),
        button.active {
          border-color: rgba(194, 74, 45, 0.32);
          background: rgba(255, 244, 238, 0.92);
          transform: translateY(-1px);
        }

        button:disabled {
          cursor: not-allowed;
          color: #66717d;
          background: rgba(239, 232, 219, 0.8);
        }

        .ingestion-card {
          display: grid;
          gap: 0.55rem;
          padding: 0.85rem;
          border-radius: 18px;
        }

        .status-row,
        .pipeline-list article,
        .gateway-summary {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.64rem;
          border-radius: 14px;
          background: rgba(247, 252, 250, 0.86);
        }

        .status-row span,
        .pipeline-list span,
        .span-snippets span,
        .gateway-summary span,
        .equation-source span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .status-row strong,
        .pipeline-list strong,
        .gateway-summary strong,
        .equation-source strong {
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: anywhere;
        }

        .pipeline-list {
          display: grid;
          gap: 0.48rem;
        }

        .pipeline-list p,
        .gateway-summary p {
          margin: 0;
          color: #455361;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .span-snippets {
          display: grid;
          gap: 0.42rem;
          min-width: 0;
          padding: 0.64rem;
          border-radius: 14px;
          background: rgba(255, 244, 238, 0.62);
        }

        .span-snippets article {
          display: grid;
          gap: 0.34rem;
          min-width: 0;
          padding: 0.56rem;
          border-radius: 12px;
          background: rgba(255, 251, 245, 0.78);
          border: 1px solid rgba(27, 36, 48, 0.07);
        }

        .span-snippets strong {
          color: #151d27;
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .span-snippets p {
          margin: 0;
          color: #455361;
          line-height: 1.5;
        }

        .span-snippets code {
          margin: 0;
          background: rgba(21, 29, 39, 0.92);
        }

        .source-span-list {
          background: rgba(247, 252, 250, 0.78);
        }

        .ingest-button {
          width: 100%;
          justify-content: center;
          border-radius: 14px;
          background: #1b2430;
          color: #fbf4e8;
        }

        .ingest-button:hover:not(:disabled) {
          background: #1f6f78;
        }

        .gateway-summary.success,
        .gateway-summary.local {
          border: 1px solid rgba(31, 111, 120, 0.18);
          background: rgba(231, 248, 244, 0.9);
        }

        .gateway-summary.error {
          border: 1px solid rgba(194, 74, 45, 0.2);
          background: rgba(255, 244, 238, 0.9);
        }

        .result-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: start;
        }

        .confidence {
          max-width: 18rem;
          padding: 0.52rem 0.68rem;
          border-radius: 16px;
          background: #1b2430;
          color: #f8f3ea;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .novelty {
          padding: 0.85rem;
          border-radius: 16px;
          border: 1px solid rgba(194, 74, 45, 0.14);
          background: rgba(255, 244, 238, 0.68);
        }

        .continue-card {
          display: grid;
          gap: 0.8rem;
          padding: 0.95rem;
          border-radius: 18px;
          background:
            linear-gradient(180deg, rgba(247, 252, 250, 0.92), rgba(255, 251, 245, 0.92)),
            linear-gradient(90deg, rgba(31, 111, 120, 0.1), rgba(194, 74, 45, 0.1));
        }

        .continue-copy {
          max-width: 48rem;
        }

        .continue-copy strong {
          color: #151d27;
        }

        .continue-route {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.55rem;
          min-width: 0;
        }

        .continue-route article {
          display: grid;
          align-content: start;
          gap: 0.35rem;
          min-width: 0;
          min-height: 118px;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.78);
        }

        .continue-route span,
        .verification-note,
        .save-behavior-note {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .continue-route strong {
          color: #151d27;
          line-height: 1.35;
        }

        .continue-route code {
          margin: 0;
          padding: 0.55rem;
          border-radius: 11px;
          font-size: 0.78rem;
        }

        .verification-note {
          margin: 0;
          color: #5b6874;
          line-height: 1.55;
        }

        .save-behavior-note {
          margin: 0;
          line-height: 1.55;
        }

        .continue-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .continue-actions :global(a),
        .continue-actions button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 40px;
          padding: 0.6rem 0.82rem;
          border-radius: 999px;
          border: 1px solid rgba(27, 36, 48, 0.1);
          background: #1b2430;
          color: #fbf4e8;
          font: inherit;
          font-weight: 700;
          text-decoration: none;
        }

        .continue-actions :global(a:nth-child(2)),
        .continue-actions button {
          background: rgba(255, 251, 245, 0.9);
          color: #1b2430;
        }

        .continue-actions :global(a:hover),
        .continue-actions button:hover {
          border-color: rgba(31, 111, 120, 0.28);
          background: #1f6f78;
          color: #fbf4e8;
          text-shadow: none;
          transform: translateY(-1px);
        }

        .source-grounding-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(0, 0.9fr);
          gap: 0.8rem;
          min-width: 0;
        }

        .source-card,
        .claim-card,
        .equation-object-panel {
          padding: 0.9rem;
          border-radius: 18px;
        }

        .source-list,
        .claim-list {
          display: grid;
          gap: 0.55rem;
          margin-top: 0.8rem;
        }

        .source-list :global(.source-item),
        .source-item,
        .claim-list article {
          min-width: 0;
          padding: 0.72rem;
          border-radius: 15px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(255, 251, 245, 0.76);
          color: #1b2430;
          text-decoration: none;
        }

        .source-list :global(.source-item:hover) {
          color: #1f6f78;
          transform: translateY(-1px);
          text-shadow: none;
        }

        .source-item span,
        .source-list :global(.source-item span),
        .claim-list span {
          display: block;
          margin-bottom: 0.35rem;
          font-family: var(--font-mono);
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .source-item strong,
        .source-list :global(.source-item strong),
        .claim-list strong {
          display: block;
          color: #151d27;
          line-height: 1.35;
          overflow-wrap: break-word;
        }

        .source-list :global(.source-item p) {
          color: #455361;
        }

        .concept-path {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.55rem;
        }

        .concept-path :global(.concept-node) {
          display: grid;
          gap: 0.35rem;
          min-height: 112px;
          padding: 0.75rem;
          border-radius: 16px;
          border: 1px solid rgba(27, 36, 48, 0.09);
          background: rgba(255, 251, 245, 0.94);
          color: #1b2430;
          text-decoration: none;
        }

        .concept-path :global(.concept-node:hover) {
          color: #1f6f78;
          transform: translateY(-2px);
          text-shadow: none;
        }

        .concept-path :global(.concept-node span) {
          font-family: var(--font-mono);
          font-size: 0.7rem;
          color: #c24a2d;
        }

        .concept-path :global(.concept-node strong) {
          color: #151d27;
        }

        .concept-path :global(.concept-node em) {
          color: #5b6874;
          font-style: normal;
          line-height: 1.35;
        }

        .object-panel-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 1rem;
        }

        .object-panel-header > span,
        .equation-object-card span,
        .source-box span,
        .prompt-preview span {
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #c24a2d;
        }

        .object-panel-header > span {
          flex: 0 0 auto;
          padding: 0.35rem 0.48rem;
          border-radius: 999px;
          background: rgba(255, 244, 238, 0.9);
        }

        .equation-object-layout {
          display: grid;
          grid-template-columns: minmax(0, 0.95fr) minmax(240px, 0.8fr);
          gap: 0.7rem;
          margin-top: 0.8rem;
          min-width: 0;
        }

        .equation-object-list {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.52rem;
          min-width: 0;
        }

        .equation-object-card {
          display: grid;
          justify-items: start;
          align-content: start;
          gap: 0.36rem;
          min-width: 0;
          min-height: 128px;
          padding: 0.68rem;
          border-radius: 15px;
          text-align: left;
          background: rgba(255, 251, 245, 0.9);
        }

        .equation-object-card.active {
          border-color: rgba(31, 111, 120, 0.3);
          background: rgba(231, 248, 244, 0.9);
        }

        .equation-object-card strong,
        .source-box strong {
          color: #151d27;
          line-height: 1.35;
        }

        .equation-object-card code {
          width: 100%;
          margin: 0;
          padding: 0.55rem;
          border-radius: 11px;
          font-size: 0.78rem;
        }

        .equation-object-card em {
          color: #5b6874;
          font-size: 0.8rem;
          font-style: normal;
          line-height: 1.35;
        }

        .equation-object-detail {
          display: grid;
          gap: 0.62rem;
          min-width: 0;
        }

        .source-box,
        .prompt-preview {
          display: grid;
          gap: 0.32rem;
          min-width: 0;
          padding: 0.68rem;
          border-radius: 14px;
          border: 1px solid rgba(27, 36, 48, 0.08);
          background: rgba(247, 252, 250, 0.88);
        }

        .source-box p,
        .prompt-preview p {
          margin: 0;
          color: #455361;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }

        .object-route {
          display: flex;
          flex-wrap: wrap;
          gap: 0.38rem;
        }

        .object-route span {
          padding: 0.34rem 0.48rem;
          border-radius: 999px;
          border: 1px solid rgba(31, 111, 120, 0.14);
          background: rgba(247, 252, 250, 0.9);
          color: #1f6f78;
          font-size: 0.78rem;
          line-height: 1.2;
        }

        .detail-grid,
        .lab-discussion-grid {
          display: grid;
          grid-template-columns: minmax(0, 0.84fr) minmax(0, 1fr);
          gap: 0.8rem;
          min-width: 0;
        }

        .read-first,
        .equation-panel,
        .lab-card,
        .discussion-card {
          padding: 0.9rem;
          border-radius: 18px;
        }

        .demo-witness-summary {
          display: grid;
          gap: 0.55rem;
          margin-top: 0.75rem;
          min-width: 0;
        }

        .demo-witness-summary article {
          display: grid;
          gap: 0.24rem;
          min-width: 0;
          padding: 0.64rem;
          border-radius: 12px;
          border: 1px solid rgba(31, 111, 120, 0.12);
          background: rgba(247, 252, 250, 0.78);
        }

        .demo-witness-summary span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.64rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .demo-witness-summary strong {
          color: #33404d;
          font-size: 0.9rem;
          line-height: 1.38;
          overflow-wrap: anywhere;
        }

        .lab-card :global(.demo-witness-link) {
          margin-top: 0.75rem;
        }

        ul {
          margin: 0.7rem 0 0;
          padding-left: 1.05rem;
          color: #455361;
          line-height: 1.65;
        }

        .read-first :global(li),
        .discussion-card :global(li) {
          color: #455361;
        }

        .equation-tabs {
          margin: 0.75rem 0 0;
        }

        code,
        pre {
          display: block;
          margin: 0.75rem 0 0;
          padding: 0.75rem;
          border-radius: 14px;
          background: #151d27;
          color: #fbf4e8;
          white-space: pre-wrap;
          line-height: 1.5;
        }

        code {
          font-size: 0.9rem;
        }

        .equation-source {
          display: grid;
          gap: 0.22rem;
          margin-top: 0.65rem;
          padding: 0.65rem;
          border-radius: 14px;
          background: rgba(247, 252, 250, 0.9);
        }

        pre {
          max-height: 15rem;
          overflow: auto;
          font-size: 0.78rem;
        }

        .pro-actions {
          margin-top: 0.8rem;
        }

        .pro-note {
          margin: 0.65rem 0 0;
          color: #5b6874;
          font-size: 0.86rem;
          line-height: 1.55;
        }

        @media (max-width: 1120px) {
          .mapper-tool,
          .source-grounding-grid,
          .equation-object-layout,
          .paper-lens-layout,
          .continue-route,
          .detail-grid,
          .lab-discussion-grid {
            grid-template-columns: 1fr;
          }

          .paper-route-bridge {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 760px) {
          .mapper-tool {
            gap: 0.8rem;
          }

          .paper-route-bridge {
            padding: 0.82rem;
            border-radius: 19px;
          }

          .input-pane,
          .output-pane {
            padding: 0.9rem;
            border-radius: 20px;
          }

          .result-header {
            display: grid;
          }

          .confidence {
            max-width: 100%;
          }

          .paper-object-lens-panel {
            padding: 0.82rem;
            border-radius: 18px;
          }

          .paper-object-selector button {
            min-width: 8.8rem;
          }

          .paper-role-lenses {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .paper-object-facts,
          .lens-resolution-strip {
            grid-template-columns: 1fr;
          }

          .paper-lens-actions,
          .paper-lens-actions :global(.paper-lens-action-link),
          .paper-lens-actions button {
            width: 100%;
          }

          .concept-path {
            grid-template-columns: 1fr;
          }

          .object-panel-header {
            display: grid;
          }

          .equation-object-list {
            grid-template-columns: 1fr;
          }

          .bridge-facts {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
