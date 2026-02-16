'use client'

import { useState, useMemo, useEffect, useRef, Suspense, lazy } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import ExplorableLayout, { useExplorable } from '../../components/ExplorableLayout'
import ExplorableSection from '../../components/ExplorableSection'
import PhasePortrait2D from '../../components/PhasePortrait2D'
import TimeSeriesPlot from '../../components/TimeSeriesPlot'
import { VectorField2D, Point2D, TimeSeries, numericalGradient } from '../../lib/mathObjects'

// Explore in depth link component
function ExploreLink({ href, label = 'Explore in depth' }: { href: string; label?: string }) {
  return (
    <Link href={href} className="explore-link">
      {label} →
      <style jsx>{`
        .explore-link {
          display: inline-block;
          margin-top: 1rem;
          font-size: 0.85rem;
          color: var(--converge-teal);
          text-decoration: none;
          transition: color 0.2s;
        }
        .explore-link:hover {
          color: var(--accent);
        }
      `}</style>
    </Link>
  )
}

// Import visualization components from foundations (canonical source with gamification)
import dynamic from 'next/dynamic'
const EdgeOfStability = lazy(() => import('../../components/foundations/EdgeOfStabilityViz'))
const NewtonSchulz = lazy(() => import('../../components/foundations/NewtonSchulzViz'))
const GrokkingPhase = lazy(() => import('../../components/foundations/GrokkingViz'))
const DPOvsRLHF = lazy(() => import('../../components/foundations/DPOViz'))
// LossLandscape3D requires React Three Fiber which needs React 19 - use dynamic import with SSR disabled
const LossLandscape3D = dynamic(() => import('../../components/foundations/LossLandscape3DViz'), { ssr: false })
const BackpropAttention = lazy(() => import('../../components/foundations/AttentionBackpropViz'))
const TaskVectors = lazy(() => import('../../components/foundations/TaskVectorViz'))
const NeuralScalingLaws = lazy(() => import('../../components/foundations/NeuralScalingViz'))

function LoadingFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 360, color: '#b8b0a0' }}>
      Loading visualization...
    </div>
  )
}

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
        // Use t = step + 1 for 1-indexed bias correction (Adam paper convention)
        const t = step + 1
        m = [beta1 * m[0] + (1 - beta1) * gx, beta1 * m[1] + (1 - beta1) * gy]
        v = [beta2 * v[0] + (1 - beta2) * gx * gx, beta2 * v[1] + (1 - beta2) * gy * gy]
        const mHat = [m[0] / (1 - beta1 ** t), m[1] / (1 - beta1 ** t)]
        const vHat = [v[0] / (1 - beta2 ** t), v[1] / (1 - beta2 ** t)]
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

  // Use new advanced visualization components based on section
  if (activeSection === 'edge' || activeSection === 'stability') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <EdgeOfStability />
      </Suspense>
    )
  }

  if (activeSection === 'muon' || activeSection === 'orthogonalization') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <NewtonSchulz />
      </Suspense>
    )
  }

  if (activeSection === 'grokking') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <GrokkingPhase />
      </Suspense>
    )
  }

  if (activeSection === 'dpo' || activeSection === 'rlhf' || activeSection === 'alignment') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <DPOvsRLHF />
      </Suspense>
    )
  }

  if (activeSection === 'landscape3d' || activeSection === 'loss3d') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <LossLandscape3D />
      </Suspense>
    )
  }

  if (activeSection === 'backprop' || activeSection === 'gradients') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <BackpropAttention />
      </Suspense>
    )
  }

  if (activeSection === 'task-vectors' || activeSection === 'model-editing') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <TaskVectors />
      </Suspense>
    )
  }

  if (activeSection === 'scaling' || activeSection === 'scaling-laws') {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <NeuralScalingLaws />
      </Suspense>
    )
  }

  // Legacy visualization fallback
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
    <>
      <Head>
        <title>Optimization — Continuous Function</title>
      </Head>
      <ExplorableLayout
        title="Optimization"
        subtitle="Gradient descent as physics in the loss landscape"
        visualPanel={<OptimizationVisualPanel />}
        initialParams={{ learningRate: 0.001, momentum: 0.9, optimizer: 'sgd' }}
        breadcrumb={[
          { label: 'Home', href: '/' },
          { label: 'Pillars', href: '/pillars' },
          { label: 'Optimization' }
        ]}
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
        <ExploreLink href="/foundations/adam/" />
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

      <ExplorableSection id="edge">
        <h2>Edge of Stability</h2>
        <p>
          A surprising phenomenon: neural networks train at the "edge of stability" where
          the loss Hessian's largest eigenvalue hovers at 2/η (learning rate):
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Sharpness Dynamics</div>
          <p>
            λ<sub>max</sub>(∇²L) ≈ 2/η during training
            <br />
            Loss decreases non-monotonically
          </p>
        </div>
        <p>
          The optimizer self-organizes to this critical point, where conventional stability
          analysis predicts divergence but training succeeds anyway.
        </p>
        <ExploreLink href="/foundations/loss-landscapes/" />
      </ExplorableSection>

      <ExplorableSection id="grokking">
        <h2>Grokking</h2>
        <p>
          Sometimes models suddenly generalize long after perfectly fitting training data.
          This "grokking" reveals a phase transition in learning:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Phase Transition</div>
          <p>
            Phase 1: Memorization (training loss → 0, test loss high)
            <br />
            Phase 2: Comprehension (test loss suddenly drops)
          </p>
        </div>
        <p>
          The model first memorizes, then discovers the underlying pattern. Weight decay
          and longer training push models toward generalizing solutions.
        </p>
        <ExploreLink href="/foundations/grokking/" />
      </ExplorableSection>

      <ExplorableSection id="dpo">
        <h2>DPO vs RLHF</h2>
        <p>
          Aligning language models to human preferences. RLHF trains a reward model then
          optimizes against it. DPO directly optimizes from preference pairs:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">DPO Loss</div>
          <p>
            L = -log σ(β log(π(y<sub>w</sub>)/π<sub>ref</sub>(y<sub>w</sub>)) - β log(π(y<sub>l</sub>)/π<sub>ref</sub>(y<sub>l</sub>)))
          </p>
        </div>
        <p>
          DPO is simpler: no reward model, no RL. It implicitly defines a reward through
          the optimal policy, making alignment more stable and efficient.
        </p>
        <ExploreLink href="/foundations/dpo/" />
      </ExplorableSection>

      <ExplorableSection id="landscape3d">
        <h2>3D Loss Landscape</h2>
        <p>
          Visualizing the high-dimensional loss surface by projecting onto random directions.
          Sharp minima may generalize poorly; flat minima are more robust:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Sharpness & Generalization</div>
          <p>
            L(θ + δ) ≈ L(θ) + ½δ<sup>T</sup>Hδ
            <br />
            Large eigenvalues of H → sharp minimum
          </p>
        </div>
        <p>
          The landscape visualization helps understand why certain optimizers find better
          solutions and how regularization affects the geometry of minima.
        </p>
      </ExplorableSection>

      <ExplorableSection id="backprop">
        <h2>Backprop Through Attention</h2>
        <p>
          Gradients flow through the attention mechanism in complex patterns. Understanding
          this flow reveals why certain architectures train better:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Gradient Flow</div>
          <p>
            ∂L/∂Q = ∂L/∂A · ∂A/∂Q where A = softmax(QK<sup>T</sup>/√d)
            <br />
            Gradients must flow through softmax Jacobian
          </p>
        </div>
        <p>
          Skip connections provide direct gradient highways, explaining why residual
          architectures are essential for deep transformers.
        </p>
      </ExplorableSection>

      <ExplorableSection id="task-vectors">
        <h2>Task Vectors</h2>
        <p>
          Fine-tuned models differ from base models by a "task vector" in weight space.
          These vectors support arithmetic operations:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Model Arithmetic</div>
          <p>
            τ = θ<sub>fine</sub> - θ<sub>base</sub>
            <br />
            θ<sub>new</sub> = θ<sub>base</sub> + α·τ<sub>1</sub> + β·τ<sub>2</sub>
          </p>
        </div>
        <p>
          Add task vectors to combine capabilities. Negate to remove behaviors. This
          enables editing model knowledge without retraining.
        </p>
      </ExplorableSection>

      <ExplorableSection id="scaling">
        <h2>Neural Scaling Laws</h2>
        <p>
          Model performance follows predictable power laws with compute, data, and parameters:
        </p>
        <div className="math-insight">
          <div className="math-insight-title">Chinchilla Scaling</div>
          <p>
            L ∝ N<sup>-α</sup> + D<sup>-β</sup> + L<sub>∞</sub>
            <br />
            Optimal: N ∝ C<sup>0.5</sup>, D ∝ C<sup>0.5</sup>
          </p>
        </div>
        <p>
          These laws enable predicting performance of larger models and optimal allocation
          of compute budget between model size and training data.
        </p>
        <ExploreLink href="/foundations/scaling-laws/" />
      </ExplorableSection>
    </ExplorableLayout>
    </>
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
        aria-label="Learning rate"
        aria-valuetext={lr.toFixed(4)}
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
        aria-label="Momentum beta"
        aria-valuetext={momentum.toFixed(2)}
      />
      <span className="value">{momentum.toFixed(2)}</span>
    </div>
  )
}
