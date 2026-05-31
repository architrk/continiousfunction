'use client'

import { useEffect, useMemo, useState } from 'react'

import { emitDemoState } from '../../lib/demoState'

type Candidate = {
  id: string
  label: string
  piRef: number
  trueReward: number
  cleanReward: number
  proxyReward: number
}

const CANDIDATES: Candidate[] = [
  {
    id: 'clear',
    label: 'clear answer',
    piRef: 0.34,
    trueReward: 1.2,
    cleanReward: 1.1,
    proxyReward: 1.1,
  },
  {
    id: 'safe',
    label: 'safe refusal',
    piRef: 0.26,
    trueReward: 0.7,
    cleanReward: 0.6,
    proxyReward: 0.6,
  },
  {
    id: 'thin',
    label: 'thin answer',
    piRef: 0.24,
    trueReward: -0.2,
    cleanReward: -0.1,
    proxyReward: -0.1,
  },
  {
    id: 'proxy',
    label: 'proxy exploit',
    piRef: 0.16,
    trueReward: -0.8,
    cleanReward: -0.7,
    proxyReward: 1.7,
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

function fmtExp(value: number) {
  if (value >= 1000 || (value > 0 && value < 0.001)) {
    return value.toExponential(2)
  }
  return fmt(value)
}

function normalize(weights: number[]) {
  const total = weights.reduce((sum, value) => sum + value, 0)
  return weights.map((value) => value / total)
}

function kl(policy: number[], reference: number[]) {
  return policy.reduce((sum, prob, index) => sum + prob * Math.log(prob / reference[index]), 0)
}

function expected(policy: number[], values: number[]) {
  return policy.reduce((sum, prob, index) => sum + prob * values[index], 0)
}

type RLHFProbabilityShapingVizProps = {
  conceptId?: string
  emitState?: boolean
}

export default function RLHFProbabilityShapingViz({ conceptId = 'rlhf', emitState = false }: RLHFProbabilityShapingVizProps) {
  const [beta, setBeta] = useState(0.7)
  const [proxyGap, setProxyGap] = useState(false)
  const [rewardShift, setRewardShift] = useState(0)

  const data = useMemo(() => {
    const modelRewards = CANDIDATES.map((candidate) => (proxyGap ? candidate.proxyReward : candidate.cleanReward))
    const shiftedRewards = modelRewards.map((reward) => reward + rewardShift)
    const reference = CANDIDATES.map((candidate) => candidate.piRef)
    const weights = CANDIDATES.map((candidate, index) => candidate.piRef * Math.exp(shiftedRewards[index] / beta))
    const policy = normalize(weights)
    const unshiftedWeights = CANDIDATES.map((candidate, index) => candidate.piRef * Math.exp(modelRewards[index] / beta))
    const unshiftedPolicy = normalize(unshiftedWeights)
    const trueRewards = CANDIDATES.map((candidate) => candidate.trueReward)
    const klValue = kl(policy, reference)
    const modelExpected = expected(policy, modelRewards)
    const trueExpected = expected(policy, trueRewards)
    const refTrueExpected = expected(reference, trueRewards)
    const shiftError = Math.max(...policy.map((prob, index) => Math.abs(prob - unshiftedPolicy[index])))
    const rows = CANDIDATES.map((candidate, index) => ({
      ...candidate,
      modelReward: modelRewards[index],
      shiftedReward: shiftedRewards[index],
      expBonus: Math.exp(shiftedRewards[index] / beta),
      piStar: policy[index],
      klContribution: policy[index] * Math.log(policy[index] / candidate.piRef),
    }))
    const rewardHacking = proxyGap && trueExpected < refTrueExpected - 1e-6

    return {
      rows,
      policy,
      reference,
      klValue,
      modelExpected,
      trueExpected,
      refTrueExpected,
      shiftError,
      rewardHacking,
    }
  }, [beta, proxyGap, rewardShift])

  const topCandidate = data.rows.reduce((best, row) => (row.piStar > best.piStar ? row : best), data.rows[0])
  const anchorStrength = beta >= 1.2 ? 'strong' : beta >= 0.6 ? 'medium' : 'weak'

  useEffect(() => {
    if (!emitState) return

    emitDemoState({
      conceptId,
      label: 'RLHF probability-shaping lab controls',
      summary: `beta ${fmt(beta)} (${anchorStrength} anchor), reward shift ${fmt(rewardShift)}, proxy gap ${proxyGap ? 'on' : 'off'}, top completion ${topCandidate.label} at ${fmtPct(topCandidate.piStar)}, expected model reward ${fmt(data.modelExpected)}, true reward ${fmt(data.trueExpected)}, KL ${fmt(data.klValue)}, shift error ${fmt(data.shiftError)}.`,
      values: [
        `beta: ${fmt(beta)} (${anchorStrength} reference anchor)`,
        `reward shift: ${fmt(rewardShift)}`,
        `proxy reward gap: ${proxyGap ? 'on' : 'off'}`,
        `top completion: ${topCandidate.label} (${fmtPct(topCandidate.piStar)})`,
        `expected model reward: ${fmt(data.modelExpected)}`,
        `expected true reward: ${fmt(data.trueExpected)}`,
        `reference true reward: ${fmt(data.refTrueExpected)}`,
        `KL(policy || ref): ${fmt(data.klValue)}`,
        `max shift-invariance error: ${fmtExp(data.shiftError)}`,
        `reward hacking warning: ${data.rewardHacking ? 'visible' : 'not visible'}`,
      ],
    })
  }, [
    anchorStrength,
    beta,
    conceptId,
    data.klValue,
    data.modelExpected,
    data.refTrueExpected,
    data.rewardHacking,
    data.shiftError,
    data.trueExpected,
    emitState,
    proxyGap,
    rewardShift,
    topCandidate.label,
    topCandidate.piStar,
  ])

  return (
    <div className="demo">
      <div className="controls" aria-label="RLHF probability shaping controls">
        <label className="slider">
          <span>KL coefficient beta</span>
          <input type="range" min="0.25" max="2" step="0.05" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
          <strong>{fmt(beta)}</strong>
        </label>
        <label className="slider">
          <span>reward shift</span>
          <input type="range" min="-2" max="2" step="0.1" value={rewardShift} onChange={(event) => setRewardShift(Number(event.target.value))} />
          <strong>{fmt(rewardShift)}</strong>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={proxyGap} onChange={(event) => setProxyGap(event.target.checked)} />
          proxy reward gap
        </label>
      </div>

      <div className="layout">
        <section className="panel">
          <h3>finite-action RLHF optimum</h3>
          <div className="candidateGrid">
            {data.rows.map((row) => (
              <article key={row.id} className="candidate">
                <div className="candidateHead">
                  <strong>{row.label}</strong>
                  <code>{fmtPct(row.piStar)}</code>
                </div>
                <Bar label="pi_ref" value={row.piRef} color="#8a98a8" />
                <Bar label="pi_star" value={row.piStar} color={row.id === 'proxy' && proxyGap ? '#b44b3b' : '#1f6f78'} />
                <div className="numbers">
                  <Metric label="r_model" value={row.modelReward} />
                  <Metric label="r_model + shift" value={row.shiftedReward} />
                  <Metric label="r_true" value={row.trueReward} />
                  <Metric label="exp((r+shift)/beta)" value={row.expBonus} displayValue={fmtExp(row.expBonus)} />
                  <Metric label="pi log(pi/pi_ref)" value={row.klContribution} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>what changed</h3>
          <div className="metrics">
            <Metric label="E_policy[r_model]" value={data.modelExpected} />
            <Metric label="E_policy[r_true]" value={data.trueExpected} />
            <Metric label="E_ref[r_true]" value={data.refTrueExpected} />
            <Metric label="KL(policy || ref)" value={data.klValue} />
            <Metric label="max |pi_shifted - pi_unshifted|" value={data.shiftError} />
            <Metric label="beta anchor" value={beta} />
          </div>
          <p className="claim">
            The policy is pi_star(y|x) proportional to pi_ref(y|x) times exp((r_model(x,y) + shift) / beta). The shift multiplies every unnormalized weight by the same constant, so normalization cancels it.
          </p>
          {data.rewardHacking && (
            <p className="warning">
              Proxy error is reducing true reward below the reference baseline. Lower beta makes this concentration on the proxy exploit sharper.
            </p>
          )}
        </section>
      </div>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 252, 246, 0.82);
        }

        .controls {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 0.65rem;
          padding: 0.75rem;
        }

        .slider,
        .toggle {
          min-width: 0;
          color: #4f5f6d;
          font-size: 0.75rem;
        }

        .slider {
          display: grid;
          gap: 0.35rem;
        }

        .toggle {
          display: flex;
          align-items: center;
          gap: 0.45rem;
        }

        input[type='range'] {
          width: 100%;
        }

        .slider strong,
        code,
        .demo :global(.metric strong) {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .layout {
          display: grid;
          grid-template-columns: 1.25fr 0.75fr;
          gap: 0.75rem;
        }

        .panel {
          padding: 0.75rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.95rem;
        }

        .candidateGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .candidate {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.65rem;
        }

        .candidateHead {
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
          align-items: center;
          color: #1b2430;
          font-size: 0.82rem;
          margin-bottom: 0.55rem;
        }

        .numbers,
        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.45rem;
          margin-top: 0.55rem;
        }

        .claim,
        .warning {
          margin: 0.7rem 0 0;
          color: #5b6875;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .warning {
          border-left: 3px solid #b44b3b;
          background: rgba(180, 75, 59, 0.1);
          color: #662b22;
          padding: 0.55rem 0.65rem;
          border-radius: 0 8px 8px 0;
        }

        @media (max-width: 920px) {
          .controls,
          .layout,
          .candidateGrid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .numbers,
          .metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct = clamp(value, 0, 1) * 100
  return (
    <div className="barRow">
      <span>{label}</span>
      <div className="track" role="img" aria-label={`${label}: ${fmtPct(value)}`}>
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <code>{fmtPct(value)}</code>
      <style jsx>{`
        .barRow {
          display: grid;
          grid-template-columns: 3.7rem minmax(0, 1fr) 2.7rem;
          gap: 0.4rem;
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

function Metric({ label, value, displayValue }: { label: string; value: number; displayValue?: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{displayValue ?? fmt(value)}</strong>
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
          color: #17202a;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  )
}
