'use client'

import { useEffect, useMemo, useState } from 'react'
import type { CSSProperties } from 'react'

import { clearDemoState, emitDemoState } from '../../lib/demoState'

const SOURCE_IDS = ['web', 'edu', 'code'] as const
const VOCAB = ['story', 'fact', 'proof', 'equation', 'def', 'loop', 'bug', 'clickbait'] as const
const EVAL_IDS = ['general', 'math', 'code'] as const

type SourceId = (typeof SOURCE_IDS)[number]
type Token = (typeof VOCAB)[number]
type EvalId = (typeof EVAL_IDS)[number]

type Doc = {
  id: string
  source: SourceId
  quality: number
  group: string
  leak: boolean
  counts: Partial<Record<Token, number>>
}

type SourceMetrics = {
  source: SourceId
  retainedDocs: number
  retainedTokens: number
  effectiveWeight: number
  sampledTokens: number
  repetitionPressure: number
  uniqueSeen: number
  leakShare: number
}

const SOURCE_META: Record<SourceId, { label: string; color: string; muted: string }> = {
  web: { label: 'web', color: '#2f6f9f', muted: '#d9eaf5' },
  edu: { label: 'edu/math', color: '#b7791f', muted: '#f5e6c8' },
  code: { label: 'code', color: '#157f72', muted: '#ccece6' },
}

const DOCS: Doc[] = [
  { id: 'web_a', source: 'web', quality: 0.65, group: 'w1', leak: false, counts: { story: 8, fact: 5, clickbait: 2 } },
  { id: 'web_b', source: 'web', quality: 0.35, group: 'w2', leak: false, counts: { story: 7, clickbait: 7, fact: 1 } },
  { id: 'web_c', source: 'web', quality: 0.7, group: 'w1', leak: false, counts: { story: 8, fact: 5, clickbait: 2 } },
  { id: 'edu_a', source: 'edu', quality: 0.92, group: 'e1', leak: false, counts: { proof: 5, equation: 5, fact: 3 } },
  { id: 'edu_b', source: 'edu', quality: 0.58, group: 'e2', leak: true, counts: { proof: 6, equation: 5, fact: 1 } },
  { id: 'code_a', source: 'code', quality: 0.86, group: 'c1', leak: false, counts: { def: 5, loop: 5, bug: 1 } },
  { id: 'code_b', source: 'code', quality: 0.4, group: 'c2', leak: false, counts: { def: 2, bug: 7, loop: 1 } },
]

const EVALS: Record<EvalId, Partial<Record<Token, number>>> = {
  general: { story: 0.45, fact: 0.45, clickbait: 0.1 },
  math: { proof: 0.45, equation: 0.45, fact: 0.1 },
  code: { def: 0.45, loop: 0.45, bug: 0.1 },
}

const TOTAL_TOY_TOKENS = 180
const LATE_FRACTION = 0.2
const EPS = 1e-9

