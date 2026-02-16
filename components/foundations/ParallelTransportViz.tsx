'use client'

import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import * as THREE from 'three'
import { MATH_COLORS, clamp } from '../../lib/mathObjects'

// Presets for different loop geometries
const LOOP_PRESETS = [
  { name: '🔺 Small Triangle', steps: 3, size: 0.3, description: 'Small loop = small holonomy (≈20°)' },
  { name: '🔷 Large Triangle', steps: 3, size: 0.6, description: 'Large loop = large holonomy (≈60-90°)' },
  { name: '⬛ Square', steps: 4, size: 0.4, description: 'Four-sided geodesic loop' },
  { name: '🌐 Hemisphere', steps: 4, size: 0.8, description: 'Nearly full hemisphere (≈180° holonomy!)' },
  { name: '↔️ Thin Slice', steps: 3, size: 0.15, description: 'Tiny loop = almost flat (≈5°)' },
]

// Dynamic educational insights
function getParallelTransportInsight(
  pathLength: number,
  closedLoop: boolean,
  sphereAngleDeg: number | null
): string {
  if (pathLength === 0) {
    return "🎯 Click and drag on the sphere to trace a path. Watch the orange vector stay 'parallel' as it moves - but curvature secretly rotates it!";
  }

  if (pathLength < 3) {
    return "✏️ Keep drawing! You need at least 3 points for a loop. The teal path shows your trajectory on the curved surface.";
  }

  if (!closedLoop) {
    return "🔄 Complete the loop by returning near your starting point. The holonomy (rotation) is proportional to the enclosed area!";
  }

  if (sphereAngleDeg !== null) {
    const absAngle = Math.abs(sphereAngleDeg);
    if (absAngle < 10) {
      return `🎯 Holonomy: ${sphereAngleDeg.toFixed(1)}° - Very small loop! This is why flat CNNs work on small patches: curvature is nearly zero locally.`;
    }
    if (absAngle < 45) {
      return `🔄 Holonomy: ${sphereAngleDeg.toFixed(1)}° - Noticeable rotation! The Gauss-Bonnet theorem says holonomy = ∫K dA (curvature × area).`;
    }
    if (absAngle < 120) {
      return `🌀 Holonomy: ${sphereAngleDeg.toFixed(1)}° - Large rotation! Equivariant networks must handle this - standard convolutions can't.`;
    }
    return `🔮 Holonomy: ${sphereAngleDeg.toFixed(1)}° - Nearly hemispherical loop! Maximum holonomy approaches 360° for a full sphere.`;
  }

  return "🔬 Parallel transport on curved manifolds is path-dependent. This is why geometric deep learning needs gauge-equivariant layers!";
}

type Vec3 = [number, number, number]
type Vec2 = [number, number]

// ===== Gamification Types =====
type GamePhase = 'setup' | 'countdown' | 'revealed'
type HolonomyPrediction = '<30°' | '30-60°' | '60-90°' | '>90°' | null

interface HolonomyChallenge {
  name: string
  loopPreset: { steps: number; size: number }
  correctRange: '<30°' | '30-60°' | '60-90°' | '>90°'
  hint: string
  explanation: string
}

const HOLONOMY_CHALLENGES: HolonomyChallenge[] = [
  {
    name: '🎲 Mystery A',
    loopPreset: { steps: 3, size: 0.15 },
    correctRange: '<30°',
    hint: 'A tiny triangle near the north pole...',
    explanation: '✅ Small loop = small holonomy! Gauss-Bonnet says holonomy ≈ area × curvature. Tiny triangles have little area, so nearly zero rotation. This is why flat CNNs work on small image patches!',
  },
  {
    name: '🎲 Mystery B',
    loopPreset: { steps: 3, size: 0.45 },
    correctRange: '30-60°',
    hint: 'A medium-sized geodesic triangle...',
    explanation: '🎯 Moderate holonomy! The triangle encloses about 15-25% of a hemisphere. On a unit sphere, holonomy = solid angle = area. This is where curvature effects become noticeable.',
  },
  {
    name: '🎲 Mystery C',
    loopPreset: { steps: 3, size: 0.6 },
    correctRange: '60-90°',
    hint: 'A large triangle spanning much of the visible hemisphere...',
    explanation: '🌀 Large holonomy! This triangle encloses a significant portion of the sphere. A vector transported around it rotates by the enclosed solid angle. Equivariant networks must handle this!',
  },
  {
    name: '🎲 Mystery D',
    loopPreset: { steps: 4, size: 0.8 },
    correctRange: '>90°',
    hint: 'A huge quadrilateral covering most of the hemisphere...',
    explanation: '🔮 Massive holonomy approaching 180°! The loop encloses nearly a full hemisphere. The Gauss-Bonnet theorem predicts holonomy → 2π as area → 2π (half the sphere).',
  },
]

function getHolonomyFeedback(
  prediction: HolonomyPrediction,
  challenge: HolonomyChallenge
): { correct: boolean; message: string } {
  if (!prediction) {
    return { correct: false, message: '❓ No prediction made' }
  }
  if (prediction === challenge.correctRange) {
    return { correct: true, message: challenge.explanation }
  }
  return {
    correct: false,
    message: `❌ Not quite! The answer was ${challenge.correctRange}. ${challenge.explanation}`,
  }
}

