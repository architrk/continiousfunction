import { useEffect, useMemo, useState } from 'react'

import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'

type TransformKey = 'face' | 'high' | 'parity' | 'loss'
type PredictionId = 'x-0' | 'x-1' | 'tie' | 'largest-value' | 'smallest-value' | 'middle-or-tie'

const FACES = [1, 2, 3, 4, 5, 6]
const MASS_EPSILON = 1e-9

const TRANSFORMS: Record<
  TransformKey,
  { label: string; rule: string; description: string; fn: (face: number) => number }
> = {
  face: {
    label: 'face value',
    rule: 'X(omega) = omega',
    description: 'The face-value measurement keeps every die face as its own measured value.',
    fn: (face) => face,
  },
  high: {
    label: 'high-roll indicator',
    rule: 'X(omega) = 1 for omega >= 5, else 0',
    description: 'The high-roll measurement pools faces 5 and 6 into X=1 and the other faces into X=0.',
    fn: (face) => (face >= 5 ? 1 : 0),
  },
  parity: {
    label: 'odd indicator',
    rule: 'X(omega) = 1 for odd omega, else 0',
    description: 'The parity measurement forgets magnitude and pools probability mass by odd versus even faces.',
    fn: (face) => (face % 2 === 1 ? 1 : 0),
  },
  loss: {
    label: 'squared miss',
    rule: 'X(omega) = (6 - omega)^2',
    description: 'The squared-miss measurement turns each face into a loss-like distance from the target face 6.',
    fn: (face) => (6 - face) ** 2,
  },
}

const PRESETS: Array<{ key: TransformKey; label: string; tilt: number }> = [
  { key: 'face', label: 'face setup', tilt: 0 },
  { key: 'high', label: 'threshold setup', tilt: 0.35 },
  { key: 'parity', label: 'parity setup', tilt: -0.25 },
  { key: 'loss', label: 'loss setup', tilt: 0.5 },
]

