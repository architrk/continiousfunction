// Core mathematical object types for explorable explanations

export type Point2D = [number, number]
export type Point3D = [number, number, number]

// Scalar field: f(x, y) -> z
export interface ScalarField2D {
  fn: (x: number, y: number) => number
  domain: { x: [number, number]; y: [number, number] }
  label?: string
}

// Vector field: f(x, y) -> [vx, vy]
export interface VectorField2D {
  fn: (x: number, y: number) => Point2D
  domain: { x: [number, number]; y: [number, number] }
  label?: string
}

// Time series data
export interface TimeSeries {
  data: { t: number; value: number }[]
  label?: string
  color?: string
}

// Matrix for kernel/heatmap visualization
export interface Matrix2D {
  data: number[][]
  rowLabels?: string[]
  colLabels?: string[]
  label?: string
}

// State for mechanistic interpretability
export interface NeuralState {
  layer: string
  activations: number[]
  timestamp: number
}

// Trajectory through parameter space
export interface OptimizationTrajectory {
  points: Point2D[]
  losses: number[]
  optimizer: string
  hyperparams?: Record<string, number>
}

// Phase portrait state
export interface PhaseState {
  position: Point2D
  velocity: Point2D
  time: number
}

// Attention pattern for transformer visualization
export interface AttentionPattern {
  weights: number[][]
  tokens: string[]
  layer: number
  head: number
}

// Equivariance demonstration state
export interface EquivarianceDemo {
  inputTransform: 'rotate' | 'translate' | 'reflect'
  transformParam: number
  inputData: Point2D[]
  outputData: Point2D[]
}

// Selective state-space model state
export interface SSMState {
  hidden: number[]
  selectivity: number[]
  gating: number[]
  sequence: number[]
}

// Shared color palette for visualizations
export const MATH_COLORS = {
  primary: '#f59e0b',      // gradient-orange
  secondary: '#14b8a6',    // convergence-teal
  accent: '#8b5cf6',       // purple for tertiary
  positive: '#22c55e',     // green
  negative: '#ef4444',     // red
  neutral: '#6b7280',      // gray
  grid: 'rgba(245, 158, 11, 0.1)',
  surface: 'rgba(28, 25, 23, 0.95)',
} as const

// Guard helper: clamp to finite values, fallback to default if NaN/Infinity
export function safeNumber(value: number, fallback: number = 0): number {
  return Number.isFinite(value) ? value : fallback
}

// Interpolation utilities
export function lerp(a: number, b: number, t: number): number {
  const result = a + (b - a) * t
  return safeNumber(result, a)
}

export function lerpPoint2D(a: Point2D, b: Point2D, t: number): Point2D {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Map value from one range to another
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number
): number {
  const inRange = inMax - inMin
  if (inRange === 0) return outMin // Avoid division by zero
  const result = ((value - inMin) * (outMax - outMin)) / inRange + outMin
  return safeNumber(result, outMin)
}

// Generate grid points for field visualization
export function generateGrid2D(
  domain: { x: [number, number]; y: [number, number] },
  resolution: number
): Point2D[] {
  const points: Point2D[] = []
  const stepX = (domain.x[1] - domain.x[0]) / resolution
  const stepY = (domain.y[1] - domain.y[0]) / resolution

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      points.push([
        domain.x[0] + i * stepX,
        domain.y[0] + j * stepY,
      ])
    }
  }
  return points
}

// Numerical gradient computation
export function numericalGradient(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-5
): Point2D {
  const dfdx = (f(x + h, y) - f(x - h, y)) / (2 * h)
  const dfdy = (f(x, y + h) - f(x, y - h)) / (2 * h)
  return [safeNumber(dfdx, 0), safeNumber(dfdy, 0)]
}

// Softmax for attention patterns
export function softmax(values: number[]): number[] {
  if (values.length === 0) return []
  const maxVal = Math.max(...values)
  const exps = values.map(v => Math.exp(safeNumber(v - maxVal, 0)))
  const sum = exps.reduce((a, b) => a + b, 0)
  if (sum === 0) return values.map(() => 1 / values.length) // Uniform fallback
  return exps.map(e => safeNumber(e / sum, 1 / values.length))
}

// Matrix multiplication helper
export function matmul(a: number[][], b: number[][]): number[][] {
  const rows = a.length
  const cols = b[0].length
  const k = b.length
  const result: number[][] = Array(rows).fill(null).map(() => Array(cols).fill(0))

  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      for (let l = 0; l < k; l++) {
        result[i][j] += a[i][l] * b[l][j]
      }
    }
  }
  return result
}

// Frobenius norm of difference (for comparing matrices)
export function frobeniusNorm(a: number[][], b: number[][]): number {
  let sum = 0
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < a[0].length; j++) {
      sum += (a[i][j] - b[i][j]) ** 2
    }
  }
  return Math.sqrt(sum)
}