function tokenCount(counts: Partial<Record<Token, number>>) {
  return VOCAB.reduce((sum, token) => sum + (counts[token] ?? 0), 0)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function fmt(value: number, digits = 2) {
  if (!Number.isFinite(value)) return '0'
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(digits)
}

function normalizeWeights(weights: Record<SourceId, number>, active: Set<SourceId>) {
  const activeSources = SOURCE_IDS.filter((source) => active.has(source))
  const zero = Object.fromEntries(SOURCE_IDS.map((source) => [source, 0])) as Record<SourceId, number>

  if (activeSources.length === 0) return zero

  const total = activeSources.reduce((sum, source) => sum + weights[source], 0)
  if (total <= 0) {
    const uniform = 1 / activeSources.length
    return Object.fromEntries(SOURCE_IDS.map((source) => [source, active.has(source) ? uniform : 0])) as Record<SourceId, number>
  }

  return Object.fromEntries(SOURCE_IDS.map((source) => [source, active.has(source) ? weights[source] / total : 0])) as Record<SourceId, number>
}

function normalizeCounts(counts: Partial<Record<Token, number>>) {
  const total = tokenCount(counts) + EPS * VOCAB.length
  return Object.fromEntries(VOCAB.map((token) => [token, ((counts[token] ?? 0) + EPS) / total])) as Record<Token, number>
}

function mixDistributions(sourceDistributions: Record<SourceId, Record<Token, number>>, weights: Record<SourceId, number>) {
  const q = Object.fromEntries(VOCAB.map((token) => [token, 0])) as Record<Token, number>

  for (const source of SOURCE_IDS) {
    for (const token of VOCAB) {
      q[token] += weights[source] * sourceDistributions[source][token]
    }
  }

  return q
}

function crossEntropy(evalDist: Partial<Record<Token, number>>, q: Record<Token, number>) {
  return VOCAB.reduce((sum, token) => sum + (evalDist[token] ?? 0) * -Math.log(Math.max(q[token], EPS)), 0)
}

function entropy(q: Record<Token, number>) {
  return VOCAB.reduce((sum, token) => {
    const p = q[token]
    return p > 0 ? sum - p * Math.log(p) : sum
  }, 0) / Math.log(VOCAB.length)
}

function lateWeightsFrom(base: Record<SourceId, number>) {
  return {
    web: base.web * 0.65,
    edu: base.edu * 1.45,
    code: base.code * 1.25,
  }
}

export default function PretrainingDataMixturesViz() {
  const [webWeight, setWebWeight] = useState(70)
  const [eduWeight, setEduWeight] = useState(15)
  const [codeWeight, setCodeWeight] = useState(15)
  const [threshold, setThreshold] = useState(55)
  const [dedup, setDedup] = useState(true)
  const [lateAnneal, setLateAnneal] = useState(false)
  const configKey = useMemo(
    () => `${webWeight}:${eduWeight}:${codeWeight}:${threshold}:${dedup}:${lateAnneal}`,
    [codeWeight, dedup, eduWeight, lateAnneal, threshold, webWeight],
  )
  const [committedPrediction, setCommittedPrediction] = useState<{ evalId: EvalId; configKey: string } | null>(null)
  const [revealedConfigKey, setRevealedConfigKey] = useState<string | null>(null)
  const prediction = committedPrediction?.configKey === configKey ? committedPrediction.evalId : null
  const revealed = revealedConfigKey === configKey && prediction !== null

  const rawWeights = useMemo<Record<SourceId, number>>(
    () => ({
      web: webWeight,
      edu: eduWeight,
      code: codeWeight,
    }),
    [codeWeight, eduWeight, webWeight],
  )

  const data = useMemo(() => {
    const seen = new Set<string>()
    const thresholdValue = threshold / 100
    const kept = DOCS.filter((doc) => {
      if (doc.quality < thresholdValue) return false
      if (dedup && seen.has(doc.group)) return false
      seen.add(doc.group)
      return true
    })

    const countsBySource = Object.fromEntries(SOURCE_IDS.map((source) => [source, {}])) as Record<SourceId, Partial<Record<Token, number>>>
    const retainedTokens = Object.fromEntries(SOURCE_IDS.map((source) => [source, 0])) as Record<SourceId, number>
    const retainedDocs = Object.fromEntries(SOURCE_IDS.map((source) => [source, 0])) as Record<SourceId, number>
    const leakTokens = Object.fromEntries(SOURCE_IDS.map((source) => [source, 0])) as Record<SourceId, number>

    for (const doc of kept) {
      retainedDocs[doc.source] += 1
      const docTokens = tokenCount(doc.counts)
      retainedTokens[doc.source] += docTokens
      if (doc.leak) leakTokens[doc.source] += docTokens

      for (const token of VOCAB) {
        countsBySource[doc.source][token] = (countsBySource[doc.source][token] ?? 0) + (doc.counts[token] ?? 0)
      }
    }

    const active = new Set(SOURCE_IDS.filter((source) => retainedTokens[source] > 0))
    const earlyWeights = normalizeWeights(rawWeights, active)
    const lateWeights = normalizeWeights(lateWeightsFrom(rawWeights), active)
    const averageWeights = Object.fromEntries(
      SOURCE_IDS.map((source) => [
        source,
        lateAnneal
          ? (1 - LATE_FRACTION) * earlyWeights[source] + LATE_FRACTION * lateWeights[source]
          : earlyWeights[source],
      ]),
    ) as Record<SourceId, number>

    const sourceDistributions = Object.fromEntries(SOURCE_IDS.map((source) => [source, normalizeCounts(countsBySource[source])])) as Record<SourceId, Record<Token, number>>
    const qEarly = mixDistributions(sourceDistributions, earlyWeights)
    const qLate = mixDistributions(sourceDistributions, lateWeights)
    const q = Object.fromEntries(
      VOCAB.map((token) => [
        token,
        lateAnneal ? (1 - LATE_FRACTION) * qEarly[token] + LATE_FRACTION * qLate[token] : qEarly[token],
      ]),
    ) as Record<Token, number>

    const losses = Object.fromEntries(EVAL_IDS.map((evalId) => [evalId, crossEntropy(EVALS[evalId], q)])) as Record<EvalId, number>
    const maxLoss = Math.max(...Object.values(losses), 1)
    const contamination = SOURCE_IDS.reduce((sum, source) => {
      const share = retainedTokens[source] > 0 ? leakTokens[source] / retainedTokens[source] : 0
      return sum + averageWeights[source] * share
    }, 0)
    const diversity = entropy(q)

    const sourceMetrics: SourceMetrics[] = SOURCE_IDS.map((source) => {
      const sampledTokens = TOTAL_TOY_TOKENS * averageWeights[source]
      const retained = retainedTokens[source]
      const repetitionPressure = retained > 0 ? sampledTokens / retained : 0
      const uniqueSeen = retained > 0 ? retained * (1 - Math.exp(-sampledTokens / retained)) : 0
      return {
        source,
        retainedDocs: retainedDocs[source],
        retainedTokens: retained,
        effectiveWeight: averageWeights[source],
        sampledTokens,
        repetitionPressure,
        uniqueSeen,
        leakShare: retained > 0 ? leakTokens[source] / retained : 0,
      }
    })

    return {
      kept,
      q,
      losses,
      maxLoss,
      contamination,
      diversity,
      sourceMetrics,
      totalRetainedTokens: SOURCE_IDS.reduce((sum, source) => sum + retainedTokens[source], 0),
      noData: kept.length === 0,
    }
  }, [dedup, lateAnneal, rawWeights, threshold])

  const tokenRows = [...VOCAB].sort((a, b) => data.q[b] - data.q[a])
  const hardestEval = EVAL_IDS.reduce((best, evalId) => (data.losses[evalId] > data.losses[best] ? evalId : best), EVAL_IDS[0])
  const predictionCorrect = prediction === hardestEval
  const lossSummary = EVAL_IDS.map((evalId) => `${evalId}=${fmt(data.losses[evalId])}`).join(', ')

  useEffect(() => {
    clearDemoState('pretraining-data-mixtures')
  }, [configKey])

  useEffect(() => {
    clearDemoState('pretraining-data-mixtures')
    return () => clearDemoState('pretraining-data-mixtures')
  }, [])

  useEffect(() => {
    emitDemoState({
      conceptId: 'pretraining-data-mixtures',
      label: 'Pretraining mixture held-out loss prediction',
      summary: revealed
        ? `Predicted ${prediction ?? 'none'}; hardest held-out slice is ${hardestEval}. Losses: ${lossSummary}.`
        : `Predict which held-out slice will have the highest cross-entropy after filtering and reweighting. Current weights are web ${webWeight}, edu/math ${eduWeight}, code ${codeWeight}.`,
      phase: revealed ? 'revealed' : prediction ? 'predicted' : 'pre-prediction',
      prediction: {
        prompt: 'Which held-out slice will have the highest cross-entropy after filtering and reweighting?',
        learnerChoice: prediction ?? 'none',
        actual: revealed ? hardestEval : 'hidden',
        correct: revealed && prediction ? predictionCorrect : undefined,
      },
      measurements: {
        webWeight,
        eduWeight,
        codeWeight,
        qualityThreshold: threshold / 100,
        dedup,
        lateAnneal,
        retainedToyTokens: data.totalRetainedTokens,
        contaminationMass: revealed ? Number(data.contamination.toFixed(4)) : 'hidden',
        tokenEntropy: revealed ? Number(data.diversity.toFixed(4)) : 'hidden',
        generalLoss: revealed ? Number(data.losses.general.toFixed(3)) : 'hidden',
        mathLoss: revealed ? Number(data.losses.math.toFixed(3)) : 'hidden',
        codeLoss: revealed ? Number(data.losses.code.toFixed(3)) : 'hidden',
      },
      invariant: 'Held-out loss follows the learned token distribution; contamination and entropy are separate diagnostics, not the same thing as capability.',
      nextQuestion: 'Which token types are underrepresented in the retained mixture, and does late annealing repair that gap?',
      values: [
        `web weight: ${webWeight}`,
        `edu/math weight: ${eduWeight}`,
        `code weight: ${codeWeight}`,
        `quality threshold: ${threshold / 100}`,
        `deduplication: ${dedup ? 'on' : 'off'}`,
        `late math/code anneal: ${lateAnneal ? 'on' : 'off'}`,
        `retained toy tokens: ${data.totalRetainedTokens}`,
        `prediction: ${prediction ?? 'none'}`,
        `revealed: ${revealed ? 'yes' : 'no'}`,
        `hardest held-out slice: ${revealed ? hardestEval : 'hidden until reveal'}`,
        `prediction correct: ${revealed && prediction ? (predictionCorrect ? 'yes' : 'no') : 'not checked'}`,
        `losses: ${revealed ? lossSummary : 'hidden until reveal'}`,
        `contamination mass: ${revealed ? fmtPct(data.contamination) : 'hidden until reveal'}`,
        `token entropy: ${revealed ? fmtPct(data.diversity) : 'hidden until reveal'}`,
      ],
    })
  }, [
    codeWeight,
    configKey,
    data.contamination,
    data.diversity,
    data.losses.code,
    data.losses.general,
    data.losses.math,
    data.totalRetainedTokens,
    dedup,
    eduWeight,
    hardestEval,
    lateAnneal,
    lossSummary,
    prediction,
    predictionCorrect,
    revealed,
    threshold,
    webWeight,
  ])

  return (
    <div className="demo">
      <div className="controls" aria-label="Pretraining data mixture controls">
        <WeightControl label="web" value={webWeight} onChange={setWebWeight} color={SOURCE_META.web.color} />
        <WeightControl label="edu/math" value={eduWeight} onChange={setEduWeight} color={SOURCE_META.edu.color} />
        <WeightControl label="code" value={codeWeight} onChange={setCodeWeight} color={SOURCE_META.code.color} />
        <label className="control">
          <span>proxy quality threshold</span>
          <input type="range" min="0" max="90" step="5" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} />
          <strong>{threshold / 100}</strong>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={dedup} onChange={(event) => setDedup(event.target.checked)} />
          <span>deduplicate near-duplicate groups</span>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={lateAnneal} onChange={(event) => setLateAnneal(event.target.checked)} />
          <span>late 20% math/code anneal</span>
        </label>
      </div>

      <section className="predictionPanel" aria-label="Pretraining data mixture prediction" data-child-demo-gate="pretraining-mixture-loss">
        <div className="predictionCopy">
          <span>predict before reading the losses</span>
          <strong>Which held-out slice will be hardest for this token distribution?</strong>
          <p>Use the retained sources, weights, threshold, and dedup choice. The loss bars stay neutral until you commit.</p>
        </div>
        <div className="predictionChoices" role="group" aria-label="Held-out loss prediction choices">
          {EVAL_IDS.map((evalId) => (
            <button
              key={evalId}
              type="button"
              aria-pressed={prediction === evalId}
              className={prediction === evalId ? 'selected' : ''}
              onClick={() => {
                setCommittedPrediction({ evalId, configKey })
                setRevealedConfigKey(null)
              }}
            >
              <strong>{evalId}</strong>
              <span>{evalId === 'general' ? 'story/fact/clickbait eval' : evalId === 'math' ? 'proof/equation eval' : 'def/loop/bug eval'}</span>
            </button>
          ))}
        </div>
        <button type="button" className="revealButton" disabled={!prediction || data.noData} onClick={() => setRevealedConfigKey(configKey)}>
          Reveal hardest slice
        </button>
        {revealed ? (
          <p className={predictionCorrect ? 'predictionResult good' : 'predictionResult bad'}>
            Hardest slice: {hardestEval}. Your prediction: {prediction ?? 'none'}. {predictionCorrect ? 'Matched.' : 'Not this time.'}{' '}
            The result comes from which token types the retained mixture underweights, not source count alone.
          </p>
        ) : (
          <p className="predictionResult">Commit before opening cross-entropy, contamination, and entropy diagnostics.</p>
        )}
      </section>

      <section className="equation">
        <span>toy sampler</span>
        <strong>q_bar(c, y) = sum_i w_bar_i P_i^tok(c, y)</strong>
        <p>The toy loss uses the time-averaged unigram distribution. Real late-stage curricula can be trajectory-dependent; this demo only shows exposure changes.</p>
      </section>

      <div className="grid">
        <section className="panel wide">
          <div className="sectionHead">
            <div>
              <h3>effective source exposure</h3>
              <p>Each row shows retained token mass, average mixture exposure, and reuse pressure for a {TOTAL_TOY_TOKENS}-token toy run.</p>
            </div>
            <code>{data.totalRetainedTokens} retained toy tokens</code>
          </div>

          <div className="sourceRows">
            {data.sourceMetrics.map((row) => (
              <article key={row.source} className="sourceRow">
                <div className="sourceTitle">
                  <span className="swatch" style={{ backgroundColor: SOURCE_META[row.source].color }} />
                  <strong>{SOURCE_META[row.source].label}</strong>
                  <small>{row.retainedDocs} docs kept</small>
                </div>
                <MetricBar label="retained U_i" value={`${Math.round(row.retainedTokens)}`} fraction={row.retainedTokens / Math.max(data.totalRetainedTokens, 1)} color={SOURCE_META[row.source].color} />
                <MetricBar label="avg weight" value={fmtPct(row.effectiveWeight)} fraction={row.effectiveWeight} color={SOURCE_META[row.source].color} />
                <MetricBar label="rho_i reuse" value={`${fmt(row.repetitionPressure)}x`} fraction={Math.min(row.repetitionPressure / 4, 1)} color={row.repetitionPressure > 1 ? '#b45309' : SOURCE_META[row.source].color} />
                <MetricBar label="unique seen" value={fmt(row.uniqueSeen, 1)} fraction={row.retainedTokens > 0 ? row.uniqueSeen / row.retainedTokens : 0} color="#596575" />
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>proxy validation losses</h3>
          <p className="note">Lower is better. These are exact unigram cross-entropies on three held-out toy distributions.</p>
          <div className="lossRows">
            {EVAL_IDS.map((evalId) => (
              <MetricBar
                key={evalId}
                label={evalId}
                value={revealed ? fmt(data.losses[evalId]) : 'hidden'}
                fraction={revealed ? data.losses[evalId] / data.maxLoss : 0.33}
                color={evalId === 'general' ? SOURCE_META.web.color : evalId === 'math' ? SOURCE_META.edu.color : SOURCE_META.code.color}
              />
            ))}
          </div>
          <div className="diagnostics">
            <div>
              <span>contamination mass</span>
              <strong>{revealed ? fmtPct(data.contamination) : 'hidden'}</strong>
            </div>
            <div>
              <span>token entropy</span>
              <strong>{revealed ? fmtPct(data.diversity) : 'hidden'}</strong>
            </div>
          </div>
          <p className={!revealed ? 'claim locked' : data.contamination > 0.08 ? 'warning' : 'claim'}>
            {!revealed
              ? 'Loss, leakage, and entropy diagnostics unlock after the prediction. First reason from the mixture and retained documents.'
              : data.contamination > 0.08
              ? 'The toy eval-like document is receiving enough weight that lower math loss should be treated with suspicion.'
              : 'Leakage risk is visually separate from validation loss; a cleaner score is not automatically a more capable model.'}
          </p>
        </section>

        <section className="panel">
          <h3>learned toy token distribution</h3>
          <div className="tokenRows">
            {tokenRows.map((token) => (
              <MetricBar key={token} label={token} value={fmtPct(data.q[token])} fraction={data.q[token]} color={tokenColor(token)} />
            ))}
          </div>
        </section>
      </div>

      <section className="docs" aria-label="Toy corpus document table">
        <div className="sectionHead">
          <div>
            <h3>tiny embedded corpus</h3>
            <p>Quality and dedup choices decide which documents enter the curated source distributions.</p>
          </div>
          <code>{data.kept.length}/{DOCS.length} docs kept</code>
        </div>
        <div className="docGrid">
          {DOCS.map((doc) => {
            const kept = data.kept.some((keptDoc) => keptDoc.id === doc.id)
            return (
              <article key={doc.id} className={`doc ${kept ? 'kept' : 'dropped'}`}>
                <strong>{doc.id}</strong>
                <span>{SOURCE_META[doc.source].label}</span>
                <small>score={fmt(doc.quality)}</small>
                {revealed && doc.leak ? <em>eval-like</em> : null}
              </article>
            )
          })}
        </div>
      </section>

      {data.noData ? <p className="warning">All documents were filtered out. Lower the threshold to make Q_t non-empty.</p> : null}

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.85rem;
          color: #1b2430;
        }

        .controls,
        .predictionPanel,
        .panel,
        .equation,
        .docs {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.9);
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.75rem;
          padding: 0.85rem;
        }

        .predictionPanel {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.9fr) auto;
          gap: 0.75rem;
          align-items: center;
          padding: 0.85rem;
          background:
            linear-gradient(90deg, rgba(21, 127, 114, 0.1), rgba(47, 111, 159, 0.08)),
            rgba(255, 252, 246, 0.96);
        }

        .predictionCopy {
          display: grid;
          gap: 0.28rem;
          min-width: 0;
        }

        .predictionCopy span {
          color: #157f72;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          color: #18212b;
          line-height: 1.22;
        }

        .predictionCopy p,
        .predictionResult {
          margin: 0;
          color: #596575;
          font-size: 0.84rem;
          line-height: 1.45;
        }

        .predictionChoices {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.42rem;
          min-width: 0;
        }

        .predictionChoices button,
        .revealButton {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.14);
          border-radius: 8px;
          background: #fffaf1;
          color: #18212b;
          cursor: pointer;
          font: inherit;
        }

        .predictionChoices button {
          display: grid;
          gap: 0.18rem;
          min-height: 3.2rem;
          padding: 0.52rem;
          text-align: left;
        }

        .predictionChoices button span {
          color: #667085;
          font-size: 0.72rem;
          line-height: 1.22;
        }

        .predictionChoices button.selected,
        .predictionChoices button[aria-pressed='true'] {
          border-color: rgba(21, 127, 114, 0.52);
          background: rgba(222, 245, 241, 0.92);
        }

        .revealButton {
          min-height: 2.9rem;
          padding: 0.6rem 0.82rem;
          background: #157f72;
          border-color: rgba(21, 127, 114, 0.62);
          color: #fffaf2;
          font-weight: 800;
        }

        .revealButton:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }

        .predictionResult {
          grid-column: 1 / -1;
          padding: 0.62rem 0.72rem;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          border: 1px solid rgba(27, 36, 48, 0.08);
        }

        .predictionResult.good {
          border-color: rgba(21, 127, 114, 0.24);
          background: rgba(21, 127, 114, 0.08);
          color: #175e55;
        }

        .predictionResult.bad {
          border-color: rgba(180, 83, 9, 0.24);
          background: rgba(180, 83, 9, 0.08);
          color: #7a3d0b;
        }

        .control {
          display: grid;
          min-width: 0;
          gap: 0.3rem;
          font-size: 0.82rem;
          color: #4b5565;
        }

        .control span,
        .toggle span {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          letter-spacing: 0;
        }

        .control strong {
          font-family: var(--font-mono);
          color: #18212b;
        }

        input[type='range'] {
          width: 100%;
          accent-color: var(--accent, #157f72);
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 0;
          color: #364253;
        }

        .toggle input {
          width: 1rem;
          height: 1rem;
          accent-color: #157f72;
          flex: 0 0 auto;
        }

        .equation {
          display: grid;
          gap: 0.2rem;
          padding: 0.85rem 1rem;
          background:
            linear-gradient(90deg, rgba(47, 111, 159, 0.1), rgba(21, 127, 114, 0.08)),
            rgba(255, 252, 246, 0.96);
        }

        .equation span,
        .sectionHead code {
          font-family: var(--font-mono);
          font-size: 0.72rem;
          text-transform: uppercase;
          color: #667085;
        }

        .equation strong {
          font-family: var(--font-mono);
          font-size: clamp(0.86rem, 2vw, 1rem);
          overflow-wrap: anywhere;
        }

        .equation p,
        .note,
        .sectionHead p,
        .claim,
        .warning {
          margin: 0;
          color: #596575;
          line-height: 1.5;
          font-size: 0.9rem;
        }

        .grid {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(280px, 0.8fr);
          gap: 0.85rem;
          align-items: start;
        }

        .panel,
        .docs {
          padding: 0.95rem;
          display: grid;
          gap: 0.75rem;
        }

        .wide {
          grid-row: span 2;
        }

        .sectionHead {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 0.75rem;
        }

        h3 {
          margin: 0 0 0.25rem;
          font-family: var(--font-display);
          font-size: 1rem;
          letter-spacing: 0;
          color: #18212b;
        }

        .sourceRows,
        .lossRows,
        .tokenRows {
          display: grid;
          gap: 0.6rem;
        }

        .sourceRow {
          display: grid;
          grid-template-columns: minmax(120px, 0.8fr) repeat(4, minmax(86px, 1fr));
          gap: 0.55rem;
          align-items: center;
          padding: 0.7rem;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.52);
        }

        .sourceTitle {
          min-width: 0;
          display: grid;
          gap: 0.15rem;
        }

        .sourceTitle strong {
          display: flex;
          gap: 0.42rem;
          align-items: center;
          min-width: 0;
          color: #18212b;
        }

        .sourceTitle small,
        .doc small,
        .doc span {
          color: #667085;
          font-size: 0.78rem;
        }

        .swatch {
          width: 0.75rem;
          height: 0.75rem;
          border-radius: 999px;
          display: inline-block;
          flex: 0 0 auto;
        }

        .bar {
          min-width: 0;
          display: grid;
          gap: 0.2rem;
        }

        .barHead {
          display: flex;
          justify-content: space-between;
          gap: 0.45rem;
          font-size: 0.77rem;
          color: #4b5565;
        }

        .barHead span {
          min-width: 0;
          overflow-wrap: anywhere;
        }

        .barHead strong {
          color: #18212b;
          font-family: var(--font-mono);
          font-size: 0.75rem;
        }

        .track {
          height: 0.45rem;
          overflow: hidden;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.09);
        }

        .fill {
          display: block;
          height: 100%;
          min-width: 2px;
          border-radius: inherit;
        }

        .diagnostics {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.55rem;
        }

        .diagnostics div {
          display: grid;
          gap: 0.2rem;
          padding: 0.7rem;
          border-radius: 8px;
          background: rgba(27, 36, 48, 0.05);
        }

        .diagnostics span {
          font-size: 0.75rem;
          color: #667085;
        }

        .diagnostics strong {
          font-family: var(--font-mono);
          color: #18212b;
        }

        .claim {
          padding: 0.72rem;
          border-left: 3px solid #157f72;
          background: rgba(21, 127, 114, 0.08);
        }

        .warning {
          padding: 0.72rem;
          border-left: 3px solid #b45309;
          background: rgba(180, 83, 9, 0.08);
        }

        .docGrid {
          display: grid;
          grid-template-columns: repeat(7, minmax(92px, 1fr));
          gap: 0.55rem;
        }

        .doc {
          min-width: 0;
          display: grid;
          gap: 0.15rem;
          padding: 0.65rem;
          border-radius: 8px;
          border: 1px solid rgba(27, 36, 48, 0.11);
          background: rgba(255, 255, 255, 0.54);
        }

        .doc strong {
          color: #18212b;
          font-size: 0.86rem;
          overflow-wrap: anywhere;
        }

        .doc.dropped {
          opacity: 0.5;
          background: rgba(27, 36, 48, 0.04);
        }

        .doc em {
          font-style: normal;
          width: fit-content;
          padding: 0.1rem 0.35rem;
          border-radius: 999px;
          color: #8a3b27;
          background: rgba(180, 75, 59, 0.12);
          font-size: 0.7rem;
        }

        @media (max-width: 820px) {
          .controls,
          .predictionPanel,
          .grid,
          .docGrid {
            grid-template-columns: 1fr;
          }

          .wide {
            grid-row: auto;
          }

          .sourceRow {
            grid-template-columns: 1fr;
          }

          .sectionHead,
          .diagnostics {
            grid-template-columns: 1fr;
          }

          .sectionHead {
            display: grid;
          }

          .predictionChoices {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function WeightControl({ label, value, onChange, color }: { label: string; value: number; onChange: (value: number) => void; color: string }) {
  return (
    <label className="control" style={{ '--accent': color } as CSSProperties}>
      <span>{label} raw weight</span>
      <input type="range" min="0" max="100" step="5" value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{value}</strong>
    </label>
  )
}

function MetricBar({ label, value, fraction, color }: { label: string; value: string; fraction: number; color: string }) {
  const safeFraction = Math.max(0, Math.min(1, Number.isFinite(fraction) ? fraction : 0))

  return (
    <div className="bar">
      <div className="barHead">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="track">
        <span className="fill" style={{ width: `${Math.max(2, safeFraction * 100)}%`, backgroundColor: color }} />
      </div>
    </div>
  )
}

function tokenColor(token: Token) {
  if (token === 'proof' || token === 'equation') return SOURCE_META.edu.color
  if (token === 'def' || token === 'loop' || token === 'bug') return SOURCE_META.code.color
  if (token === 'clickbait') return '#b44b3b'
  return SOURCE_META.web.color
}
