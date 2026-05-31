# Developer Guide: Building Interactive Educational Websites

A comprehensive guide for software engineers who want to build interactive, animated, mathematical educational websites similar to **Continuous Function**.

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Project Setup](#2-project-setup)
3. [Architecture Patterns](#3-architecture-patterns)
4. [Math Rendering with KaTeX](#4-math-rendering-with-katex)
5. [Animation & Visualization Techniques](#5-animation--visualization-techniques)
6. [Interactive Component Patterns](#6-interactive-component-patterns)
7. [Scroll-Synced Explorable Explanations](#7-scroll-synced-explorable-explanations)
8. [Design System & Styling](#8-design-system--styling)
9. [Performance Optimization](#9-performance-optimization)
10. [Deployment](#10-deployment)

---

## 1. Tech Stack Overview

### Core Framework
| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 15.x | React framework with static export |
| React | 18.x | UI library |
| TypeScript | 5.x | Type safety |

### Visualization & Animation
| Package | Purpose | When to Use |
|---------|---------|-------------|
| **D3.js** | Data-driven DOM manipulation | Complex data visualizations, force graphs |
| **GSAP** | Timeline animations | Sequenced animations, morphing, complex choreography |
| **React Three Fiber** | 3D graphics | 3D surfaces, spatial visualizations |
| **@react-three/drei** | Three.js helpers | Camera controls, geometries, materials |

### Content & Math
| Package | Purpose |
|---------|---------|
| **@next/mdx** | MDX support (React in Markdown) |
| **KaTeX** | Fast LaTeX math rendering |
| **remark-math** | Parse math in Markdown |
| **rehype-katex** | Render KaTeX from remark-math |

### Installation

```bash
# Create Next.js project with TypeScript
npx create-next-app@latest my-educational-site --typescript

cd my-educational-site

# Core visualization packages
npm install d3 @types/d3 gsap

# 3D visualization (optional)
npm install @react-three/fiber @react-three/drei three @types/three

# Math rendering
npm install katex @next/mdx @mdx-js/loader @mdx-js/react
npm install remark-math rehype-katex

# Graph visualization (optional)
npm install react-d3-graph
```

---

## 2. Project Setup

### Directory Structure

```
my-educational-site/
├── components/
│   ├── Layout.tsx              # Main layout wrapper
│   ├── ExplorableLayout.tsx    # Two-column scroll-sync layout
│   ├── ExplorableSection.tsx   # Scroll-triggered section
│   └── visualizations/         # Reusable visualization components
│       ├── PhasePortrait2D.tsx
│       ├── TimeSeriesPlot.tsx
│       ├── KernelHeatmap.tsx
│       └── ...
├── lib/
│   └── mathObjects.ts          # Shared types, colors, utilities
├── pages/
│   ├── _app.tsx                # App wrapper
│   ├── index.tsx               # Home page
│   ├── concepts/               # MDX content pages
│   │   └── *.mdx
│   └── topics/                 # Interactive explorable pages
│       └── *.tsx
├── styles/
│   └── globals.css             # Global styles + CSS variables
├── next.config.mjs             # Next.js + MDX configuration
└── package.json
```

### Next.js Configuration (next.config.mjs)

```mjs
import createMDX from '@next/mdx'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import rehypeSlug from 'rehype-slug'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable static export (no Node.js server needed)
  output: 'export',

  // Support MDX file extensions
  pageExtensions: ['ts', 'tsx', 'mdx'],

  // Trailing slashes for clean URLs on any static host
  trailingSlash: true,

  // Disable image optimization for static export
  images: {
    unoptimized: true
  }
}

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkMath],      // Parse LaTeX in markdown
    rehypePlugins: [
      [rehypeKatex, { trust: false, strict: 'warn', throwOnError: false }],
      rehypeSlug                       // Add IDs to headings for anchor links
    ],
  }
})

export default withMDX(nextConfig)
```

### App Wrapper (_app.tsx)

```tsx
import type { AppProps } from 'next/app'
import Layout from '@/components/app/Layout'
import 'katex/dist/katex.min.css'  // KaTeX styles - CRITICAL!
import '@/styles/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  )
}
```

---

## 3. Architecture Patterns

### Shared Math Utilities (lib/mathObjects.ts)

Create a centralized module for types, colors, and utilities:

```typescript
// ============================================
// TYPE DEFINITIONS
// ============================================

export type Point2D = [number, number]
export type Point3D = [number, number, number]

export interface ScalarField2D {
  f: (x: number, y: number) => number
  domain: { xMin: number; xMax: number; yMin: number; yMax: number }
}

export interface VectorField2D {
  f: (x: number, y: number) => [number, number]
  domain: { xMin: number; xMax: number; yMin: number; yMax: number }
}

export interface TimeSeries {
  data: Array<{ t: number; value: number }>
  label: string
  color: string
}

export interface OptimizationTrajectory {
  points: Point2D[]
  losses: number[]
  optimizer: string
  color: string
}

// ============================================
// COLOR PALETTE
// ============================================

export const MATH_COLORS = {
  // Primary accent - energy, gradients, direction
  primary: '#f59e0b',

  // Secondary - convergence, optimal points
  secondary: '#14b8a6',

  // Tertiary - additional series
  accent: '#8b5cf6',

  // Semantic
  positive: '#22c55e',
  negative: '#ef4444',
  neutral: '#6b7280',

  // Backgrounds
  grid: 'rgba(245, 158, 11, 0.1)',
  surface: 'rgba(28, 25, 23, 0.95)',

  // Gradient series (for multiple lines)
  series: ['#f59e0b', '#14b8a6', '#8b5cf6', '#22c55e', '#f43f5e']
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/** Clamp value to range */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Map value from one range to another */
export function mapRange(
  value: number,
  inMin: number, inMax: number,
  outMin: number, outMax: number
): number {
  return ((value - inMin) / (inMax - inMin)) * (outMax - outMin) + outMin
}

/** Compute numerical gradient using central differences */
export function numericalGradient(
  f: (x: number, y: number) => number,
  x: number,
  y: number,
  h: number = 0.001
): [number, number] {
  const dfdx = (f(x + h, y) - f(x - h, y)) / (2 * h)
  const dfdy = (f(x, y + h) - f(x, y - h)) / (2 * h)
  return [dfdx, dfdy]
}

/** Generate grid of points for sampling a field */
export function generateGrid2D(
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  resolution: number
): Point2D[] {
  const points: Point2D[] = []
  const xStep = (xMax - xMin) / resolution
  const yStep = (yMax - yMin) / resolution

  for (let i = 0; i <= resolution; i++) {
    for (let j = 0; j <= resolution; j++) {
      points.push([xMin + i * xStep, yMin + j * yStep])
    }
  }
  return points
}

/** Softmax normalization */
export function softmax(values: number[]): number[] {
  const max = Math.max(...values)
  const exps = values.map(v => Math.exp(v - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}
```

---

## 4. Math Rendering with KaTeX

### Inline Math in MDX

After configuring remark-math and rehype-katex, use LaTeX syntax in MDX:

```mdx
# Gradient Descent

The update rule is $\theta_{t+1} = \theta_t - \eta \nabla L(\theta_t)$.

For momentum, we maintain a velocity term:

$$
v_{t+1} = \beta v_t + \nabla L(\theta_t)
$$

$$
\theta_{t+1} = \theta_t - \eta v_{t+1}
$$

The momentum coefficient $\beta$ is typically $0.9$.
```

### Inline Math in TSX Components (Safe Ref-Based Approach)

For math in React components, use KaTeX with refs for safe DOM manipulation:

```tsx
import { useRef, useEffect } from 'react'
import katex from 'katex'

interface MathProps {
  tex: string
  display?: boolean
}

export function Math({ tex, display = false }: MathProps) {
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (containerRef.current) {
      katex.render(tex, containerRef.current, {
        displayMode: display,
        throwOnError: false
      })
    }
  }, [tex, display])

  return (
    <span
      ref={containerRef}
      className={display ? 'math-display' : 'math-inline'}
    />
  )
}

// Usage:
// <p>
//   The learning rate <Math tex="\eta" /> controls step size.
// </p>
//
// <Math tex="\nabla L = \frac{\partial L}{\partial \theta}" display />
```

### Common LaTeX Patterns

```latex
% Vectors (bold)
\mathbf{x}, \mathbf{W}, \vec{v}

% Matrices
\begin{bmatrix} a & b \\ c & d \end{bmatrix}

% Gradients
\nabla f, \frac{\partial L}{\partial w}

% Summations
\sum_{i=1}^{n} x_i, \prod_{j=1}^{m} p_j

% Expectations
\mathbb{E}[X], \mathbb{P}(A|B)

% Common ML notation
\theta^*, \hat{y}, \tilde{x}
```

---

## 5. Animation & Visualization Techniques

### 5.1 Canvas-Based Visualizations (Recommended for Performance)

Canvas is the best choice for complex, frequently-updating visualizations.

```tsx
import { useRef, useEffect, useMemo } from 'react'
import { ScalarField2D, MATH_COLORS, mapRange } from '@/lib/mathObjects'

interface PhasePortraitProps {
  field: ScalarField2D
  trajectories?: Array<{ points: [number, number][], color: string }>
  width?: number
  height?: number
}

export function PhasePortrait2D({
  field,
  trajectories = [],
  width = 400,
  height = 300
}: PhasePortraitProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Memoize coordinate transforms
  const transforms = useMemo(() => {
    const { xMin, xMax, yMin, yMax } = field.domain
    const padding = 20

    return {
      // Domain coordinates -> Canvas pixels
      toCanvas: (x: number, y: number): [number, number] => [
        mapRange(x, xMin, xMax, padding, width - padding),
        mapRange(y, yMax, yMin, padding, height - padding) // Y is flipped
      ],
      // Canvas pixels -> Domain coordinates
      toDomain: (cx: number, cy: number): [number, number] => [
        mapRange(cx, padding, width - padding, xMin, xMax),
        mapRange(cy, padding, height - padding, yMax, yMin)
      ],
      domain: field.domain
    }
  }, [field.domain, width, height])

  // Render on every dependency change
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.fillStyle = MATH_COLORS.surface
    ctx.fillRect(0, 0, width, height)

    // Draw grid
    ctx.strokeStyle = MATH_COLORS.grid
    ctx.lineWidth = 1
    const gridSpacing = 40
    for (let x = 0; x < width; x += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
    for (let y = 0; y < height; y += gridSpacing) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }

    // Draw contours or heatmap
    const resolution = 50
    const { xMin, xMax, yMin, yMax } = transforms.domain
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const x = xMin + (i / resolution) * (xMax - xMin)
        const y = yMin + (j / resolution) * (yMax - yMin)
        const value = field.f(x, y)

        const [cx, cy] = transforms.toCanvas(x, y)
        const intensity = Math.min(1, value / 10) // Normalize

        ctx.fillStyle = `rgba(245, 158, 11, ${intensity * 0.3})`
        ctx.fillRect(cx - 2, cy - 2, 4, 4)
      }
    }

    // Draw trajectories
    trajectories.forEach(({ points, color }) => {
      if (points.length < 2) return

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()

      const [startX, startY] = transforms.toCanvas(points[0][0], points[0][1])
      ctx.moveTo(startX, startY)

      for (let i = 1; i < points.length; i++) {
        const [px, py] = transforms.toCanvas(points[i][0], points[i][1])
        ctx.lineTo(px, py)
      }
      ctx.stroke()

      // Draw endpoint marker
      const [endX, endY] = transforms.toCanvas(
        points[points.length - 1][0],
        points[points.length - 1][1]
      )
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(endX, endY, 5, 0, Math.PI * 2)
      ctx.fill()
    })

  }, [field, trajectories, width, height, transforms])

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ borderRadius: '8px' }}
    />
  )
}
```

### 5.2 SVG-Based Interactive Visualizations

SVG is excellent for simpler visualizations that need DOM interactivity:

```tsx
import { useState, useMemo } from 'react'
import { MATH_COLORS } from '@/lib/mathObjects'

interface GradientDescentProps {
  lossFunction?: (x: number) => number
}

export function GradientDescentPlayground({
  lossFunction = (x) => (x - 2) ** 2 + Math.sin(3 * x) * 0.5
}: GradientDescentProps) {
  const [position, setPosition] = useState(0)
  const [learningRate, setLearningRate] = useState(0.3)
  const [history, setHistory] = useState<number[]>([0])

  const width = 320
  const height = 220
  const padding = 30
  const xMin = -2, xMax = 5

  // Generate loss curve path
  const curvePath = useMemo(() => {
    const points: string[] = []
    for (let i = 0; i <= 100; i++) {
      const x = xMin + (i / 100) * (xMax - xMin)
      const y = lossFunction(x)
      const px = padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding)
      const py = height - padding - y * 30
      points.push(`${i === 0 ? 'M' : 'L'} ${px} ${py}`)
    }
    return points.join(' ')
  }, [lossFunction])

  // Coordinate transforms
  const toPixelX = (x: number) =>
    padding + ((x - xMin) / (xMax - xMin)) * (width - 2 * padding)
  const toPixelY = (y: number) =>
    height - padding - y * 30

  // Step function
  const step = () => {
    const h = 0.001
    const gradient = (lossFunction(position + h) - lossFunction(position - h)) / (2 * h)
    const newPosition = position - learningRate * gradient
    setPosition(newPosition)
    setHistory(prev => [...prev, newPosition])
  }

  const reset = () => {
    setPosition(0)
    setHistory([0])
  }

  const currentLoss = lossFunction(position)

  return (
    <div className="interactive-card">
      <svg width={width} height={height} style={{ background: MATH_COLORS.surface }}>
        {/* Grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke={MATH_COLORS.grid} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {/* Loss curve */}
        <path
          d={curvePath}
          fill="none"
          stroke={MATH_COLORS.primary}
          strokeWidth={2}
        />

        {/* History trail */}
        {history.map((x, i) => (
          <circle
            key={i}
            cx={toPixelX(x)}
            cy={toPixelY(lossFunction(x))}
            r={i === history.length - 1 ? 6 : 3}
            fill={i === history.length - 1 ? MATH_COLORS.secondary : MATH_COLORS.neutral}
            opacity={0.3 + (i / history.length) * 0.7}
          />
        ))}

        {/* Current position */}
        <circle
          cx={toPixelX(position)}
          cy={toPixelY(currentLoss)}
          r={8}
          fill={MATH_COLORS.secondary}
          stroke="white"
          strokeWidth={2}
        />

        {/* Labels */}
        <text x={width / 2} y={height - 5} textAnchor="middle" fill={MATH_COLORS.neutral} fontSize={12}>
          x = {position.toFixed(2)}, L(x) = {currentLoss.toFixed(3)}
        </text>
      </svg>

      {/* Controls */}
      <div className="controls">
        <label>
          Learning Rate: {learningRate.toFixed(2)}
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.05}
            value={learningRate}
            onChange={(e) => setLearningRate(parseFloat(e.target.value))}
          />
        </label>

        <div className="button-group">
          <button onClick={step}>Step</button>
          <button onClick={reset}>Reset</button>
        </div>
      </div>
    </div>
  )
}
```

### 5.3 GSAP Timeline Animations

GSAP is perfect for complex, choreographed animations:

```tsx
import { useRef, useLayoutEffect, useState } from 'react'
import gsap from 'gsap'

interface Point { x: number; y: number }

export function MatrixTransformAnimation() {
  const svgRef = useRef<SVGSVGElement>(null)
  const pointsRef = useRef<SVGCircleElement[]>([])
  const [isAnimating, setIsAnimating] = useState(false)

  // Initial grid points
  const gridPoints: Point[] = []
  for (let i = -2; i <= 2; i++) {
    for (let j = -2; j <= 2; j++) {
      gridPoints.push({ x: i * 30 + 150, y: j * 30 + 150 })
    }
  }

  const animate = () => {
    if (isAnimating) return
    setIsAnimating(true)

    const tl = gsap.timeline({
      onComplete: () => setIsAnimating(false)
    })

    // Phase 1: Scale transformation
    tl.to(pointsRef.current, {
      duration: 1,
      attr: {
        cx: (i) => gridPoints[i].x * 1.5 - 75,
        cy: (i) => gridPoints[i].y
      },
      ease: 'power2.inOut',
      stagger: 0.02
    })

    // Phase 2: Rotation transformation
    .to(pointsRef.current, {
      duration: 1,
      attr: {
        cx: (i) => {
          const x = gridPoints[i].x - 150
          const y = gridPoints[i].y - 150
          const angle = Math.PI / 4 // 45 degrees
          return (x * Math.cos(angle) - y * Math.sin(angle)) * 1.5 + 150
        },
        cy: (i) => {
          const x = gridPoints[i].x - 150
          const y = gridPoints[i].y - 150
          const angle = Math.PI / 4
          return (x * Math.sin(angle) + y * Math.cos(angle)) + 150
        }
      },
      ease: 'power2.inOut',
      stagger: 0.02
    })

    // Phase 3: Return to original
    .to(pointsRef.current, {
      duration: 1,
      attr: {
        cx: (i) => gridPoints[i].x,
        cy: (i) => gridPoints[i].y
      },
      ease: 'power2.inOut',
      stagger: 0.02
    })
  }

  return (
    <div className="interactive-card">
      <svg ref={svgRef} width={300} height={300} style={{ background: '#0d1219' }}>
        {/* Grid lines */}
        <g stroke="rgba(245, 158, 11, 0.1)" strokeWidth={1}>
          {[-2, -1, 0, 1, 2].map(i => (
            <line key={`h${i}`} x1={0} y1={i * 30 + 150} x2={300} y2={i * 30 + 150} />
          ))}
          {[-2, -1, 0, 1, 2].map(i => (
            <line key={`v${i}`} x1={i * 30 + 150} y1={0} x2={i * 30 + 150} y2={300} />
          ))}
        </g>

        {/* Animated points */}
        {gridPoints.map((point, i) => (
          <circle
            key={i}
            ref={el => { if (el) pointsRef.current[i] = el }}
            cx={point.x}
            cy={point.y}
            r={4}
            fill="#f59e0b"
          />
        ))}
      </svg>

      <button onClick={animate} disabled={isAnimating}>
        {isAnimating ? 'Animating...' : 'Transform'}
      </button>
    </div>
  )
}
```

### 5.4 3D Visualizations with React Three Fiber

For 3D loss landscapes and spatial visualizations:

```tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'

interface LossSurfaceProps {
  lossFunction: (x: number, y: number) => number
  resolution?: number
}

function LossSurface({ lossFunction, resolution = 50 }: LossSurfaceProps) {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(4, 4, resolution, resolution)
    const positions = geo.attributes.position.array as Float32Array

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]
      const z = lossFunction(x, y)
      positions[i + 2] = z * 0.5 // Scale Z for visibility
    }

    geo.computeVertexNormals()
    return geo
  }, [lossFunction, resolution])

  return (
    <mesh geometry={geometry} rotation={[-Math.PI / 2, 0, 0]}>
      <meshStandardMaterial
        color="#f59e0b"
        wireframe={false}
        side={THREE.DoubleSide}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

function OptimizerPath({ points, color }: { points: [number, number, number][], color: string }) {
  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const positions = new Float32Array(points.flat())
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [points])

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color={color} linewidth={2} />
    </line>
  )
}

export function LossLandscape3D() {
  // Rosenbrock function (classic optimization benchmark)
  const rosenbrock = (x: number, y: number) => {
    const a = 1, b = 100
    return (a - x) ** 2 + b * (y - x ** 2) ** 2
  }

  // Simulated optimizer path
  const sgdPath: [number, number, number][] = [
    [-1.5, -1.5, rosenbrock(-1.5, -1.5) * 0.5 + 0.1],
    [-1.0, -0.5, rosenbrock(-1.0, -0.5) * 0.5 + 0.1],
    [-0.5, 0.2, rosenbrock(-0.5, 0.2) * 0.5 + 0.1],
    [0.5, 0.5, rosenbrock(0.5, 0.5) * 0.5 + 0.1],
    [1.0, 1.0, rosenbrock(1.0, 1.0) * 0.5 + 0.1],
  ]

  return (
    <div style={{ width: '100%', height: 400 }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        <LossSurface lossFunction={rosenbrock} />
        <OptimizerPath points={sgdPath} color="#14b8a6" />

        <Grid
          args={[10, 10]}
          position={[0, -0.5, 0]}
          cellColor="#333"
          sectionColor="#666"
        />

        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  )
}

// IMPORTANT: Dynamic import with SSR disabled for Next.js
// In your page file:
// const LossLandscape3D = dynamic(
//   () => import('@/components/LossLandscape3D').then(m => m.LossLandscape3D),
//   { ssr: false }
// )
```

---

## 6. Interactive Component Patterns

### 6.1 Slider Controls

```tsx
interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (value: number) => void
}

export function Slider({ label, value, min, max, step = 0.01, onChange }: SliderProps) {
  return (
    <div className="slider-control">
      <label>
        <span className="slider-label">{label}: </span>
        <span className="slider-value">{value.toFixed(2)}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </div>
  )
}
```

### 6.2 Guided Prompts (Preset Configurations)

Help users explore by providing curated starting points:

```tsx
interface Preset {
  name: string
  description: string
  params: Record<string, number>
}

const GUIDED_PROMPTS: Preset[] = [
  {
    name: 'Stable descent',
    description: 'Slow but reliable convergence',
    params: { learningRate: 0.1, momentum: 0 }
  },
  {
    name: 'Fast with momentum',
    description: 'Faster convergence with momentum',
    params: { learningRate: 0.3, momentum: 0.9 }
  },
  {
    name: 'Overshooting',
    description: 'Too fast - oscillates around minimum',
    params: { learningRate: 0.95, momentum: 0 }
  },
  {
    name: 'Divergence',
    description: 'Learning rate too high - explodes!',
    params: { learningRate: 1.5, momentum: 0 }
  }
]

export function GuidedPromptButtons({
  onSelect
}: {
  onSelect: (params: Record<string, number>) => void
}) {
  return (
    <div className="guided-prompts">
      <p className="prompt-label">Try these scenarios:</p>
      <div className="prompt-buttons">
        {GUIDED_PROMPTS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => onSelect(preset.params)}
            className="prompt-button"
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  )
}
```

### 6.3 Play/Pause Animation Control

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'

export function useAnimationLoop(
  stepFunction: () => void,
  intervalMs: number = 100
) {
  const [isPlaying, setIsPlaying] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(stepFunction, intervalMs)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isPlaying, stepFunction, intervalMs])

  return {
    isPlaying,
    play: () => setIsPlaying(true),
    pause: () => setIsPlaying(false),
    toggle: () => setIsPlaying(p => !p)
  }
}

// Usage:
function AnimatedVisualization() {
  const [position, setPosition] = useState(0)

  const step = useCallback(() => {
    setPosition(p => p + 0.1)
  }, [])

  const { isPlaying, toggle } = useAnimationLoop(step, 50)

  return (
    <div>
      {/* <Visualization position={position} /> */}
      <button onClick={toggle}>
        {isPlaying ? 'Pause' : 'Play'}
      </button>
    </div>
  )
}
```

---

## 7. Scroll-Synced Explorable Explanations

The key pattern for educational content: text on left, visualization on right, synchronized by scroll position.

### 7.1 Context Provider

```tsx
// contexts/ExplorableContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react'

interface ExplorableContextType {
  activeSection: string | null
  setActiveSection: (id: string | null) => void
  params: Record<string, number>
  setParam: (key: string, value: number) => void
  resetParams: () => void
}

const ExplorableContext = createContext<ExplorableContextType | null>(null)

export function ExplorableProvider({ children }: { children: ReactNode }) {
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [params, setParams] = useState<Record<string, number>>({})

  const setParam = (key: string, value: number) => {
    setParams(prev => ({ ...prev, [key]: value }))
  }

  const resetParams = () => setParams({})

  return (
    <ExplorableContext.Provider value={{
      activeSection,
      setActiveSection,
      params,
      setParam,
      resetParams
    }}>
      {children}
    </ExplorableContext.Provider>
  )
}

export function useExplorable() {
  const context = useContext(ExplorableContext)
  if (!context) {
    throw new Error('useExplorable must be used within ExplorableProvider')
  }
  return context
}
```

### 7.2 Two-Column Layout

```tsx
// components/explorable/ExplorableLayout.tsx
import { ReactNode } from 'react'
import { ExplorableProvider } from '@/contexts/ExplorableContext'

interface ExplorableLayoutProps {
  children: ReactNode
  visualization: ReactNode
  title: string
}

export function ExplorableLayout({
  children,
  visualization,
  title
}: ExplorableLayoutProps) {
  return (
    <ExplorableProvider>
      <div className="explorable-layout">
        <div className="explorable-header">
          <h1>{title}</h1>
        </div>

        <div className="explorable-container">
          {/* Scrollable prose content */}
          <div className="explorable-prose">
            {children}
          </div>

          {/* Sticky visualization panel */}
          <aside className="explorable-visual">
            <div className="explorable-visual-sticky">
              {visualization}
            </div>
          </aside>
        </div>
      </div>
    </ExplorableProvider>
  )
}
```

### 7.3 Scroll-Triggered Sections

```tsx
// components/explorable/ExplorableSection.tsx
import { useEffect, useRef, ReactNode } from 'react'
import { useExplorable } from '@/contexts/ExplorableContext'

interface ExplorableSectionProps {
  id: string
  children: ReactNode
  onEnter?: () => void
  onExit?: () => void
}

export function ExplorableSection({
  id,
  children,
  onEnter,
  onExit
}: ExplorableSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { setActiveSection } = useExplorable()

  useEffect(() => {
    const element = ref.current
    if (!element) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(id)
            onEnter?.()
          } else {
            onExit?.()
          }
        })
      },
      {
        threshold: 0.2,           // Trigger when 20% visible
        rootMargin: '-10% 0px'    // Adjust trigger zone
      }
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [id, setActiveSection, onEnter, onExit])

  return (
    <section ref={ref} id={id} className="explorable-section">
      {children}
    </section>
  )
}
```

### 7.4 Example Usage

```tsx
// pages/topics/optimization.tsx
import { ExplorableLayout } from '@/components/explorable/ExplorableLayout'
import { ExplorableSection } from '@/components/explorable/ExplorableSection'
import { useExplorable } from '@/contexts/ExplorableContext'

function OptimizationVisualPanel() {
  const { activeSection, params } = useExplorable()

  // Visualization changes based on active section
  return (
    <div>
      <p>Current section: {activeSection}</p>
      {/* Your visualization component here */}
    </div>
  )
}

export default function OptimizationPage() {
  return (
    <ExplorableLayout
      title="Gradient Descent"
      visualization={<OptimizationVisualPanel />}
    >
      <ExplorableSection id="intro">
        <h2>What is Gradient Descent?</h2>
        <p>
          Gradient descent is an iterative optimization algorithm...
        </p>
      </ExplorableSection>

      <ExplorableSection id="learning-rate">
        <h2>The Learning Rate</h2>
        <p>
          The learning rate controls how large each step is...
        </p>
      </ExplorableSection>

      <ExplorableSection id="momentum">
        <h2>Adding Momentum</h2>
        <p>
          Momentum helps accelerate convergence by accumulating velocity...
        </p>
      </ExplorableSection>
    </ExplorableLayout>
  )
}
```

---

## 8. Design System & Styling

### 8.1 CSS Variables (globals.css)

```css
:root {
  /* ================================
     BACKGROUND COLORS
     Deep slate canvas with warm tones
     ================================ */
  --bg-deep: #080c14;
  --bg-surface: #0d1219;
  --bg-elevated: #131a24;
  --bg-hover: #1a2332;

  /* ================================
     ACCENT COLORS
     Mathematical energy palette
     ================================ */
  --gradient-orange: #f59e0b;    /* Primary: energy, gradients */
  --converge-teal: #14b8a6;      /* Secondary: convergence, optimal */
  --accent-purple: #8b5cf6;      /* Tertiary */
  --positive: #22c55e;
  --negative: #ef4444;

  /* ================================
     TEXT COLORS
     Warm chalk tones for readability
     ================================ */
  --text-primary: #f5f0e1;
  --text-secondary: #b8b0a0;
  --text-muted: #7a7468;

  /* ================================
     GRID & BORDERS
     ================================ */
  --grid-line: rgba(245, 158, 11, 0.05);
  --grid-line-strong: rgba(245, 158, 11, 0.1);
  --border-subtle: rgba(245, 158, 11, 0.15);
  --border-accent: rgba(245, 158, 11, 0.3);

  /* ================================
     TYPOGRAPHY
     Mathematical journal aesthetic
     ================================ */
  --font-display: 'Crimson Pro', Georgia, serif;
  --font-body: 'IBM Plex Sans', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;

  /* Font sizes */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 2rem;

  /* ================================
     SPACING
     ================================ */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;

  /* ================================
     LAYOUT
     ================================ */
  --max-width: 860px;
  --header-height: 60px;
}
```

### 8.2 Base Styles

```css
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  scroll-behavior: smooth;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-deep);
  color: var(--text-primary);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

/* Mathematical grid background */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line) 1px, transparent 1px),
    linear-gradient(var(--grid-line-strong) 1px, transparent 1px),
    linear-gradient(90deg, var(--grid-line-strong) 1px, transparent 1px);
  background-size:
    20px 20px,
    20px 20px,
    100px 100px,
    100px 100px;
  z-index: -1;
}
```

### 8.3 Typography

```css
h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--text-primary);
  line-height: 1.3;
}

