import { useEffect, useMemo, useState } from 'react'
import { clearDemoState, emitDemoState } from '../../../../../lib/demoState'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type FnKey = 'x2' | 'sin' | 'exp'
export type TangentRelation = 'tangent-lower' | 'near' | 'tangent-higher'

type FnSpec = {
  key: FnKey
  label: string
  f: (x: number) => number
  df: (x: number) => number
}

const FUNS: FnSpec[] = [
  {
    key: 'x2',
    label: 'f(x) = x^2',
    f: (x) => x * x,
    df: (x) => 2 * x,
  },
  {
    key: 'sin',
    label: 'f(x) = sin(x)',
    f: (x) => Math.sin(x),
    df: (x) => Math.cos(x),
  },
  {
    key: 'exp',
    label: 'f(x) = exp(x)',
    f: (x) => Math.exp(x),
    df: (x) => Math.exp(x),
  },
]

const VIEW_W = 560
const VIEW_H = 420

const PAD = 42
const PLOT_W = VIEW_W - PAD * 2
const PLOT_H = VIEW_H - PAD * 2

const X_MIN = -3
const X_MAX = 3

const fmt = (n: number): string => {
  const r = Math.round(n * 1000) / 1000
  return (Math.abs(r) < 0.0005 ? 0 : r).toString()
}

const RELATION_COPY: Record<TangentRelation, { label: string; detail: string; status: string }> = {
  'tangent-lower': {
    label: "f'(x) is lower",
    detail: 'The local slope at x sits below the visible average slope.',
    status: 'tangent lower',
  },
  near: {
    label: "f'(x) is nearly equal",
    detail: 'The visible average already matches the local slope closely.',
    status: 'nearly equal',
  },
  'tangent-higher': {
    label: "f'(x) is higher",
    detail: 'The local slope at x sits above the visible average slope.',
    status: 'tangent higher',
  },
}

export function classifyTangentRelation(tangentSlope: number, secantSlope: number): {
  relation: TangentRelation
  signedSlopeGap: number
  relationTolerance: number
} {
  const signedSlopeGap = tangentSlope - secantSlope
  const relationTolerance = Math.max(0.02, 0.02 * Math.max(1, Math.abs(tangentSlope), Math.abs(secantSlope)))

  if (Math.abs(signedSlopeGap) <= relationTolerance) {
    return { relation: 'near', signedSlopeGap, relationTolerance }
  }

  return {
    relation: signedSlopeGap > 0 ? 'tangent-higher' : 'tangent-lower',
    signedSlopeGap,
    relationTolerance,
  }
}

