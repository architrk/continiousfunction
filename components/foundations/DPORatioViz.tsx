'use client'

import { useEffect, useMemo, useState } from 'react'

import { emitDemoState } from '../../lib/demoState'

const EPS = 1e-6
const LOGIT_LIMIT = 24
const STEP_SIZE = 0.55

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function sigmoid(value: number) {
  if (value >= 0) {
    const z = Math.exp(-value)
    return 1 / (1 + z)
  }
  const z = Math.exp(value)
  return z / (1 + z)
}

function logit(prob: number) {
  const p = clamp(prob, EPS, 1 - EPS)
  return Math.log(p / (1 - p))
}

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

function fmtPct(value: number) {
  return `${Math.round(value * 100)}%`
}

type DPORatioVizProps = {
  conceptId?: string
  emitState?: boolean
}

export default function DPORatioViz({ conceptId = 'dpo', emitState = false }: DPORatioVizProps) {
  const [beta, setBeta] = useState(0.7)
  const [refWinnerProb, setRefWinnerProb] = useState(0.35)
  const [targetPreferenceProb, setTargetPreferenceProb] = useState(0.82)
  const [thetaLogOdds, setThetaLogOdds] = useState(logit(0.35))

  const data = useMemo(() => {
    const refW = clamp(refWinnerProb, 0.02, 0.98)
    const refL = 1 - refW
    const refLogOdds = logit(refW)
    const thetaOdds = clamp(thetaLogOdds, -LOGIT_LIMIT, LOGIT_LIMIT)
    const thetaW = sigmoid(thetaOdds)
    const thetaL = 1 - thetaW
    const relLogOdds = thetaOdds - refLogOdds
    const margin = beta * relLogOdds
    const predPreference = sigmoid(margin)
    const pStar = clamp(targetPreferenceProb, 0.51, 0.99)
    const targetRelLogOdds = logit(pStar) / beta
    const targetThetaLogOdds = refLogOdds + targetRelLogOdds
    const targetW = sigmoid(targetThetaLogOdds)
    const targetL = 1 - targetW
    const loss = -(
      pStar * Math.log(predPreference + EPS) +
      (1 - pStar) * Math.log(1 - predPreference + EPS)
    )
    const gradThetaLogOdds = beta * (predPreference - pStar)
    const klThetaRef =
      thetaW * Math.log(thetaW / refW) +
      thetaL * Math.log(thetaL / refL)
    const targetKl =
      targetW * Math.log(targetW / refW) +
      targetL * Math.log(targetL / refL)
    const hardLabelWarning = pStar > 0.96
    const largeMoveWarning = Math.abs(targetRelLogOdds) > 6 || targetKl > 1.5

    return {
      refW,
      refL,
      refLogOdds,
      thetaOdds,
      thetaW,
      thetaL,
      relLogOdds,
      margin,
      predPreference,
      pStar,
      targetRelLogOdds,
      targetThetaLogOdds,
      targetW,
      targetL,
      loss,
      gradThetaLogOdds,
      klThetaRef,
      targetKl,
      hardLabelWarning,
      largeMoveWarning,
    }
  }, [beta, refWinnerProb, targetPreferenceProb, thetaLogOdds])

  const gradientEffect =
    data.gradThetaLogOdds < -0.001
      ? 'increase winner odds'
      : data.gradThetaLogOdds > 0.001
        ? 'decrease winner odds'
        : 'near stationary'

  useEffect(() => {
    if (!emitState) return

    emitDemoState({
      conceptId,
      label: 'DPO ratio lab controls',
      summary: `beta ${fmt(beta)}, ref win ${fmtPct(data.refW)}, target pref ${fmtPct(data.pStar)}, current pref ${fmtPct(data.predPreference)}, margin ${fmt(data.relLogOdds)}, loss ${fmt(data.loss)}; next step would ${gradientEffect}.`,
      values: [
        `beta: ${fmt(beta)}`,
        `reference winner probability: ${fmtPct(data.refW)}`,
        `current policy winner probability: ${fmtPct(data.thetaW)}`,
        `target preference probability: ${fmtPct(data.pStar)}`,
        `reference log-odds a_ref: ${fmt(data.refLogOdds)}`,
        `policy log-odds a_theta: ${fmt(data.thetaOdds)}`,
        `reference-relative margin m: ${fmt(data.relLogOdds)}`,
        `preference probability sigma(beta m): ${fmtPct(data.predPreference)}`,
        `DPO soft loss: ${fmt(data.loss)}`,
        `gradient effect: ${gradientEffect}`,
      ],
    })
  }, [
    beta,
    conceptId,
    data.loss,
    data.pStar,
    data.predPreference,
    data.refLogOdds,
    data.refW,
    data.relLogOdds,
    data.thetaOdds,
    data.thetaW,
    emitState,
    gradientEffect,
  ])

  const oneStep = () => {
    setThetaLogOdds((value) => clamp(value - STEP_SIZE * data.gradThetaLogOdds, -LOGIT_LIMIT, LOGIT_LIMIT))
  }

  const resetToReference = () => {
    setThetaLogOdds(logit(data.refW))
  }

  const fitTarget = () => {
    setThetaLogOdds(clamp(data.targetThetaLogOdds, -LOGIT_LIMIT, LOGIT_LIMIT))
  }

  return (
    <div className="demo">
      <div className="controls" aria-label="DPO ratio controls">
        <label>
          <span>KL coefficient beta (larger = stronger anchor)</span>
          <input type="range" min="0.2" max="3" step="0.05" value={beta} onChange={(event) => setBeta(Number(event.target.value))} />
          <strong>{fmt(beta)}</strong>
        </label>
        <label>
          <span>reference winner prob</span>
          <input
            type="range"
            min="0.05"
            max="0.95"
            step="0.01"
            value={refWinnerProb}
            onChange={(event) => setRefWinnerProb(Number(event.target.value))}
          />
          <strong>{fmtPct(data.refW)}</strong>
        </label>
        <label>
          <span>soft target preference p*</span>
          <input
            type="range"
            min="0.55"
            max="0.98"
            step="0.01"
            value={targetPreferenceProb}
            onChange={(event) => setTargetPreferenceProb(Number(event.target.value))}
          />
          <strong>{fmtPct(data.pStar)}</strong>
        </label>
        <p className="controlNote">
          Reference probabilities are clamped away from 0 and 1 because DPO log-ratios require positive reference support.
        </p>
      </div>

      <div className="actions">
        <button type="button" onClick={oneStep}>one DPO step</button>
        <button type="button" onClick={fitTarget}>fit soft target</button>
        <button type="button" onClick={resetToReference}>reset to reference</button>
      </div>

      <div className="layout">
        <div className="panel">
          <h3>probability mass</h3>
          <ProbabilityRow label="reference" winner={data.refW} loser={data.refL} color="#8a98a8" />
          <ProbabilityRow label="current policy" winner={data.thetaW} loser={data.thetaL} color="#1f6f78" />
          <ProbabilityRow label="target two-action policy" winner={data.targetW} loser={data.targetL} color="#c26f34" />
          <p className="caption">
            DPO does not ask whether the winner is simply likely. It asks how much the current winner-vs-loser odds moved beyond the reference odds.
          </p>
        </div>

        <div className="panel equation">
          <h3>reference-relative margin</h3>
          <div className="equationGrid">
            <Metric label="a_ref" value={data.refLogOdds} />
            <Metric label="a_theta" value={data.thetaOdds} />
            <Metric label="m = a_theta - a_ref" value={data.relLogOdds} />
            <Metric label="beta m" value={data.margin} />
            <Metric label="sigma(beta m)" value={data.predPreference} percent />
            <Metric label="soft target p*" value={data.pStar} percent />
          </div>
          <p className="claim">
            The DPO loss is binary cross-entropy between the target preference and sigma(beta times the reference-relative margin).
          </p>
        </div>

        <div className="panel">
          <h3>loss and anchor</h3>
          <div className="equationGrid">
            <Metric label="loss" value={data.loss} />
            <Metric label="soft-target dL/da_theta" value={data.gradThetaLogOdds} />
            <Metric label="two-action KL(policy || ref)" value={data.klThetaRef} />
            <Metric label="target two-action KL" value={data.targetKl} />
            <Metric label="target m* = logit(p*) / beta" value={data.targetRelLogOdds} />
            <Metric label="target a_theta*" value={data.targetThetaLogOdds} />
          </div>
          {(data.hardLabelWarning || data.largeMoveWarning) && (
            <p className="warning">
              {data.hardLabelWarning
                ? 'Near-hard preference labels push the required log-odds toward infinity.'
                : 'This setting requires a large policy/reference movement, so KL rises quickly.'}
            </p>
          )}
        </div>
      </div>

      <style jsx>{`
        .demo {
          display: grid;
          gap: 0.8rem;
        }

        .controls,
        .actions,
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

        label {
          display: grid;
          gap: 0.35rem;
          color: #4f5f6d;
          font-size: 0.75rem;
        }

        input {
          width: 100%;
        }

        .controlNote {
          grid-column: 1 / -1;
          margin: 0;
          color: #5b6875;
          font-size: 0.78rem;
          line-height: 1.4;
        }

        label strong,
        .demo :global(.metric strong),
        code {
          color: #17202a;
          font-family: var(--font-mono);
        }

        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          padding: 0.65rem;
        }

        button {
          min-height: 34px;
          border: 1px solid rgba(27, 36, 48, 0.13);
          border-radius: 8px;
          background: #fff8eb;
          color: #1b2430;
          padding: 0 0.72rem;
          font-size: 0.8rem;
          cursor: pointer;
        }

        .layout {
          display: grid;
          grid-template-columns: 1.1fr 1fr 1fr;
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

        .demo :global(.row) {
          display: grid;
          grid-template-columns: 6.5rem minmax(0, 1fr) 3.4rem;
          gap: 0.55rem;
          align-items: center;
          margin-bottom: 0.55rem;
          color: #4f5f6d;
          font-size: 0.78rem;
        }

        .demo :global(.bar) {
          height: 1.55rem;
          border-radius: 7px;
          overflow: hidden;
          background: rgba(27, 36, 48, 0.08);
          display: flex;
        }

        .demo :global(.win),
        .demo :global(.lose) {
          display: grid;
          place-items: center;
          min-width: 0;
          color: white;
          font-size: 0.68rem;
          font-family: var(--font-mono);
        }

        .demo :global(.lose) {
          background: rgba(27, 36, 48, 0.34);
        }

        .caption,
        .claim,
        .warning {
          margin: 0.7rem 0 0;
          color: #5b6875;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        .warning {
          border-left: 3px solid #c26f34;
          background: rgba(194, 111, 52, 0.1);
          color: #633817;
          padding: 0.55rem 0.65rem;
          border-radius: 0 8px 8px 0;
        }

        .equationGrid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .demo :global(.metric) {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.08);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.58);
          padding: 0.55rem;
        }

        .demo :global(.metric span) {
          display: block;
          color: #65717d;
          font-size: 0.68rem;
        }

        @media (max-width: 980px) {
          .controls,
          .layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 560px) {
          .equationGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function ProbabilityRow({
  label,
  winner,
  loser,
  color,
}: {
  label: string
  winner: number
  loser: number
  color: string
}) {
  return (
    <div className="row">
      <span>{label}</span>
      <div className="bar" role="img" aria-label={`${label}: winner ${fmtPct(winner)}, loser ${fmtPct(loser)}`}>
        <div className="win" style={{ width: `${winner * 100}%`, background: color }}>win</div>
        <div className="lose" style={{ width: `${loser * 100}%` }}>lose</div>
      </div>
      <code>{fmtPct(winner)}</code>
    </div>
  )
}

function Metric({ label, value, percent = false }: { label: string; value: number; percent?: boolean }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{percent ? fmtPct(value) : fmt(value)}</strong>
    </div>
  )
}