interface TransportState {
  path: Vec3[]
  sphereVecs: Vec3[]        // tangent vector along path on sphere
  planePoints: Vec2[]       // same path in local 2D chart
  planeVector: Vec2 | null  // transported vector on the plane (stays constant)
  basis: {
    origin: Vec3
    e1: Vec3
    e2: Vec3
  } | null
}

const SPHERE_SIZE = 380
const PLANE_SIZE = 260
const EPS = 1e-6

// --------- small vector helpers ----------

function length3([x, y, z]: Vec3): number {
  return Math.sqrt(x * x + y * y + z * z)
}

function normalize3(v: Vec3): Vec3 {
  const len = length3(v)
  if (len < EPS) return [0, 0, 0]
  return [v[0] / len, v[1] / len, v[2] / len]
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

function sub3(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
}

function scale3(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s]
}

function length2([x, y]: Vec2): number {
  return Math.hypot(x, y)
}

function normalize2(v: Vec2): Vec2 {
  const len = length2(v) || 1
  return [v[0] / len, v[1] / len]
}

// Build an orthonormal tangent basis at p on the sphere
function makeTangentBasis(pIn: Vec3): { e1: Vec3; e2: Vec3 } {
  const p = normalize3(pIn)
  let a: Vec3 = [0, 1, 0]
  if (Math.abs(dot3(p, a)) > 0.9) {
    a = [1, 0, 0]
  }
  const e1 = normalize3(cross3(a, p))
  const e2 = normalize3(cross3(p, e1))
  return { e1, e2 }
}

function geodesicDistance(pIn: Vec3, qIn: Vec3): number {
  const p = normalize3(pIn)
  const q = normalize3(qIn)
  const d = clamp(dot3(p, q), -1, 1)
  return Math.acos(d)
}

// Project v to the tangent plane at n and renormalize
function projectToTangentNormalized(v: Vec3, nIn: Vec3): Vec3 {
  const n = normalize3(nIn)
  const vn = dot3(v, n)
  const tangent = sub3(v, scale3(n, vn))
  const len = length3(tangent)
  if (len < EPS) return [0, 0, 0]
  return scale3(tangent, 1 / len)
}

// Parallel transport a tangent vector along a short geodesic step on the sphere
function parallelTransportOnSphere(pPrevIn: Vec3, pNextIn: Vec3, vPrevIn: Vec3): Vec3 {
  const pPrev = normalize3(pPrevIn)
  const pNext = normalize3(pNextIn)
  const angle = geodesicDistance(pPrev, pNext)

  if (angle < 1e-5) {
    return vPrevIn
  }

  const axisArr = cross3(pPrev, pNext)
  const axisLen = length3(axisArr)
  if (axisLen < EPS) {
    return vPrevIn
  }

  const axis = new THREE.Vector3(axisArr[0] / axisLen, axisArr[1] / axisLen, axisArr[2] / axisLen)
  const q = new THREE.Quaternion().setFromAxisAngle(axis, angle)

  const vPrev = new THREE.Vector3(vPrevIn[0], vPrevIn[1], vPrevIn[2])
  const rotated = vPrev.clone().applyQuaternion(q)

  const pNextVec = new THREE.Vector3(pNext[0], pNext[1], pNext[2])
  const dot = rotated.dot(pNextVec)
  const tangent = rotated.clone().sub(pNextVec.clone().multiplyScalar(dot))

  if (tangent.lengthSq() < EPS * EPS) {
    return vPrevIn
  }

  tangent.normalize().multiplyScalar(vPrev.length())
  return [tangent.x, tangent.y, tangent.z]
}

// Signed angle between vStart and vEnd in tangent plane at basePoint (in degrees)
function computeHolonomyAngle(basePoint: Vec3, vStart: Vec3, vEnd: Vec3): number {
  const n = normalize3(basePoint)
  const t0 = projectToTangentNormalized(vStart, n)
  const t1 = projectToTangentNormalized(vEnd, n)

  if (length3(t0) < EPS || length3(t1) < EPS) return 0

  const t0v = new THREE.Vector3(t0[0], t0[1], t0[2]).normalize()
  const t1v = new THREE.Vector3(t1[0], t1[1], t1[2]).normalize()

  const dot = clamp(t0v.dot(t1v), -1, 1)
  let angle = Math.acos(dot)

  // Sign via right-hand rule with respect to surface normal
  const cross = new THREE.Vector3().crossVectors(t0v, t1v)
  const normal = new THREE.Vector3(n[0], n[1], n[2])
  const sign = Math.sign(cross.dot(normal))
  if (sign < 0) angle = -angle

  return (angle * 180) / Math.PI
}

