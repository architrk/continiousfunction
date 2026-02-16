import { useMemo, useState } from 'react'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type FnKey = 'x2' | 'sin' | 'exp'

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

export default function DerivativesViz() {
  const [fnKey, setFnKey] = useState<FnKey>('x2')
  const [x0, setX0] = useState(1)
  const [h, setH] = useState(0.6)
  const [showSecant, setShowSecant] = useState(true)
  const [showTangent, setShowTangent] = useState(true)

  const fn = useMemo(() => FUNS.find((s) => s.key === fnKey) ?? FUNS[0], [fnKey])

  const safeSetH = (next: number) => {
    const clampedH = clamp(next, 0.01, 2)
    setH(clampedH)
    setX0((prev) => clamp(prev, X_MIN + 0.2, X_MAX - 0.2 - clampedH))
  }

  const safeSetX0 = (next: number) => {
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
          <label className="lbl">
            <span className="lblTop">Function</span>
          </label>
          <select className="sel" value={fnKey} onChange={(e) => setFnKey(e.target.value as FnKey)}>
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
            aria-label="h"
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
          <label className="toggle">
            <input type="checkbox" checked={showTangent} onChange={(e) => setShowTangent(e.target.checked)} />
            <span>Show tangent</span>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
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
          <div className="line">
            <span className="mono">secant</span> = (f(x+h) − f(x)) / h = <span className="val">{fmt(secantSlope)}</span>
          </div>
          <div className="line">
            <span className="mono">tangent</span> = f'(x) = <span className="val">{fmt(tangentSlope)}</span>
          </div>
          <div className="hint">Shrink h to watch the secant slope converge to the derivative.</div>
        </div>
      </div>

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
        {showTangent ? (
          <line x1={tangentLine.x1} y1={tangentLine.y1} x2={tangentLine.x2} y2={tangentLine.y2} stroke={MATH_COLORS.primary} strokeWidth={2} strokeDasharray="2 6" />
        ) : null}

        {/* points */}
        <circle cx={p0.x} cy={p0.y} r={6.5} fill={MATH_COLORS.primary} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />
        <circle cx={p1.x} cy={p1.y} r={6.5} fill={MATH_COLORS.secondary} stroke="rgba(0,0,0,0.35)" strokeWidth={1} />

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

        .mono {
          font-family: var(--font-mono);
        }

        .val {
          font-family: var(--font-mono);
          color: ${MATH_COLORS.secondary};
        }

        .hint {
          margin-top: 0.45rem;
          color: rgba(148, 163, 184, 0.88);
          font-size: 0.85rem;
        }

        .svg {
          width: 100%;
          height: auto;
          display: block;
        }
      `}</style>
    </div>
  )
}