h1 { font-size: var(--text-3xl); margin-bottom: var(--space-6); }
h2 { font-size: var(--text-2xl); margin-bottom: var(--space-4); margin-top: var(--space-8); }
h3 { font-size: var(--text-xl); margin-bottom: var(--space-3); margin-top: var(--space-6); }

p {
  margin-bottom: var(--space-4);
  color: var(--text-secondary);
}

code {
  font-family: var(--font-mono);
  font-size: 0.9em;
  background: var(--bg-elevated);
  padding: 0.2em 0.4em;
  border-radius: 4px;
  color: var(--gradient-orange);
}

pre {
  background: var(--bg-elevated);
  padding: var(--space-4);
  border-radius: 8px;
  overflow-x: auto;
  border: 1px solid var(--border-subtle);
}

pre code {
  background: none;
  padding: 0;
}
```

### 8.4 Explorable Layout Styles

```css
.explorable-layout {
  min-height: 100vh;
}

.explorable-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-8);
  max-width: 1400px;
  margin: 0 auto;
  padding: var(--space-8);
}

.explorable-prose {
  max-width: 600px;
}

.explorable-visual {
  position: relative;
}

.explorable-visual-sticky {
  position: sticky;
  top: calc(var(--header-height) + var(--space-8));
  padding: var(--space-4);
  background: var(--bg-surface);
  border-radius: 12px;
  border: 1px solid var(--border-subtle);
}