export default function ParallelTransportDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const groupRef = useRef<THREE.Group | null>(null)
  const sphereRef = useRef<THREE.Mesh | null>(null)
  const pathLineRef = useRef<THREE.Line | null>(null)
  const arrowRef = useRef<THREE.ArrowHelper | null>(null)
  const raycasterRef = useRef<THREE.Raycaster | null>(null)
  const animationIdRef = useRef<number | null>(null)

  const [transportState, setTransportState] = useState<TransportState>(() => ({
    path: [],
    sphereVecs: [],
    planePoints: [],
    planeVector: null,
    basis: null,
  }))

  const [closedLoop, setClosedLoop] = useState(false)
  const [sphereAngleDeg, setSphereAngleDeg] = useState<number | null>(null)
  const [planeAngleDeg, setPlaneAngleDeg] = useState<number | null>(null)

  // ===== Game State =====
  const [gameMode, setGameMode] = useState(false)
  const [gamePhase, setGamePhase] = useState<GamePhase>('setup')
  const [currentChallengeIdx, setCurrentChallengeIdx] = useState(0)
  const [prediction, setPrediction] = useState<HolonomyPrediction>(null)
  const [countdown, setCountdown] = useState(3)
  const [score, setScore] = useState(0)
  const [completedChallenges, setCompletedChallenges] = useState<Set<number>>(new Set())

  const currentChallenge = HOLONOMY_CHALLENGES[currentChallengeIdx]
  const gameFeedback = gamePhase === 'revealed' && currentChallenge
    ? getHolonomyFeedback(prediction, currentChallenge)
    : null

  // ===== Game Control Functions =====
  // Helper to generate a loop for challenges (defined before useCallback that uses it)
  const generateChallengeLoop = useCallback((challenge: HolonomyChallenge) => {
    const { steps, size } = challenge.loopPreset
    const origin: Vec3 = [0, 0, 1] // Start at north pole region
    const { e1, e2 } = makeTangentBasis(origin)
    const v0 = e1

    const path: Vec3[] = [origin]
    const sphereVecs: Vec3[] = [v0]
    const planePoints: Vec2[] = [[0, 0]]

    // Create a regular polygon path
    const angleStep = (2 * Math.PI) / steps
    for (let i = 0; i < steps; i++) {
      const nextAngle = (i + 1) * angleStep
      const dx = Math.cos(nextAngle) * size
      const dy = Math.sin(nextAngle) * size

      const nextPoint = normalize3([
        origin[0] + dx * e1[0] + dy * e2[0],
        origin[1] + dx * e1[1] + dy * e2[1],
        origin[2] + dx * e1[2] + dy * e2[2],
      ])

      const vPrev = sphereVecs[sphereVecs.length - 1]
      const pPrev = path[path.length - 1]
      const vNext = parallelTransportOnSphere(pPrev, nextPoint, vPrev)

      path.push(nextPoint)
      sphereVecs.push(vNext)
      planePoints.push([dx, dy])
    }

    // Close the loop
    const vPrev = sphereVecs[sphereVecs.length - 1]
    const pPrev = path[path.length - 1]
    const vClosed = parallelTransportOnSphere(pPrev, origin, vPrev)

    path.push(origin)
    sphereVecs.push(vClosed)
    planePoints.push([0, 0])

    const newState: TransportState = {
      path,
      sphereVecs,
      planePoints,
      planeVector: [1, 0],
      basis: { origin, e1, e2 },
    }

    setTransportState(newState)
    setClosedLoop(true)

    // Compute holonomy
    const holonomy = computeHolonomyAngle(origin, v0, vClosed)
    setSphereAngleDeg(holonomy)
    setPlaneAngleDeg(0)
  }, [])

  const startChallenge = useCallback((idx: number) => {
    setCurrentChallengeIdx(idx)
    setPrediction(null)
    setGamePhase('setup')
    setGameMode(true)
    // Generate the mystery loop shape
    generateChallengeLoop(HOLONOMY_CHALLENGES[idx])
  }, [generateChallengeLoop])

  const submitPrediction = useCallback(() => {
    if (!prediction) return
    setGamePhase('countdown')
    setCountdown(3)
  }, [prediction])

  const resetGame = useCallback(() => {
    setGameMode(false)
    setGamePhase('setup')
    setPrediction(null)
    setScore(0)
    setCompletedChallenges(new Set())
    // Clear the loop
    setTransportState({
      path: [],
      sphereVecs: [],
      planePoints: [],
      planeVector: null,
      basis: null,
    })
    setClosedLoop(false)
    setSphereAngleDeg(null)
    setPlaneAngleDeg(null)
  }, [])

  // Countdown effect
  useEffect(() => {
    if (gamePhase !== 'countdown') return
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
    // Reveal result
    setGamePhase('revealed')
    if (currentChallenge && prediction === currentChallenge.correctRange) {
      setScore(s => s + 1)
      setCompletedChallenges(prev => new Set([...prev, currentChallengeIdx]))
    }
  }, [gamePhase, countdown, prediction, currentChallenge, currentChallengeIdx])

  // Dynamic educational insight
  const currentInsight = useMemo(() => {
    return getParallelTransportInsight(transportState.path.length, closedLoop, sphereAngleDeg);
  }, [transportState.path.length, closedLoop, sphereAngleDeg]);

  // Generate a preset loop path on the sphere
  const generatePresetLoop = useCallback((preset: typeof LOOP_PRESETS[0]) => {
    const { steps, size } = preset;
    const origin: Vec3 = [0, 0, 1]; // Start at north pole region
    const { e1, e2 } = makeTangentBasis(origin);
    const v0 = e1;

    const path: Vec3[] = [origin];
    const sphereVecs: Vec3[] = [v0];
    const planePoints: Vec2[] = [[0, 0]];

    // Create a regular polygon path
    const angleStep = (2 * Math.PI) / steps;
    for (let i = 0; i < steps; i++) {
      const _angle = i * angleStep;
      const nextAngle = (i + 1) * angleStep;

      // Move along geodesic in direction determined by angle
      const dx = Math.cos(nextAngle) * size;
      const dy = Math.sin(nextAngle) * size;

      const nextPoint = normalize3([
        origin[0] + dx * e1[0] + dy * e2[0],
        origin[1] + dx * e1[1] + dy * e2[1],
        origin[2] + dx * e1[2] + dy * e2[2],
      ]);

      const vPrev = sphereVecs[sphereVecs.length - 1];
      const pPrev = path[path.length - 1];
      const vNext = parallelTransportOnSphere(pPrev, nextPoint, vPrev);

      path.push(nextPoint);
      sphereVecs.push(vNext);
      planePoints.push([dx, dy]);
    }

    // Close the loop
    const vPrev = sphereVecs[sphereVecs.length - 1];
    const pPrev = path[path.length - 1];
    const vClosed = parallelTransportOnSphere(pPrev, origin, vPrev);

    path.push(origin);
    sphereVecs.push(vClosed);
    planePoints.push([0, 0]);

    const newState: TransportState = {
      path,
      sphereVecs,
      planePoints,
      planeVector: [1, 0],
      basis: { origin, e1, e2 },
    };

    setTransportState(newState);
    setClosedLoop(true);

    // Compute holonomy
    const holonomy = computeHolonomyAngle(origin, v0, vClosed);
    setSphereAngleDeg(holonomy);
    setPlaneAngleDeg(0);
  }, []);

  // --------- Three.js scene setup ----------

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
    if (typeof window !== 'undefined') {
      renderer.setPixelRatio(window.devicePixelRatio || 1)
    }
    renderer.setSize(SPHERE_SIZE, SPHERE_SIZE)
    renderer.setClearColor('#080c14', 1)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#080c14')

    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100)
    camera.position.set(0, 0.6, 3.2)
    camera.lookAt(0, 0, 0)

    const group = new THREE.Group()
    scene.add(group)

    // Sphere
    const sphereGeom = new THREE.SphereGeometry(1, 64, 32)
    const sphereMat = new THREE.MeshStandardMaterial({
      color: '#020617',
      roughness: 0.85,
      metalness: 0.2,
    })
    const sphere = new THREE.Mesh(sphereGeom, sphereMat)
    group.add(sphere)

    // Path line
    const pathMaterial = new THREE.LineBasicMaterial({
      color: MATH_COLORS.secondary,
      linewidth: 2,
    })
    const pathGeom = new THREE.BufferGeometry()
    const pathLine = new THREE.Line(pathGeom, pathMaterial)
    group.add(pathLine)

    // Tangent vector on sphere
    const arrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 0, 0),
      0.4,
      MATH_COLORS.primary
    )
    arrow.visible = false
    group.add(arrow)

    // Lights
    const ambient = new THREE.AmbientLight('#94a3b8', 0.8)
    const directional = new THREE.DirectionalLight('#e5e7eb', 1.2)
    directional.position.set(3, 4, 5)
    scene.add(ambient, directional)

    rendererRef.current = renderer
    sceneRef.current = scene
    cameraRef.current = camera
    groupRef.current = group
    sphereRef.current = sphere
    pathLineRef.current = pathLine
    arrowRef.current = arrow
    raycasterRef.current = new THREE.Raycaster()

    const animate = () => {
      animationIdRef.current = requestAnimationFrame(animate)

      if (groupRef.current) {
        groupRef.current.rotation.y += 0.003
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current)
      }
    }

    animate()

    return () => {
      if (animationIdRef.current !== null) {
        cancelAnimationFrame(animationIdRef.current)
      }
      renderer.dispose()
      sphereGeom.dispose()
      pathGeom.dispose()
      pathMaterial.dispose()
      sphereMat.dispose()
    }
  }, [])

  // Update path geometry + arrow whenever transport state changes
  useEffect(() => {
    const path = transportState.path
    const sphereVecs = transportState.sphereVecs
    const pathLine = pathLineRef.current
    const arrow = arrowRef.current

    if (!pathLine || !arrow) return

    if (path.length === 0) {
      pathLine.visible = false
      arrow.visible = false
      return
    }

    pathLine.visible = true

    const positions = new Float32Array(path.length * 3)
    path.forEach((p, idx) => {
      positions[3 * idx + 0] = p[0]
      positions[3 * idx + 1] = p[1]
      positions[3 * idx + 2] = p[2]
    })

    const newGeom = new THREE.BufferGeometry()
    newGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3))

    // dispose old geometry to avoid leaks
    const oldGeom = pathLine.geometry
    pathLine.geometry = newGeom
    oldGeom.dispose()

    const lastIdx = path.length - 1
    const pLast = path[lastIdx]
    const vLast = sphereVecs[lastIdx]

    if (!vLast) {
      arrow.visible = false
      return
    }

    const origin = new THREE.Vector3(pLast[0], pLast[1], pLast[2])
    const dir = new THREE.Vector3(vLast[0], vLast[1], vLast[2]).normalize()

    arrow.visible = true
    arrow.position.copy(origin)
    arrow.setDirection(dir)
    arrow.setLength(0.35, 0.16, 0.08)
  }, [transportState])

  // --------- picking on sphere ----------

  const pickPointOnSphere = (event: React.PointerEvent<HTMLCanvasElement>): Vec3 | null => {
    const canvas = canvasRef.current
    const camera = cameraRef.current
    const sphere = sphereRef.current
    const raycaster = raycasterRef.current

    if (!canvas || !camera || !sphere || !raycaster) return null

    const rect = canvas.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(new THREE.Vector2(x, y), camera)
    const intersects = raycaster.intersectObject(sphere, false)
    if (!intersects.length) return null

    const point = intersects[0].point.clone().normalize()

    // Optional: stick to front hemisphere for clarity
    if (point.z < 0) {
      point.z *= -1
    }

    return [point.x, point.y, point.z]
  }

  // --------- pointer handlers ----------

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const p0 = pickPointOnSphere(event)
    if (!p0) return

    const { e1, e2 } = makeTangentBasis(p0)
    const origin = p0
    const v0 = e1 // initial tangent vector on sphere
    const planeVector: Vec2 = [1, 0] // same direction in the local chart

    const nextState: TransportState = {
      path: [origin],
      sphereVecs: [v0],
      planePoints: [[0, 0]], // origin is (0,0) in the chart
      planeVector,
      basis: { origin, e1, e2 },
    }

    setTransportState(nextState)
    setClosedLoop(false)
    setSphereAngleDeg(null)
    setPlaneAngleDeg(null)
  }

  const STEP_THRESHOLD_RAD = 0.015 // ~1 degree

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    // Only draw if primary button is down
    if (!(event.buttons & 1)) return

    const nextPoint = pickPointOnSphere(event)
    if (!nextPoint) return

    setTransportState(prev => {
      if (!prev.basis || prev.path.length === 0) return prev

      const lastP = prev.path[prev.path.length - 1]
      const dist = geodesicDistance(lastP, nextPoint)
      if (dist < STEP_THRESHOLD_RAD) return prev

      const pNext = normalize3(nextPoint)
      const vPrev = prev.sphereVecs[prev.sphereVecs.length - 1]
      const vNext = parallelTransportOnSphere(lastP, pNext, vPrev)

      const origin = prev.basis.origin
      const d = sub3(pNext, origin)
      const u = dot3(d, prev.basis.e1)
      const v = dot3(d, prev.basis.e2)

      return {
        ...prev,
        path: [...prev.path, pNext],
        sphereVecs: [...prev.sphereVecs, vNext],
        planePoints: [...prev.planePoints, [u, v]],
      }
    })
  }

  const CLOSE_THRESHOLD_RAD = 0.15 // how close we need to get back to the start to consider it a loop

  const handlePointerUp = () => {
    const state = transportState
    if (!state.basis || state.path.length < 3) {
      setClosedLoop(false)
      setSphereAngleDeg(null)
      setPlaneAngleDeg(null)
      return
    }

    const origin = state.basis.origin
    const lastPoint = state.path[state.path.length - 1]
    const dist = geodesicDistance(origin, lastPoint)

    if (dist > CLOSE_THRESHOLD_RAD) {
      setClosedLoop(false)
      setSphereAngleDeg(null)
      setPlaneAngleDeg(null)
      return
    }

    // Close the loop by transporting one more step from lastPoint back to origin
    const vPrev = state.sphereVecs[state.sphereVecs.length - 1]
    const vClosed = parallelTransportOnSphere(lastPoint, origin, vPrev)

    const closedPath = [...state.path, origin]
    const closedVecs = [...state.sphereVecs, vClosed]
    const closedPlanePts: Vec2[] = [...state.planePoints, [0, 0] as Vec2]

    const newState: TransportState = {
      ...state,
      path: closedPath,
      sphereVecs: closedVecs,
      planePoints: closedPlanePts,
    }
    setTransportState(newState)

    const v0 = newState.sphereVecs[0]
    const vEnd = newState.sphereVecs[newState.sphereVecs.length - 1]
    const holonomy = computeHolonomyAngle(origin, v0, vEnd)

    setSphereAngleDeg(holonomy)
    setPlaneAngleDeg(0) // flat plane: parallel transport is path independent
    setClosedLoop(true)
  }

  // --------- 2D flat-plane view ----------

  const planeDrawing = useMemo(() => {
    const pts = transportState.planePoints
    const planeVec = transportState.planeVector
    if (!pts.length || !planeVec) return null

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    pts.forEach(([x, y]) => {
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    })

    if (!isFinite(minX) || !isFinite(maxX)) {
      minX = -1
      maxX = 1
      minY = -1
      maxY = 1
    }

    const spanX = maxX - minX || 2
    const spanY = maxY - minY || 2
    const centerX = (minX + maxX) / 2
    const centerY = (minY + maxY) / 2
    const margin = 36

    const scale = Math.min(
      (PLANE_SIZE - 2 * margin) / spanX,
      (PLANE_SIZE - 2 * margin) / spanY
    )

    const toSvg = ([x, y]: Vec2): Vec2 => {
      const sx = PLANE_SIZE / 2 + (x - centerX) * scale
      const sy = PLANE_SIZE / 2 - (y - centerY) * scale
      return [sx, sy]
    }

    const svgPoints = pts.map(toSvg)
    const pathD = svgPoints
      .map(([sx, sy], i) => `${i === 0 ? 'M' : 'L'} ${sx.toFixed(2)} ${sy.toFixed(2)}`)
      .join(' ')

    const arrowBaseSvg = svgPoints[svgPoints.length - 1]
    const lastPlanePt = pts[pts.length - 1]

    const vNorm = normalize2(planeVec)
    const arrowLenUnits = Math.max(spanX, spanY) * 0.25
    const arrowTipPlane: Vec2 = [
      lastPlanePt[0] + vNorm[0] * arrowLenUnits,
      lastPlanePt[1] + vNorm[1] * arrowLenUnits,
    ]
    const arrowTipSvg = toSvg(arrowTipPlane)

    const angle = Math.atan2(
      arrowTipSvg[1] - arrowBaseSvg[1],
      arrowTipSvg[0] - arrowBaseSvg[0]
    )
    const headLen = 8

    const headLeft: Vec2 = [
      arrowTipSvg[0] - headLen * Math.cos(angle - Math.PI / 6),
      arrowTipSvg[1] - headLen * Math.sin(angle - Math.PI / 6),
    ]
    const headRight: Vec2 = [
      arrowTipSvg[0] - headLen * Math.cos(angle + Math.PI / 6),
      arrowTipSvg[1] - headLen * Math.sin(angle + Math.PI / 6),
    ]

    return {
      pathD,
      arrowBaseSvg,
      arrowTipSvg,
      headLeft,
      headRight,
    }
  }, [transportState.planePoints, transportState.planeVector])

  // --------- render ----------

  return (
    <section
      className="card interactive-card parallel-transport-demo"
      style={{
        background: '#080c14',
        borderRadius: '16px',
        padding: '1.5rem',
        border: '1px solid rgba(148, 163, 184, 0.35)',
      }}
    >
      <header style={{ marginBottom: '1rem' }}>
        <h2
          style={{
            fontSize: '1.25rem',
            fontWeight: 600,
            color: '#e5e7eb',
            marginBottom: '0.25rem',
          }}
        >
          Parallel Transport & Holonomy
        </h2>
        <p
          className="muted"
          style={{ fontSize: '0.9rem', color: '#9ca3af', maxWidth: '40rem' }}
        >
          Drag the orange tangent vector around a loop on the sphere. When you
          come back to the start, the vector has rotated by an amount equal to
          the total curvature enclosed. On the flat plane, the same loop
          produces no rotation — which is why ordinary convolutions don&apos;t
          directly generalize to curved manifolds.
        </p>
      </header>

      {/* ===== Game Mode Panel ===== */}
      <div
        style={{
          padding: '0.75rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          background: gameMode
            ? 'linear-gradient(135deg, rgba(124, 58, 237, 0.15), rgba(124, 58, 237, 0.05))'
            : 'rgba(15, 23, 42, 0.5)',
          border: gameMode
            ? '1px solid rgba(124, 58, 237, 0.4)'
            : '1px solid rgba(75, 85, 99, 0.3)',
        }}
      >
        {!gameMode ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => startChallenge(0)}
              style={{
                fontSize: '0.85rem',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                border: '1px solid rgba(124, 58, 237, 0.5)',
                background: 'linear-gradient(135deg, rgba(124, 58, 237, 0.3), rgba(124, 58, 237, 0.1))',
                color: '#c4b5fd',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              🎯 Try Holonomy Quiz
            </button>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>
              Predict the rotation angle from loop shape!
            </span>
          </div>
        ) : (
          <div>
            {/* Game Header with Score */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#c4b5fd' }}>
                🎮 Challenge Mode ON
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: '#e5e7eb' }}>
                  Score: {score}/{HOLONOMY_CHALLENGES.length}
                </span>
                <button
                  type="button"
                  onClick={resetGame}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid rgba(239, 68, 68, 0.5)',
                    background: 'transparent',
                    color: '#f87171',
                    cursor: 'pointer',
                  }}
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Challenge Selector */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
              {HOLONOMY_CHALLENGES.map((ch, idx) => (
                <button
                  key={ch.name}
                  type="button"
                  onClick={() => startChallenge(idx)}
                  disabled={gamePhase === 'countdown'}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.35rem 0.7rem',
                    borderRadius: '999px',
                    border: completedChallenges.has(idx)
                      ? '1px solid rgba(34, 197, 94, 0.5)'
                      : currentChallengeIdx === idx
                        ? '1px solid rgba(124, 58, 237, 0.8)'
                        : '1px solid rgba(75, 85, 99, 0.5)',
                    background: completedChallenges.has(idx)
                      ? 'rgba(34, 197, 94, 0.2)'
                      : currentChallengeIdx === idx
                        ? 'rgba(124, 58, 237, 0.3)'
                        : 'rgba(15, 23, 42, 0.8)',
                    color: completedChallenges.has(idx) ? '#4ade80' : '#e5e7eb',
                    cursor: gamePhase === 'countdown' ? 'not-allowed' : 'pointer',
                    opacity: gamePhase === 'countdown' ? 0.5 : 1,
                  }}
                >
                  {completedChallenges.has(idx) ? '✓' : ''} {ch.name}
                </button>
              ))}
            </div>

            {/* Challenge Content */}
            {currentChallenge && (
              <div style={{ marginTop: '0.5rem' }}>
                {gamePhase === 'setup' && (
                  <>
                    <p style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                      💡 {currentChallenge.hint}
                    </p>
                    <p style={{ fontSize: '0.85rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                      Look at the loop on the sphere. What holonomy (rotation) will the vector have after transport?
                    </p>
                    <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                      {(['<30°', '30-60°', '60-90°', '>90°'] as const).map((range) => (
                        <button
                          key={range}
                          type="button"
                          onClick={() => setPrediction(range)}
                          style={{
                            fontSize: '0.8rem',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            border: prediction === range
                              ? '1px solid rgba(251, 191, 36, 0.8)'
                              : '1px solid rgba(75, 85, 99, 0.5)',
                            background: prediction === range
                              ? 'rgba(251, 191, 36, 0.2)'
                              : 'rgba(15, 23, 42, 0.8)',
                            color: prediction === range ? '#fbbf24' : '#e5e7eb',
                            cursor: 'pointer',
                          }}
                        >
                          {range}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={submitPrediction}
                      disabled={!prediction}
                      style={{
                        fontSize: '0.85rem',
                        padding: '0.5rem 1.5rem',
                        borderRadius: '8px',
                        border: '1px solid rgba(34, 197, 94, 0.5)',
                        background: prediction
                          ? 'linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.1))'
                          : 'rgba(15, 23, 42, 0.5)',
                        color: prediction ? '#4ade80' : '#6b7280',
                        cursor: prediction ? 'pointer' : 'not-allowed',
                        fontWeight: 500,
                      }}
                    >
                      Lock In Prediction
                    </button>
                  </>
                )}

                {gamePhase === 'countdown' && (
                  <div style={{ textAlign: 'center', padding: '1rem' }}>
                    <div style={{ fontSize: '3rem', fontWeight: 700, color: '#fbbf24' }}>
                      {countdown}
                    </div>
                    <p style={{ fontSize: '0.9rem', color: '#9ca3af' }}>
                      You predicted: <strong style={{ color: '#fbbf24' }}>{prediction}</strong>
                    </p>
                  </div>
                )}

                {gamePhase === 'revealed' && gameFeedback && (
                  <div
                    style={{
                      padding: '0.75rem',
                      borderRadius: '8px',
                      background: gameFeedback.correct
                        ? 'rgba(34, 197, 94, 0.15)'
                        : 'rgba(239, 68, 68, 0.15)',
                      border: gameFeedback.correct
                        ? '1px solid rgba(34, 197, 94, 0.4)'
                        : '1px solid rgba(239, 68, 68, 0.4)',
                    }}
                  >
                    <p style={{ fontSize: '0.85rem', color: '#e5e7eb', marginBottom: '0.5rem' }}>
                      {gameFeedback.message}
                    </p>
                    <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '0.5rem' }}>
                      Actual holonomy: <strong style={{ color: '#60a5fa' }}>
                        {sphereAngleDeg !== null ? `${sphereAngleDeg.toFixed(1)}°` : '—'}
                      </strong>
                    </p>
                    {currentChallengeIdx < HOLONOMY_CHALLENGES.length - 1 && (
                      <button
                        type="button"
                        onClick={() => startChallenge(currentChallengeIdx + 1)}
                        style={{
                          fontSize: '0.85rem',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid rgba(59, 130, 246, 0.5)',
                          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1))',
                          color: '#93c5fd',
                          cursor: 'pointer',
                          fontWeight: 500,
                        }}
                      >
                        Next Challenge →
                      </button>
                    )}
                    {completedChallenges.size === HOLONOMY_CHALLENGES.length && (
                      <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(251, 191, 36, 0.2)', borderRadius: '6px' }}>
                        <span style={{ color: '#fbbf24', fontWeight: 600 }}>
                          🏆 All challenges complete! You&apos;ve mastered Gauss-Bonnet!
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Loop Geometry Presets */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.75rem' }}>
        {LOOP_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            onClick={() => generatePresetLoop(preset)}
            style={{
              fontSize: '0.75rem',
              padding: '0.35rem 0.7rem',
              borderRadius: '999px',
              border: '1px solid rgba(75, 85, 99, 0.5)',
              background: 'rgba(15, 23, 42, 0.8)',
              color: '#e5e7eb',
              cursor: 'pointer',
              transition: 'all 0.15s ease-out',
            }}
            title={preset.description}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Dynamic Insight */}
      <div
        style={{
          padding: '0.65rem 0.9rem',
          borderRadius: '8px',
          marginBottom: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: 'rgba(255, 255, 255, 0.9)',
          background: closedLoop
            ? sphereAngleDeg && Math.abs(sphereAngleDeg) > 45
              ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(139, 92, 246, 0.05))'
              : 'linear-gradient(135deg, rgba(20, 184, 166, 0.15), rgba(20, 184, 166, 0.05))'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.15), rgba(245, 158, 11, 0.05))',
          border: closedLoop
            ? sphereAngleDeg && Math.abs(sphereAngleDeg) > 45
              ? '1px solid rgba(139, 92, 246, 0.3)'
              : '1px solid rgba(20, 184, 166, 0.3)'
            : '1px solid rgba(245, 158, 11, 0.3)',
        }}
      >
        {currentInsight}
      </div>

      <div
        className="demo-body"
        style={{
          display: 'flex',
          gap: '1.5rem',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
        }}
      >
        {/* Sphere / manifold panel */}
        <div
          className="sphere-panel"
          style={{ flex: '1 1 320px', minWidth: 320, maxWidth: 480 }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: '#9ca3af',
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
              Sphere (curved manifold)
            </span>
            <span>
              Holonomy:{' '}
              {sphereAngleDeg == null
                ? '—'
                : `${sphereAngleDeg.toFixed(1)}°`}
            </span>
          </div>

          <canvas
            ref={canvasRef}
            width={SPHERE_SIZE}
            height={SPHERE_SIZE}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '12px',
              background: '#020617',
              cursor: 'crosshair',
              display: 'block',
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
          />

          <p
            className="caption"
            style={{
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}
          >
            Click and drag on the sphere to trace a triangle-like loop. When the
            path snaps closed, the orange vector returns rotated — curvature has
            twisted your notion of “straight”.
          </p>
        </div>

        {/* Flat plane comparison */}
        <div
          className="plane-panel"
          style={{ flex: '0 0 260px', maxWidth: 320 }}
        >
          <div
            style={{
              fontSize: '0.8rem',
              color: '#9ca3af',
              marginBottom: '0.5rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            }}
          >
            <span style={{ color: '#e5e7eb', fontWeight: 500 }}>
              Local chart (flat plane)
            </span>
            <span>
              Holonomy:{' '}
              {planeAngleDeg == null ? '—' : `${planeAngleDeg.toFixed(1)}°`}
            </span>
          </div>

          <svg
            width={PLANE_SIZE}
            height={PLANE_SIZE}
            viewBox={`0 0 ${PLANE_SIZE} ${PLANE_SIZE}`}
            style={{
              width: '100%',
              height: 'auto',
              borderRadius: '12px',
              background: '#020617',
            }}
          >
            {/* Background grid */}
            <defs>
              <pattern
                id="plane-grid"
                x="0"
                y="0"
                width="16"
                height="16"
                patternUnits="userSpaceOnUse"
              >
                <path
                  d="M 16 0 L 0 0 0 16"
                  fill="none"
                  stroke="rgba(148,163,184,0.25)"
                  strokeWidth="0.5"
                />
              </pattern>
            </defs>
            <rect
              x="0"
              y="0"
              width={PLANE_SIZE}
              height={PLANE_SIZE}
              fill="url(#plane-grid)"
            />

            {/* Axes */}
            <line
              x1={PLANE_SIZE / 2}
              y1={16}
              x2={PLANE_SIZE / 2}
              y2={PLANE_SIZE - 16}
              stroke="rgba(148,163,184,0.8)"
              strokeWidth={1}
            />
            <line
              x1={16}
              y1={PLANE_SIZE / 2}
              x2={PLANE_SIZE - 16}
              y2={PLANE_SIZE / 2}
              stroke="rgba(148,163,184,0.8)"
              strokeWidth={1}
            />

            {/* Path & vector */}
            {planeDrawing && (
              <>
                <path
                  d={planeDrawing.pathD}
                  fill="none"
                  stroke={MATH_COLORS.secondary}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Arrow body */}
                <line
                  x1={planeDrawing.arrowBaseSvg[0]}
                  y1={planeDrawing.arrowBaseSvg[1]}
                  x2={planeDrawing.arrowTipSvg[0]}
                  y2={planeDrawing.arrowTipSvg[1]}
                  stroke={MATH_COLORS.primary}
                  strokeWidth={3}
                />
                {/* Arrow head */}
                <line
                  x1={planeDrawing.arrowTipSvg[0]}
                  y1={planeDrawing.arrowTipSvg[1]}
                  x2={planeDrawing.headLeft[0]}
                  y2={planeDrawing.headLeft[1]}
                  stroke={MATH_COLORS.primary}
                  strokeWidth={3}
                />
                <line
                  x1={planeDrawing.arrowTipSvg[0]}
                  y1={planeDrawing.arrowTipSvg[1]}
                  x2={planeDrawing.headRight[0]}
                  y2={planeDrawing.headRight[1]}
                  stroke={MATH_COLORS.primary}
                  strokeWidth={3}
                />
              </>
            )}
          </svg>

          <p
            className="caption"
            style={{
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: '#9ca3af',
            }}
          >
            The same loop, flattened into a local Euclidean chart. Parallel
            transport here just translates the vector — no rotation after
            closing the loop, so curvature is zero as in ordinary CNNs on
            images.
          </p>
        </div>
      </div>
    </section>
  )
}
