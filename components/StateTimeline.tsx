import { useRef, useEffect, useMemo } from 'react'
import { NeuralState, MATH_COLORS, mapRange } from '../lib/mathObjects'

interface StateTimelineProps {
  states: NeuralState[]
  width?: number
  height?: number
  currentStep?: number
  showActivations?: boolean
  highlightNeurons?: number[]
}

export default function StateTimeline({
  states,
  width = 500,
  height = 200,
  currentStep,
  showActivations = true,
  highlightNeurons = [],
}: StateTimelineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const maxNeurons = useMemo(() => {
    return Math.max(...states.map(s => s.activations.length), 1)
  }, [states])

  const bounds = useMemo(() => {
    let min = Infinity, max = -Infinity
    states.forEach(s => {
      s.activations.forEach(a => {
        min = Math.min(min, a)
        max = Math.max(max, a)
      })
    })
    // Fall back to sensible defaults when there's no activation data
    if (!Number.isFinite(min) || !Number.isFinite(max)) {
      min = 0
      max = 1
    }
    return { min, max }
  }, [states])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const padding = { top: 30, right: 20, bottom: 40, left: 60 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    if (states.length === 0) return

    const stepWidth = plotWidth / states.length
    const neuronHeight = plotHeight / maxNeurons

    // Draw activation heatmap
    states.forEach((state, stepIdx) => {
      const x = padding.left + stepIdx * stepWidth

      state.activations.forEach((activation, neuronIdx) => {
        const y = padding.top + neuronIdx * neuronHeight
        const normalized = mapRange(activation, bounds.min, bounds.max, 0, 1)

        // Color gradient from dark to bright
        const _intensity = Math.round(normalized * 255)
        const isHighlighted = highlightNeurons.includes(neuronIdx)

        if (isHighlighted) {
          ctx.fillStyle = `rgba(20, 184, 166, ${0.3 + normalized * 0.7})`
        } else {
          ctx.fillStyle = `rgba(245, 158, 11, ${0.1 + normalized * 0.9})`
        }

        ctx.fillRect(x, y, stepWidth - 1, neuronHeight - 1)
      })

      // Current step highlight
      if (currentStep === stepIdx) {
        ctx.strokeStyle = MATH_COLORS.secondary
        ctx.lineWidth = 2
        ctx.strokeRect(x, padding.top, stepWidth - 1, plotHeight)
      }
    })

    // Axis labels
    ctx.fillStyle = MATH_COLORS.neutral
    ctx.font = '12px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Time Step', width / 2, height - 10)

    ctx.save()
    ctx.translate(15, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Neuron Index', 0, 0)
    ctx.restore()

    // Layer labels (at top)
    ctx.font = '11px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'center'
    states.forEach((state, idx) => {
      const x = padding.left + idx * stepWidth + stepWidth / 2
      ctx.fillText(state.layer, x, padding.top - 8)
    })

    // Tick marks for steps
    ctx.font = '10px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    const tickInterval = Math.max(1, Math.floor(states.length / 8))
    for (let i = 0; i < states.length; i += tickInterval) {
      const x = padding.left + i * stepWidth + stepWidth / 2
      ctx.fillText(i.toString(), x, height - padding.bottom + 15)
    }

    // Show activation values for current step
    if (showActivations && currentStep !== undefined && states[currentStep]) {
      const state = states[currentStep]
      const barWidth = 60
      const barX = width - barWidth - 10

      ctx.fillStyle = 'rgba(28, 25, 23, 0.9)'
      ctx.fillRect(barX - 5, padding.top, barWidth + 10, plotHeight)

      ctx.font = '10px "JetBrains Mono", monospace'
      ctx.textAlign = 'right'

      state.activations.slice(0, 10).forEach((a, i) => {
        const y = padding.top + i * neuronHeight + neuronHeight / 2
        const normalized = mapRange(a, bounds.min, bounds.max, 0, 1)

        ctx.fillStyle = highlightNeurons.includes(i) ? MATH_COLORS.secondary : MATH_COLORS.primary
        const barLen = normalized * (barWidth - 25)
        ctx.fillRect(barX, y - 4, barLen, 8)

        ctx.fillStyle = MATH_COLORS.neutral
        ctx.fillText(a.toFixed(2), barX + barWidth, y + 3)
      })
    }

  }, [states, width, height, currentStep, showActivations, highlightNeurons, maxNeurons, bounds])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="state-timeline"
      style={{ borderRadius: '8px' }}
    />
  )
}
