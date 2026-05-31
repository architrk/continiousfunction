import { useRef, useEffect, useMemo } from 'react'
import { VectorField2D, Point2D, MATH_COLORS, mapRange } from '@/lib/mathObjects'

interface PhasePortrait2DProps {
  field: VectorField2D
  trajectories?: Point2D[][]
  currentPoint?: Point2D
  width?: number
  height?: number
  showGrid?: boolean
  showVectors?: boolean
  arrowDensity?: number
}

export default function PhasePortrait2D({
  field,
  trajectories = [],
  currentPoint,
  width = 400,
  height = 400,
  showGrid = true,
  showVectors = true,
  arrowDensity = 12,
}: PhasePortrait2DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const { domain } = field

  const toCanvas = useMemo(() => {
    return (p: Point2D): [number, number] => [
      mapRange(p[0], domain.x[0], domain.x[1], 40, width - 20),
      mapRange(p[1], domain.y[1], domain.y[0], 20, height - 40),
    ]
  }, [domain, width, height])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear and set background
    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    if (showGrid) {
      ctx.strokeStyle = MATH_COLORS.grid
      ctx.lineWidth = 1

      // Vertical lines
      for (let x = domain.x[0]; x <= domain.x[1]; x += (domain.x[1] - domain.x[0]) / 10) {
        const [canvasX] = toCanvas([x, 0])
        ctx.beginPath()
        ctx.moveTo(canvasX, 20)
        ctx.lineTo(canvasX, height - 40)
        ctx.stroke()
      }

      // Horizontal lines
      for (let y = domain.y[0]; y <= domain.y[1]; y += (domain.y[1] - domain.y[0]) / 10) {
        const [, canvasY] = toCanvas([0, y])
        ctx.beginPath()
        ctx.moveTo(40, canvasY)
        ctx.lineTo(width - 20, canvasY)
        ctx.stroke()
      }
    }

    // Draw axes
    ctx.strokeStyle = MATH_COLORS.neutral
    ctx.lineWidth = 1.5
    const [originX, originY] = toCanvas([0, 0])

    // X-axis
    ctx.beginPath()
    ctx.moveTo(40, originY)
    ctx.lineTo(width - 20, originY)
    ctx.stroke()

    // Y-axis
    ctx.beginPath()
    ctx.moveTo(originX, 20)
    ctx.lineTo(originX, height - 40)
    ctx.stroke()

    // Draw vector field
    if (showVectors) {
      const stepX = (domain.x[1] - domain.x[0]) / arrowDensity
      const stepY = (domain.y[1] - domain.y[0]) / arrowDensity
      const arrowScale = Math.min(stepX, stepY) * 0.6

      for (let x = domain.x[0] + stepX / 2; x < domain.x[1]; x += stepX) {
        for (let y = domain.y[0] + stepY / 2; y < domain.y[1]; y += stepY) {
          const [vx, vy] = field.fn(x, y)
          const mag = Math.sqrt(vx * vx + vy * vy)
          if (mag < 1e-6) continue

          const normVx = (vx / mag) * arrowScale
          const normVy = (vy / mag) * arrowScale

          const [startX, startY] = toCanvas([x, y])
          const [endX, endY] = toCanvas([x + normVx, y + normVy])

          // Color based on magnitude
          const intensity = Math.min(mag / 2, 1)
          ctx.strokeStyle = `rgba(245, 158, 11, ${0.3 + intensity * 0.5})`
          ctx.lineWidth = 1 + intensity

          ctx.beginPath()
          ctx.moveTo(startX, startY)
          ctx.lineTo(endX, endY)
          ctx.stroke()

          // Arrow head
          const angle = Math.atan2(startY - endY, startX - endX)
          const headLen = 4
          ctx.beginPath()
          ctx.moveTo(endX, endY)
          ctx.lineTo(
            endX + headLen * Math.cos(angle - Math.PI / 6),
            endY + headLen * Math.sin(angle - Math.PI / 6)
          )
          ctx.moveTo(endX, endY)
          ctx.lineTo(
            endX + headLen * Math.cos(angle + Math.PI / 6),
            endY + headLen * Math.sin(angle + Math.PI / 6)
          )
          ctx.stroke()
        }
      }
    }

    // Draw trajectories
    trajectories.forEach((traj, i) => {
      if (traj.length < 2) return
      const hue = i * 137.5 % 360
      ctx.strokeStyle = `hsla(${hue}, 70%, 60%, 0.8)`
      ctx.lineWidth = 2

      ctx.beginPath()
      const [x0, y0] = toCanvas(traj[0])
      ctx.moveTo(x0, y0)
      for (let j = 1; j < traj.length; j++) {
        const [x, y] = toCanvas(traj[j])
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    })

    // Draw current point
    if (currentPoint) {
      const [cx, cy] = toCanvas(currentPoint)
      ctx.fillStyle = MATH_COLORS.secondary
      ctx.beginPath()
      ctx.arc(cx, cy, 8, 0, Math.PI * 2)
      ctx.fill()

      // Glow effect
      ctx.shadowColor = MATH_COLORS.secondary
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.arc(cx, cy, 6, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0
    }

    // Axis labels
    ctx.fillStyle = MATH_COLORS.neutral
    ctx.font = '12px "IBM Plex Sans", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('x', width - 10, originY + 4)
    ctx.fillText('y', originX, 12)

  }, [field, trajectories, currentPoint, width, height, showGrid, showVectors, arrowDensity, domain, toCanvas])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className="phase-portrait"
      style={{ borderRadius: '8px' }}
      role="img"
      aria-label={`Phase portrait visualization: ${field.label || 'vector field'} showing trajectories and flow direction`}
    />
  )
}