.explorable-section {
  min-height: 50vh;
  padding: var(--space-8) 0;
  border-bottom: 1px solid var(--border-subtle);
}

/* Responsive */
@media (max-width: 1024px) {
  .explorable-container {
    grid-template-columns: 1fr;
  }

  .explorable-visual-sticky {
    position: relative;
    top: 0;
    margin-bottom: var(--space-8);
  }
}
```

### 8.5 Interactive Card Styles

```css
.interactive-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: var(--space-4);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.interactive-card:hover {
  border-color: var(--border-accent);
  box-shadow: 0 4px 20px rgba(245, 158, 11, 0.1);
}

/* Slider styling */
.slider-control {
  margin: var(--space-3) 0;
}

.slider-control label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-2);
  font-size: var(--text-sm);
  color: var(--text-secondary);
}

.slider-control input[type="range"] {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-surface);
  appearance: none;
  cursor: pointer;
}

.slider-control input[type="range"]::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--gradient-orange);
  cursor: grab;
  transition: transform 0.1s;
}

.slider-control input[type="range"]::-webkit-slider-thumb:hover {
  transform: scale(1.2);
}

/* Button styling */
button {
  font-family: var(--font-body);
  font-size: var(--text-sm);
  padding: var(--space-2) var(--space-4);
  background: var(--bg-elevated);
  color: var(--text-primary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

button:hover:not(:disabled) {
  background: var(--bg-hover);
  border-color: var(--border-accent);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Guided prompts */
.guided-prompts {
  margin-top: var(--space-4);
}

.prompt-label {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-2);
}

.prompt-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.prompt-button {
  font-size: var(--text-xs);
  padding: var(--space-1) var(--space-3);
  background: transparent;
  border: 1px solid var(--border-accent);
  color: var(--gradient-orange);
}

.prompt-button:hover {
  background: rgba(245, 158, 11, 0.1);
}
```

---

## 9. Performance Optimization

### 9.1 Canvas vs SVG Decision Tree

```
Use CANVAS when:
- Many elements (>100 shapes)
- Frequent updates (>30fps animations)
- Heatmaps, particle systems, dense visualizations
- No need for DOM events on individual elements

Use SVG when:
- Few elements (<100 shapes)
- Need hover/click on individual elements
- Vector export or scaling needed
- CSS animations preferred
```

### 9.2 Memoization Patterns

```tsx
import { useMemo, useCallback } from 'react'

function Visualization({ data, config }) {
  // Memoize expensive computations
  const processedData = useMemo(() => {
    return data.map(d => /* expensive transform */)
  }, [data])

  // Memoize coordinate transforms
  const transforms = useMemo(() => ({
    toCanvas: (x, y) => [/* ... */],
    toDomain: (cx, cy) => [/* ... */]
  }), [config.width, config.height, config.domain])

  // Memoize callbacks
  const handleClick = useCallback((event) => {
    const [x, y] = transforms.toDomain(event.offsetX, event.offsetY)
    // ...
  }, [transforms])

  return /* ... */
}
```

### 9.3 Dynamic Imports for Heavy Components

```tsx
import dynamic from 'next/dynamic'

// Lazy load 3D components (they're large)
const LossLandscape3D = dynamic(
  () => import('@/components/LossLandscape3D'),
  {
    ssr: false,  // Three.js doesn't work server-side
    loading: () => <div className="loading-placeholder">Loading 3D...</div>
  }
)

// Lazy load GSAP animations
const MatrixAnimation = dynamic(
  () => import('@/components/MatrixAnimation'),
  { ssr: false }
)
```

### 9.4 Throttled Updates

```tsx
import { useRef, useCallback, useState } from 'react'

function useThrottledCallback<T extends (...args: any[]) => void>(
  callback: T,
  delay: number
): T {
  const lastCall = useRef(0)

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now()
    if (now - lastCall.current >= delay) {
      lastCall.current = now
      callback(...args)
    }
  }, [callback, delay]) as T
}

