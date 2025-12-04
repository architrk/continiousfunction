import { ReactNode, createContext, useContext, useState, useCallback } from 'react'

// Context for sharing state between sections and visualization
interface ExplorableState {
  activeSection: string | null
  setActiveSection: (id: string | null) => void
  params: Record<string, number | string | boolean>
  setParam: (key: string, value: number | string | boolean) => void
  resetParams: () => void
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

  return (
    <ExplorableContext.Provider value={{ activeSection, setActiveSection, params, setParam, resetParams }}>
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
            <div className="explorable-visual-sticky">
              {visualPanel}
            </div>
          </aside>
        </div>
      </div>
    </ExplorableContext.Provider>
  )
}
