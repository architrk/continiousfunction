'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import PhasePortrait2D from '../../components/PhasePortrait2D'
import TimeSeriesPlot from '../../components/TimeSeriesPlot'
import { VectorField2D, Point2D, TimeSeries, numericalGradient } from '../../lib/mathObjects'

// Rosenbrock-like loss surface
function lossFunction(x: number, y: number): number {
  return (1 - x) ** 2 + 100 * (y - x ** 2) ** 2
}

function OptimizationVisualPanel() {
  const { activeSection, params } = useExplorable()
  const animationRef = useRef<number>()
  const [trajectories, setTrajectories] = useState<Point2D[][]>([])
  const [currentPoints, setCurrentPoints] = useState<Point2D[]>([])
  const [lossCurves, setLossCurves] = useState<TimeSeries[]>([])

  const lr = (params.learningRate as number) || 0.001
  const momentum = (params.momentum as number) || 0.9
  const optimizer = (params.optimizer as string) || 'sgd'

  // Gradient field for the loss surface
  const gradientField: VectorField2D = useMemo(() => ({
    fn: (x: number, y: number) => {
      const [gx, gy] = numericalGradient(lossFunction, x, y)
      return [-gx * 0.01, -gy * 0.01] // Negative gradient, scaled
    },
    domain: { x: [-2, 2], y: [-1, 3] },
    label: 'Gradient Field',
  }), [])

  // Run optimization simulation
  useEffect(() => {
    if (activeSection !== 'landscape' && activeSection !== 'momentum' && activeSection !== 'adaptive') {
      return
    }

    // Starting point
    let point: Point2D = [-1.5, 2.5]
    let velocity: Point2D = [0, 0]
    let m: Point2D = [0, 0] // First moment (Adam)
    let v: Point2D = [0, 0] // Second moment (Adam)
    const beta1 = 0.9
    const beta2 = 0.999
    const eps = 1e-8

    const trajectory: Point2D[] = [point]
    const losses: { t: number; value: number }[] = [{ t: 0, value: lossFunction(point[0], point[1]) }]

    let step = 0
    const maxSteps = 200

    const animate = () => {
      if (step >= maxSteps) return

      const [gx, gy] = numericalGradient(lossFunction, point[0], point[1])

      if (optimizer === 'sgd') {
        point = [point[0] - lr * gx, point[1] - lr * gy]
      } else if (optimizer === 'momentum') {
        velocity = [
          momentum * velocity[0] - lr * gx,
          momentum * velocity[1] - lr * gy,
        ]
        point = [point[0] + velocity[0], point[1] + velocity[1]]
      } else if (optimizer === 'adam') {
        step++
        m = [beta1 * m[0] + (1 - beta1) * gx, beta1 * m[1] + (1 - beta1) * gy]
        v = [beta2 * v[0] + (1 - beta2) * gx * gx, beta2 * v[1] + (1 - beta2) * gy * gy]
        const mHat = [m[0] / (1 - beta1 ** step), m[1] / (1 - beta1 ** step)]
        const vHat = [v[0] / (1 - beta2 ** step), v[1] / (1 - beta2 ** step)]
        point = [
          point[0] - lr * mHat[0] / (Math.sqrt(vHat[0]) + eps),
          point[1] - lr * mHat[1] / (Math.sqrt(vHat[1]) + eps),
        ]
      }

      trajectory.push(point)
      losses.push({ t: step, value: Math.log10(lossFunction(point[0], point[1]) + 1) })

      setTrajectories([trajectory.slice()])
      setCurrentPoints([point])
      setLossCurves([{ data: losses.slice(), label: optimizer.toUpperCase(), color: '#14b8a6' }])

      step++
      animationRef.current = requestAnimationFrame(animate)
    }

    setTrajectories([])
    setCurrentPoints([[-1.5, 2.5]])
    setLossCurves([])
    animationRef.current = requestAnimationFrame(animate)

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
    }
  }, [activeSection, lr, momentum, optimizer])

  if (activeSection === 'landscape' || activeSection === 'momentum' || activeSection === 'adaptive') {
    return (
      <div>
        <PhasePortrait2D
          field={gradientField}
          trajectories={trajectories}
          currentPoint={currentPoints[0]}
          width={360}
          height={320}
          showVectors={true}
          arrowDensity={10}
        />
        {lossCurves.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <TimeSeriesPlot
              series={lossCurves}
              width={360}
              height={120}
              xLabel="Step"
              yLabel="log(Loss)"
              showLegend={false}
            />
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ textAlign: 'center', padding: '2rem 0' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>∇</div>
      <p style={{ color: '#b8b0a0' }}>
        Scroll to see optimizer<br />trajectories in action
      </p>
    </div>
  )
}

export default function OptimizationPillar() {
  return (
    <ExplorableLayout
      title="Optimization"
      subtitle="Gradient descent as physics in the loss landscape"
      visualPanel={<OptimizationVisualPanel />}
      initialParams={{ learningRate: 0.001, momentum: 0.9, optimizer: 'sgd' }}
    >
      <ExplorableSection id="intro">
        <h2>The Loss Landscape</h2>
        <p>
          Neural network training is optimization in high-dimensional space. The loss function
          defines a landscape, and we seek to find its valleys — points where the model performs well.
        </p>
        <p>
          But this landscape is not simple. It has saddle points, narrow ravines, and
          sharp minima that generalize poorly. The optimizer we choose determines how we
          navigate this terrain.
        </p>
      </ExplorableSection>

      <ExplorableSection id="landscape">
        <h2>Vanilla Gradient Descent</h2>
        <p>
          The simplest approach: move opposite to the gradient. The update rule is
          almost trivially simple:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">SGD Update</div>
          <p>
            θ<sub>t+1</sub> = θ<sub>t</sub> - η∇L(θ<sub>t</sub>)
          </p>
        </div>
        <p>
          Watch how vanilla SGD struggles with the narrow ravine of the Rosenbrock function.
          It oscillates perpendicular to the valley while making slow progress along it.
        </p>
        <OptimizerSelector />
        <LearningRateControl />
      </ExplorableSection>

      <ExplorableSection id="momentum">
        <h2>Momentum</h2>
        <p>
          The physics analogy: a ball rolling downhill accumulates velocity. Momentum
          smooths out oscillations and accelerates through flat regions:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Momentum Update</div>
          <p>
            v<sub>t</sub> = βv<sub>t-1</sub> + η∇L(θ<sub>t</sub>)
            <br />
            θ<sub>t+1</sub> = θ<sub>t</sub> - v<sub>t</sub>
          </p>
        </div>
        <p>
          Select "Momentum" above and observe how the trajectory becomes smoother,
          cutting through the ravine instead of bouncing between walls.
        </p>
        <MomentumControl />
      </ExplorableSection>

      <ExplorableSection id="adaptive">
        <h2>Adam: Adaptive Moments</h2>
        <p>
          Adam combines momentum with adaptive per-parameter learning rates. It maintains
          both first and second moment estimates of the gradient:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Adam Update</div>
          <p>
            m<sub>t</sub> = β₁m<sub>t-1</sub> + (1-β₁)g<sub>t</sub>
            <br />
            v<sub>t</sub> = β₂v<sub>t-1</sub> + (1-β₂)g<sub>t</sub>²
            <br />
            θ<sub>t+1</sub> = θ<sub>t</sub> - η·m̂<sub>t</sub>/√(v̂<sub>t</sub> + ε)
          </p>
        </div>
        <p>
          The second moment acts as a per-parameter learning rate: dimensions with
          large gradients get smaller steps, preventing overshooting.
        </p>
      </ExplorableSection>

      <ExplorableSection id="muon">
        <h2>Muon: Orthogonal Updates</h2>
        <p>
          Muon takes a different approach: orthogonalize the update matrix. This prevents
          features from collapsing and maintains diversity in what neurons learn.
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Muon Philosophy</div>
          <p>
            Instead of scaling gradients, Muon projects updates onto the Stiefel manifold
            of orthogonal matrices, ensuring weight matrices maintain orthogonality.
          </p>
        </div>
        <p>
          This is particularly powerful for large language models, where maintaining
          diverse feature representations is crucial.
        </p>
      </ExplorableSection>
    </ExplorableLayout>
  )
}

function OptimizerSelector() {
  const { params, setParam } = useExplorable()
  const optimizer = (params.optimizer as string) || 'sgd'

  return (
    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
      {['sgd', 'momentum', 'adam'].map((opt) => (
        <button
          key={opt}
          onClick={() => setParam('optimizer', opt)}
          style={{
            padding: '0.4rem 0.8rem',
            background: optimizer === opt ? '#f59e0b' : 'transparent',
            border: `1px solid ${optimizer === opt ? '#f59e0b' : '#4a4540'}`,
            borderRadius: '4px',
            color: optimizer === opt ? '#080c14' : '#b8b0a0',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8rem',
          }}
        >
          {opt.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

function LearningRateControl() {
  const { params, setParam } = useExplorable()
  const lr = (params.learningRate as number) || 0.001

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Learning Rate:</span>
      <input
        type="range"
        min="0.0001"
        max="0.01"
        step="0.0001"
        value={lr}
        onChange={(e) => setParam('learningRate', parseFloat(e.target.value))}
      />
      <span className="value">{lr.toFixed(4)}</span>
    </div>
  )
}

function MomentumControl() {
  const { params, setParam } = useExplorable()
  const momentum = (params.momentum as number) || 0.9

  return (
    <div className="param-control" style={{ display: 'flex', marginTop: '1rem' }}>
      <span>Momentum β:</span>
      <input
        type="range"
        min="0"
        max="0.99"
        step="0.01"
        value={momentum}
        onChange={(e) => setParam('momentum', parseFloat(e.target.value))}
      />
      <span className="value">{momentum.toFixed(2)}</span>
    </div>
  )
}
