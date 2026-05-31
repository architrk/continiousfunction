import { useRef, useEffect, useMemo } from 'react'
import { Matrix2D, MATH_COLORS, mapRange } from '@/lib/mathObjects'

interface KernelHeatmapProps {
  matrix: Matrix2D
  width?: number
  height?: number
  colorScheme?: 'diverging' | 'sequential' | 'attention'
  showValues?: boolean
  highlightCell?: [number, number]
  title?: string
}

export default function KernelHeatmap({
  matrix,
  width = 300,
  height = 300,
  colorScheme = 'sequential',
  showValues = false,
  highlightCell,
  title,
}: KernelHeatmapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { data, rowLabels, colLabels } = matrix
  const rows = data.length
  const cols = data[0]?.length || 0

  // Compute value bounds
  const bounds = useMemo(() => {
    let min = Infinity, max = -Infinity
    data.forEach(row => {
      row.forEach(v => {
        min = Math.min(min, v)
        max = Math.max(max, v)
      })
    })
    return { min, max }
  }, [data])

  // Color mapping function
  const valueToColor = useMemo(() => {
    return (value: number): string => {
      const normalized = mapRange(value, bounds.min, bounds.max, 0, 1)

      if (colorScheme === 'diverging') {
        // Blue-white-orange for diverging data
        if (normalized < 0.5) {
          const t = normalized * 2
          return `rgb(${Math.round(59 + t * 196)}, ${Math.round(130 + t * 125)}, ${Math.round(246 - t * 101)})`
        } else {
          const t = (normalized - 0.5) * 2
          return `rgb(${Math.round(255)}, ${Math.round(255 - t * 96)}, ${Math.round(145 - t * 134)})`
        }
      } else if (colorScheme === 'attention') {
        // Purple gradient for attention weights
        return `rgba(139, 92, 246, ${0.1 + normalized * 0.9})`
      } else {
        // Sequential orange gradient
        return `rgba(245, 158, 11, ${0.1 + normalized * 0.9})`
      }
    }
  }, [bounds, colorScheme])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const padding = { top: title ? 40 : 20, right: 20, bottom: 40, left: 40 }
    const plotWidth = width - padding.left - padding.right
    const plotHeight = height - padding.top - padding.bottom

    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    if (rows === 0 || cols === 0) return

    const cellWidth = plotWidth / cols
    const cellHeight = plotHeight / rows

    // Draw cells
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const value = data[i][j]
        const x = padding.left + j * cellWidth
        const y = padding.top + i * cellHeight

        ctx.fillStyle = valueToColor(value)
        ctx.fillRect(x, y, cellWidth - 1, cellHeight - 1)

        // Highlight
        if (highlightCell && highlightCell[0] === i && highlightCell[1] === j) {
          ctx.strokeStyle = MATH_COLORS.secondary
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, cellWidth - 1, cellHeight - 1)
        }

        // Show values
        if (showValues && cellWidth > 25 && cellHeight > 20) {
          ctx.fillStyle = bounds.max - value < (bounds.max - bounds.min) / 2
            ? 'rgba(0,0,0,0.8)'
            : 'rgba(255,255,255,0.9)'
          ctx.font = '10px "JetBrains Mono", monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(value.toFixed(2), x + cellWidth / 2, y + cellHeight / 2)
        }
      }
    }

    // Row labels
    if (rowLabels) {
      ctx.fillStyle = MATH_COLORS.neutral
      ctx.font = '11px "IBM Plex Sans", sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      rowLabels.forEach((label, i) => {
        ctx.fillText(label, padding.left - 5, padding.top + i * cellHeight + cellHeight / 2)
      })
    }

    // Column labels
    if (colLabels) {
      ctx.fillStyle = MATH_COLORS.neutral
      ctx.font = '11px "IBM Plex Sans", sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      colLabels.forEach((label, j) => {
        ctx.save()
        ctx.translate(padding.left + j * cellWidth + cellWidth / 2, height - padding.bottom + 5)
        ctx.rotate(-Math.PI / 4)
        ctx.fillText(label, 0, 0)
        ctx.restore()
      })
    }

    // Title
    if (title) {
      ctx.fillStyle = '#fafaf9'
      ctx.font = '14px "Crimson Pro", serif'
      ctx.textAlign = 'center'
      ctx.fillText(title, width / 2, 20)
    }

  }, [matrix, width, height, colorScheme, showValues, highlightCell, title, data, rows, cols, rowLabels, colLabels, bounds, valueToColor])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="kernel-heatmap"
      style={{ borderRadius: '8px' }}
    />
  )
}
