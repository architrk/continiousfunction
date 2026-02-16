import { useRef, useEffect, useCallback } from 'react'

/**
 * Options for the animation frame hook.
 */
export interface AnimationFrameOptions {
  /** Whether the animation is currently running */
  isRunning: boolean
  /** Target frames per second (default: 60, capped at display refresh rate) */
  targetFps?: number
  /** Called on each animation frame with delta time in seconds */
  onFrame: (deltaTime: number, elapsedTime: number) => void
  /** Called when animation starts */
  onStart?: () => void
  /** Called when animation stops */
  onStop?: () => void
}

/**
 * Return type for animation frame hook.
 */
export interface AnimationFrameReturn {
  /** Start the animation */
  start: () => void
  /** Stop the animation */
  stop: () => void
  /** Reset elapsed time to zero */
  reset: () => void
  /** Current elapsed time in seconds */
  elapsedTime: number
}

/**
 * A hook for smooth 60fps animations using requestAnimationFrame.
 *
 * Unlike setTimeout/setInterval, requestAnimationFrame:
 * - Syncs with the display refresh rate for smooth visuals
 * - Automatically pauses when tab is hidden (saves CPU/battery)
 * - Provides accurate delta timing for physics simulations
 *
 * @example
 * ```tsx
 * function PhysicsSimulation() {
 *   const [position, setPosition] = useState(0)
 *   const [isRunning, setIsRunning] = useState(false)
 *
 *   useAnimationFrame({
 *     isRunning,
 *     onFrame: (dt) => {
 *       // Update physics with delta time
 *       setPosition(p => p + velocity * dt)
 *     }
 *   })
 *
 *   return <div style={{ left: position }}>Moving</div>
 * }
 * ```
 *
 * @example
 * ```tsx
 * // With FPS limiting for CPU-intensive updates
 * useAnimationFrame({
 *   isRunning: true,
 *   targetFps: 30, // Limit to 30fps
 *   onFrame: (dt, elapsed) => {
 *     // Heavy computation runs at 30fps instead of 60
 *     updateExpensiveSimulation(dt)
 *   }
 * })
 * ```
 */
export function useAnimationFrame(options: AnimationFrameOptions): AnimationFrameReturn {
  const { isRunning, targetFps = 60, onFrame, onStart, onStop } = options

  const frameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const elapsedTimeRef = useRef<number>(0)
  const isRunningRef = useRef<boolean>(false)
  const frameIntervalRef = useRef<number>(1000 / targetFps)

  // Update frame interval when targetFps changes
  useEffect(() => {
    frameIntervalRef.current = 1000 / Math.max(1, Math.min(targetFps, 120))
  }, [targetFps])

  const animate = useCallback((currentTime: number) => {
    if (!isRunningRef.current) return

    // Initialize on first frame
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = currentTime
    }

    const deltaMs = currentTime - lastTimeRef.current

    // FPS limiting: only call onFrame if enough time has passed
    if (deltaMs >= frameIntervalRef.current) {
      const deltaSeconds = deltaMs / 1000
      elapsedTimeRef.current += deltaSeconds
      lastTimeRef.current = currentTime

      // Call the frame callback
      onFrame(deltaSeconds, elapsedTimeRef.current)
    }

    // Schedule next frame
    frameRef.current = requestAnimationFrame(animate)
  }, [onFrame])

  const start = useCallback(() => {
    if (isRunningRef.current) return

    isRunningRef.current = true
    lastTimeRef.current = 0

    if (onStart) {
      onStart()
    }

    frameRef.current = requestAnimationFrame(animate)
  }, [animate, onStart])

  const stop = useCallback(() => {
    if (!isRunningRef.current) return

    isRunningRef.current = false

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }

    if (onStop) {
      onStop()
    }
  }, [onStop])

  const reset = useCallback(() => {
    elapsedTimeRef.current = 0
    lastTimeRef.current = 0
  }, [])

  // Start/stop based on isRunning prop
  useEffect(() => {
    if (isRunning) {
      start()
    } else {
      stop()
    }
  }, [isRunning, start, stop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [])

  return {
    start,
    stop,
    reset,
    elapsedTime: elapsedTimeRef.current,
  }
}

/**
 * Simplified hook for running a callback at a target FPS.
 * Automatically starts and handles cleanup.
 *
 * @example
 * ```tsx
 * function Counter() {
 *   const [count, setCount] = useState(0)
 *
 *   useAnimationLoop((dt) => {
 *     setCount(c => c + 1)
 *   }, { fps: 10 }) // Update 10 times per second
 *
 *   return <div>Count: {count}</div>
 * }
 * ```
 */
export function useAnimationLoop(
  callback: (deltaTime: number, elapsedTime: number) => void,
  options: { fps?: number; enabled?: boolean } = {}
): void {
  const { fps = 60, enabled = true } = options

  useAnimationFrame({
    isRunning: enabled,
    targetFps: fps,
    onFrame: callback,
  })
}

/**
 * Hook for smooth interpolation animations.
 * Useful for animating between values over a duration.
 *
 * @example
 * ```tsx
 * function SmoothMove() {
 *   const { value, animate } = useInterpolation(0)
 *
 *   return (
 *     <div style={{ left: value }}>
 *       <button onClick={() => animate(100, 500)}>
 *         Move to 100 over 500ms
 *       </button>
 *     </div>
 *   )
 * }
 * ```
 */
export function useInterpolation(initialValue: number): {
  value: number
  animate: (target: number, duration: number, easing?: (t: number) => number) => void
  cancel: () => void
} {
  const valueRef = useRef(initialValue)
  const animationRef = useRef<{
    startValue: number
    targetValue: number
    duration: number
    elapsed: number
    easing: (t: number) => number
  } | null>(null)

  const { start, stop } = useAnimationFrame({
    isRunning: animationRef.current !== null,
    onFrame: (dt) => {
      const anim = animationRef.current
      if (!anim) return

      anim.elapsed += dt * 1000

      if (anim.elapsed >= anim.duration) {
        valueRef.current = anim.targetValue
        animationRef.current = null
        stop()
      } else {
        const t = anim.easing(anim.elapsed / anim.duration)
        valueRef.current = anim.startValue + (anim.targetValue - anim.startValue) * t
      }
    },
  })

  const animate = useCallback(
    (target: number, duration: number, easing: (t: number) => number = easeOutCubic) => {
      animationRef.current = {
        startValue: valueRef.current,
        targetValue: target,
        duration,
        elapsed: 0,
        easing,
      }
      start()
    },
    [start]
  )

  const cancel = useCallback(() => {
    animationRef.current = null
    stop()
  }, [stop])

  return {
    value: valueRef.current,
    animate,
    cancel,
  }
}

// Common easing functions
export const easeLinear = (t: number): number => t
export const easeInQuad = (t: number): number => t * t
export const easeOutQuad = (t: number): number => t * (2 - t)
export const easeInOutQuad = (t: number): number =>
  t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
export const easeInCubic = (t: number): number => t * t * t
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
export const easeInExpo = (t: number): number =>
  t === 0 ? 0 : Math.pow(2, 10 * t - 10)
export const easeOutExpo = (t: number): number =>
  t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
