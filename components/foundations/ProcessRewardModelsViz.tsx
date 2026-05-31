'use client'

import { useMemo, useState } from 'react'

type Scorer = 'outcome' | 'process'
type Aggregation = 'sum-logits' | 'mean-prob' | 'product-prob'
type ErrorMode = 'none' | 'false-positive' | 'false-negative'

type Step = {
  text: string
  valid: boolean
  baseProb: number
}

type Trace = {
  id: string
  label: string
  refProb: number
  outcomeProb: number
  finalCorrect: boolean
  steps: Step[]
}

const TRACES: Trace[] = [
  {
    id: 'clean',
    label: 'clean derivation',
    refProb: 0.3,
    outcomeProb: 0.86,
    finalCorrect: true,
    steps: [
      { text: 'Divide both sides by 2: x + 3 = 7.', valid: true, baseProb: 0.93 },
      { text: 'Subtract 3 from both sides: x = 4.', valid: true, baseProb: 0.91 },
    ],
  },
  {
    id: 'lucky',
    label: 'lucky final answer',
    refProb: 0.22,
    outcomeProb: 0.92,
    finalCorrect: true,
    steps: [
      { text: 'Divide only the left side by 2: x + 3 = 14.', valid: false, baseProb: 0.16 },
      { text: 'Subtract 10 from both sides: x = 4.', valid: false, baseProb: 0.24 },
    ],
  },
  {
    id: 'slip',
    label: 'arithmetic slip',
    refProb: 0.28,
    outcomeProb: 0.16,
    finalCorrect: false,
    steps: [
      { text: 'Divide both sides by 2: x + 3 = 7.', valid: true, baseProb: 0.93 },
      { text: 'Subtract 2 from both sides: x = 5.', valid: false, baseProb: 0.22 },
    ],
  },
  {
    id: 'wrong',
    label: 'wrong path',
    refProb: 0.2,
    outcomeProb: 0.12,
    finalCorrect: false,
    steps: [
      { text: 'Subtract 3 from the right side only: 2x = 11.', valid: false, baseProb: 0.2 },
      { text: 'Divide by 2: x = 5.5.', valid: false, baseProb: 0.35 },
    ],
  },
]

function clampProb(value: number) {
  return Math.min(1 - 1e-6, Math.max(1e-6, value))
}

function logit(prob: number) {
  const p = clampProb(prob)
  return Math.log(p / (1 - p))
}

function normalize(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((value) => value / total)
}

function expected(weights: number[], values: number[]) {
  return weights.reduce((sum, weight, index) => sum + weight * values[index], 0)
}

function kl(policy: number[], reference: number[]) {
  return policy.reduce((sum, prob, index) => sum + prob * Math.log(prob / reference[index]), 0)
}

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function stepProb(trace: Trace, stepIndex: number, errorMode: ErrorMode) {
  if (errorMode === 'false-positive' && trace.id === 'lucky') {
    return stepIndex === 0 ? 0.98 : 0.97
  }

  if (errorMode === 'false-negative' && trace.id === 'clean') {
    return stepIndex === 0 ? 0.42 : trace.steps[stepIndex].baseProb
  }

  return trace.steps[stepIndex].baseProb
}

function processScore(probs: number[], aggregation: Aggregation) {
  if (aggregation === 'mean-prob') {
    const mean = probs.reduce((sum, prob) => sum + prob, 0) / probs.length
    return logit(mean)
  }

  if (aggregation === 'product-prob') {
    return probs.reduce((sum, prob) => sum + Math.log(clampProb(prob)), 0)
  }

  return probs.reduce((sum, prob) => sum + logit(prob), 0)
}

function scoreTrace(trace: Trace, scorer: Scorer, aggregation: Aggregation, errorMode: ErrorMode) {
  if (scorer === 'outcome') {
    return logit(trace.outcomeProb)
  }

  const probs = trace.steps.map((_, index) => stepProb(trace, index, errorMode))
  return processScore(probs, aggregation)
}