// Usage: throttle slider updates
function SliderViz() {
  const [value, setValue] = useState(0)

  const throttledSetValue = useThrottledCallback(setValue, 16) // ~60fps

  return (
    <input
      type="range"
      onChange={(e) => throttledSetValue(parseFloat(e.target.value))}
    />
  )
}
```

---

## 10. Deployment

### 10.1 Static Export

Next.js with `output: 'export'` generates a fully static site:

```bash
# Build static site
npm run build

# Output in `out/` directory
# Can be served by any static host
```

### 10.2 Deployment Options

**GitHub Pages**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./out
```

**Vercel** (Zero config)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

**Netlify**
```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "out"
```

### 10.3 Clean URLs (trailingSlash)

Next.js 15+ with `trailingSlash: true` generates directory-based routes that work on any static host without server configuration:

```mjs
// next.config.mjs
const nextConfig = {
  output: 'export',
  trailingSlash: true,  // Routes become /route/index.html
}
```

**How it works:**
- Without `trailingSlash`: `/about` → `out/about.html` (requires server rewrites)
- With `trailingSlash`: `/about/` → `out/about/index.html` (works everywhere)

**Benefits:**
- No `.htaccess`, `_redirects`, or server configuration needed
- Works on GitHub Pages, Netlify, Vercel, S3, or any static host
- Deep links work correctly on page refresh

