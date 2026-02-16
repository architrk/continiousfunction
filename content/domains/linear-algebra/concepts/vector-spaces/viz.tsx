import { useMemo, useRef, useState } from 'react'
import type { Point2D } from '../../../../../lib/mathObjects'
import { clamp, MATH_COLORS } from '../../../../../lib/mathObjects'

type DragTarget = 'u' | 'v'

const VIEW_W = 560
const VIEW_H = 420

const SCALE = 50 // pixels per unit
const ORIGIN: Point2D = [VIEW_W / 2, VIEW_H / 2]

const toSvg = ([x, y]: Point2D): Point2D => {
  return [ORIGIN[0] + x * SCALE, ORIGIN[1] - y * SCALE]
}

const fromSvg = ([sx, sy]: Point2D): Point2D => {
  return [(sx - ORIGIN[0]) / SCALE, -(sy - ORIGIN[1]) / SCALE]
}

const fmt = (n: number): string => {
  const r = Math.round(n * 100) / 100
  return (Math.abs(r) < 0.005 ? 0 : r).toFixed(2)
}

export default function VectorSpacesViz() {
  const svgRef = useRef<SVGSVGElement | null>(null)

  const [u, setU] = useState<Point2D>([2.2, 1.4])
  const [v, setV] = useState<Point2D>([-1.2, 2.1])
  const [a, setA] = useState(1)
  const [b, setB] = useState(1)
  const [showParallelogram, setShowParallelogram] = useState(true)
  const [drag, setDrag] = useState<{ target: DragTarget; pointerId: number } | null>(null)

  const au = useMemo<Point2D>(() => [a * u[0], a * u[1]], [a, u])
  const bv = useMemo<Point2D>(() => [b * v[0], b * v[1]], [b, v])
  const w = useMemo<Point2D>(() => [au[0] + bv[0], au[1] + bv[1]], [au, bv])

  const uSvg = useMemo(() => toSvg(u), [u])
  const vSvg = useMemo(() => toSvg(v), [v])
  const auSvg = useMemo(() => toSvg(au), [au])
  const bvSvg = useMemo(() => toSvg(bv), [bv])
  const wSvg = useMemo(() => toSvg(w), [w])

  const grid = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; bold: boolean }> = []
    const max = 5

    for (let i = -max; i <= max; i++) {
      const x = ORIGIN[0] + i * SCALE
      const y = ORIGIN[1] - i * SCALE
      const bold = i === 0

      // vertical
      lines.push({ x1: x, y1: 0, x2: x, y2: VIEW_H, bold })
      // horizontal
      lines.push({ x1: 0, y1: y, x2: VIEW_W, y2: y, bold })
    }

    return lines
  }, [])

  const setByTarget = (target: DragTarget, next: Point2D) => {
    const clamped: Point2D = [clamp(next[0], -5, 5), clamp(next[1], -5, 5)]
    if (target === 'u') setU(clamped)
    else setV(clamped)
  }

  const pointerToSvgPoint = (clientX: number, clientY: number): Point2D | null => {
    const el = svgRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return null

    const x = ((clientX - rect.left) / rect.width) * VIEW_W
    const y = ((clientY - rect.top) / rect.height) * VIEW_H
    return [x, y]
  }

  const onHandleDown = (target: DragTarget) => (e: React.PointerEvent<SVGCircleElement>) => {
    e.preventDefault()
    e.stopPropagation()

    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      // non-fatal
    }

    setDrag({ target, pointerId: e.pointerId })
  }

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return

    const p = pointerToSvgPoint(e.clientX, e.clientY)
    if (!p) return

    setByTarget(drag.target, fromSvg(p))
  }

  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!drag) return
    if (e.pointerId !== drag.pointerId) return
    setDrag(null)
  }

  return (
    <div className="wrap">
      <div className="controls">
        <div className="row">
          <label className="lbl">
            <span className="lblTop">a (scale u)</span>
            <span className="lblVal">{fmt(a)}</span>
          </label>
          <input
            aria-label="a (scale u)"
            type="range"
            min={-2}
            max={2}
            step={0.01}
            value={a}
            onChange={(e) => setA(Number(e.target.value))}
          />
        </div>

        <div className="row">
          <label className="lbl">
            <span className="lblTop">b (scale v)</span>
            <span className="lblVal">{fmt(b)}</span>
          </label>
          <input
            aria-label="b (scale v)"
            type="range"
            min={-2}
            max={2}
            step={0.01}
            value={b}
            onChange={(e) => setB(Number(e.target.value))}
          />
        </div>

        <div className="row toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={showParallelogram}
              onChange={(e) => setShowParallelogram(e.target.checked)}
            />
            <span>Show parallelogram</span>
          </label>
          <button
            type="button"
            className="btn"
            onClick={() => {
              setU([2.2, 1.4])
              setV([-1.2, 2.1])
              setA(1)
              setB(1)
            }}
          >
            Reset
          </button>
        </div>

        <div className="eq">
          <div className="eqLine">
            <span className="mono">u</span> = ({fmt(u[0])}, {fmt(u[1])})
            <span className="dot" />
            <span className="mono">v</span> = ({fmt(v[0])}, {fmt(v[1])})
          </div>
          <div className="eqLine">
            <span className="mono">w</span> = <span className="mono">a u + b v</span> = ({fmt(w[0])}, {fmt(w[1])})
          </div>
          <div className="hint">Drag the endpoints of u and v. Scaling and addition stay inside the same space.</div>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="svg"
        role="img"
        aria-label="Vector space playground"
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* grid */}
        {grid.map((l, i) => (
          <line
            key={i}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.bold ? 'rgba(245, 158, 11, 0.35)' : 'rgba(245, 158, 11, 0.12)'}
            strokeWidth={l.bold ? 1.5 : 1}
          />
        ))}

        {/* axes labels */}
        <text x={ORIGIN[0] + 6} y={18} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          y
        </text>
        <text x={VIEW_W - 18} y={ORIGIN[1] - 6} fill="rgba(245, 245, 245, 0.65)" fontFamily="var(--font-mono)" fontSize="12">
          x
        </text>

        {/* parallelogram for u and v */}
        {showParallelogram ? (
          <path
            d={
              `M ${ORIGIN[0]} ${ORIGIN[1]} ` +
              `L ${uSvg[0]} ${uSvg[1]} ` +
              `L ${uSvg[0] + (vSvg[0] - ORIGIN[0])} ${uSvg[1] + (vSvg[1] - ORIGIN[1])} ` +
              `L ${vSvg[0]} ${vSvg[1]} Z`
            }
            fill="rgba(20, 184, 166, 0.06)"
            stroke="rgba(20, 184, 166, 0.25)"
            strokeWidth={1.5}
          />
        ) : null}

        {/* base vectors u and v */}
        <g style={{ color: MATH_COLORS.secondary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={uSvg[0]} y2={uSvg[1]} stroke={MATH_COLORS.secondary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>
        <g style={{ color: MATH_COLORS.primary }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={vSvg[0]} y2={vSvg[1]} stroke={MATH_COLORS.primary} strokeWidth={3} markerEnd="url(#arrow)" />
        </g>

        {/* scaled vectors au and bv (thin) */}
        <g style={{ color: 'rgba(20, 184, 166, 0.9)' }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={auSvg[0]}
            y2={auSvg[1]}
            stroke="rgba(20, 184, 166, 0.65)"
            strokeWidth={2}
            strokeDasharray="6 5"
            markerEnd="url(#arrow)"
          />
        </g>
        <g style={{ color: 'rgba(245, 158, 11, 0.9)' }}>
          <line
            x1={ORIGIN[0]}
            y1={ORIGIN[1]}
            x2={bvSvg[0]}
            y2={bvSvg[1]}
            stroke="rgba(245, 158, 11, 0.65)"
            strokeWidth={2}
            strokeDasharray="6 5"
            markerEnd="url(#arrow)"
          />
        </g>

        {/* result w */}
        <g style={{ color: MATH_COLORS.accent }}>
          <line x1={ORIGIN[0]} y1={ORIGIN[1]} x2={wSvg[0]} y2={wSvg[1]} stroke={MATH_COLORS.accent} strokeWidth={4} markerEnd="url(#arrow)" />
        </g>

        {/* handles */}
        <circle cx={uSvg[0]} cy={uSvg[1]} r={9} fill={MATH_COLORS.secondary} opacity={0.12} />
        <circle cx={uSvg[0]} cy={uSvg[1]} r={6} fill={MATH_COLORS.secondary} onPointerDown={onHandleDown('u')} style={{ cursor: 'grab' }} />

        <circle cx={vSvg[0]} cy={vSvg[1]} r={9} fill={MATH_COLORS.primary} opacity={0.12} />
        <circle cx={vSvg[0]} cy={vSvg[1]} r={6} fill={MATH_COLORS.primary} onPointerDown={onHandleDown('v')} style={{ cursor: 'grab' }} />

        {/* legend */}
        <g transform={`translate(16 ${VIEW_H - 86})`}>
          <rect x={0} y={0} width={230} height={70} rx={12} fill="rgba(8, 12, 20, 0.55)" stroke="rgba(245, 158, 11, 0.18)" />
          <g transform="translate(12 16)" fontFamily="var(--font-mono)" fontSize="12" fill="rgba(245, 245, 245, 0.8)">
            <circle cx={6} cy={6} r={4} fill={MATH_COLORS.secondary} />
            <text x={16} y={10}>u</text>

            <circle cx={6} cy={26} r={4} fill={MATH_COLORS.primary} />
            <text x={16} y={30}>v</text>

            <circle cx={6} cy={46} r={4} fill={MATH_COLORS.accent} />
            <text x={16} y={50}>w = a u + b v</text>
          </g>
        </g>
      </svg>

      <style jsx>{`
        .wrap {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1rem;
        }

        .controls {
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          background: rgba(8, 12, 20, 0.25);
          padding: 0.9rem 1rem;
        }

        .row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 0.75rem;
          align-items: center;
        }

        .row + .row {
          margin-top: 0.65rem;
        }

        .lbl {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.75rem;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        .lblTop {
          font-family: var(--font-body);
        }

        .lblVal {
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        input[type='range'] {
          width: 100%;
          accent-color: var(--converge-teal);
        }

        .toggles {
          grid-template-columns: 1fr auto;
        }

        .toggle {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          color: var(--text-secondary);
          user-select: none;
        }

        .btn {
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.35);
          color: var(--text-secondary);
          border-radius: 999px;
          padding: 0.35rem 0.75rem;
          font-size: 0.85rem;
          cursor: pointer;
          transition: border-color 0.2s ease, color 0.2s ease;
        }

        .btn:hover {
          border-color: var(--converge-teal);
          color: var(--text-primary);
        }

        .eq {
          margin-top: 0.9rem;
          padding-top: 0.85rem;
          border-top: 1px solid var(--border-subtle);
        }

        .eqLine {
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.55;
        }

        .eqLine + .eqLine {
          margin-top: 0.3rem;
        }

        .mono {
          font-family: var(--font-mono);
          color: var(--text-primary);
        }

        .dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(245, 158, 11, 0.5);
          margin: 0 0.6rem;
          transform: translateY(-1px);
        }

        .hint {
          margin-top: 0.4rem;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .svg {
          width: 100%;
          height: auto;
          border-radius: var(--radius-lg);
          border: 1px solid var(--border-subtle);
          background: rgba(8, 12, 20, 0.55);
          box-shadow: var(--shadow-deep);
          touch-action: none;
        }

        @media (min-width: 980px) {
          .wrap {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 520px) {
          .row {
            grid-template-columns: 1fr;
          }

          .toggles {
            grid-template-columns: 1fr;
          }

          .btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  )
}
