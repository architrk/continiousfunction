import { useMemo, useState } from 'react'

const X_MIN = -2
const X_MAX = 6
const WIDTH = 320
const HEIGHT = 220
const PADDING = 24
const MAX_Y = 8

function f(x: number) {
  const dx = x - 2
  return 0.5 * dx * dx
}

function gradf(x: number) {
  return x - 2
}

export default function GradientDescentPlayground() {
  const [lr, setLr] = useState(0.2)
  const [momentum, setMomentum] = useState(0.8)
  const [x, setX] = useState(4)
  const [v, setV] = useState(0)
  const [steps, setSteps] = useState(0)

  const samples = useMemo(() => {
    const pts: { x: number; y: number }[] = []
    const n = 120
    for (let i = 0; i <= n; i++) {
      const xp = X_MIN + ((X_MAX - X_MIN) * i) / n
      pts.push({ x: xp, y: f(xp) })
    }
    return pts
  }, [])

  const xToSvg = (xv: number) => {
    const t = (xv - X_MIN) / (X_MAX - X_MIN)
    return PADDING + t * (WIDTH - 2 * PADDING)
  }

  const yToSvg = (yv: number) => {
    const clamped = Math.min(yv, MAX_Y)
    const t = clamped / MAX_Y
    return HEIGHT - PADDING - t * (HEIGHT - 2 * PADDING)
  }

  const pathD = useMemo(() => {
    if (samples.length === 0) return ''
    return samples
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xToSvg(p.x)} ${yToSvg(p.y)}`)
      .join(' ')
  }, [samples])

  const stepOnce = () => {
    const g = gradf(x)
    const newV = momentum * v - lr * g
    const newX = x + newV
    setV(newV)
    setX(newX)
    setSteps((s) => s + 1)
  }

  const reset = () => {
    setX(4)
    setV(0)
    setSteps(0)
  }

  const currentY = f(x)

  return (
    <section className="card interactive-card">
      <h2>Gradient Descent Playground</h2>
      <p className="muted">
        Adjust the learning rate and momentum to see how the optimizer moves
        along a simple 1D loss landscape.
      </p>
      <div className="gd-layout">
        <svg width={WIDTH} height={HEIGHT} className="gd-chart" role="img">
          <line
            x1={xToSvg(X_MIN)}
            y1={yToSvg(0)}
            x2={xToSvg(X_MAX)}
            y2={yToSvg(0)}
            className="axis-line"
          />
          <line
            x1={xToSvg(2)}
            y1={yToSvg(0)}
            x2={xToSvg(2)}
            y2={yToSvg(MAX_Y)}
            className="axis-line axis-center"
          />
          <path d={pathD} className="gd-curve" />
          <circle
            cx={xToSvg(x)}
            cy={yToSvg(currentY)}
            r={6}
            className="gd-point"
          />
        </svg>
        <div className="gd-controls">
          <label className="slider-label">
            Learning rate ({lr.toFixed(2)})
            <input
              type="range"
              min={0.02}
              max={1}
              step={0.02}
              value={lr}
              onChange={(e) => setLr(parseFloat(e.target.value))}
            />
          </label>
          <label className="slider-label">
            Momentum ({momentum.toFixed(2)})
            <input
              type="range"
              min={0}
              max={0.99}
              step={0.01}
              value={momentum}
              onChange={(e) => setMomentum(parseFloat(e.target.value))}
            />
          </label>
          <div className="gd-stats">
            <div>
              <span className="label">Step:</span> {steps}
            </div>
            <div>
              <span className="label">x:</span> {x.toFixed(3)}
            </div>
            <div>
              <span className="label">Loss:</span> {currentY.toFixed(4)}
            </div>
          </div>
          <div className="gd-buttons">
            <button onClick={stepOnce}>Step once</button>
            <button onClick={reset} className="ghost">
              Reset
            </button>
          </div>
          <p className="caption">
            Too large a learning rate overshoots the minimum; low momentum gives
            a wiggly path, high momentum smooths it.
          </p>
        </div>
      </div>
    </section>
  )
}
