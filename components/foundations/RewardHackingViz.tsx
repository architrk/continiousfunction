'use client'

import { useEffect, useMemo, useState } from 'react'

import { emitDemoState } from '../../lib/demoState'

type Candidate = {
  id: string
  label: string
  piRef: number
  trueUtility: number
  cleanReward: number
  proxyReward: number
  uncertainty: number
}

const CANDIDATES: Candidate[] = [
  {
    id: 'clear',
    label: 'clear answer',
    piRef: 0.28,
    trueUtility: 1.2,
    cleanReward: 1.1,
    proxyReward: 1.1,
    uncertainty: 0.15,
  },
  {
    id: 'safe',
    label: 'safe refusal',
    piRef: 0.22,
    trueUtility: 0.7,
    cleanReward: 0.6,
    proxyReward: 0.6,
    uncertainty: 0.15,
  },
  {
    id: 'thin',
    label: 'thin answer',
    piRef: 0.42,
    trueUtility: -0.3,
    cleanReward: -0.1,
    proxyReward: -0.1,
    uncertainty: 0.2,
  },
  {
    id: 'exploit',
    label: 'proxy exploit',
    piRef: 0.08,
    trueUtility: -0.8,
    cleanReward: -0.8,
    proxyReward: 1.9,
    uncertainty: 1,
  },
]

