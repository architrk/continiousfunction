'use client'

import { useEffect, useMemo, useState } from 'react'
import { emitDemoState } from '../../lib/demoState'

type FeedbackLabel = 'desirable' | 'undesirable'

type KTOVizProps = {
  conceptId?: string
  emitState?: boolean
}

const CHART_WIDTH = 620
const CHART_HEIGHT = 260
const MARGIN = { top: 16, right: 24, bottom: 44, left: 54 }
const INNER_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom
const REWARD_MIN = -3
const REWARD_MAX = 3
const BASELINE_MIN = 0
const BASELINE_MAX = 3
const DELTA_MIN = REWARD_MIN - BASELINE_MAX
const DELTA_MAX = REWARD_MAX - BASELINE_MIN

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

function fmt(value: number) {
  const clean = Math.abs(value) < 0.0005 ? 0 : value
  return clean.toFixed(3)
}

export default function KTOViz({ conceptId = 'kto', emitState = false }: KTOVizProps) {
  const [label, setLabel] = useState<FeedbackLabel>('desirable')
  const [reward, setReward] = useState(0.2)
  const [baseline, setBaseline] = useState(0.4)
  const [beta, setBeta] = useState(0.2)
  const [lambdaD, setLambdaD] = useState(1)
  const [lambdaU, setLambdaU] = useState(1)

  const data = useMemo(() => {
    const delta = reward - baseline
    const desirable = label === 'desirable'
    const lambdaY = desirable ? lambdaD : lambdaU
    const sharedSlope = sigmoid(beta * delta) * (1 - sigmoid(beta * delta))
    const sigmaTerm = desirable ? sigmoid(beta * delta) : sigmoid(-beta * delta)
    const value = lambdaY * sigmaTerm
    const loss = lambdaY - value
    const gradMagnitude = lambdaY * beta * sharedSlope
    const gradient = desirable ? -gradMagnitude : gradMagnitude
    const points = Array.from({ length: 161 }, (_, index) => {
      const pointDelta = DELTA_MIN + index * ((DELTA_MAX - DELTA_MIN) / 160)
      return {
        delta: pointDelta,
        desirableLoss: lambdaD * (1 - sigmoid(beta * pointDelta)),
        undesirableLoss: lambdaU * (1 - sigmoid(-beta * pointDelta)),
      }
    })

    return {
      delta,
      desirable,
      sigmaTerm,
      value,
      loss,
      gradient,
      gradMagnitude,
      points,
    }
  }, [label, reward, baseline, beta, lambdaD, lambdaU])

  useEffect(() => {
    if (!emitState) return

    const gradientDirection = data.gradient < 0 ? 'increase r_theta' : 'decrease r_theta'
    const desiredSide = data.desirable ? 'positive delta' : 'negative delta'
    const onCorrectSide = data.desirable ? data.delta > 0 : data.delta < 0
    const boundaryStatus =
      Math.abs(data.delta) < 0.15
        ? 'near the KL reference boundary'
        : onCorrectSide
          ? `already on the ${desiredSide} side`
          : `still on the wrong side for a ${label} label`
    const lambdaY = data.desirable ? lambdaD : lambdaU
    const maxGradient = Math.max(lambdaY * beta * 0.25, 0.0001)
    const saturationRatio = data.gradMagnitude / maxGradient
    const saturationStatus =
      saturationRatio > 0.75
        ? 'high-gradient'
        : saturationRatio < 0.25
          ? 'saturated'
          : 'moderate-gradient'

    emitDemoState({
      conceptId,
      label: 'KTO state',
      summary: `label=${label}; delta=${fmt(data.delta)}; gd=${gradientDirection}; ${boundaryStatus}.`,
      values: [
        `r_theta=${fmt(reward)}`,
        `z0=${fmt(baseline)}`,
        `target=${desiredSide}`,
        `loss=${fmt(data.loss)}`,
        `dL/dr=${fmt(data.gradient)}`,
        `saturation=${saturationStatus}`,
      ],
    })
  }, [baseline, beta, conceptId, data, emitState, label, lambdaD, lambdaU, reward])

  const maxLoss = Math.max(lambdaD, lambdaU, 0.1)
  const x = (delta: number) =>
    MARGIN.left + ((delta - DELTA_MIN) / (DELTA_MAX - DELTA_MIN)) * INNER_WIDTH
  const y = (loss: number) => MARGIN.top + (1 - loss / maxLoss) * INNER_HEIGHT
  const currentX = x(data.delta)
  const currentY = y(clamp(data.loss, 0, maxLoss))
  const path = (key: 'desirableLoss' | 'undesirableLoss') =>
    data.points
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.delta)} ${y(point[key])}`)
      .join(' ')

  return (
    <div className="demo">
      <div className="controls" aria-label="KTO controls">
        <fieldset>
          <legend>binary label</legend>
          <label>
            <input
              type="radio"
              name="kto-label"
              checked={label === 'desirable'}
              onChange={() => setLabel('desirable')}
            />
            desirable
          </label>
          <label>
            <input
              type="radio"
              name="kto-label"
              checked={label === 'undesirable'}
              onChange={() => setLabel('undesirable')}
            />
            undesirable
          </label>
        </fieldset>
        <Slider label="implied reward r_theta" value={reward} min={REWARD_MIN} max={REWARD_MAX} step={0.05} onChange={setReward} />
        <Slider label="KL baseline z0" value={baseline} min={BASELINE_MIN} max={BASELINE_MAX} step={0.05} onChange={setBaseline} />
        <Slider label="beta saturation" value={beta} min={0.01} max={1} step={0.01} onChange={setBeta} />
        <Slider label="lambda_D" value={lambdaD} min={0.1} max={3} step={0.05} onChange={setLambdaD} />
        <Slider label="lambda_U" value={lambdaU} min={0.1} max={3} step={0.05} onChange={setLambdaU} />
      </div>

      <div className="layout">
        <div className="panel">
          <h3>KTO state</h3>
          <div className="metrics">
            <Metric label="delta = r_theta - z0" value={data.delta} />
            <Metric label="sigma term" value={data.sigmaTerm} />
            <Metric label="value v(x,y)" value={data.value} />
            <Metric label="loss lambda_y - v" value={data.loss} />
            <Metric label="dL / d r_theta" value={data.gradient} />
            <Metric label="gradient magnitude" value={data.gradMagnitude} />
          </div>
          <p className="claim">
            Gradient descent {data.desirable ? 'increases' : 'decreases'} the policy/reference log-ratio for this {data.desirable ? 'desirable' : 'undesirable'} example.
          </p>
        </div>

        <div className="panel chartPanel">
          <h3>loss as a function of delta</h3>
          <svg viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label="KTO desirable and undesirable loss curves">
            <line x1={MARGIN.left} x2={MARGIN.left + INNER_WIDTH} y1={MARGIN.top + INNER_HEIGHT} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" opacity="0.35" />
            <line x1={x(0)} x2={x(0)} y1={MARGIN.top} y2={MARGIN.top + INNER_HEIGHT} stroke="currentColor" strokeDasharray="4 4" opacity="0.35" />
            <path d={path('desirableLoss')} fill="none" stroke="currentColor" strokeWidth="2.5" opacity={label === 'desirable' ? 1 : 0.35} />
            <path d={path('undesirableLoss')} fill="none" stroke="currentColor" strokeWidth="2.5" opacity={label === 'undesirable' ? 1 : 0.35} strokeDasharray="6 5" />
            <circle cx={currentX} cy={currentY} r="5" fill="currentColor" />
            <text x={MARGIN.left + INNER_WIDTH / 2} y={CHART_HEIGHT - 10} textAnchor="middle" fontSize="13" fill="currentColor">
              delta = r_theta - z0
            </text>
            <text x="16" y={MARGIN.top + INNER_HEIGHT / 2} transform={`rotate(-90 16 ${MARGIN.top + INNER_HEIGHT / 2})`} textAnchor="middle" fontSize="13" fill="currentColor">
              KTO loss
            </text>
            <text x={x(-3.6)} y={MARGIN.top + 18} fontSize="12" fill="currentColor">solid: desirable</text>
            <text x={x(-3.6)} y={MARGIN.top + 36} fontSize="12" fill="currentColor">dashed: undesirable</text>
          </svg>
          <p className="caption">
            Desirable examples have low loss when delta is positive. Undesirable examples have low loss when delta is negative.
          </p>
        </div>
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

        fieldset,
        label {
          min-width: 0;
        }

        fieldset {
          display: grid;
          gap: 0.35rem;
          margin: 0;
          border: 0;
          padding: 0;
          color: #4f5f6d;
          font-size: 0.78rem;
        }

        legend {
          margin-bottom: 0.2rem;
          color: #65717d;
          font-size: 0.72rem;
        }

        fieldset label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
        }

        .layout {
          display: grid;
          grid-template-columns: 0.9fr 1.1fr;
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

        .metrics {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 0.5rem;
        }

        .claim,
        .caption {
          margin: 0.7rem 0 0;
          color: #5b6875;
          font-size: 0.8rem;
          line-height: 1.45;
        }

        svg {
          display: block;
          width: 100%;
          height: auto;
          color: #1b2430;
        }

        @media (max-width: 860px) {
          .controls,
          .layout {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .metrics {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  return (
    <label className="slider">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
      <strong>{fmt(value)}</strong>
      <style jsx>{`
        .slider {
          display: grid;
          gap: 0.35rem;
          color: #4f5f6d;
          font-size: 0.75rem;
        }

        input {
          width: 100%;
        }

        strong {
          color: #17202a;
          font-family: var(--font-mono);
        }
      `}</style>
    </label>
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
          padding: 0.55rem;
        }

        span {
          display: block;
          color: #65717d;
          font-size: 0.68rem;
        }

        strong {
          color: #17202a;
          font-family: var(--font-mono);
        }
      `}</style>
    </div>
  )
}
