'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { clearDemoState, emitDemoState } from '../../lib/demoState';

const EXPERT_COUNT = 8;
const TOP_K = 2;

const EXPERT_COLORS: string[] = [
  '#fb923c',
  '#22c55e',
  '#38bdf8',
  '#a855f7',
  '#ec4899',
  '#facc15',
  '#14b8a6',
  '#f97316',
];

const EXPERT_LABELS = Array.from({ length: EXPERT_COUNT }, (_, i) => ({
  name: `E${i}`,
  description: 'Toy FFN expert',
}));

// Why-this-expert insight tags
const getExpertInsight = (tokenType: TokenPresetId, expertIndex: number): string => {
  const insights: Record<TokenPresetId, Record<number, string>> = {
    text: {
      0: 'High synthetic logit for this preset',
      5: 'Second-highest synthetic logit',
    },
    code: {
      2: 'High synthetic logit for this preset',
      3: 'Largest synthetic logit',
    },
    math: {
      4: 'Largest synthetic logit',
      5: 'Second-highest synthetic logit',
    },
    rare: {
      1: 'High synthetic logit',
      6: 'Largest synthetic logit',
      7: 'Third-highest synthetic logit',
    },
  };
  return insights[tokenType]?.[expertIndex] || '';
};

type TokenPresetId = 'text' | 'code' | 'math' | 'rare';

type CapacityOutcome = 'capacity-overflow' | 'all-served';
type CapacityPredictionId =
  | CapacityOutcome
  | 'renormalized-backup'
  | 'global-lowest-drop';

type CapacityBatchPresetId = 'text-burst' | 'balanced' | 'rare-burst';

interface TokenPreset {
  label: string;
  logits: number[];
  description: string;
}

interface CapacityPredictionChoice {
  id: CapacityPredictionId;
  label: string;
  explanation: string;
}

interface CapacityBatchPreset {
  label: string;
  tokenIds: TokenPresetId[];
  description: string;
}

// Toy router patterns – different token types favor different experts
const TOKEN_PRESETS: Record<TokenPresetId, TokenPreset> = {
  text: {
    label: 'Natural language',
    logits: [3.2, 2.0, 0.3, -0.5, 0.6, 2.6, -0.2, -1.0],
    description: 'In this synthetic text preset, the router assigns the largest logits to E0 and E5.',
  },
  code: {
    label: 'Code token',
    logits: [0.3, -0.5, 2.6, 3.3, 0.0, 0.4, 1.4, -0.3],
    description: 'In this synthetic code preset, E2 and E3 receive the largest router probabilities.',
  },
  math: {
    label: 'Number / math',
    logits: [-0.4, 0.2, 0.4, 0.5, 3.1, 2.4, 0.3, -0.2],
    description: 'In this synthetic math preset, E4 and E5 receive the largest router probabilities.',
  },
  rare: {
    label: 'Rare / domain token',
    logits: [0.1, 2.7, 0.1, -0.6, 0.2, 0.4, 3.0, 2.4],
    description: 'In this synthetic rare-token preset, the high logits are concentrated on E1, E6, and E7.',
  },
};

const CAPACITY_PREDICTIONS: CapacityPredictionChoice[] = [
  {
    id: 'capacity-overflow',
    label: 'Overloaded expert drops/overflows assignments',
    explanation: 'Per-expert slots fill first; selected token-expert calls beyond capacity cannot run.',
  },
  {
    id: 'all-served',
    label: 'All top-2 selections are served',
    explanation: 'Top-k sparsity would be enough, so capacity never binds in this batch.',
  },
  {
    id: 'renormalized-backup',
    label: 'Router probabilities pick backup experts',
    explanation: 'The router would automatically re-sort into unused experts after capacity fills.',
  },
  {
    id: 'global-lowest-drop',
    label: 'Lowest-score token is globally removed',
    explanation: 'The weakest token in the whole batch would be removed instead of enforcing expert slots.',
  },
];

const MOE_CAPACITY_EVIDENCE_STEPS = [
  {
    label: 'Predict',
    text: 'Commit to served vs overflow before slots fill.',
  },
  {
    label: 'Observe',
    text: 'Reveal expert slot fills and dropped assignments.',
  },
  {
    label: 'Ground',
    text: 'Compare top-k calls with capacity per expert.',
  },
  {
    label: 'Carry',
    text: 'Use max load and overflow, not average sparsity.',
  },
] as const;

const CAPACITY_BATCH_PRESETS: Record<CapacityBatchPresetId, CapacityBatchPreset> = {
  'text-burst': {
    label: 'Batch A',
    tokenIds: ['text', 'text', 'text', 'code', 'math', 'rare'],
    description: 'Six tokens arrive in a fixed order with several repeated language-like items.',
  },
  balanced: {
    label: 'Batch B',
    tokenIds: ['text', 'code', 'math', 'rare'],
    description: 'Four different token patterns arrive once each.',
  },
  'rare-burst': {
    label: 'Batch C',
    tokenIds: ['rare', 'rare', 'rare', 'text', 'code', 'math'],
    description: 'Six tokens arrive with several repeated domain-specific items.',
  },
};

interface CapacityTokenRoute {
  tokenId: string;
  presetId: TokenPresetId;
  experts: number[];
}

interface CapacityAssignment {
  tokenId: string;
  presetId: TokenPresetId;
  expertId: number;
  rank: number;
}

interface CapacityPlan {
  routes: CapacityTokenRoute[];
  servedAssignments: CapacityAssignment[];
  droppedAssignments: CapacityAssignment[];
  expertLoads: number[];
  overflowExpertIds: number[];
  actual: CapacityOutcome;
  topKAssignments: string;
  servedAssignmentsLabel: string;
  droppedAssignmentsLabel: string;
  overflowExpertIdsLabel: string;
  expertLoadsLabel: string;
  overflowRate: number;
  capacityUtilization: number;
}

function softmax(logits: ReadonlyArray<number>): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((acc, v) => acc + v, 0) || 1;
  return exps.map((v) => v / sum);
}

