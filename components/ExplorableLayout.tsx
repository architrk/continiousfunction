import { ReactNode, createContext, useContext, useState, useCallback, useMemo } from 'react'

// Section title mapping for display
const SECTION_TITLES: Record<string, string> = {
  // Sequence Modeling
  intro: 'Introduction',
  attention: 'Self-Attention',
  rope: 'RoPE Embeddings',
  kvcache: 'KV Cache',
  gqa: 'Grouped Query Attention',
  swiglu: 'SwiGLU Activation',
  moe: 'Mixture of Experts',
  ssm: 'State Space Models',
  mamba: 'Mamba',
  // Optimization
  landscape: 'Loss Landscape',
  momentum: 'Momentum',
  adaptive: 'Adam Optimizer',
  muon: 'Muon Optimizer',
  orthogonalization: 'Newton-Schulz',
  edge: 'Edge of Stability',
  stability: 'Edge of Stability',
  grokking: 'Grokking',
  dpo: 'DPO vs RLHF',
  rlhf: 'DPO vs RLHF',
  alignment: 'Alignment',
  landscape3d: '3D Loss Landscape',
  loss3d: '3D Loss Landscape',
  backprop: 'Backprop Gradients',
  gradients: 'Gradient Flow',
  'task-vectors': 'Task Vectors',
  'model-editing': 'Model Editing',
  scaling: 'Scaling Laws',
  'scaling-laws': 'Scaling Laws',
  // Generative Physics
  diffusion: 'Diffusion Process',
  forward: 'Forward Diffusion',
  reverse: 'Reverse Diffusion',
  score: 'Score Function',
  flow: 'Flow Matching',
  ode: 'ODE Trajectories',
  // Geometric DL
  symmetry: 'Symmetry',
  equivariance: 'Equivariance',
  groups: 'Group Theory',
  manifold: 'Manifolds',
  transport: 'Parallel Transport',
  // Mech Interp
  superposition: 'Superposition',
  polysemanticity: 'Polysemanticity',
  sae: 'Sparse Autoencoders',
  circuits: 'Circuits',
  induction: 'Induction Heads',
  features: 'Feature Analysis',
}

// Context for sharing state between sections and visualization
interface ExplorableState {
  activeSection: string | null
  setActiveSection: (id: string | null) => void
  params: Record<string, number | string | boolean>
  setParam: (key: string, value: number | string | boolean) => void
  resetParams: () => void
  getSectionTitle: (id: string | null) => string
}

const ExplorableContext = createContext<ExplorableState | null>(null)

export function useExplorable() {
  const context = useContext(ExplorableContext)
  if (!context) {
    throw new Error('useExplorable must be used within ExplorableLayout')
  }
  return context
}

interface ExplorableLayoutProps {
  children: ReactNode
  visualPanel: ReactNode
  title: string
  subtitle?: string
  initialParams?: Record<string, number | string | boolean>
}

export default function ExplorableLayout({
  children,
  visualPanel,
  title,
  subtitle,
  initialParams = {},
}: ExplorableLayoutProps) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, number | string | boolean>>(initialParams)

  const setParam = useCallback((key: string, value: number | string | boolean) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetParams = useCallback(() => {
    setParams(initialParams)
  }, [initialParams])

  const getSectionTitle = useCallback((id: string | null): string => {
    if (!id) return 'Scroll to begin'
    return SECTION_TITLES[id] || id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }, [])

  const currentTitle = useMemo(() => getSectionTitle(activeSection), [activeSection, getSectionTitle])

  return (
    <ExplorableContext.Provider value={{ activeSection, setActiveSection, params, setParam, resetParams, getSectionTitle }}>
      <div className="explorable-layout">
        <header className="explorable-header">
          <h1 className="explorable-title">{title}</h1>
          {subtitle && <p className="explorable-subtitle">{subtitle}</p>}
        </header>

        <div className="explorable-container">
          <div className="explorable-prose">
            {children}
          </div>
          <aside className="explorable-visual">
            <div className="explorable-visual-sticky" data-section={activeSection || 'none'}>
              <div className="explorable-section-indicator">
                <span className="indicator-dot" />
                <span className="indicator-label">{currentTitle}</span>
              </div>
              {visualPanel}
            </div>
          </aside>
        </div>
      </div>
    </ExplorableContext.Provider>
  )
}
