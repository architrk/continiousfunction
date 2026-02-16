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

// ═══════════════════════════════════════════════════════════
// ACTIVATION FUNCTIONS
// ═══════════════════════════════════════════════════════════

/**
 * ReLU activation: max(0, x)
 */
export function relu(x: number): number {
  return Math.max(0, x)
}

/**
 * GELU activation: x * Φ(x) where Φ is standard normal CDF
 * Approximation: 0.5 * x * (1 + tanh(√(2/π) * (x + 0.044715 * x³)))
 */
export function gelu(x: number): number {
  const c = Math.sqrt(2 / Math.PI)
  return safeNumber(0.5 * x * (1 + Math.tanh(c * (x + 0.044715 * x * x * x))), 0)
}

/**
 * SiLU (Swish) activation: x * σ(x) where σ is sigmoid
 */
export function silu(x: number): number {
  return safeNumber(x / (1 + Math.exp(-x)), 0)
}

/**
 * Sigmoid activation: 1 / (1 + e^(-x))
 */
export function sigmoid(x: number): number {
  if (x < -500) return 0
  if (x > 500) return 1
  return 1 / (1 + Math.exp(-x))
}

/**
 * Tanh activation
 */
export function tanh(x: number): number {
  return Math.tanh(x)
}

/**
 * SwiGLU: Gated linear unit with SiLU
 * SwiGLU(x, W, V, b, c) = SiLU(xW + b) ⊙ (xV + c)
 * Simplified version for single values
 */
export function swiglu(x: number, gate: number): number {
  return silu(gate) * x
}

/**
 * Leaky ReLU: max(αx, x) with default α=0.01
 */
export function leakyRelu(x: number, alpha = 0.01): number {
  return x > 0 ? x : alpha * x
}

// ═══════════════════════════════════════════════════════════
// ADDITIONAL VECTOR/MATRIX OPERATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Dot product of two vectors
 */
export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vector length mismatch')
  return a.reduce((sum, ai, i) => sum + ai * b[i], 0)
}

/**
 * Vector norm (L2)
 */
export function norm(v: number[]): number {
  return Math.sqrt(v.reduce((sum, x) => sum + x * x, 0))
}

/**
 * Normalize vector to unit length
 */
export function normalize(v: number[]): number[] {
  const n = norm(v)
  if (n === 0) return v.map(() => 0)
  return v.map(x => x / n)
}

/**
 * Vector addition
 */
export function vecAdd(a: number[], b: number[]): number[] {
  return a.map((x, i) => x + b[i])
}

/**
 * Vector subtraction
 */
export function vecSub(a: number[], b: number[]): number[] {
  return a.map((x, i) => x - b[i])
}

/**
 * Scalar multiplication
 */
export function vecScale(v: number[], s: number): number[] {
  return v.map(x => x * s)
}

/**
 * Transpose a matrix
 */
export function transpose(m: number[][]): number[][] {
  if (m.length === 0) return []
  return m[0].map((_, i) => m.map(row => row[i]))
}

/**
 * Identity matrix of size n
 */
export function eye(n: number): number[][] {
  return Array(n).fill(null).map((_, i) =>
    Array(n).fill(0).map((_, j) => i === j ? 1 : 0)
  )
}

/**
 * Element-wise multiplication (Hadamard product)
 */
export function hadamard(a: number[][], b: number[][]): number[][] {
  return a.map((row, i) => row.map((x, j) => x * b[i][j]))
}

/**
 * Matrix-vector multiplication
 */
export function matvec(m: number[][], v: number[]): number[] {
  return m.map(row => dot(row, v))
}

// ═══════════════════════════════════════════════════════════
// DISTRIBUTION UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Standard normal random number (Box-Muller transform)
 */
export function randn(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

/**
 * Sample from normal distribution N(mean, std²)
 */
export function normalSample(mean = 0, std = 1): number {
  return mean + std * randn()
}

/**
 * Sample n values from standard normal
 */
export function randnArray(n: number): number[] {
  return Array(n).fill(0).map(() => randn())
}

/**
 * Cross-entropy loss: -Σ p(x) log q(x)
 */
export function crossEntropy(p: number[], q: number[]): number {
  const epsilon = 1e-10
  return -p.reduce((sum, pi, i) =>
    sum + pi * Math.log(q[i] + epsilon), 0
  )
}

/**
 * KL divergence: KL(p || q) = Σ p(x) log(p(x)/q(x))
 */
export function klDivergence(p: number[], q: number[]): number {
  const epsilon = 1e-10
  return p.reduce((sum, pi, i) => {
    if (pi < epsilon) return sum
    return sum + pi * Math.log((pi + epsilon) / (q[i] + epsilon))
  }, 0)
}

// ═══════════════════════════════════════════════════════════
// NUMERICAL UTILITIES
// ═══════════════════════════════════════════════════════════

/**
 * Numerical Hessian computation (second derivatives)
 * Returns 2x2 Hessian matrix [[d²f/dx², d²f/dxdy], [d²f/dydx, d²f/dy²]]
 */
export function numericalHessian(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h = 1e-4
): number[][] {
  // d²f/dx² ≈ (f(x+h,y) - 2f(x,y) + f(x-h,y)) / h²
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h)
  const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h)
  // d²f/dxdy ≈ (f(x+h,y+h) - f(x+h,y-h) - f(x-h,y+h) + f(x-h,y-h)) / (4h²)
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h)

  return [
    [safeNumber(fxx, 0), safeNumber(fxy, 0)],
    [safeNumber(fxy, 0), safeNumber(fyy, 0)]
  ]
}

/**
 * Compute spectral norm (largest singular value) of 2x2 matrix
 * For a 2x2 symmetric matrix, this is the largest eigenvalue
 */
export function spectralNorm2x2(m: number[][]): number {
  // For symmetric 2x2: eigenvalues from quadratic formula
  const a = m[0][0]
  const b = m[0][1]
  const d = m[1][1]

  const trace = a + d
  const det = a * d - b * b
  const discriminant = trace * trace - 4 * det

  if (discriminant < 0) {
    // Complex eigenvalues - return magnitude
    return Math.sqrt(det)
  }

  const sqrtDisc = Math.sqrt(discriminant)
  const lambda1 = (trace + sqrtDisc) / 2
  const lambda2 = (trace - sqrtDisc) / 2

  return Math.max(Math.abs(lambda1), Math.abs(lambda2))
}

/**
 * Compute divergence of vector field at a point
 * div(F) = ∂Fx/∂x + ∂Fy/∂y
 */
export function divergence(
  field: (x: number, y: number) => Point2D,
  x: number,
  y: number,
  h = 1e-5
): number {
  const [fx_plus, ] = field(x + h, y)
  const [fx_minus, ] = field(x - h, y)
  const [, fy_plus] = field(x, y + h)
  const [, fy_minus] = field(x, y - h)

  const dFx_dx = (fx_plus - fx_minus) / (2 * h)
  const dFy_dy = (fy_plus - fy_minus) / (2 * h)

  return safeNumber(dFx_dx + dFy_dy, 0)
}

/**
 * 2D rotation matrix for angle θ (in radians)
 * [[cos(θ), -sin(θ)], [sin(θ), cos(θ)]]
 */
export function rotationMatrix2D(theta: number): number[][] {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [[c, -s], [s, c]]
}

/**
 * Apply 2D rotation to a point
 */
export function rotate2D(point: Point2D, theta: number): Point2D {
  const c = Math.cos(theta)
  const s = Math.sin(theta)
  return [
    c * point[0] - s * point[1],
    s * point[0] + c * point[1]
  ]
}
