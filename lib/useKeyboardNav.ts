import { useState, useCallback, useEffect, useRef } from 'react'

/**
 * Configuration for keyboard navigation in game modes.
 */
export interface KeyboardNavOptions<T> {
  /** Array of options to navigate through */
  options: T[]
  /** Callback when an option is selected (Enter/Space) */
  onSelect: (option: T, index: number) => void
  /** Callback when escape is pressed */
  onEscape?: () => void
  /** Whether navigation is currently enabled */
  enabled?: boolean
  /** Start from a specific index */
  initialIndex?: number
  /** Whether to wrap around when reaching ends */
  wrap?: boolean
}

/**
 * Return type for keyboard navigation hook.
 */
export interface KeyboardNavReturn<T> {
  /** Currently focused index (-1 if none) */
  focusedIndex: number
  /** The currently focused option (null if none) */
  focusedOption: T | null
  /** Set the focused index programmatically */
  setFocusedIndex: (index: number) => void
  /** Props to spread on the container element */
  containerProps: {
    onKeyDown: (e: React.KeyboardEvent) => void
    tabIndex: number
    role: string
    'aria-activedescendant': string | undefined
  }
  /** Get props for an individual option element */
  getOptionProps: (option: T, index: number) => {
    id: string
    role: string
    'aria-selected': boolean
    tabIndex: number
    onClick: () => void
    onMouseEnter: () => void
    className: string
  }
  /** Reset focus to initial state */
  resetFocus: () => void
}

/**
 * Hook for keyboard navigation in game modes.
 *
 * Provides arrow key navigation, Enter/Space selection, and Escape to cancel.
 * Follows WAI-ARIA patterns for accessible listbox navigation.
 *
 * @example
 * ```tsx
 * const BEHAVIORS = ['option1', 'option2', 'option3']
 *
 * function GameMode() {
 *   const nav = useKeyboardNav({
 *     options: BEHAVIORS,
 *     onSelect: (behavior) => setPrediction(behavior),
 *     onEscape: () => setShowChallengeMode(false),
 *     enabled: gamePhase === 'setup',
 *   })
 *
 *   return (
 *     <div {...nav.containerProps}>
 *       {BEHAVIORS.map((b, i) => (
 *         <button key={b} {...nav.getOptionProps(b, i)}>
 *           {b}
 *         </button>
 *       ))}
 *     </div>
 *   )
 * }
 * ```
 */
export function useKeyboardNav<T>(
  options: KeyboardNavOptions<T>
): KeyboardNavReturn<T> {
  const {
    options: items,
    onSelect,
    onEscape,
    enabled = true,
    initialIndex = -1,
    wrap = true,
  } = options

  const [focusedIndex, setFocusedIndex] = useState(initialIndex)
  const idPrefix = useRef(`kb-nav-${Math.random().toString(36).slice(2, 8)}`)

  // Reset focus when options change
  useEffect(() => {
    if (initialIndex >= 0 && initialIndex < items.length) {
      setFocusedIndex(initialIndex)
    }
  }, [items.length, initialIndex])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled || items.length === 0) return

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight': {
          e.preventDefault()
          setFocusedIndex((prev) => {
            if (prev < 0) return 0
            const next = prev + 1
            if (next >= items.length) {
              return wrap ? 0 : prev
            }
            return next
          })
          break
        }
        case 'ArrowUp':
        case 'ArrowLeft': {
          e.preventDefault()
          setFocusedIndex((prev) => {
            if (prev < 0) return items.length - 1
            const next = prev - 1
            if (next < 0) {
              return wrap ? items.length - 1 : 0
            }
            return next
          })
          break
        }
        case 'Enter':
        case ' ': {
          e.preventDefault()
          if (focusedIndex >= 0 && focusedIndex < items.length) {
            onSelect(items[focusedIndex], focusedIndex)
          }
          break
        }
        case 'Escape': {
          e.preventDefault()
          if (onEscape) {
            onEscape()
          }
          break
        }
        case 'Home': {
          e.preventDefault()
          setFocusedIndex(0)
          break
        }
        case 'End': {
          e.preventDefault()
          setFocusedIndex(items.length - 1)
          break
        }
      }
    },
    [enabled, items, focusedIndex, onSelect, onEscape, wrap]
  )

  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex)
  }, [initialIndex])

  const getOptionProps = useCallback(
    (option: T, index: number) => ({
      id: `${idPrefix.current}-option-${index}`,
      role: 'option' as const,
      'aria-selected': focusedIndex === index,
      tabIndex: -1, // Container handles focus
      onClick: () => {
        setFocusedIndex(index)
        onSelect(option, index)
      },
      onMouseEnter: () => setFocusedIndex(index),
      className: focusedIndex === index ? 'kb-focused' : '',
    }),
    [focusedIndex, onSelect]
  )

  const containerProps = {
    onKeyDown: handleKeyDown,
    tabIndex: enabled ? 0 : -1,
    role: 'listbox' as const,
    'aria-activedescendant':
      focusedIndex >= 0 ? `${idPrefix.current}-option-${focusedIndex}` : undefined,
  }

  return {
    focusedIndex,
    focusedOption: focusedIndex >= 0 ? items[focusedIndex] : null,
    setFocusedIndex,
    containerProps,
    getOptionProps,
    resetFocus,
  }
}

/**
 * CSS styles for keyboard navigation focus indicator.
 * Add this to your global CSS or component styles.
 */
export const keyboardNavStyles = `
.kb-focused {
  outline: 2px solid var(--accent, #f59e0b);
  outline-offset: 2px;
}

/* High contrast mode support */
@media (prefers-contrast: more) {
  .kb-focused {
    outline-width: 3px;
    outline-color: currentColor;
  }
}

/* Reduced motion - no animations */
@media (prefers-reduced-motion: reduce) {
  .kb-focused {
    transition: none;
  }
}
`