function fmt(n: number) {
  const v = Math.abs(n) < 0.0005 ? 0 : n
  return v.toFixed(3)
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`
}

function tiltedDie(tilt: number) {
  const weights = FACES.map((face) => Math.exp(tilt * (face - 3.5)))
  const total = weights.reduce((acc, weight) => acc + weight, 0)
  return FACES.map((face, index) => ({ face, prob: weights[index] / total }))
}

function getPredictionChoices(transformKey: TransformKey): Array<{ id: PredictionId; label: string }> {
  if (transformKey === 'high') {
    return [
      { id: 'x-1', label: 'X = 1, high-roll fiber' },
      { id: 'x-0', label: 'X = 0, not-high fiber' },
      { id: 'tie', label: 'Tie / no dominant fiber' },
    ]
  }

  if (transformKey === 'parity') {
    return [
      { id: 'x-1', label: 'X = 1, odd fiber' },
      { id: 'x-0', label: 'X = 0, even fiber' },
      { id: 'tie', label: 'Tie / no dominant fiber' },
    ]
  }

  return [
    { id: 'largest-value', label: 'Largest measured value wins' },
    { id: 'smallest-value', label: 'Smallest measured value wins' },
    { id: 'middle-or-tie', label: 'Middle value, tie, or no dominant value' },
  ]
}

function classifyPrediction(
  transformKey: TransformKey,
  pmf: Array<{ x: number; prob: number }>,
  topFibers: Array<{ x: number; prob: number; faces: number[] }>
): PredictionId {
  if (transformKey === 'high' || transformKey === 'parity') {
    const p0 = pmf.find((row) => row.x === 0)?.prob ?? 0
    const p1 = pmf.find((row) => row.x === 1)?.prob ?? 0
    if (Math.abs(p0 - p1) <= MASS_EPSILON) return 'tie'
    return p1 > p0 ? 'x-1' : 'x-0'
  }

  if (topFibers.length !== 1) return 'middle-or-tie'

  const support = pmf.map((row) => row.x)
  const minValue = Math.min(...support)
  const maxValue = Math.max(...support)
  const winningValue = topFibers[0].x

  if (winningValue === maxValue) return 'largest-value'
  if (winningValue === minValue) return 'smallest-value'
  return 'middle-or-tie'
}

function describePrediction(id: PredictionId) {
  return (
    {
      'x-0': 'X=0 fiber',
      'x-1': 'X=1 fiber',
      tie: 'tie',
      'largest-value': 'largest measured value',
      'smallest-value': 'smallest measured value',
      'middle-or-tie': 'middle value, tie, or no dominant value',
    } satisfies Record<PredictionId, string>
  )[id]
}

export default function RandomVariablesViz() {
  const [transformKey, setTransformKey] = useState<TransformKey>('high')
  const [tilt, setTilt] = useState(0.35)
  const [prediction, setPrediction] = useState<PredictionId | null>(null)
  const [revealedKey, setRevealedKey] = useState<string | null>(null)

  const data = useMemo(() => {
    const transform = TRANSFORMS[transformKey]
    const outcomes = tiltedDie(tilt).map((row) => ({ ...row, x: transform.fn(row.face) }))
    const pmfMap = new Map<number, number>()
    const fiberMap = new Map<number, number[]>()

    outcomes.forEach((row) => {
      pmfMap.set(row.x, (pmfMap.get(row.x) ?? 0) + row.prob)
      fiberMap.set(row.x, [...(fiberMap.get(row.x) ?? []), row.face])
    })

    const pmf = Array.from(pmfMap.entries())
      .map(([x, prob]) => ({ x, prob }))
      .sort((a, b) => a.x - b.x)

    const fibers = pmf.map((row) => ({ ...row, faces: fiberMap.get(row.x) ?? [] }))
    const mean = pmf.reduce((acc, row) => acc + row.x * row.prob, 0)
    const variance = pmf.reduce((acc, row) => acc + (row.x - mean) ** 2 * row.prob, 0)
    const support = pmf.map((row) => row.x)
    const maxMass = Math.max(...pmf.map((row) => row.prob))
    const topFibers = fibers.filter((row) => Math.abs(row.prob - maxMass) <= MASS_EPSILON)

    return { outcomes, pmf, fibers, support, mean, variance, transform, maxMass, topFibers }
  }, [tilt, transformKey])

  const scenarioKey = `${transformKey}:${tilt.toFixed(2)}`
  const isRevealed = revealedKey === scenarioKey && prediction !== null
  const predictionChoices = getPredictionChoices(transformKey)
  const actualPrediction = classifyPrediction(transformKey, data.pmf, data.topFibers)
  const predictionCorrect = prediction === actualPrediction
  const topFiberText = data.topFibers.map((fiber) => `X=${fiber.x} <- {${fiber.faces.join(', ')}}`).join(' or ')

  const resetReveal = (clearPrediction = true) => {
    if (clearPrediction) setPrediction(null)
    setRevealedKey(null)
    clearDemoState('random-variables')
  }

  const applyPreset = (preset: (typeof PRESETS)[number]) => {
    setTransformKey(preset.key)
    setTilt(preset.tilt)
    resetReveal()
  }

  const updateTransform = (value: TransformKey) => {
    setTransformKey(value)
    resetReveal()
  }

  const updateTilt = (value: number) => {
    setTilt(value)
    resetReveal()
  }

  const revealPushforward = () => {
    if (!prediction) return
    setRevealedKey(scenarioKey)
  }

  useEffect(() => {
    if (!isRevealed) return

    emitDemoState({
      conceptId: 'random-variables',
      label: 'Random variable pushforward prediction',
      summary:
        `X=${data.transform.label}, tilt=${fmt(tilt)}; ` +
        `prediction=${prediction}; actual=${actualPrediction}; correct=${predictionCorrect}; ` +
        `winning fiber ${topFiberText}, p=${fmt(data.maxMass)}; ` +
        `support=[${data.support.join(', ')}]; E[X]=${fmt(data.mean)}; Var(X)=${fmt(data.variance)}.`,
      values: [
        `measurement=${transformKey} (${data.transform.label})`,
        `rule=${data.transform.rule}`,
        `tilt=${fmt(tilt)}`,
        `prediction=${prediction}`,
        `prediction label=${prediction ? describePrediction(prediction) : 'none'}`,
        `actual=${actualPrediction}`,
        `actual label=${describePrediction(actualPrediction)}`,
        `prediction correct=${predictionCorrect ? 'yes' : 'no'}`,
        `raw probabilities=${data.outcomes.map((row) => `omega=${row.face}:${fmt(row.prob)}`).join(', ')}`,
        `fibers=${data.fibers.map((fiber) => `X=${fiber.x} <- {${fiber.faces.join(', ')}} p=${fmt(fiber.prob)}`).join('; ')}`,
        `PMF=${data.pmf.map((row) => `P(X=${row.x})=${fmt(row.prob)}`).join(', ')}`,
        `support=[${data.support.join(', ')}]`,
        `largest mass value=${data.topFibers.map((fiber) => fiber.x).join(' or ')}`,
        `largest mass=${fmt(data.maxMass)}`,
        `winning fiber=${topFiberText}`,
        `E[X]=${fmt(data.mean)}`,
        `Var(X)=${fmt(data.variance)}`,
      ],
    })
  }, [
    actualPrediction,
    data.fibers,
    data.maxMass,
    data.mean,
    data.outcomes,
    data.pmf,
    data.support,
    data.transform.label,
    data.transform.rule,
    data.variance,
    isRevealed,
    prediction,
    predictionCorrect,
    tilt,
    topFiberText,
    transformKey,
  ])

  useEffect(() => {
    clearDemoState('random-variables')
  }, [])

  const yForOutcome = (index: number) => 72 + index * 38
  const yForValue = (x: number) => {
    const index = data.pmf.findIndex((row) => row.x === x)
    if (data.pmf.length === 1) return 178
    return 72 + index * (228 / (data.pmf.length - 1))
  }

  return (
    <div className="wrap">
      <div className="controls">
        <div className="presetGroup" aria-label="Random variable presets">
          {PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              aria-pressed={transformKey === preset.key && Math.abs(tilt - preset.tilt) < 0.001}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="controlGrid">
          <label>
            <span>measurement X</span>
            <select value={transformKey} onChange={(event) => updateTransform(event.target.value as TransformKey)}>
              {(Object.keys(TRANSFORMS) as TransformKey[]).map((key) => (
                <option key={key} value={key}>
                  {TRANSFORMS[key].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>die tilt</span>
            <input type="range" min="-0.9" max="0.9" step="0.01" value={tilt} onChange={(event) => updateTilt(Number(event.target.value))} />
            <strong>{fmt(tilt)}</strong>
          </label>
        </div>
      </div>

      <section className="prediction" aria-label="Random variable prediction">
        <div className="predictionCopy">
          <span>predict pushforward</span>
          <strong>Which measured value will collect the most probability mass?</strong>
          <p>
            Rule: <code>{data.transform.rule}</code>. Raw outcome probabilities are visible; the grouped values and measured readouts unlock after a choice.
          </p>
        </div>
        <div className="choiceRow" role="group" aria-label="Predict dominant measured value">
          {predictionChoices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              aria-pressed={prediction === choice.id}
              className={prediction === choice.id ? 'selected' : ''}
              onClick={() => {
                setPrediction(choice.id)
                resetReveal(false)
              }}
            >
              {choice.label}
            </button>
          ))}
        </div>
        <button type="button" className="reveal" disabled={prediction === null} onClick={revealPushforward}>
          Reveal pushforward
        </button>
      </section>

      <section className={`result ${isRevealed ? 'shown' : ''}`} aria-live="polite">
        {isRevealed ? (
          <>
            <h4>{predictionCorrect ? 'Correct.' : 'The grouped mass is visible.'}</h4>
            <p>
              Actual dominant measured value: {describePrediction(actualPrediction)}. The winning fiber is {topFiberText} with probability {fmt(data.maxMass)}.
            </p>
          </>
        ) : (
          <p>{prediction === null ? 'Choose a candidate fiber before opening the grouped distribution.' : 'Reveal the grouped distribution to test your prediction.'}</p>
        )}
      </section>

      {isRevealed ? (
        <div className="metrics">
          <div>
            <span>support of X</span>
            <strong>[{data.support.join(', ')}]</strong>
          </div>
          <div>
            <span>E[X]</span>
            <strong>{fmt(data.mean)}</strong>
          </div>
          <div>
            <span>Var(X)</span>
            <strong>{fmt(data.variance)}</strong>
          </div>
          <div>
            <span>largest mass</span>
            <strong>{fmt(data.maxMass)}</strong>
          </div>
        </div>
      ) : (
        <div className="metrics locked" aria-label="Hidden random variable readouts">
          <div>
            <span>grouped values</span>
            <strong>hidden</strong>
          </div>
          <div>
            <span>average</span>
            <strong>hidden</strong>
          </div>
          <div>
            <span>spread</span>
            <strong>hidden</strong>
          </div>
          <div>
            <span>dominant fiber</span>
            <strong>hidden</strong>
          </div>
        </div>
      )}

      <div className="stage">
        <div className="panel">
          <h3>raw outcomes</h3>
          <div className="outcomes">
            {data.outcomes.map((row) => (
              <div className="outcome" key={row.face}>
                <strong>omega={row.face}</strong>
                <div className="barTrack" aria-label={`Probability of face ${row.face} is ${fmt(row.prob)}`}>
                  <div className="bar rawBar" style={{ width: `${row.prob * 100}%` }} />
                </div>
                <code>{fmt(row.prob)}</code>
              </div>
            ))}
          </div>
        </div>

        <svg viewBox="0 0 720 340" role="img" aria-label="A random variable maps raw die outcomes to numeric values, then groups probability mass by value after reveal.">
          <rect x="24" y="24" width="672" height="292" rx="8" className="plotBg" />
          <text x="48" y="52" className="title">outcomes</text>
          <text x="272" y="52" className="title">map X</text>
          <text x="500" y="52" className="title">{isRevealed ? 'distribution p_X' : 'measured mass'}</text>

          {data.outcomes.map((row, index) => {
            const y = yForOutcome(index)
            const targetY = yForValue(row.x)
            const thinOpacity = Math.min(1, 0.25 + row.prob * 2.2)
            const flowOpacity = Math.min(1, 0.24 + row.prob * 2.1)
            return (
              <g key={row.face}>
                <rect x="52" y={y - 17} width="96" height="28" rx="7" className="outcomeNode" />
                <text x="76" y={y + 2} className="nodeText">omega={row.face}</text>
                <path
                  d={`M 154 ${y - 3} C 222 ${y - 3}, 236 ${y - 3}, 266 ${y - 3}`}
                  className="thinFlow"
                  style={{ opacity: thinOpacity }}
                />
                {isRevealed ? (
                  <>
                    <text x="276" y={y + 2} className="mapText">X={row.x}</text>
                    <path
                      d={`M 330 ${y - 3} C 406 ${y - 3}, 420 ${targetY}, 486 ${targetY}`}
                      className="flow"
                      style={{ strokeWidth: 1 + row.prob * 10, opacity: flowOpacity }}
                    />
                  </>
                ) : null}
              </g>
            )
          })}

          {isRevealed ? (
            data.pmf.map((row) => {
              const y = yForValue(row.x)
              const width = 128 * row.prob
              return (
                <g key={row.x}>
                  <text x="500" y={y + 4} className="xLabel">x={row.x}</text>
                  <rect x="548" y={y - 13} width="128" height="24" rx="6" className="pmfTrack" />
                  <rect x="548" y={y - 13} width={width} height="24" rx="6" className={data.topFibers.some((fiber) => fiber.x === row.x) ? 'pmfBar dominant' : 'pmfBar'} />
                  <text x="558" y={y + 4} className="pmfValue">{fmtPct(row.prob)}</text>
                </g>
              )
            })
          ) : (
            <g>
              <rect x="492" y="126" width="178" height="88" rx="8" className="lockBox" />
              <text x="522" y="162" className="lockText">hidden until</text>
              <text x="522" y="184" className="lockText">prediction reveal</text>
            </g>
          )}
        </svg>
      </div>

      <p className="claim">
        {isRevealed
          ? `${data.transform.description} Probability has been pushed forward from raw outcomes to measured values.`
          : 'The rule is fixed and the raw probabilities are visible. Commit to the dominant measured value before the grouped distribution appears.'}
      </p>

      <style jsx>{`
        .wrap {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .controls,
        .prediction {
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 251, 245, 0.78);
        }

        .controls {
          display: grid;
          grid-template-columns: minmax(170px, 0.28fr) minmax(0, 1fr);
          gap: 0.75rem;
          padding: 0.8rem;
        }

        .presetGroup,
        .controlGrid,
        .prediction {
          display: grid;
          gap: 0.45rem;
        }

        .prediction {
          grid-template-columns: minmax(0, 1fr) minmax(160px, 0.5fr) auto;
          align-items: center;
          gap: 0.75rem;
          padding: 0.78rem;
        }

        .predictionCopy {
          display: grid;
          gap: 0.28rem;
          min-width: 0;
        }

        .predictionCopy span {
          color: #1f6f78;
          font-family: var(--font-mono);
          font-size: 0.68rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
        }

        .predictionCopy strong {
          color: #1b2430;
          font-size: 0.9rem;
          line-height: 1.25;
        }

        .predictionCopy p,
        .result p {
          margin: 0;
          color: #4a5865;
          font-size: 0.82rem;
          line-height: 1.45;
        }

        .predictionCopy code {
          white-space: normal;
          overflow-wrap: anywhere;
        }

        .choiceRow {
          display: grid;
          gap: 0.42rem;
        }

        button,
        select {
          min-height: 34px;
          border: 1px solid rgba(27, 36, 48, 0.12);
          border-radius: 8px;
          background: #fffaf0;
          color: #1b2430;
          padding: 0 0.68rem;
          font-size: 0.82rem;
          cursor: pointer;
        }

        button {
          text-align: left;
        }

        button[aria-pressed='true'],
        button.selected {
          border-color: rgba(31, 111, 120, 0.58);
          background: rgba(226, 242, 239, 0.9);
        }

        button:disabled {
          cursor: not-allowed;
          opacity: 0.48;
        }

        .reveal {
          align-self: stretch;
          min-width: 8.6rem;
          background: #1f6f78;
          color: #fffaf2;
          font-weight: 760;
          text-align: center;
        }

        label {
          display: grid;
          grid-template-columns: 8.2rem minmax(0, 1fr) 4.5rem;
          gap: 0.55rem;
          align-items: center;
          color: #4a5865;
          font-size: 0.8rem;
        }

        label:first-child {
          grid-template-columns: 8.2rem minmax(0, 16rem);
        }

        input,
        select {
          width: 100%;
        }

        label strong {
          color: #1b2430;
          font-family: var(--font-mono);
          text-align: right;
        }

        .result {
          min-height: 4.15rem;
          padding: 0.75rem;
          border: 1px solid rgba(27, 36, 48, 0.09);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.62);
        }

        .result.shown {
          border-color: rgba(31, 111, 120, 0.2);
          background: rgba(231, 248, 244, 0.62);
        }

        .result h4 {
          margin: 0 0 0.25rem;
          color: #17202a;
          font-size: 0.92rem;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 0.6rem;
        }

        .metrics div,
        .panel {
          min-width: 0;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.68);
        }

        .metrics div,
        .panel {
          padding: 0.7rem;
        }

        .metrics.locked div {
          background: rgba(248, 249, 246, 0.7);
        }

        .metrics span {
          display: block;
          color: #65717d;
          font-size: 0.74rem;
        }

        .metrics strong {
          color: #1b2430;
          font-family: var(--font-mono);
          overflow-wrap: anywhere;
        }

        .stage {
          display: grid;
          grid-template-columns: minmax(210px, 0.3fr) minmax(0, 1fr);
          gap: 0.75rem;
        }

        h3 {
          margin: 0 0 0.7rem;
          color: #1b2430;
          font-size: 0.92rem;
        }

        .outcomes {
          display: grid;
          gap: 0.52rem;
        }

        .outcome {
          display: grid;
          grid-template-columns: 4.6rem minmax(0, 1fr) 3.5rem;
          gap: 0.5rem;
          align-items: center;
        }

        .outcome strong,
        code {
          color: #1b2430;
          font-family: var(--font-mono);
          font-size: 0.78rem;
        }

        .barTrack {
          height: 10px;
          border-radius: 999px;
          background: rgba(27, 36, 48, 0.08);
          overflow: hidden;
        }

        .bar {
          height: 100%;
          border-radius: inherit;
        }

        .rawBar {
          background: #1f6f78;
        }

        svg {
          width: 100%;
          height: auto;
          border: 1px solid rgba(27, 36, 48, 0.1);
          border-radius: 8px;
          background: linear-gradient(180deg, rgba(247, 250, 246, 0.94), rgba(245, 249, 255, 0.82));
        }

        .plotBg {
          fill: rgba(255, 255, 255, 0.62);
          stroke: rgba(27, 36, 48, 0.1);
        }

        .title,
        .nodeText,
        .mapText,
        .xLabel,
        .pmfValue,
        .lockText {
          fill: #1b2430;
          font-family: var(--font-mono);
          font-size: 14px;
        }

        .title {
          fill: #586674;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 650;
        }

        .outcomeNode {
          fill: #fffaf0;
          stroke: rgba(27, 36, 48, 0.15);
        }

        .thinFlow,
        .flow {
          fill: none;
          stroke: #1f6f78;
          stroke-linecap: round;
        }

        .thinFlow {
          stroke-width: 2;
          stroke-dasharray: 4 5;
        }

        .flow {
          stroke: #c26f34;
        }

        .lockBox {
          fill: rgba(255, 250, 240, 0.84);
          stroke: rgba(27, 36, 48, 0.12);
        }

        .lockText {
          fill: #65717d;
          font-family: var(--font-sans);
          font-size: 13px;
          font-weight: 700;
        }

        .pmfTrack {
          fill: rgba(27, 36, 48, 0.08);
        }

        .pmfBar {
          fill: #1f6f78;
        }

        .pmfBar.dominant {
          fill: #c26f34;
        }

        .pmfValue {
          fill: #1b2430;
          font-size: 12px;
          font-weight: 700;
          paint-order: stroke;
          stroke: rgba(255, 255, 255, 0.82);
          stroke-width: 4px;
        }

        .claim {
          margin: 0;
          color: #4a5865;
          font-size: 0.84rem;
          line-height: 1.5;
        }

        @media (max-width: 860px) {
          .prediction {
            grid-template-columns: 1fr;
          }

          .reveal {
            justify-self: start;
            min-height: 2.6rem;
          }
        }

        @media (max-width: 760px) {
          .controls,
          .stage,
          .metrics {
            grid-template-columns: 1fr;
          }

          label,
          label:first-child {
            grid-template-columns: 1fr;
          }

          label strong {
            text-align: left;
          }

          svg {
            min-height: 240px;
          }
        }
      `}</style>
    </div>
  )
}