**Note:** All internal links should use trailing slashes (e.g., `/concepts/` not `/concepts`) for consistency.

---

## Quick Reference: Common Patterns

### Adding a New Visualization

1. **Create the component** in `components/visualizations/`
2. **Import shared utilities** from `lib/mathObjects.ts`
3. **Use consistent colors** from `MATH_COLORS`
4. **Add TypeScript interfaces** for props
5. **Memoize expensive computations** with `useMemo`
6. **Handle responsive sizing** via props or container queries

### Adding a New Explorable Page

1. **Create page** in `pages/topics/[name].tsx`
2. **Wrap with** `<ExplorableLayout>`
3. **Define sections** with `<ExplorableSection id="...">`
4. **Create visualization panel** that reads `useExplorable()` context
5. **Switch visualization** based on `activeSection`

### Adding Math Content

1. **Use MDX** for prose-heavy content with embedded components
2. **Use inline KaTeX** for equations in TSX with ref-based rendering
3. **Reference the KaTeX docs** for available commands
4. **Test math rendering** - some symbols need escaping

---

## Resources

- [D3.js Documentation](https://d3js.org/)
- [GSAP Documentation](https://greensock.com/docs/)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber)
- [KaTeX Supported Functions](https://katex.org/docs/supported.html)
- [Next.js MDX](https://nextjs.org/docs/pages/building-your-application/configuring/mdx)
- [Explorable Explanations](https://explorabl.es/) - Inspiration gallery

---

*This guide is part of the Continuous Function project. See `CONTENT_STRATEGY.md` for pedagogical philosophy and `CLAUDE.md` for AI assistant instructions.*
