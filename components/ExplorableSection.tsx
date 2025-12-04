import { ReactNode, useEffect, useRef } from 'react'
import { useExplorable } from './ExplorableLayout'

interface ExplorableSectionProps {
  id: string
  children: ReactNode
  onEnter?: () => void
  onExit?: () => void
  threshold?: number
  className?: string
}

export default function ExplorableSection({
  id,
  children,
  onEnter,
  onExit,
  threshold = 0.5,
  className = '',
}: ExplorableSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { setActiveSection, activeSection } = useExplorable()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(id)
          onEnter?.()
        } else if (activeSection === id) {
          setActiveSection(null)
          onExit?.()
        }
      },
      {
        threshold,
        rootMargin: '-20% 0px -20% 0px',
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [id, setActiveSection, activeSection, onEnter, onExit, threshold])

  return (
    <section
      ref={ref}
      id={id}
      className={`explorable-section ${className} ${activeSection === id ? 'active' : ''}`}
      data-section={id}
    >
      {children}
    </section>
  )
}
