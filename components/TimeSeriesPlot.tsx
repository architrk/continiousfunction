import { useRef, useEffect, useMemo } from 'react'
import { TimeSeries, MATH_COLORS, mapRange } from '../lib/mathObjects'

interface TimeSeriesPlotProps {
  series: TimeSeries[]
  width?: number
  height?: number
  xLabel?: string
  yLabel?: string
  showLegend?: boolean
  currentTime?: number
  animate?: boolean
}

export default function TimeSeriesPlot({
  series,
  width = 400,
  height = 250,
  xLabel = 't',
  yLabel = 'value',
  showLegend = true,
  currentTime,
  animate = false,
}: TimeSeriesPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Compute bounds across all series
  const bounds = useMemo(() => {
    let tMin = Infinity, tMax = -Infinity
    let vMin = Infinity, vMax = -Infinity

    series.forEach(s => {
      s.data.forEach(d => {
        tMin = Math.min(tMin, d.t)
        tMax = Math.max(tMax, d.t)
        vMin = Math.min(vMin, d.value)
        vMax = Math.max(vMax, d.value)
      })
    })

    // Add some padding
    const vPad = (vMax - vMin) * 0.1 || 1
    return { tMin, tMax, vMin: vMin - vPad, vMax: vMax + vPad }
  }, [series])

  const toCanvas = useMemo(() => {
    return (t: number, v: number): [number, number] => [
      mapRange(t, bounds.tMin, bounds.tMax, 50, width - 20),
      mapRange(v, bounds.vMax, bounds.vMin, 20, height - 40),
    ]
  }, [bounds, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    // Grid lines
    ctx.strokeStyle = MATH_COLORS.grid
    ctx.lineWidth = 1

    const numGridLines = 5
    for (let i = 0; i <= numGridLines; i++) {
      const y = mapRange(i, 0, numGridLines, 20, height - 40)
      ctx.beginPath()
      ctx.moveTo(50, y)
      ctx.lineTo(width - 20, y)
      ctx.stroke()
    }

    for (let i = 0; i <= numGridLines; i++) {
      const x = mapRange(i, 0, numGridLines, 50, width - 20)
      ctx.beginPath()
      ctx.moveTo(x, 20)
      ctx.lineTo(x, height - 40)
      ctx.stroke()
    }

    // Axes
    ctx.strokeStyle = MATH_COLORS.neutral
    ctx.lineWidth = 1.5

    ctx.beginPath()
    ctx.moveTo(50, height - 40)
    ctx.lineTo(width - 20, height - 40)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(50, 20)
    ctx.lineTo(50, height - 40)
    ctx.stroke()

    // Draw each series
    const defaultColors = [MATH_COLORS.primary, MATH_COLORS.secondary, MATH_COLORS.accent]

    series.forEach((s, idx) => {
      if (s.data.length < 1) return

      const color = s.color || defaultColors[idx % defaultColors.length]
      ctx.strokeStyle = color
      ctx.lineWidth = 2

      ctx.beginPath()
      const [x0, y0] = toCanvas(s.data[0].t, s.data[0].value)
      ctx.moveTo(x0, y0)

      for (let i = 1; i < s.data.length; i++) {
        // If animating, only draw up to currentTime
        if (animate && currentTime !== undefined && s.data[i].t > currentTime) break
        const [x, y] = toCanvas(s.data[i].t, s.data[i].value)
        ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Draw point at current time
      if (currentTime !== undefined) {
        const closest = s.data.reduce((prev, curr) =>
          Math.abs(curr.t - currentTime) < Math.abs(prev.t - currentTime) ? curr : prev
        )
        const [cx, cy] = toCanvas(closest.t, closest.value)
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(cx, cy, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    })

    // Current time line
    if (currentTime !== undefined) {
      const [tx] = toCanvas(currentTime, 0)
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(tx, 20)
      ctx.lineTo(tx, height - 40)
      ctx.stroke()
      ctx.setLineDash([])
    }

    // Labels
    ctx.fillStyle = MATH_COLORS.neutral
    ctx.font = '12px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(xLabel, width / 2, height - 10)
    ctx.save()
    ctx.translate(15, height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yLabel, 0, 0)
    ctx.restore()

    // Legend
    if (showLegend && series.some(s => s.label)) {
      ctx.font = '11px "IBM Plex Sans", sans-serif'
      series.forEach((s, idx) => {
        if (!s.label) return
        const color = s.color || defaultColors[idx % defaultColors.length]
        const legendY = 35 + idx * 18
        ctx.fillStyle = color
        ctx.fillRect(width - 100, legendY - 8, 12, 12)
        ctx.fillStyle = MATH_COLORS.neutral
        ctx.textAlign = 'left'
        ctx.fillText(s.label, width - 84, legendY + 2)
      })
    }

  }, [series, bounds, width, height, xLabel, yLabel, showLegend, currentTime, animate, toCanvas])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="time-series-plot"
      style={{ borderRadius: '8px' }}
    />
  )
}