function formatPercent(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

function topKExpertsForPreset(presetId: TokenPresetId): number[] {
  return softmax(TOKEN_PRESETS[presetId].logits)
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .slice(0, TOP_K)
    .map((entry) => entry.index);
}

function formatAssignment(assignment: CapacityAssignment): string {
  return `${assignment.tokenId}:E${assignment.expertId}`;
}

function computeCapacityPlan(
  tokenIds: ReadonlyArray<TokenPresetId>,
  capacityPerExpert: number,
): CapacityPlan {
  const routes = tokenIds.map((presetId, tokenIndex) => ({
    tokenId: `T${tokenIndex}`,
    presetId,
    experts: topKExpertsForPreset(presetId),
  }));
  const expertLoads = new Array(EXPERT_COUNT).fill(0);
  const servedAssignments: CapacityAssignment[] = [];
  const droppedAssignments: CapacityAssignment[] = [];

  routes.forEach((route) => {
    route.experts.forEach((expertId, rank) => {
      const assignment = {
        tokenId: route.tokenId,
        presetId: route.presetId,
        expertId,
        rank: rank + 1,
      };
      if ((expertLoads[expertId] ?? 0) < capacityPerExpert) {
        expertLoads[expertId] = (expertLoads[expertId] ?? 0) + 1;
        servedAssignments.push(assignment);
      } else {
        droppedAssignments.push(assignment);
      }
    });
  });

  const overflowExpertIds = Array.from(
    new Set(droppedAssignments.map((assignment) => assignment.expertId)),
  ).sort((a, b) => a - b);
  const totalAssignments = Math.max(1, routes.length * TOP_K);
  const totalCapacitySlots = Math.max(1, EXPERT_COUNT * capacityPerExpert);
  const topKAssignments = routes
    .map((route) => `${route.tokenId}:E${route.experts.join(',E')}`)
    .join('; ');
  const servedAssignmentsLabel = servedAssignments.length > 0
    ? servedAssignments.map(formatAssignment).join('; ')
    : 'none';
  const droppedAssignmentsLabel = droppedAssignments.length > 0
    ? droppedAssignments.map(formatAssignment).join('; ')
    : 'none';

  return {
    routes,
    servedAssignments,
    droppedAssignments,
    expertLoads,
    overflowExpertIds,
    actual: droppedAssignments.length > 0 ? 'capacity-overflow' : 'all-served',
    topKAssignments,
    servedAssignmentsLabel,
    droppedAssignmentsLabel,
    overflowExpertIdsLabel: overflowExpertIds.length > 0
      ? overflowExpertIds.map((id) => `E${id}`).join(', ')
      : 'none',
    expertLoadsLabel: expertLoads.map((load, i) => `E${i}:${load}/${capacityPerExpert}`).join(', '),
    overflowRate: droppedAssignments.length / totalAssignments,
    capacityUtilization: servedAssignments.length / totalCapacitySlots,
  };
}

type PredictionResult = {
  correctCount: number;
  predicted: number[];
  actual: number[];
} | null;

type MoERoutingVizProps = {
  chrome?: 'legacy' | 'notebook';
  conceptId?: string;
};

function MoERoutingDemo({
  chrome = 'legacy',
  conceptId = 'mixture-of-experts',
}: MoERoutingVizProps) {
  const isNotebook = chrome === 'notebook';
  const [currentPresetId, setCurrentPresetId] = useState<TokenPresetId>('text');
  const [expertUsage, setExpertUsage] = useState<number[]>(
    () => new Array(EXPERT_COUNT).fill(0),
  );

  const [predictionMode, setPredictionMode] = useState(false);
  const [selectedExperts, setSelectedExperts] = useState<number[]>([]);
  const [predictionResult, setPredictionResult] = useState<PredictionResult>(null);
  const [capacityBatchPresetId, setCapacityBatchPresetId] =
    useState<CapacityBatchPresetId>('text-burst');
  const [capacityPerExpert, setCapacityPerExpert] = useState(2);
  const [capacityPrediction, setCapacityPrediction] =
    useState<CapacityPredictionId | null>(null);
  const [capacityRevealed, setCapacityRevealed] = useState(false);

  const probabilities = useMemo(
    () => softmax(TOKEN_PRESETS[currentPresetId].logits),
    [currentPresetId],
  );

  const topKIndices = useMemo(() => {
    const pairs = probabilities.map((score, index) => ({ score, index }));
    pairs.sort((a, b) => b.score - a.score);
    return pairs.slice(0, TOP_K).map((p) => p.index);
  }, [probabilities]);

  const probabilityConcentration = useMemo(() => {
    // Shannon entropy
    const entropy = -probabilities.reduce((sum, p) => {
      if (p > 0) return sum + p * Math.log2(p);
      return sum;
    }, 0);
    return Math.max(0, 1 - entropy / 3);
  }, [probabilities]);

  const concentrationLabel = probabilityConcentration > 0.7 ? 'High' : probabilityConcentration > 0.4 ? 'Medium' : 'Low';

  const totalExpertCalls = useMemo(
    () => expertUsage.reduce((sum, c) => sum + c, 0),
    [expertUsage],
  );
  const routedSampleTokens = useMemo(
    () => Math.floor(totalExpertCalls / TOP_K),
    [totalExpertCalls],
  );
  const maxUsage = useMemo(
    () => expertUsage.reduce((max, v) => Math.max(max, v), 0),
    [expertUsage],
  );

  const toggleExpertPrediction = (index: number) => {
    if (!predictionMode) return;
    setPredictionResult(null);
    setSelectedExperts((prev) => {
      if (prev.includes(index)) {
        return prev.filter((i) => i !== index);
      }
      if (prev.length >= TOP_K) {
        // Replace oldest selection
        return [...prev.slice(1), index];
      }
      return [...prev, index];
    });
  };

  const checkPrediction = () => {
    const correctCount = selectedExperts.filter((i) => topKIndices.includes(i)).length;
    setPredictionResult({
      correctCount,
      predicted: selectedExperts,
      actual: topKIndices,
    });
    setSelectedExperts([]);
  };

  const predictionSummary = useMemo(() => {
    if (predictionResult === null) return null;
    const actual = predictionResult.actual.map((i) => `E${i}`).join(' and ');
    if (predictionResult.correctCount === TOP_K) {
      return `Matched ${TOP_K}/${TOP_K}: the selected experts are exactly the top-${TOP_K} softmax probabilities.`;
    }
    return `Matched ${predictionResult.correctCount}/${TOP_K}. The router activates ${actual} because those probabilities are largest.`;
  }, [predictionResult]);

  const capacityBatch = CAPACITY_BATCH_PRESETS[capacityBatchPresetId];
  const capacityPlan = useMemo(
    () => computeCapacityPlan(capacityBatch.tokenIds, capacityPerExpert),
    [capacityBatch.tokenIds, capacityPerExpert],
  );
  const selectedCapacityPrediction = useMemo(
    () => CAPACITY_PREDICTIONS.find((choice) => choice.id === capacityPrediction) ?? null,
    [capacityPrediction],
  );
  const capacityPredictionCorrect =
    capacityPrediction !== null && capacityPrediction === capacityPlan.actual;
  const actualCapacityLabel =
    capacityPlan.actual === 'capacity-overflow'
      ? 'capacity overflow'
      : 'all selected assignments served';
  const capacityEvidenceActiveIndex = capacityRevealed ? 3 : capacityPrediction ? 1 : 0;
  const capacityEvidencePhase =
    MOE_CAPACITY_EVIDENCE_STEPS[capacityEvidenceActiveIndex]?.label ?? 'Predict';

  const clearCapacityReveal = (clearPrediction = false) => {
    if (clearPrediction) {
      setCapacityPrediction(null);
    }
    setCapacityRevealed(false);
    if (isNotebook) {
      clearDemoState(conceptId);
    }
  };

  const chooseCapacityPrediction = (prediction: CapacityPredictionId) => {
    setCapacityPrediction(prediction);
    clearCapacityReveal(false);
  };

  const applyCapacityBatchPreset = (presetId: CapacityBatchPresetId) => {
    setCapacityBatchPresetId(presetId);
    clearCapacityReveal(true);
  };

  const applyCapacityPerExpert = (capacity: number) => {
    setCapacityPerExpert(capacity);
    clearCapacityReveal(true);
  };

  useEffect(() => {
    if (isNotebook) return;

    const topExperts = topKIndices.map((i) => `E${i}`);
    const topMass = topKIndices.reduce((sum, i) => sum + (probabilities[i] ?? 0), 0);
    const highestLoad = Math.max(...expertUsage);
    const hottestExperts = expertUsage
      .map((count, i) => ({ count, label: `E${i}` }))
      .filter((entry) => entry.count === highestLoad && highestLoad > 0)
      .map((entry) => entry.label);

    emitDemoState({
      conceptId,
      label: 'MoE routing demo',
      summary: `${TOKEN_PRESETS[currentPresetId].label}: top-${TOP_K} routing activates ${topExperts.join(' and ')} in a synthetic router.`,
      values: [
        `top-k probability mass: ${(topMass * 100).toFixed(1)}%`,
        `routed sample tokens: ${routedSampleTokens}`,
        highestLoad > 0
          ? `highest toy load: ${hottestExperts.join(', ')} with ${highestLoad} expert calls`
          : 'highest toy load: none yet',
        predictionResult
          ? `prediction check: ${predictionResult.correctCount}/${TOP_K} matched`
          : 'prediction check: not run',
      ],
    });
  }, [
    conceptId,
    currentPresetId,
    expertUsage,
    isNotebook,
    predictionResult,
    probabilities,
    routedSampleTokens,
    topKIndices,
  ]);

  useEffect(() => {
    if (!isNotebook) return;
    clearDemoState(conceptId);
    return () => clearDemoState(conceptId);
  }, [conceptId, isNotebook]);

  useEffect(() => {
    if (!isNotebook) return;

    emitDemoState({
      conceptId,
      label: 'MoE capacity drop reveal',
      summary: capacityRevealed
        ? `Learner predicted ${selectedCapacityPrediction?.label ?? capacityPrediction ?? 'none'}; revealed ${actualCapacityLabel} with ${capacityPlan.droppedAssignments.length} overflowed token-expert assignments.`
        : `Learner is in the ${capacityEvidencePhase.toLowerCase()} phase for the MoE capacity outcome before final slot fills are shown.`,
      values: [
        'slice: mixture-of-experts-capacity-drop-reveal',
        'evidence loop: predict -> observe -> ground -> carry',
        `evidence phase: ${capacityEvidencePhase}`,
        `prediction: ${selectedCapacityPrediction?.label ?? capacityPrediction ?? 'none'}`,
        `actual: ${capacityRevealed ? capacityPlan.actual : 'hidden until reveal'}`,
        `prediction correct: ${capacityRevealed && capacityPrediction !== null ? (capacityPredictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `batch preset: ${capacityBatch.label}`,
        `token count: ${capacityPlan.routes.length}`,
        `expert count: ${EXPERT_COUNT}`,
        `topK: ${TOP_K}`,
        `capacity per expert: ${capacityPerExpert}`,
        `token order: ${capacityPlan.routes.map((route) => route.tokenId).join(', ')}`,
        `topKAssignments: ${capacityPlan.topKAssignments}`,
        `servedAssignments: ${capacityRevealed ? capacityPlan.servedAssignmentsLabel : 'hidden until reveal'}`,
        `droppedAssignments: ${capacityRevealed ? capacityPlan.droppedAssignmentsLabel : 'hidden until reveal'}`,
        `overflowExpertIds: ${capacityRevealed ? capacityPlan.overflowExpertIdsLabel : 'hidden until reveal'}`,
        `expertLoads: ${capacityRevealed ? capacityPlan.expertLoadsLabel : 'hidden until reveal'}`,
        `overflowRate: ${capacityRevealed ? formatPercent(capacityPlan.overflowRate) : 'hidden until reveal'}`,
        `slotUtilization: ${capacityRevealed ? formatPercent(capacityPlan.capacityUtilization) : 'hidden until reveal'}`,
        `revealed: ${capacityRevealed ? 'yes' : 'no'}`,
      ],
    });
  }, [
    actualCapacityLabel,
    capacityBatch.label,
    capacityEvidencePhase,
    capacityPerExpert,
    capacityPlan,
    capacityPrediction,
    capacityPredictionCorrect,
    capacityRevealed,
    conceptId,
    isNotebook,
    selectedCapacityPrediction,
  ]);

  // Refs for animation
  const sceneRef = useRef<HTMLDivElement | null>(null);
  const tokenSourceRef = useRef<HTMLDivElement | null>(null);
  const routerRef = useRef<HTMLDivElement | null>(null);
  const expertRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const routerBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const usageBarRefs = useRef<(HTMLDivElement | null)[]>([]);
  const tokenBubbleRef = useRef<HTMLDivElement | null>(null);
  const routeTimelineRef = useRef<gsap.core.Timeline | null>(null);

  // Cleanup to prevent state updates after unmount and stop in-flight animations.
  useEffect(() => {
    return () => {
      routeTimelineRef.current?.kill();
      routeTimelineRef.current = null;
    };
  }, []);

  // Hide token bubble initially
  useEffect(() => {
    if (tokenBubbleRef.current) {
      gsap.set(tokenBubbleRef.current, { autoAlpha: 0 });
    }
  }, []);

  // Animate router score bars when probabilities change
  useEffect(() => {
    routerBarRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const p = probabilities[i] ?? 0;
      gsap.to(bar, {
        scaleX: 0.15 + p * 0.85,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
  }, [probabilities]);

  // Animate load-balancing bars when usage changes
  useEffect(() => {
    const denom = maxUsage || 1;
    usageBarRefs.current.forEach((bar, i) => {
      if (!bar) return;
      const count = expertUsage[i] ?? 0;
      const normalized = count / denom;
      gsap.to(bar, {
        scaleY: count === 0 ? 0 : 0.12 + normalized * 0.88,
        duration: 0.6,
        ease: 'power3.out',
      });
    });
  }, [expertUsage, maxUsage]);

  const handleRouteToken = () => {
    if (
      !sceneRef.current ||
      !tokenSourceRef.current ||
      !routerRef.current ||
      !tokenBubbleRef.current ||
      topKIndices.length < TOP_K
    ) {
      return;
    }

    // If in prediction mode with selections, check prediction first
    if (predictionMode && selectedExperts.length === TOP_K) {
      checkPrediction();
    }

    const sceneRect = sceneRef.current.getBoundingClientRect();
    const sourceRect = tokenSourceRef.current.getBoundingClientRect();
    const routerRect = routerRef.current.getBoundingClientRect();

    const expertRect1 =
      expertRefs.current[topKIndices[0]]?.getBoundingClientRect();
    const expertRect2 =
      expertRefs.current[topKIndices[1]]?.getBoundingClientRect();

    if (!expertRect1 || !expertRect2) return;

    const fromX =
      sourceRect.left - sceneRect.left + sourceRect.width * 0.5;
    const fromY =
      sourceRect.top - sceneRect.top + sourceRect.height * 0.5;

    const routerX =
      routerRect.left - sceneRect.left + routerRect.width * 0.5;
    const routerY =
      routerRect.top - sceneRect.top + routerRect.height * 0.5;

    const expert1X =
      expertRect1.left - sceneRect.left + expertRect1.width * 0.5;
    const expert1Y =
      expertRect1.top - sceneRect.top + expertRect1.height * 0.5;

    const expert2X =
      expertRect2.left - sceneRect.left + expertRect2.width * 0.5;
    const expert2Y =
      expertRect2.top - sceneRect.top + expertRect2.height * 0.5;

    const tokenEl = tokenBubbleRef.current;

    if (!tokenEl) return;

    // Update usage counts (visualizing load balancing over time)
    setExpertUsage((prev) => {
      const next = [...prev];
      topKIndices.forEach((idx) => {
        next[idx] = (next[idx] ?? 0) + 1;
      });
      return next;
    });

    // Kill any in-flight timeline
    if (routeTimelineRef.current) {
      routeTimelineRef.current.kill();
    }

    const tl = gsap.timeline();
    routeTimelineRef.current = tl;

    tl.set(tokenEl, {
      x: fromX,
      y: fromY,
      autoAlpha: 1,
    })
      // Token moves into the router
      .to(tokenEl, {
        duration: 0.6,
        x: routerX,
        y: routerY,
        ease: 'power2.inOut',
      })
      // Routed to top-1 expert
      .to(tokenEl, {
        duration: 0.55,
        x: expert1X,
        y: expert1Y,
        ease: 'power2.inOut',
      })
      // Back through router hub (conceptually combining outputs)
      .to(tokenEl, {
        duration: 0.5,
        x: routerX,
        y: routerY,
        ease: 'power2.inOut',
      })
      // Routed to top-2 expert
      .to(tokenEl, {
        duration: 0.55,
        x: expert2X,
        y: expert2Y,
        ease: 'power2.inOut',
      })
      // Fade out
      .to(tokenEl, {
        duration: 0.4,
        autoAlpha: 0,
        ease: 'power2.out',
      });
  };

  return (
    <section className={`moe-card ${chrome}`}>
      <header className="moe-header">
        <div>
          <h2 className="moe-title">Mixture-of-Experts Router</h2>
          <p className="moe-subtitle">
            Each token picks a small subset of experts (top-{TOP_K} of{' '}
            {EXPERT_COUNT}) instead of using the whole layer.
          </p>
        </div>
        <div className="moe-header-right">
          <div className="moe-compute-pill">
            <span className="moe-compute-label">Expert FFN calls</span>
            <span className="moe-compute-value">
              {TOP_K}/{EXPERT_COUNT} experts active for this token
            </span>
          </div>
        </div>
      </header>

      {!isNotebook && (
        <div className="moe-prediction-bar">
          <button
            type="button"
            onClick={() => {
              setPredictionMode(!predictionMode);
              setSelectedExperts([]);
              setPredictionResult(null);
            }}
            className={`moe-prediction-toggle ${predictionMode ? 'active' : ''}`}
            aria-pressed={predictionMode}
          >
            {predictionMode ? 'Close prediction check' : 'Start prediction check'}
          </button>
          {predictionMode && (
            <span className="moe-prediction-hint">
              Select {TOP_K} experts, then route the token to compare against top-k softmax.
              {selectedExperts.length > 0 && ` (${selectedExperts.length}/${TOP_K} selected)`}
            </span>
          )}
          {predictionSummary && (
            <div className="moe-feedback" role="status" aria-live="polite">
              {predictionSummary}
            </div>
          )}
        </div>
      )}

      {isNotebook && (
        <div
          className="moe-capacity-lab"
          data-child-demo-gate="moe-capacity-overflow"
          aria-label="Capacity-limited MoE batch prediction"
        >
          <div className="moe-capacity-toolbar">
            <div className="moe-capacity-control">
              <span>Batch</span>
              <div className="moe-capacity-segment" role="group" aria-label="Capacity batch preset">
                {(Object.entries(CAPACITY_BATCH_PRESETS) as [CapacityBatchPresetId, CapacityBatchPreset][])
                  .map(([presetId, preset]) => (
                    <button
                      key={presetId}
                      type="button"
                      aria-pressed={capacityBatchPresetId === presetId}
                      onClick={() => applyCapacityBatchPreset(presetId)}
                    >
                      {preset.label}
                    </button>
                  ))}
              </div>
            </div>
            <div className="moe-capacity-control">
              <span>Capacity / expert</span>
              <div className="moe-capacity-segment" role="group" aria-label="Capacity per expert">
                {[1, 2, 3].map((capacity) => (
                  <button
                    key={capacity}
                    type="button"
                    aria-pressed={capacityPerExpert === capacity}
                    onClick={() => applyCapacityPerExpert(capacity)}
                  >
                    {capacity}
                  </button>
                ))}
              </div>
            </div>
            <div className="moe-capacity-stat">
              top-{TOP_K} candidates, {EXPERT_COUNT} experts
            </div>
          </div>

          <div className="moe-capacity-intro">
            <strong>{capacityBatch.label}</strong>
            <span>{capacityBatch.description}</span>
          </div>

          <div className="moe-capacity-grid">
            <div className="moe-capacity-panel">
              <div className="moe-capacity-panel-heading">
                <span>Visible candidate routing</span>
                <span>token order fixed</span>
              </div>
              <div className="moe-capacity-routes">
                {capacityPlan.routes.map((route) => (
                  <div key={route.tokenId} className="moe-capacity-route-row">
                    <div>
                      <strong>{route.tokenId}</strong>
                      <span>{TOKEN_PRESETS[route.presetId].label}</span>
                    </div>
                    <div className="moe-capacity-candidate-list">
                      {route.experts.map((expertId) => (
                        <span key={`${route.tokenId}-${expertId}`}>
                          E{expertId}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="moe-capacity-panel">
              <div className="moe-capacity-panel-heading">
                <span>Expert slots</span>
                <span>{capacityRevealed ? 'filled after reveal' : 'outcome hidden'}</span>
              </div>
              <div className="moe-capacity-slots">
                {Array.from({ length: EXPERT_COUNT }).map((_, expertId) => {
                  const servedForExpert = capacityPlan.servedAssignments
                    .filter((assignment) => assignment.expertId === expertId);
                  const droppedForExpert = capacityPlan.droppedAssignments
                    .filter((assignment) => assignment.expertId === expertId);
                  return (
                    <div key={expertId} className="moe-capacity-expert-slot">
                      <div className="moe-capacity-expert-title">E{expertId}</div>
                      <div className="moe-capacity-slot-stack">
                        {Array.from({ length: capacityPerExpert }).map((__, slotIndex) => (
                          <span
                            key={`${expertId}-${slotIndex}`}
                            className={capacityRevealed && servedForExpert[slotIndex] ? 'filled' : ''}
                            aria-label={
                              capacityRevealed && servedForExpert[slotIndex]
                                ? `E${expertId} slot ${slotIndex + 1} filled by ${servedForExpert[slotIndex].tokenId}`
                                : `E${expertId} slot ${slotIndex + 1} hidden`
                            }
                          >
                            {capacityRevealed && servedForExpert[slotIndex]
                              ? servedForExpert[slotIndex].tokenId
                              : 'slot'}
                          </span>
                        ))}
                      </div>
                      {capacityRevealed && droppedForExpert.length > 0 && (
                        <div className="moe-capacity-drop-list">
                          {droppedForExpert.map((assignment) => (
                            <span
                              key={`${assignment.tokenId}-${assignment.expertId}-${assignment.rank}`}
                              aria-label={`E${expertId} overflowed ${assignment.tokenId}`}
                            >
                              {assignment.tokenId}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="moe-capacity-prediction" role="group" aria-label="Capacity outcome prediction">
            <div className="moe-capacity-panel-heading">
              <span>Predict the capacity outcome</span>
              <span>{capacityPrediction ? 'ready to reveal' : 'choose one'}</span>
            </div>
            <div className="moe-capacity-options">
              {CAPACITY_PREDICTIONS.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={capacityPrediction === choice.id}
                  onClick={() => chooseCapacityPrediction(choice.id)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.explanation}</span>
                </button>
              ))}
            </div>
            <div className="moe-capacity-evidence-strip" aria-label="MoE capacity evidence loop">
              {MOE_CAPACITY_EVIDENCE_STEPS.map((step, index) => (
                <div
                  key={step.label}
                  className={
                    index <= capacityEvidenceActiveIndex
                      ? 'moe-capacity-evidence-step evidence-step active'
                      : 'moe-capacity-evidence-step evidence-step'
                  }
                >
                  <strong>{step.label}</strong>
                  <span>{step.text}</span>
                </div>
              ))}
            </div>
            <div className="moe-capacity-actions">
              <button
                type="button"
                className="moe-capacity-reveal"
                disabled={capacityPrediction === null}
                onClick={() => setCapacityRevealed(true)}
              >
                Reveal capacity outcome
              </button>
              <span>
                {capacityPrediction === null
                  ? 'Final dispatch details stay hidden until you commit.'
                  : 'Reveal to compare the prediction with the per-expert slots.'}
              </span>
            </div>
          </div>

          {capacityRevealed ? (
            <div
              className={`moe-capacity-result ${capacityPredictionCorrect ? 'correct' : 'missed'}`}
              role="status"
              aria-live="polite"
            >
              <strong>
                {capacityPredictionCorrect
                  ? 'Prediction matched.'
                  : `Prediction missed. Actual: ${actualCapacityLabel}.`}
              </strong>
              <span>
                Served assignments: {capacityPlan.servedAssignmentsLabel}
              </span>
              <span>
                Dropped assignments: {capacityPlan.droppedAssignmentsLabel}
              </span>
              <span>
                Overflow experts: {capacityPlan.overflowExpertIdsLabel}; slot utilization {formatPercent(capacityPlan.capacityUtilization)}.
              </span>
            </div>
          ) : (
            <div className="moe-capacity-locked">
              Result readout hidden until reveal.
            </div>
          )}
        </div>
      )}

      {!isNotebook && (
      <div className="moe-main">
        {/* Left: controls + misconception explainer */}
        <div className="moe-left-panel">
          <div className="moe-control-group">
            <div className="moe-control-label">Token type</div>
            <div className="moe-token-types">
              {(Object.entries(TOKEN_PRESETS) as [TokenPresetId, TokenPreset][])
                .map(([id, preset]) => {
                  const isActive = currentPresetId === id;
                  const isRare = id === 'rare';
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        setCurrentPresetId(id);
                        setSelectedExperts([]);
                        setPredictionResult(null);
                      }}
                      className={`moe-token-pill ${isActive ? 'active' : ''} ${isRare && isActive ? 'rare' : ''}`}
                      aria-pressed={isActive}
                    >
                      <span className="moe-token-pill-dot" />
                      <span className="moe-token-pill-label">
                        {preset.label}
                      </span>
                    </button>
                  );
                })}
            </div>
            <p className="moe-token-description">
              {TOKEN_PRESETS[currentPresetId].description}
            </p>
            <div className="moe-confidence-meter">
              <span className="moe-confidence-label">Softmax concentration:</span>
              <div className="moe-confidence-bar-track">
                <div
                  className="moe-confidence-bar-fill"
                  style={{
                    width: `${probabilityConcentration * 100}%`,
                    background: probabilityConcentration > 0.7 ? '#22c55e' : probabilityConcentration > 0.4 ? '#facc15' : '#ef4444'
                  }}
                />
              </div>
              <span className="moe-confidence-value">{concentrationLabel}</span>
            </div>
            <button
              type="button"
              onClick={handleRouteToken}
              className="moe-route-button"
            >
              Route a sample token
            </button>
          </div>

          <div className="moe-myth-card">
            <div className="moe-myth-title">Total parameters do not equal activated compute</div>
            <p className="moe-myth-body">
              A sparse MoE layer stores many expert FFNs, but each token only
              dispatches to the selected top-k experts. Shared layers still run,
              and real serving cost also depends on routing skew, capacity,
              memory movement, and all-to-all communication.
            </p>
            <div className="moe-myth-diagram">
              <div className="moe-myth-row">
                <span className="moe-myth-row-label">Shared trunk</span>
                <div className="moe-myth-shared-bar">
                  <span className="moe-myth-shared-label">
                    Attention + other shared work
                  </span>
                </div>
              </div>
              <div className="moe-myth-row">
                <span className="moe-myth-row-label">Expert FFNs</span>
                <div className="moe-myth-expert-strip">
                  {Array.from({ length: EXPERT_COUNT }).map((_, i) => (
                    <div
                      key={i}
                      className="moe-myth-expert-chunk"
                      style={{ background: EXPERT_COLORS[i] }}
                    />
                  ))}
                </div>
              </div>
              <p className="moe-myth-footnote">
                This toy separates expert activation from the full systems cost
                of running a real MoE model.
              </p>
            </div>
          </div>
        </div>

        {/* Right: main visualization */}
        <div className="moe-right-panel">
          {/* Scene: token → router → experts */}
          <div ref={sceneRef} className="moe-scene">
            {/* This bubble is animated with GSAP in absolute coordinates */}
            <div ref={tokenBubbleRef} className="moe-token-bubble">
              token
            </div>

            <div className="moe-pipeline">
              {/* Tokens column (source for animation) */}
              <div
                className="moe-column moe-tokens-column"
                ref={tokenSourceRef}
              >
                <div className="moe-column-title">Tokens</div>
                <div className="moe-token-stack">
                  <div className="moe-token-pill">t₀</div>
                  <div className="moe-token-pill">t₁</div>
                  <div className="moe-token-pill">t₂</div>
                  <div className="moe-token-ellipsis">…</div>
                </div>
                <p className="moe-column-caption">
                  Router runs once per token to pick its experts.
                </p>
              </div>

              {/* Router column with score bars */}
              <div className="moe-column moe-router-column">
                <div ref={routerRef} className="moe-router-card">
                  <div className="moe-router-title">Router</div>
                  <p className="moe-router-caption">
                    Produces logits and softmax scores over experts.
                  </p>
                  <div className="moe-router-bars">
                    {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                      const score = probabilities[i] ?? 0;
                      const isTop = topKIndices.includes(i);
                      return (
                        <div
                          key={i}
                          className={`moe-router-bar-row ${
                            isTop ? 'top' : ''
                          }`}
                        >
                          <span className="moe-router-bar-label">
                            E{i}
                          </span>
                          <div className="moe-router-bar-track">
                            <div
                              ref={(el) => {
                                routerBarRefs.current[i] = el;
                              }}
                              className="moe-router-bar-fill"
                              style={{
                                background: EXPERT_COLORS[i],
                              }}
                            />
                          </div>
                          <span className="moe-router-bar-value">
                            {formatPercent(score)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Experts column */}
              <div className="moe-column moe-experts-column">
                <div className="moe-column-title">Experts (FFNs)</div>
                <div className="moe-expert-grid">
                  {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                    const isActive = topKIndices.includes(i);
                    const isHighestLoad =
                      maxUsage > 0 && expertUsage[i] === maxUsage;
                    const isPredicted = selectedExperts.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        ref={(el) => {
                          expertRefs.current[i] = el;
                        }}
                        onClick={() => toggleExpertPrediction(i)}
                        disabled={!predictionMode}
                        aria-pressed={predictionMode ? isPredicted : undefined}
                        aria-label={`Expert E${i}. ${isActive ? 'Active for this token. ' : ''}${isPredicted ? 'Selected prediction.' : 'Not selected.'}`}
                        className={`moe-expert-box ${
                          isActive ? 'active' : ''
                        } ${isHighestLoad ? 'hot' : ''} ${isPredicted ? 'predicted' : ''} ${predictionMode ? 'clickable' : ''}`}
                        style={{
                          borderColor: EXPERT_COLORS[i],
                          cursor: predictionMode ? 'pointer' : 'default',
                        }}
                      >
                        <div className="moe-expert-header">
                          <span className="moe-expert-id">
                            {EXPERT_LABELS[i].name}
                          </span>
                        </div>
                        {isActive && (
                          <div className="moe-expert-insight">
                            {getExpertInsight(currentPresetId, i) || EXPERT_LABELS[i].description}
                          </div>
                        )}
                        <div className="moe-expert-body">
                          <span className="moe-expert-chip">
                            FFN weights
                          </span>
                          {isPredicted && (
                            <span className="moe-expert-chip predicted-chip">
                              predicted
                            </span>
                          )}
                          {isActive && (
                            <span className="moe-expert-chip active-chip">
                              active
                            </span>
                          )}
                          {isHighestLoad && !isActive && (
                            <span className="moe-expert-chip hot-chip">
                              highest toy load
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <p className="moe-column-caption">
                  Only the highlighted experts run for the current token.
                </p>
              </div>
            </div>
          </div>

          {/* Load-balancing visualization */}
          <div className="moe-load-section">
            <div className="moe-load-header">
              <span className="moe-load-title">Expert load</span>
              <span className="moe-load-subtitle">
                {routedSampleTokens === 0
                  ? 'Route a few tokens to see usage'
                  : `${routedSampleTokens} sample tokens routed so far`}
              </span>
            </div>
            <div className="moe-load-chart">
              {Array.from({ length: EXPERT_COUNT }).map((_, i) => {
                const usage = expertUsage[i] ?? 0;
                const isOverloaded =
                  maxUsage > 0 && usage === maxUsage && usage > 0;
                return (
                  <div key={i} className="moe-load-bar-group">
                    <div className="moe-load-bar-track">
                      <div
                        ref={(el) => {
                          usageBarRefs.current[i] = el;
                        }}
                        className={`moe-load-bar-fill ${
                          isOverloaded ? 'hot' : ''
                        }`}
                        style={{
                          background: EXPERT_COLORS[i],
                        }}
                      />
                    </div>
                    <div className="moe-load-bar-label">E{i}</div>
                    <div className="moe-load-bar-count">
                      {usage}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="moe-load-caption">
              This shows usage skew from repeated toy routing. Real systems
              also enforce capacity factors and dispatch constraints.
            </p>
          </div>
        </div>
      </div>
      )}

      {/* Component-scoped styles */}
      <style jsx>{`
        .moe-card {
          background: #080c14;
          border-radius: 16px;
          padding: 20px 22px 24px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          color: #e5e7eb;
          box-shadow: 0 22px 45px rgba(15, 23, 42, 0.7);
          font-family: system-ui, -apple-system, BlinkMacSystemFont,
            'SF Pro Text', sans-serif;
        }

        .moe-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .moe-header-right {
          display: flex;
          align-items: flex-start;
          gap: 12px;
        }

        .moe-prediction-bar {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-top: 12px;
          margin-bottom: 8px;
        }

        .moe-prediction-toggle {
          padding: 8px 16px;
          border-radius: 999px;
          border: 1px solid rgba(56, 189, 248, 0.5);
          background: rgba(15, 23, 42, 0.95);
          color: #e5e7eb;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .moe-prediction-toggle:hover {
          border-color: rgba(56, 189, 248, 0.8);
          background: rgba(56, 189, 248, 0.1);
        }

        .moe-prediction-toggle:focus-visible,
        .moe-route-button:focus-visible,
        .moe-token-pill:focus-visible,
        .moe-expert-box:focus-visible,
        .moe-capacity-segment button:focus-visible,
        .moe-capacity-options button:focus-visible,
        .moe-capacity-reveal:focus-visible {
          outline: 2px solid rgba(56, 189, 248, 0.8);
          outline-offset: 2px;
        }

        .moe-prediction-toggle.active {
          background: linear-gradient(135deg, rgba(56, 189, 248, 0.2), rgba(168, 85, 247, 0.2));
          border-color: rgba(168, 85, 247, 0.7);
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.3);
        }

        .moe-prediction-hint {
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .moe-feedback {
          padding: 8px 14px;
          border-radius: 8px;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.3);
          font-size: 0.85rem;
          animation: fadeIn 0.3s ease;
        }

        .moe-capacity-lab {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 18px;
        }

        .moe-capacity-toolbar {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 10px;
          padding: 10px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(15, 23, 42, 0.92);
        }

        .moe-capacity-control {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
          color: #9ca3af;
        }

        .moe-capacity-segment {
          display: inline-flex;
          gap: 4px;
          padding: 3px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(148, 163, 184, 0.24);
        }

        .moe-capacity-segment button,
        .moe-capacity-options button,
        .moe-capacity-reveal {
          appearance: none;
          border: 1px solid transparent;
          color: inherit;
          font: inherit;
          cursor: pointer;
        }

        .moe-capacity-segment button {
          padding: 5px 10px;
          border-radius: 999px;
          background: transparent;
          font-size: 0.78rem;
        }

        .moe-capacity-segment button[aria-pressed='true'] {
          background: rgba(56, 189, 248, 0.18);
          border-color: rgba(56, 189, 248, 0.4);
          color: #e0f2fe;
        }

        .moe-capacity-stat {
          margin-left: auto;
          color: #9ca3af;
          font-size: 0.78rem;
        }

        .moe-capacity-intro {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #d1d5db;
          font-size: 0.84rem;
        }

        .moe-capacity-intro span {
          color: #9ca3af;
        }

        .moe-capacity-grid {
          display: grid;
          grid-template-columns: minmax(240px, 0.9fr) minmax(320px, 1.4fr);
          gap: 12px;
        }

        .moe-capacity-panel,
        .moe-capacity-prediction,
        .moe-capacity-result,
        .moe-capacity-locked {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          background: rgba(15, 23, 42, 0.92);
          padding: 12px;
        }

        .moe-capacity-panel-heading {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 10px;
          margin-bottom: 10px;
          font-size: 0.82rem;
          font-weight: 600;
        }

        .moe-capacity-panel-heading span:last-child {
          color: #9ca3af;
          font-size: 0.72rem;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .moe-capacity-routes {
          display: grid;
          gap: 6px;
        }

        .moe-capacity-route-row {
          display: grid;
          grid-template-columns: minmax(128px, 1fr) auto;
          gap: 10px;
          align-items: center;
          padding: 7px 8px;
          border-radius: 8px;
          background: rgba(2, 6, 23, 0.42);
        }

        .moe-capacity-route-row div:first-child {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .moe-capacity-route-row span {
          color: #9ca3af;
          font-size: 0.74rem;
        }

        .moe-capacity-candidate-list {
          display: flex;
          gap: 4px;
        }

        .moe-capacity-candidate-list span,
        .moe-capacity-slot-stack span,
        .moe-capacity-drop-list span {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 32px;
          min-height: 24px;
          padding: 3px 7px;
          border-radius: 999px;
          font-size: 0.72rem;
          font-variant-numeric: tabular-nums;
        }

        .moe-capacity-candidate-list span {
          color: #dbeafe;
          background: rgba(59, 130, 246, 0.18);
          border: 1px solid rgba(59, 130, 246, 0.28);
        }

        .moe-capacity-slots {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .moe-capacity-expert-slot {
          display: flex;
          flex-direction: column;
          gap: 5px;
          min-width: 0;
          padding: 8px;
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.4);
          border: 1px solid rgba(148, 163, 184, 0.16);
        }

        .moe-capacity-expert-title {
          color: #e5e7eb;
          font-size: 0.76rem;
          font-weight: 700;
        }

        .moe-capacity-slot-stack,
        .moe-capacity-drop-list {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .moe-capacity-slot-stack span {
          color: #94a3b8;
          background: rgba(15, 23, 42, 0.84);
          border: 1px dashed rgba(148, 163, 184, 0.3);
        }

        .moe-capacity-slot-stack span.filled {
          color: #dcfce7;
          background: rgba(34, 197, 94, 0.16);
          border-style: solid;
          border-color: rgba(34, 197, 94, 0.34);
        }

        .moe-capacity-drop-list span {
          color: #fee2e2;
          background: rgba(220, 38, 38, 0.16);
          border: 1px solid rgba(220, 38, 38, 0.3);
        }

        .moe-capacity-options {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
        }

        .moe-capacity-options button {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 3px;
          padding: 9px 10px;
          border-radius: 10px;
          background: rgba(2, 6, 23, 0.44);
          border-color: rgba(148, 163, 184, 0.2);
          text-align: left;
        }

        .moe-capacity-options button[aria-pressed='true'] {
          background: rgba(31, 111, 120, 0.2);
          border-color: rgba(45, 212, 191, 0.42);
        }

        .moe-capacity-options button strong {
          color: #f8fafc;
          font-size: 0.8rem;
          line-height: 1.25;
        }

        .moe-capacity-options button span {
          color: #9ca3af;
          font-size: 0.72rem;
          line-height: 1.35;
        }

        .moe-capacity-evidence-strip {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
          margin-top: 10px;
          padding: 8px;
          border-radius: 12px;
          border: 1px solid rgba(45, 212, 191, 0.2);
          background:
            linear-gradient(135deg, rgba(20, 184, 166, 0.18), rgba(15, 23, 42, 0.94)),
            rgba(15, 23, 42, 0.92);
        }

        .moe-capacity-evidence-step {
          display: grid;
          gap: 3px;
          min-width: 0;
          padding: 8px;
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.18);
          background: rgba(2, 6, 23, 0.38);
          opacity: 0.58;
        }

        .moe-capacity-evidence-step.active {
          opacity: 1;
          border-color: rgba(45, 212, 191, 0.36);
          background: rgba(6, 78, 89, 0.34);
        }

        .moe-capacity-evidence-step strong {
          color: #ccfbf1;
          font-size: 0.73rem;
          line-height: 1.2;
        }

        .moe-capacity-evidence-step span {
          color: #cbd5e1;
          font-size: 0.7rem;
          line-height: 1.34;
          overflow-wrap: anywhere;
        }

        .moe-capacity-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 10px;
        }

        .moe-capacity-reveal {
          padding: 8px 13px;
          border-radius: 999px;
          background: #1f6f78;
          border-color: rgba(45, 212, 191, 0.32);
          color: #ecfeff;
          font-weight: 700;
        }

        .moe-capacity-reveal:disabled {
          cursor: not-allowed;
          opacity: 0.55;
        }

        .moe-capacity-actions span {
          color: #9ca3af;
          font-size: 0.76rem;
        }

        .moe-capacity-result {
          display: grid;
          gap: 5px;
          font-size: 0.82rem;
        }

        .moe-capacity-result.correct {
          border-color: rgba(34, 197, 94, 0.38);
          background: rgba(22, 101, 52, 0.14);
        }

        .moe-capacity-result.missed {
          border-color: rgba(251, 146, 60, 0.38);
          background: rgba(154, 52, 18, 0.14);
        }

        .moe-capacity-result strong {
          color: #f8fafc;
        }

        .moe-capacity-result span,
        .moe-capacity-locked {
          color: #cbd5e1;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .moe-title {
          font-size: 1.1rem;
          font-weight: 600;
          letter-spacing: 0.01em;
          margin: 0;
        }

        .moe-subtitle {
          margin: 4px 0 0;
          font-size: 0.85rem;
          color: #9ca3af;
        }

        .moe-compute-pill {
          background: radial-gradient(
              circle at top left,
              rgba(244, 244, 245, 0.16),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.96);
          border-radius: 999px;
          padding: 8px 14px;
          font-size: 0.8rem;
          border: 1px solid rgba(248, 250, 252, 0.2);
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
          white-space: nowrap;
        }

        .moe-compute-label {
          color: #9ca3af;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 0.65rem;
        }

        .moe-compute-value {
          font-variant-numeric: tabular-nums;
          font-weight: 600;
        }

        .moe-main {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          margin-top: 18px;
        }

        .moe-left-panel {
          flex: 0 0 260px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .moe-right-panel {
          flex: 1;
          min-width: 280px;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .moe-control-group {
          padding: 12px 12px 14px;
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: radial-gradient(
              circle at top left,
              rgba(56, 189, 248, 0.1),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.96);
        }

        .moe-control-label {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
          margin-bottom: 6px;
        }

        .moe-token-types {
          display: flex;
          flex-direction: column;
          gap: 6px;
          margin-bottom: 8px;
        }

        .moe-token-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 9px;
          border-radius: 999px;
          border: 1px solid rgba(148, 163, 184, 0.5);
          background: rgba(15, 23, 42, 0.85);
          font-size: 0.8rem;
          color: #e5e7eb;
          cursor: pointer;
          transition: background 0.18s ease, border-color 0.18s ease,
            transform 0.12s ease;
        }

        .moe-token-pill-dot {
          width: 7px;
          height: 7px;
          border-radius: 999px;
          background: #38bdf8;
          box-shadow: 0 0 10px rgba(56, 189, 248, 0.8);
        }

        .moe-token-pill-label {
          white-space: nowrap;
        }

        .moe-token-pill:hover {
          border-color: rgba(248, 250, 252, 0.7);
          transform: translateY(-0.5px);
        }

        .moe-token-pill.active {
          background: radial-gradient(
              circle at top left,
              rgba(251, 146, 60, 0.3),
              transparent 70%
            ),
            rgba(15, 23, 42, 0.98);
          border-color: rgba(251, 146, 60, 1);
        }

        .moe-token-pill.rare {
          animation: rareShimmer 2s infinite;
          background: linear-gradient(
            135deg,
            rgba(168, 85, 247, 0.3),
            rgba(236, 72, 153, 0.3),
            rgba(251, 146, 60, 0.3)
          );
          border-color: rgba(168, 85, 247, 0.8);
        }

        @keyframes rareShimmer {
          0%, 100% { filter: brightness(1); }
          50% { filter: brightness(1.2); }
        }

        .moe-token-description {
          margin: 4px 0 8px;
          font-size: 0.8rem;
          color: #9ca3af;
        }

        .moe-confidence-meter {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          font-size: 0.75rem;
        }

        .moe-confidence-label {
          color: #9ca3af;
          white-space: nowrap;
        }

        .moe-confidence-bar-track {
          flex: 1;
          height: 6px;
          background: rgba(31, 41, 55, 0.9);
          border-radius: 999px;
          overflow: hidden;
        }

        .moe-confidence-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.3s ease, background 0.3s ease;
        }

        .moe-confidence-value {
          min-width: 70px;
          text-align: right;
          font-weight: 500;
        }

        .moe-route-button {
          width: 100%;
          margin-top: 4px;
          padding: 7px 10px;
          border-radius: 999px;
          border: none;
          font-size: 0.8rem;
          font-weight: 500;
          cursor: pointer;
          background: linear-gradient(
            90deg,
            #fb923c,
            #facc15
          );
          color: #111827;
          box-shadow: 0 10px 25px rgba(248, 250, 252, 0.3);
          transition: transform 0.12s ease, box-shadow 0.12s ease,
            filter 0.1s ease;
        }

        .moe-route-button:hover {
          transform: translateY(-1px);
          filter: brightness(1.03);
          box-shadow: 0 16px 35px rgba(15, 23, 42, 0.8);
        }

        .moe-route-button:active {
          transform: translateY(0);
          box-shadow: 0 8px 18px rgba(15, 23, 42, 0.8);
        }

        .moe-myth-card {
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px dashed rgba(148, 163, 184, 0.6);
          background: rgba(15, 23, 42, 0.85);
        }

        .moe-myth-title {
          font-size: 0.8rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .moe-myth-body {
          font-size: 0.8rem;
          color: #9ca3af;
          margin: 0 0 8px;
        }

        .moe-myth-diagram {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .moe-myth-row {
          display: grid;
          grid-template-columns: 84px minmax(0, 1fr);
          gap: 6px;
          align-items: center;
        }

        .moe-myth-row-label {
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .moe-myth-shared-bar {
          position: relative;
          border-radius: 999px;
          height: 14px;
          background: linear-gradient(
            90deg,
            rgba(56, 189, 248, 0.25),
            rgba(129, 140, 248, 0.6)
          );
        }

        .moe-myth-shared-label {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.65rem;
          color: #f9fafb;
          text-shadow: 0 1px 2px rgba(15, 23, 42, 0.8);
        }

        .moe-myth-expert-strip {
          display: grid;
          grid-template-columns: repeat(8, 1fr);
          gap: 2px;
        }

        .moe-myth-expert-chunk {
          height: 12px;
          border-radius: 4px;
          opacity: 0.9;
        }

        .moe-myth-footnote {
          margin: 4px 0 0;
          font-size: 0.72rem;
          color: #9ca3af;
        }

        .moe-scene {
          position: relative;
          border-radius: 14px;
          border: 1px solid rgba(31, 41, 55, 0.9);
          background: radial-gradient(
              circle at top left,
              rgba(148, 163, 184, 0.15),
              transparent 55%
            ),
            radial-gradient(
              circle at bottom right,
              rgba(56, 189, 248, 0.12),
              transparent 55%
            ),
            #020617;
          padding: 14px 14px 16px;
          overflow: hidden;
        }

        .moe-token-bubble {
          position: absolute;
          width: 26px;
          height: 26px;
          border-radius: 999px;
          background: radial-gradient(
            circle at 30% 20%,
            #fef9c3,
            #fb923c
          );
          box-shadow: 0 0 18px rgba(251, 146, 60, 0.9);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          color: #111827;
          font-weight: 600;
          transform: translate(-50%, -50%);
          pointer-events: none;
        }

        .moe-pipeline {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr 1.4fr;
          gap: 16px;
          align-items: stretch;
        }

        .moe-column {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .moe-column-title {
          font-size: 0.8rem;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #9ca3af;
        }

        .moe-column-caption {
          font-size: 0.75rem;
          color: #6b7280;
          margin: 0;
        }

        .moe-tokens-column {
          align-items: flex-start;
        }

        .moe-token-stack {
          display: inline-flex;
          flex-direction: column;
          gap: 4px;
        }

        .moe-token-stack .moe-token-pill {
          border-radius: 999px;
          padding: 4px 10px;
          font-size: 0.75rem;
          background: rgba(15, 23, 42, 0.95);
          border: 1px solid rgba(148, 163, 184, 0.6);
        }

        .moe-token-ellipsis {
          font-size: 0.75rem;
          color: #9ca3af;
          padding-left: 2px;
        }

        .moe-router-card {
          border-radius: 12px;
          padding: 10px 10px 8px;
          background: rgba(15, 23, 42, 0.96);
          border: 1px solid rgba(55, 65, 81, 1);
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.7);
        }

        .moe-router-title {
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 4px;
        }

        .moe-router-caption {
          margin: 0 0 6px;
          font-size: 0.75rem;
          color: #9ca3af;
        }

        .moe-router-bars {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .moe-router-bar-row {
          display: grid;
          grid-template-columns: 30px minmax(0, 1fr) 52px;
          gap: 6px;
          align-items: center;
          font-size: 0.75rem;
        }

        .moe-router-bar-row.top .moe-router-bar-track {
          box-shadow: 0 0 0 1px rgba(248, 250, 252, 0.22);
        }

        .moe-router-bar-label {
          color: #9ca3af;
          font-variant-numeric: tabular-nums;
        }

        .moe-router-bar-track {
          position: relative;
          height: 8px;
          border-radius: 999px;
          background: rgba(31, 41, 55, 0.95);
          overflow: hidden;
        }

        .moe-router-bar-fill {
          position: absolute;
          inset: 0;
          transform-origin: left center;
          transform: scaleX(0.15);
          border-radius: 999px;
          box-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
        }

        .moe-router-bar-value {
          text-align: right;
          font-variant-numeric: tabular-nums;
          color: #e5e7eb;
        }

        .moe-experts-column {
          align-items: stretch;
        }

        .moe-expert-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 8px;
        }

        .moe-expert-box {
          appearance: none;
          text-align: left;
          color: inherit;
          font: inherit;
          border-radius: 10px;
          border: 1px solid rgba(55, 65, 81, 1);
          padding: 6px 6px 7px;
          background: rgba(15, 23, 42, 0.98);
          transition: box-shadow 0.16s ease, transform 0.16s ease,
            border-color 0.16s ease;
          position: relative;
        }

        .moe-expert-box:disabled {
          cursor: default;
          opacity: 1;
        }

        .moe-expert-box::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: inherit;
          border: 0 solid transparent;
          opacity: 0;
          pointer-events: none;
        }

        .moe-expert-box.active {
          box-shadow: 0 0 22px rgba(251, 146, 60, 0.9);
          transform: translateY(-1px);
        }

        .moe-expert-box.active::before {
          border-width: 1px;
          border-image: linear-gradient(
              135deg,
              rgba(251, 146, 60, 0.1),
              rgba(56, 189, 248, 0.5)
            )
            1;
          opacity: 1;
        }

        .moe-expert-box.hot:not(.active) {
          box-shadow: 0 0 18px rgba(220, 38, 38, 0.9);
        }

        .moe-expert-box.clickable {
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .moe-expert-box.clickable:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 15px rgba(56, 189, 248, 0.3);
        }

        .moe-expert-box.predicted {
          box-shadow: 0 0 20px rgba(168, 85, 247, 0.8);
          border-color: #a855f7 !important;
          transform: translateY(-2px);
        }

        .predicted-chip {
          background: rgba(168, 85, 247, 0.2);
          color: #d8b4fe;
          border: 1px solid rgba(168, 85, 247, 0.6);
        }

        .moe-expert-header {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-bottom: 4px;
        }

        .moe-expert-id {
          font-size: 0.76rem;
          font-weight: 600;
        }

        .moe-expert-insight {
          font-size: 0.65rem;
          color: #fde68a;
          background: rgba(251, 191, 36, 0.15);
          border-radius: 4px;
          padding: 2px 6px;
          margin-bottom: 4px;
          animation: insightPop 0.3s ease;
        }

        @keyframes insightPop {
          0% { opacity: 0; transform: scale(0.8); }
          100% { opacity: 1; transform: scale(1); }
        }

        .moe-expert-body {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .moe-expert-chip {
          padding: 2px 6px;
          border-radius: 999px;
          font-size: 0.68rem;
          background: rgba(31, 41, 55, 1);
          color: #d1d5db;
        }

        .active-chip {
          background: rgba(251, 146, 60, 0.15);
          color: #fed7aa;
          border: 1px solid rgba(251, 146, 60, 0.7);
        }

        .hot-chip {
          background: rgba(220, 38, 38, 0.15);
          color: #fecaca;
          border: 1px solid rgba(220, 38, 38, 0.7);
        }

        .moe-load-section {
          border-radius: 12px;
          border: 1px solid rgba(31, 41, 55, 1);
          padding: 10px 12px 12px;
          background: radial-gradient(
              circle at top left,
              rgba(251, 146, 60, 0.16),
              transparent 60%
            ),
            rgba(15, 23, 42, 0.98);
        }

        .moe-load-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          font-size: 0.8rem;
          margin-bottom: 8px;
        }

        .moe-load-title {
          font-weight: 600;
        }

        .moe-load-subtitle {
          color: #9ca3af;
          font-size: 0.75rem;
        }

        .moe-load-chart {
          display: grid;
          grid-template-columns: repeat(8, minmax(0, 1fr));
          gap: 6px;
          align-items: flex-end;
          margin-bottom: 4px;
        }

        .moe-load-bar-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 3px;
          font-size: 0.7rem;
        }

        .moe-load-bar-track {
          width: 100%;
          height: 60px;
          border-radius: 999px;
          background: rgba(15, 23, 42, 1);
          border: 1px solid rgba(31, 41, 55, 1);
          overflow: hidden;
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .moe-load-bar-fill {
          width: 70%;
          height: 100%;
          border-radius: 999px;
          transform-origin: bottom center;
          transform: scaleY(0);
          box-shadow: 0 0 10px rgba(15, 23, 42, 0.9);
        }

        .moe-load-bar-fill.hot {
          box-shadow: 0 0 16px rgba(220, 38, 38, 0.9);
        }

        .moe-load-bar-label {
          color: #9ca3af;
        }

        .moe-load-bar-count {
          font-variant-numeric: tabular-nums;
        }

        .moe-load-caption {
          margin: 0;
          font-size: 0.72rem;
          color: #9ca3af;
        }

        .moe-card.notebook {
          background: transparent;
          border: 0;
          box-shadow: none;
          padding: 0;
        }

        .moe-card.notebook .moe-header {
          display: none;
        }

        .moe-card.notebook .moe-main {
          margin-top: 0;
        }

        .moe-card.notebook .moe-prediction-bar {
          margin-top: 0;
          padding: 0.7rem 0.85rem;
          border-radius: 14px;
          background: rgba(255, 251, 245, 0.78);
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .moe-card.notebook .moe-prediction-toggle,
        .moe-card.notebook .moe-token-pill,
        .moe-card.notebook .moe-control-group,
        .moe-card.notebook .moe-myth-card,
        .moe-card.notebook .moe-router-card,
        .moe-card.notebook .moe-scene,
        .moe-card.notebook .moe-load-section,
        .moe-card.notebook .moe-capacity-toolbar,
        .moe-card.notebook .moe-capacity-panel,
        .moe-card.notebook .moe-capacity-prediction,
        .moe-card.notebook .moe-capacity-locked,
        .moe-card.notebook .moe-expert-box {
          background: rgba(246, 251, 252, 0.9);
          color: #213040;
          border-color: rgba(27, 36, 48, 0.12);
          box-shadow: none;
        }

        .moe-card.notebook .moe-prediction-toggle.active,
        .moe-card.notebook .moe-token-pill.active {
          background: rgba(31, 111, 120, 0.12);
          color: #1f6f78;
          border-color: rgba(31, 111, 120, 0.32);
        }

        .moe-card.notebook .moe-prediction-hint,
        .moe-card.notebook .moe-token-description,
        .moe-card.notebook .moe-confidence-label,
        .moe-card.notebook .moe-column-title,
        .moe-card.notebook .moe-column-caption,
        .moe-card.notebook .moe-router-caption,
        .moe-card.notebook .moe-load-subtitle,
        .moe-card.notebook .moe-load-caption,
        .moe-card.notebook .moe-load-bar-label,
        .moe-card.notebook .moe-myth-body,
        .moe-card.notebook .moe-myth-row-label,
        .moe-card.notebook .moe-myth-footnote,
        .moe-card.notebook .moe-capacity-control,
        .moe-card.notebook .moe-capacity-stat,
        .moe-card.notebook .moe-capacity-intro span,
        .moe-card.notebook .moe-capacity-actions span,
        .moe-card.notebook .moe-capacity-panel-heading span:last-child {
          color: #52606c;
        }

        .moe-card.notebook .moe-feedback,
        .moe-card.notebook .moe-myth-card {
          background: rgba(246, 251, 252, 0.84);
          border-color: rgba(27, 36, 48, 0.1);
          color: #263747;
        }

        .moe-card.notebook .moe-router-bar-track,
        .moe-card.notebook .moe-confidence-bar-track,
        .moe-card.notebook .moe-load-bar-track,
        .moe-card.notebook .moe-token-stack .moe-token-pill,
        .moe-card.notebook .moe-capacity-segment,
        .moe-card.notebook .moe-capacity-route-row,
        .moe-card.notebook .moe-capacity-expert-slot,
        .moe-card.notebook .moe-capacity-options button {
          background: rgba(27, 36, 48, 0.08);
          border-color: rgba(27, 36, 48, 0.1);
          color: #263747;
        }

        .moe-card.notebook .moe-router-bar-value,
        .moe-card.notebook .moe-load-bar-count,
        .moe-card.notebook .moe-router-title,
        .moe-card.notebook .moe-load-title,
        .moe-card.notebook .moe-myth-title,
        .moe-card.notebook .moe-capacity-intro strong,
        .moe-card.notebook .moe-capacity-panel-heading,
        .moe-card.notebook .moe-capacity-expert-title,
        .moe-card.notebook .moe-capacity-options button strong,
        .moe-card.notebook .moe-capacity-result strong {
          color: #17202a;
        }

        .moe-card.notebook .moe-capacity-segment button[aria-pressed='true'],
        .moe-card.notebook .moe-capacity-options button[aria-pressed='true'] {
          background: rgba(31, 111, 120, 0.13);
          color: #1f6f78;
          border-color: rgba(31, 111, 120, 0.3);
        }

        .moe-card.notebook .moe-capacity-options button span,
        .moe-card.notebook .moe-capacity-route-row span,
        .moe-card.notebook .moe-capacity-result span,
        .moe-card.notebook .moe-capacity-locked {
          color: #52606c;
        }

        .moe-card.notebook .moe-capacity-evidence-strip {
          border-color: rgba(31, 111, 120, 0.2);
          background:
            linear-gradient(135deg, rgba(31, 111, 120, 0.18), rgba(23, 32, 42, 0.92)),
            #17202a;
        }

        .moe-card.notebook .moe-capacity-evidence-step {
          background: rgba(246, 251, 252, 0.08);
          border-color: rgba(246, 251, 252, 0.14);
        }

        .moe-card.notebook .moe-capacity-evidence-step.active {
          background: rgba(31, 111, 120, 0.28);
          border-color: rgba(125, 211, 252, 0.28);
        }

        .moe-card.notebook .moe-capacity-evidence-step strong {
          color: #ecfeff;
        }

        .moe-card.notebook .moe-capacity-evidence-step span {
          color: #d7e8ea;
        }

        .moe-card.notebook .moe-capacity-candidate-list span {
          color: #1d4ed8;
          background: rgba(59, 130, 246, 0.12);
          border-color: rgba(29, 78, 216, 0.22);
        }

        .moe-card.notebook .moe-capacity-slot-stack span {
          color: #5b6773;
          background: rgba(27, 36, 48, 0.06);
          border-color: rgba(27, 36, 48, 0.18);
        }

        .moe-card.notebook .moe-capacity-slot-stack span.filled {
          color: #166534;
          background: rgba(34, 197, 94, 0.12);
          border-color: rgba(22, 101, 52, 0.22);
        }

        .moe-card.notebook .moe-capacity-drop-list span {
          color: #991b1b;
          background: rgba(220, 38, 38, 0.1);
          border-color: rgba(153, 27, 27, 0.22);
        }

        .moe-card.notebook .moe-capacity-result.correct {
          background: rgba(34, 197, 94, 0.1);
          border-color: rgba(22, 101, 52, 0.2);
        }

        .moe-card.notebook .moe-capacity-result.missed {
          background: rgba(251, 146, 60, 0.11);
          border-color: rgba(154, 52, 18, 0.22);
        }

        .moe-card.notebook .moe-expert-insight {
          color: #7a4b00;
          background: rgba(251, 191, 36, 0.18);
          border: 1px solid rgba(180, 83, 9, 0.24);
        }

        .moe-card.notebook .active-chip {
          color: #9a3412;
          background: rgba(251, 146, 60, 0.16);
          border-color: rgba(154, 52, 18, 0.28);
        }

        .moe-card.notebook .predicted-chip {
          color: #6b21a8;
          background: rgba(168, 85, 247, 0.13);
          border-color: rgba(107, 33, 168, 0.28);
        }

        .moe-card.notebook .hot-chip {
          color: #991b1b;
          background: rgba(220, 38, 38, 0.12);
          border-color: rgba(153, 27, 27, 0.28);
        }

        @media (max-width: 900px) {
          .moe-capacity-grid {
            grid-template-columns: 1fr;
          }
          .moe-capacity-evidence-strip {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .moe-main {
            flex-direction: column;
          }
          .moe-left-panel {
            flex: 1;
          }
          .moe-right-panel {
            flex: 1;
          }
          .moe-pipeline {
            grid-template-columns: 0.9fr 1fr;
            grid-template-rows: auto auto;
            grid-template-areas:
              'tokens router'
              'experts experts';
          }
          .moe-tokens-column {
            grid-area: tokens;
          }
          .moe-router-column {
            grid-area: router;
          }
          .moe-experts-column {
            grid-area: experts;
          }
        }

        @media (max-width: 640px) {
          .moe-header {
            flex-direction: column;
            align-items: flex-start;
          }
          .moe-compute-pill {
            align-items: flex-start;
          }
          .moe-capacity-options {
            grid-template-columns: 1fr;
          }
          .moe-capacity-evidence-strip {
            grid-template-columns: 1fr;
          }
          .moe-capacity-slots {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .moe-capacity-route-row {
            grid-template-columns: 1fr;
          }
          .moe-capacity-stat {
            margin-left: 0;
          }
        }
      `}</style>
    </section>
  );
}

export default MoERoutingDemo;
