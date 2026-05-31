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

  // Use ref to access current activeSection without adding to deps
  // This prevents observer churn when activeSection changes on scroll
  const activeSectionRef = useRef(activeSection)
  activeSectionRef.current = activeSection

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Use a more responsive intersection observer
    // Lower threshold (0.2) and smaller rootMargin for faster activation
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setActiveSection(id)
          onEnter?.()
        } else if (activeSectionRef.current === id) {
          // Use ref to avoid stale closure while preventing effect re-runs
          setActiveSection(null)
          onExit?.()
        }
      },
      {
        threshold: Math.min(threshold, 0.2), // Lower threshold for faster response
        rootMargin: '-10% 0px -40% 0px', // Trigger sooner as section enters top of viewport
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [id, setActiveSection, onEnter, onExit, threshold]) // activeSection removed - accessed via ref

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