export default function DerivativesViz() {
  const [fnKey, setFnKey] = useState<FnKey>('x2')
  const [x0, setX0] = useState(1)
  const [h, setH] = useState(0.6)
  const [showSecant, setShowSecant] = useState(true)
  const [showTangent, setShowTangent] = useState(true)
  const [prediction, setPrediction] = useState<TangentRelation | null>(null)
  const [revealed, setRevealed] = useState(false)

  const fn = useMemo(() => FUNS.find((s) => s.key === fnKey) ?? FUNS[0], [fnKey])

  const resetReveal = () => {
    setPrediction(null)
    setRevealed(false)
    clearDemoState('derivatives')
  }

  const setFunctionKey = (next: FnKey) => {
    resetReveal()
    setFnKey(next)
  }

  const safeSetH = (next: number) => {
    resetReveal()
    const clampedH = clamp(next, 0.01, 2)
    setH(clampedH)
    setX0((prev) => clamp(prev, X_MIN + 0.2, X_MAX - 0.2 - clampedH))
  }

  const safeSetX0 = (next: number) => {
    resetReveal()
    setX0(clamp(next, X_MIN + 0.2, X_MAX - 0.2 - h))
  }

  const curve = useMemo(() => {
    const n = 240
    const pts: Array<{ x: number; y: number }> = []

    let yMin = Infinity
    let yMax = -Infinity

    for (let i = 0; i <= n; i++) {
      const x = X_MIN + (i / n) * (X_MAX - X_MIN)
      const y = fn.f(x)
      pts.push({ x, y })
      if (Number.isFinite(y)) {
        yMin = Math.min(yMin, y)
        yMax = Math.max(yMax, y)
      }
    }

    if (!Number.isFinite(yMin) || !Number.isFinite(yMax)) {
      yMin = -1
      yMax = 1
    }

    const pad = (yMax - yMin) * 0.18 + 0.25
    yMin -= pad
    yMax += pad

    return { pts, yMin, yMax }
  }, [fn])

  const xToSvg = (x: number): number => PAD + ((x - X_MIN) / (X_MAX - X_MIN)) * PLOT_W
  const yToSvg = (y: number): number => PAD + (1 - (y - curve.yMin) / (curve.yMax - curve.yMin)) * PLOT_H

  const pathD = useMemo(() => {
    let d = ''
    for (let i = 0; i < curve.pts.length; i++) {
      const p = curve.pts[i]
      const sx = xToSvg(p.x)
      const sy = yToSvg(p.y)
      d += i === 0 ? `M ${sx} ${sy}` : ` L ${sx} ${sy}`
    }
    return d
  }, [curve.pts, curve.yMax, curve.yMin])

  const x1 = x0 + h
  const y0 = fn.f(x0)
  const y1 = fn.f(x1)

  const secantSlope = (y1 - y0) / h
  const tangentSlope = fn.df(x0)
  const relation = useMemo(
    () => classifyTangentRelation(tangentSlope, secantSlope),
    [secantSlope, tangentSlope]
  )
  const slopeGap = Math.abs(secantSlope - tangentSlope)
  const convergenceStatus =
    slopeGap <= relation.relationTolerance
      ? 'nearly tangent'
      : slopeGap <= relation.relationTolerance * 5
        ? 'approaching tangent'
        : 'coarse secant'
  const predictionCorrect = prediction === relation.relation

  const secantLine = useMemo(() => {
    const yL = y0 + secantSlope * (X_MIN - x0)
    const yR = y0 + secantSlope * (X_MAX - x0)
    return {
      x1: xToSvg(X_MIN),
      y1: yToSvg(yL),
      x2: xToSvg(X_MAX),
      y2: yToSvg(yR),
    }
  }, [secantSlope, x0, y0, curve.yMax, curve.yMin])

  const tangentLine = useMemo(() => {
    const yL = y0 + tangentSlope * (X_MIN - x0)
    const yR = y0 + tangentSlope * (X_MAX - x0)
    return {
      x1: xToSvg(X_MIN),
      y1: yToSvg(yL),
      x2: xToSvg(X_MAX),
      y2: yToSvg(yR),
    }
  }, [tangentSlope, x0, y0, curve.yMax, curve.yMin])

  const p0 = { x: xToSvg(x0), y: yToSvg(y0) }
  const p1 = { x: xToSvg(x1), y: yToSvg(y1) }

  useEffect(() => {
    clearDemoState('derivatives')
    return () => clearDemoState('derivatives')
  }, [])

  useEffect(() => {
    if (!revealed || !prediction) {
      clearDemoState('derivatives')
      return
    }

    emitDemoState({
      conceptId: 'derivatives',
      label: 'Secant-to-tangent derivative reveal',
      summary: `prediction=${prediction}; actual=${relation.relation}; correct=${predictionCorrect ? 'yes' : 'no'}; ${fn.label}, x=${fmt(x0)}, h=${fmt(h)}, secant=${fmt(secantSlope)}, tangent=${fmt(tangentSlope)}, signed gap=${fmt(relation.signedSlopeGap)}.`,
      values: [
        `prediction: ${prediction}`,
        `actual relation: ${relation.relation}`,
        `prediction correct: ${predictionCorrect ? 'yes' : 'no'}`,
        `function: ${fn.label}`,
        `x: ${fmt(x0)}`,
        `x+h: ${fmt(x1)}`,
        `h: ${fmt(h)}`,
        `f(x): ${fmt(y0)}`,
        `f(x+h): ${fmt(y1)}`,
        `secant slope: ${fmt(secantSlope)}`,
        `tangent slope: ${fmt(tangentSlope)}`,
        `signed slope gap: tangent - secant = ${fmt(relation.signedSlopeGap)}`,
        `absolute slope gap: ${fmt(slopeGap)}`,
        `relation tolerance: ${fmt(relation.relationTolerance)}`,
        `convergence status: ${convergenceStatus}`,
        `visible layers: ${showSecant ? 'secant' : 'secant hidden'}, ${showTangent ? 'tangent' : 'tangent hidden'}`,
      ],
    })
  }, [convergenceStatus, fn.label, h, prediction, predictionCorrect, relation, revealed, secantSlope, showSecant, showTangent, slopeGap, tangentSlope, x0, x1, y0, y1])

  const axes = useMemo(() => {
    // x-axis at y=0 if it’s inside the view
    const y0Svg = yToSvg(0)
    const showXAxis = y0Svg >= PAD && y0Svg <= PAD + PLOT_H

    // y-axis at x=0 always inside because X_MIN < 0 < X_MAX
    const x0Svg = xToSvg(0)

    return {
      xAxis: showXAxis ? { x1: PAD, y1: y0Svg, x2: PAD + PLOT_W, y2: y0Svg } : null,
      yAxis: { x1: x0Svg, y1: PAD, x2: x0Svg, y2: PAD + PLOT_H },
    }
  }, [curve.yMax, curve.yMin])

  return (
    <div className="wrap">
      <div className="controls">
        <div className="row">
          <label className="lbl" htmlFor="derivatives-function">
            <span className="lblTop">Function</span>
          </label>
          <select id="derivatives-function" className="sel" value={fnKey} onChange={(e) => setFunctionKey(e.target.value as FnKey)}>
            {FUNS.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <div className="row">
          <label className="lbl">
            <span className="lblTop">x</span>
            <span className="lblVal">{fmt(x0)}</span>
          </label>
          <input
            aria-label="x"
            type="range"
            min={X_MIN + 0.2}
            max={X_MAX - 0.2 - h}
            step={0.01}
            value={x0}
            onChange={(e) => safeSetX0(Number(e.target.value))}
          />
        </div>

        <div className="row">
          <label className="lbl">
            <span className="lblTop">h (step)</span>
            <span className="lblVal">{fmt(h)}</span>
          </label>
          <input
            aria-label="h (step)"
            type="range"
            min={0.01}
            max={2}
            step={0.01}
            value={h}
            onChange={(e) => safeSetH(Number(e.target.value))}
          />
        </div>

        <div className="row toggles">
          <label className="toggle">
            <input type="checkbox" checked={showSecant} onChange={(e) => setShowSecant(e.target.checked)} />
            <span>Show secant</span>
          </label>
          {revealed ? (
            <label className="toggle">
              <input type="checkbox" checked={showTangent} onChange={(e) => setShowTangent(e.target.checked)} />
              <span>Show revealed tangent</span>
            </label>
          ) : null}
          <button
            type="button"
            className="btn"
            onClick={() => {
              resetReveal()
              setFnKey('x2')
              setX0(1)
              setH(0.6)
              setShowSecant(true)
              setShowTangent(true)
            }}
          >
            Reset
          </button>
        </div>

        <div className="readout">
          <div className="line interval">
            <span className="mono">x+h</span> = <span className="val">{fmt(x1)}</span>
            <span className="mono">f(x)</span> = <span className="val">{fmt(y0)}</span>
            <span className="mono">f(x+h)</span> = <span className="val">{fmt(y1)}</span>
          </div>
          <div className="line">
            <span className="mono">secant</span> = (f(x+h) − f(x)) / h = <span className="val">{fmt(secantSlope)}</span>
          </div>
          {revealed ? (
            <>
              <div className="line emph">
                <span className="mono">tangent</span> = f'(x) = <span className="val">{fmt(tangentSlope)}</span>
              </div>
              <div className="line emph">
                <span className="mono">signed gap</span> = tangent − secant = <span className="val">{fmt(relation.signedSlopeGap)}</span>
              </div>
              <div className="line">
                <span className="mono">absolute gap</span> = <span className="val">{fmt(slopeGap)}</span>
                <span className={`badge ${convergenceStatus.replace(/\s+/g, '-')}`}>{convergenceStatus}</span>
              </div>
            </>
          ) : (
            <div className="line locked">local tangent slope and gap hidden until reveal</div>
          )}
          <div className="hint">The secant is the visible average over the interval. Predict the hidden local tangent at x before revealing the derivative.</div>
        </div>
      </div>

      <section className="predictionPanel">
        <div className="predictionCopy">
          <span>prediction checkpoint</span>
          <strong>Where is the hidden tangent slope?</strong>
          <p>
            Compare the curve near <span className="mono">x</span> with the visible secant interval. Is the local tangent slope lower than, nearly equal to, or higher than the secant slope?
          </p>
        </div>

        <div className="choiceRow" role="group" aria-label="Hidden tangent relation prediction">
          {(Object.keys(RELATION_COPY) as TangentRelation[]).map((key) => (
            <button
              key={key}
              type="button"
              className={prediction === key ? 'selected' : ''}
              aria-pressed={prediction === key}
              onClick={() => {
                setPrediction(key)
                setRevealed(false)
                clearDemoState('derivatives')
              }}
            >
              <strong>{RELATION_COPY[key].label}</strong>
              <span>{RELATION_COPY[key].detail}</span>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="reveal"
          disabled={!prediction}
          onClick={() => {
            if (prediction) setRevealed(true)
          }}
        >
          Reveal tangent relation
        </button>
      </section>

      <section className={`result ${revealed ? 'shown' : ''}`} aria-live="polite">
        {revealed && prediction ? (
          <>
            <h4>{predictionCorrect ? 'Correct.' : 'Not quite.'} The hidden tangent is {RELATION_COPY[relation.relation].status}.</h4>
            <p>
              Prediction: {RELATION_COPY[prediction].label}. Actual: {RELATION_COPY[relation.relation].label}. The secant averaged the interval, while the derivative is the local limit at <span className="mono">x</span>.
            </p>
            <div className="resultGrid">
              <span>secant</span>
              <strong>{fmt(secantSlope)}</strong>
              <span>tangent</span>
              <strong>{fmt(tangentSlope)}</strong>
              <span>signed gap</span>
              <strong>{fmt(relation.signedSlopeGap)}</strong>
              <span>tolerance</span>
              <strong>{fmt(relation.relationTolerance)}</strong>
            </div>
          </>
        ) : (
          <p>{prediction ? 'Reveal the tangent line to test your relation prediction.' : "Choose a tangent relation to unlock f'(x), the tangent line, and the slope gap."}</p>
        )}
      </section>

      <svg className="svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label="Derivative as secant-to-tangent">
        {/* plot background */}
        <rect x={PAD} y={PAD} width={PLOT_W} height={PLOT_H} fill="rgba(8, 12, 20, 0.35)" stroke="rgba(148, 163, 184, 0.16)" />

        {/* axes */}
        {axes.xAxis ? <line x1={axes.xAxis.x1} y1={axes.xAxis.y1} x2={axes.xAxis.x2} y2={axes.xAxis.y2} stroke="rgba(148, 163, 184, 0.35)" strokeWidth={1.5} /> : null}
        <line x1={axes.yAxis.x1} y1={axes.yAxis.y1} x2={axes.yAxis.x2} y2={axes.yAxis.y2} stroke="rgba(148, 163, 184, 0.35)" strokeWidth={1.5} />

        {/* curve */}
          <path d={pathD} fill="none" stroke="rgba(245, 245, 245, 0.82)" strokeWidth={2.5} />

        {/* secant line */}
        {showSecant ? (
          <line x1={secantLine.x1} y1={secantLine.y1} x2={secantLine.x2} y2={secantLine.y2} stroke={MATH_COLORS.secondary} strokeWidth={2} strokeDasharray="6 5" />
        ) : null}

        {/* tangent line */}
        {revealed && showTangent ? (
          <line x1={tangentLine.x1} y1={tangentLine.y1} x2={tangentLine.x2} y2={tangentLine.y2} stroke={MATH_COLORS.primary} strokeWidth={2} strokeDasharray="2 6" />
        ) : null}

        {/* points */}
          <circle className="moving-point" cx={p0.x} cy={p0.y} r={6.5} fill={MATH_COLORS.primary} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
          <circle className="moving-point" cx={p1.x} cy={p1.y} r={6.5} fill={MATH_COLORS.secondary} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />

        {/* delta triangle */}
        {showSecant ? (
          <>
            <line x1={p0.x} y1={p0.y} x2={p1.x} y2={p0.y} stroke="rgba(148, 163, 184, 0.5)" strokeWidth={1.5} />
            <line x1={p1.x} y1={p0.y} x2={p1.x} y2={p1.y} stroke="rgba(148, 163, 184, 0.5)" strokeWidth={1.5} />
            <text x={(p0.x + p1.x) / 2} y={p0.y - 8} fill="rgba(148, 163, 184, 0.9)" fontFamily="var(--font-mono)" fontSize="12" textAnchor="middle">
              Δx
            </text>
            <text x={p1.x + 10} y={(p0.y + p1.y) / 2} fill="rgba(148, 163, 184, 0.9)" fontFamily="var(--font-mono)" fontSize="12">
              Δy
            </text>
          </>
        ) : null}
      </svg>

      <style jsx>{`
        .wrap {
          border: 1px solid rgba(34, 197, 94, 0.18);
          border-radius: 14px;
          background: rgba(10, 12, 18, 0.55);
          overflow: hidden;
        }

        .controls {
          padding: 0.9rem 1rem 0.75rem;
          border-bottom: 1px solid rgba(34, 197, 94, 0.14);
        }

        .row {
          display: flex;
          align-items: center;
          gap: 0.9rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .lbl {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          min-width: 110px;
        }

        .lblTop {
          font-family: var(--font-mono);
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: rgba(245, 245, 245, 0.65);
        }

        .lblVal {
          font-family: var(--font-mono);
          font-size: 0.85rem;
          color: rgba(245, 245, 245, 0.88);
        }

        input[type='range'] {
          flex: 1;
          min-width: 220px;
        }

        .sel {
          border-radius: 10px;
          border: 1px solid rgba(148, 163, 184, 0.24);
          background: rgba(8, 12, 20, 0.55);
          color: rgba(245, 245, 245, 0.9);
          padding: 0.45rem 0.55rem;
        }

        .toggles {
          justify-content: space-between;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          color: rgba(245, 245, 245, 0.78);
          user-select: none;
        }

        .btn {
          appearance: none;
          border: 1px solid rgba(34, 197, 94, 0.3);
          background: rgba(34, 197, 94, 0.1);
          color: rgba(245, 245, 245, 0.9);
          padding: 0.35rem 0.6rem;
          border-radius: 10px;
          font-size: 0.85rem;
          cursor: pointer;
        }

        .btn:hover {
          background: rgba(34, 197, 94, 0.14);
        }

        .readout {
          margin-top: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          background: rgba(8, 12, 20, 0.35);
          border-radius: 12px;
          padding: 0.65rem 0.75rem;
        }

        .line {
          color: rgba(245, 245, 245, 0.86);
          font-size: 0.92rem;
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
          align-items: baseline;
        }

        .line.emph {
          color: rgba(245, 245, 245, 0.96);
        }

        .locked {
          border: 1px dashed rgba(34, 197, 94, 0.24);
          border-radius: 8px;
          color: rgba(148, 163, 184, 0.9);
          margin-top: 0.4rem;
          padding: 0.4rem 0.55rem;
        }

        .mono {
          font-family: var(--font-mono);
        }

        .val {
          font-family: var(--font-mono);
          color: ${MATH_COLORS.secondary};
        }

        .badge {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 999px;
          color: rgba(245, 245, 245, 0.78);
          font-family: var(--font-mono);
          font-size: 0.72rem;
          padding: 0.12rem 0.45rem;
        }

        .badge.nearly-tangent {
          border-color: rgba(34, 197, 94, 0.38);
          color: rgba(187, 247, 208, 0.95);
        }

        .badge.approaching-tangent {
          border-color: rgba(59, 130, 246, 0.38);
          color: rgba(191, 219, 254, 0.95);
        }

        .hint {
          margin-top: 0.45rem;
          color: rgba(148, 163, 184, 0.88);
          font-size: 0.85rem;
        }

        .predictionPanel,
        .result {
          border-top: 1px solid rgba(34, 197, 94, 0.14);
          padding: 0.9rem 1rem;
        }

        .predictionPanel {
          background: rgba(8, 12, 20, 0.2);
        }

        .predictionCopy {
          display: grid;
          gap: 0.25rem;
        }

        .predictionCopy span,
        .result span {
          color: rgba(148, 163, 184, 0.88);
          font-size: 0.74rem;
          text-transform: uppercase;
        }

        .predictionCopy strong,
        .result h4 {
          color: rgba(245, 245, 245, 0.96);
          font-size: 1rem;
          margin: 0;
        }

        .predictionCopy p,
        .result p {
          color: rgba(203, 213, 225, 0.88);
          font-size: 0.9rem;
          line-height: 1.55;
          margin: 0;
        }

        .choiceRow {
          display: grid;
          gap: 0.55rem;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          margin-top: 0.8rem;
        }

        .choiceRow button {
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          background: rgba(8, 12, 20, 0.42);
          color: rgba(203, 213, 225, 0.9);
          cursor: pointer;
          display: grid;
          gap: 0.25rem;
          min-height: 92px;
          padding: 0.7rem;
          text-align: left;
        }

        .choiceRow button strong {
          color: rgba(245, 245, 245, 0.96);
          font-size: 0.9rem;
        }

        .choiceRow button span {
          color: rgba(148, 163, 184, 0.9);
          font-size: 0.78rem;
          line-height: 1.45;
          text-transform: none;
        }

        .choiceRow button.selected {
          border-color: rgba(34, 197, 94, 0.62);
          box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.2);
        }

        .reveal {
          border: 1px solid rgba(34, 197, 94, 0.45);
          border-radius: 8px;
          background: rgba(34, 197, 94, 0.13);
          color: rgba(245, 245, 245, 0.96);
          cursor: pointer;
          font-weight: 700;
          margin-top: 0.75rem;
          padding: 0.65rem 0.9rem;
          width: 100%;
        }

        .reveal:disabled {
          border-color: rgba(148, 163, 184, 0.18);
          color: rgba(148, 163, 184, 0.84);
          cursor: not-allowed;
          opacity: 0.74;
        }

        .result {
          background: rgba(8, 12, 20, 0.3);
          min-height: 72px;
        }

        .result.shown {
          border-top-color: rgba(34, 197, 94, 0.3);
        }

        .resultGrid {
          display: grid;
          gap: 0.45rem 0.75rem;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          margin-top: 0.75rem;
        }

        .resultGrid strong {
          color: rgba(245, 245, 245, 0.96);
          font-family: var(--font-mono);
          font-size: 0.94rem;
        }

        .svg {
          width: 100%;
          height: auto;
          display: block;
        }

        .svg line,
        .svg circle,
        .svg path {
          transition:
            cx 180ms ease,
            cy 180ms ease,
            x1 180ms ease,
            x2 180ms ease,
            y1 180ms ease,
            y2 180ms ease,
            d 180ms ease,
            opacity 180ms ease;
        }

        @media (max-width: 620px) {
          input[type='range'] {
            min-width: 170px;
          }

          .choiceRow,
          .resultGrid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}