export default function ProcessRewardModelsViz() {
  const [scorer, setScorer] = useState<Scorer>('process')
  const [aggregation, setAggregation] = useState<Aggregation>('sum-logits')
  const [errorMode, setErrorMode] = useState<ErrorMode>('none')
  const [beta, setBeta] = useState(0.7)

  const data = useMemo(() => {
    const reference = TRACES.map((trace) => trace.refProb)
    const scores = TRACES.map((trace) => scoreTrace(trace, scorer, aggregation, errorMode))
    const maxLogit = Math.max(...scores.map((score, index) => Math.log(reference[index]) + score / beta))
    const policy = normalize(scores.map((score, index) => Math.exp(Math.log(reference[index]) + score / beta - maxLogit)))
    const rows = TRACES.map((trace, index) => {
      const probs = trace.steps.map((_, stepIndex) => stepProb(trace, stepIndex, errorMode))
      const meanStepProb = probs.reduce((sum, prob) => sum + prob, 0) / probs.length
      const trueStepQuality = trace.steps.filter((step) => step.valid).length / trace.steps.length
      const allStepsValid = trace.steps.every((step) => step.valid)
      const proxyQuality = scorer === 'outcome' ? trace.outcomeProb : meanStepProb
      const truthForProxy = scorer === 'outcome' ? (trace.finalCorrect ? 1 : 0) : trueStepQuality

      return {
        ...trace,
        score: scores[index],
        policy: policy[index],
        stepProbs: probs,
        meanStepProb,
        trueStepQuality,
        allStepsValid,
        proxyQuality,
        proxyError: proxyQuality - truthForProxy,
      }
    })
    const selected = rows.reduce((best, row) => (row.policy > best.policy ? row : best), rows[0])

    return {
      reference,
      rows,
      selected,
      expectedTerminalCorrect: expected(policy, rows.map((row) => (row.finalCorrect ? 1 : 0))),
      expectedStepCorrect: expected(policy, rows.map((row) => row.trueStepQuality)),
      expectedVerifier: expected(policy, rows.map((row) => row.proxyQuality)),
      selectedProxyError: selected.proxyError,
      klValue: kl(policy, reference),
    }
  }, [aggregation, beta, errorMode, scorer])

  return (
    <div className="demo">
      <div className="controls" aria-label="Process reward model controls">
        <label>
          <span>scorer</span>
          <select value={scorer} onChange={(event) => setScorer(event.target.value as Scorer)}>
            <option value="outcome">outcome-only verifier</option>
            <option value="process">process verifier</option>
          </select>
        </label>
        <label>
          <span>process aggregation</span>
          <select value={aggregation} onChange={(event) => setAggregation(event.target.value as Aggregation)}>
            <option value="sum-logits">sum step logits</option>
            <option value="mean-prob">mean step probability</option>
            <option value="product-prob">product step probabilities</option>
          </select>
        </label>
        <label>
          <span>verifier error</span>
          <select value={errorMode} onChange={(event) => setErrorMode(event.target.value as ErrorMode)}>
            <option value="none">none</option>
            <option value="false-positive">false-positive invalid trace</option>
            <option value="false-negative">false-negative clean step</option>
          </select>
        </label>
        <label>
          <span>KL coefficient beta</span>
          <input type="range" min="0.28" max="2.4" step="0.02" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
          <strong>{fmt(beta)}</strong>
        </label>
      </div>

      <div className="summary">
        <Metric label="selected trace" text={data.selected.label} />
        <Metric label="E terminal correct" value={data.expectedTerminalCorrect} />
        <Metric label="E step correctness" value={data.expectedStepCorrect} />
        <Metric label="E verifier score" value={data.expectedVerifier} />
        <Metric label="selected proxy error" value={data.selectedProxyError} />
        <Metric label="KL(policy || ref)" value={data.klValue} />
      </div>

      <div className="traceGrid">
        {data.rows.map((row) => (
          <article key={row.id} className={`trace ${row.id === data.selected.id ? 'selected' : ''}`}>
            <div className="traceHead">
              <div>
                <h3>{row.label}</h3>
                <p>{row.finalCorrect ? 'final answer correct' : 'final answer wrong'} · {row.allStepsValid ? 'all steps valid' : 'has invalid steps'}</p>
              </div>
              <code>{fmtPct(row.policy)}</code>
            </div>

            <Bar label="reference" value={row.refProb} color="#8a98a8" />
            <Bar label="policy" value={row.policy} color={row.allStepsValid ? '#1f6f78' : '#b44b3b'} />

            <ol className="steps">
              {row.steps.map((step, index) => (
                <li key={step.text}>
                  <span className={`truth ${step.valid ? 'valid' : 'invalid'}`}>{step.valid ? 'valid' : 'invalid'}</span>
                  <p>{step.text}</p>
                  <code>p={fmt(row.stepProbs[index])}</code>
                </li>
              ))}
            </ol>

            <div className="traceMetrics">
              <Metric label="verifier score" value={row.proxyQuality} />
              <Metric label="step quality" value={row.trueStepQuality} />
              <Metric label="trajectory score" value={row.score} />
              <Metric label="proxy error" value={row.proxyError} />
            </div>
          </article>
        ))}
      </div>

      <p className="claim">
        Outcome-only scoring can reward a lucky final answer with broken intermediate steps. Process scoring adds local supervision, but verifier errors can still become the new reward-hacking surface.
      </p>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .summary,
        .trace {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.82);
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.65rem;
          padding: 0.75rem;
        }

        label {
          display: grid;
          min-width: 0;
          gap: 0.35rem;
          color: #536170;
          font-size: 0.73rem;
        }

        select,
        input[type='range'] {
          width: 100%;
        }

        select {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.16);
          border-radius: 7px;
          background: white;
          color: #17202a;
          padding: 0.42rem 0.5rem;
          font: inherit;
        }

        strong,
        code,
        .demo :global(.metric strong) {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .summary {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 0.55rem;
          padding: 0.65rem;
        }

        .traceGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.75rem;
        }

        .trace {
          padding: 0.75rem;
        }

        .trace.selected {
          border-color: rgba(31, 111, 120, 0.45);
          box-shadow: 0 0 0 2px rgba(31, 111, 120, 0.08);
        }

        .traceHead {
          display: flex;
          justify-content: space-between;
          gap: 0.6rem;
          align-items: flex-start;
          margin-bottom: 0.6rem;
        }

        h3,
        p {
          margin: 0;
        }

        h3 {
          color: #1b2430;
          font-size: 0.95rem;
        }

        .traceHead p,
        .claim {
          color: #627080;
          font-size: 0.78rem;
          line-height: 1.45;
        }

        .steps {
          display: grid;
          gap: 0.45rem;
          list-style: none;
          margin: 0.7rem 0 0;
          padding: 0;
        }

        .steps li {
          display: grid;
          grid-template-columns: 4.1rem minmax(0, 1fr) 4.2rem;
          gap: 0.5rem;
          align-items: start;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.48rem;
        }

        .truth {
          border-radius: 999px;
          padding: 0.18rem 0.4rem;
          text-align: center;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .truth.valid {
          background: rgba(31, 111, 120, 0.12);
          color: #1f6f78;
        }

        .truth.invalid {
          background: rgba(180, 75, 59, 0.12);
          color: #8a3328;
        }

        .steps p {
          color: #334150;
          font-size: 0.76rem;
          line-height: 1.35;
        }

        .traceMetrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.45rem;
          margin-top: 0.6rem;
        }

        .claim {
          border-left: 3px solid #b78b2f;
          background: rgba(183, 139, 47, 0.1);
          color: #66501c;
          padding: 0.6rem 0.7rem;
          border-radius: 0 8px 8px 0;
        }

        @media (max-width: 980px) {
          .controls,
          .summary,
          .traceGrid {
            grid-template-columns: 1fr 1fr;
          }

          .traceMetrics {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 620px) {
          .controls,
          .summary,
          .traceGrid,
          .traceMetrics {
            grid-template-columns: 1fr;
          }

          .steps li {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="barRow">
      <span>{label}</span>
      <div className="track" aria-label={`${label}: ${fmtPct(value)}`}>
        <div className="fill" style={{ width: `${Math.max(2, value * 100)}%`, background: color }} />
      </div>
      <code>{fmtPct(value)}</code>
      <style jsx>{`
        .barRow {
          display: grid;
          grid-template-columns: 4.2rem minmax(0, 1fr) 2.7rem;
          gap: 0.45rem;
          align-items: center;
          color: #65717d;
          font-size: 0.7rem;
          margin-top: 0.35rem;
        }

        .track {
          height: 0.55rem;
          border-radius: 999px;
          overflow: hidden;
          background: rgba(27, 36, 48, 0.08);
        }

        .fill {
          height: 100%;
          border-radius: inherit;
        }

        code {
          color: #17202a;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  )
}

function Metric({ label, value, text }: { label: string; value?: number; text?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{text ?? fmt(value ?? 0)}</strong>
      <style jsx>{`
        .metric {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.45rem;
        }

        span {
          display: block;
          color: #65717d;
          font-size: 0.66rem;
        }

        strong {
          display: block;
          overflow-wrap: anywhere;
          color: #17202a;
          font-family: var(--font-mono);
          font-size: 0.82rem;
        }
      `}</style>
    </div>
  )
}