const SWEEP_BETAS = [3, 2.2, 1.6, 1.1, 0.8, 0.6, 0.45, 0.35, 0.28]
const CHART_WIDTH = 520
const CHART_HEIGHT = 210
const MARGIN = { top: 14, right: 18, bottom: 34, left: 42 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
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

function policyFor(beta: number, lambda: number, proxyGap: boolean) {
  const reference = CANDIDATES.map((candidate) => candidate.piRef)
  const meanReward = CANDIDATES.map((candidate) => (proxyGap ? candidate.proxyReward : candidate.cleanReward))
  const score = CANDIDATES.map((candidate, index) => meanReward[index] - lambda * candidate.uncertainty)
  const logits = CANDIDATES.map((candidate, index) => Math.log(candidate.piRef) + score[index] / beta)
  const maxLogit = Math.max(...logits)
  const policy = normalize(logits.map((value) => Math.exp(value - maxLogit)))
  const trueUtility = CANDIDATES.map((candidate) => candidate.trueUtility)
  const proxyError = meanReward.map((reward, index) => reward - trueUtility[index])

  return {
    reference,
    meanReward,
    score,
    policy,
    trueUtility,
    expectedProxy: expected(policy, meanReward),
    expectedTrue: expected(policy, trueUtility),
    expectedRefProxy: expected(reference, meanReward),
    expectedRefTrue: expected(reference, trueUtility),
    selectedError: expected(policy, proxyError),
    klValue: kl(policy, reference),
  }
}

type RewardHackingVizProps = {
  conceptId?: string
  emitState?: boolean
}

export default function RewardHackingViz({ conceptId = 'reward-hacking', emitState = false }: RewardHackingVizProps) {
  const [beta, setBeta] = useState(0.7)
  const [proxyGap, setProxyGap] = useState(true)
  const [lambda, setLambda] = useState(0)

  const data = useMemo(() => {
    const current = policyFor(beta, lambda, proxyGap)
    const rows = CANDIDATES.map((candidate, index) => ({
      ...candidate,
      meanReward: current.meanReward[index],
      score: current.score[index],
      piStar: current.policy[index],
      proxyError: current.meanReward[index] - candidate.trueUtility,
    }))
    const frontier = SWEEP_BETAS.map((sweepBeta) => {
      const point = policyFor(sweepBeta, lambda, proxyGap)
      return {
        beta: sweepBeta,
        pressure: 1 / sweepBeta,
        expectedProxy: point.expectedProxy,
        expectedTrue: point.expectedTrue,
      }
    })
    const hacking =
      proxyGap &&
      current.expectedProxy > current.expectedRefProxy + 1e-6 &&
      current.expectedTrue < current.expectedRefTrue - 1e-6

    return {
      ...current,
      rows,
      frontier,
      hacking,
    }
  }, [beta, lambda, proxyGap])

  const topCandidate = data.rows.reduce((best, row) => (row.piStar > best.piStar ? row : best), data.rows[0])
  const pressureLabel = beta < 0.5 ? 'high' : beta < 1 ? 'medium' : 'low'

  useEffect(() => {
    if (!emitState) return

    emitDemoState({
      conceptId,
      label: 'Reward hacking lab controls',
      summary: `beta ${fmt(beta)}, lambda ${fmt(lambda)}, proxy gap ${proxyGap ? 'on' : 'off'}, top completion ${topCandidate.label} at ${fmtPct(topCandidate.piStar)}, proxy ${fmt(data.expectedProxy)}, true ${fmt(data.expectedTrue)}, selected error ${fmt(data.selectedError)}; hacking diagnostic ${data.hacking ? 'visible' : 'not visible'}.`,
      values: [
        `beta: ${fmt(beta)} (${pressureLabel} optimization pressure)`,
        `uncertainty penalty lambda: ${fmt(lambda)}`,
        `proxy reward gap: ${proxyGap ? 'on' : 'off'}`,
        `top completion: ${topCandidate.label} (${fmtPct(topCandidate.piStar)})`,
        `expected proxy reward: ${fmt(data.expectedProxy)}`,
        `expected true utility: ${fmt(data.expectedTrue)}`,
        `reference true utility: ${fmt(data.expectedRefTrue)}`,
        `selected proxy error: ${fmt(data.selectedError)}`,
        `KL(policy || ref): ${fmt(data.klValue)}`,
        `hacking diagnostic: ${data.hacking ? 'proxy up while true utility below reference' : 'not visible'}`,
      ],
    })
  }, [
    beta,
    conceptId,
    data.expectedProxy,
    data.expectedRefTrue,
    data.expectedTrue,
    data.hacking,
    data.klValue,
    data.selectedError,
    emitState,
    lambda,
    pressureLabel,
    proxyGap,
    topCandidate.label,
    topCandidate.piStar,
  ])

  const yMin = Math.min(...data.frontier.flatMap((point) => [point.expectedProxy, point.expectedTrue]), data.expectedRefTrue) - 0.1
  const yMax = Math.max(...data.frontier.flatMap((point) => [point.expectedProxy, point.expectedTrue]), data.expectedRefProxy) + 0.1
  const x = (pressure: number) => MARGIN.left + ((pressure - 1 / 3) / (1 / 0.28 - 1 / 3)) * INNER_WIDTH
  const y = (value: number) => MARGIN.top + (1 - (value - yMin) / (yMax - yMin)) * INNER_HEIGHT
  const path = (key: 'expectedProxy' | 'expectedTrue') =>
    data.frontier.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.pressure)} ${y(point[key])}`).join(' ')
  const currentPressure = 1 / beta

  return (
    <div className="demo">
      <div className="controls" aria-label="Reward hacking controls">
        <label className="slider">
          <span>KL coefficient beta (larger = closer to reference)</span>
          <input type="range" min="0.28" max="3" step="0.02" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
          <strong>{fmt(beta)}</strong>
        </label>
        <label className="slider">
          <span>uncertainty penalty lambda</span>
          <input type="range" min="0" max="2" step="0.05" value={lambda} onChange={(event) => setLambda(Number(event.target.value))} />
          <strong>{fmt(lambda)}</strong>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={proxyGap} onChange={(event) => setProxyGap(event.target.checked)} />
          proxy reward gap
        </label>
      </div>

      <div className="layout">
        <section className="panel">
          <h3>one prompt, four completions</h3>
          <div className="candidateGrid">
            {data.rows.map((row) => (
              <article key={row.id} className="candidate">
                <div className="candidateHead">
                  <strong>{row.label}</strong>
                  <code>{fmtPct(row.piStar)}</code>
                </div>
                <Bar label="pi_ref" value={row.piRef} color="#8a98a8" />
                <Bar label="pi_beta" value={row.piStar} color={row.id === 'exploit' && proxyGap ? '#b44b3b' : '#1f6f78'} />
                <div className="numbers">
                  <Metric label="true utility u" value={row.trueUtility} />
                  <Metric label="mean proxy mu" value={row.meanReward} />
                  <Metric label="uncertainty sigma" value={row.uncertainty} />
                  <Metric label="LCB score" value={row.score} />
                  <Metric label="proxy error" value={row.proxyError} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="panel">
          <h3>optimization pressure</h3>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="Expected proxy reward and true utility as optimization pressure rises">
            <line x1={MARGIN.left} x2={MARGIN.left + INNER_WIDTH} y1={MARGIN.top + INNER_HEIGHT} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <path d={path('expectedProxy')} fill="none" stroke="#b44b3b" strokeWidth="2.5" />
            <path d={path('expectedTrue')} fill="none" stroke="#1f6f78" strokeWidth="2.5" strokeDasharray="6 5" />
            <line x1={x(currentPressure)} x2={x(currentPressure)} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" strokeDasharray="4 4" opacity="0.4" />
            <text x={MARGIN.left + 4} y={MARGIN.top + 14} fontSize="12" fill="#b44b3b">proxy reward</text>
            <text x={MARGIN.left + 4} y={MARGIN.top + 31} fontSize="12" fill="#1f6f78">true utility</text>
            <text x={MARGIN.left + INNER_WIDTH / 2} y={CHART_HEIGHT - 8} textAnchor="middle" fontSize="12" fill="currentColor">
              optimization pressure = 1 / beta
            </text>
          </svg>

          <div className="metrics">
            <Metric label="E_policy[proxy]" value={data.expectedProxy} />
            <Metric label="E_policy[true]" value={data.expectedTrue} />
            <Metric label="E_ref[true]" value={data.expectedRefTrue} />
            <Metric label="selected error" value={data.selectedError} />
            <Metric label="KL(policy || ref)" value={data.klValue} />
          </div>

          <p className="claim">
            Lower beta pushes harder on the proxy. Lambda subtracts uncertainty before optimization, so uncertain high-reward completions are less attractive.
          </p>
          {data.hacking && (
            <p className="warning">
              Proxy reward is improving while true utility is below the reference baseline. The optimizer has selected reward-model error.
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
          grid-template-columns: 1.15fr 0.85fr;
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

        svg {
          display: block;
          width: 100%;
          height: auto;
          color: #1b2430;
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
  return (
    <div className="barRow">
      <span>{label}</span>
      <div className="track" role="img" aria-label={`${label}: ${fmtPct(value)}`}>
        <div className="fill" style={{ width: `${value * 100}%`, background: color }} />
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{fmt(value)}</strong>
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
